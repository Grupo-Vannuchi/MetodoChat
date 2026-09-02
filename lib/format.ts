// Exibição de datas sempre em horário de Brasília (o servidor roda em UTC).
const fmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : fmt.format(d);
}

// "há 5 min", "há 3 h", "ontem" — para status que precisa de leitura rápida
export function fmtRelative(value: string | Date | null | undefined): string {
  const h = hoursAgo(value);
  if (h === null) return "—";
  const min = h * 60;
  if (min < 2) return "agora";
  if (min < 60) return `há ${Math.floor(min)} min`;
  if (h < 24) return `há ${Math.floor(h)} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/**
 * A mesma data relativa, sem o "há " da frente — para lista, não para frase.
 *
 * POR QUE NÃO MUDAR `fmtRelative`: ela também é usada em `app/page.tsx`, dentro
 * de "Última interação há 2 h", onde o prefixo é GRAMÁTICA e não enfeite. Tirar
 * lá quebraria a frase; tirar só aqui é o recorte certo.
 *
 * O CUSTO DO PREFIXO FOI MEDIDO, e é por isso que esta função existe: ~18px dos
 * 224 da linha da conversa (`app/conversas/lista.tsx`), num espaço em que a
 * data estava sendo reduzida a reticência — "h.", "há ..." — em 5 das 6 linhas
 * visíveis em produção. Numa lista ordenada por recência, "há" não informa
 * nada: tudo ali é passado.
 *
 * "agora" e "ontem" passam INTEIROS, porque não têm o prefixo — e é por isso
 * que a regra é um recorte do começo, e não um `replace` de "há " em qualquer
 * posição: uma categoria ou nome não passa por aqui, mas a regra ainda tem de
 * ser sobre a FORMA da saída de `fmtRelative`, que é a única entrada legítima.
 */
export function semPrefixo(relativo: string): string {
  return relativo.startsWith("há ") ? relativo.slice(3) : relativo;
}

// NÃO EXPORTADA, DE PROPÓSITO: só `fmtRelative`, aqui em cima, a usa.
//
// Foi ela que produziu a SEGUNDA regra de janela do produto — a lista de
// contatos tinha `hoursAgo(...) < 24`, que dizia "aberta" sobre quem o motor de
// envio recusaria, nos cinco minutos de margem de `windowState`
// (lib/inbox-window.ts, a mesma que `lib/queue-drain.ts` usa). Exportada, ela
// continua sendo o atalho mais fácil para alguém escrever a terceira; fechada,
// é o compilador que defende a garantia de UMA fonte, e não a lembrança de
// quem revisa.
//
// Ela é útil e não some: para "há 5 min" está logo ali. O que não pode é virar
// medida de janela em lugar nenhum.
function hoursAgo(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(d)) return null;
  return (Date.now() - d) / 3_600_000;
}
