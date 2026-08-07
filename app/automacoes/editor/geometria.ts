// A GEOMETRIA DO QUADRO — arquivo PURO de propósito: sem React, sem React
// Flow, sem DOM. Recebe números (e a lista de passos, que é dado) e devolve
// números. É por isso que ele pode ser testado sem navegador, e é por isso
// que ele existe separado de `quadro.tsx`: a conversão de coordenada de tela
// para coordenada do quadro (`screenToFlowPosition`) depende da instância do
// React Flow e fica lá; tudo que vem DEPOIS dessa conversão mora aqui.
//
// A REGRA QUE ORGANIZA ESTE ARQUIVO é a mesma do quadro: a ordem de execução
// é a ordem do array `passos`, e nada aqui decide ordem — só distância. Quem
// decide se uma distância vira reordenação é `quadro.tsx`, chamando
// `moverPara` com o que `alvoDoArraste` devolveu.
import type { Passo } from "@/lib/steps";

export type Ponto = { x: number; y: number };

export type MedidaDoBloco = { width: number; height: number };

// Chave é a identidade do bloco (`identidadeDoPasso`); o valor é o tamanho
// medido pelo React Flow, quando já houve medição.
export type Medidas = Record<string, MedidaDoBloco | undefined>;

// A largura do bloco é fixa em `no.tsx` (`w-[190px]`); a altura varia com o
// texto e chega medida pelo React Flow. Estes são só o palpite de antes da
// primeira medição.
export const LARGURA_DO_BLOCO = 190;
export const ALTURA_SUPOSTA = 48;

// A que distância da seta, em unidades do quadro, o ponteiro já conta como
// "em cima dela". Folga de propósito: a seta desenhada tem 1px, e exigir o
// pixel exato tornaria o gesto de reordenar impossível na prática.
//
// ERA 30, E 30 REORDENAVA SEM QUERER. Medido no navegador, com cinco blocos
// arranjados à mão em duas linhas (uma "cobra", que é o que sai quando alguém
// organiza um fluxo numa tela larga):
//
//   o bloco B, PARADO, tinha o ponto de pega a 27,5 unidades da seta D→E, que
//   não é vizinha dele. Um empurrão de 4 PIXELS na horizontal — o bloco andou
//   2 unidades, e a distância à seta nem mudou — trocou a ordem de
//   [A,B,C,D,E] para [A,C,D,B,E]. Sem aviso, e sem desfazer.
//
// 30 unidades também é metade do vão do arranjo automático (`modelos.ts`:
// LARGURA 250 menos os 190 do bloco), ou seja: o halo de uma seta encostava
// no da vizinha. 16 é folgado para a mira — o destaque acende antes de
// soltar, então quem mira tem resposta — e deixa de cobrir o vão inteiro.
//
// MAS REDUZIR O ALCANCE NÃO RESOLVE A CLASSE, e é importante que isto esteja
// escrito: com 16, basta o bloco estar parado a 15 unidades de uma seta alheia
// para o mesmo empurrão de 4 pixels reordenar de novo. O que fecha a classe é
// a segunda condição, em `alvoDoArraste` logo abaixo — o teste
// "não reordena o caso medido" prova as DUAS metades: a distância medida
// (27,5) já não entra mais no alcance atual, e mesmo uma distância que
// entrasse (15, por exemplo) é recusada quando a seta já estava ao alcance no
// início do gesto.
export const ALCANCE_DA_SETA = 16;

// A distância de um ponto ao SEGMENTO de reta a-b (não à reta infinita).
// Usada três vezes por seta em `setasAoAlcance`, porque a seta do React Flow
// (`smoothstep`) não é um segmento só.
export function distanciaAoSegmento(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const comprimento = dx * dx + dy * dy;
  // Segmento degenerado (as duas pontas no mesmo lugar): vira distância a um
  // ponto. Acontece de verdade — dois blocos empilhados na mesma altura fazem
  // o trecho vertical do meio ter comprimento zero.
  const t =
    comprimento === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comprimento));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export type SetaCandidata = { i: number; d: number };

// QUAIS SETAS ESTÃO AO ALCANCE DE UM PONTO — por geometria, e não por evento
// de mouse da seta (o motivo de precisar de geometria está em `quadro.tsx`,
// perto de quem chama esta função: os dois gestos que precisam disto nunca
// emitem `mouseenter` na seta).
//
// O traçado conferido é o mesmo `smoothstep` que o React Flow desenha: sai da
// alça direita do bloco `i`, vai reto até o meio do vão, desce (ou sobe) e
// entra na alça esquerda do bloco `i + 1`. São três trechos, e vale a menor
// distância aos três — conferir só a reta entre as duas pontas erraria
// justamente no meio do vão, que é onde a seta é mais fácil de acertar.
//
// `ignorar` existe para o arrasto de um bloco: as duas setas que chegam nele
// e saem dele não são alvo — soltá-lo na própria seta é pedir para ele ficar
// onde já está.
//
// DEVOLVE TODAS AS SETAS ao alcance, e não só a mais perto, porque há dois
// leitores com perguntas diferentes: quem solta quer a mais perto
// (`setaSobOPonto`, logo abaixo), e quem decide se o gesto CONQUISTOU alguma
// coisa (a marcação feita em `quadro.tsx` no início do gesto) precisa do
// conjunto — um bloco parado entre duas setas está ao alcance das duas, e
// guardar só a campeã deixaria a outra passar.
export function setasAoAlcance(
  ponto: Ponto,
  passos: Passo[],
  medidas: Medidas,
  identidades: string[],
  ignorar: number[]
): SetaCandidata[] {
  const achadas: SetaCandidata[] = [];
  for (let i = 0; i < passos.length - 1; i++) {
    if (ignorar.includes(i)) continue;
    const de = passos[i].pos;
    const para = passos[i + 1].pos;
    if (!de || !para) continue;
    const mDe = medidas[identidades[i]];
    const mPara = medidas[identidades[i + 1]];
    const sx = de.x + (mDe?.width ?? LARGURA_DO_BLOCO);
    const sy = de.y + (mDe?.height ?? ALTURA_SUPOSTA) / 2;
    const tx = para.x;
    const ty = para.y + (mPara?.height ?? ALTURA_SUPOSTA) / 2;
    const meio = (sx + tx) / 2;
    const d = Math.min(
      distanciaAoSegmento(ponto.x, ponto.y, sx, sy, meio, sy),
      distanciaAoSegmento(ponto.x, ponto.y, meio, sy, meio, ty),
      distanciaAoSegmento(ponto.x, ponto.y, meio, ty, tx, ty)
    );
    if (d < ALCANCE_DA_SETA) achadas.push({ i, d });
  }
  return achadas.sort((a, b) => a.d - b.d);
}

// A seta mais perto do ponto, ou nenhuma. É o que decide onde inserir (soltar
// da paleta) e é o primeiro filtro de onde mover (soltar um bloco).
export function setaSobOPonto(
  ponto: Ponto,
  passos: Passo[],
  medidas: Medidas,
  identidades: string[],
  ignorar: number[]
): number | null {
  return setasAoAlcance(ponto, passos, medidas, identidades, ignorar)[0]?.i ?? null;
}

// O ALVO VÁLIDO DE UM ARRASTO DE BLOCO: ao alcance AGORA e fora do que já
// estava ao alcance no início do gesto (`setasNoInicio`).
//
// Esta é a evidência de intenção que a proximidade sozinha não dá, e ela
// fecha a classe de defeito descrita em `ALCANCE_DA_SETA`: um bloco parado
// perto de uma seta alheia não pode ser reordenado por um tremor do gesto —
// só por ser LEVADO até uma seta que não estava ao alcance quando o gesto
// começou. Se o bloco já estivesse mesmo em cima daquela seta, a ordem já
// seria essa.
//
// As setas que TOCAM o bloco arrastado (`indice - 1` e `indice`) ficam fora
// da conta: soltá-lo na seta que já sai dele, ou na que já chega nele, é
// pedir o lugar em que ele está — por isso `indice` entra aqui, e não só as
// medidas e o ponto.
//
// O QUE ISTO NÃO COBRE, dito com a medida certa: o bloco que começa longe de
// tudo e é levado — de propósito, mas para arrumar a tela — até a
// vizinhança de uma seta que não é dele. Essa seta foi conquistada pelo
// gesto, e não há como a geometria saber que a pessoa só queria arrumar.
// Contra ela sobram as outras duas defesas, que são de `quadro.tsx`: o
// alcance encolhido, e o destaque que acende durante o arrasto e apaga
// quando o alvo não vale.
export function alvoDoArraste(
  ponto: Ponto,
  passos: Passo[],
  medidas: Medidas,
  identidades: string[],
  indice: number,
  setasNoInicio: ReadonlySet<number>
): number | null {
  const alvo = setaSobOPonto(ponto, passos, medidas, identidades, [indice - 1, indice]);
  return alvo !== null && !setasNoInicio.has(alvo) ? alvo : null;
}
