// O QUE é o filtro: forma, valores aceitos e leitura da URL. Sem "server-only"
// de propósito — a barra de filtros é componente de cliente e precisa das
// mesmas listas, senão navegador e servidor discordariam do que é válido.
// A tradução para SQL fica em lib/event-query.ts, que não sai do servidor.

// O TAMANHO DO FEED, QUE PASSOU A CRESCER SOB PEDIDO — achado M6.
//
// MEDIDO EM 11/09/2026, na conta de produção: `/eventos` tinha 7518px, e 6580
// deles eram a lista de 50 eventos. Cada cartão mede 132px em média porque ele
// carrega o que interessa — selo, quem, quando, O TEXTO DO COMENTÁRIO, onde, e
// o JSON recolhido. Encurtar o cartão custaria justamente o texto, então o que
// sobra é mostrar menos de uma vez.
//
// `EVENTS_LIMIT` VIROU O PASSO, e não o teto: a primeira página traz 25 e o
// link "carregar mais" pede 25 a mais. O teto existe para a barra de endereço
// não virar entrada de número arbitrário — `?ver=99999` devolveria a consulta
// inteira para quem digitasse.
export const PASSO_DO_FEED = 25;
export const MAX_DO_FEED = 200;

/**
 * Quantos eventos a página traz, lido da barra de endereço.
 *
 * ELE NÃO MORA EM `EventFilters`, e isso é decisão. `lib/eventos-url.ts`
 * documenta que esta página já teve DOIS ESCRITORES para a mesma URL e que o
 * conserto foi centralizar tudo em `DonoDosFiltros`. Pôr o tamanho do feed lá
 * dentro faria toda troca de filtro ter de decidir o que fazer com ele; deixá-lo
 * FORA faz o certo sozinho — `queryDaPagina` não o conhece, então mudar
 * qualquer filtro o descarta e o feed volta à primeira página, que é o que tem
 * de acontecer quando o recorte muda.
 *
 * Valor ilegível, ausente ou menor que o passo cai no passo. Acima do teto, no
 * teto. Não arredonda para múltiplo do passo de propósito: um `?ver=30` digitado
 * à mão é um pedido legítimo de 30.
 */
export function quantosEventos(bruto: string | string[] | undefined): number {
  const texto = Array.isArray(bruto) ? bruto[0] : bruto;
  const n = Number(texto);
  if (!Number.isFinite(n)) return PASSO_DO_FEED;
  return Math.min(MAX_DO_FEED, Math.max(PASSO_DO_FEED, Math.floor(n)));
}
export const SEARCH_MAX_LENGTH = 80;

export const PERIODS = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "tudo", label: "tudo", days: null },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

// Quais `type` de evento podem ser consultados. Os rótulos não moram aqui:
// vêm de eventBadge(), para não existirem dois lugares dizendo a mesma coisa.
// `abertura` entra aqui, e não é enfeite: a fase das portas de entrada existe
// para responder QUAL DAS QUATRO PERGUNTAS traz gente, e sem o filtro por tipo
// o dono não tem como isolar as linhas dela do resto de Atividade.
export const EVENT_TYPES = [
  "comment",
  "message",
  "story_reply",
  "quick_reply",
  "abertura",
  "error",
] as const;
export type EventTypeKey = (typeof EVENT_TYPES)[number];

/**
 * OS TIPOS DE EVENTO QUE SIGNIFICAM "ALGUÉM FALOU COM A CONTA".
 *
 * São QUATRO, e o motor grava os quatro: `message` é a DM comum, `story_reply`
 * é a resposta a um story, `quick_reply` é o toque num botão, e `abertura` é a
 * resposta a uma pergunta de abertura (`lib/engine.ts`).
 *
 * ESTA LISTA EXISTIA EM TRÊS LUGARES até 15/09/2026 — `app/contatos/page.tsx`,
 * `app/contatos/actions.ts` e `app/page.tsx` —, e o terceiro nasceu errado, com
 * `type = 'message'` só. Medido: 14 `story_reply` numa semana. Num dia calmo
 * com só uma, a tela escrevia "nada aconteceu nas últimas 24h" — e "nada
 * aconteceu" é a frase que faz a pessoa decidir não olhar.
 *
 * `comment` fica de fora porque comentário tem contagem própria em toda tela
 * que os separa; `error` fica de fora porque não é coisa que alguém falou.
 */
export const TIPOS_DE_MENSAGEM_RECEBIDA = [
  "message",
  "story_reply",
  "quick_reply",
  "abertura",
] as const;

export type EventFilters = {
  post: string | null;
  type: EventTypeKey | null;
  period: PeriodKey;
  q: string | null;
};

export const NO_FILTERS: EventFilters = { post: null, type: null, period: "tudo", q: null };

export function hasFilters(f: EventFilters): boolean {
  return Boolean(f.post || f.type || f.q) || f.period !== "tudo";
}

// Os nomes dos parâmetros na URL seguem em português, junto com as rotas
// (/eventos, /automacoes, /contatos). Quem vê a barra de endereço é o dono do
// painel, não o programa.
const PARAM = { post: "post", type: "tipo", period: "periodo", q: "q" } as const;

type Raw = Record<string, string | string[] | undefined>;

function firstValue(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

// Lista branca em tudo: o que não for reconhecido vira "sem filtro" e nunca
// chega ao banco.
export function parseFilters(raw: Raw): EventFilters {
  const post = firstValue(raw[PARAM.post]);
  const type = firstValue(raw[PARAM.type]);
  const period = firstValue(raw[PARAM.period]);
  const q = firstValue(raw[PARAM.q]);
  return {
    // id de mídia do Instagram é numérico; qualquer outra coisa é descartada
    post: post && /^\d{1,32}$/.test(post) ? post : null,
    type: EVENT_TYPES.includes(type as EventTypeKey) ? (type as EventTypeKey) : null,
    period: PERIODS.some((p) => p.key === period) ? (period as PeriodKey) : "tudo",
    q: q ? q.slice(0, SEARCH_MAX_LENGTH) : null,
  };
}

// Filtro → query string, na mesma ordem sempre. Omite o que está no padrão,
// para a URL de "sem filtro" ser simplesmente /eventos.
export function toQueryString(f: EventFilters): string {
  const p = new URLSearchParams();
  if (f.period !== "tudo") p.set(PARAM.period, f.period);
  if (f.type) p.set(PARAM.type, f.type);
  if (f.post) p.set(PARAM.post, f.post);
  if (f.q) p.set(PARAM.q, f.q);
  return p.toString();
}
