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

export default function Paleta({ gatilho }: { gatilho: string }) {
  return (
    <div className="absolute left-3 top-3 z-10 w-44 rounded-lg border border-zinc-200 bg-white/90 p-1.5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
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
