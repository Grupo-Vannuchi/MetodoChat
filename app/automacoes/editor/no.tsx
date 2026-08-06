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
export type DadosDoNo = {
  passo: Passo;
  temErro: boolean;
  selecionado: boolean;
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
  const portao = data.passo.tipo === "pedir_follow" || data.passo.tipo === "pedir_email";

  const borda = data.temErro
    ? "border-red-500 dark:border-red-400"
    : data.selecionado
      ? "border-indigo-500 dark:border-indigo-400"
      : portao
        ? "border-amber-500/70 dark:border-amber-400/70"
        : "border-zinc-300 dark:border-zinc-700";

  return (
    <div
      className={`w-[190px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 ${borda}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        isConnectableStart={isConnectable}
        isConnectableEnd={isConnectable}
        className="!h-2 !w-2 !bg-zinc-400"
      />
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
