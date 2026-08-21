"use client";
import { PALETA } from "./modelos";
import {
  IconClock,
  IconCoracao,
  IconMail,
  IconMensagem,
  IconMensagemBotao,
  IconMensagemLink,
  IconMensagemOpcoes,
  IconPortao,
  IconRespostaPublica,
} from "../../icons";

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
// SÃO DOIS GESTOS PARA O MESMO FIM, e o clique é o que faltava.
//
// A faixa só respondia a ARRASTAR, e isso foi achado pelo dono do produto
// usando o editor: ele clicou num item para acrescentar um bloco de texto e não
// aconteceu nada — nem o bloco, nem aviso de que precisava arrastar. Medido no
// navegador: o `click` CHEGA no item (um ouvinte em captura o registrou) e a
// contagem de nós ficou em 7 antes e depois. Ou seja, não era evento perdido
// nem erro engolido: era ausência de `onClick`, e o item continuava mudo.
//
// Clicar chama `aoEscolher`, e quem decide ONDE o bloco cai é `quadro.tsx` — a
// paleta não conhece coordenada nenhuma. Arrastar continua sendo o gesto que
// ESCOLHE o lugar, e ele não mudou em nada: mesmo `draggable`, mesmo
// `onDragStart`, mesmo tipo de dado. Quem já aprendeu a arrastar não perde nada,
// e o `onDrop` do quadro é o único lugar que cria bloco a partir de um ponto.
//
// É `<button>` E NÃO `<div>`, agora que o clique existe. Um `div` que responde a
// clique é alcançável só pelo ponteiro: sem tabulação, sem Enter, sem Espaço, e
// anunciado como caixa sem papel. O `button` traz os três de graça, e o
// `type="button"` é o que impede o padrão `submit` de aparecer se um dia esta
// faixa cair dentro de um formulário. O `draggable` continua valendo — é
// atributo global de HTML, não privilégio de `div` —, e foi CONFERIDO no
// navegador depois da troca.
//
// O item que não serve para este gatilho fica com `aria-disabled` e sem ação, e
// NÃO com `disabled`: o atributo tiraria o item da tabulação, e com ele o motivo
// escrito no `title` — que é a única explicação de por que aquele desenho está
// apagado — deixaria de ser alcançável por teclado. Quem não pode usar o item é
// justamente quem mais precisa ler o porquê.
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

// O DESENHO DE CADA ITEM, pela chave — a mesma chave que `blocoNovo`
// (`./modelos`) lê para montar o bloco.
//
// O mapa mora AQUI e não em `./modelos` porque `modelos.ts` é dado puro, sem
// JSX: pôr componente lá obrigaria o arquivo a virar `.tsx` e arrastaria React
// para dentro do único módulo do editor que hoje é só a lista dos itens.
//
// DOIS ÍCONES SÃO REUSADOS e não novos — `IconClock` para a espera e
// `IconMail` para o pedido de e-mail. São os MESMOS que a prévia
// (`./previa`) já usa para a legenda de tempo e para a parada de e-mail, e um
// desenho novo ali só criaria um segundo símbolo para a mesma ideia. O motivo
// completo, e por que os outros sete precisaram nascer, está em `app/icons`.
const ICONE: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  dm: IconMensagem,
  dm_botao: IconMensagemBotao,
  dm_link: IconMensagemLink,
  dm_opcoes: IconMensagemOpcoes,
  esperar: IconClock,
  pedir_follow: IconPortao,
  pedir_email: IconMail,
  resposta_publica: IconRespostaPublica,
  reagir_story: IconCoracao,
};

// A PALETA É UMA FAIXA HORIZONTAL DE ÍCONES, no topo da coluna do quadro.
//
// Ela era uma coluna vertical de 176px à esquerda, com rótulo e descrição
// impressos. Passou a ser faixa por decisão do dono do produto, aprovada por
// protótipo: a coluna comia largura do quadro o tempo todo para mostrar nove
// frases que só importam no instante de escolher o bloco.
//
// O NOME E A DESCRIÇÃO NÃO SUMIRAM — foram para o `title`, que é onde o motivo
// de um item estar apagado já morava. `title` e não um balão próprio: ele é de
// graça, o navegador já o desenha, o leitor de tela já o anuncia, e um balão
// próprio seria superfície nova para mostrar um texto que ninguém precisa ler
// duas vezes.
//
// O RÓTULO CONTINUA NA ÁRVORE DE ACESSIBILIDADE, no `span` escondido: um ícone
// sozinho é uma caixa sem nome para quem não enxerga o desenho.
//
// ---------------------------------------------------------------------------
// A FAIXA FICA FORA DA ÁREA DO REACT FLOW, e isso não mudou com a horizontal.
//
// Ela já foi `absolute ... z-10` por cima da área do quadro, e isso produziu um
// defeito medido: o `fitView` enquadra o conteúdo na área INTEIRA, sem saber que
// uma parte dela está coberta. O contorno era um `padding` assimétrico nas
// opções do `fitView`, e ele PARA DE VALER quando o enquadramento bate no
// `minZoom` — a partir daí o conteúdo é só centralizado, e o primeiro nó cai na
// faixa da paleta. Não era só visual: `elementFromPoint` confirmou que o clique
// naquele nó chegava na paleta.
//
// Com a faixa fora da área do React Flow, o `fitView` enquadra exatamente o
// espaço que existe, em qualquer zoom. Quem monta a coluna é `quadro.tsx`.
// ---------------------------------------------------------------------------
//
// `inerte` chega de `quadro.tsx` e vale enquanto a automação está sendo gravada.
// Ele não existia enquanto a faixa só arrastava: o alvo do arrasto é o quadro, e
// o quadro já ficava inerte. Com o clique a faixa passou a mexer no estado
// SOZINHA, sem tocar no quadro, e sem isto um clique no meio da gravação
// acrescentaria um bloco que não estava na tela quando o salvar começou.
export default function Paleta({
  gatilho,
  aoEscolher,
  inerte,
}: {
  gatilho: string;
  aoEscolher: (chave: string) => void;
  inerte: boolean;
}) {
  return (
    <div
      inert={inerte}
      className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-zinc-200 bg-zinc-50/60 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/40"
    >
      <span className="shrink-0 text-[9px] font-semibold tracking-wider text-zinc-400">
        ARRASTE OU CLIQUE
      </span>
      <div className="flex items-center gap-1">
        {PALETA.map((item) => {
          // Numa constante local, e não `item.gatilhos` direto, porque é ela
          // que o TypeScript consegue estreitar no `title` lá embaixo — sem
          // isso a checagem exigiria um `!` para provar o que `serve` já sabe.
          const gatilhos = item.gatilhos;
          const serve = !gatilhos || gatilhos.includes(gatilho);
          const Icone = ICONE[item.chave] ?? IconMensagem;
          // O `title` leva SEMPRE o nome e a descrição, porque agora é o único
          // lugar onde eles existem. Quando o item está fora, o motivo entra
          // numa SEGUNDA LINHA em vez de substituir o nome: saber que aquele
          // desenho é o coraçãozinho continua valendo mesmo quando ele não
          // serve para este gatilho.
          const legenda = `${item.rotulo} — ${item.descricao}`;
          return (
            <button
              key={item.chave}
              type="button"
              draggable={serve}
              // A SEGUNDA ENTRADA CARREGA A CHAVE NO NOME DO TIPO, e o
              // conteúdo dela é vazio de propósito: `getData` só devolve
              // conteúdo no `drop`, e o quadro precisa saber QUAL item está
              // vindo já no `dragover`, que é quando ele acende (ou não) a seta
              // sob o ponteiro. A lista de TIPOS é legível o arrasto inteiro, e
              // é por ela que a resposta passa (`chaveArrastada`, ./quadro).
              //
              // A primeira entrada fica como estava, com o dado de verdade: é
              // ela que o `onDrop` lê, e é o tipo que o `onDragOver` confere
              // para recusar arquivo e texto arrastados de outra aba.
              onDragStart={(e) => {
                e.dataTransfer.setData("application/metodochat-bloco", item.chave);
                e.dataTransfer.setData(`application/metodochat-bloco+${item.chave}`, "");
                e.dataTransfer.effectAllowed = "move";
              }}
              // A guarda repete o que `draggable={serve}` e o cursor já dizem,
              // porque `aria-disabled` NÃO impede nada: ele só anuncia. Sem o
              // `return`, clicar num item apagado criaria o bloco que a faixa
              // acabou de dizer que não serve para este gatilho.
              onClick={() => {
                if (!serve) return;
                aoEscolher(item.chave);
              }}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                serve
                  ? "cursor-grab border-zinc-300 bg-white text-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  : "cursor-not-allowed border-dashed border-zinc-300 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700"
              }`}
              title={
                serve || !gatilhos ? legenda : `${legenda}\n${motivoDeEstarFora(gatilhos, gatilho)}`
              }
              aria-disabled={!serve}
            >
              <Icone className="h-[22px] w-[22px]" />
              <span className="sr-only">{item.rotulo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
