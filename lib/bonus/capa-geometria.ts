// A GEOMETRIA DA CAPA (spec da Etapa 11, "O desenho da capa", o modelo A aprovado pelo Eduardo em 13/10):
// todo número que ocupa lugar na capa, do qual o desenho (capa-desenho.tsx) e a conta do "não cabe"
// (capa-medida.ts) leem.
//
// ⚠️ É UM ARQUIVO PRÓPRIO, e não uma linha a mais em arte-geometria.ts: aquele tem DOIS DONOS, o Chat e o
// Labs, conferidos pelos vetores (tests/vetores-da-arte.json), e a capa é só do Chat (spec, "Onde": o Labs
// não muda). A peça (1080×1350) e a margem de 110 vêm de lá, e a largura útil também: a capa usa a mesma
// margem dos quatro lados, então a quebra de linha medida de hoje (arte-medida.ts) serve ao gancho dela.
import { ALTURA, MARGEM } from "./arte-geometria";

/**
 * Os tamanhos do gancho, do maior ao menor. A escolha é o MAIOR QUE COUBER, como nos slides de hoje
 * (`tamanhoDoSlide`), e em degraus largos, nunca de 1 em 1. São próprios da capa: o gancho dela ocupa
 * a parte de baixo da peça inteira, e não a coluna acima do espaço da imagem.
 */
export const DEGRAUS_DA_CAPA: readonly number[] = [112, 96, 80, 64, 56];

/** A altura máxima do bloco do gancho, de cima da margem do pé para cima. */
export const ALTURA_DO_BLOCO_DA_CAPA = 640;

/** O gancho grande vai apertado: a entrelinha das capas dos exemplos, e não o 1,32 do texto corrido. */
export const ENTRELINHA_DA_CAPA = 1.02;

/** A linha da capa: o Satori arredonda fonte × entrelinha, linha a linha, como em `alturaDaLinha`. */
export function alturaDaLinhaDaCapa(fonte: number): number {
  return Math.round(fonte * ENTRELINHA_DA_CAPA);
}

/** A foto (ou as iniciais) da conta no topo da capa, pequena: o gancho é a peça. */
export const LADO_DA_CONTA_NA_CAPA = 72;
export const FONTE_DO_NOME_NA_CAPA = 30;
export const FONTE_DO_ARROBA_NA_CAPA = 24;

/** Onde o bloco do gancho termina: em cima da margem do pé. */
export const PE_DO_GANCHO = ALTURA - MARGEM;

/**
 * AS SOMBRAS, para o texto branco ser legível em qualquer imagem: uma preta que sobe do pé, de 88% no pé
 * a 0 em 62% da altura, e uma leve que desce do topo, de 45% a 0 em 20%, atrás da conta.
 */
export const SOMBRA_DO_PE = { opacidade: 0.88, ate: 0.62 } as const;
export const SOMBRA_DO_TOPO = { opacidade: 0.45, ate: 0.2 } as const;

/** O fundo da capa ligada que ainda não tem imagem: escuro e liso, para o desenho e o "não cabe" aparecerem antes. */
export const FUNDO_DA_CAPA_SEM_IMAGEM = "#161616";

/** O texto da capa: branco, por cima da sombra. */
export const TEXTO_DA_CAPA = "#FFFFFF";
