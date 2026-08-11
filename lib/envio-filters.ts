// O QUE é o filtro da lista de ENVIOS (a fila), no mesmo desenho que
// lib/event-filters.ts já usa para a lista de interações: sem "server-only",
// porque a barra de filtros é componente de cliente e precisa das mesmas listas
// de valores válidos; a tradução para SQL fica em lib/envio-query.ts.
//
// O período não é redeclarado aqui — vem de PERIODS, que já existe. Duas listas
// de períodos discordariam no dia em que alguém mexesse numa delas.

import { PERIODS, type PeriodKey } from "./event-filters";

// Quantos envios a lista mostra por padrão. A seção precisa caber em uma tela
// de 1366×623 sem rolar, e é o número de linhas que decide isso. O que fica de
// fora nunca some em silêncio: a linha de contagem diz quantos existem.
export const ENVIOS_LIMIT = 12;

// De onde saiu a mensagem. Não é uma coluna do banco: é uma leitura do `kind`,
// e por isso a lista de kinds manuais mora aqui, ao lado da pergunta que ela
// responde.
//
// `dm_manual` é o que uma pessoa digitou na caixa de entrada do painel
// (lib/engine.ts, enqueueManualReply). Todo o resto foi o motor que enfileirou.
export const KINDS_MANUAIS = ["dm_manual"] as const;

export const ORIGENS = ["robo", "voce"] as const;
export type OrigemKey = (typeof ORIGENS)[number];

// Um envio é "seu" quando o kind está na lista de manuais. Uma função só, usada
// pela tela e espelhada pelo SQL, para as duas nunca discordarem de quem mandou.
export function origemDoKind(kind: string): OrigemKey {
  return (KINDS_MANUAIS as readonly string[]).includes(kind) ? "voce" : "robo";
}

// As situações possíveis de um envio, na ordem em que fazem sentido lidas em voz
// alta: o que deu certo primeiro, o que precisa de atenção por último.
//
// A lista tem que cobrir exatamente o `check (status in (...))` da tabela queue
// (lib/db.ts). Os rótulos de selo NÃO moram aqui — vêm de statusBadge(), para não
// existirem dois lugares dizendo a mesma coisa. O que mora aqui são as palavras
// que entram numa frase contada ("3 na fila", "1 não saiu"), que são de outro
// registro e não servem como selo.
export const SITUACOES = [
  { key: "sent", um: "entregue", muitos: "entregues" },
  { key: "sending", um: "saindo", muitos: "saindo" },
  { key: "pending", um: "na fila", muitos: "na fila" },
  { key: "skipped", um: "não enviada", muitos: "não enviadas" },
  { key: "failed", um: "não saiu", muitos: "não saíram" },
] as const;

export type SituacaoKey = (typeof SITUACOES)[number]["key"];

export type EnvioFilters = {
  period: PeriodKey;
  origem: OrigemKey | null;
  situacao: SituacaoKey | null;
};

export const NO_ENVIO_FILTERS: EnvioFilters = {
  period: "tudo",
  origem: null,
  situacao: null,
};

export function hasEnvioFilters(f: EnvioFilters): boolean {
  return Boolean(f.origem || f.situacao) || f.period !== "tudo";
}

// Os nomes seguem em português, como os que já existem. O prefixo `envios_` não
// é enfeite: as duas seções de /eventos dividem a MESMA barra de endereço, e um
// `periodo` solto aqui mudaria também o recorte da lista de interações lá
// embaixo. Prefixo em todos os três, e não só no que colide hoje, para o dia em
// que a outra seção ganhar um filtro de origem não ser um dia de susto.
const PARAM = {
  period: "envios_periodo",
  origem: "envios_origem",
  situacao: "envios_situacao",
} as const;

type Raw = Record<string, string | string[] | undefined>;

function firstValue(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

// Lista branca em tudo: o que não for reconhecido vira "sem filtro" e nunca
// chega ao banco.
export function parseEnvioFilters(raw: Raw): EnvioFilters {
  const period = firstValue(raw[PARAM.period]);
  const origem = firstValue(raw[PARAM.origem]);
  const situacao = firstValue(raw[PARAM.situacao]);
  return {
    period: PERIODS.some((p) => p.key === period) ? (period as PeriodKey) : "tudo",
    origem: (ORIGENS as readonly string[]).includes(origem ?? "")
      ? (origem as OrigemKey)
      : null,
    situacao: SITUACOES.some((s) => s.key === situacao) ? (situacao as SituacaoKey) : null,
  };
}

// Filtro → query string, na mesma ordem sempre. Omite o que está no padrão, para
// a URL de "sem filtro" ser simplesmente /eventos.
export function toEnvioQueryString(f: EnvioFilters): string {
  const p = new URLSearchParams();
  if (f.period !== "tudo") p.set(PARAM.period, f.period);
  if (f.origem) p.set(PARAM.origem, f.origem);
  if (f.situacao) p.set(PARAM.situacao, f.situacao);
  return p.toString();
}

// As duas barras de filtro da página escrevem na mesma URL. Cada uma monta só os
// SEUS parâmetros, então quem navega precisa carregar junto os da outra — senão
// mexer no período dos envios apagaria a busca da lista de interações. Junta na
// ordem dada e descarta pedaço vazio.
export function juntarQuery(...partes: string[]): string {
  return partes.filter(Boolean).join("&");
}

export type ContagemPorSituacao = { situacao: string; total: number }[];

export function totalDeEnvios(contagens: ContagemPorSituacao): number {
  return contagens.reduce((soma, c) => soma + c.total, 0);
}

// "24 entregues, 3 na fila, 1 não saiu".
//
// Existe porque a coluna "Situação" saiu da tabela: 28 de 28 linhas diziam
// "Entregue", o que gastava uma coluna inteira para não informar nada. Tirar a
// coluna sem dizer nada seria esconder — então a situação virou filtro E virou
// esta frase, que está sempre na tela e sempre soma o total.
export function resumoSituacoes(contagens: ContagemPorSituacao): string | null {
  if (!contagens.length) return null;
  const porChave = new Map(contagens.map((c) => [c.situacao, c.total]));

  const partes: string[] = [];
  for (const s of SITUACOES) {
    const n = porChave.get(s.key);
    if (!n) continue;
    porChave.delete(s.key);
    partes.push(`${n} ${n === 1 ? s.um : s.muitos}`);
  }

  // Situação que o banco não deveria produzir (há um `check` na tabela). Se
  // aparecer, ela entra na frase mesmo assim, sem vazar o nome técnico: melhor
  // uma linha vaga do que um total que não fecha.
  const restantes = [...porChave.values()].reduce((soma, n) => soma + n, 0);
  if (restantes) partes.push(`${restantes} em outra situação`);

  return partes.join(", ");
}
