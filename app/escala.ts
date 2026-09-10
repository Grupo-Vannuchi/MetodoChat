// A ESCALA DO SISTEMA e o verificador que a mantém fechada.
//
// POR QUE ESTE ARQUIVO EXISTE, e não só um comentário em `app/ui.ts`: a
// auditoria de 10/09 mediu **26 combinações de tipografia em 13 tamanhos**.
// Nenhum deles nasceu de uma decisão; nasceram de 26 decisões caso a caso,
// tomadas no JSX, em meses diferentes. Comentário não impede a 27ª. Uma lista
// com verificador impede, e é ele que `tests/escala.test.ts` roda sobre a
// árvore inteira.
//
// ESTE MÓDULO NÃO TEM NENHUM IMPORT, de propósito: ele é lido por um teste que
// varre arquivos, e um módulo puro nunca arrasta `server-only` nem React para
// dentro do que deveria ser uma lista.

/* ---------- tipografia ---------- */

/**
 * OS OITO TAMANHOS, em px. Eram treze — 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
 * 20, 24, 30 —, e cinco saíram por dois motivos distintos:
 *
 * PARES QUE O OLHO NÃO DISTINGUE, e que faziam toda manutenção escolher entre
 * dois valores iguais:
 *   13 -> 14  (o menu lateral, o alternador de tema, as abas de filtro)
 *   15 -> 16  (o nome da automação na lista)
 *   17 -> 16  (a marca no topo da barra)
 *   22 -> 20  (o título de página no celular; a partir de 640px já era 24)
 *
 * O PISO, que é o outro problema e não o mesmo:
 *   9 -> 11   (7 ocorrências na tela: rótulos do gráfico, contadores)
 *   10 -> 11  (276 ocorrências: todo selo, todo rótulo de seção, todo crédito)
 *
 * POR QUE O PISO É 11 E NÃO 12, e isto foi decidido contando: 12px é o cavalo
 * de trabalho da interface (627 ocorrências) e 11px é o degrau de MICRO-RÓTULO
 * — caixa alta, `tracking` aberto, selo. Subir o piso para 12 não subiria o
 * piso: apagaria o degrau, e todo selo passaria a ter o tamanho do corpo do
 * texto. 11px já era o menor tamanho que o sistema usava com intenção
 * (`eyebrow`, `thead`); o que 9 e 10 faziam era ficar abaixo dele sem motivo.
 */
export const TAMANHOS_PX = [11, 12, 14, 16, 18, 20, 24, 30] as const;

/** O nome que o Tailwind dá a cada degrau. `text-[11px]` é arbitrário porque a
 *  escala do Tailwind não tem 11px — mas arbitrário DECLARADO é escala; o que
 *  a auditoria achou eram treze arbitrários não declarados. */
export const CLASSE_POR_TAMANHO: Record<number, string> = {
  11: "text-[11px]",
  12: "text-xs",
  14: "text-sm",
  16: "text-base",
  18: "text-lg",
  20: "text-xl",
  24: "text-2xl",
  30: "text-3xl",
};

/* ---------- o verificador ---------- */

/**
 * Um desvio encontrado numa string de classes.
 * `familia` diz qual das escalas foi furada; `classe` é o que estava lá.
 */
export type Desvio = { familia: "tamanho"; classe: string };

// `text-[13px]`, `sm:text-[22px]`, `text-[9px]`
const TAMANHO_ARBITRARIO = /(?:^|[\s"'`{])(?:[a-z]+:)*text-\[(\d+)px\]/g;

/**
 * Os desvios de escala de uma string de classes do Tailwind. Função pura, sem
 * estado: a mesma string devolve sempre a mesma lista.
 *
 * O QUE ELA ACEITA: os apelidos do Tailwind (`text-xs`, `text-sm`, …), que são
 * degraus por definição, e os arbitrários `text-[Npx]` cujo N está em
 * `TAMANHOS_PX`. O que ela acusa é o arbitrário fora da lista — que é
 * exatamente a forma que os cinco tamanhos mortos tinham.
 */
export function desviosDeEscala(classes: string): Desvio[] {
  const achados: Desvio[] = [];
  const permitidos = new Set<number>(TAMANHOS_PX);

  for (const m of classes.matchAll(TAMANHO_ARBITRARIO)) {
    if (!permitidos.has(Number(m[1]))) {
      achados.push({ familia: "tamanho", classe: m[0].trim() });
    }
  }

  return achados;
}
