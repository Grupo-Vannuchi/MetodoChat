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
// `PASSO_ENTRE_BLOCOS` É O VÃO ENTRE DOIS BLOCOS, e ele mora em `./modelos`
// junto de quem já o usava (`arranjoAutomatico`): era o mesmo par de números
// respondendo a mesma pergunta em dois arquivos.
import {
  alcasDoQuadro,
  indiceDaAlca,
  podeEntrarNaSeta,
  PASSO_ENTRE_BLOCOS,
} from "./modelos";

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
//
// A LISTA INTEIRA DE LIGAÇÕES ENTRA AQUI, e não só a desta seta, porque as alças
// do bloco de origem dependem do que está gravado NELE: uma condição que perdeu
// a alça do tipo ganha uma alça própria (`alcasDoQuadro`, ./modelos), e isso
// muda tanto QUAL é o índice desta seta quanto QUANTAS alças o bloco tem — os
// dois números que a altura da ponta usa.
export function pontasDaSeta(
  passos: Passo[],
  medidas: Medidas,
  identidades: string[],
  ligacoes: Ligacao[],
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
  const alcas = alcasDoQuadro(passos[iDe], ligacoes, l.de);
  const k = indiceDaAlca(alcas, l.quando);
  return {
    de: {
      x: de.x + (mDe?.width ?? LARGURA_DO_BLOCO),
      y: de.y + alturaDe * fracaoDaAlca(k, alcas.length),
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
    const pontas = pontasDaSeta(passos, medidas, identidades, ligacoes, ligacoes[i]);
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
//
// E O BLOCO PRECISA TER O QUE DAR, que é a terceira condição e a que fechou o
// Crítico desta onda: partir a seta escreve `MEIO --sempre--> B`
// (`partirLigacao`, lib/steps.ts), e um bloco sem alça de `sempre` — hoje, o
// menu de `botoes` — não tem essa saída. A pergunta é `podeEntrarNaSeta`
// (./modelos), a MESMA para o destaque e para o resultado, porque os dois
// passam por aqui. O porquê inteiro, com a medida, está lá.
//
// O BLOCO QUE NÃO ESTÁ NA LISTA também não entra, e não é caso teórico: o nó do
// GATILHO não sai de `passos`, `identidades.indexOf("gatilho")` é -1, e sem esta
// linha ele responderia à pergunta com `passos[-1]`. Ele é `draggable: false`
// (./quadro), então o gesto não chega aqui — a linha é o que impede que passe a
// chegar no dia em que essa prop mudar.
export function alvoDoArraste(
  ponto: Ponto,
  passos: Passo[],
  medidas: Medidas,
  identidades: string[],
  ligacoes: Ligacao[],
  identidade: string,
  setasNoInicio: ReadonlySet<number>
): number | null {
  const i = identidades.indexOf(identidade);
  const bloco = i === -1 ? undefined : passos[i];
  if (!bloco || !podeEntrarNaSeta(bloco)) return null;
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

// O ALVO DE UM ARRASTO VINDO DA PALETA — o bloco ainda não existe, então não há
// identidade nem setas próprias a descartar, e a única pergunta que sobra é a
// que `alvoDoArraste` faz por último: este bloco tem `sempre` para dar?
//
// SEPARADA E NÃO UM ARGUMENTO OPCIONAL DA DE CIMA: as duas condições daquela —
// a seta conquistada pelo gesto e as setas do próprio bloco — não existem aqui,
// e passá-las vazias seria escrever na chamada que elas foram consideradas.
//
// O BLOCO É O DE `blocoNovo` (./modelos), o MESMO que `inserir` vai criar, e não
// a chave da paleta: a pergunta é sobre as alças de um `Passo`, e quem traduz
// chave em passo é aquela função. Fosse a chave, esta linha teria uma segunda
// lista de "quais itens da paleta são menu" para discordar da primeira.
export function alvoDaPaleta(
  ponto: Ponto,
  passos: Passo[],
  medidas: Medidas,
  identidades: string[],
  ligacoes: Ligacao[],
  bloco: Passo | null
): number | null {
  if (!bloco || !podeEntrarNaSeta(bloco)) return null;
  return setaSobOPonto(ponto, passos, medidas, identidades, ligacoes, []);
}

// DOIS BLOCOS SE COBREM NA TELA? — a régua de "dá para ler os dois".
//
// É RETÂNGULO CONTRA RETÂNGULO, e não distância entre dois pontos: o bloco tem
// 190 de largura (`LARGURA_DO_BLOCO`, fixa em `no.tsx`) e altura variável, então
// dois cantos a 34 de distância reta podem estar um ENTERRADO no outro. O teste
// é o clássico de dois retângulos: eles se cobrem quando se cruzam nos DOIS
// eixos ao mesmo tempo.
//
// A ALTURA ENTRA POR PARÂMETRO porque ela tem duas origens e a função não pode
// escolher entre elas: para o bloco que já está na tela ela vem MEDIDA pelo
// React Flow, e para o que ainda vai nascer não existe medida nenhuma — é
// `ALTURA_SUPOSTA`. A largura não precisa disso: ela é a mesma para todo bloco.
//
// ENCOSTAR NÃO É COBRIR (`<`, e não `<=`): dois blocos com a borda de um na
// borda do outro são dois blocos legíveis, colados. É o desfecho que a cascata
// abaixo produz de propósito quando o quadro está cheio.
export function seCobrem(a: Ponto, alturaA: number, b: Ponto, alturaB: number): boolean {
  return (
    a.x < b.x + LARGURA_DO_BLOCO &&
    b.x < a.x + LARGURA_DO_BLOCO &&
    a.y < b.y + alturaB &&
    b.y < a.y + alturaA
  );
}

// QUANTAS LINHAS A CASCATA DESCE ANTES DE COMEÇAR OUTRA COLUNA.
//
// TRÊS, E O NÚMERO É A CONTA DE CABER NA TELA: seis blocos — o fluxo que o dono
// montou quando mediu o defeito — ocupam duas colunas de três, ou seja 500 de
// largura (`PASSO_ENTRE_BLOCOS.x` vezes 2) por 288 de altura a partir do canto
// do primeiro. Uma coluna reta poria o sexto 480 abaixo do primeiro e uma
// fileira reta o poria 1250 à direita: nos dois casos os últimos nascem fora do
// que a pessoa está olhando, que é o MESMO sintoma do empilhamento — clicar e
// não ver nada acontecer.
//
// NÃO É UM TETO: a cascata não para na terceira coluna nem na trigésima. Três é
// só onde ela dobra.
export const LINHAS_DA_CASCATA = 3;

// ONDE CAI O BLOCO CRIADO POR CLIQUE NA PALETA — a conta que o arrasto não
// precisa fazer, porque lá o ponteiro já diz o lugar.
//
// Clicar não tem ponteiro sobre o quadro, então o lugar tem de ser ESCOLHIDO, e
// escolher é decisão: por isso ela mora aqui, no módulo puro, e não solta dentro
// do manipulador de clique. `quadro.tsx` entra só com o que depende do React
// Flow — o retângulo da área visível e o `screenToFlowPosition` que traduz o
// centro dele para coordenada do quadro. Daí para cá é aritmética, e é por isso
// que o ZOOM e a ROLAGEM não aparecem aqui: os dois já foram resolvidos na
// tradução, e o que chega é um ponto do quadro como qualquer outro.
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
// para onde a pessoa está olhando. A altura usada no desconto é `ALTURA_SUPOSTA`
// e não a medida — o bloco ainda não existe, então não há medida; o erro é de
// poucos pixels e some no primeiro arrasto.
//
// ---------------------------------------------------------------------------
// O QUE MUDOU, E POR QUÊ — o desvio de 24 na diagonal saiu daqui.
//
// ELE EMPILHAVA DE PROPÓSITO, e o comentário que estava neste lugar dizia isso
// por extenso: "o lugar devolvido pode SOBREPOR PARCIALMENTE um bloco que já
// estava ali, e sobrepõe mesmo", com o argumento de que o que precisa ser
// impossível é só a superposição EXATA, a que não deixa rastro na tela.
//
// O ARGUMENTO NÃO SOBREVIVEU À MEDIÇÃO, feita montando uma automação de verdade
// na produção: dois blocos criados pela paleta gravaram `{x:-200, y:72}` e
// `{x:-176, y:96}` — 24 na diagonal, com 190 de largura. O de cima cobre quase
// todo o de baixo; com três o quadro deixa de se ler e com seis o dono arrasta
// um por um antes de conseguir trabalhar. "Aparece uma borda" é rastro
// suficiente para provar que o clique funcionou, e NÃO é o suficiente para
// trabalhar — e é para trabalhar que o quadro existe.
//
// A OUTRA METADE DAQUELE ARGUMENTO ERA VERDADE E DEIXOU DE SER: "desviar de toda
// colisão exigiria a altura MEDIDA de cada bloco, que não existe para o que
// ainda vai nascer". Ela não existe para o que vai NASCER — continua sendo
// `ALTURA_SUPOSTA` —, mas existe para o que já está lá: o React Flow mede cada
// bloco assim que o desenha, e `quadro.tsx` já guardava essas medidas para as
// setas. Elas passaram a entrar aqui, e é com elas que o desvio responde pelo
// bloco ALTO — um menu de muitos botões passa de 200, e com a altura suposta o
// lugar "livre" caía dentro dele.
//
// O QUE ISTO NÃO FAZ, dito com a medida certa: não arruma o quadro. A cascata
// não move nada, não alinha nada e não reagrupa nada — ela só não escreve por
// cima. Arrumar é gesto de quem monta, e o bloco que o dono arrastou para um
// lugar é um bloco que ele decidiu; a cascata desvia dele pela mesma régua com
// que desvia de qualquer outro (`seCobrem`, acima).
//
// E DOIS BLOCOS DA MESMA COLUNA FICAM ALINHADOS NA VERTICAL, o que
// `arranjoAutomatico` (./modelos) evita de propósito para a seta curva não
// passar por dentro do bloco de baixo. Aqui não é o mesmo caso e por isso não é
// a mesma escolha: o bloco criado por clique nasce SOLTO, sem ligação nenhuma
// (`inserirNoCentro` passa `sobreSeta: null`), e quando o dono o ligar depois a
// seta sai da borda direita para a borda esquerda do de baixo — ela contorna,
// não atravessa. Fica anotado em vez de virar premissa.
// ---------------------------------------------------------------------------
export function lugarDoBlocoNovo(
  centro: Ponto,
  passos: Passo[],
  medidas: Medidas,
  identidades: string[]
): Ponto {
  const x0 = Math.round(centro.x - LARGURA_DO_BLOCO / 2);
  const y0 = Math.round(centro.y - ALTURA_SUPOSTA / 2);

  // O QUE JÁ OCUPA LUGAR. Bloco sem `pos` fica de fora, e a ausência é o
  // significado: toda automação anterior à Fase 1b é assim, e um bloco que não
  // está em lugar nenhum não pode reivindicar o centro do quadro.
  const ocupados = passos.flatMap((p, i) =>
    p.pos ? [{ canto: p.pos, altura: medidas[identidades[i]]?.height ?? ALTURA_SUPOSTA }] : []
  );

  // O LIMITE É PROVADO, e não um palpite folgado. Cada bloco parado pode barrar
  // no máximo DUAS colunas: as colunas distam 250 e o cruzamento em x exige
  // menos de 190 de afastamento, então um mesmo bloco não alcança três delas
  // (precisaria de menos de 190 para duas colunas a 500 de distância). Com
  // `passos.length` blocos, no máximo `2 * passos.length` colunas ficam
  // barradas — e a coluna seguinte tem as três linhas livres.
  const colunas = 2 * passos.length + 1;
  for (let k = 0; k < colunas * LINHAS_DA_CASCATA; k++) {
    const x = x0 + Math.floor(k / LINHAS_DA_CASCATA) * PASSO_ENTRE_BLOCOS.x;
    const y = y0 + (k % LINHAS_DA_CASCATA) * PASSO_ENTRE_BLOCOS.y;
    const lugar = { x, y };
    if (!ocupados.some((o) => seCobrem(lugar, ALTURA_SUPOSTA, o.canto, o.altura))) return lugar;
  }

  // A SAÍDA QUE O TYPESCRIPT EXIGE E QUE A ARITMÉTICA ACIMA NÃO ALCANÇA — e ela
  // é LIVRE POR CONSTRUÇÃO, e não livre por sorte: abaixo do fundo do bloco mais
  // baixo, nenhum retângulo cruza em y, seja qual for o x. A versão anterior
  // devolvia aqui "a última posição tentada", que podia estar ocupada e acertava
  // por coincidência — o teste daquela época media isso por extenso.
  const fundo = ocupados.reduce((maior, o) => Math.max(maior, o.canto.y + o.altura), y0);
  return { x: x0, y: Math.round(fundo) };
}
