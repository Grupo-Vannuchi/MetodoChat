// A GEOMETRIA DO QUADRO — arquivo PURO de propósito: sem React, sem React
// Flow, sem DOM. Recebe números (e a lista de passos, que é dado) e devolve
// números. É por isso que ele pode ser testado sem navegador, e é por isso
// que ele existe separado de `quadro.tsx`: a conversão de coordenada de tela
// para coordenada do quadro (`screenToFlowPosition`) depende da instância do
// React Flow e fica lá; tudo que vem DEPOIS dessa conversão mora aqui.
//
// A REGRA QUE ORGANIZA ESTE ARQUIVO é a mesma do quadro: a seta é a LIGAÇÃO
// gravada, e nada aqui decide caminho — só distância. Quem transforma uma
// distância numa ligação nova é `quadro.tsx`, chamando `partirLigacao`
// (lib/steps.ts) com o que `alvoDoArraste` devolveu.
//
// O QUE MUDOU NA TAREFA 6, porque o índice `i` deste arquivo trocou de dono: a
// seta `i` era o par de blocos `i → i + 1` do array, e passou a ser a LIGAÇÃO de
// índice `i`. A conta em si — três trechos de `smoothstep`, a menor distância
// aos três — é a mesma; o que ela recebe é que deixou de ser deduzido da ordem.
import type { Ligacao, Passo } from "@/lib/steps";
import { alcasDeSaida, indiceDaAlca } from "./modelos";

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

// A QUE ALTURA DO BLOCO FICA A ALÇA `k` DE `total`, em fração da altura dele.
//
// É a MESMA conta que `no.tsx` escreve no `style` de cada alça, e ela mora aqui
// para não haver duas: o que a tela desenha e o que a mira calcula têm de ser o
// mesmo ponto. Com as duas separadas, um menu de três botões teria as setas
// saindo de um lugar e o alvo do gesto medido em outro — e a diferença passaria
// dos 16 do alcance num bloco de altura normal.
//
// `(k + 1) / (total + 1)` distribui as alças com folga IGUAL nas pontas: com uma
// alça ela fica no meio (1/2), com três elas ficam em 1/4, 2/4 e 3/4. Dividir
// por `total` grudaria a primeira no topo e a última na base do bloco.
export function fracaoDaAlca(k: number, total: number): number {
  return (k + 1) / (total + 1);
}

// AS DUAS PONTAS DE UMA SETA, em coordenada do quadro. Null quando um dos dois
// blocos não está na lista ou ainda não tem posição — ligação para bloco que não
// existe é forma válida (`conferirLigacao`, lib/steps.ts) e não tem traço.
//
// A ponta de saída é a ALÇA da condição daquela ligação; a de chegada é sempre o
// meio da borda esquerda do bloco de destino, porque a alça de entrada é uma só.
export function pontasDaSeta(
  passos: Passo[],
  medidas: Medidas,
  identidades: string[],
  l: Ligacao
): { de: Ponto; para: Ponto } | null {
  const iDe = identidades.indexOf(l.de);
  const iPara = identidades.indexOf(l.para);
  if (iDe === -1 || iPara === -1) return null;
  const de = passos[iDe].pos;
  const para = passos[iPara].pos;
  if (!de || !para) return null;
  const mDe = medidas[l.de];
  const mPara = medidas[l.para];
  const alturaDe = mDe?.height ?? ALTURA_SUPOSTA;
  const k = indiceDaAlca(passos[iDe], l.quando);
  return {
    de: {
      x: de.x + (mDe?.width ?? LARGURA_DO_BLOCO),
      y: de.y + alturaDe * fracaoDaAlca(k, alcasDeSaida(passos[iDe]).length),
    },
    para: { x: para.x, y: para.y + (mPara?.height ?? ALTURA_SUPOSTA) / 2 },
  };
}

// AS LIGAÇÕES QUE TOCAM UM BLOCO, por índice. São as que ficam de fora do gesto
// de arrastar aquele bloco: soltá-lo na seta que já sai dele, ou na que já chega
// nele, é pedir o desenho que já está lá.
export function ligacoesDoBloco(ligacoes: Ligacao[], identidade: string): number[] {
  const is: number[] = [];
  for (let i = 0; i < ligacoes.length; i++) {
    if (ligacoes[i].de === identidade || ligacoes[i].para === identidade) is.push(i);
  }
  return is;
}

// QUAIS SETAS ESTÃO AO ALCANCE DE UM PONTO — por geometria, e não por evento
// de mouse da seta (o motivo de precisar de geometria está em `quadro.tsx`,
// perto de quem chama esta função: os dois gestos que precisam disto nunca
// emitem `mouseenter` na seta).
//
// O traçado conferido é o mesmo `smoothstep` que o React Flow desenha: sai da
// alça da condição no bloco de origem, vai reto até o meio do vão, desce (ou
// sobe) e entra na alça esquerda do bloco de destino. São três trechos, e vale a
// menor distância aos três — conferir só a reta entre as duas pontas erraria
// justamente no meio do vão, que é onde a seta é mais fácil de acertar.
//
// `ignorar` traz ÍNDICES DE LIGAÇÃO, e quem os monta para o arrasto de um bloco
// é `ligacoesDoBloco`, logo acima.
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
  ligacoes: Ligacao[],
  ignorar: number[]
): SetaCandidata[] {
  const achadas: SetaCandidata[] = [];
  for (let i = 0; i < ligacoes.length; i++) {
    if (ignorar.includes(i)) continue;
    const pontas = pontasDaSeta(passos, medidas, identidades, ligacoes[i]);
    if (!pontas) continue;
    const { de, para } = pontas;
    const meio = (de.x + para.x) / 2;
    const d = Math.min(
      distanciaAoSegmento(ponto.x, ponto.y, de.x, de.y, meio, de.y),
      distanciaAoSegmento(ponto.x, ponto.y, meio, de.y, meio, para.y),
      distanciaAoSegmento(ponto.x, ponto.y, meio, para.y, para.x, para.y)
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
  ligacoes: Ligacao[],
  ignorar: number[]
): number | null {
  return setasAoAlcance(ponto, passos, medidas, identidades, ligacoes, ignorar)[0]?.i ?? null;
}

// O ALVO VÁLIDO DE UM ARRASTO DE BLOCO: ao alcance AGORA e fora do que já
// estava ao alcance no início do gesto (`setasNoInicio`).
//
// Esta é a evidência de intenção que a proximidade sozinha não dá, e ela
// fecha a classe de defeito descrita em `ALCANCE_DA_SETA`: um bloco parado
// perto de uma seta alheia não pode ser posto no meio dela por um tremor do
// gesto — só por ser LEVADO até uma seta que não estava ao alcance quando o
// gesto começou. Se o bloco já estivesse mesmo em cima daquela seta, o desenho
// já seria esse.
//
// As setas que TOCAM o bloco arrastado ficam fora da conta (`ligacoesDoBloco`,
// acima): soltá-lo na seta que já sai dele, ou na que já chega nele, é pedir
// o desenho que já está lá — por isso a IDENTIDADE dele entra aqui, e não só
// as medidas e o ponto. Era o par de índices `indice - 1`/`indice`, que era o
// jeito de dizer a mesma coisa enquanto as setas saíam da ordem do array.
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
  ligacoes: Ligacao[],
  identidade: string,
  setasNoInicio: ReadonlySet<number>
): number | null {
  const alvo = setaSobOPonto(
    ponto,
    passos,
    medidas,
    identidades,
    ligacoes,
    ligacoesDoBloco(ligacoes, identidade)
  );
  return alvo !== null && !setasNoInicio.has(alvo) ? alvo : null;
}

// ONDE CAI O BLOCO CRIADO POR CLIQUE NA PALETA — a conta que o arrasto não
// precisa fazer, porque lá o ponteiro já diz o lugar.
//
// Clicar não tem ponteiro sobre o quadro, então o lugar tem de ser ESCOLHIDO, e
// escolher é decisão: por isso ela mora aqui, no módulo puro, e não solta dentro
// do manipulador de clique. `quadro.tsx` entra só com o que depende do React
// Flow — o retângulo da área visível e o `screenToFlowPosition` que traduz o
// centro dele para coordenada do quadro. Daí para cá é aritmética.
//
// O CENTRO É DA ÁREA VISÍVEL, e não do conteúdo: quem clica está olhando para
// um pedaço do quadro, e o bloco tem de nascer onde os olhos já estão. Nascer no
// centro do CONTEÚDO poria o bloco fora da tela sempre que o quadro estivesse
// deslocado — e o efeito seria idêntico ao defeito que este trabalho conserta:
// clicar, não ver nada acontecer, concluir que o clique não funciona.
//
// O PONTO DEVOLVIDO É O CANTO SUPERIOR ESQUERDO, porque é isso que `pos`
// significa para o React Flow e para `pontasDaSeta` aqui em cima. Por isso a
// metade da largura e da altura sai do centro: sem esse desconto o bloco fica
// com o canto no meio da tela, deslocado para baixo e para a direita do lugar
// para onde a pessoa está olhando. A altura usada é `ALTURA_SUPOSTA` e não a
// medida — o bloco ainda não existe, então não há medida; o erro é de poucos
// pixels e some no primeiro arrasto.
export const DESVIO_DO_EMPILHAMENTO = 24;

// O DESVIO EXISTE PORQUE O CENTRO É SEMPRE O MESMO PONTO. Dois cliques seguidos
// põem o segundo bloco exatamente por cima do primeiro, que o esconde inteiro —
// e a pessoa vê a mesma tela de antes do clique. Ou seja: sem o desvio, o
// conserto reproduz o sintoma que ele existe para tirar, a partir do segundo
// clique.
//
// Empilhar em diagonal é o que faz a pilha ser LEGÍVEL como pilha: com blocos de
// 190 de largura, 24 para o lado e 24 para baixo deixa aparecer a borda e o topo
// de cada um dos de baixo, que é como uma pilha de papel diz quantas folhas tem.
//
// A ocupação é conferida em CHEBYSHEV (o maior dos dois afastamentos), e não em
// distância reta, porque quem se cobre são retângulos e não pontos: dois blocos
// afastados 24 na diagonal têm distância reta 34 — passariam por um raio de 24 e
// continuariam empilhados na tela.
//
// O QUE ISTO NÃO FAZ, dito com a medida certa: não é desvio de colisão. O bloco
// tem 190 de largura, e o teste recusa apenas 24 — ou seja, o lugar devolvido
// pode SOBREPOR PARCIALMENTE um bloco que já estava ali, e sobrepõe mesmo
// (medido na tela, com o quadro de teste). Isso é de propósito. O que precisa
// ser impossível é a superposição EXATA, que é a que não deixa rastro nenhum na
// tela; um bloco meio por cima do outro aparece, tem borda visível e se arrasta
// para o lado. Desviar de toda colisão exigiria a altura MEDIDA de cada bloco,
// que não existe para o que ainda vai nascer, e escolheria posição por conta
// própria — arrumar o quadro é gesto de quem monta, não deste arquivo.
//
// O LIMITE DO LAÇO é `2 * passos.length + 1` porque um bloco parado no meio do
// caminho pode barrar DUAS posições consecutivas da diagonal (elas distam 24, e
// o teste recusa até 24 para cada lado). Com o dobro de tentativas por bloco,
// alguma posição sobra sempre; o `return` de fora do laço é a saída que o
// TypeScript exige e que a aritmética não alcança.
export function lugarDoBlocoNovo(centro: Ponto, passos: Passo[]): Ponto {
  const x0 = Math.round(centro.x - LARGURA_DO_BLOCO / 2);
  const y0 = Math.round(centro.y - ALTURA_SUPOSTA / 2);
  const limite = 2 * passos.length + 1;
  for (let k = 0; k < limite; k++) {
    const x = x0 + k * DESVIO_DO_EMPILHAMENTO;
    const y = y0 + k * DESVIO_DO_EMPILHAMENTO;
    const ocupado = passos.some(
      (p) =>
        p.pos !== undefined &&
        Math.abs(p.pos.x - x) < DESVIO_DO_EMPILHAMENTO &&
        Math.abs(p.pos.y - y) < DESVIO_DO_EMPILHAMENTO
    );
    if (!ocupado) return { x, y };
  }
  return { x: x0 + limite * DESVIO_DO_EMPILHAMENTO, y: y0 + limite * DESVIO_DO_EMPILHAMENTO };
}
