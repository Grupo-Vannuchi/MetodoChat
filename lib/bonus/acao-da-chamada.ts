// A AÇÃO DA CHAMADA DO CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8). PURO.
//
// Sem palavra, o slide final pede uma de quatro ações, escolhida pelo operador no "Novo carrossel".
// A lista é a do `check` da 017 (`carrosseis_gerados_acao_check`), e um teste confere as duas. A
// linha tem palavra OU ação, nunca as duas e nunca nenhuma (`carrosseis_gerados_palavra_ou_acao_check`).

export const ACOES_DA_CHAMADA = ["salvar", "compartilhar", "seguir", "comentar"] as const;

export type AcaoDaChamada = (typeof ACOES_DA_CHAMADA)[number];

/** O valor que veio do formulário (ou do banco) é uma das quatro? */
export function ehAcaoDaChamada(v: unknown): v is AcaoDaChamada {
  return typeof v === "string" && (ACOES_DA_CHAMADA as readonly string[]).includes(v);
}

/** O nome da ação na tela: o "Novo carrossel" e o topo da página do carrossel. */
export function rotuloDaAcao(a: AcaoDaChamada): string {
  switch (a) {
    case "salvar":
      return "Salvar o post";
    case "compartilhar":
      return "Compartilhar";
    case "seguir":
      return "Seguir o perfil";
    case "comentar":
      return "Comentar a opinião";
  }
}

/**
 * O pedido à IA, sem o ponto final (`pedidoExtra`, carrossel-ia-parametros.ts). Nenhum deles tem
 * palavra em maiúsculas: a chamada sem palavra não pode ter nenhuma (carrossel-texto.ts).
 */
export function pedidoDaAcao(a: AcaoDaChamada): string {
  switch (a) {
    case "salvar":
      return "peça para salvar o post";
    case "compartilhar":
      return "peça para compartilhar o post com quem precisa ver";
    case "seguir":
      return "peça para seguir o perfil";
    case "comentar":
      return "peça para comentar a opinião, sem palavra-chave";
  }
}

/** O que a chamada pede: a palavra do funil, ou, sem palavra, a ação. */
export type PedidoDaChamada = { palavra: string; acao: null } | { palavra: null; acao: AcaoDaChamada };

/**
 * O pedido da chamada lido das colunas da linha. Null quando a linha está fora da regra do banco (as
 * duas juntas, nenhuma, a ação fora das quatro, a palavra vazia): quem chama trata como falha, e
 * nunca inventa um dos dois lados.
 */
export function pedidoDaChamada(l: { palavra: string | null; acao_da_chamada: unknown }): PedidoDaChamada | null {
  if (typeof l.palavra === "string") {
    return l.palavra && l.acao_da_chamada === null ? { palavra: l.palavra, acao: null } : null;
  }
  return ehAcaoDaChamada(l.acao_da_chamada) ? { palavra: null, acao: l.acao_da_chamada } : null;
}
