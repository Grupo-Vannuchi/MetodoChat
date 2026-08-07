"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { identidadeDoPasso, type Passo } from "@/lib/steps";
import No, { type DadosDoNo } from "./no";
import { arranjoAutomatico, blocoNovo } from "./modelos";
import Paleta from "./paleta";

const TIPOS_DE_NO = { bloco: No };

// O TIPO DO ARRASTO da paleta. Escrito aqui e lido aqui, para o quadro não
// reagir a arquivo, imagem ou texto arrastado de outra janela.
const TIPO_DO_ARRASTO = "application/metodochat-bloco";

// A largura do bloco é fixa em `no.tsx` (`w-[190px]`); a altura varia com o
// texto e chega medida pelo React Flow. Estes são só o palpite de antes da
// primeira medição.
const LARGURA_DO_BLOCO = 190;
const ALTURA_SUPOSTA = 48;

// A que distância da seta, em unidades do quadro, o ponteiro já conta como
// "em cima dela". Folga de propósito: a seta desenhada tem 1px, e exigir o pixel
// exato tornaria o gesto de reordenar impossível na prática.
//
// ERA 30, E 30 REORDENAVA SEM QUERER. Medido no navegador, com cinco blocos
// arranjados à mão em duas linhas (uma "cobra", que é o que sai quando alguém
// organiza um fluxo numa tela larga):
//
//   o bloco B, PARADO, tinha o ponto de pega a 27,5 unidades da seta D→E, que
//   não é vizinha dele. Um empurrão de 4 PIXELS na horizontal — o bloco andou 2
//   unidades, e a distância à seta nem mudou — trocou a ordem de
//   [A,B,C,D,E] para [A,C,D,B,E]. Sem aviso, e sem desfazer.
//
// 30 unidades também é metade do vão do arranjo automático (`modelos.ts`:
// LARGURA 250 menos os 190 do bloco), ou seja: o halo de uma seta encostava no
// da vizinha. 16 é folgado para a mira — o destaque acende antes de soltar,
// então quem mira tem resposta — e deixa de cobrir o vão inteiro.
//
// MAS REDUZIR O ALCANCE NÃO RESOLVE A CLASSE, e é importante que isto esteja
// escrito: com 16, basta o bloco estar parado a 15 unidades de uma seta alheia
// para o mesmo empurrão de 4 pixels reordenar de novo. O que fecha a classe é a
// segunda condição, em `setasNoInicio` lá embaixo.
const ALCANCE_DA_SETA = 16;

// Onde o ponteiro está, num evento que pode ser de mouse OU de toque — é assim
// que o React Flow tipa os eventos de arraste do nó. No toque vale
// `changedTouches`, e não `touches`: no `touchend` a lista `touches` já está
// vazia, e é justamente no fim do gesto que a conta importa.
function pontoDoEvento(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("clientX" in e) return { x: e.clientX, y: e.clientY };
  const t = e.changedTouches[0];
  return t ? { x: t.clientX, y: t.clientY } : null;
}

function distanciaAoSegmento(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const comprimento = dx * dx + dy * dy;
  // Segmento degenerado (as duas pontas no mesmo lugar): vira distância a um
  // ponto. Acontece de verdade — dois blocos empilhados na mesma altura fazem
  // o trecho vertical do meio ter comprimento zero.
  const t = comprimento === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comprimento));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// O quadro.
//
// A REGRA QUE ORGANIZA ESTE ARQUIVO: a ordem de execução é a ordem do array
// `passos`. Arrastar um nó muda `pos` e NADA MAIS. As setas são derivadas do
// array, não o contrário.
//
// Isso não é preferência de implementação — é a defesa contra o pior defeito
// possível aqui. Se a posição definisse a ordem, empurrar um bloco três pixels
// sem querer reordenaria o fluxo, e a próxima pessoa a acionar a automação
// receberia as mensagens fora de ordem. Sem erro, sem aviso. Descobre-se pelo
// cliente reclamando.
// O ESTADO MORA AQUI, e não num pai. `quadro.tsx` é o container do editor: ele
// segura `Passo[]`, e paleta, nós e painel só recebem callbacks. Um pai
// controlando a lista faria duas fontes de verdade para a mesma coisa.
// `gatilho` entrou em uso nesta tarefa: é o que a paleta lê para desabilitar os
// itens que aquele gatilho não executa, e ele continua sendo o segundo argumento
// de `conferirLista` (lib/steps.ts) quando o painel (Tarefa 7) chegar.
//
// `automationId` ainda NÃO é lido aqui, e por isso segue fora da
// desestruturação, para o lint não o acusar de esquecimento. Ele é o que o
// salvar precisa, e entra em uso na Tarefa 8. Exigi-lo na assinatura desde já é
// o que garante que a página o passe desde a primeira montagem, em vez de a prop
// nascer opcional e ficar assim.
export default function Quadro({
  passosIniciais,
  gatilho,
}: {
  automationId: string;
  passosIniciais: Passo[];
  gatilho: string;
}) {
  // O BLOCO LEGADO SEM A CHAVE `url` É DEIXADO COMO ESTÁ, e esta é a decisão
  // que a Fase 1b devia à convenção da chave (ver `modelos.ts`).
  //
  // O que está gravado no banco de quem salvou um "link sem endereço" pelo
  // formulário antigo é `{tipo:"dm", texto, botao_label:"Abrir link"}` — o
  // `montarPassos` da `main` grava `url: fu.url || undefined` e o `undefined`
  // some na serialização para jsonb. Isso é parada dura de verdade no motor
  // (`esperaResposta` diz sim), e `conferirLista` é CEGA para ela.
  //
  // A forma é GENUINAMENTE AMBÍGUA: esse mesmo objeto, byte por byte, é
  // também a resposta rápida legítima que a paleta oferece em "Mensagem com
  // botão". Nada no dado separa os dois, então não há heurística a inventar —
  // adivinhar erraria em cima de listas boas, e errar para o lado de "é link"
  // acenderia ERRO e TRAVARIA O SALVAR de toda automação com resposta rápida,
  // que é a maioria delas.
  //
  // Das duas opções em aberto, esta é a primeira: TRATAR COMO RESPOSTA RÁPIDA,
  // que é o que o motor já faz e portanto não muda nada para ninguém. O preço
  // está dito: o link sem endereço continua travando o fluxo em silêncio até
  // alguém abrir o bloco e olhar.
  //
  // A segunda — PERGUNTAR AO DONO ao abrir, uma vez, e gravar a resposta como
  // a chave presente ou ausente — resolve a ambiguidade na única fonte que
  // sabe a resposta, e continua sendo a melhor saída. Ela não cabe aqui: exige
  // diálogo, Server Action e escrita no banco, e o quadro nem é quem abre a
  // automação (isso é a Tarefa 8; aqui a lista chega pronta em
  // `passosIniciais`). Fica registrada para o painel do bloco (Tarefa 7), que
  // é onde ela sai mais barata e mais honesta: lá o dono JÁ está olhando para
  // aquele bloco, e a pergunta pode ser um par de opções no próprio painel em
  // vez de um interrogatório na abertura. Escolhida a opção "abre um link", o
  // painel grava `url: ""`, o bloco entra na convenção, e `conferirLista`
  // volta a enxergá-lo.
  //
  // O que esta tarefa garante é que nada aqui MEXA na chave: `arranjoAutomatico`
  // só acrescenta `pos`, e `moverBloco` só troca `pos`. Os dois espalham o
  // bloco como ele veio, então nem semeiam `url` num bloco que não a tinha nem
  // a apagam de um que a tinha.
  const [passos, setPassos] = useState<Passo[]>(() => arranjoAutomatico(passosIniciais));
  const [selecionado, setSelecionado] = useState<string | null>(null);

  // Qual seta está sob o ponteiro durante um arraste. É o alvo dos DOIS gestos
  // que mexem na ordem — soltar um item da paleta e soltar um bloco que já
  // existe —, e é null quando o ponteiro não está sobre nenhuma.
  const [setaSobEle, setSetaSobEle] = useState<number | null>(null);

  // O TAMANHO MEDIDO DE CADA BLOCO, e ele PRECISA voltar para cá. Sem isto o
  // quadro perde TODAS AS SETAS no primeiro arraste — medido no navegador, e
  // era assim que a tarefa anterior estava entregue.
  //
  // O mecanismo: os nós são CONTROLADOS, e a lista `nos` é derivada de `passos`
  // a cada render. O React Flow mede a altura real de cada bloco no DOM e
  // devolve isso como uma mudança do tipo `dimensions`; quem só repassa
  // `position` e `select` joga essa medida fora, e no render seguinte a prop
  // `nodes` chega com objetos NOVOS que não têm `measured`. O nó volta a ser
  // "não inicializado": as setas, que são posicionadas a partir das alças
  // medidas, deixam de ser desenhadas, e o console do React Flow passa a
  // repetir "you are trying to drag a node that is not initialized".
  //
  // E o estrago é permanente, não um piscar: uma vez que a primeira leva de
  // `position` recria a lista, nada mais devolve a medida, então a corrente
  // some da tela e não volta enquanto a página não for recarregada.
  //
  // Isso NÃO abre uma segunda fonte de verdade para a ordem nem para a
  // posição: aqui só entra largura e altura, que são consequência do que o
  // bloco escreve na tela e não decidem nada. A ordem continua sendo o array, e
  // a posição continua vindo de `pos`.
  const [medidas, setMedidas] = useState<Record<string, { width: number; height: number }>>({});

  // A instância do React Flow, guardada só por causa de `screenToFlowPosition`:
  // ela é quem converte o ponto do ponteiro em coordenada do quadro, levando em
  // conta o zoom e o deslocamento. Sem ela, o bloco solto nasce no lugar errado
  // sempre que o quadro não estiver em zoom 1 — e ele nunca está, porque
  // `fitView` ajusta o zoom na abertura.
  const [instancia, setInstancia] = useState<ReactFlowInstance<Node, Edge> | null>(null);

  // A IDENTIDADE do bloco é a chave do nó, e não `p.id` cru.
  //
  // Bloco sem `id` continua existindo e continua sendo aceito de propósito:
  // `conferirLista` (lib/steps.ts) não o recusa justamente para não trancar o
  // dono fora do painel de toda lista anterior à Fase 1b. Usar `p.id!` aqui
  // seria uma promessa falsa — numa lista dessas todo nó nasceria com
  // `id: undefined` e toda seta com o id `"undefined->undefined"`, ou seja ids
  // repetidos, que é exatamente o que o React Flow não tolera. E arrastar um
  // deles moveria todos de uma vez, porque `p.id === id` casaria com todos.
  //
  // `identidadeDoPasso` devolve o id quando ele existe e o ÍNDICE EM TEXTO
  // quando não — único dentro da lista nos dois casos, que é tudo o que o
  // quadro precisa. É a mesma identidade que o cursor e a `passoKey` usam, de
  // modo que o nó que a tela mostra e o bloco que o motor persegue são o mesmo.
  const identidades = useMemo(() => passos.map(identidadeDoPasso), [passos]);

  // Só a posição volta do React Flow para o estado. Nada aqui reordena.
  const moverBloco = useCallback((identidade: string, x: number, y: number) => {
    setPassos((atual) =>
      atual.map((p, i) => (identidadeDoPasso(p, i) === identidade ? { ...p, pos: { x, y } } : p))
    );
  }, []);

  // QUAL SETA ESTÁ SOB O PONTEIRO — POR GEOMETRIA, e não pelos eventos de mouse
  // da seta. Esta escolha é a correção de um mecanismo que não funciona, e o
  // motivo precisa ficar escrito para ninguém o "simplificar" de volta.
  //
  // O caminho natural seria `onEdgeMouseEnter`/`onEdgeMouseLeave` do React Flow,
  // e ele acende a seta muito bem com o ponteiro solto. Só que NENHUM DOS DOIS
  // GESTOS QUE PRECISAM DELE é um ponteiro solto, e nos dois ele fica mudo:
  //
  //   ARRASTO DA PALETA — é arrasto nativo do HTML. Enquanto ele acontece, o
  //     navegador não emite evento de mouse nenhum, só os de `drag`. O
  //     `mouseenter` da seta não chega nunca. Medido: com o item da paleta em
  //     cima da seta, nenhuma seta acendeu, e soltar ali não inseriu nada.
  //   ARRASTO DE UM BLOCO — os eventos de mouse até saem, mas quem está embaixo
  //     do ponteiro é o próprio bloco arrastado, que anda junto com ele. A seta
  //     fica atrás dele, e o `mouseenter` dela também não chega. Medido:
  //     soltar o bloco em cima da seta não mudava a ordem, só a posição.
  //
  // Por geometria os dois funcionam, porque o que decide é o PONTO, e o ponto
  // existe nos dois gestos. O traçado conferido é o mesmo `smoothstep` que o
  // React Flow desenha: sai da alça direita do bloco `i`, vai reto até o meio do
  // vão, desce (ou sobe) e entra na alça esquerda do bloco `i + 1`. São três
  // trechos, e vale a menor distância aos três — conferir só a reta entre as
  // duas pontas erraria justamente no meio do vão, que é onde a seta é mais
  // fácil de acertar.
  //
  // `ignorar` existe para o arrasto de um bloco: as duas setas que chegam nele e
  // saem dele não são alvo — soltá-lo na própria seta é pedir para ele ficar
  // onde já está.
  //
  // ELA DEVOLVE TODAS AS SETAS ao alcance, e não só a mais perto, porque há dois
  // leitores com perguntas diferentes: quem solta quer a mais perto
  // (`setaSobOPonto`, logo abaixo), e quem decide se o gesto CONQUISTOU alguma
  // coisa (`setasNoInicio`) precisa do conjunto — um bloco parado entre duas
  // setas está ao alcance das duas, e guardar só a campeã deixaria a outra
  // passar.
  const setasAoAlcance = useCallback(
    (clientX: number, clientY: number, ignorar: number[]): { i: number; d: number }[] => {
      if (!instancia) return [];
      const p = instancia.screenToFlowPosition({ x: clientX, y: clientY });
      const achadas: { i: number; d: number }[] = [];
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
          distanciaAoSegmento(p.x, p.y, sx, sy, meio, sy),
          distanciaAoSegmento(p.x, p.y, meio, sy, meio, ty),
          distanciaAoSegmento(p.x, p.y, meio, ty, tx, ty)
        );
        if (d < ALCANCE_DA_SETA) achadas.push({ i, d });
      }
      return achadas.sort((a, b) => a.d - b.d);
    },
    [instancia, passos, medidas, identidades]
  );

  const setaSobOPonto = useCallback(
    (clientX: number, clientY: number, ignorar: number[]): number | null =>
      setasAoAlcance(clientX, clientY, ignorar)[0]?.i ?? null,
    [setasAoAlcance]
  );

  // AS SETAS QUE JÁ ESTAVAM AO ALCANCE QUANDO O GESTO COMEÇOU — e soltar numa
  // delas NÃO reordena.
  //
  // Esta é a evidência de intenção que faltava, e ela existe porque proximidade
  // sozinha não é decisão. O caso medido no navegador está escrito em
  // `ALCANCE_DA_SETA`: um bloco parado a 27,5 unidades de uma seta alheia era
  // reordenado por um empurrão de 4 pixels. O ponto não é o empurrão ser
  // pequeno — é a seta já estar ali ANTES dele. Reordenar por proximidade
  // herdada da posição é exatamente o defeito que este arquivo inteiro existe
  // para não ter (ver a regra do topo).
  //
  // Escrito como conjunto, e conferido no SOLTAR: o gesto legítimo é pegar o
  // bloco e LEVÁ-LO até um traçado, e um traçado que já estava ao alcance não
  // foi levado a lugar nenhum. Se o bloco estivesse mesmo em cima daquela seta,
  // a ordem já seria essa.
  //
  // Um `ref`, e não estado: isto é lido dentro dos manipuladores do mesmo gesto
  // e não desenha nada. Em estado, cada `dragstart` custaria um render a mais
  // sem nada a mostrar.
  //
  // O QUE ISTO NÃO COBRE, dito com a medida certa: o bloco que começa longe de
  // tudo e é levado — de propósito, mas para arrumar a tela — até a vizinhança
  // de uma seta que não é dele. Essa seta foi conquistada pelo gesto, e o código
  // não tem como saber que a pessoa só queria arrumar. Contra ela sobram as
  // outras duas defesas, e as duas são visíveis: o alcance encolhido, e o
  // DESTAQUE — a seta acende durante o arraste e apaga quando o alvo não vale,
  // então a tela diz o que vai acontecer antes de a pessoa soltar.
  const setasNoInicio = useRef<Set<number>>(new Set());

  // O alvo válido de um arraste de bloco: ao alcance AGORA e fora do que já
  // estava ao alcance no começo. Os três manipuladores do gesto usam esta mesma
  // função — destaque e resultado não podem discordar.
  const alvoDoArraste = useCallback(
    (clientX: number, clientY: number, indice: number): number | null => {
      // As setas que TOCAM o bloco arrastado ficam fora da conta: soltá-lo na
      // seta que já sai dele, ou na que já chega nele, é pedir o lugar em que
      // ele está.
      const alvo = setaSobOPonto(clientX, clientY, [indice - 1, indice]);
      return alvo !== null && !setasNoInicio.current.has(alvo) ? alvo : null;
    },
    [setaSobOPonto]
  );

  // Soltar num ponto vazio ANEXA NO FIM. Soltar sobre uma seta INSERE ali.
  //
  // Não existe bloco solto: como a ordem é o array, todo bloco está sempre na
  // corrente. Isso contraria quem conhece o draw.io, onde caixa solta é normal, e
  // é deliberado — bloco solto seria um bloco que nunca roda, e nada na tela
  // explicaria por quê.
  //
  // O bloco sai de `blocoNovo` e é ESPALHADO com `pos` por cima, e não montado
  // campo a campo: é isso que mantém a convenção da chave `url` (modelos.ts)
  // intacta na inserção — o `dm_link` chega com `url: ""` e continua com ela, e
  // os outros continuam sem a chave.
  const inserir = useCallback((chave: string, x: number, y: number, sobreSeta: number | null) => {
    const bloco = { ...blocoNovo(chave), pos: { x, y } };
    setPassos((atual) => {
      if (sobreSeta === null) return [...atual, bloco];
      return [...atual.slice(0, sobreSeta + 1), bloco, ...atual.slice(sobreSeta + 1)];
    });
  }, []);

  // Reordenar é soltar o bloco SOBRE UMA SETA, nunca arrastar pelo quadro.
  //
  // O gesto é explícito de propósito. Se posição definisse ordem, um empurrão
  // acidental trocaria a ordem das mensagens que o cliente recebe.
  //
  // E "explícito" passou a ser cobrado, não só declarado: quem chama esta função
  // é `alvoDoArraste`, que exige a seta ter sido CONQUISTADA pelo gesto. Sem
  // isso o empurrão acidental acontecia mesmo — medido, com 4 pixels (ver
  // `ALCANCE_DA_SETA` e `setasNoInicio`).
  //
  // Pela IDENTIDADE, não por `p.id`, pelo mesmo motivo de `moverBloco` logo
  // acima: numa lista anterior à Fase 1b todo bloco tem `id: undefined`, e
  // comparar por `p.id` casaria com todos de uma vez.
  //
  // O `alvo` corrige o deslocamento que a própria remoção causa: tirado o bloco
  // da posição `de`, tudo que vinha depois dele andou uma casa para trás, então
  // "depois da seta `depoisDe`" só continua sendo aquele lugar quando o bloco
  // saiu de ANTES dela.
  const moverPara = useCallback((identidade: string, depoisDe: number) => {
    setPassos((atual) => {
      const de = atual.findIndex((p, i) => identidadeDoPasso(p, i) === identidade);
      if (de === -1) return atual;
      const sem = atual.filter((_, i) => i !== de);
      const alvo = de <= depoisDe ? depoisDe : depoisDe + 1;
      return [...sem.slice(0, alvo), atual[de], ...sem.slice(alvo)];
    });
  }, []);

  // Apagar. A seleção some junto quando é o bloco apagado que estava
  // selecionado, senão o painel (Tarefa 7) ficaria aberto num bloco que acabou
  // de deixar de existir.
  //
  // Apaga UM bloco, achado pelo índice, e não todos os que casam com a
  // identidade: `conferirLista` (lib/steps.ts) trata id repetido como ERRO
  // justamente porque ele é produzível — duplicar um bloco é o gesto que o
  // produz —, e um `filter` por identidade apagaria os dois de uma vez.
  const apagarBloco = useCallback((identidade: string) => {
    setPassos((atual) => {
      const i = atual.findIndex((p, j) => identidadeDoPasso(p, j) === identidade);
      return i === -1 ? atual : atual.filter((_, j) => j !== i);
    });
    setSelecionado((s) => (s === identidade ? null : s));
  }, []);

  const nos: Node[] = useMemo(
    () =>
      passos.map((p, i) => ({
        id: identidades[i],
        type: "bloco",
        position: p.pos ?? { x: 0, y: 0 },
        // A medida que o React Flow devolveu, devolvida a ele. `undefined` na
        // primeira montagem, quando ele ainda não mediu nada.
        measured: medidas[identidades[i]],
        // `selected` é o que o React Flow lê; `data.selecionado` é o que o nó
        // desenha. Os dois saem do MESMO `selecionado`, então não há como
        // divergirem — o que a biblioteca considera selecionado e o que está com
        // a borda acesa são sempre o mesmo bloco.
        selected: identidades[i] === selecionado,
        data: {
          passo: p,
          identidade: identidades[i],
          temErro: false,
          selecionado: identidades[i] === selecionado,
          aoApagar: apagarBloco,
        } as DadosDoNo,
      })),
    [passos, identidades, selecionado, apagarBloco, medidas]
  );

  // As setas SEMPRE ligam o bloco i ao i+1 do array. Não há edge que o usuário
  // possa criar ou apagar.
  //
  // O `nodesConnectable={false}` lá embaixo NÃO FECHA O GESTO SOZINHO, e é
  // importante que isto esteja dito aqui, que é o arquivo que se lê primeiro: a
  // prop chega ao NÓ, e o desligamento só alcança as alças porque `no.tsx`
  // repassa `isConnectable` (e `isConnectableStart`, que é quem de fato porteia
  // o `onPointerDown`) para cada `Handle`. Sem esse repasse, `Handle` cai no
  // próprio padrão — `true` — e arrastar a partir de uma alça abre uma conexão
  // de verdade, com as alças acendendo, apesar desta prop estar desligada. Isso
  // foi medido, não deduzido; o mecanismo inteiro está no comentário de
  // `no.tsx`.
  //
  // Ou seja: apagar as props do nó "porque o quadro já resolve" reabre o gesto.
  // As duas pontas são obrigatórias.
  const setas: Edge[] = useMemo(
    () =>
      identidades.slice(0, -1).map((identidade, i) => ({
        id: `${identidade}->${identidades[i + 1]}`,
        source: identidade,
        target: identidades[i + 1],
        type: "smoothstep",
        animated: false,
        // A seta `i` liga o bloco `i` ao `i + 1`, então soltar "nela" é inserir
        // ou mover para depois de `i`. É esse o número que `setaSobEle` guarda.
        style: setaSobEle === i ? { stroke: "rgb(99 102 241)", strokeWidth: 3 } : undefined,
      })),
    [identidades, setaSobEle]
  );

  // TODA mudança de posição volta para o estado, inclusive as intermediárias do
  // arraste. NÃO FILTRE POR `m.dragging` AQUI — e a frase é imperativa porque o
  // filtro já existiu neste lugar, apresentado como otimização.
  //
  // POR QUE ELE NÃO PODE EXISTIR: os nós são CONTROLADOS (a prop `nodes`, não
  // `defaultNodes`). Com nós controlados a posição desenhada vem só do store, e
  // o store só é alimentado pela prop — o React Flow não guarda um rascunho
  // próprio durante o gesto. Descartar as mudanças com `dragging: true` faz a
  // prop `nodes` não mudar enquanto o botão está apertado, então o `transform`
  // do nó não muda: O BLOCO CONGELA SOB O CURSOR E TELEPORTA AO SOLTAR. Medido
  // no navegador, amostrando o `transform` durante o gesto — e a medição que
  // compara só ANTES e DEPOIS não pega isso, porque é exatamente o que esta
  // falha preserva.
  //
  // O que o filtro dizia é verdade e não basta: sim, sem ele cada quadro de
  // animação vira um `setPassos` e a lista inteira é recriada dezenas de vezes
  // por segundo. Esse é o custo, é sobre uma lista de dezenas de itens, e é o
  // que todo exemplo controlado do React Flow faz. O outro caminho legítimo
  // seria manter uma cópia dos nós em estado local e reconciliar no fim, que
  // custa uma segunda fonte de verdade para a posição — caro para o que resolve.
  //
  // A invariante do arquivo não corre risco nenhum com isso: `moverBloco`
  // continua escrevendo só `pos`, e o `map` continua não reordenando.
  //
  // AS MUDANÇAS DE SELEÇÃO TAMBÉM SÃO REPASSADAS, e não é enfeite. Sem elas
  // `node.selected` nunca vira `true` no store do React Flow — a borda até
  // aparecia, porque vem do estado daqui, mas seleção por caixa, por teclado e a
  // noção de "o nó selecionado" que a biblioteca usa ficavam mortas. A Tarefa 6
  // tem apagar bloco, e apagar precisa saber qual.
  //
  // A seleção continua sendo UMA SÓ (`selecionado` é `string | null`), e isso é
  // escolha: quem consome a seleção é o painel do bloco (Tarefa 7), que edita um
  // bloco de cada vez. Múltipla exigiria trocar por um `Set` e decidir o que o
  // painel mostra com dois blocos escolhidos — decisão que não é desta tarefa.
  // Repassando as mudanças, porém, o store e este estado passam a concordar, que
  // é o que faltava.
  const aoMudarNos = useCallback(
    (mudancas: NodeChange[]) => {
      for (const m of mudancas) {
        if (m.type === "position" && m.position) {
          moverBloco(m.id, Math.round(m.position.x), Math.round(m.position.y));
        } else if (m.type === "select") {
          // Deselecionar só zera se for o nó que estava selecionado: numa troca
          // de seleção chegam duas mudanças na mesma leva (o antigo com `false`,
          // o novo com `true`), e a ordem entre elas não é garantida.
          setSelecionado((atual) => (m.selected ? m.id : atual === m.id ? null : atual));
        } else if (m.type === "dimensions" && m.dimensions) {
          // A medida do bloco. O `if` de igualdade não é economia: sem ele, cada
          // leva de `dimensions` — e elas chegam junto com o redimensionamento —
          // criaria um objeto novo, `nos` seria recriado, e o React Flow mediria
          // de novo, num laço que não para.
          const d = m.dimensions;
          setMedidas((atual) => {
            const antes = atual[m.id];
            if (antes && antes.width === d.width && antes.height === d.height) return atual;
            return { ...atual, [m.id]: { width: d.width, height: d.height } };
          });
        }
      }
    },
    [moverBloco]
  );

  return (
    <div className="relative h-[calc(100vh-13rem)] w-full rounded-xl border border-zinc-200 dark:border-zinc-800">
      <Paleta gatilho={gatilho} />
      <ReactFlow
        nodes={nos}
        edges={setas}
        nodeTypes={TIPOS_DE_NO}
        onNodesChange={aoMudarNos}
        onInit={setInstancia}
        // O RETRATO DO COMEÇO DO GESTO, e ele é tirado aqui porque só aqui o
        // bloco ainda não andou: as setas ao alcance neste instante são as que a
        // POSIÇÃO deu de graça, não as que o gesto foi buscar. `alvoDoArraste`
        // descarta essas — o porquê está em `setasNoInicio`.
        onNodeDragStart={(e, no) => {
          const p = pontoDoEvento(e);
          const i = identidades.indexOf(no.id);
          setasNoInicio.current = new Set(
            p ? setasAoAlcance(p.x, p.y, [i - 1, i]).map((s) => s.i) : []
          );
        }}
        // O DESTAQUE SEGUE A MESMA REGRA DO RESULTADO, e não só a proximidade.
        // Acender uma seta que o soltar vai recusar é a tela oferecendo um gesto
        // que não faz nada — a definição de ensinar a fazer errado, e o mesmo
        // motivo pelo qual `no.tsx` desliga as alças de conexão.
        onNodeDrag={(e, no) => {
          const p = pontoDoEvento(e);
          const i = identidades.indexOf(no.id);
          setSetaSobEle(p && alvoDoArraste(p.x, p.y, i));
        }}
        // O alvo é recalculado AQUI, e não lido de `setaSobEle`. Os dois dão o
        // mesmo resultado — mesma função, mesmo ponto —, e recalcular é o que
        // garante que a ordem não dependa de qual render chegou primeiro. O
        // estado fica só para o destaque na tela.
        onNodeDragStop={(e, no) => {
          const p = pontoDoEvento(e);
          const i = identidades.indexOf(no.id);
          const alvo = p && alvoDoArraste(p.x, p.y, i);
          setSetaSobEle(null);
          if (alvo !== null && alvo !== undefined) moverPara(no.id, alvo);
        }}
        onDragOver={(e) => {
          // Só o que veio da paleta. Sem esta conferência o quadro aceitaria
          // arquivo e texto arrastados de qualquer lugar, e o `onDrop` abaixo
          // teria de recusá-los depois de o navegador já ter prometido que
          // aceita.
          if (!e.dataTransfer.types.includes(TIPO_DO_ARRASTO)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setSetaSobEle(setaSobOPonto(e.clientX, e.clientY, []));
        }}
        // `dragleave` BORBULHA dos filhos, e o quadro é feito deles: cada nó,
        // cada seta, o fundo e os controles. Apagar o destaque em todo
        // `dragleave` fazia a seta PISCAR durante o arraste da paleta — o
        // ponteiro cruza a fronteira entre dois filhos, o `dragleave` do que
        // ficou para trás sobe até aqui, e só o `dragover` seguinte reacende.
        //
        // O resultado nunca dependeu disso — `onDrop` recalcula o alvo em vez de
        // ler `setaSobEle`, e essa decisão está escrita ali —, mas reordenar é um
        // gesto que precisa PARECER preciso: destaque que treme é a tela dizendo
        // que não sabe onde o bloco vai cair.
        //
        // `relatedTarget` é para onde o ponteiro foi. Dentro do quadro, o gesto
        // continua e o destaque fica. Fora — ou `null`, que é sair da janela —,
        // aí sim apaga.
        //
        // O molde é `Element` e não `Node` porque `Node` aqui é o TIPO DO REACT
        // FLOW, importado lá em cima: o `Node` do DOM está sombreado neste
        // arquivo. `Element` cobre o que `relatedTarget` pode ser de verdade —
        // os filhos do quadro são HTML e SVG, e os dois são `Element`.
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Element | null)) return;
          setSetaSobEle(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const chave = e.dataTransfer.getData(TIPO_DO_ARRASTO);
          setSetaSobEle(null);
          if (!chave) return;
          const p = instancia?.screenToFlowPosition({ x: e.clientX, y: e.clientY });
          inserir(chave, p?.x ?? 0, p?.y ?? 0, setaSobOPonto(e.clientX, e.clientY, []));
        }}
        // Não há `onNodeClick`/`onPaneClick` aqui de propósito: a seleção chega
        // por `onNodesChange` como mudança do tipo `select`, que é o mesmo
        // caminho da seleção por caixa e por teclado. Escrever a seleção também
        // nos dois cliques faria duas fontes para o mesmo estado, e a que
        // sobrasse de fora (a caixa) seria a que ninguém testa.
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={17} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
