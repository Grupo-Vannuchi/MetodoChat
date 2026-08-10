"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
import { conferirLista, identidadeDoPasso, type Passo } from "@/lib/steps";
import No, { type DadosDoNo } from "./no";
import Gatilho, { nomeDoGatilho, resumoDasPalavras, type DadosDoGatilho } from "./gatilho";
import Painel, { type Configuracao } from "./painel";
import { arranjoAutomatico, blocoNovo, resumoDoBloco } from "./modelos";
import Paleta from "./paleta";
import * as Geo from "./geometria";
import { salvarAutomacao } from "../actions";
import { btnPrimary, btnSecondary, muted } from "../../ui";

const TIPOS_DE_NO = { bloco: No, gatilho: Gatilho };

// QUAL TEMA O DOCUMENTO ESTÁ USANDO — e por que ele é lido do DOM em vez de vir
// como prop.
//
// O React Flow tem `colorMode`, e sem ele os controles (mais, menos, enquadrar)
// nascem pretos sobre fundo escuro, ilegíveis. Os três valores são `light`,
// `dark` e `system` — e `system` NÃO SERVE: ele lê `prefers-color-scheme`, e o
// tema deste painel não vem daí. Ele vem da classe `dark` no `<html>`, escrita
// por `app/layout.tsx` a partir do `localStorage` e alternada pelo botão do menu
// (`app/app-shell.tsx`). Com `system`, quem usa o painel claro num sistema
// escuro (ou o contrário) veria os controles do tema errado.
//
// O `MutationObserver` é o que faz o quadro acompanhar o botão de trocar tema
// sem recarregar: a troca é uma mudança de classe no `<html>`, e não há evento
// para ela.
//
// Começa em `light` — o servidor não conhece o tema, e o primeiro render precisa
// ser igual nos dois lados para não haver divergência de hidratação. A correção
// acontece no efeito, depois da montagem.
function useTemaDoDocumento(): "light" | "dark" {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const ler = () => setEscuro(html.classList.contains("dark"));
    ler();
    const observador = new MutationObserver(ler);
    observador.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observador.disconnect();
  }, []);
  return escuro ? "dark" : "light";
}

// O ID DO NÓ DE GATILHO, e ele NÃO COLIDE com id de bloco por construção:
// `identidadeDoPasso` (lib/steps.ts) devolve ou um id com prefixo `b_`, ou o
// índice em texto. Nenhum dos dois é "gatilho".
const ID_DO_GATILHO = "gatilho";

// O TIPO DO ARRASTO da paleta. Escrito aqui e lido aqui, para o quadro não
// reagir a arquivo, imagem ou texto arrastado de outra janela.
const TIPO_DO_ARRASTO = "application/metodochat-bloco";

// Onde o ponteiro está, num evento que pode ser de mouse OU de toque — é assim
// que o React Flow tipa os eventos de arraste do nó. No toque vale
// `changedTouches`, e não `touches`: no `touchend` a lista `touches` já está
// vazia, e é justamente no fim do gesto que a conta importa.
function pontoDoEvento(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("clientX" in e) return { x: e.clientX, y: e.clientY };
  const t = e.changedTouches[0];
  return t ? { x: t.clientX, y: t.clientY } : null;
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
// O GATILHO SAIU DE PROP E VIROU ESTADO, dentro de `configuracao`, e o motivo é
// que o painel do nó de gatilho o EDITA. Ele é lido em três lugares que agora
// concordam sozinhos: a paleta desabilita os itens que aquele gatilho não
// executa, `conferirLista` (lib/steps.ts) recusa a resposta pública fora do
// comentário, e o próprio nó mostra o nome. Trocar o gatilho no painel move os
// três de uma vez.
//
// SÃO DOIS ESTADOS E UMA GRAVAÇÃO SÓ: `passos` vai para a coluna `steps`,
// `configuracao` vai para as colunas da automação — nome, ativo, gatilho,
// palavras-chave, correspondência, post e story. Os dois viajam JUNTOS para
// `salvarAutomacao` (../actions.ts), que os grava dentro de uma transação. Dois
// estados aqui porque são duas coisas que a tela edita em lugares diferentes
// (os nós e o painel do gatilho); uma gravação lá porque o que um deles pode
// ser depende do outro, e conferir metade nova contra metade velha não fecha —
// o mecanismo inteiro está no comentário daquele arquivo.
export default function Quadro({
  automationId,
  passosIniciais,
  configuracaoInicial,
}: {
  automationId: string;
  passosIniciais: Passo[];
  configuracaoInicial: Configuracao;
}) {
  // O BLOCO LEGADO SEM A CHAVE `url` É DEIXADO COMO ESTÁ, e esta é a decisão
  // que a Fase 1b devia à convenção da chave (ver `modelos.ts`).
  //
  // O que está gravado no banco de quem salvou um "link sem endereço" pelo
  // formulário antigo é `{tipo:"dm", texto, botao_label:"Abrir link"}` — ele
  // gravava `url: fu.url || undefined` e o `undefined` sumia na serialização
  // para jsonb. Isso é parada dura de verdade no motor (`esperaResposta` diz
  // sim), e `conferirLista` é CEGA para ela.
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
  // diálogo, Server Action e escrita no banco, e o quadro nem é quem lê a
  // automação do banco (quem lê é `app/automacoes/[id]/page.tsx`; aqui a lista
  // chega pronta em `passosIniciais`). Fica registrada para o painel do bloco
  // (`painel.tsx`), que é onde ela sai mais barata e mais honesta: lá o dono JÁ
  // está olhando para aquele bloco, e a pergunta pode ser um par de opções em
  // vez de um interrogatório na abertura. Escolhida a opção "abre um link", o
  // painel grava `url: ""`, o bloco entra na convenção, e `conferirLista`
  // volta a enxergá-lo.
  //
  // O que este arquivo garante é que nada aqui MEXA na chave:
  // `arranjoAutomatico` só acrescenta `pos`, e `moverBloco` só troca `pos`. Os
  // dois espalham o bloco como ele veio, então nem semeiam `url` num bloco que
  // não a tinha nem a apagam de um que a tinha.
  const [passos, setPassos] = useState<Passo[]>(() => arranjoAutomatico(passosIniciais));
  const [configuracao, setConfiguracao] = useState<Configuracao>(configuracaoInicial);

  // A identidade do nó selecionado — de um bloco, ou `ID_DO_GATILHO`. É ela que
  // o painel lê para saber o que desenhar.
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
  // existe nos dois gestos. A geometria em si — o traçado conferido, o alcance,
  // a regra do que conta como "conquistado pelo gesto" — mora em `./geometria`,
  // módulo puro e testado; aqui só entra a parte que DEPENDE do React Flow: a
  // conversão do ponto de tela (`clientX`/`clientY`) para coordenada do quadro
  // via `screenToFlowPosition`.
  const setasAoAlcance = useCallback(
    (clientX: number, clientY: number, ignorar: number[]): Geo.SetaCandidata[] => {
      if (!instancia) return [];
      const p = instancia.screenToFlowPosition({ x: clientX, y: clientY });
      return Geo.setasAoAlcance(p, passos, medidas, identidades, ignorar);
    },
    [instancia, passos, medidas, identidades]
  );

  const setaSobOPonto = useCallback(
    (clientX: number, clientY: number, ignorar: number[]): number | null => {
      if (!instancia) return null;
      const p = instancia.screenToFlowPosition({ x: clientX, y: clientY });
      return Geo.setaSobOPonto(p, passos, medidas, identidades, ignorar);
    },
    [instancia, passos, medidas, identidades]
  );

  // AS SETAS QUE JÁ ESTAVAM AO ALCANCE QUANDO O GESTO COMEÇOU — e soltar numa
  // delas NÃO reordena. A regra em si (por que proximidade sozinha não é
  // decisão, o que ela fecha e o que ela não cobre) está documentada junto de
  // `alvoDoArraste` em `./geometria`, que é quem a aplica.
  //
  // Aqui só mora o ESTADO do gesto: um `ref`, e não `useState`, porque isto é
  // lido dentro dos manipuladores do mesmo gesto e não desenha nada — em
  // estado, cada `dragstart` custaria um render a mais sem nada a mostrar.
  const setasNoInicio = useRef<Set<number>>(new Set());

  // O alvo válido de um arraste de bloco: ao alcance AGORA e fora do que já
  // estava ao alcance no começo (`Geo.alvoDoArraste`). Os três manipuladores do
  // gesto usam esta mesma função — destaque e resultado não podem discordar.
  const alvoDoArraste = useCallback(
    (clientX: number, clientY: number, indice: number): number | null => {
      if (!instancia) return null;
      const p = instancia.screenToFlowPosition({ x: clientX, y: clientY });
      return Geo.alvoDoArraste(p, passos, medidas, identidades, indice, setasNoInicio.current);
    },
    [instancia, passos, medidas, identidades]
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
  // `ALCANCE_DA_SETA` e `alvoDoArraste` em `./geometria`).
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

  // O QUE ESTÁ ERRADO NA LISTA, pela MESMA função que o Server Action vai usar
  // para recusar o salvar (`conferirLista`, lib/steps.ts). Uma fonte só: a
  // borda vermelha do nó, o recado no painel e o bloqueio do salvar não têm
  // como discordar.
  //
  // Isto fecha o fio que a Tarefa 5 deixou solto: `temErro` era `false` fixo, e
  // a borda vermelha de `no.tsx` era código inalcançável.
  const problemas = useMemo(
    () => conferirLista(passos, configuracao.gatilho),
    [passos, configuracao.gatilho]
  );

  // OS ERROS DA LISTA INTEIRA, que são o que trava o salvar. `nivel: "aviso"`
  // não trava nada: aviso explica e deixa passar.
  const erros = useMemo(() => problemas.filter((p) => p.nivel === "erro"), [problemas]);

  // Só os ERROS, e só os que apontam um bloco. `nivel: "aviso"` não pinta a
  // borda: aviso explica e deixa passar, e vermelho é a cor do que trava o
  // salvar. Os de `indice: null` são da lista inteira e não têm nó a acender.
  const errosPorIndice = useMemo(() => {
    const s = new Set<number>();
    for (const p of problemas) if (p.nivel === "erro" && p.indice !== null) s.add(p.indice);
    return s;
  }, [problemas]);

  const nos: Node[] = useMemo(() => {
    // O GATILHO É O PRIMEIRO NÓ, e ele é o único que não sai de `passos`.
    //
    // `draggable: false` não é enfeite, é o que impede um defeito concreto: os
    // nós são CONTROLADOS, e a posição desenhada vem só da prop. Como este nó
    // não está em `passos`, `moverBloco` não acharia nada para mudar e a prop
    // não mudaria — O NÓ CONGELARIA SOB O CURSOR e voltaria ao lugar ao soltar,
    // exatamente o sintoma descrito em `aoMudarNos`, logo abaixo. Ele também
    // não participa da corrente: `identidades.indexOf("gatilho")` é -1, e
    // reordenar a partir de -1 destacaria setas que soltar recusaria.
    //
    // `deletable: false` porque sem gatilho não há automação.
    // ONDE ELE FICA: à ESQUERDA de onde o arranjo automático começa, e não em
    // (60, 60). `arranjoAutomatico` (modelos.ts) põe o BLOCO 0 exatamente em
    // (60, 60), então o gatilho ali cobre o primeiro bloco da lista — os dois
    // nós no mesmo pixel, um escondendo o outro. Medido no navegador: os dois
    // saíram com `translate(60px, 60px)`.
    //
    // -200 deixa o nó (190 de largura) entre -200 e -10, com folga até o 60 do
    // bloco 0 para a seta aparecer. Fixo de propósito: a posição do gatilho não
    // é gravada — ele não é um passo — e um bloco 0 arrastado para longe é
    // seguido pela seta, não pelo gatilho.
    const doGatilho: Node = {
      id: ID_DO_GATILHO,
      type: "gatilho",
      position: { x: -200, y: 60 },
      selected: selecionado === ID_DO_GATILHO,
      draggable: false,
      deletable: false,
      data: {
        tipo: configuracao.gatilho,
        palavras: configuracao.palavras,
        selecionado: selecionado === ID_DO_GATILHO,
      } as DadosDoGatilho,
    };

    return [
      doGatilho,
      ...passos.map((p, i) => ({
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
          temErro: errosPorIndice.has(i),
          selecionado: identidades[i] === selecionado,
          aoApagar: apagarBloco,
        } as DadosDoNo,
      })),
    ];
  }, [
    passos,
    identidades,
    selecionado,
    apagarBloco,
    medidas,
    errosPorIndice,
    configuracao.gatilho,
    configuracao.palavras,
  ]);

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
  const setas: Edge[] = useMemo(() => {
    const daCorrente: Edge[] = identidades.slice(0, -1).map((identidade, i) => ({
      id: `${identidade}->${identidades[i + 1]}`,
      source: identidade,
      target: identidades[i + 1],
      type: "smoothstep",
      animated: false,
      // A seta `i` liga o bloco `i` ao `i + 1`, então soltar "nela" é inserir
      // ou mover para depois de `i`. É esse o número que `setaSobEle` guarda.
      style: setaSobEle === i ? { stroke: "rgb(99 102 241)", strokeWidth: 3 } : undefined,
    }));

    if (!identidades.length) return daCorrente;

    // A SETA DO GATILHO ATÉ O BLOCO 0 fica FORA da numeração das outras, e a
    // separação é obrigatória: `setaSobEle` e toda a geometria (`./geometria`)
    // contam as setas por índice DE `passos` — a seta `i` liga o bloco `i` ao
    // `i + 1`. Empurrar esta para dentro dessa contagem deslocaria todos os
    // alvos de inserção em um, e soltar um bloco sobre uma seta o poria no
    // lugar errado.
    //
    // O preço, e ele está dito porque é uma seta que a tela desenha: soltar
    // sobre ELA não insere no começo da lista. `Geo.setaSobOPonto` não a
    // conhece, então o bloco solto ali é ANEXADO NO FIM, como em qualquer
    // ponto vazio. Inserir antes do bloco 0 nunca foi possível pelo gesto de
    // soltar — a seta `i` insere DEPOIS de `i`, e não existe seta -1 —, e
    // resolver isso mexe na geometria, que é módulo puro e testado à parte.
    return [
      {
        id: `${ID_DO_GATILHO}->${identidades[0]}`,
        source: ID_DO_GATILHO,
        target: identidades[0],
        type: "smoothstep",
        animated: false,
      },
      ...daCorrente,
    ];
  }, [identidades, setaSobEle]);

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

  // ONDE, NA LISTA, ESTÁ O BLOCO SELECIONADO. -1 quando o selecionado é o
  // gatilho, ou quando não há seleção nenhuma.
  //
  // Pelo ÍNDICE, e não só pelo objeto, porque o painel precisa dos dois: o
  // objeto para desenhar os campos, e o índice para casar com `Problema.indice`
  // (lib/steps.ts) e para o cabeçalho dizer de qual bloco se trata.
  const indiceSelecionado =
    selecionado === null || selecionado === ID_DO_GATILHO ? -1 : identidades.indexOf(selecionado);

  // O QUE O PAINEL MOSTRA de `conferirLista`, e a escolha é por leitor:
  //
  //   BLOCO selecionado — só o que aponta AQUELE bloco. Despejar a lista
  //     inteira faria o painel de um bloco bom mostrar o erro de outro.
  //   GATILHO selecionado — os de `indice: null`, que são da lista inteira e
  //     não têm nó em que acender.
  const problemasDoPainel = useMemo(() => {
    if (selecionado === ID_DO_GATILHO) return problemas.filter((p) => p.indice === null);
    if (indiceSelecionado === -1) return [];
    return problemas.filter((p) => p.indice === indiceSelecionado);
  }, [problemas, selecionado, indiceSelecionado]);

  // O bloco editado TROCA DE LUGAR NA LISTA sem mudar de posição: o painel
  // devolve um objeto novo, e ele entra no lugar do antigo.
  //
  // Pela IDENTIDADE, e não por `p.id`, pelo mesmo motivo de `moverBloco`: numa
  // lista anterior à Fase 1b todo bloco tem `id: undefined`, e comparar por
  // `p.id` casaria com todos de uma vez.
  //
  // NADA AQUI MEXE NA CHAVE `url` — quem decide isso é o painel, que só
  // escreve os campos que já existem no bloco (a convenção está em
  // `modelos.ts`, e a terceira casa dela é `painel.tsx`).
  const mudarPasso = useCallback(
    (novo: Passo) => {
      setPassos((atual) =>
        atual.map((p, i) => (identidadeDoPasso(p, i) === selecionado ? novo : p))
      );
    },
    [selecionado]
  );

  // Fechar o painel é DESSELECIONAR, e não um estado próprio de "aberto".
  //
  // Um `aberto` separado seria uma segunda fonte de verdade para a mesma
  // coisa: dava para ter um bloco com a borda acesa e o painel fechado, e o
  // clique seguinte no mesmo bloco não abriria nada — ele já estava
  // selecionado, e nenhuma mudança de seleção chegaria.
  const fecharPainel = useCallback(() => setSelecionado(null), []);

  // ------------------------------------------------------------------------
  // SALVAR — UMA CHAMADA SÓ, e não há mais ordem a escolher.
  //
  // Aqui havia duas: `salvarConfiguracao` e depois `salvarPassos`, nessa ordem
  // porque cada uma conferia a metade que enviava contra a metade que já estava
  // no banco. Nenhuma ordem servia. Configuração-primeiro recusava trocar o
  // gatilho apagando no mesmo salvamento o bloco que o gatilho novo não executa
  // (o gatilho era conferido contra os blocos velhos); passos-primeiro recusava
  // acrescentar o bloco que só o gatilho novo executa (a lista era conferida
  // contra o gatilho velho). O impasse é da divisão, não da ordem.
  //
  // `salvarAutomacao` (../actions.ts) leva as duas metades juntas, confere o PAR
  // FINAL uma vez e grava as duas dentro de uma transação. As duas transições
  // acima passam num clique só.
  //
  // NÃO HÁ MAIS SALVAMENTO PARCIAL A NOMEAR, e é por isso que o recado de "os
  // blocos foram salvos; o resto, não" saiu daqui em vez de virar código morto.
  // Ele descrevia o estado que duas escritas independentes produziam quando uma
  // falhava; com transação esse estado não existe — ou as duas valem, ou
  // nenhuma vale —, e uma frase que descreve o impossível só teria como
  // enganar.
  //
  // O RISCO DE O FORMULÁRIO VOLTAR PELA PORTA DOS FUNDOS continua endereçado, e
  // não pela separação das chamadas: `salvarAutomacao` grava `steps` COMO A
  // LISTA VEIO daqui e não deduz bloco nenhum de coluna nenhuma. Era a dedução
  // que apagava o fluxo montado no quadro, e ela morreu com `montarPassos`.
  const [salvando, iniciarSalvamento] = useTransition();

  // O RECADO CARREGA O QUADRO QUE ELE DESCREVE, e é isso que o faz morrer na
  // primeira mudança em vez de sobreviver até o clique seguinte em Salvar.
  //
  // "Salvo." sobrevivia a arrastar um bloco, apagar outro e trocar o gatilho: a
  // tela continuava afirmando em verde que o banco tinha aquilo, sobre um quadro
  // que já divergia dele. Numa tela cujo produto é montar e salvar várias vezes,
  // é o indicador mais fácil de acreditar — e era o mais fácil de estar errado.
  //
  // Guardadas as duas REFERÊNCIAS que foram enviadas, a validade do recado é
  // DERIVADA no render (`recadoDoQuadroAtual`, logo abaixo), sem efeito e sem
  // render extra: `setPassos` e `setConfiguracao` sempre produzem objetos novos,
  // então basta comparar por identidade. As duas entram porque as duas são
  // gravadas — `passos` vai para `steps`, `configuracao` vai para as colunas.
  //
  // Isso cobre de graça o que um efeito não cobriria: mexer no quadro DURANTE o
  // salvamento. O recado que chegar depois já nasce descrevendo uma lista que
  // não é mais a da tela, e por isso não aparece.
  const [recado, setRecado] = useState<{
    ok: boolean;
    texto: string;
    passos: Passo[];
    configuracao: Configuracao;
  } | null>(null);

  const recadoDoQuadroAtual =
    recado && recado.passos === passos && recado.configuracao === configuracao ? recado : null;

  const salvar = useCallback(() => {
    setRecado(null);
    iniciarSalvamento(async () => {
      const r = await salvarAutomacao(automationId, passos, configuracao);

      // O par enviado viaja junto com o recado, e é ele que decide se o recado
      // ainda descreve o quadro na hora de desenhar.
      const doQueFoiEnviado = { passos, configuracao };

      // A RECUSA NÃO PRECISA MAIS DIZER O QUE FOI GRAVADO, porque a resposta é
      // sempre a mesma: nada. O motivo vem do servidor e é mostrado como veio.
      setRecado(
        r.ok
          ? { ok: true, texto: "Salvo.", ...doQueFoiEnviado }
          : { ok: false, texto: `${r.erro} Nada foi salvo.`, ...doQueFoiEnviado }
      );
    });
  }, [automationId, configuracao, passos]);

  const tema = useTemaDoDocumento();

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------------------ */}
      {/* O AVISO NO CELULAR. O quadro precisa de arrastar e soltar, e não há */}
      {/* versão de toque dele — a decisão foi dizer isso em vez de entregar  */}
      {/* um editor que não funciona. A lista em modo leitura logo abaixo é o */}
      {/* que sobra de útil: dá para CONFERIR o fluxo no celular, só não      */}
      {/* mexer nele.                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40 sm:hidden">
        A edição das automações é pelo computador — o quadro precisa de arrastar e soltar. Abaixo, o
        fluxo desta automação em modo leitura.
      </div>
      <ol className="space-y-2 sm:hidden">
        {/* O MESMO CARTÃO DO NÓ DE GATILHO, pelas mesmas duas funções
            (`./gatilho`). Aqui se imprimia o NOME da automação sob o rótulo
            "GATILHO": o nome já está no cabeçalho da página, e o que dispara —
            a única coisa que o rótulo promete — era o que faltava. */}
        <li className="rounded-lg border-2 border-sky-500/70 bg-white px-3 py-2 dark:border-sky-400/70 dark:bg-zinc-900">
          <div className="text-[10px] font-semibold tracking-wide text-sky-600 dark:text-sky-400">
            GATILHO · {nomeDoGatilho(configuracao.gatilho)}
          </div>
          <div className="mt-1 text-xs text-zinc-700 dark:text-zinc-200">
            {resumoDasPalavras(configuracao.palavras)}
          </div>
        </li>
        {passos.map((p, i) => {
          // O MESMO `resumoDoBloco` do nó do quadro, e não um texto próprio:
          // duas descrições do mesmo bloco divergiriam, e esta é justamente a
          // que ninguém olha depois.
          const { titulo, corpo } = resumoDoBloco(p);
          return (
            <li
              key={identidades[i]}
              className={`rounded-lg border-2 bg-white px-3 py-2 dark:bg-zinc-900 ${
                errosPorIndice.has(i)
                  ? "border-red-500 dark:border-red-400"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <div className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
                {i + 1}. {titulo}
              </div>
              <div className="mt-1 text-xs text-zinc-700 dark:text-zinc-200">{corpo}</div>
            </li>
          );
        })}
        {!passos.length && (
          <li className={`rounded-lg border border-dashed border-zinc-300 p-3 text-xs dark:border-zinc-700 ${muted}`}>
            Nenhum bloco ainda.
          </li>
        )}
      </ol>

      {/* AS DUAS COLUNAS: a paleta ocupa uma faixa PRÓPRIA, e o React Flow o
          resto. Ela flutuava sobre o quadro, e o `fitView` não sabia disso — o
          mecanismo inteiro está no comentário de `./paleta`. */}
      <div className="relative hidden h-[calc(100vh-16rem)] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 sm:flex">
        <Paleta gatilho={configuracao.gatilho} />
        <div className="relative min-w-0 flex-1">
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
            // PADDING SIMÉTRICO, e é a paleta ter saído de cima do quadro que
            // permite isso. O `left: "200px"` que estava aqui compensava a faixa
            // coberta por ela, e essa compensação PARAVA DE VALER no `minZoom`: a
            // partir dali o conteúdo é só centralizado e o primeiro nó voltava para
            // debaixo da paleta, com os cliques chegando nela. O mecanismo inteiro
            // está no comentário de `./paleta`; aqui basta que a área do React Flow
            // seja toda dele.
            fitViewOptions={{ padding: "24px" }}
            // O PISO DO ZOOM DESCE DE 0,5 (o padrão do React Flow) PARA 0,2, e isto
            // é a segunda metade do mesmo defeito — a que a paleta em faixa própria
            // NÃO resolve.
            //
            // Medido nesta página, a 1440×900, com a área do quadro em 782px: com o
            // piso em 0,5, o `fitView` deixa de caber a partir de SETE blocos, e o
            // que sobra de fora é o começo da corrente — a 9 blocos, o nó de GATILHO
            // e o bloco 0 abriam fora da área visível. É o pior lugar possível para
            // esconder: o gatilho é o nó que a pessoa precisa clicar para dar nome à
            // automação, escolher as palavras-chave e marcá-la como ativa, e nada na
            // tela diz que ele está à esquerda.
            //
            // O PREÇO ESTÁ DITO: numa lista longa a abertura fica pequena demais para
            // LER os blocos. É troca deliberada — ver a forma inteira do fluxo e
            // aproximar é um gesto que os controles oferecem; descobrir que existe
            // conteúdo fora da tela não é.
            minZoom={0.2}
            // O TEMA DO PAINEL, e não `system`. Sem isto os controles nascem pretos
            // sobre fundo escuro; com `system` eles seguiriam o sistema operacional,
            // que não é quem decide o tema aqui. O motivo está em
            // `useTemaDoDocumento`, no topo do arquivo.
            colorMode={tema}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={17} />
            <Controls showInteractive={false} />
          </ReactFlow>
          {/* DEPOIS do quadro, e sobre ele: o painel é irmão do `ReactFlow`, não
              filho, para não virar mais um nó do que a biblioteca gerencia — e
              fechado ele não ocupa nada, então o quadro é inteiro. */}
          <Painel
            passo={indiceSelecionado === -1 ? null : passos[indiceSelecionado]}
            indice={indiceSelecionado}
            // A LISTA INTEIRA vai junto, e é por causa da prévia: ela desenha a
            // conversa toda, não só o bloco aberto. É o MESMO `passos` que os nós
            // usam — uma segunda cópia faria a prévia atrasar um render em relação
            // ao quadro, e o retorno ao vivo é a razão de ela existir.
            passos={passos}
            // A CONFIGURAÇÃO VAI SEMPRE, e não só quando o gatilho está
            // selecionado: a prévia precisa do gatilho para saber se a conversa
            // começa num comentário, numa resposta de story ou numa DM. Quem diz
            // que os CAMPOS da automação devem aparecer é `editandoGatilho`.
            configuracao={configuracao}
            editandoGatilho={selecionado === ID_DO_GATILHO}
            problemas={problemasDoPainel}
            aoMudar={mudarPasso}
            aoMudarConfiguracao={setConfiguracao}
            aoFechar={fecharPainel}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* O RODAPÉ. Só no computador, pelo mesmo motivo do quadro: não há o    */}
      {/* que salvar numa tela em que não dá para editar.                     */}
      {/*                                                                     */}
      {/* O BOTÃO DESABILITADO TRAZ O MOTIVO AO LADO. Botão apagado sem        */}
      {/* explicação é a tela dizendo "não" e nada mais — e o erro pode estar  */}
      {/* num bloco que nem está à vista. A frase é a MESMA de `conferirLista` */}
      {/* que o painel do bloco mostra, então o rodapé e o painel nunca dizem  */}
      {/* coisas diferentes sobre o mesmo problema.                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden flex-wrap items-center gap-3 sm:flex">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || erros.length > 0}
          className={btnPrimary}
        >
          {salvando ? "Salvando…" : "Salvar automação"}
        </button>
        <Link href="/automacoes" className={btnSecondary}>
          Voltar
        </Link>
        {erros.length > 0 ? (
          <span className="text-xs font-medium text-red-600 dark:text-red-400">
            {erros[0].mensagem}
            {erros.length > 1 && ` (e mais ${erros.length - 1})`}
          </span>
        ) : (
          recadoDoQuadroAtual && (
            <span
              className={`text-xs font-medium ${
                recadoDoQuadroAtual.ok
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {recadoDoQuadroAtual.texto}
            </span>
          )
        )}
      </div>
    </div>
  );
}
