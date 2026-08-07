"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Passo } from "@/lib/steps";
import { resumoDoBloco } from "./modelos";

// Um bloco no quadro.
//
// UMA alça de saída, e isso é a decisão central desta fase, não uma limitação
// que ficou faltando: o motor não sabe ramificar. Quem vê duas alças desenha
// duas setas, e a segunda não roda — a tela teria ensinado a fazer errado.
// Quando a ramificação chegar, a segunda alça aparece AQUI e nada mais muda.
// A IDENTIDADE vem no `data` e o botão de apagar a devolve, em vez de `passo.id`.
//
// `passo.id` é OPCIONAL (lib/steps.ts), e numa lista anterior à Fase 1b ele é
// `undefined` em TODO bloco. Um `data.passo.id!` aqui viraria
// `aoApagar(undefined)` no quadro, e o filtro de lá — que compara identidade —
// não acharia bloco nenhum: o botão não faria nada, sem erro. Pior: um filtro
// escrito como `p.id !== id` apagaria a lista inteira de uma vez, porque
// `undefined !== undefined` é falso para todos.
//
// A identidade é a mesma de `identidadeDoPasso`: o id quando ele existe, o
// índice em texto quando não. É a que o quadro já usa como id do nó, então o
// que o botão apaga é exatamente o nó em que ele está.
export type DadosDoNo = {
  passo: Passo;
  identidade: string;
  temErro: boolean;
  selecionado: boolean;
  aoApagar: (identidade: string) => void;
};

// AS TRÊS PROPS DE CONEXÃO DA ALÇA, e por que não basta o `nodesConnectable`
// do quadro. Isto foi medido, não deduzido.
//
// `nodesConnectable={false}` (quadro.tsx) chega ao NÓ, não à alça: o React Flow
// calcula `isConnectable` no invólucro do nó e o entrega como PROP para o
// componente do nó — cabe a ele repassá-la. Sem o repasse, `Handle` cai no
// próprio padrão, que é `isConnectable = true`, e o desligamento do quadro não
// surte efeito nenhum.
//
// E `isConnectable` sozinha também não bastaria, porque ela só decide CLASSE
// de CSS. Quem porteia o gesto é `isConnectableStart` — o `onPointerDown` da
// alça testa ela, e ela também tem padrão `true`. Com as duas soltas, arrastar
// a partir de uma alça ABRIA uma conexão de verdade: as alças acendiam
// `connectingfrom` e `connectingto`, exatamente o gesto que o comentário acima
// diz não existir. Nenhuma seta chegava a nascer — não há `onConnect`, e as
// setas são derivadas do array —, e é justamente esse o estrago: a tela
// oferecia um gesto que não faz nada, que é a definição de ensinar a fazer
// errado.
//
// Repassadas as três, o desligamento vale de ponta a ponta, e o dia em que a
// ramificação chegar continua sendo "mexe só aqui": basta o quadro ligar
// `nodesConnectable` e as alças acompanham sozinhas.
export default function No({ data, isConnectable }: NodeProps & { data: DadosDoNo }) {
  const { titulo, corpo } = resumoDoBloco(data.passo);

  // ÂMBAR É SÓ DO `pedir_follow`, e a diferença não é estética.
  //
  // Os dois pintados de âmbar era a tela prometendo uma proteção que só existe
  // para UM deles. A regra do portão (`atravessandoOPortao`, lib/steps.ts) cobre
  // `pedir_follow` e mais nada: quando uma retomada cai adiante dele, o fluxo
  // volta e o avalia. O `pedir_email` não tem nada disso — numa lista
  // `[pedir_email, resposta rápida, link]`, quem está parado na resposta rápida
  // toca no botão e cai no LINK, com o e-mail nunca capturado.
  //
  // Isso é ESCOPO, não defeito: a decisão foi cobrir só o follow, porque é o
  // follow que sustenta a promessa central do produto. Mas quem monta a
  // automação não pode concluir da COR que os dois barram do mesmo jeito. Âmbar
  // = ninguém passa sem cumprir; verde-azulado = pede uma informação e para até
  // recebê-la, mas quem chegar do outro lado por outro caminho passa.
  //
  // A cor do e-mail é TEAL e não violeta, e a escolha é por distância do
  // indigo da seleção: o bloco selecionado já é indigo, e um violeta ao lado
  // dele viraria "qual destes está selecionado?". Teal não colide com nenhuma
  // das outras quatro — vermelho (erro), indigo (selecionado), âmbar (portão),
  // cinza (o resto) — nem com o sky que o nó de gatilho vai usar na Tarefa 7.
  //
  // `pedir_email` PARA o fluxo do mesmo jeito (`esperaResposta` diz sim aos
  // dois), e é por isso que ele também não fica cinza como uma mensagem comum:
  // o que muda entre os dois é a proteção, não a parada.
  const barraDeVerdade = data.passo.tipo === "pedir_follow";
  const pedeInformacao = data.passo.tipo === "pedir_email";

  const borda = data.temErro
    ? "border-red-500 dark:border-red-400"
    : data.selecionado
      ? "border-indigo-500 dark:border-indigo-400"
      : barraDeVerdade
        ? "border-amber-500/70 dark:border-amber-400/70"
        : pedeInformacao
          ? "border-teal-500/70 dark:border-teal-400/70"
          : "border-zinc-300 dark:border-zinc-700";

  return (
    <div
      className={`group relative w-[190px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 ${borda}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        isConnectableStart={isConnectable}
        isConnectableEnd={isConnectable}
        className="!h-2 !w-2 !bg-zinc-400"
      />
      <button
        type="button"
        onClick={(e) => {
          // Sem isto o clique também seleciona o nó, e o painel abre para um
          // bloco que acabou de deixar de existir.
          e.stopPropagation();
          data.aoApagar(data.identidade);
        }}
        // `onPointerDown` também é contido, e não é redundância com o
        // `stopPropagation` do clique: quem começa o arraste do nó é o
        // `pointerdown`, não o `click`. Sem esta linha, apertar o botão já
        // arma o gesto de arrastar o bloco, e um tremido de um pixel entre
        // apertar e soltar move o nó em vez de apagá-lo.
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -right-2 -top-2 hidden h-5 w-5 rounded-full border border-zinc-300 bg-white text-xs leading-none text-zinc-500 group-hover:block hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Apagar bloco"
      >
        ✕
      </button>
      <div className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
        {titulo}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-zinc-200">{corpo}</div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        isConnectableStart={isConnectable}
        isConnectableEnd={isConnectable}
        className="!h-2 !w-2 !bg-zinc-400"
      />
    </div>
  );
}
