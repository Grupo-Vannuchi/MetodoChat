"use client";
import { Handle, Position } from "@xyflow/react";

// O gatilho é o primeiro nó, e ele é diferente dos outros em três coisas: não
// tem alça de ENTRADA (nada vem antes dele), não tem botão de apagar (sem
// gatilho não há automação), e não é arrastável para dentro da corrente.
//
// Ele ser um nó, e não um formulário acima do quadro, é o que faz a tela ser
// uma coisa só — a configuração da automação mora onde ela é lida.
//
// A COR É SKY, e a escolha é por distância das outras quatro que o quadro já
// usa (ver `no.tsx`): vermelho de erro, indigo de selecionado, âmbar do portão
// de follow e teal do pedido de e-mail. O gatilho não é bloco, e não pode ser
// confundido com nenhum deles.
export type DadosDoGatilho = {
  tipo: string;
  palavras: string[];
  selecionado: boolean;
};

const NOME = { dm: "DM", comment: "COMENTÁRIO", story: "STORY" } as const;

export default function Gatilho({ data }: { data: DadosDoGatilho }) {
  return (
    <div
      className={`w-[190px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 ${
        data.selecionado
          ? "border-indigo-500 dark:border-indigo-400"
          : "border-sky-500/70 dark:border-sky-400/70"
      }`}
    >
      <div className="text-[10px] font-semibold tracking-wide text-sky-600 dark:text-sky-400">
        GATILHO · {NOME[data.tipo as keyof typeof NOME] ?? data.tipo.toUpperCase()}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-zinc-200">
        {data.palavras.length ? `contém ${data.palavras.join(", ")}` : "qualquer mensagem"}
      </div>
      {/* Só a alça de SAÍDA. Ela não é conectável — quem porteia o gesto é
          `isConnectableStart`, e o padrão dela é `true` (o mecanismo inteiro
          está em `no.tsx`). Aqui as três vão fixas em `false` em vez de virem
          do invólucro: nada, nunca, se conecta a partir do gatilho à mão, e a
          seta que sai dele é derivada da lista como todas as outras. */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        isConnectableStart={false}
        isConnectableEnd={false}
        className="!h-2 !w-2 !bg-zinc-400"
      />
    </div>
  );
}
