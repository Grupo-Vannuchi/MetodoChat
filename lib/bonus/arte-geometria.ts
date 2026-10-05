// A GEOMETRIA DA PEÇA: todo número que ocupa lugar na arte, do qual o desenho (arte-desenho.tsx) e a
// conta do "não cabe" (arte-medida.ts) leem. VEIO DO MÉTODO LABS (site-ia,
// src/lib/ia/geometria-da-arte.ts, em 45bc973) e deixou de ser cópia na Etapa 4 do gerador
// (docs/specs/2026-10-02-pagina-do-carrossel.md, "O não cabe"): os espaços que só o desenho
// conhecia vieram para cá, e a conta passou a medir a largura real de cada letra. DOIS DONOS: o
// mesmo resultado nos dois projetos é conferido pelos vetores (tests/vetores-da-arte.json), e não
// por código igual. Mudança aqui que muda um vetor se combina com o Labs.
//
// ⚠️ EXISTE PORQUE ESTES NÚMEROS JÁ ESTIVERAM EM DOIS LUGARES. No Labs, até 04/09, a rota da arte e o
// teste de cabimento tinham cada um a sua cópia de 1080, 1350, 110 e 1,32; e até 02/10, os espaços
// entre o texto, a manchete e o espaço da imagem viviam só no desenho, sem `export`. A conta os
// ignorava, e o texto que ela aceitava no limite invadia a margem de baixo (achado 70).

/** 1080×1350 é o 4:5 do feed: o formato mais alto que o Instagram aceita. */
export const LARGURA = 1080;
export const ALTURA = 1350;

/** A margem dos quatro lados. 110, e não 64: é número do manual da casa, e é o que faz a peça respirar. */
export const MARGEM = 110;

/** Entrelinha: o desenho a passa ao Satori, que a multiplica pela fonte e arredonda (`alturaDaLinha`). */
export const ENTRELINHA = 1.32;

/** O que sobra de largura entre as margens. */
export const LARGURA_UTIL = LARGURA - MARGEM * 2;

/** O espaço da imagem ocupa 3:2, a proporção que a API de imagem gera. */
export const ALTURA_ILUSTRACAO = Math.round((LARGURA_UTIL * 2) / 3);

/** O lado da foto (ou das iniciais) do cabeçalho: é o mais alto da tag, mais que o nome e o @ juntos. */
export const LADO_DO_AVATAR = 127;

/** Da tag ao texto: do fim do cabeçalho até a primeira linha, ou do texto até a tag no pé. */
export const GAP_CABECALHO = 48;

/** Do fim do texto até o topo do espaço da imagem, pela simetria com o cabeçalho (Labs, 39.2). */
export const GAP_ILUSTRACAO = 48;

/** Da manchete ao corpo, medido como AVANÇO TOTAL (a linha da manchete e o espaço dela), e não como espaço extra. */
export const AVANCO_MANCHETE = 77;

/** Entre parágrafos do corpo, inclusive antes da linha de fechamento. */
export const GAP_PARAGRAFO = 41;

/** O espaçamento das letras no negrito, em px por glifo: o negrito sai 0,4px mais apertado. */
export const ESPACAMENTO_DO_NEGRITO = -0.4;

/** A tag com o respiro até o texto. Nos dois lugares da tag, topo ou pé, ela tira esta altura do texto. */
export const ALTURA_DO_CABECALHO = LADO_DO_AVATAR + GAP_CABECALHO;

/** Altura útil para texto quando o slide NÃO tem o espaço da imagem. */
export const ALTURA_TEXTO_SEM_ILUSTRACAO = ALTURA - MARGEM * 2 - ALTURA_DO_CABECALHO;

/**
 * Altura útil quando tem: menos o espaço e menos o respiro de 48 que o desenho põe acima dele. 334,
 * e não os 382 de antes: a conta não descontava o respiro, e o texto no limite invadia a margem.
 */
export const ALTURA_TEXTO_COM_ILUSTRACAO = ALTURA_TEXTO_SEM_ILUSTRACAO - ALTURA_ILUSTRACAO - GAP_ILUSTRACAO;

/** A altura útil para texto, conforme o slide tenha ou não o espaço da imagem. */
export function alturaDisponivel(comIlustracao: boolean): number {
  return comIlustracao ? ALTURA_TEXTO_COM_ILUSTRACAO : ALTURA_TEXTO_SEM_ILUSTRACAO;
}

/** A altura de uma linha de texto: o Satori arredonda fonte × entrelinha, linha a linha (46 → 61, 34 → 45). */
export function alturaDaLinha(fonte: number): number {
  return Math.round(fonte * ENTRELINHA);
}

/** O que vai acima de uma linha: nada, o que falta da manchete até o avanço dela, ou o intervalo de parágrafo. */
export type EspacoAntes = "nada" | "manchete" | "paragrafo";

/**
 * O espaço acima de uma linha, em px. O da manchete completa o avanço de 77: numa manchete de uma
 * linha, a linha e o espaço somam 77; a 86px a linha já passa de 77, e o espaço é zero.
 */
export function espacoAntes(antes: EspacoAntes, fonte: number): number {
  if (antes === "paragrafo") return GAP_PARAGRAFO;
  if (antes === "manchete") return Math.max(0, AVANCO_MANCHETE - alturaDaLinha(fonte));
  return 0;
}
