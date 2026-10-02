// TRAZIDO DO MÉTODO LABS COMO ESTÁ (site-ia, src/lib/ia/geometria-da-arte.ts, mudado por último
// em 19d25be, igual em 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de
// lá se traz para cá (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). Abaixo, o
// arquivo de lá sem mudar uma linha; os caminhos citados nos comentários são os do Labs. No Chat,
// a "ilustração" é o espaço em branco que o operador reserva para pôr a imagem no Canva.
//
// A GEOMETRIA DA PEÇA — fonte única dos números que a arte desenha e o teste prevê.
//
// ⚠️ **EXISTE PORQUE ESTES NÚMEROS ESTAVAM EM DOIS LUGARES.** Até 04/09 a rota da arte
// (`admin/carrossel/arte/route.tsx`) e a asserção de cabimento (`slides.test.ts`) declaravam
// cada uma a sua cópia: 1080, 1350, 110 e `1.32`. Nada obrigava as duas a concordarem.
//
// O estrago dessa duplicação é específico e silencioso: a asserção de cabimento existe para
// dizer "este texto NÃO corta o PNG". Ela chega a esse veredito calculando com a SUA cópia
// dos números. Se alguém mudasse a margem na arte para 120 e não aqui, o teste continuaria
// verde prevendo com 110 — dando garantia sobre uma peça que já não é a que se desenha.
//
// Não é hipótese distante: a régua de largura do caractere já esteve errada por horas em
// 03/09 (achado 22.13), e o sintoma foi exatamente esse — verde que cobria mais casos e
// garantia menos.

/** 1080×1350 é o 4:5 do feed: o formato mais alto que o Instagram aceita, e portanto o que
 *  ocupa mais tela no celular de quem rola. É também a tela do pipeline dele. */
export const LARGURA = 1080;
export const ALTURA = 1350;

/**
 * A margem dos quatro lados.
 *
 * ⚠️ **110, e não 64.** É número do manual da casa, não gosto — a margem larga é o que faz a
 * peça respirar no feed, e é visível na comparação lado a lado. Encolher aqui aproxima o
 * slide de "panfleto" e afasta do que já está publicado no perfil.
 */
export const MARGEM = 110;

/** Entrelinha. Quem precisar da altura de uma linha multiplica por isto. */
export const ENTRELINHA = 1.32;

/** O que sobra de largura entre as margens. */
export const LARGURA_UTIL = LARGURA - MARGEM * 2;

/**
 * A ilustração ocupa 3:2 — a proporção que a API de imagem gera.
 *
 * Se alguém "arredondar" este valor, a imagem volta a ser cortada. Mudou a proporção que a
 * API oferece? Mude aqui junto.
 */
export const ALTURA_ILUSTRACAO = Math.round((LARGURA_UTIL * 2) / 3);

/**
 * ⚠️ **ESTIMATIVA, e a única desta lista.** O cabeçalho (avatar + nome + respiro) não tem
 * constante na arte: a altura dele é o que o Satori renderiza. 175 é a medida observada, e
 * está aqui para a previsão de cabimento ter de onde descontar.
 *
 * Consequência: um cabeçalho que cresça de verdade sem este número acompanhar faz a previsão
 * ficar OTIMISTA — ela acha que há mais espaço do que há. É por isso que ela é estimativa
 * declarada e não constante compartilhada: ninguém deve confiar nela como fato.
 */
export const CABECALHO_ESTIMADO = 175;

/** Altura útil para texto quando o slide NÃO tem ilustração. */
export const ALTURA_TEXTO_SEM_ILUSTRACAO = ALTURA - MARGEM * 2 - CABECALHO_ESTIMADO;

/** Altura útil quando tem — menos de metade da anterior, e é aí que o texto corta. */
export const ALTURA_TEXTO_COM_ILUSTRACAO = ALTURA_TEXTO_SEM_ILUSTRACAO - ALTURA_ILUSTRACAO;

/**
 * Largura média de um caractere, em `em`, para prever quantos cabem numa linha.
 *
 * ⚠️ **0,5538 É A LARGURA DE MAIÚSCULAS, E O PIOR CASO É DE PROPÓSITO.** Medida no TTF da
 * Carlito: prosa média dá 0,4183, minúsculas 0,4559, MAIÚSCULAS 0,5538.
 *
 * Em 03/09 este número foi trocado por 0,4183 — a média medida — e o efeito foi um teste que
 * cobria mais casos e garantia menos: um gancho de 120 caracteres com ilustração dava 317px
 * de 382 pela média, e 396 na largura real de maiúsculas. Ou seja, **passava no teste e
 * cortava o PNG**.
 *
 * A lição não é "medir é ruim". É que medição responde *quanto costuma ser*, e previsão de
 * cabimento precisa de *quanto pode ser no pior caso plausível*. São perguntas diferentes.
 * Gancho de Instagram em caixa alta é plausível, e a aba de colar aceita qualquer texto.
 */
export const LARGURA_DO_CARACTERE = 0.5538;

/**
 * Quantos pixels de altura um texto ocupa nesta fonte — a previsão que decide se corta.
 *
 * É uma ESTIMATIVA, não o que o Satori faz: ele quebra em palavras, não em caracteres, então
 * o valor real varia. Ela erra para o lado seguro por usar a largura de maiúsculas.
 */
export function alturaEstimada(texto: string, fonte: number): number {
  const porLinha = LARGURA_UTIL / (fonte * LARGURA_DO_CARACTERE);

  // ⚠️ **CONTA CADA BLOCO SEPARADO, e não o texto inteiro de uma vez.** Uma quebra de linha
  // força o fim da linha antes de ela encher — dividir o total de caracteres pela capacidade
  // de uma linha ignora isso e devolve MENOS linhas do que se desenha.
  //
  // Medido em 04/09 na fase 22.4, contra uma geração real do modelo: em 7 dos 8 slides com
  // quebra a conta antiga errava para baixo, e no pior (uma lista de cinco marcadores) dizia
  // 5 linhas onde havia 7 — 264px previstos contra 370 reais, num limite de 382. Passou por
  // doze pixels.
  //
  // O erro era todo para o lado OTIMISTA, que é o lado que deixa cortar. E não era caso
  // raro: o modelo escreveu com quebra em 8 dos 10 slides, porque lista e frase de efeito
  // isolada são o formato natural de carrossel.
  // ⚠️ `split("\n")` E NÃO `/\n+/` — o `+` colapsaria quebras consecutivas, e **a linha em
  // branco ocupa altura na peça**. Uma lista de cinco itens separados por linha em branco tem
  // 9 linhas e 5 pelo `+`: 475px reais contra 264 previstos, num limite de 382.
  //
  // ⚠️ **O QUE ELA OCUPA NÃO É UMA LINHA CHEIA, e este comentário dizia que era.** A arte
  // quebra o texto em blocos por `\n{2,}` e separa cada um por `GAP_PARAGRAFO` (41px), então
  // a linha em branco vira 41 e não `fonte × 1.32` (52,8 em corpo 40). A conta aqui segue
  // cobrando a linha cheia **de propósito**: a diferença é de ~12px por parágrafo e cai toda
  // para o lado conservador, que é o lado que não deixa cortar.
  //
  // A justificativa velha citava `whiteSpace: "pre-wrap"` desenhando a linha vazia — e isso
  // nunca aconteceu: o `split(/\n{2,}/)` consumia a quebra dupla antes de o `pre-wrap` ver.
  // A conta estava certa pelo motivo errado, e o motivo errado foi corrigido em 21/09, junto
  // do conserto da sobreposição que tirou o `pre-wrap` da arte.
  //
  // O `Math.max(1, …)` é o que faz o bloco vazio contar 1: `Math.ceil(0 / porLinha)` é 0.
  const linhas = texto
    .split("\n")
    .reduce((total, bloco) => total + Math.max(1, Math.ceil(bloco.length / porLinha)), 0);

  return linhas * fonte * ENTRELINHA;
}

/** A altura disponível para texto, conforme o slide tenha ou não ilustração. */
export function alturaDisponivel(comIlustracao: boolean): number {
  return comIlustracao ? ALTURA_TEXTO_COM_ILUSTRACAO : ALTURA_TEXTO_SEM_ILUSTRACAO;
}
