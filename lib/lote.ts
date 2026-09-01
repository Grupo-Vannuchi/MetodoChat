import { contatosDoFiltro, normalizarCategoria, type FiltroDeCategoria } from "./categorias";
import { windowState } from "./inbox-window";

// O ENVIO EM LOTE, e as decisões dele fora do JSX e fora do motor.
//
// ESTE É O PRIMEIRO RECURSO DO PRODUTO QUE MANDA MENSAGEM PARA MUITA GENTE DE
// UMA VEZ. Tudo até aqui responde a quem falou primeiro. Isso muda o que um
// defeito custa: um erro aqui não é uma mensagem errada, são quarenta — saindo
// do perfil de verdade, para clientes de verdade. Por isso as três decisões
// (quem recebe, quem espera, até quando vale) moram aqui, com caso para cada
// saída, e não espalhadas pela tela e pelo dreno.

/** O que vai no `payload` de cada item de fila do lote. */
export type PayloadDoLote = {
  lote_id: string;
  text: string;
  url?: string;
  button_label?: string;
  valido_ate: string | null;
};

/**
 * Monta o payload. É a ÚNICA função que escreve estas chaves.
 *
 * `url` em branco NÃO vira chave: `lib/queue-drain.ts` decide o formato da
 * mensagem por `p.url` — com url monta botão, sem url manda texto puro. Uma
 * url vazia faria toda mensagem de lote virar um botão para lugar nenhum.
 *
 * `button_label` SÓ vira chave quando também há `url`. Um rótulo sem link some
 * calado, e isso é escolha, não descuido: para item `dm_lote`,
 * `lib/queue-drain.ts` só lê `p.button_label` dentro do ramo que exige
 * `p.url` — um rótulo sem link nunca teria efeito no texto enviado. Gravá-lo
 * mesmo assim só guardaria lixo no payload.
 */
export function payloadDoLote(dados: {
  loteId: string;
  text: string;
  url?: string;
  buttonLabel?: string;
  validoAte: string | null;
}): PayloadDoLote {
  const url = (dados.url ?? "").trim();
  const rotulo = (dados.buttonLabel ?? "").trim();
  return {
    lote_id: dados.loteId,
    text: dados.text,
    ...(url ? { url } : {}),
    ...(url && rotulo ? { button_label: rotulo } : {}),
    valido_ate: dados.validoAte,
  };
}

/**
 * Se `url` é um endereço bem formado, com protocolo `http` ou `https`.
 *
 * `payloadDoLote` SÓ APARA ESPAÇO — ela não valida formato, porque quem decide
 * "tem link ou não" é a presença de texto, não a forma dele. Mas o botão que
 * `lib/queue-drain.ts` monta não checa a url que recebe; ele confia em quem
 * enfileirou. Sem uma barreira ANTES do enfileiramento, uma url digitada
 * errada ("htps://…", ou "quero entrar" sem protocolo nenhum) vira um botão
 * apontando para lugar nenhum — e isso sai para cada pessoa do lote, não para
 * uma só.
 *
 * SÓ HTTP(S): é o único protocolo que o botão do Instagram abre. Um
 * `javascript:` ou um `data:` nunca deveriam sair como link de mensagem.
 *
 * Esta função não decide "tem link" — só "o link que tem é válido". Chamador
 * decide o que fazer com string vazia (aqui ela é inválida, mas quem chama
 * trata "sem url" como um caso à parte, antes de chegar aqui).
 */
export function urlDeLoteValida(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Lê o payload de volta. `null` quando não é um item de lote. */
export function lerPayloadDoLote(bruto: unknown): {
  loteId: string;
  text: string;
  url?: string;
  buttonLabel?: string;
  validoAte: string | null;
} | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const p = bruto as Record<string, unknown>;
  if (typeof p.lote_id !== "string" || !p.lote_id) return null;
  if (typeof p.text !== "string") return null;
  return {
    loteId: p.lote_id,
    text: p.text,
    ...(typeof p.url === "string" && p.url ? { url: p.url } : {}),
    ...(typeof p.button_label === "string" && p.button_label
      ? { buttonLabel: p.button_label }
      : {}),
    validoAte: typeof p.valido_ate === "string" ? p.valido_ate : null,
  };
}

export type DestinoDoLote = {
  /** ig_ids que recebem agora — a janela está aberta. */
  agora: string[];
  /** ig_ids cuja mensagem fica guardada até eles voltarem a falar. */
  esperam: string[];
  /**
   * Quantos dos que ESPERAM provavelmente nunca receberão.
   *
   * É PALPITE, e a tela tem de dizer isso. Conta quem tem NO MÁXIMO uma
   * mensagem recebida em todo o histórico — zero OU uma, não só uma. Contato
   * com `recebidas: 0` nunca escreveu; ele chegou por ter comentado num post,
   * nunca teve janela aberta, e por isso é o caso MAIS forte de "provavelmente
   * nunca", não um caso à parte. Medido em 01/09/2026: 53 de 111 pessoas que
   * esperam (47 falaram uma única vez, 6 nunca falaram). Eles continuam dentro
   * de `esperam`, porque podem voltar amanhã; este número é informação, não um
   * terceiro balde, e não se subtrai dos outros dois.
   */
  improvaveis: number;
};

/**
 * Quem recebe agora e quem espera.
 *
 * A JANELA VEM DE `windowState`, a MESMA função que `lib/queue-drain.ts` usa
 * para RECUSAR um envio — ela fecha 5 minutos antes das 24h. Uma regra própria
 * aqui faria a tela prometer alcance que o motor recusa, no exato caso em que
 * ninguém conseguiria reproduzir: a faixa dura cinco minutos e some sozinha.
 */
export function destinoDoLote(
  contatos: { ig_id: string; last_reply_at: Date | string | null; recebidas: number }[],
  agora: number = Date.now()
): DestinoDoLote {
  const destino: DestinoDoLote = { agora: [], esperam: [], improvaveis: 0 };
  for (const c of contatos) {
    if (windowState(c.last_reply_at, agora).open) {
      destino.agora.push(c.ig_id);
      continue;
    }
    destino.esperam.push(c.ig_id);
    if (c.recebidas <= 1) destino.improvaveis += 1;
  }
  return destino;
}

/**
 * O lote já venceu?
 *
 * `null` é "sem prazo", e nunca vence — é o valor que atende o conteúdo que não
 * envelhece ("segue o material"), sem exigir um segundo mecanismo.
 *
 * DATA INVÁLIDA NÃO EXPIRA, e isso é escolha: tratar lixo como "vencido"
 * cancelaria envios em silêncio, que é a falha muda que este produto passou
 * semanas fechando. Tratar como "sem prazo" mantém a mensagem viva e visível.
 */
export function loteExpirou(validoAte: string | null, agora: number = Date.now()): boolean {
  if (!validoAte) return false;
  const t = new Date(validoAte).getTime();
  if (!Number.isFinite(t)) return false;
  return agora > t;
}

// ============================================================
// QUEM O PEDIDO ALCANÇA.
//
// As três decisões abaixo viviam soltas em `app/contatos/actions.ts`, e as três
// eram invisíveis para os portões: apagar cada uma delas passava por lint, por
// typecheck, pelos 938 testes puros e pelos 70 de integração sem uma linha
// vermelha. Elas são a última coisa entre um engano e dezenas de mensagens
// saindo do perfil de verdade, então moram aqui, juntas, com caso para cada
// saída em `tests/lote.test.ts`.
// ============================================================

/**
 * O RECORTE, ATRAVESSANDO O FORMULÁRIO.
 *
 * `filtroDaUrl` (lib/categorias.ts) distingue `?categoria=` AUSENTE ("tudo") de
 * `?categoria=` PRESENTE E VAZIO ("sem categoria") PELA PRESENÇA do parâmetro —
 * e essa distinção não sobrevive a um `<input type="hidden">`, porque campo
 * escondido SEMPRE existe no DOM: `FormData.get` nunca devolve `null`, e os dois
 * pedidos chegavam à ação como `""`.
 *
 * MEDIDO NA REVISÃO FINAL (01/09/2026), com as funções de verdade:
 *
 *     /contatos?categoria=   (a ficha "sem categoria")
 *       tela promete [3]   |   acao enfileira [1,2,3]
 *
 * O dono clicava na ficha "sem categoria" — um clique, ela está sempre na tela
 * —, lia "Mandar mensagem para 16 pessoas", marcava "Confirmo que quero mandar
 * para estas 16" e confirmava. A ação enfileirava para as 126, "aluno" e
 * "interessado" inclusive.
 *
 * POR ISSO O CAMPO NÃO CARREGA MAIS O VALOR CRU: ele carrega uma forma que
 * distingue os dois pedidos POR SI, sem depender de o campo existir ou não. É a
 * mesma decisão de `filtroDaUrl`, tomada de novo no único lugar em que a URL não
 * pode ser a fonte.
 */
export function campoDoFiltro(filtro: FiltroDeCategoria): string {
  return filtro.tipo === "tudo" ? "tudo" : `uma:${filtro.nome ?? ""}`;
}

/**
 * O caminho de volta — e `null` quando o campo não se reconhece.
 *
 * CAMPO ESTRANHO É RECUSA, E NUNCA PALPITE. Um POST montado à mão, um campo
 * renomeado, um formulário de uma versão antiga: nada disso pode cair em
 * "tudo", que é o balde de maior alcance do produto. `null` desce até
 * `alvoDoLote` e vira "ninguém".
 *
 * O nome passa por `normalizarCategoria` pela mesma razão de `filtroDaUrl`:
 * `Aluno` e `aluno ` são a mesma categoria, e o filtro tem de casar a coluna já
 * normalizada.
 */
export function filtroDoCampo(bruto: unknown): FiltroDeCategoria | null {
  if (typeof bruto !== "string") return null;
  if (bruto === "tudo") return { tipo: "tudo" };
  if (bruto.startsWith("uma:")) {
    return { tipo: "uma", nome: normalizarCategoria(bruto.slice(4)) };
  }
  return null;
}

/** O que a ação de envio pergunta: por conta de quem, que recorte, confirmado. */
export type PedidoDoLote = {
  /** O `ig_user_id` da conta selecionada — do COOKIE, nunca do formulário. */
  conta: string;
  /** `null` é "não deu para entender o recorte", e alcança ninguém. */
  filtro: FiltroDeCategoria | null;
  confirmado: boolean;
};

/**
 * As linhas que vão receber — ou nenhuma.
 *
 * A ASSINATURA TEM TRÊS PERGUNTAS E NÃO UMA, e isso é deliberado: as três eram
 * defeitos plantados que atravessavam todos os portões, e cada uma sozinha
 * significa mandar mensagem para gente que não devia recebê-la. Juntas, elas
 * respondem uma coisa só — "estas pessoas, ou ninguém" —, e o chamador não tem
 * como responder metade.
 *
 * A CONTA É CONFERIDA AQUI TAMBÉM, e não só no `where` da consulta. O `where`
 * continua onde está, porque carregar a conta inteira de outra pessoa para
 * descartá-la depois seria trabalho à toa; mas ele sozinho não deixava nada
 * vermelho ao ser apagado. Duas linhas da mesma pessoa em duas contas
 * conectadas é caso REAL neste produto — é por isso que a chave de `contacts` é
 * composta (`migrations/005-contatos-chave-composta.sql`).
 *
 * Genérica na linha pelo mesmo motivo de `contatosDoFiltro`: a decisão é sobre
 * conta e categoria, e mais nada.
 */
export function alvoDoLote<T extends { account_id: string; categoria: string | null }>(
  linhas: T[],
  pedido: PedidoDoLote
): T[] {
  if (!pedido.confirmado) return [];
  if (!pedido.filtro) return [];
  const daConta = linhas.filter((l) => l.account_id === pedido.conta);
  return contatosDoFiltro(daConta, pedido.filtro);
}
