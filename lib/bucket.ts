import "server-only";

// O BUCKET DO SUPABASE — a única razão pela qual publicar vídeo é possível.
//
// MEDIDO em 03/09/2026: a Vercel recusa corpo de requisição acima de 4,5 MB
// (413, `FUNCTION_PAYLOAD_TOO_LARGE`), e um reels vai a 300 MB. O arquivo NÃO
// PODE passar pelo nosso servidor. Ele vai do navegador direto ao bucket, por
// URL assinada, e a Meta o busca depois pelo endereço público.
//
// Este arquivo é `server-only` pelo mesmo motivo que `lib/db.ts` é: ele usa a
// `SUPABASE_SERVICE_ROLE_KEY`, que abre o projeto inteiro e não pode chegar ao
// navegador em nenhuma hipótese. O import de cima é o que garante isso — o
// bundler do Next quebra a compilação se um componente de cliente puxar este
// módulo, mesmo por engano, mesmo por uma cadeia de três arquivos.
//
// E O CUIDADO IRMÃO DESSE É O `import type`: quem for importar tipos daqui num
// arquivo que roda no navegador tem de usar `import type`, que a compilação
// apaga. Um import normal arrasta o `server-only` junto — foi o que a
// `npm run varredura` pegou em `app/labels.ts`.
//
// =============================================================================
// SEM SDK NOVO, E ISSO É DECISÃO.
//
// A API de Storage do Supabase é REST, e `fetch` basta. `@supabase/supabase-js`
// puxaria uma dependência grande (com realtime, auth e postgrest dentro) para
// duas chamadas — e este projeto tem quatro dependências de produção.
//
// AS CINCO CHAMADAS ABAIXO FORAM EXERCITADAS CONTRA O PROJETO REAL em
// 03/09/2026, e não copiadas de documentação:
//
//   GET    /storage/v1/bucket/{bucket}                    -> 200, file_size_limit
//   POST   /storage/v1/object/upload/sign/{bucket}/{path} -> 200, {url, token}
//   PUT    /storage/v1{url}  (SEM Authorization nenhuma)  -> 200  <- o navegador
//   GET    /storage/v1/object/public/{bucket}/{path}      -> 200 sem autenticação
//   DELETE /storage/v1/object/{bucket}/{path}             -> 200
//
// O `GET` público SEM AUTENTICAÇÃO é requisito da META, e não conveniência
// nossa: ela baixa a mídia do nosso endereço com um cliente que não tem token.

/**
 * Lê uma variável obrigatória do ambiente.
 *
 * ELA NOMEIA A QUE FALTA E NÃO MOSTRA VALOR NENHUM — nem da que falta, nem das
 * outras. Mensagem de erro é a coisa mais copiada e colada que existe: vai para
 * o log da Vercel, para o print no WhatsApp e para o chat. Uma que imprimisse a
 * `SUPABASE_SERVICE_ROLE_KEY` a vazaria para os três de uma vez.
 */
function precisa(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`${nome} é obrigatória e não está definida no ambiente.`);
  return v;
}

/** A base do projeto, sem a barra final — que dobraria na URL montada. */
function base(): string {
  return precisa("SUPABASE_URL").replace(/\/+$/, "");
}

/**
 * O NOME DO BUCKET VEM DO AMBIENTE, NUNCA DO CÓDIGO.
 *
 * Ele se chama `MetodoChat`, com maiúsculas — escolha do dono, e o Supabase não
 * permite renomear bucket depois de criado. Normalizar a caixa aqui daria 404
 * em tudo, e cravar o nome no código faria um ambiente de teste futuro escrever
 * no bucket de produção.
 */
function bucket(): string {
  return precisa("SUPABASE_BUCKET");
}

function cabecalhosDeServico(): Record<string, string> {
  const chave = precisa("SUPABASE_SERVICE_ROLE_KEY");
  // As duas: `apikey` é o que o gateway do Supabase lê, `Authorization` é o que
  // o serviço de Storage lê. Faltando uma, a resposta é 401 sem dizer qual.
  return { Authorization: `Bearer ${chave}`, apikey: chave };
}

/**
 * A frase de uma resposta ruim do Supabase.
 *
 * O corpo da resposta ENTRA (é onde o Supabase escreve "Bucket not found" ou
 * "The resource already exists", que é o que resolve o problema); a URL chamada
 * NÃO entra, porque a URL assinada carrega o token no `?token=`.
 */
async function falha(oQue: string, r: Response): Promise<Error> {
  const corpo = (await r.text().catch(() => "")).slice(0, 300);
  return new Error(`${oQue}: HTTP ${r.status}${corpo ? ` — ${corpo}` : ""}`);
}

/** As extensões que este produto sobe. Ver o porquê em `caminhoDoObjeto`. */
const EXTENSOES_CONHECIDAS = ["jpg", "jpeg", "mp4", "mov", "m4v", "webm"];

/**
 * O nome do objeto no bucket.
 *
 * =============================================================================
 * A CONTA VAI NA FRENTE, e não é organização: é a separação que impede duas
 * contas de escreverem uma por cima da outra. O bucket é um só para as quatro,
 * e "foto.jpg" é o nome mais provável do mundo.
 *
 * O NOME CRU NÃO ENTRA. Nome de arquivo é texto de gente — acento, espaço,
 * aspas, emoji, e "../" — e este caminho vira parte de uma URL que a META vai
 * buscar. Um caractere que o Supabase aceita mas a Meta não resolve seria uma
 * publicação que falha DEPOIS de 200 MB enviados.
 *
 * A EXTENSÃO SOBREVIVE, e isso é decisão: a Tarefa 4 monta o pedido da Meta a
 * partir da URL guardada no payload, e `pareceVideo` (lib/publicacao.ts) usa a
 * extensão como último recurso para escolher entre `image_url` e `video_url`.
 * O que não está na lista vira `bin` em vez de virar caminho — um ".php" ou um
 * ".svg" no fim de uma URL pública é convite que não temos motivo para fazer.
 *
 * `identificador` existe para o teste poder prender a forma. Em produção ele é
 * omitido e vem de `randomUUID`, e é ele que torna o caminho único: duas
 * pessoas subindo o MESMO arquivo na MESMA conta não podem colidir, e a URL
 * assinada é pedida uma por upload.
 */
export function caminhoDoObjeto(
  contaIgId: string,
  nomeOriginal: string,
  identificador: string = crypto.randomUUID()
): string {
  const ext = (nomeOriginal.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const extensao = EXTENSOES_CONHECIDAS.includes(ext) ? ext : "bin";
  // A conta também é higienizada: ela vem do banco e é numérica hoje, mas é o
  // primeiro segmento do caminho, e o dia em que deixar de ser numérica não
  // pode ser o dia em que alguém escreve fora da própria pasta.
  const pasta = contaIgId.replace(/[^A-Za-z0-9_-]/g, "");
  return `${pasta}/${identificador}.${extensao}`;
}

/**
 * O endereço que a META vai buscar.
 *
 * MEDIDO em 03/09/2026: responde HTTP 200 SEM autenticação nenhuma. É por isso
 * que o bucket é público — a Meta baixa a mídia com um cliente que não tem
 * token nosso, e uma URL assinada de leitura venceria antes de ela buscar.
 *
 * Ele é montado NUM LUGAR SÓ. Espalhar `/storage/v1/object/public/...` por três
 * arquivos é como se acerta um e se esquecem os outros dois.
 */
export function urlPublicaDoObjeto(caminho: string): string {
  return `${base()}/storage/v1/object/public/${bucket()}/${caminho}`;
}

/**
 * A URL para o NAVEGADOR subir o arquivo, sem nunca ver a nossa chave.
 *
 * MEDIDO: o `PUT` nessa URL funciona SEM cabeçalho `Authorization` — o token do
 * `?token=` é a credencial inteira, e ela vale só para AQUELE caminho, só para
 * subir (`scope: upload`), e por 2 horas (`exp - iat = 7200`).
 *
 * É isso que faz o desenho fechar: a `SUPABASE_SERVICE_ROLE_KEY` fica no
 * servidor, o navegador recebe permissão de um arquivo só, e os 300 MB não
 * passam pela Vercel.
 *
 * O token nasce com `upsert: false`, e está certo assim: cada upload pede um
 * caminho novo (`caminhoDoObjeto` sorteia o identificador), então sobrescrever
 * nunca é o que se quer — e um `upsert` ligado transformaria um caminho
 * adivinhado em permissão de trocar arquivo alheio.
 */
export async function urlAssinadaDeUpload(caminho: string): Promise<{ url: string; token: string }> {
  const r = await fetch(`${base()}/storage/v1/object/upload/sign/${bucket()}/${caminho}`, {
    method: "POST",
    headers: { ...cabecalhosDeServico(), "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) throw await falha("Nao foi possivel assinar o upload no bucket", r);
  const dados = (await r.json()) as { url?: string; token?: string };
  if (!dados.url || !dados.token) {
    throw new Error("O Supabase assinou o upload sem devolver url e token.");
  }
  // A resposta traz o caminho RELATIVO a `/storage/v1` ("/object/upload/sign/…
  // ?token=…"). Quem vai usar isto é o navegador, que precisa do endereço
  // inteiro — completar aqui evita que a tela remonte a base e erre.
  return { url: `${base()}/storage/v1${dados.url}`, token: dados.token };
}

/**
 * Apaga o objeto.
 *
 * QUEM CHAMA ISTO É A TAREFA 4, DEPOIS DE A META TER PUBLICADO — e nunca antes:
 * a Meta baixa a mídia no momento do `media_publish`, e apagar antes quebraria
 * a publicação. Item falhado MANTÉM o arquivo, porque quem for tentar de novo
 * precisa dele.
 *
 * Ela LANÇA quando o Supabase recusa, e é de propósito: quem chama é que sabe
 * se o apagamento pode derrubar a operação (no ramo de sucesso da publicação
 * não pode — o post já saiu, e é lá que o `try/catch` fica).
 */
export async function apagarObjeto(caminho: string): Promise<void> {
  const r = await fetch(`${base()}/storage/v1/object/${bucket()}/${caminho}`, {
    method: "DELETE",
    headers: cabecalhosDeServico(),
  });
  if (!r.ok) throw await falha("Nao foi possivel apagar o objeto do bucket", r);
}

/**
 * O piso de segurança para quando o bucket NÃO tem teto próprio.
 *
 * ELE NÃO É UMA MEDIÇÃO. É o padrão do Supabase (50 MB por arquivo), usado só
 * quando `file_size_limit` vem `null` — que significa "vale o limite global do
 * projeto", e esse número a API do bucket não conta. Errar para menos recusa
 * arquivo bom com uma frase que explica; errar para mais deixa o dono subir
 * 200 MB para o Supabase cortar no meio.
 *
 * Hoje o bucket TEM teto próprio (52428800, lido em 03/09), então este ramo não
 * é exercitado em produção.
 */
const PISO_DE_SEGURANCA_EM_BYTES = 50 * 1024 * 1024;

/**
 * O teto REAL do bucket, perguntado ao Supabase — NUNCA cravado.
 *
 * =============================================================================
 * POR QUE ISTO É UMA PERGUNTA, E NÃO UMA CONSTANTE.
 *
 * MEDIDO em 03/09/2026: `file_size_limit: 52428800` (50 MB). Esse número não é
 * escolha de desenho — é o que sobrou porque o pagamento do plano pago atrasou.
 * O plano pago vai a 500 GB, e o teto SOBE SOZINHO quando o pagamento entrar.
 *
 * Uma constante de 50 MB aqui viraria dívida que ninguém lembra de pagar: no
 * dia em que o plano voltasse, vídeo continuaria recusado por um número
 * esquecido, e o sintoma seria "não sei por que não sobe". Perguntando, o dia
 * em que o plano voltar é o dia em que o vídeo grande passa, sem deploy.
 *
 * Quem usa a resposta é `problemaDoArquivo` (lib/publicacao.ts), que distingue
 * `grande_demais` (a Meta recusaria de todo jeito) de `grande_para_o_bucket`
 * (nós é que somos o gargalo) — porque a frase que ajuda é diferente.
 */
export async function tetoDoBucket(): Promise<number> {
  const r = await fetch(`${base()}/storage/v1/bucket/${bucket()}`, {
    headers: cabecalhosDeServico(),
  });
  if (!r.ok) throw await falha("Nao foi possivel ler a configuracao do bucket", r);
  const dados = (await r.json()) as { file_size_limit?: number | null };
  const teto = dados.file_size_limit;
  return typeof teto === "number" && teto > 0 ? teto : PISO_DE_SEGURANCA_EM_BYTES;
}
