"use client";
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { identidadeDoPasso, type Passo } from "@/lib/steps";
import No, { type DadosDoNo } from "./no";
import { arranjoAutomatico } from "./modelos";

const TIPOS_DE_NO = { bloco: No };

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
// `automationId` e `gatilho` fazem parte do contrato desde já, e não são lidos
// aqui de propósito — por isso não são desestruturados, para o lint não os
// acusar de esquecimento. `gatilho` é o segundo argumento de `conferirLista`
// (lib/steps.ts) e `automationId` é o que o salvar precisa; os dois entram em
// uso quando o painel (Tarefa 7) e a página (Tarefa 8) chegarem. Exigi-los na
// assinatura agora é o que garante que a página os passe desde a primeira
// montagem, em vez de a prop nascer opcional e ficar assim.
export default function Quadro({
  passosIniciais,
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

  const nos: Node[] = useMemo(
    () =>
      passos.map((p, i) => ({
        id: identidades[i],
        type: "bloco",
        position: p.pos ?? { x: 0, y: 0 },
        data: {
          passo: p,
          temErro: false,
          selecionado: identidades[i] === selecionado,
        } as DadosDoNo,
      })),
    [passos, identidades, selecionado]
  );

  // As setas SEMPRE ligam o bloco i ao i+1 do array. Não há edge que o usuário
  // possa criar ou apagar: `nodesConnectable` fica desligado, e o React Flow
  // deixa de oferecer o gesto de ligar.
  const setas: Edge[] = useMemo(
    () =>
      identidades.slice(0, -1).map((identidade, i) => ({
        id: `${identidade}->${identidades[i + 1]}`,
        source: identidade,
        target: identidades[i + 1],
        type: "smoothstep",
        animated: false,
      })),
    [identidades]
  );

  const aoMudarNos = useCallback(
    (mudancas: NodeChange[]) => {
      for (const m of mudancas) {
        // `!m.dragging` grava só quando o arraste TERMINA. Sem isso, cada
        // quadro de animação viraria um `setPassos` e a lista inteira seria
        // recriada dezenas de vezes por segundo.
        if (m.type === "position" && m.position && !m.dragging) {
          moverBloco(m.id, Math.round(m.position.x), Math.round(m.position.y));
        }
      }
    },
    [moverBloco]
  );

  return (
    <div className="h-[calc(100vh-13rem)] w-full rounded-xl border border-zinc-200 dark:border-zinc-800">
      <ReactFlow
        nodes={nos}
        edges={setas}
        nodeTypes={TIPOS_DE_NO}
        onNodesChange={aoMudarNos}
        onNodeClick={(_, no) => setSelecionado(no.id)}
        onPaneClick={() => setSelecionado(null)}
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
