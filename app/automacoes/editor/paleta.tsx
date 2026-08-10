"use client";
import { PALETA } from "./modelos";

// Os itens que dá para pôr no quadro.
//
// Os dependentes de gatilho aparecem DESABILITADOS em vez de sumirem: sumir
// esconderia que a opção existe, e o dono ficaria procurando por que o
// coraçãozinho não está na lista. Desabilitado com o motivo escrito responde a
// pergunta antes de ela ser feita.
//
// E o MOTIVO é o `title` de `motivoDeEstarFora`, não a descrição do item. O
// `title` já foi `item.descricao` — a mesma frase que está impressa logo abaixo
// do rótulo, dois pixels dali. Repetir o que a pessoa acabou de ler não explica
// por que aquele item está apagado; o motivo é a comparação entre o gatilho
// DESTA automação e os gatilhos que o bloco atende, e é isso que a frase diz.
//
// O TIPO DO ARRASTO é `application/metodochat-bloco`, e o nome próprio não é
// enfeite: o quadro é uma área que aceita soltura, e o navegador manda para ela
// tudo que for arrastado por cima — arquivo, imagem, trecho de texto de outra
// aba. Lendo um tipo que só esta paleta escreve, o `onDrop` do quadro sai sem
// fazer nada em tudo que não veio daqui, em vez de criar um bloco a partir de
// um pedaço de texto qualquer.
// O nome do gatilho na língua de quem monta a automação. O `??` cobre gatilho
// que a lista não conheça: melhor mostrar o nome cru do que não mostrar motivo.
const NOME_DO_GATILHO: Record<string, string> = {
  dm: "mensagem direta",
  comment: "comentário",
  story: "resposta de story",
};

function nomeDoGatilho(g: string): string {
  return NOME_DO_GATILHO[g] ?? g;
}

// Por que este bloco está apagado — a frase inteira, e não o rótulo do item.
//
// `gatilhos` não-nulo é o que torna o item dependente; quando ele é nulo o item
// serve sempre e esta função nem é chamada.
function motivoDeEstarFora(gatilhos: string[], gatilho: string): string {
  const atende = gatilhos.map(nomeDoGatilho).join(" ou ");
  return `Este bloco só roda no gatilho de ${atende}, e esta automação é disparada por ${nomeDoGatilho(gatilho)}.`;
}

// A PALETA OCUPA UMA FAIXA PRÓPRIA, e não flutua mais sobre o quadro.
//
// Ela era `absolute left-3 top-3 z-10` por cima da área do React Flow, e isso
// produziu um defeito medido: o `fitView` enquadra o conteúdo na área INTEIRA,
// sem saber que uma parte dela está coberta. O contorno era um `padding.left` de
// 200px nas opções do `fitView`, e ele PARA DE VALER quando o enquadramento bate
// no `minZoom` — a partir daí o conteúdo é só centralizado, e o primeiro nó cai
// na faixa da paleta. Não era só visual: `elementFromPoint` confirmou que o
// clique naquele nó chegava na paleta.
//
// Com a faixa fora da área do React Flow, o `fitView` enquadra exatamente o
// espaço que existe, em qualquer zoom, e não há padding assimétrico a ajustar.
// Quem monta o par de colunas é `quadro.tsx`.
export default function Paleta({ gatilho }: { gatilho: string }) {
  return (
    <div className="h-full w-44 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50/60 p-1.5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="px-1.5 pb-1 text-[9px] font-semibold tracking-wider text-zinc-400">
        ARRASTE PARA O QUADRO
      </div>
      {PALETA.map((item) => {
        const serve = !item.gatilhos || item.gatilhos.includes(gatilho);
        return (
          <div
            key={item.chave}
            draggable={serve}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/metodochat-bloco", item.chave);
              e.dataTransfer.effectAllowed = "move";
            }}
            className={`rounded px-1.5 py-1 text-xs ${
              serve
                ? "cursor-grab text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
            }`}
            title={serve || !item.gatilhos ? "" : motivoDeEstarFora(item.gatilhos, gatilho)}
          >
            <div>{item.rotulo}</div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{item.descricao}</div>
          </div>
        );
      })}
    </div>
  );
}
