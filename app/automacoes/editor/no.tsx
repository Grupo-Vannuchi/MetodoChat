"use client";
import { Fragment, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import type { Passo } from "@/lib/steps";
import { alcasDeSaida, resumoDoBloco } from "./modelos";
import { fracaoDaAlca } from "./geometria";

// Um bloco no quadro.
//
// UMA ALÇA DE SAÍDA POR CAMINHO, e não mais uma só. Aqui esteve escrito que a
// alça única era "a decisão central desta fase", porque o motor não sabia
// ramificar e duas alças ensinariam a fazer errado. As cinco tarefas de motor
// desta fase acabaram com essa limitação: `ligacaoEscolhida` (lib/steps.ts) casa
// o toque com a ligação daquele botão, e uma `dm` carrega vários botões.
//
// QUEM DIZ QUANTAS ALÇAS é `alcasDeSaida` (./modelos), e o rótulo de cada uma
// fica à vista ao lado dela: sem o rótulo, um menu de três botões viraria três
// pontinhos idênticos, e ligar o botão errado seria um erro que a tela não
// deixaria ver.
//
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
// O QUADRO LIGOU `nodesConnectable` NA TAREFA 6, e o repasse continua sendo o
// que faz o gesto alcançar a alça — agora no sentido de PERMITIR. As três props
// não são simetria de estilo: sem `isConnectableStart` o `onPointerDown` da alça
// cairia no padrão, e o que muda de dono é só quem está ligado ou desligado.
export default function No({ id, data, isConnectable }: NodeProps & { data: DadosDoNo }) {
  const { titulo, corpo } = resumoDoBloco(data.passo);

  // AS ALÇAS DE SAÍDA DESTE BLOCO. `alcasDeSaida` decide quantas e quais; aqui
  // só se desenha.
  const alcas = alcasDeSaida(data.passo);

  // O REACT FLOW MEDE AS ALÇAS UMA VEZ, no DOM, e guarda o resultado. Trocar o
  // conjunto de alças sem avisá-lo deixa as setas presas às posições antigas —
  // ou sem posição nenhuma, para a alça que acabou de nascer. `useUpdateNodeInternals`
  // é o aviso, e ele existe para exatamente isto.
  //
  // A DEPENDÊNCIA É A LISTA DE CHAVES EM TEXTO, e não o array: `alcas` é recriado
  // a cada render, então um array na lista de dependências dispararia o efeito
  // sempre. As chaves são o que de fato muda quando um botão é acrescentado,
  // apagado ou reordenado no painel (Tarefa 7).
  const chavesDasAlcas = alcas.map((a) => a.chave).join("|");
  const atualizarInternos = useUpdateNodeInternals();
  useEffect(() => {
    atualizarInternos(id);
  }, [id, chavesDasAlcas, atualizarInternos]);

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
    // A ALTURA MÍNIMA CRESCE COM O NÚMERO DE ALÇAS, e ela não é enfeite: as alças
    // são distribuídas ao longo da altura do bloco (`fracaoDaAlca`), então num
    // bloco baixo com cinco botões elas nasceriam empilhadas com dois pixels
    // entre uma e outra — impossíveis de mirar, e com os rótulos por cima uns
    // dos outros. 22 pixels por alça é o que separa duas linhas do rótulo.
    <div
      className={`group relative w-[190px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 ${borda}`}
      style={alcas.length > 1 ? { minHeight: alcas.length * 22 + 16 } : undefined}
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
      {/* AS ALÇAS DE SAÍDA, uma por caminho.

          A ALTURA DE CADA UMA SAI DE `fracaoDaAlca` (./geometria), e é a MESMA
          conta que a mira do gesto de soltar usa para saber onde a seta começa.
          Escrever a fração aqui à mão faria a seta sair de um ponto e o alvo do
          arrasto ser medido em outro.

          O RÓTULO FICA FORA DA CAIXA, à direita da alça, e não dentro do bloco:
          dentro, ele brigaria com o texto da mensagem, que é o que o dono lê
          para reconhecer o bloco. `pointer-events-none` para ele não roubar o
          começo do arrasto da alça que nomeia, e `truncate` porque rótulo de
          botão é texto livre — sem ele, um rótulo comprido atravessa o quadro.

          Bloco de uma alça só não leva rótulo: não há o que distinguir. */}
      {alcas.map((a, k) => {
        const altura = `${fracaoDaAlca(k, alcas.length) * 100}%`;
        return (
          // `Fragment` e não uma `div`: um invólucro seria mais uma caixa no
          // fluxo do bloco, e a alça já se posiciona sozinha contra a caixa do
          // nó (que é quem tem `relative`).
          <Fragment key={a.chave}>
            <Handle
              id={a.chave}
              type="source"
              position={Position.Right}
              isConnectable={isConnectable}
              isConnectableStart={isConnectable}
              isConnectableEnd={isConnectable}
              style={{ top: altura }}
              className="!h-2 !w-2 !bg-zinc-400"
            />
            {alcas.length > 1 && (
              <span
                style={{ top: altura }}
                className="pointer-events-none absolute left-full ml-2 max-w-[88px] -translate-y-1/2 truncate text-[9px] leading-none text-zinc-500 dark:text-zinc-400"
              >
                {a.rotulo}
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
