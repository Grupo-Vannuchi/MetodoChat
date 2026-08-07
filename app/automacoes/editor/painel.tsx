"use client";
import type { Passo, Problema } from "@/lib/steps";
import type { Picked } from "../types";
import { resumoDoBloco } from "./modelos";
import MessageField from "../variable-picker";
import MediaPicker from "../media-picker";
import { input, label as labelCls, hint as hintCls } from "../../ui";

// Os campos do bloco selecionado.
//
// Abre SOBRE o quadro, à direita, em vez de dividir a tela: fechado, o quadro é
// inteiro. Num editor espacial a área de trabalho é o produto.
//
// ---------------------------------------------------------------------------
// A PRÉVIA DA CONVERSA NÃO ESTÁ AQUI, e a ausência é achado, não esquecimento.
//
// `phone-preview.tsx` NÃO aceita `Passo[]`. Ela recebe treze props achatadas —
// `welcomeText`, `quickReplyLabel`, `linkText`/`linkButtonLabel`/`linkUrl`,
// `reminderText`/`reminderDelay`, `requireFollow`/`followText`/
// `followButtonLabel`, `askEmail`/`emailText`, `storyReaction` — e desenha as
// bolhas numa ORDEM FIXA, escrita no JSX dela. São as caixas do formulário
// antigo, uma a uma.
//
// Isso não é uma prop faltando, é a forma do dado: o quadro monta uma lista
// ORDENADA e REPETÍVEL (duas mensagens seguidas, um link antes do portão, uma
// espera no meio), e a prévia tem um slot só por papel e uma ordem que não se
// mexe. Alimentá-la com o que der certo desenharia uma conversa que não é a que
// a lista executa — a tela mentindo sobre o fluxo, que é o defeito que este
// editor inteiro existe para não cometer.
//
// Fazer a prévia ler `Passo[]` é trabalho próprio (reescrever o corpo dela, com
// o formulário antigo ainda dependendo da forma atual), e a Tarefa 7 mandou
// REPORTAR em vez de adaptar. Está reportado.
// ---------------------------------------------------------------------------

// O que a automação é, fora da lista de blocos. Editado quando o nó de GATILHO
// está selecionado.
//
// Mora junto do painel porque é ele quem desenha estes campos, e o quadro só o
// carrega. São colunas de `automations` — nome, ativo, gatilho, palavras-chave,
// tipo de correspondência, post e story —, ou seja uma ESCRITA DIFERENTE da
// lista de blocos, em colunas diferentes. Juntar as duas num salvar só faz uma
// gravação parcial deixar metade de cada coisa no banco.
export type Configuracao = {
  nome: string;
  ativo: boolean;
  gatilho: string;
  palavras: string[];
  correspondencia: string;
  post: Picked | null;
  story: Picked | null;
};

const NOME_DO_GATILHO: { valor: string; titulo: string }[] = [
  { valor: "comment", titulo: "Comentário em post" },
  { valor: "story", titulo: "Resposta a story" },
  { valor: "dm", titulo: "DM recebida" },
];

// Um recado sobre COMO O FLUXO SE COMPORTA naquele bloco — não um erro.
//
// Âmbar e teal não são decoração: são as MESMAS duas cores que `no.tsx` usa
// para separar o portão de follow do pedido de e-mail. Quem lê o aviso aqui
// está olhando para a borda de lá.
function Aviso({ tom, children }: { tom: "ambar" | "teal"; children: React.ReactNode }) {
  const cor =
    tom === "ambar"
      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-100"
      : "border-teal-400 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-100";
  return <p className={`mt-3 rounded border-l-4 p-2 text-xs leading-relaxed ${cor}`}>{children}</p>;
}

export default function Painel({
  passo,
  indice,
  configuracao,
  problemas,
  aoMudar,
  aoMudarConfiguracao,
  aoFechar,
}: {
  // O bloco selecionado, ou null quando o selecionado é o gatilho (ou nada).
  passo: Passo | null;
  // O índice dele na lista, só para o cabeçalho dizer de qual bloco se trata.
  indice: number;
  // Não-nula quando o nó selecionado é o GATILHO.
  configuracao: Configuracao | null;
  problemas: Problema[];
  aoMudar: (p: Passo) => void;
  aoMudarConfiguracao: (c: Configuracao) => void;
  aoFechar: () => void;
}) {
  if (!passo && !configuracao) return null;

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col gap-3 overflow-y-auto border-l border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
          {passo ? `${indice + 1}. ${resumoDoBloco(passo).titulo}` : "GATILHO"}
        </div>
        <button
          type="button"
          onClick={aoFechar}
          className="-mt-1 shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          aria-label="Fechar painel"
        >
          ✕
        </button>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* MENSAGEM (`dm`) — os três itens da paleta que salvam `tipo: "dm"` */}
      {/*                                                                  */}
      {/* A CONVENÇÃO DA CHAVE `url` (modelos.ts) tem TRÊS casas, e esta é a */}
      {/* terceira. As outras duas são `blocoNovo` (semeia `url: ""` só em  */}
      {/* "Mensagem com link") e `resumoDoBloco` (classifica pela CHAVE).   */}
      {/*                                                                   */}
      {/* O que este painel promete: nunca CRIA e nunca APAGA a chave.      */}
      {/* O campo do endereço só existe quando `url !== undefined`, e o     */}
      {/* `onChange` grava a string — esvaziá-lo grava `""`, não remove a   */}
      {/* chave. Removê-la tornaria o bloco indistinguível de uma resposta  */}
      {/* rápida, e o erro "link sem endereço" de `conferirLista` deixaria  */}
      {/* de acender EM SILÊNCIO. O mesmo vale ao contrário: nenhum campo   */}
      {/* daqui semeia `url` num bloco que não a tem, senão toda resposta   */}
      {/* rápida passaria a acender aquele erro à toa.                      */}
      {/* -------------------------------------------------------------- */}
      {passo?.tipo === "dm" && (
        <>
          <MessageField
            name="texto"
            label="Mensagem"
            value={passo.texto}
            onChange={(v) => aoMudar({ ...passo, texto: v })}
            rows={4}
            placeholder="Oi {{first_name}}! Que bom te ver por aqui 😊"
          />

          {passo.botao_label !== undefined && (
            <div>
              <label className={labelCls}>Texto do botão</label>
              <input
                value={passo.botao_label}
                onChange={(e) => aoMudar({ ...passo, botao_label: e.target.value })}
                maxLength={20}
                className={input}
              />
              <p className={hintCls}>Máx. 20 caracteres — é o limite do Instagram.</p>
            </div>
          )}

          {passo.url !== undefined && (
            <div>
              <label className={labelCls}>Endereço</label>
              <input
                value={passo.url}
                onChange={(e) => aoMudar({ ...passo, url: e.target.value })}
                placeholder="https://"
                className={input}
              />
              <p className={hintCls}>
                O botão abre este endereço. Sem ele, o fluxo trava esperando um toque que não leva a
                lugar nenhum.
              </p>
            </div>
          )}

          {/* PELA CHAVE, e não por `!passo.url`, pelo mesmo motivo de
              `resumoDoBloco`: `url: ""` é o bloco de LINK sem endereço, e nele
              `conferirLista` já acende ERRO. Ler o VALOR poria este aviso —
              que descreve o funcionamento normal de uma resposta rápida —
              coladinho num erro que fala de outra coisa, e o cabeçalho do
              painel ainda diria MENSAGEM COM LINK. */}
          {passo.url === undefined && Boolean(passo.botao_label) && (
            <Aviso tom="ambar">
              <strong>O fluxo para aqui</strong> esperando o toque. O que vier depois só sai quando a
              pessoa tocar no botão.
            </Aviso>
          )}
        </>
      )}

      {passo?.tipo === "esperar" && (
        <div>
          <label className={labelCls}>Esperar (minutos)</label>
          <input
            type="number"
            min={0}
            value={passo.minutos}
            onChange={(e) => {
              // `Number("")` é 0, e `Number("abc")` é NaN — o segundo é
              // recusado por `conferir` (lib/steps.ts) e viraria ERRO num
              // bloco que a pessoa só estava editando.
              const n = Number(e.target.value);
              aoMudar({ ...passo, minutos: Number.isFinite(n) ? n : 0 });
            }}
            className={input}
          />
          <p className={hintCls}>
            Esta espera não é enviada: ela atrasa tudo o que vier depois dela na lista.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* OS DOIS "PORTÕES" NÃO SÃO A MESMA COISA, e é aqui que a diferença   */}
      {/* precisa estar ESCRITA — a paleta e a cor do nó já a mostram.        */}
      {/*                                                                     */}
      {/* Os dois param o fluxo (`esperaResposta`, lib/steps.ts, diz sim aos   */}
      {/* dois). O que só o `pedir_follow` tem é a REGRA DO PORTÃO             */}
      {/* (`atravessandoOPortao`): quando uma retomada cai adiante dele, o     */}
      {/* fluxo volta e o avalia. O `pedir_email` não tem nada disso — numa    */}
      {/* lista [pedir_email, resposta rápida, link], quem está parado na      */}
      {/* resposta rápida toca no botão e cai no LINK, com o e-mail nunca      */}
      {/* capturado. É ESCOPO, não defeito: a decisão foi cobrir só o follow,  */}
      {/* porque é ele que sustenta a promessa central do produto.            */}
      {/* ------------------------------------------------------------------ */}
      {(passo?.tipo === "pedir_follow" || passo?.tipo === "pedir_email") && (
        <>
          <MessageField
            name="texto"
            label="Mensagem do pedido"
            value={passo.texto}
            onChange={(v) => aoMudar({ ...passo, texto: v })}
            rows={3}
          />

          {passo.tipo === "pedir_follow" && (
            <>
              <div>
                <label className={labelCls}>Texto do botão</label>
                <input
                  value={passo.botao_label}
                  onChange={(e) => aoMudar({ ...passo, botao_label: e.target.value })}
                  maxLength={20}
                  className={input}
                />
              </div>
              <Aviso tom="ambar">
                <strong>Ninguém passa deste ponto sem seguir</strong>, e quem deixar de seguir depois
                é trazido de volta para cá — mesmo que já tenha chegado adiante por outro caminho.
              </Aviso>
            </>
          )}

          {passo.tipo === "pedir_email" && (
            <Aviso tom="teal">
              <strong>O fluxo espera aqui até o endereço chegar</strong>, mas não há reavaliação: um
              bloco adiante alcançado por outro caminho sai com o e-mail nunca capturado.
            </Aviso>
          )}
        </>
      )}

      {passo?.tipo === "reagir_story" && (
        <div>
          <label className={labelCls}>Emoji</label>
          <input
            value={passo.emoji}
            onChange={(e) => aoMudar({ ...passo, emoji: e.target.value })}
            className={input}
          />
          <p className={hintCls}>Reage à mensagem que a pessoa mandou.</p>
        </div>
      )}

      {passo?.tipo === "resposta_publica" && (
        <div>
          <label className={labelCls}>Variações (uma por linha — sorteia uma)</label>
          {/* SEM `.filter()` NO `split`, e a ausência é correção de um defeito
              que só aparece DURANTE o gesto: filtrar as linhas em branco come
              o `\n` no instante em que a tecla Enter é apertada — o estado
              volta com uma linha só, o `value` do textarea é reescrito sem a
              quebra, e NÃO DÁ PARA ESCREVER A SEGUNDA VARIAÇÃO. Antes e depois
              do gesto a lista tem uma linha nos dois casos, então medir só as
              pontas aprova o campo quebrado.

              O preço de não filtrar é a variação em branco ficar na lista, e
              ele já é conhecido e tolerado: `conferirLista` (lib/steps.ts) só
              acende erro quando NENHUMA tem texto, e o comentário de lá
              descreve a mistura de cheias e vazias como perda intermitente. */}
          <textarea
            value={passo.textos.join("\n")}
            onChange={(e) => aoMudar({ ...passo, textos: e.target.value.split("\n") })}
            rows={4}
            className={input}
          />
          <p className={hintCls}>Aparece no post, abaixo do comentário da pessoa.</p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* O GATILHO. Ele é um nó como os outros, então a configuração da       */}
      {/* automação é editada no MESMO painel — a tela é uma coisa só.        */}
      {/*                                                                     */}
      {/* Estes campos são colunas de `automations`, e o SALVAR deles é uma    */}
      {/* escrita separada da lista de blocos. Não os junte ao salvar dos      */}
      {/* passos: são colunas diferentes, e uma gravação parcial deixaria      */}
      {/* metade de cada coisa no banco.                                       */}
      {/* ------------------------------------------------------------------ */}
      {configuracao && (
        <>
          <div>
            <label className={labelCls}>Nome da automação</label>
            <input
              value={configuracao.nome}
              onChange={(e) => aoMudarConfiguracao({ ...configuracao, nome: e.target.value })}
              className={input}
              placeholder="Ex.: Link do e-book"
            />
            <p className={hintCls}>Só você vê esse nome, na lista de automações.</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={configuracao.ativo}
              onChange={(e) => aoMudarConfiguracao({ ...configuracao, ativo: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
            Ativa
          </label>

          <div>
            <label className={labelCls}>Quando alguém…</label>
            <div className="flex flex-col gap-1">
              {NOME_DO_GATILHO.map((o) => (
                <label
                  key={o.valor}
                  className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                    configuracao.gatilho === o.valor
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="gatilho-do-quadro"
                    value={o.valor}
                    checked={configuracao.gatilho === o.valor}
                    // Trocar o gatilho leva junto o que só existia por causa
                    // dele — é o que o formulário antigo já faz. Sem isto, um
                    // post escolhido continuaria grudado numa automação que
                    // passou a ser disparada por story.
                    onChange={() =>
                      aoMudarConfiguracao({
                        ...configuracao,
                        gatilho: o.valor,
                        post: o.valor === "comment" ? configuracao.post : null,
                        story: o.valor === "story" ? configuracao.story : null,
                      })
                    }
                    className="sr-only"
                  />
                  {o.titulo}
                </label>
              ))}
            </div>
            <p className={hintCls}>
              O gatilho decide quais blocos a paleta oferece: o coraçãozinho só roda em story, e a
              resposta pública só em comentário.
            </p>
          </div>

          <div>
            <label className={labelCls}>Palavras-chave</label>
            <input
              value={configuracao.palavras.join(", ")}
              onChange={(e) =>
                aoMudarConfiguracao({
                  ...configuracao,
                  // Mesma separação do formulário antigo (`splitList`): vírgula,
                  // sem espaço em volta e sem entrada vazia.
                  palavras: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className={input}
              placeholder="quero, link, eu quero"
              disabled={configuracao.correspondencia === "any"}
            />
            <p className={hintCls}>Separadas por vírgula. Sem diferença de maiúsculas ou acentos.</p>
          </div>

          <div>
            <label className={labelCls}>Tipo de correspondência</label>
            <select
              value={configuracao.correspondencia}
              onChange={(e) =>
                aoMudarConfiguracao({ ...configuracao, correspondencia: e.target.value })
              }
              className={input}
            >
              <option value="contains">Contém a palavra</option>
              <option value="exact">Texto exato</option>
              <option value="any">Qualquer texto</option>
            </select>
          </div>

          {configuracao.gatilho === "comment" && (
            <div>
              <span className={labelCls}>Post específico (opcional)</span>
              <MediaPicker
                kind="posts"
                selected={configuracao.post}
                onSelect={(m) => aoMudarConfiguracao({ ...configuracao, post: m })}
              />
              <p className={hintCls}>Sem post escolhido, vale para todos os posts.</p>
            </div>
          )}

          {configuracao.gatilho === "story" && (
            <div>
              <span className={labelCls}>Story específico (opcional)</span>
              <MediaPicker
                kind="stories"
                selected={configuracao.story}
                onSelect={(m) => aoMudarConfiguracao({ ...configuracao, story: m })}
              />
              <p className={hintCls}>
                Só stories no ar aparecem aqui (duram 24h). Sem story escolhido, vale para todos.
              </p>
            </div>
          )}
        </>
      )}

      {/* O que `conferirLista` (lib/steps.ts) tem a dizer sobre ESTE bloco —
          a mesma função que o quadro usa para acender a borda vermelha do nó,
          e a mesma que o Server Action vai usar para recusar o salvar. Quem
          escolhe quais problemas chegam aqui é o quadro. */}
      {problemas.map((p, i) => (
        <p
          key={i}
          className={`rounded border-l-4 p-2 text-xs leading-relaxed ${
            p.nivel === "erro"
              ? "border-red-500 bg-red-50 dark:bg-red-950/40 dark:text-red-100"
              : "border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-100"
          }`}
        >
          {p.mensagem}
        </p>
      ))}
    </aside>
  );
}
