"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  type Connection,
  type Node,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  apagarLigacoes,
  conferirLista,
  desligarBotao,
  desligarSenao,
  desligarERenumerar,
  identidadeDoPasso,
  ligar,
  partirLigacao,
  quandoDaChave,
  type Ligacao,
  type Passo,
} from "@/lib/steps";
import No, { type DadosDoNo } from "./no";
import Gatilho, { nomeDoGatilho, resumoDasPalavras, type DadosDoGatilho } from "./gatilho";
import Painel, { type Configuracao } from "./painel";
import Previa, { type ContaDaPrevia } from "./previa";
import { alcasDeSaida, arranjoAutomatico, blocoNovo, indiceDaAlca, resumoDoBloco } from "./modelos";
import Paleta from "./paleta";
import * as Geo from "./geometria";
import { salvarAutomacao } from "../actions";
import { btnPrimary, muted } from "../../ui";

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
// A REGRA QUE ORGANIZA ESTE ARQUIVO, e ela TROCOU NA TAREFA 6: o caminho é a
// LIGAÇÃO desenhada, e não mais a ordem do array. As setas saem de `ligacoes`;
// arrastar um nó continua mudando `pos` e NADA MAIS.
//
// O QUE A ORDEM DO ARRAY AINDA SIGNIFICA, e é exatamente uma coisa: `passos[0]`
// é a ENTRADA do fluxo, onde a caminhada começa quando o gatilho dispara. O
// porquê está por extenso em `conferirLista` e em `interpretar` (lib/steps.ts) —
// a alternativa, "a entrada é o bloco que ninguém aponta", não serve, porque um
// menu que volta para si mesmo tem seta chegando na entrada e o fluxo ficaria
// sem começo. Fora disso, a posição de um bloco no array não decide nada.
//
// A DEFESA CONTRA O EMPURRÃO ACIDENTAL CONTINUA VALENDO, e ela só mudou de
// alvo. Antes, um bloco empurrado três pixels podia REORDENAR o fluxo; hoje ele
// pode PARTIR uma ligação e se pôr no meio dela. O sintoma é o mesmo — o cliente
// recebe outra coisa, sem erro e sem aviso —, e a defesa é a mesma: soltar sobre
// uma seta só vale quando o gesto CONQUISTOU aquela seta (`alvoDoArraste`,
// ./geometria), e o alcance é curto.
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
  ligacoesIniciais,
  configuracaoInicial,
  conta,
}: {
  automationId: string;
  passosIniciais: Passo[];
  // AS SETAS GRAVADAS, já peneiradas por `ligacoesValidas` (lib/steps.ts) na
  // página. Elas chegam como prop pelo mesmo motivo de `passosIniciais`: quem lê
  // o banco é a página, e o quadro é quem edita.
  ligacoesIniciais: Ligacao[];
  configuracaoInicial: Configuracao;
  // A conta conectada, só para a prévia deixar de mostrar `sua_conta` e uma
  // inicial fixa. Ela ATRAVESSA este componente sem ser usada aqui — a página
  // já a tem, e consultá-la de novo lá embaixo seria uma ida ao banco a mais
  // para o mesmo dado.
  conta: ContaDaPrevia;
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

  // AS SETAS SÃO ESTADO, e é isso que a Tarefa 6 acrescenta ao quadro. São TRÊS
  // estados e uma gravação só: `passos` vai para a coluna `steps`, `ligacoes`
  // para a coluna `ligacoes`, `configuracao` para as colunas da automação — e os
  // três viajam juntos para `salvarAutomacao` (../actions.ts), que os confere
  // como um par final e os grava numa transação.
  //
  // SEPARADO DE `passos` de propósito: são duas listas com identidades
  // diferentes (uma de blocos, outra de setas), e guardar a seta dentro do bloco
  // de origem faria a ligação que aponta para um bloco apagado sumir do dado sem
  // ninguém decidir isso — é `desligarERenumerar` (lib/steps.ts) que decide, e
  // ela precisa da lista inteira para achar as setas que CHEGAM no bloco.
  const [ligacoes, setLigacoes] = useState<Ligacao[]>(ligacoesIniciais);

  const [configuracao, setConfiguracao] = useState<Configuracao>(configuracaoInicial);

  // A identidade do nó selecionado — de um bloco, ou `ID_DO_GATILHO`. É ela que
  // o painel lê para saber o que desenhar.
  const [selecionado, setSelecionado] = useState<string | null>(null);

  // Qual seta está sob o ponteiro durante um arraste — o ÍNDICE dela em
  // `ligacoes`. É o alvo dos DOIS gestos que partem uma ligação em duas — soltar
  // um item da paleta e soltar um bloco que já existe —, e é null quando o
  // ponteiro não está sobre nenhuma.
  const [setaSobEle, setSetaSobEle] = useState<number | null>(null);

  // QUAL SETA ESTÁ SELECIONADA — o ÍNDICE dela em `ligacoes`, e é o estado que
  // torna APAGAR UMA SETA um gesto que existe.
  //
  // Separado de `setaSobEle` porque são duas perguntas diferentes: aquele é "o
  // ponteiro está passando por cima desta seta DURANTE um arraste" e morre no
  // fim do gesto; este é "esta é a seta escolhida", e ele sobrevive ao clique
  // para o Delete ter em que agir. Os dois nunca acendem juntos — não se
  // arrasta um bloco e se clica numa seta ao mesmo tempo —, e é por isso que
  // podem dividir o mesmo destaque.
  //
  // ELE MORRE A CADA APAGAMENTO, e isso é obrigatório: a identidade da seta é o
  // ÍNDICE, então tirar uma renumera todas as que vinham depois. Guardar o
  // índice antigo faria o Delete seguinte apagar a vizinha.
  const [ligacaoSelecionada, setLigacaoSelecionada] = useState<number | null>(null);

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
      return Geo.setasAoAlcance(p, passos, medidas, identidades, ligacoes, ignorar);
    },
    [instancia, passos, medidas, identidades, ligacoes]
  );

  const setaSobOPonto = useCallback(
    (clientX: number, clientY: number, ignorar: number[]): number | null => {
      if (!instancia) return null;
      const p = instancia.screenToFlowPosition({ x: clientX, y: clientY });
      return Geo.setaSobOPonto(p, passos, medidas, identidades, ligacoes, ignorar);
    },
    [instancia, passos, medidas, identidades, ligacoes]
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
    (clientX: number, clientY: number, identidade: string): number | null => {
      if (!instancia) return null;
      const p = instancia.screenToFlowPosition({ x: clientX, y: clientY });
      return Geo.alvoDoArraste(
        p,
        passos,
        medidas,
        identidades,
        ligacoes,
        identidade,
        setasNoInicio.current
      );
    },
    [instancia, passos, medidas, identidades, ligacoes]
  );

  // Soltar num ponto vazio CRIA UM BLOCO SOLTO. Soltar sobre uma seta PARTE a
  // ligação em duas, com o bloco novo no meio.
  //
  // A INVARIANTE "TODO BLOCO ESTÁ SEMPRE NA CORRENTE" CAIU AQUI, por decisão
  // registrada na spec, e o que estava escrito neste lugar — "não existe bloco
  // solto" — passou a ser falso. Ela existia porque a ordem do array ERA o
  // fluxo: um bloco no array estava, por construção, entre dois outros. Com as
  // ligações, estar na lista não liga o bloco a nada.
  //
  // O ARGUMENTO ANTIGO CONTINUA VERDADEIRO E DEIXOU DE SER SUFICIENTE: sim,
  // bloco solto é um bloco que nunca roda. O que mudou é que agora existe quem
  // diga isso — `conferirLista` (lib/steps.ts) acusa "nenhuma seta chega neste
  // bloco a partir do começo do fluxo", como erro de ATIVAR. E o preço de manter
  // a invariante seria pior do que o que ela evitava: com braços de verdade, um
  // bloco arrastado para o quadro tem de ficar parado enquanto o dono decide de
  // onde ele sai; anexá-lo automaticamente no fim inventaria um caminho que
  // ninguém pediu.
  //
  // O BLOCO NOVO VAI SEMPRE PARA O FIM DO ARRAY, e nunca mais para o meio: a
  // posição no array deixou de significar ordem, e o único significado que
  // sobrou — `passos[0]` é a entrada — é justamente o que empurrar para o meio
  // poderia estragar. Anexando, a entrada nunca muda por causa de um arrasto.
  //
  // O bloco sai de `blocoNovo` e é ESPALHADO com `pos` por cima, e não montado
  // campo a campo: é isso que mantém a convenção da chave `url` (modelos.ts)
  // intacta na inserção — o `dm_link` chega com `url: ""` e continua com ela, e
  // os outros continuam sem a chave.
  const inserir = useCallback((chave: string, x: number, y: number, sobreSeta: number | null) => {
    // Arredonda como `moverBloco` — `screenToFlowPosition` devolve fracionário,
    // e sem isto os dois escritores de `pos` discordam: bloco arrastado grava
    // inteiro e bloco recém-inserido grava `73.00000000000001`. É cosmético (a
    // posição não decide nada), mas a inconsistência apareceu no banco.
    const bloco = { ...blocoNovo(chave), pos: { x: Math.round(x), y: Math.round(y) } };
    // A identidade do bloco novo é o id que `blocoNovo` acabou de sortear
    // (`novoIdDeBloco`), e `identidadeDoPasso` é quem a lê — em vez de um
    // `bloco.id!`, que seria uma promessa que o tipo não faz. O -1 é o índice de
    // reserva daquela função, e ele não colide com índice nenhum da lista.
    const identidade = identidadeDoPasso(bloco, -1);
    setPassos((atual) => [...atual, bloco]);
    if (sobreSeta !== null) setLigacoes((atual) => partirLigacao(atual, sobreSeta, identidade));
  }, []);

  // A ÁREA DO REACT FLOW, guardada só para achar o CENTRO DO QUE ESTÁ À VISTA
  // quando o bloco vem de um clique na paleta. Este é o retângulo exato do
  // quadro: a faixa da paleta fica fora dele (o porquê está em `./paleta`), de
  // modo que o centro daqui é o centro do que a pessoa está olhando, e não o de
  // uma área que inclui a barra de onde ela clicou.
  const areaDoQuadro = useRef<HTMLDivElement>(null);

  // CLICAR NUM ITEM DA PALETA CRIA O BLOCO, e ele cai no centro da área visível.
  //
  // Isto NÃO é uma segunda forma de criar bloco: os dois gestos terminam em
  // `inserir`, a mesma de sempre, e é ela quem monta o bloco, arredonda a
  // posição e o anexa no fim do array. A única coisa que o clique tem a mais é
  // que ninguém lhe deu um ponto — arrastar traz o ponteiro, clicar não —, e
  // essa conta é `Geo.lugarDoBlocoNovo`, pura e testada.
  //
  // `sobreSeta` é SEMPRE `null` aqui, e é decisão, não esquecimento: partir uma
  // ligação em duas é o significado de soltar EM CIMA de uma seta, e um clique
  // na paleta não mira coisa nenhuma. Se o centro da tela por acaso calhasse
  // sobre uma seta, aceitar isso seria reescrever o fluxo por coincidência —
  // exatamente a classe de defeito que `alvoDoArraste` (./geometria) existe para
  // fechar do outro lado.
  //
  // Sai sem fazer nada enquanto `instancia` for nula: ela chega no `onInit`, e
  // até lá não há como traduzir tela em coordenada do quadro. Na prática a faixa
  // e o quadro nascem juntos, então esta saída é a garantia de não inventar
  // posição, não um caso que se veja.
  const inserirNoCentro = useCallback(
    (chave: string) => {
      const area = areaDoQuadro.current;
      if (!area || !instancia) return;
      const r = area.getBoundingClientRect();
      const centro = instancia.screenToFlowPosition({
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      });
      const lugar = Geo.lugarDoBlocoNovo(centro, passos);
      inserir(chave, lugar.x, lugar.y, null);
    },
    [instancia, passos, inserir]
  );

  // PÔR UM BLOCO QUE JÁ EXISTE NO MEIO DE UMA SETA é soltá-lo SOBRE ELA, nunca
  // arrastá-lo pelo quadro.
  //
  // O GESTO É O MESMO DE ANTES E O SIGNIFICADO É OUTRO: ele reordenava o array,
  // e agora parte a ligação em duas (`partirLigacao`, lib/steps.ts). A mão de
  // quem usa não aprende nada novo; o que muda é o dado que sai.
  //
  // O gesto é explícito de propósito, e "explícito" é cobrado e não só
  // declarado: quem chama esta função é `alvoDoArraste`, que exige a seta ter
  // sido CONQUISTADA pelo gesto. Sem isso o empurrão acidental acontecia mesmo —
  // medido, com 4 pixels (ver `ALCANCE_DA_SETA` e `alvoDoArraste` em
  // `./geometria`).
  //
  // O ARRAY NÃO É MAIS TOCADO POR ESTE GESTO, e essa é a lógica que saiu: não há
  // mais `de`, `alvo` nem a correção do deslocamento que a remoção causava. A
  // posição do bloco na lista deixou de significar alguma coisa, então movê-lo
  // ali seria trabalho sem efeito — e mexer no array poderia trocar a ENTRADA do
  // fluxo, que é o único significado que a ordem guardou.
  const partirCom = useCallback((identidade: string, seta: number) => {
    setLigacoes((atual) => partirLigacao(atual, seta, identidade));
  }, []);

  // Apagar. A seleção some junto quando é o bloco apagado que estava
  // selecionado, senão o painel (Tarefa 7) ficaria aberto num bloco que acabou
  // de deixar de existir.
  //
  // Apaga UM bloco, achado pelo índice, e não todos os que casam com a
  // identidade: `conferirLista` (lib/steps.ts) trata id repetido como ERRO
  // justamente porque ele é produzível — duplicar um bloco é o gesto que o
  // produz —, e um `filter` por identidade apagaria os dois de uma vez.
  // AS SETAS QUE ENTRAM E SAEM DO BLOCO VÃO JUNTO, e é nesta tarefa que isso
  // passou a importar: até aqui o quadro não tinha ligações no estado, e apagar
  // um bloco não tinha seta a deixar para trás. Sem isto, o bloco anterior
  // ficaria com um caminho para um id que não existe mais — `interpretar` para
  // nele, e nada na tela mostra por quê, porque não há nó a desenhar.
  //
  // QUEM FAZ ISSO É `desligarERenumerar` (lib/steps.ts) E NÃO `desligarBloco`,
  // e a troca é a correção de uma seta fantasma que era GRAVADA NO BANCO.
  // `desligarBloco` sozinho só tira as setas do bloco que sai, e isso basta
  // enquanto a identidade é o `id`. Numa lista anterior à Fase 1b — nenhum
  // bloco com `id` — a identidade É a POSIÇÃO, então apagar um bloco RENOMEIA
  // todos os que vêm depois, e as setas que os citavam passam a citar o vizinho
  // ou ninguém. Medido: `[A,B,C]` sem id, setas `0→1` e `1→2`, apagando "0",
  // sobrava `{de:"1", para:"2"}` numa lista que só tem "0" e "1" — uma seta
  // saindo do último bloco para um bloco que não existe. Ela não é desenhada
  // (as setas sem os dois nós são descartadas no desenho), `ligacoesValidas` a
  // aceita porque a FORMA é válida, e `conferirLista` só acusa o bloco
  // "inalcançável", que é erro de ATIVAR e não trava o salvar. Ou seja: salvava
  // calada.
  //
  // O ÍNDICE É ACHADO AQUI FORA e passado adiante, e é por isso que este
  // `useCallback` depende de `passos`: as duas listas têm de ser cortadas no
  // MESMO ponto, e `setLigacoes` não enxerga a lista de blocos. Achar de novo lá
  // dentro seria a segunda cópia da busca.
  //
  // Apaga UM bloco, achado pelo índice, e não todos os que casam com a
  // identidade: `conferirLista` (lib/steps.ts) trata id repetido como ERRO
  // justamente porque ele é produzível — duplicar um bloco é o gesto que o
  // produz —, e um `filter` por identidade apagaria os dois de uma vez.
  const apagarBloco = useCallback(
    (identidade: string) => {
      const i = passos.findIndex((p, j) => identidadeDoPasso(p, j) === identidade);
      if (i === -1) return;
      setPassos((atual) => atual.filter((_, j) => j !== i));
      setLigacoes((atual) => desligarERenumerar(passos, atual, i));
      setSelecionado((s) => (s === identidade ? null : s));
      // O índice da seta escolhida também deixa de valer: a lista de ligações
      // acabou de mudar de tamanho. Ver `ligacaoSelecionada`.
      setLigacaoSelecionada(null);
    },
    [passos]
  );

  // O QUE ESTÁ ERRADO NA LISTA, pela MESMA função que o Server Action vai usar
  // para recusar o salvar (`conferirLista`, lib/steps.ts). Uma fonte só: a
  // borda vermelha do nó, o recado no painel e o bloqueio do salvar não têm
  // como discordar.
  //
  // Isto fecha o fio que a Tarefa 5 deixou solto: `temErro` era `false` fixo, e
  // a borda vermelha de `no.tsx` era código inalcançável.
  //
  // AS LIGAÇÕES ENTRAM AQUI DESDE A TAREFA 6, e metade das regras desta função
  // depende delas: "há anel", "este botão leva a algum lugar", "este bloco é
  // alcançável", "dá para chegar no link sem passar pelo portão". O quadro
  // chamava `conferirLista` com duas partes, e o padrão `[]` do terceiro
  // argumento deixava todas essas regras CALADAS — a tela conferia menos do que
  // o `toggleAutomation` do servidor conferia.
  //
  // A CHAVE DO DONO ENTRA AQUI NA TAREFA 9, e ela é a razão de a tela precisar
  // reagir na hora: o controle dela está no painel do gatilho, dois campos
  // acima. Sem esta dependência, marcar a caixa deixaria a borda vermelha do nó
  // e a vaga âmbar da barra dizendo o contrário do que o servidor vai decidir no
  // salvar — e o dono só descobriria fechando o quadro.
  const problemas = useMemo(
    () => conferirLista(passos, configuracao.gatilho, ligacoes, configuracao.entregaSemPortao),
    [passos, configuracao.gatilho, ligacoes, configuracao.entregaSemPortao]
  );

  // O QUE TRAVA O SALVAR — erro, E de `quando: "salvar"`. As duas metades da
  // condição são obrigatórias, e a segunda ESTAVA FALTANDO.
  //
  // A Tarefa 5 separou os problemas em duas portas: `salvar` é dado que o motor
  // NÃO CONSEGUE LER, `ativar` é fluxo que ele lê e entrega errado por montagem
  // pela metade. Sem `p.quando === "salvar"` aqui, o quadro trava o SALVAR num
  // erro de ATIVAR — o oposto exato do que aquela tarefa decidiu, e o oposto do
  // que `salvarAutomacao` (../actions.ts) faz, que filtra os dois campos.
  //
  // ERA INERTE E DEIXOU DE SER NESTA TAREFA: enquanto o quadro não mandava as
  // ligações, nenhuma regra de `quando: "ativar"` chegava a disparar aqui. Agora
  // chegam — e o estado em que TODO bloco recém-solto nasce (nenhuma seta chega
  // nele) é justamente um erro de ativar. Sem esta linha, arrastar um bloco
  // travaria o salvar do quadro inteiro.
  const erros = useMemo(
    () => problemas.filter((p) => p.nivel === "erro" && p.quando === "salvar"),
    [problemas]
  );

  // O QUE IMPEDE PUBLICAR, e não travar nada. Ele aparece na barra em âmbar,
  // porque é a única voz que a tela tem sobre o bloco solto e o botão sem
  // destino: `toggleAutomation` (../actions.ts) recusa ativar por causa deles, e
  // esse "não" acontece em OUTRA tela (a lista de automações), depois de o dono
  // ter fechado o quadro achando que terminou.
  const impedemAtivar = useMemo(
    () => problemas.filter((p) => p.nivel === "erro" && p.quando === "ativar"),
    [problemas]
  );

  // TODAS AS MENSAGENS DE ATIVAR, UMA POR LINHA, e é isso que vai para o `title`
  // da vaga âmbar. A vaga mostra a PRIMEIRA e conta o resto ("e mais 7"), e sem
  // isto não havia como ler as outras sete a não ser clicando bloco por bloco.
  //
  // POR QUE O `title` E NÃO MAIS ESPAÇO: a vaga é `max-w-[36ch] truncate` de
  // propósito — alargá-la empurra o nome da automação para fora da barra —, e
  // medido na tela agora ela corta menos da metade da primeira frase:
  // `scrollWidth` 661 em `clientWidth` 324. O `title` é o único lugar em que o
  // texto inteiro cabe sem mexer no layout.
  //
  // ELE CARREGAVA UMA FRASE GENÉRICA, "Isto não impede salvar, só publicar.", e
  // era o desperdício exato: passar o mouse sobre uma frase cortada não revelava
  // nada da frase. A explicação continua, agora como primeira linha, e as
  // mensagens vêm embaixo dela.
  //
  // NÃO É A FAIXA DA TAREFA 6b, e as duas continuam separadas: aquela é do
  // "salvo, mas ficou pausada" — uma MUDANÇA DE ESTADO, que o comentário dela
  // diz não poder ser silenciosa, e por isso não pode morar num `title`. Esta é
  // o detalhe de uma lista que a barra já mostra por cima, e ler o detalhe é
  // gesto de quem quer o detalhe.
  //
  // E ELE NÃO É O ÚNICO CANAL POR ESCOLHA, é por falta de outro: `errosPorIndice`
  // (abaixo) só acende a borda vermelha para `quando: "salvar"`, então nenhum nó
  // fica marcado por problema de ATIVAR. O porquê está lá, e continua valendo.
  //
  // O QUE FOI MEDIDO E O QUE NÃO FOI: no fluxo de teste, com os 8 problemas de
  // ativar que ele tem, o atributo sai com 745 caracteres em 10 linhas, e as 8
  // frases estão lá inteiras — o "(e mais 7)" da vaga passa a ser enumerável. O
  // que ESTE arquivo não tem como medir é a dica em si: ela é janela do sistema,
  // não entra no render, e não aparece em captura de tela. Uma lista muito maior
  // que esta pode esbarrar no limite do navegador, e isso fica sem medida.
  const detalheDeAtivar = useMemo(
    () =>
      [
        "Isto não impede salvar, só publicar.",
        "",
        ...impedemAtivar.map((p) => p.mensagem),
      ].join("\n"),
    [impedemAtivar]
  );

  // Só os ERROS DE SALVAR, e só os que apontam um bloco. Os de `indice: null`
  // são da lista inteira e não têm nó a acender.
  //
  // O `quando` ENTROU AQUI TAMBÉM, e esta é uma decisão diferente da de cima —
  // aquela é sobre travar, esta é sobre a COR. Pintar os dois níveis de vermelho
  // foi considerado e recusado com o critério medido nesta fase: sinal que
  // aparece em operação normal treina o dono a ignorá-lo. Todo bloco arrastado
  // para o quadro nasce sem seta chegando nele, e todo botão criado no painel
  // (Tarefa 7) nasce sem rótulo e sem destino — os três são erro de ATIVAR. Com
  // eles em vermelho, o quadro ficaria vermelho durante toda a montagem, e o
  // vermelho deixaria de apontar o bloco que de fato está quebrado.
  //
  // ELES NÃO FICAM MUDOS: aparecem na barra (`impedemAtivar`, acima), no painel
  // do bloco selecionado, e são o que a porta de ativar recusa.
  const errosPorIndice = useMemo(() => {
    const s = new Set<number>();
    for (const p of problemas)
      if (p.nivel === "erro" && p.quando === "salvar" && p.indice !== null) s.add(p.indice);
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
        correspondencia: configuracao.correspondencia,
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
        // O DELETE NÃO APAGA BLOCO, e a linha é o que segura isso: o quadro
        // passou a ter tecla de apagar por causa das SETAS, e a tecla do React
        // Flow apaga tudo o que estiver selecionado.
        //
        // A diferença entre os dois é o que se perde: uma seta apagada por
        // engano se redesenha arrastando a alça de novo; um bloco apagado leva
        // junto o texto, os botões e o endereço que alguém digitou, e não há
        // desfazer neste quadro. Apagar bloco continua sendo o botão do próprio
        // cartão — um clique deliberado, naquele bloco.
        deletable: false,
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
    configuracao.correspondencia,
  ]);

  // AS SETAS SÃO AS LIGAÇÕES GRAVADAS, uma a uma. Nada aqui é deduzido da ordem
  // do array — era `identidades[i] -> identidades[i + 1]`, e essa dedução é a
  // lógica que a Tarefa 6 tirou.
  //
  // O ID DA ARESTA É O ÍNDICE DA LIGAÇÃO, e não o par de blocos: duas ligações
  // idênticas são forma válida (`conferirLista` só acusa quando os DESTINOS
  // diferem), e um id montado a partir de origem e destino repetiria — que é
  // exatamente o que o React Flow não tolera. O índice é único por construção.
  //
  // `data.ligacao` CARREGA DE QUAL LIGAÇÃO A ARESTA É, e quem o lê é
  // `ligacaoDaSeta` (logo abaixo): as mudanças que o React Flow devolve trazem
  // só o ID da aresta, e é por este campo que selecionar e apagar chegam ao
  // índice em `ligacoes` sem comparar `de`, `quando` e `para` de novo. Ele
  // esteve escrito e sem leitor nenhum até o gesto de apagar existir.
  //
  // A LIGAÇÃO PARA UM BLOCO QUE NÃO ESTÁ NA LISTA NÃO VIRA ARESTA, e o descarte
  // é só de DESENHO — ela continua no estado e é gravada de volta. O React Flow
  // não desenha aresta sem os dois nós (ele registra um erro no console e a
  // ignora), e o dado continua sendo o que `conferirLista` julga. É forma que o
  // editor não produz: `desligarERenumerar` limpa as duas pontas ao apagar um
  // bloco, e renumera as que sobram quando a identidade é a posição.
  //
  // A ALÇA DE ORIGEM SAI DE `indiceDaAlca` (./modelos), a MESMA função que a
  // geometria usa para saber de que altura a seta parte. Duas contas separadas
  // fariam a seta ser desenhada de um ponto e o alvo do gesto medido em outro.
  const setas: Edge[] = useMemo(() => {
    const desenhadas: Edge[] = [];
    for (let i = 0; i < ligacoes.length; i++) {
      const l = ligacoes[i];
      const iDe = identidades.indexOf(l.de);
      if (iDe === -1 || !identidades.includes(l.para)) continue;
      const alcas = alcasDeSaida(passos[iDe]);
      desenhadas.push({
        id: `ligacao-${i}`,
        source: l.de,
        target: l.para,
        sourceHandle: alcas[indiceDaAlca(passos[iDe], l.quando)].chave,
        type: "smoothstep",
        animated: false,
        data: { ligacao: i },
        // A SELEÇÃO PRECISA VOLTAR PELA PROP, pelo mesmo motivo dos nós: as
        // arestas são CONTROLADAS, então o `selected` que o React Flow desenha
        // vem daqui e não de um rascunho interno. Sem esta linha, clicar numa
        // seta acenderia por um render e apagaria no seguinte.
        selected: ligacaoSelecionada === i,
        // `setaSobEle` guarda o índice da ligação, que é o mesmo número que
        // `partirLigacao` recebe: destaque e resultado leem a mesma coisa.
        //
        // A SELEÇÃO USA O MESMO DESTAQUE, e não uma cor própria: os dois estados
        // não coexistem (um é durante o arraste de um bloco, o outro é depois de
        // um clique), e o cinza que o `.selected` do React Flow pinta por padrão
        // é quase o mesmo cinza da seta comum — seleção invisível faria o Delete
        // parecer sorteio.
        style:
          setaSobEle === i || ligacaoSelecionada === i
            ? { stroke: "rgb(99 102 241)", strokeWidth: 3 }
            : undefined,
      });
    }

    if (!identidades.length) return desenhadas;

    // A SETA DO GATILHO ATÉ A ENTRADA. Ela não é uma ligação gravada e nunca
    // foi: a entrada do fluxo é `passos[0]`, e isso é regra, não dado (o porquê
    // está em `conferirLista`, lib/steps.ts). Ela existe para o quadro mostrar
    // por onde a caminhada começa.
    //
    // SOLTAR SOBRE ELA NÃO FAZ NADA, e o preço está dito porque é uma seta que a
    // tela desenha: a geometria só conhece as ligações, então o bloco solto ali
    // nasce solto, como em qualquer ponto vazio. Trocar a entrada é reordenar o
    // array, e nenhum gesto do quadro faz isso hoje.
    //
    // NEM SELECIONÁVEL NEM APAGÁVEL, e as duas linhas entraram junto com o
    // Delete: ela não é uma ligação gravada, então não há índice em `ligacoes`
    // para o apagamento alcançar. Selecionável, ela aceitaria o clique e o
    // Delete não faria nada — a tela oferecendo um gesto que não existe.
    return [
      {
        id: `${ID_DO_GATILHO}->${identidades[0]}`,
        source: ID_DO_GATILHO,
        target: identidades[0],
        type: "smoothstep",
        animated: false,
        selectable: false,
        deletable: false,
      },
      ...desenhadas,
    ];
  }, [identidades, passos, ligacoes, setaSobEle, ligacaoSelecionada]);

  // DE QUAL LIGAÇÃO É A ARESTA QUE O REACT FLOW ACABOU DE CITAR. As mudanças
  // (`EdgeChange`) trazem só o `id` da aresta, e o que o estado guarda é o
  // ÍNDICE em `ligacoes` — este é o tradutor entre os dois, e ele lê
  // `data.ligacao`, que é justamente o campo que a aresta carrega para isso.
  //
  // `null` para a seta do gatilho (ela não tem `data`) e para qualquer aresta
  // que não esteja mais na lista, o que acontece de verdade: o React Flow avisa
  // da remoção depois de a lista já ter mudado.
  const ligacaoDaSeta = useCallback(
    (id: string): number | null => {
      const i = setas.find((s) => s.id === id)?.data?.ligacao;
      return typeof i === "number" ? i : null;
    },
    [setas]
  );

  // APAGAR UMA SETA É O GESTO QUE FALTAVA, e sem ele um gesto normal deixava a
  // sessão inteira sem como gravar.
  //
  // O QUE ACONTECIA: redesenhar uma alça TROCA o destino (`ligar`, lib/steps.ts)
  // e nunca tira a seta. Então um bloco que deve TERMINAR o fluxo não tinha como
  // perder a saída dele, e a seta desenhada por engano que fecha um anel de
  // `sempre` — erro de SALVAR — não tinha como sair. As duas únicas saídas eram
  // apagar o bloco, que perde o conteúdo, e recarregar a página, que perde tudo
  // desde o último salvamento.
  //
  // A REGRA, e ela é mais estreita do que a primeira redação dizia: nenhum gesto
  // pode deixar o quadro SEM COMO SALVAR.
  //
  // A versão anterior desta frase dizia "nenhum gesto pode levar a um estado sem
  // volta", e era falsa dentro deste mesmo arquivo: `apagarBloco` é sem desfazer
  // POR ESCOLHA, e o comentário de `nos` (acima) diz isso com todas as letras.
  // Perder o texto de um bloco é caro e é aceito; ficar sem como gravar a sessão
  // inteira não é.
  //
  // A SELEÇÃO CHEGA POR AQUI, e não por `onEdgeClick`, pelo mesmo motivo pelo
  // qual a dos nós chega por `onNodesChange`: a caixa de seleção também
  // seleciona setas, e escrever o estado nos dois lugares faria a metade que
  // ninguém testa divergir.
  //
  // O APAGAMENTO É UMA LISTA E UMA CHAMADA SÓ (`apagarLigacoes`, lib/steps.ts),
  // porque uma leva pode trazer várias remoções e a identidade da seta é o
  // ÍNDICE: apagar de uma em uma faria a segunda remoção cair na vizinha.
  const aoMudarSetas = useCallback(
    (mudancas: EdgeChange[]) => {
      const apagadas: number[] = [];
      for (const m of mudancas) {
        if (m.type === "select") {
          const i = ligacaoDaSeta(m.id);
          if (i === null) continue;
          // Mesma regra da seleção dos nós: desselecionar só zera quando é a
          // seta que estava escolhida, porque numa troca chegam duas mudanças na
          // mesma leva e a ordem entre elas não é garantida.
          setLigacaoSelecionada((atual) => (m.selected ? i : atual === i ? null : atual));
        } else if (m.type === "remove") {
          const i = ligacaoDaSeta(m.id);
          if (i !== null) apagadas.push(i);
        }
      }
      if (apagadas.length) {
        setLigacoes((atual) => apagarLigacoes(atual, apagadas));
        // Os índices que sobram são outros depois disto. Ver `ligacaoSelecionada`.
        setLigacaoSelecionada(null);
      }
    },
    [ligacaoDaSeta]
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
  // A regra do arquivo não corre risco nenhum com isso: `moverBloco` continua
  // escrevendo só `pos`, e nada aqui toca em `ligacoes`.
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

  // APAGAR UM BOTÃO DO MENU. É o único gesto do painel que mexe nas DUAS listas,
  // e é por isso que ele mora aqui e não lá: o bloco perde o botão, e as
  // ligações perdem a seta daquele botão (`desligarBotao`, lib/steps.ts).
  //
  // O ARGUMENTO É O ÍNDICE NA LISTA DE `botoes`, e não o id, porque o botão
  // corrompido também tem de sair: `botoes: [null]` é a causa mais cara de
  // `botoesCrus` (ela derruba o lote de eventos inteiro no envio), e um elemento
  // sem id não teria como ser nomeado. O id ainda é lido — mas só para achar a
  // seta —, e um elemento sem id simplesmente não tem seta a apagar.
  //
  // O ÍNDICE DO BLOCO VEM DA SELEÇÃO, e é a mesma leitura que o painel usou para
  // desenhar aqueles campos: quem está com o painel aberto é quem clicou no ✕.
  //
  // AS SETAS QUE CHEGAM NO BLOCO NÃO SÃO TOCADAS, e as dos OUTROS botões
  // também não: o único caminho que deixou de existir é o daquele botão.
  //
  // A `senao` SAI COM O ÚLTIMO BOTÃO, e essa é a segunda edição de seta que este
  // gesto faz. Ela não é simetria: sem ela, dois cliques no ✕ deixam uma `senao`
  // órfã, e a medida está em `desligarSenao` (lib/steps.ts) — a órfã ESCONDE o
  // erro de bloco inalcançável, exatamente como a órfã de botão escondia, e o
  // quadro desenha a seta dela saindo da ALÇA DE CONTINUAÇÃO, cujo `seguinteDe`
  // é null. Seta desenhada prometendo caminho que o motor não percorre.
  //
  // QUEM RESPONDE "AINDA TEM ALÇA DE `senao`?" É `alcasDeSaida` (./modelos), e a
  // pergunta não é reescrita aqui como `botoes.length === 0`. As duas respostas
  // divergem, e o caso está medido em `alcasDeSaida`: `botoes: [null]` tem
  // comprimento 1 e NÃO produz alça nenhuma de botão, então o bloco volta à alça
  // de continuação com a lista ainda cheia. Perguntar à função que DESENHA a
  // alça é o que impede o dado e o desenho de discordarem.
  //
  // A PERGUNTA É FEITA AO BLOCO DEPOIS DO CORTE, e não ao de antes: é o que ele
  // vira que decide quais alças sobram.
  const apagarBotao = useCallback(
    (iBotao: number) => {
      const i = passos.findIndex((p, j) => identidadeDoPasso(p, j) === selecionado);
      if (i === -1) return;
      const bloco = passos[i];
      if (bloco.tipo !== "dm" || !Array.isArray(bloco.botoes)) return;
      const alvo = bloco.botoes[iBotao] as { id?: unknown } | null | undefined;
      if (alvo === undefined) return;

      const depois: Passo = { ...bloco, botoes: bloco.botoes.filter((_, k) => k !== iBotao) };
      setPassos((atual) => atual.map((p, j) => (j === i ? depois : p)));

      const idDoBotao = alvo?.id;
      const temSeta = typeof idDoBotao === "string" && !!idDoBotao;
      const perdeuOSenao = !alcasDeSaida(depois).some((a) => a.chave === "senao");
      if (temSeta || perdeuOSenao) {
        const idDoBloco = identidadeDoPasso(bloco, i);
        setLigacoes((atual) => {
          const semOBotao = temSeta
            ? desligarBotao(atual, idDoBloco, idDoBotao as string)
            : atual;
          return perdeuOSenao ? desligarSenao(semOBotao, idDoBloco) : semOBotao;
        });
        // O índice da seta escolhida deixa de valer quando a lista encolhe. Ver
        // `ligacaoSelecionada`, e é a mesma linha de `apagarBloco`.
        setLigacaoSelecionada(null);
      }
    },
    [passos, selecionado]
  );

  // LIGAR DOIS BLOCOS. É o gesto que a Tarefa 6 abriu, e ele é a outra metade de
  // `nodesConnectable` (lá embaixo).
  //
  // O QUE O REACT FLOW DEVOLVE é `sourceHandle` — o id da alça de onde o arrasto
  // partiu —, e é ele que diz QUAL caminho está sendo desenhado. `quandoDaChave`
  // (lib/steps.ts) o traduz de volta para a condição. Sem alça identificada não
  // há condição, e sem condição não há ligação a gravar: um `null` aqui seria
  // uma seta que a tela desenha e o motor não sabe percorrer.
  //
  // A SETA NOVA SUBSTITUI A QUE JÁ SAÍA DAQUELA ALÇA (`ligar`, lib/steps.ts), e
  // o porquê está lá: duas setas da mesma condição para destinos diferentes é
  // ERRO DE SALVAR, e essa é a forma que a substituição impede de nascer.
  //
  // O QUE A SUBSTITUIÇÃO NÃO PROMETE, e a frase que estava aqui prometia: que
  // NENHUM gesto produza um estado que o salvar recusa. Ela é falsa, e cada
  // metade tem hoje uma resposta própria.
  //
  //   O ANEL DE `sempre` CONTINUA PRODUZÍVEL — ligar de volta num bloco
  //     anterior "para recomeçar" fecha um, e soltar um bloco em cima de uma
  //     seta (`partirCom`, acima) também pode fechar. Ele é erro de SALVAR, e o
  //     recado da barra explica o que fazer com ele ("faça a volta passar por
  //     uma mensagem com botão"). O que faltava não era impedir: era ter como
  //     DESFAZER, e agora tem — a seta se seleciona e some com Delete
  //     (`aoMudarSetas`, acima). Impedir no gesto tiraria a explicação e daria
  //     em troca uma alça que não responde.
  //   A AUTO-LIGAÇÃO DE `sempre` É RECUSADA NO GESTO (`setaPermitida`, abaixo),
  //     e essa é a exceção medida. Ela também é anel, mas o desfazer não
  //     alcança: numa aresta com origem e destino no MESMO nó o traçado passa
  //     POR BAIXO do bloco. Medido com `getSmoothStepPath` (@xyflow/system, o
  //     mesmo que desenha o quadro) para um bloco em (60,60) com 190 de largura:
  //     `M250 105L270 105L40 105L60 105` (sem espaço antes dos `L` — é o retorno
  //     literal, conferido chamando a função), com o bloco cobrindo x de 60 a 250
  //     — sobram dois tocos de 20px, e o resto da seta fica atrás do cartão, que
  //     é opaco e come o clique. Aceitar essa é oferecer o desfazer no pior alvo
  //     do quadro.
  //
  // LIGAR UM BLOCO A ELE MESMO PELO BOTÃO CONTINUA PERMITIDO, e não é descuido:
  // o menu que volta para si mesmo ("quero outro") é o desenho que a Tarefa 3b
  // teve de proteger no motor, e ele é feito exatamente assim. Ele não fecha
  // anel nenhum — o motor para na mensagem e espera o toque —, então não trava
  // porta nenhuma, e redesenhar a alça troca o destino.
  //
  // O GATILHO FICA DE FORA DAS DUAS PONTAS, e a guarda não é hipotética: `ligar`
  // gravaria `de: "gatilho"` como se fosse um bloco, e nenhuma das duas metades
  // do sistema saberia o que fazer com esse id — `identidadeDoPasso` nunca o
  // produz, e `interpretar` não o acharia na lista. A tela não oferece o gesto
  // (o `Handle` de `./gatilho` vai com as três props em `false`, fixas), e esta
  // linha é o que segura o caso se alguém "uniformizar" aquele arquivo um dia.
  const ligarBlocos = useCallback((c: Connection) => {
    const quando = quandoDaChave(c.sourceHandle);
    if (!quando || !c.source || !c.target) return;
    if (c.source === ID_DO_GATILHO || c.target === ID_DO_GATILHO) return;
    setLigacoes((atual) => ligar(atual, c.source, quando, c.target));
  }, []);

  // A ÚNICA SETA QUE O GESTO RECUSA: a de `sempre` de um bloco para ELE MESMO.
  // O porquê — e a medida do traçado que passa por baixo do bloco — está no
  // comentário de `ligarBlocos`, logo acima.
  //
  // MORA EM `isValidConnection` E NÃO DENTRO DE `ligarBlocos`, e é uma escolha
  // por não ter duas cópias da regra: com ela aqui, o React Flow nem chega a
  // chamar `onConnect`, e a alça de destino perde a classe `valid` enquanto o
  // arrasto passa por cima dela. Repetir a mesma condição lá embaixo seria a
  // segunda cópia — a que discorda no dia em que uma das duas mudar.
  //
  // O PREÇO ESTÁ DITO: a recusa é calada, a seta simplesmente não aparece. É o
  // mesmo silêncio de qualquer conexão recusada pelo React Flow, e a alternativa
  // — aceitar — é a que deixa o dono sem como gravar.
  const setaPermitida = useCallback((c: Connection | Edge): boolean => {
    if (c.source !== c.target) return true;
    return quandoDaChave(c.sourceHandle)?.tipo !== "sempre";
  }, []);

  // Fechar o painel é DESSELECIONAR, e não um estado próprio de "aberto".
  //
  // Um `aberto` separado seria uma segunda fonte de verdade para a mesma
  // coisa: dava para ter um bloco com a borda acesa e o painel fechado, e o
  // clique seguinte no mesmo bloco não abriria nada — ele já estava
  // selecionado, e nenhuma mudança de seleção chegaria.
  const fecharPainel = useCallback(() => setSelecionado(null), []);

  // ------------------------------------------------------------------------
  // A ALTURA DA FAIXA DE EDIÇÃO, medida — e ela existe por UMA razão só: os
  // controles de zoom.
  //
  // A faixa é ancorada embaixo e COBRE o rodapé do quadro; os controles do
  // React Flow foram para o canto inferior DIREITO. Sem esta medida os dois
  // ocupam o mesmo canto, e abrir um bloco esconderia o zoom atrás da faixa —
  // o desenho aprovado põe os controles ENCOSTADOS no topo dela, não debaixo.
  //
  // ISTO NÃO É A MITIGAÇÃO QUE O DESENHO RECUSOU: um bloco do quadro continua
  // podendo ficar escondido atrás da faixa, que é o preço aceito de cobrir em
  // vez de empurrar. O que se resolve aqui é só o CONTROLE DA PRÓPRIA TELA não
  // cair atrás dela.
  //
  // `offsetHeight` e não `contentRect`: a faixa tem borda de cima, e o
  // `contentRect` do `ResizeObserver` não a conta — o controle ficaria um pixel
  // por baixo. Com a faixa fechada o `Painel` devolve `null`, a `div` medida
  // fica com 0 de altura, e os controles voltam para o canto.
  const faixaRef = useRef<HTMLDivElement>(null);
  const [alturaDaFaixa, setAlturaDaFaixa] = useState(0);
  useEffect(() => {
    const el = faixaRef.current;
    if (!el) return;
    const observador = new ResizeObserver(() => setAlturaDaFaixa(el.offsetHeight));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

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

  // ------------------------------------------------------------------------
  // O QUADRO TRAVA ENQUANTO SALVA, e isto fecha o único silêncio que sobrava
  // nesta tela.
  //
  // `salvar` (logo abaixo) captura `passos` e `configuracao` no CLIQUE, e o
  // quadro continuava editável durante a transição. Quem mexesse no meio gravava
  // a lista de ANTES — e o recado que voltasse seria suprimido justamente porque
  // o instantâneo não bate mais com a tela (`recadoDoQuadroAtual`, abaixo).
  // Resultado: o dono ficava olhando um quadro diferente do que foi gravado, com
  // NADA na tela dizendo isso. O pior dos dois mundos — a versão velha no banco e
  // nenhum aviso.
  //
  // DAS DUAS SAÍDAS — travar a edição, ou avisar que o gravado não é o que está
  // na tela —, esta é travar, e o motivo é que ela resolve a CAUSA em vez de
  // narrar a consequência: sem edição no meio, o instantâneo enviado é sempre
  // igual ao quadro quando a resposta chega, então o recado SEMPRE aparece. O
  // aviso, por outro lado, teria de descrever um estado ("o que está na tela não
  // foi salvo") que a pessoa não pediu e não pode desfazer.
  //
  // "SEMPRE APARECE" É SOBRE ESTA COMPARAÇÃO, e por um tempo a barra não
  // cumpriu a promessa por outro motivo: o recado dividia a vaga com o âmbar do
  // "impede publicar" num ternário exclusivo, e o âmbar está aceso durante toda
  // a montagem. Salvava e não aparecia nada. As duas vagas são separadas desde
  // então — o porquê está na barra, junto delas.
  //
  // `inert` E NÃO só um véu por cima: véu com `pointer-events` bloqueia o
  // ponteiro e deixa o TECLADO passar — o cursor pode estar dentro do campo de
  // mensagem do painel no instante do clique em Salvar, e continuar digitando ali
  // é edição no meio do salvamento, que é exatamente o que isto impede. `inert`
  // desliga ponteiro, teclado e foco de uma vez, e tira o ramo da árvore de
  // acessibilidade junto.
  //
  // O véu continua, com outra função: DIZER que travou. Travar sem explicar é a
  // tela ficando muda de outro jeito.
  //
  // ELE COBRE O PAINEL TAMBÉM, e não só o React Flow, porque o painel edita a
  // mesma lista e a mesma configuração — é por isso que ele veste a `div` que
  // contém os dois, e não o `ReactFlow` sozinho. Fora dele ficam o botão Salvar
  // (que já se desabilita), o "Voltar" e a paleta: arrastar da paleta não muda
  // nada sozinho, e o alvo do arrasto está inerte.
  //
  // A JANELA É CURTA — dura o Server Action —, e por isso não há estado novo a
  // guardar: `salvando` é o `isPending` da transição, e ele já existia.
  // ------------------------------------------------------------------------

  // O RECADO CARREGA O QUADRO QUE ELE DESCREVE, e é isso que o faz morrer na
  // primeira mudança em vez de sobreviver até o clique seguinte em Salvar.
  //
  // "Salvo." sobrevivia a arrastar um bloco, apagar outro e trocar o gatilho: a
  // tela continuava afirmando em verde que o banco tinha aquilo, sobre um quadro
  // que já divergia dele. Numa tela cujo produto é montar e salvar várias vezes,
  // é o indicador mais fácil de acreditar — e era o mais fácil de estar errado.
  //
  // Guardadas as TRÊS REFERÊNCIAS que foram enviadas, a validade do recado é
  // DERIVADA no render (`recadoDoQuadroAtual`, logo abaixo), sem efeito e sem
  // render extra: `setPassos`, `setLigacoes` e `setConfiguracao` sempre produzem
  // objetos novos, então basta comparar por identidade. As três entram porque as
  // três são gravadas — `passos` vai para `steps`, `ligacoes` para `ligacoes`,
  // `configuracao` para as colunas. Deixar as setas de fora faria "Salvo."
  // sobreviver a desenhar uma seta nova, que é a mesma mentira que esta
  // comparação existe para impedir.
  //
  // A COMPARAÇÃO CONTINUA VALENDO com o quadro travado, e ela não virou código
  // morto: ela é o que mata o "Salvo." na PRIMEIRA mudança DEPOIS do salvamento,
  // que é o caso comum e o motivo original dela. O que o `inert` acima tirou foi
  // o outro caso — mexer DURANTE —, e é bom que os dois estejam fechados por
  // mecanismos diferentes: se alguém tirar o travamento amanhã, isto aqui volta a
  // ser a única barreira e o recado volta a sumir, em vez de mentir.
  const [recado, setRecado] = useState<{
    ok: boolean;
    texto: string;
    passos: Passo[];
    ligacoes: Ligacao[];
    configuracao: Configuracao;
  } | null>(null);

  const recadoDoQuadroAtual =
    recado &&
    recado.passos === passos &&
    recado.ligacoes === ligacoes &&
    recado.configuracao === configuracao
      ? recado
      : null;

  const salvar = useCallback(() => {
    setRecado(null);
    iniciarSalvamento(async () => {
      const r = await salvarAutomacao(automationId, passos, ligacoes, configuracao);

      // O que foi enviado viaja junto com o recado, e é isso que decide se o
      // recado ainda descreve o quadro na hora de desenhar.
      const doQueFoiEnviado = { passos, ligacoes, configuracao };

      // A RECUSA NÃO PRECISA MAIS DIZER O QUE FOI GRAVADO, porque a resposta é
      // sempre a mesma: nada. O motivo vem do servidor e é mostrado como veio.
      //
      // `r.pausada` É A TAREFA 6b, e o `?? ""` do servidor nunca deveria
      // aparecer aqui: ela só vem preenchida vazia se `podeFicarAtiva`
      // recusou sem nenhum erro de ativar na lista, o que não deveria
      // acontecer — as duas funções leem o mesmo `problemas`. Truthy chega a
      // decidir o ramo mesmo assim, e uma string vazia cairia no "Salvo."
      // comum, que é a falha mais silenciosa das duas.
      //
      // A MUDANÇA DE ESTADO NÃO PODE SER SILENCIOSA: "cliquei em salvar com
      // Ativa marcada e ela voltou desmarcada" sem explicação é pior do que o
      // buraco que esta tarefa fecha. A frase diz as três coisas — que foi
      // salvo, que ficou pausada, e o que falta para poder ativar —, e o "o
      // que falta" é a MESMA frase que `conferirLista` produz e que o painel
      // do gatilho mostraria em âmbar: nunca um texto novo para o mesmo
      // problema.
      setRecado(
        r.ok
          ? {
              ok: true,
              texto: r.pausada ? `Salvo, mas ficou pausada: ${r.pausada}` : "Salvo.",
              ...doQueFoiEnviado,
            }
          : { ok: false, texto: `${r.erro} Nada foi salvo.`, ...doQueFoiEnviado }
      );
    });
  }, [automationId, configuracao, ligacoes, passos]);

  const tema = useTemaDoDocumento();

  return (
    // A JANELA INTEIRA, e o `<main>` da página mora aqui.
    //
    // A casca do aplicativo (`app/app-shell.tsx`) deixa esta rota passar sem
    // menu e sem `max-w`, e a página (`../[id]/page.tsx`) não tem mais
    // cabeçalho — então quem monta a tela toda é este componente. Como a casca
    // era quem desenhava o `<main>`, ele desce para cá: sem isso a página do
    // editor ficaria sem marco principal na árvore de acessibilidade.
    //
    // `h-dvh` E NÃO `h-screen`: no celular `100vh` conta a faixa da barra de
    // endereço do navegador, então a coluna fica MAIS ALTA que o visível e o
    // fim da lista em leitura (logo abaixo) cai atrás dessa barra, sem rolagem
    // que o alcance — o contêiner de rolagem é o filho, e ele já chegou ao fim.
    // `100dvh` é a altura que existe de verdade. No computador os dois são
    // iguais.
    <main className="flex h-dvh flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* A BARRA DO QUADRO. Ela é fina de propósito: cada pixel dela sai do   */}
      {/* quadro, que é o produto desta tela. Leva só o que se precisa         */}
      {/* enquanto se edita — o caminho de volta, o nome e o salvar.           */}
      {/*                                                                     */}
      {/* O CAMINHO DE VOLTA VEM PRIMEIRO E APARECE NO CELULAR TAMBÉM. Com a   */}
      {/* casca fora, este link é a ÚNICA saída desta tela: não há mais menu    */}
      {/* lateral no computador nem gaveta no celular. Some ele, e quem abriu   */}
      {/* uma automação pelo celular fica preso no aviso de "edite pelo         */}
      {/* computador" com o botão do navegador como única saída.                */}
      {/*                                                                     */}
      {/* O NOME SAI DE `configuracao.nome`, o estado, e NÃO de uma prop da     */}
      {/* página. É o mesmo valor que o painel do gatilho edita, então         */}
      {/* renomear a automação muda a barra na hora. Uma prop vinda da página   */}
      {/* seria uma segunda fonte de verdade congelada no que o banco tinha na  */}
      {/* abertura: o campo mostraria o nome novo e a barra o velho, até        */}
      {/* alguém salvar e recarregar.                                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/automacoes"
          className="shrink-0 text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
        >
          ← Automações
        </Link>
        <span className="truncate text-sm font-medium">{configuracao.nome}</span>

        {/* ---------------------------------------------------------------- */}
        {/* O SALVAR E O RECADO, e é AQUI que a lista de erros continua        */}
        {/* aparecendo — coisa que o passo 4 mandou decidir e justificar.      */}
        {/*                                                                   */}
        {/* Fica COLADO no botão pelo motivo que o rodapé já tinha: botão      */}
        {/* apagado sem explicação é a tela dizendo "não" e nada mais, e o     */}
        {/* erro pode estar num bloco que nem está à vista. E a barra é a      */}
        {/* única moldura que sobrou — deixar o recado só no painel do bloco   */}
        {/* esconderia o motivo justamente quando nenhum bloco está            */}
        {/* selecionado, que é o estado em que se clica em Salvar.             */}
        {/*                                                                   */}
        {/* A frase é a MESMA de `conferirLista` que o painel mostra, então os */}
        {/* dois nunca dizem coisas diferentes sobre o mesmo problema. O       */}
        {/* `max-w` com `truncate` é o que impede um erro comprido de empurrar */}
        {/* o nome da automação para fora da barra.                            */}
        {/*                                                                   */}
        {/* SÓ NO COMPUTADOR, pelo mesmo motivo do quadro: não há o que salvar */}
        {/* numa tela em que não dá para editar. O link de voltar, esse, fica  */}
        {/* nas duas.                                                          */}
        {/* ---------------------------------------------------------------- */}
        {/* SÃO DUAS VAGAS E NÃO UMA, e a segunda existe por um defeito medido.
            Isto era UM ternário exclusivo — erro, senão âmbar, senão recado —, e
            o âmbar tomava a vaga do recado PERMANENTEMENTE no caso mais comum
            que existe nesta tela.
            O mecanismo: o âmbar é o que impede PUBLICAR (bloco solto, botão sem
            destino), que é o estado normal de quem está montando, e ele NÃO
            desabilita o Salvar — a decisão de `actions.ts` é justamente essa,
            "montar um menu de três opções, ligar duas e voltar amanhã é trabalho
            normal". Com o âmbar aceso, o dono clicava em Salvar, o servidor
            gravava, o recado voltava — e a barra continuava mostrando o âmbar.
            Nada na tela dizia que o trabalho tinha sido guardado, exatamente no
            cenário que a permissão de salvar meio-caminho protege.
            O ERRO E O ÂMBAR CONTINUAM DISPUTANDO A MESMA VAGA, e essa metade do
            ternário fica: os dois falam da MESMA lista, e o vermelho é o que
            trava o Salvar — mostrar os dois seria a barra dizendo "não dá para
            salvar" e "dá para salvar, mas não publicar" ao mesmo tempo. */}
        <div className="ml-auto hidden shrink-0 items-center gap-3 sm:flex">
          {erros.length > 0 ? (
            <span className="max-w-[36ch] truncate text-xs font-medium text-red-600 dark:text-red-400">
              {erros[0].mensagem}
              {erros.length > 1 && ` (e mais ${erros.length - 1})`}
            </span>
          ) : (
            impedemAtivar.length > 0 && (
              /* O QUE IMPEDE PUBLICAR, EM ÂMBAR, e ele não desabilita o salvar.
                 Ele entrou nesta tarefa porque foi ela que tornou esses problemas
                 produzíveis pela tela: o bloco solto e o botão sem destino. Sem
                 esta linha, o dono monta, salva, fecha o quadro — e só descobre na
                 LISTA de automações, ao clicar em Ativar, que o fluxo não pode ir
                 ao ar. A frase é a MESMA de `conferirLista` que o painel e o
                 `toggleAutomation` mostram. */
              <span
                className="max-w-[36ch] truncate text-xs font-medium text-amber-600 dark:text-amber-400"
                title={detalheDeAtivar}
              >
                {impedemAtivar[0].mensagem}
                {impedemAtivar.length > 1 && ` (e mais ${impedemAtivar.length - 1})`}
              </span>
            )
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || erros.length > 0}
            className={btnPrimary}
          >
            {salvando ? "Salvando…" : "Salvar automação"}
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* O RECADO DO SALVAMENTO, EM LARGURA PRÓPRIA — e não mais um `<span>`
          na vaga que ele dividia com o nome da automação e os botões, na
          barra acima.

          A TAREFA 6b MEDIU A INCOMPATIBILIDADE: aquela vaga era `max-w-[36ch]
          truncate`, e o prefixo fixo "Salvo, mas ficou pausada: " sozinho já
          consome 26 dos 36 caracteres. Das frases que `conferirLista`
          (lib/steps.ts) produz para `nivel: "erro"` e `quando: "ativar"` — o
          que falta para poder ativar —, a mais curta soma 105 caracteres com
          esse prefixo, e a mais longa 175. Nenhuma cabia; truncar não
          encurtava o aviso, apagava o motivo por completo.

          "A MUDANÇA DE ESTADO NÃO PODE SER SILENCIOSA" é a frase que
          justifica esta mensagem existir (comentário de `salvar`, abaixo no
          arquivo) — um `<span>` que a corta de volta à ilegibilidade é a
          mesma falha por um caminho diferente. Por isso este é um bloco de
          LARGURA INTEIRA, sem `truncate`, no estilo do aviso do celular (mais
          abaixo nesta função): `rounded-lg border … p-3`, sem cortar texto.

          NÃO É UM `title`: passar o mouse para ler não é o oposto de
          silencioso, é a mesma informação escondida atrás de um gesto que
          "não pode ser silenciosa" não pede.

          CONTINUA SEPARADO da vaga de erro/âmbar da barra (o porquê de ela
          existir separada está no comentário "SÃO DUAS VAGAS", lá dentro do
          `<header>`) — só mudou de ficar ao lado do botão para ficar embaixo
          da barra inteira. E CONTINUA RESPONDENDO POR UM CLIQUE em Salvar, e
          não pela lista de blocos: por isso ele mora aqui, fora do
          `<header>` mas antes do quadro, e não dentro do painel do bloco
          selecionado — a mesma frase de `conferirLista` já aparece ali
          (`./painel.tsx`), completa e sem truncar, para o bloco que ela
          aponta. Esta cópia é a única no quadro; não crie uma terceira.

          SÓ NO COMPUTADOR, pelo mesmo motivo da barra: não há o que salvar
          numa tela em que não dá para editar. */}
      {recadoDoQuadroAtual && (
        <div className="hidden shrink-0 border-b border-zinc-200 bg-white px-4 py-2 sm:block dark:border-zinc-800 dark:bg-zinc-950">
          <p
            className={`rounded-lg border p-3 text-sm font-medium ${
              recadoDoQuadroAtual.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {recadoDoQuadroAtual.texto}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* O AVISO NO CELULAR. O quadro precisa de arrastar e soltar, e não há */}
      {/* versão de toque dele — a decisão foi dizer isso em vez de entregar  */}
      {/* um editor que não funciona. A lista em modo leitura logo abaixo é o */}
      {/* que sobra de útil: dá para CONFERIR o fluxo no celular, só não      */}
      {/* mexer nele.                                                         */}
      {/*                                                                     */}
      {/* A ROLAGEM É DESTA COLUNA, e não da página: o contêiner de fora tem  */}
      {/* altura fixa (`h-dvh`), então sem `overflow-y-auto` aqui a lista     */}
      {/* seria cortada no fim da tela sem jeito de chegar ao resto.          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:hidden">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
          A edição das automações é pelo computador — o quadro precisa de arrastar e soltar. Abaixo,
          os blocos desta automação em modo leitura. O caminho entre eles são as setas do quadro, e
          elas só aparecem no computador.
        </div>
        <ol className="space-y-2">
        {/* O MESMO CARTÃO DO NÓ DE GATILHO, pelas mesmas duas funções
            (`./gatilho`). Aqui se imprimia o NOME da automação sob o rótulo
            "GATILHO": o nome está na barra logo acima, e o que dispara — a
            única coisa que o rótulo promete — era o que faltava.

            ESTA LISTA NÃO É MAIS O FLUXO, e a numeração "1. 2. 3." saiu por
            isso: ela lê a ORDEM DO ARRAY, e a Tarefa 6 tirou dessa ordem o
            significado de "o que vem depois". O que sobrou é um INVENTÁRIO dos
            blocos, que continua servindo para conferir o que existe pelo
            celular — e é o que o aviso acima passou a dizer. Desenhar o fluxo de
            verdade aqui é caminhar pelas setas, que é o que a prévia
            (`./roteiro`) precisa aprender a fazer, e ela é outra tarefa. */}
          <li className="rounded-lg border-2 border-sky-500/70 bg-white px-3 py-2 dark:border-sky-400/70 dark:bg-zinc-900">
            <div className="text-[10px] font-semibold tracking-wide text-sky-600 dark:text-sky-400">
              GATILHO · {nomeDoGatilho(configuracao.gatilho)}
            </div>
            <div className="mt-1 text-xs text-zinc-700 dark:text-zinc-200">
              {resumoDasPalavras(configuracao.palavras, configuracao.correspondencia)}
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
                  {titulo}
                </div>
                <div className="mt-1 text-xs text-zinc-700 dark:text-zinc-200">{corpo}</div>
              </li>
            );
          })}
          {!passos.length && (
            <li
              className={`rounded-lg border border-dashed border-zinc-300 p-3 text-xs dark:border-zinc-700 ${muted}`}
            >
              Nenhum bloco ainda.
            </li>
          )}
        </ol>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AS DUAS COLUNAS DA TELA: à esquerda o quadro, à direita a prévia.   */}
      {/*                                                                     */}
      {/* `flex-1` no lugar do `h-[calc(100vh-16rem)]` que já esteve aqui: a   */}
      {/* única coisa acima é a barra, que tem altura própria e `shrink-0`.    */}
      {/* Subtrair uma constante da altura da janela era a conta que quebrava  */}
      {/* toda vez que alguém mexesse no que vem antes; `flex-1` é a mesma     */}
      {/* conta feita pelo navegador.                                          */}
      {/*                                                                     */}
      {/* A PRÉVIA É IRMÃ DO QUADRO, e não filha: ela vai da barra ao fim da   */}
      {/* janela, ao lado da paleta E do quadro. Dentro da coluna do quadro    */}
      {/* ela ficaria abaixo da faixa da paleta, e a faixa é do quadro.         */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden flex-1 overflow-hidden sm:flex">
        {/* A COLUNA DO QUADRO: a paleta em faixa própria no topo, e o React
            Flow no resto. A paleta já flutuou sobre o quadro, e o `fitView` não
            sabia disso — o mecanismo inteiro está no comentário de `./paleta`.

            `min-w-0` porque esta coluna é `flex-1` dentro de um flex: sem ele o
            conteúdo (a faixa da paleta, que rola na horizontal) definiria a
            largura mínima e empurraria a prévia para fora da janela. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* A PALETA TAMBÉM FICA INERTE ENQUANTO SALVA, e isto MUDOU com o
              clique. Ela ficava de fora, e o motivo escrito era que arrastar
              dela não muda nada sozinho — o alvo do arrasto é o quadro, e o
              quadro está inerte. Isso continua verdade para o ARRASTO e deixou
              de ser verdade para o item da faixa: clicar chama `inserirNoCentro`
              direto, sem passar pelo quadro, e acrescentaria um bloco no meio da
              gravação. O que seria gravado deixaria de ser o que está na tela,
              que é exatamente o que o `inert` do quadro existe para garantir. */}
          <Paleta gatilho={configuracao.gatilho} aoEscolher={inserirNoCentro} inerte={salvando} />
          {/* `inert` enquanto salva: o quadro e a faixa de edição param de
              aceitar ponteiro, teclado e foco, para o que for gravado ser o que
              está na tela. O porquê inteiro está no comentário acima de
              `recado`. */}
          <div ref={areaDoQuadro} className="relative min-w-0 flex-1" inert={salvando}>
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
                setasNoInicio.current = new Set(
                  p
                    ? setasAoAlcance(p.x, p.y, Geo.ligacoesDoBloco(ligacoes, no.id)).map((s) => s.i)
                    : []
                );
              }}
              // O DESTAQUE SEGUE A MESMA REGRA DO RESULTADO, e não só a proximidade.
              // Acender uma seta que o soltar vai recusar é a tela oferecendo um gesto
              // que não faz nada — a definição de ensinar a fazer errado, e o mesmo
              // motivo pelo qual `no.tsx` desliga as alças de conexão.
              onNodeDrag={(e, no) => {
                const p = pontoDoEvento(e);
                setSetaSobEle(p && alvoDoArraste(p.x, p.y, no.id));
              }}
              // O alvo é recalculado AQUI, e não lido de `setaSobEle`. Os dois dão o
              // mesmo resultado — mesma função, mesmo ponto —, e recalcular é o que
              // garante que a ordem não dependa de qual render chegou primeiro. O
              // estado fica só para o destaque na tela.
              onNodeDragStop={(e, no) => {
                const p = pontoDoEvento(e);
                const alvo = p && alvoDoArraste(p.x, p.y, no.id);
                setSetaSobEle(null);
                if (alvo !== null && alvo !== undefined) partirCom(no.id, alvo);
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
              // LIGAR DEIXOU DE SER PROIBIDO, e esta prop NÃO ALCANÇA AS ALÇAS
              // SOZINHA — o que era verdade quando ela desligava o gesto
              // continua verdade agora que ela o liga, e é importante que esteja
              // dito aqui, que é o arquivo que se lê primeiro.
              //
              // A prop chega ao NÓ, não à alça: o React Flow calcula
              // `isConnectable` no invólucro do nó e o entrega como PROP para o
              // componente, e cabe a ele repassá-la a cada `Handle`. Sem o
              // repasse, `Handle` cai no próprio padrão — que é `true` —, e foi
              // MEDIDO na Fase 1b que com ela em `false` o gesto acontecia
              // assim mesmo, alças acendendo e tudo. São DUAS pontas
              // (`isConnectableStart` e `isConnectableEnd`), porque quem porteia
              // o `onPointerDown` da alça é a primeira. O mecanismo inteiro está
              // no comentário de `no.tsx`.
              //
              // Ou seja: apagar as props do nó "porque o quadro já resolve" foi
              // e continua sendo o jeito de o desligamento (ou a permissão)
              // deixar de valer.
              nodesConnectable
              onConnect={ligarBlocos}
              isValidConnection={setaPermitida}
              onEdgesChange={aoMudarSetas}
              edgesFocusable={false}
              // A TECLA QUE APAGA A SETA SELECIONADA. Era `null`, e com ela
              // `null` não havia gesto nenhum para tirar uma seta do quadro —
              // redesenhar a alça só troca o destino. O que isso custava está no
              // comentário de `aoMudarSetas`.
              //
              // ELA SÓ ALCANÇA SETAS: todo nó vai com `deletable: false` (ver
              // `nos`, acima), então a tecla não apaga bloco nenhum. É por isso
              // que `Backspace` pode ficar na lista.
              //
              // DIGITAR NO PAINEL CONTINUA INTOCADO: o `useKeyPress` do React
              // Flow ignora o evento quando ele nasce dentro de um campo
              // (`isInputDOMNode`), então o Backspace que apaga uma letra no
              // texto da mensagem não chega aqui.
              deleteKeyCode={["Delete", "Backspace"]}
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
              // A MARCA DO REACT FLOW MUDA DE CANTO, e ela NÃO SAI —
              // `proOptions.hideAttribution` continua `false`.
              //
              // Ela nasce no canto inferior DIREITO (o padrão da biblioteca), que
              // é para onde os controles de zoom acabaram de ir. Medido na
              // biblioteca: `Attribution` recebe `position = 'bottom-right'`
              // quando `attributionPosition` não é passado, e os dois viram
              // `.react-flow__panel.bottom.right` — mesmo canto, um por cima do
              // outro. Ela vai para o canto que os controles desocuparam.
              attributionPosition="bottom-left"
            >
              <Background gap={17} />
              {/* OS CONTROLES DE ZOOM, no canto inferior DIREITO, subidos pela
                  altura da faixa de edição. Fechada a faixa, `alturaDaFaixa` é 0
                  e eles ficam no canto; aberta, eles encostam no topo dela em vez
                  de sumirem atrás. O porquê da medida está em `faixaRef`. */}
              <Controls
                showInteractive={false}
                position="bottom-right"
                style={{ bottom: alturaDaFaixa }}
              />
            </ReactFlow>
            {/* A FAIXA DE EDIÇÃO, ancorada embaixo e SOBRE o quadro: ela é irmã
                do `ReactFlow`, não filha, para não virar mais um nó do que a
                biblioteca gerencia — e fechada não ocupa nada, então o quadro é
                inteiro.

                ELA COBRE O RODAPÉ DO QUADRO em vez de encolhê-lo. Decisão do
                dono do produto, tomada vendo as duas no protótipo, e o preço
                está dito: um bloco lá embaixo pode ficar escondido atrás dela
                enquanto está aberta.

                Quem posiciona é esta `div`, e não o `aside` de dentro, porque é
                ela que o `ResizeObserver` mede — com o painel fechado o
                componente devolve `null` e a `div` fica com altura 0, que é o
                sinal de "faixa fechada" que os controles de zoom leem. */}
            <div ref={faixaRef} className="absolute inset-x-0 bottom-0 z-20">
              <Painel
                passo={indiceSelecionado === -1 ? null : passos[indiceSelecionado]}
                indice={indiceSelecionado}
                // A CONFIGURAÇÃO VAI SEMPRE, e não só quando o gatilho está
                // selecionado: é ela que os campos da automação editam. Quem diz
                // que esses campos devem aparecer é `editandoGatilho`.
                configuracao={configuracao}
                editandoGatilho={selecionado === ID_DO_GATILHO}
                problemas={problemasDoPainel}
                aoMudar={mudarPasso}
                aoApagarBotao={apagarBotao}
                aoMudarConfiguracao={setConfiguracao}
                aoFechar={fecharPainel}
              />
            </div>

            {/* O VÉU DIZ QUE TRAVOU. Quem trava é o `inert` da `div` de fora; este
                é o que impede a tela de ficar muda de outro jeito — um quadro que
                para de responder sem explicar é indistinguível de um quadro
                quebrado. `z-30` para ficar acima do painel, que é `z-20`. */}
            {salvando && (
              <div className="absolute inset-0 z-30 flex items-start justify-center bg-white/60 dark:bg-zinc-950/60">
                <span className="mt-6 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  Salvando… o quadro fica travado até terminar, para o que for gravado ser o que está
                  na tela.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* A PRÉVIA, EM COLUNA PRÓPRIA E SEMPRE VISÍVEL.                     */}
        {/*                                                                   */}
        {/* Ela morava no fim do painel do bloco, o que a fazia existir só     */}
        {/* enquanto havia um bloco selecionado — ou seja, ela sumia           */}
        {/* justamente no estado em que se olha para o fluxo inteiro e se      */}
        {/* clica em Salvar. Aqui ela é uma coluna da tela, ao lado do quadro. */}
        {/*                                                                   */}
        {/* A LARGURA É FIXA e cabe o celular: `./previa` desenha um aparelho  */}
        {/* de 300px com borda de 5px — 310px de fora a fora. Com `p-3` dos    */}
        {/* dois lados e a barra de rolagem, 352px é o que sobra sem cortar    */}
        {/* nem espremer. Fixa, e não proporcional, porque o que ela mostra    */}
        {/* tem largura própria: esticá-la só afastaria o celular do quadro.   */}
        {/*                                                                   */}
        {/* A ROLAGEM É DESTA COLUNA (`overflow-y-auto`): o contêiner de fora  */}
        {/* tem altura fixa, e uma conversa longa passa da altura da janela.   */}
        {/*                                                                   */}
        {/* ELA NÃO ENTRA NO `inert` DO SALVAMENTO, e a ausência é escolha: a  */}
        {/* prévia não edita nada — não há campo, botão nem foco nela —, então */}
        {/* não há como mexer na lista por aqui enquanto o salvar acontece. O  */}
        {/* que o `inert` protege é a EDIÇÃO, e ela está toda do outro lado.   */}
        {/* ---------------------------------------------------------------- */}
        <aside className="flex w-[352px] shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
            PRÉVIA DA CONVERSA
          </p>
          <p className={`mb-3 mt-1 text-xs leading-relaxed ${muted}`}>
            Como a lista fica para quem recebe, agora — antes de salvar.
          </p>
          {/* É O MESMO `passos` que os nós usam, e não uma cópia: uma segunda
              cópia faria a prévia atrasar um render em relação ao quadro, e o
              retorno ao vivo é a razão de ela existir. A configuração vai junto
              porque é o gatilho que decide se a conversa começa num comentário,
              numa resposta de story ou numa DM.

              E O MESMO `ligacoes`, pela mesma razão: a prévia mostra o CAMINHO
              até o bloco aberto, e caminho é pergunta sobre as setas. Uma seta
              recém-desenhada tem de trocar a conversa no mesmo render em que ela
              aparece no quadro.

              O GATILHO NÃO É BLOCO, e por isso vira `null` aqui: ele não tem
              cena a acender nem caminho a percorrer, e com ele selecionado a
              prévia mostra o caminho da entrada — que é o que ela já mostrava
              antes de haver seleção nenhuma. É a mesma tradução que
              `indiceSelecionado` faz para o painel, lá no alto do componente,
              junto dos problemas da conferência — umas novecentas linhas acima
              daqui, e não "logo acima" como esta frase já disse. */}
          <Previa
            passos={passos}
            gatilho={configuracao.gatilho}
            ligacoes={ligacoes}
            palavras={configuracao.palavras}
            correspondencia={configuracao.correspondencia}
            post={configuracao.post}
            story={configuracao.story}
            selecionado={selecionado === ID_DO_GATILHO ? null : selecionado}
            conta={conta}
          />
        </aside>
      </div>

      {/* O RODAPÉ SAIU. Ele tinha o mesmo botão de salvar, o mesmo recado e o
          mesmo "Voltar" que agora estão na barra — e salvar em dois lugares é
          ter dois lugares para discordarem. */}
    </main>
  );
}
