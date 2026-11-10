import "server-only";
import { sql, getConfig, type QueueItem } from "./db";
import type { ResultadoDaPublicacao } from "./engine";

/** O resultado do enfileirar, como o do Instagram (`ResultadoDaPublicacao`), com o id da linha que entrou. */
export type ResultadoDoLinkedin = { entrou: false } | (Extract<ResultadoDaPublicacao, { entrou: true }> & { id: string });
import { scheduleTick, HORIZONTE_DO_TIQUE_EM_SEGUNDOS } from "./qstash";
import { atrasoDoTiqueDaPublicacao } from "./publicacao";
import { chaveDaPublicacaoNoLinkedin } from "./dedupe";
import { urlPublicaDoObjeto } from "./bucket";
import { conexaoDaConta } from "./linkedin-conexoes";
import {
  criarPost,
  enviarImagem,
  LinkedinError,
  reservarImagem,
  TETO_DO_ENVIO_DA_IMAGEM_MS,
  TETO_DO_LINKEDIN_MS,
} from "./linkedin";
import {
  corpoDoPost,
  desfechoDoErroDoLinkedin,
  lerPayloadDoLinkedin,
  motivoDaAutorizacaoRecusada,
  oPostPodeTerSaido,
  payloadDoLinkedin,
  recusaDoPedidoNoLinkedin,
  type FormaNoLinkedin,
} from "./linkedin-publicacao";

// O POST DO LINKEDIN PELA FILA (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a parte 2a: só texto e imagem,
// uma rede por post). Dois pedaços: o enfileirar, no molde do `enqueuePublicacao` (lib/engine.ts), e o publicar,
// chamado pelo ramo `publicacao_linkedin` do dreno (lib/queue-drain.ts).
//
// O DRENO PASSA AS TRÊS FUNÇÕES DELE (`finish`, `guardarNoPayload` e `limparOBucket`), e este arquivo não importa o
// dreno: o dreno importa daqui, e o contrário seria um ciclo.

/**
 * ENFILEIRA O POST DO LINKEDIN. `quando: null` é agora, pelo `now()` do banco, e data no passado também é agora
 * (o mesmo de `enqueuePublicacao`). O resultado é medido pelo banco, no mesmo statement que grava.
 *
 * NÃO ENTRA o pedido torto: a forma sem a quantidade certa de arquivos, o texto vazio ou longo demais e o envio
 * sem id. A tela confere antes e diz o motivo; esta recusa é a segunda barreira, para nenhuma linha nascer
 * condenada a falhar no dreno.
 *
 * A CHAVE (lib/dedupe.ts, `chaveDaPublicacaoNoLinkedin`): a imagem pela conta e pelo caminho, que é único por
 * upload; o só texto pela conta e pelo id do envio, que a tela gera uma vez por formulário. O mesmo clique
 * repetido não entra duas vezes; o mesmo texto num envio novo entra.
 */
export async function enqueuePublicacaoNoLinkedin(
  accountId: string,
  pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string; idDoEnvio: string },
  quando: Date | null
): Promise<ResultadoDoLinkedin> {
  const payload = payloadDoLinkedin(pedido);
  // AS MESMAS RECUSAS DA TELA E DA ACTION (`recusaDoPedidoNoLinkedin`), sobre o texto já aparado do payload.
  if (recusaDoPedidoNoLinkedin({ ...pedido, texto: payload.texto }) || !lerPayloadDoLinkedin(payload)) {
    return { entrou: false };
  }
  const linhas = (await sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
     values ($1, 'publicacao_linkedin', $2, $3, greatest(now(), coalesce($4::timestamptz, now())))
     on conflict (dedupe_key) do nothing
     returning id,
               (not_before <= now()) as ja_vale,
               greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
    [accountId, payload, chaveDaPublicacaoNoLinkedin(accountId, pedido.forma, pedido.caminhos, pedido.idDoEnvio), quando]
  )) as { id: string; ja_vale: boolean; falta: number }[];
  if (!linhas.length) return { entrou: false };
  const { id, ja_vale: jaVale, falta } = linhas[0];

  // O TIQUE NÃO DERRUBA O QUE JÁ ENTROU (o achado 101, do `enqueuePublicacao`): sem tique, o post ainda sai pelo
  // rodapé do dreno, por um webhook ou pelo cron, só mais tarde.
  const atrasoDoTique = jaVale ? null : atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS);
  if (atrasoDoTique !== null) {
    try {
      const config = await getConfig();
      await scheduleTick(config.app_url ?? "", atrasoDoTique);
    } catch {
      // Calado de propósito: o post está na fila, e é isso que a tela diz.
    }
  }
  return { entrou: true, jaVale, falta, id };
}

/** O motivo gravado numa linha da fila, para o aviso do "agora" que não saiu. */
export async function erroDaLinha(id: string): Promise<string | null> {
  const [linha] = (await sql().query(`select error from queue where id = $1`, [id])) as { error: string | null }[];
  return linha?.error ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// O PUBLICAR, CHAMADO PELO DRENO
// ---------------------------------------------------------------------------------------------------------------

export type DependenciasDoDreno = {
  finish: (id: string, campos: { status: string; sent_at?: Date; error?: string }) => Promise<void>;
  guardarNoPayload: (id: string, campos: Record<string, unknown>) => Promise<void>;
  limparOBucket: (item: { id: string }, caminhos: string[], igUserId: string) => Promise<void>;
  /** A hora (epoch, ms) até a qual a função pode trabalhar; depois dela, a Vercel pode matá-la. */
  prazoMs: number;
};

export type DesfechoDoPostNoLinkedin = "publicado" | "aguardando" | "falhou";

export const MOTIVO_DO_PAYLOAD_TORTO = "o payload deste item não é de um post do LinkedIn";
export const MOTIVO_SEM_CONEXAO = "esta conta não tem LinkedIn conectado";
export const MOTIVO_PODE_TER_SAIDO =
  "o post pode ter saído no LinkedIn sem a confirmação chegar; confira no seu LinkedIn antes de publicar de novo";
export const MOTIVO_SEM_TEMPO = "o tempo desta passada não bastava para o post sair inteiro; ele sai na próxima";

/** O teto do download da imagem do bucket. Sem ele, um bucket que não responde seguraria o dreno inteiro. */
const TETO_DO_BUCKET_MS = 10_000;

// O ORÇAMENTO DE TEMPO DO RAMO (notas da auditoria sobre a F2). As funções que drenam têm 60 s, e a Vercel mata a
// que passa disso. Morta no meio, a linha fica em 'sending' e, depois da marca do POST, vira "pode ter saído":
// nenhum dos dois duplica, mas os dois fazem o post falhar sem precisar. Então cada passo só começa se o que resta
// do prazo cobre o pior caso dele (a soma dos tetos), com folga. A soma do ramo inteiro é 45 s.
const FOLGA_MS = 5_000;
/** O bucket, a reserva e o envio, com a folga: 40 s. */
const TEMPO_PARA_A_IMAGEM_MS = TETO_DO_BUCKET_MS + TETO_DO_LINKEDIN_MS + TETO_DO_ENVIO_DA_IMAGEM_MS + FOLGA_MS;
/** O POST, com a folga: 15 s. */
const TEMPO_PARA_O_POST_MS = TETO_DO_LINKEDIN_MS + FOLGA_MS;
/** Quando falta tempo, a linha volta para daqui a pouco: a próxima passada é outra função, com o prazo inteiro. */
const VOLTA_SEM_TEMPO_EM_SEGUNDOS = 20;

/**
 * A LINHA VOLTA À FILA SEM GASTAR A TENTATIVA: a reivindicação contou uma, e nada foi tentado. Sem o desconto,
 * três passadas sem tempo levariam o primeiro erro passageiro a encerrar a linha.
 */
async function devolverSemGastarTentativa(id: string): Promise<void> {
  await sql().query(
    `update queue set status = 'pending', attempts = greatest(attempts - 1, 0),
            not_before = now() + make_interval(secs => $2::int), error = $3
      where id = $1`,
    [id, VOLTA_SEM_TEMPO_EM_SEGUNDOS, MOTIVO_SEM_TEMPO]
  );
}

/**
 * Os bytes da imagem, pelo endereço público do bucket (o mesmo do `copiarParaAFila`, lib/bonus/publicar-bucket.ts).
 * Lança com o status, sem o endereço; o erro volta à fila pelo `catch` do dreno.
 */
async function bytesDaImagem(caminho: string): Promise<ArrayBuffer> {
  const r = await fetch(urlPublicaDoObjeto(caminho), { cache: "no-store", signal: AbortSignal.timeout(TETO_DO_BUCKET_MS) });
  if (!r.ok) throw new Error(`a imagem do post não foi encontrada no armazenamento (HTTP ${r.status})`);
  return r.arrayBuffer();
}

/**
 * A RECUSA DO LINKEDIN QUE ENCERRA A LINHA, ou null quando o erro é passageiro (ou não é do LinkedIn) e a linha
 * volta à fila pelo `catch` do dreno. O 401 diz quem refazer o convite; o resto leva o status e o texto do
 * LinkedIn, que não têm a autorização.
 */
function recusaDoLinkedin(err: unknown, nome: string): string | null {
  if (!(err instanceof LinkedinError)) return null;
  const desfecho = desfechoDoErroDoLinkedin(err.status);
  if (desfecho === "autorizacao") return motivoDaAutorizacaoRecusada(nome);
  if (desfecho === "permanente") return err.message.slice(0, 500);
  return null;
}

/** A marca do POST sai quando o LinkedIn respondeu que não criou o post (um 4xx). */
async function tirarAMarcaDoPost(id: string): Promise<void> {
  await sql().query(`update queue set payload = payload - 'post_tentado_em' where id = $1`, [id]);
}

/**
 * PUBLICA A LINHA NO LINKEDIN. Os passos ficam marcados no payload, e cada passada começa do que falta:
 *
 *   1. com o `post_urn`, o post já saiu: a linha fecha `sent` sem publicar de novo;
 *   2. com o `post_tentado_em` e sem o `post_urn`, um POST anterior ficou sem resposta (a função caiu, o banco
 *      falhou): a linha vai a `failed` dizendo para conferir no LinkedIn, e NÃO publica (achado 210);
 *   3. sem tempo para o passo seguinte, a linha volta à fila sem gastar a tentativa (o orçamento, acima); a
 *      conferência se repete antes da marca;
 *   3a. sem conexão, ou com ela vencida, a linha vai a `failed` com o motivo, sem chamar o LinkedIn;
 *   4. a imagem: baixa do bucket, reserva com a pessoa dona, envia, e grava o `imagem_urn`. Numa passada seguinte,
 *      ela não sobe de novo;
 *   5. o `post_tentado_em` é gravado ANTES do POST, e o `post_urn` logo depois;
 *   6. `sent`, e só então o arquivo sai do bucket (o cabeçalho de `limparOBucket`).
 *
 * O ERRO PASSAGEIRO (rede, 429, 409 e 5xx, antes do POST) sobe ao `catch` do dreno, que devolve a linha à fila ou
 * a encerra pelo número de tentativas. Depois do POST, só o 4xx prova que o post não saiu (`oPostPodeTerSaido`).
 */
export async function publicarNoLinkedinDaFila(item: QueueItem, deps: DependenciasDoDreno): Promise<DesfechoDoPostNoLinkedin> {
  const pub = lerPayloadDoLinkedin(item.payload);
  if (!pub) {
    await deps.finish(item.id, { status: "failed", error: MOTIVO_DO_PAYLOAD_TORTO });
    return "falhou";
  }
  const conta = item.account_id ?? "";

  if (pub.postUrn) {
    await deps.finish(item.id, { status: "sent", sent_at: new Date() });
    await deps.limparOBucket(item, pub.caminhos, conta);
    return "publicado";
  }
  if (pub.postTentadoEm) {
    await deps.finish(item.id, { status: "failed", error: MOTIVO_PODE_TER_SAIDO });
    return "falhou";
  }

  // O TEMPO, ANTES DE QUALQUER CHAMADA: a imagem que ainda não subiu precisa do bucket, da reserva e do envio; o
  // resto, só do post.
  const precisa = pub.forma === "imagem" && !pub.imagemUrn ? TEMPO_PARA_A_IMAGEM_MS : TEMPO_PARA_O_POST_MS;
  if (deps.prazoMs - Date.now() < precisa) {
    await devolverSemGastarTentativa(item.id);
    return "aguardando";
  }

  const conexao = conta ? await conexaoDaConta(conta) : null;
  if (!conexao) {
    await deps.finish(item.id, { status: "failed", error: MOTIVO_SEM_CONEXAO });
    return "falhou";
  }
  if (new Date(conexao.expira_em).getTime() <= Date.now()) {
    await deps.finish(item.id, { status: "failed", error: motivoDaAutorizacaoRecusada(conexao.nome) });
    return "falhou";
  }

  let imagemUrn = pub.imagemUrn ?? undefined;
  if (pub.forma === "imagem" && !imagemUrn) {
    try {
      const bytes = await bytesDaImagem(pub.caminhos[0]);
      const reserva = await reservarImagem(conexao.access_token, conexao.pessoa_id);
      // O mime é fixo: a tela de publicar só aceita JPEG para imagem (lib/publicacao.ts, `MIMES_DE_IMAGEM`).
      await enviarImagem(reserva.uploadUrl, conexao.access_token, bytes, "image/jpeg");
      imagemUrn = reserva.imagemUrn;
    } catch (err) {
      const recusa = recusaDoLinkedin(err, conexao.nome);
      if (recusa === null) throw err;
      await deps.finish(item.id, { status: "failed", error: recusa });
      return "falhou";
    }
    await deps.guardarNoPayload(item.id, { imagem_urn: imagemUrn });
  }

  // O TEMPO DE NOVO, depois da imagem: o passo que pode duplicar nunca começa perto do fim da função. O
  // `imagem_urn` já está gravado, e a passada seguinte só publica.
  if (deps.prazoMs - Date.now() < TEMPO_PARA_O_POST_MS) {
    await devolverSemGastarTentativa(item.id);
    return "aguardando";
  }

  // A MARCA ANTES DO POST (achado 210): uma resposta perdida daqui em diante não vira um segundo post.
  await deps.guardarNoPayload(item.id, { post_tentado_em: new Date().toISOString() });
  let postUrn: string;
  try {
    postUrn = await criarPost(
      conexao.access_token,
      corpoDoPost({ pessoaId: conexao.pessoa_id, texto: pub.texto, imagemUrn })
    );
  } catch (err) {
    if (!(err instanceof LinkedinError) || oPostPodeTerSaido(err.status)) {
      await deps.finish(item.id, { status: "failed", error: MOTIVO_PODE_TER_SAIDO });
      return "falhou";
    }
    // O LinkedIn respondeu 4xx: o post não foi criado, e a marca sai. O 429 e o 409 voltam à fila; o resto encerra.
    await tirarAMarcaDoPost(item.id);
    const recusa = recusaDoLinkedin(err, conexao.nome);
    if (recusa === null) throw err;
    await deps.finish(item.id, { status: "failed", error: recusa });
    return "falhou";
  }
  await deps.guardarNoPayload(item.id, { post_urn: postUrn });
  await deps.finish(item.id, { status: "sent", sent_at: new Date() });
  // DEPOIS DO `finish`, e nunca antes: ver o cabeçalho de `limparOBucket`.
  await deps.limparOBucket(item, pub.caminhos, conta);
  return "publicado";
}
