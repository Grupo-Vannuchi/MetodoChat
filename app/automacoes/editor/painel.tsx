"use client";
import type { Passo, Problema } from "@/lib/steps";
import type { Picked } from "../types";
import { comoTexto, resumoDoBloco } from "./modelos";
import MessageField from "../variable-picker";
import MediaPicker from "../media-picker";
import { input, label as labelCls, hint as hintCls } from "../../ui";

// Os campos do bloco selecionado.
//
// ---------------------------------------------------------------------------
// ELE É UMA FAIXA EMBAIXO, E ELA COBRE O RODAPÉ DO QUADRO.
//
// Era um `aside` de 384px à direita, sobre o quadro. Virou faixa por decisão do
// dono do produto, tomada vendo as duas no protótipo — e a decisão inclui o
// preço, que está dito: a faixa COBRE em vez de empurrar, então um bloco que
// esteja na parte de baixo do quadro pode ficar escondido atrás dela enquanto
// ela está aberta. Não há mitigação construída aqui de propósito; empurrar o
// quadro seria a outra escolha, e ela foi recusada.
//
// Fechada, ela não ocupa nada e o quadro é inteiro — quem a posiciona é
// `quadro.tsx`, que a ancora embaixo e mede a altura dela para os controles de
// zoom não caírem atrás.
//
// OS CAMPOS SE DISTRIBUEM NA HORIZONTAL, e isso não é enfeite: numa faixa larga
// e baixa, campos empilhados numa coluna estreita fariam a faixa crescer para
// cima e comer o quadro sem usar a largura que ela tem de sobra. Cada campo tem
// uma base e um fator de crescimento, e o `flex-wrap` é quem resolve as larguras
// que não coubessem.
//
// O `max-h` com rolagem é o teto: o painel do GATILHO tem muito mais campos que
// qualquer bloco — nome, ativa, os três gatilhos, palavras-chave, tipo de
// correspondência e ainda o seletor de mídia, que abre uma grade de posts. Sem
// teto, esse caso sozinho cobriria o quadro quase todo.
// ---------------------------------------------------------------------------
//
// A PRÉVIA SAIU DAQUI e virou coluna própria, sempre visível (`quadro.tsx`).
// Ela morava no fim deste painel, o que a tornava invisível justamente enquanto
// não havia bloco selecionado — que é o estado em que se olha para o fluxo
// inteiro. Numa faixa baixa ela também não caberia: é a peça mais alta da tela.

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

// AS MEDIDAS DOS CAMPOS NA FAIXA, num lugar só.
//
// `basis` é a largura que o campo PEDE, e `grow` o quanto ele fica com o que
// sobrar. O texto da mensagem cresce o dobro dos outros porque é o único campo
// em que se escreve de verdade; os curtos (botão, minutos, emoji) têm largura
// fixa, senão esticariam até a largura da janela por não ter concorrente.
const CAMPO_TEXTO = "min-w-0 grow-[2] basis-[320px]";
const CAMPO_MEDIO = "min-w-0 grow basis-[240px]";
const CAMPO_CURTO = "w-44 shrink-0";
const RECADO = "min-w-0 grow basis-[260px]";

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
  return (
    <p className={`${RECADO} self-center rounded border-l-4 p-2 text-xs leading-relaxed ${cor}`}>
      {children}
    </p>
  );
}

export default function Painel({
  passo,
  indice,
  configuracao,
  editandoGatilho,
  problemas,
  aoMudar,
  aoMudarConfiguracao,
  aoFechar,
}: {
  // O bloco selecionado, ou null quando o selecionado é o gatilho (ou nada).
  passo: Passo | null;
  // O índice dele na lista, para o cabeçalho dizer de qual bloco se trata. -1
  // quando não há bloco selecionado.
  indice: number;
  // A CONFIGURAÇÃO DA AUTOMAÇÃO. Quem diz que os CAMPOS dela devem aparecer é
  // `editandoGatilho`; ela chega sempre porque o painel do gatilho a edita.
  configuracao: Configuracao;
  // Quem diz que o nó selecionado é o GATILHO. Explícito é mais barato do que
  // deduzido: os campos da automação aparecem só com isto ligado.
  editandoGatilho: boolean;
  problemas: Problema[];
  aoMudar: (p: Passo) => void;
  aoMudarConfiguracao: (c: Configuracao) => void;
  aoFechar: () => void;
}) {
  if (!passo && !editandoGatilho) return null;

  // ---------------------------------------------------------------------
  // TODO CAMPO É COAGIDO NA LEITURA (`comoTexto`, `./modelos`), e isso é
  // REDE DE SEGURANÇA, não desconfiança do tipo.
  //
  // `Passo` aqui é uma AFIRMAÇÃO de `passosDoBanco`
  // (app/automacoes/[id]/page.tsx) sobre um `unknown` vindo do jsonb — nada
  // confere a forma dos campos em runtime, e aquela função deixa o bloco
  // INCOMPLETO passar DE PROPÓSITO, para o dono consertá-lo em vez de
  // descobrir a perda depois de o primeiro salvamento apagá-lo.
  //
  // Sem a coerção, clicar nesse bloco — que é justamente o gesto que o
  // desenho manda fazer — derrubava a ROTA INTEIRA, e não só o painel:
  // `../variable-picker` faz `value.includes("{{")` no corpo do componente, e
  // não existe `error.tsx` em lugar nenhum sob `app/`. O irmão deste arquivo
  // (`resumoDoBloco`, ./modelos) já coagia pelo mesmo motivo; aqui a rede
  // estava furada exatamente onde o desenho manda passar.
  //
  // A COERÇÃO NÃO GRAVA NADA: ela vale só na LEITURA do campo. O dado do
  // bloco só muda quando a pessoa digita, e aí `aoMudar` grava o que ela
  // digitou. Em particular ela não cria nem apaga a chave `url` — a
  // convenção de `./modelos` continua intacta, porque quem decide se o campo
  // APARECE continua sendo `passo.url !== undefined`, lido do bloco cru.
  // ---------------------------------------------------------------------

  return (
    <aside className="max-h-[46vh] overflow-y-auto border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-4">
        {/* O CABEÇALHO VIRA COLUNA, à esquerda dos campos. Numa faixa baixa uma
            linha própria só para o título custaria altura que o quadro perde. */}
        <div className="w-32 shrink-0 pt-1 text-[10px] font-semibold leading-snug tracking-wide text-zinc-500 dark:text-zinc-400">
          {passo ? `${indice + 1}. ${resumoDoBloco(passo).titulo}` : "GATILHO"}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-3">
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
              <div className={CAMPO_TEXTO}>
                <MessageField
                  name="texto"
                  label="Mensagem"
                  value={comoTexto(passo.texto)}
                  onChange={(v) => aoMudar({ ...passo, texto: v })}
                  rows={2}
                  placeholder="Oi {{first_name}}! Que bom te ver por aqui 😊"
                />
              </div>

              {passo.botao_label !== undefined && (
                <div className={CAMPO_CURTO}>
                  <label className={labelCls}>Texto do botão</label>
                  <input
                    value={comoTexto(passo.botao_label)}
                    onChange={(e) => aoMudar({ ...passo, botao_label: e.target.value })}
                    maxLength={20}
                    className={input}
                  />
                  <p className={hintCls}>Máx. 20 — é o limite do Instagram.</p>
                </div>
              )}

              {passo.url !== undefined && (
                <div className={CAMPO_MEDIO}>
                  <label className={labelCls}>Endereço</label>
                  <input
                    value={comoTexto(passo.url)}
                    onChange={(e) => aoMudar({ ...passo, url: e.target.value })}
                    placeholder="https://"
                    className={input}
                  />
                  {/* AS DUAS CONSEQUÊNCIAS, porque elas dependem do rótulo e são
                      diferentes — é a mesma divisão que a mensagem de erro de
                      `conferirLista` (lib/steps.ts) faz. Com rótulo o fluxo TRAVA
                      esperando o toque; sem rótulo ele segue e o que se perde é o
                      link, que chega como texto puro. */}
                  <p className={hintCls}>
                    {passo.botao_label
                      ? "O botão abre este endereço. Sem ele, o fluxo trava esperando um toque que não leva a lugar nenhum."
                      : "O botão abre este endereço. Sem ele, chega só o texto — sem link e sem botão."}
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
                  <strong>O fluxo para aqui</strong> esperando o toque. O que vier depois só sai
                  quando a pessoa tocar no botão.
                </Aviso>
              )}
            </>
          )}

          {passo?.tipo === "esperar" && (
            <div className={CAMPO_MEDIO}>
              <label className={labelCls}>Esperar (minutos)</label>
              {/* O CAMPO VAZIO é o que um `minutos` que não é número vira aqui —
                  nulo, texto, lista, ou a chave ausente. Não estoura como o
                  `texto`, mas `value={{}}` desenharia "[object Object]" dentro de
                  um `type="number"`, e o dono não teria como saber o que está
                  gravado. Vazio, ele digita e o bloco se conserta; `conferirLista`
                  (lib/steps.ts) segura o salvar até lá. */}
              <input
                type="number"
                min={0}
                value={
                  typeof passo.minutos === "number" && Number.isFinite(passo.minutos)
                    ? passo.minutos
                    : ""
                }
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
              <div className={CAMPO_TEXTO}>
                <MessageField
                  name="texto"
                  label="Mensagem do pedido"
                  value={comoTexto(passo.texto)}
                  onChange={(v) => aoMudar({ ...passo, texto: v })}
                  rows={2}
                />
              </div>

              {passo.tipo === "pedir_follow" && (
                <>
                  <div className={CAMPO_CURTO}>
                    <label className={labelCls}>Texto do botão</label>
                    <input
                      value={comoTexto(passo.botao_label)}
                      onChange={(e) => aoMudar({ ...passo, botao_label: e.target.value })}
                      maxLength={20}
                      className={input}
                    />
                  </div>
                  <Aviso tom="ambar">
                    <strong>Ninguém passa deste ponto sem seguir</strong>, e quem deixar de seguir
                    depois é trazido de volta para cá — mesmo que já tenha chegado adiante por outro
                    caminho.
                  </Aviso>
                </>
              )}

              {passo.tipo === "pedir_email" && (
                <Aviso tom="teal">
                  <strong>O fluxo espera aqui até o endereço chegar</strong>, mas não há
                  reavaliação: um bloco adiante alcançado por outro caminho sai com o e-mail nunca
                  capturado.
                </Aviso>
              )}
            </>
          )}

          {passo?.tipo === "reagir_story" && (
            <div className={CAMPO_CURTO}>
              <label className={labelCls}>Emoji</label>
              <input
                value={comoTexto(passo.emoji)}
                onChange={(e) => aoMudar({ ...passo, emoji: e.target.value })}
                className={input}
              />
              <p className={hintCls}>Reage à mensagem que a pessoa mandou.</p>
            </div>
          )}

          {passo?.tipo === "resposta_publica" && (
            <div className={CAMPO_TEXTO}>
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
                  descreve a mistura de cheias e vazias como perda intermitente.

                  O `Array.isArray` é a mesma defesa de `resumoDoBloco`
                  (`modelos.ts`), e pelo mesmo motivo: `Passo` é uma afirmação sobre
                  jsonb, não uma garantia. `{tipo:"resposta_publica"}` sem `textos`
                  chega até aqui — `passosDoBanco` não descarta bloco por conteúdo,
                  de propósito —, e `.join` num campo ausente derrubaria o painel
                  inteiro do bloco que a pessoa abriu justamente para consertar. */}
              <textarea
                value={Array.isArray(passo.textos) ? passo.textos.join("\n") : ""}
                onChange={(e) => aoMudar({ ...passo, textos: e.target.value.split("\n") })}
                rows={2}
                className={input}
              />
              <p className={hintCls}>Aparece no post, abaixo do comentário da pessoa.</p>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* O GATILHO. Ele é um nó como os outros, então a configuração da       */}
          {/* automação é editada no MESMO painel — a tela é uma coisa só.        */}
          {/*                                                                     */}
          {/* Estes campos são colunas de `automations`, e viajam para o banco    */}
          {/* junto com a lista de blocos, numa transação só (`salvarAutomacao`). */}
          {/* ------------------------------------------------------------------ */}
          {editandoGatilho && (
            <>
              <div className={CAMPO_MEDIO}>
                <label className={labelCls}>Nome da automação</label>
                <input
                  value={configuracao.nome}
                  onChange={(e) => aoMudarConfiguracao({ ...configuracao, nome: e.target.value })}
                  className={input}
                  placeholder="Ex.: Link do e-book"
                />
                <p className={hintCls}>Só você vê esse nome, na lista de automações.</p>
              </div>

              <label className="flex shrink-0 items-center gap-2 self-center text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={configuracao.ativo}
                  onChange={(e) =>
                    aoMudarConfiguracao({ ...configuracao, ativo: e.target.checked })
                  }
                  className="h-4 w-4 accent-indigo-500"
                />
                Ativa
              </label>

              <div className="min-w-0 shrink-0">
                <label className={labelCls}>Quando alguém…</label>
                {/* EM LINHA, e não empilhados: são três opções curtas, e na
                    faixa baixa uma coluna delas custaria três alturas de campo. */}
                <div className="flex flex-wrap gap-1">
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
                  O gatilho decide quais blocos a paleta oferece: o coraçãozinho só roda em story.
                </p>
              </div>

              <div className={CAMPO_MEDIO}>
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
                <p className={hintCls}>Separadas por vírgula. Sem diferença de maiúsculas.</p>
              </div>

              <div className={CAMPO_CURTO}>
                <label className={labelCls}>Correspondência</label>
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

              {/* O SELETOR DE MÍDIA OCUPA A LINHA INTEIRA (`basis-full`): aberto
                  ele é uma grade de posts com rolagem própria, e espremê-lo numa
                  coluna de 240px o tornaria inútil. */}
              {configuracao.gatilho === "comment" && (
                <div className="min-w-0 basis-full">
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
                <div className="min-w-0 basis-full">
                  <span className={labelCls}>Story específico (opcional)</span>
                  <MediaPicker
                    kind="stories"
                    selected={configuracao.story}
                    onSelect={(m) => aoMudarConfiguracao({ ...configuracao, story: m })}
                  />
                  <p className={hintCls}>
                    Só stories no ar aparecem aqui (duram 24h). Sem story escolhido, vale para
                    todos.
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
              className={`${RECADO} self-center rounded border-l-4 p-2 text-xs leading-relaxed ${
                p.nivel === "erro"
                  ? "border-red-500 bg-red-50 dark:bg-red-950/40 dark:text-red-100"
                  : "border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-100"
              }`}
            >
              {p.mensagem}
            </p>
          ))}
        </div>

        <button
          type="button"
          onClick={aoFechar}
          className="shrink-0 pt-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          aria-label="Fechar painel"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
