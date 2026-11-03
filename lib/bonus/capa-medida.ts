// A CONTA DO "NÃO CABE" DA CAPA (spec da Etapa 11, "Por dentro"): o gancho em maiúscula, quebrado como o
// Satori quebra, na entrelinha e nos degraus da capa. PURA, e roda no navegador (o aviso do card), na rota
// (o tamanho do desenho) e no servidor (a recusa do publicar): uma função só para os três, porque o achado
// 70 nasceu de a conta e o desenho divergirem.
//
// A QUEBRA É A DE HOJE (arte-medida.ts, `quebraDaLinha`): a largura real de cada letra da Carlito e os
// pontos de quebra do Satori, medidos contra os vetores do Labs. A largura útil da capa é a mesma da arte
// (as mesmas margens), e só a altura da linha muda. Onde o Satori também quebra dentro da palavra, a conta
// só erra para o lado seguro, como lá.
//
// A MAIÚSCULA VEM ANTES DE MEDIR (`toLocaleUpperCase("pt-BR")`): a medida e o desenho veem o mesmo texto.
// Um `textTransform` no desenho mediria a minúscula e desenharia a maiúscula, que é mais larga.
import { composicaoDoSlide, type LinhaDaArte } from "./arte-composicao";
import { espacoAntes, ESPACAMENTO_DO_NEGRITO } from "./arte-geometria";
import { quebraDaLinha } from "./arte-medida";
import type { SlideParaArte } from "./arte-slides";
import { ALTURA_DO_BLOCO_DA_CAPA, alturaDaLinhaDaCapa, DEGRAUS_DA_CAPA } from "./capa-geometria";

/** O gancho como a capa o escreve: todo em maiúscula, pelas regras do português. */
export function textoDaCapa(texto: string): string {
  return texto.toLocaleUpperCase("pt-BR");
}

/**
 * As linhas da capa: a composição de hoje (a normalização, as quebras e os parágrafos), sobre o texto em
 * maiúscula, e toda linha em negrito. No slide de hoje só o último bloco é negrito; na capa, o gancho
 * inteiro é a peça.
 */
export function composicaoDaCapa(texto: string): LinhaDaArte[] {
  return composicaoDoSlide(null, textoDaCapa(texto)).map((l) => ({ ...l, negrito: true, espacamento: ESPACAMENTO_DO_NEGRITO }));
}

/** A altura que o desenho dá às linhas da capa nesta fonte, e se alguma palavra vaza pela direita. */
export function medidaDaCapa(linhas: LinhaDaArte[], fonte: number): { altura: number; vaza: boolean } {
  let altura = 0;
  let vaza = false;
  for (const linha of linhas) {
    const q = quebraDaLinha(linha, fonte);
    altura += espacoAntes(linha.antes, fonte) + q.linhas * alturaDaLinhaDaCapa(fonte);
    vaza ||= q.vaza;
  }
  return { altura, vaza };
}

/**
 * A FONTE DO GANCHO NA CAPA: o maior degrau em que ele cabe no bloco, sem palavra vazando. Se nem no menor
 * couber, o menor, com `cabe: false`: o card avisa, e o publicar trava (como a Etapa 9 faz com o slide que
 * sairia cortado).
 */
export function tamanhoDaCapa(s: SlideParaArte): { fonte: number; cabe: boolean } {
  const linhas = composicaoDaCapa(s.texto);
  const coube = DEGRAUS_DA_CAPA.find((fonte) => {
    const m = medidaDaCapa(linhas, fonte);
    return !m.vaza && m.altura <= ALTURA_DO_BLOCO_DA_CAPA;
  });
  return coube !== undefined ? { fonte: coube, cabe: true } : { fonte: DEGRAUS_DA_CAPA[DEGRAUS_DA_CAPA.length - 1], cabe: false };
}
