"use client";
import { esperaResposta, LIMITE_DE_BOTOES, novoIdDeBotao } from "@/lib/steps";
import type { Botao, Passo, PassoDm, Problema } from "@/lib/steps";
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

// A LISTA DE BOTÕES cresce para baixo, então ela pede uma coluna e não uma
// largura de campo: as linhas se empilham dentro dela e a faixa rola (`max-h`
// no `aside`) quando o menu é grande.
const CAMPO_DOS_BOTOES = "min-w-0 grow basis-[300px]";

// OS TRÊS BOTÕES DE CADA LINHA — subir, descer, remover.
//
// Estilo local e não `btnGhost` (../../ui): aquele não tem estado DESABILITADO,
// e subir na primeira linha e descer na última precisam ficar apagados em vez de
// sumir. Um botão que some faz as três posições dançarem de linha para linha, e
// aí o alvo do clique muda de lugar conforme a linha.
const BOTAO_DA_LINHA =
  "shrink-0 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs leading-none text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent";

// O DE APAGAR É ESCRITO INTEIRO, e não `${BOTAO_DA_LINHA} text-red-600`: as duas
// classes de cor de texto viveriam na mesma string, e qual delas ganha depende
// da ORDEM NO CSS GERADO, não da ordem em que foram escritas. Um botão de apagar
// que amanhece cinza depois de uma atualização do Tailwind é o tipo de defeito
// que ninguém procura.
const BOTAO_DE_APAGAR =
  "shrink-0 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs leading-none text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/40";

// TROCAR DUAS POSIÇÕES DA LISTA. É reordenar, e reordenar não mexe em caminho
// nenhum: a seta de um botão casa pelo ID (`ligacaoEscolhida`, lib/steps.ts), e
// não pela posição. O que a ordem decide é a ORDEM DOS BOTÕES NA MENSAGEM e,
// com ela, quais sobrevivem ao corte em `LIMITE_DE_BOTOES` (`botoesDaMensagem`).
function trocar(lista: unknown[], i: number, j: number): unknown[] {
  if (i < 0 || j < 0 || i >= lista.length || j >= lista.length) return lista;
  const novo = [...lista];
  [novo[i], novo[j]] = [novo[j], novo[i]];
  return novo;
}

// A CHAVE DO REACT DE CADA LINHA É O ID DO BOTÃO, e não o índice, e a diferença
// aparece só no gesto de reordenar: com o índice, o React reaproveita a linha
// que está NAQUELA POSIÇÃO, então o foco fica onde o dedo estava e a segunda
// seta para cima sobe OUTRO botão. Com o id, o React move o nó junto com o
// botão, o foco vai com ele, e clicar duas vezes sobe o mesmo botão duas vezes.
//
// A DEDUPLICAÇÃO EXISTE PORQUE O ID PODE VIR REPETIDO — é uma das cinco causas
// de `botoesCrus` (lib/steps.ts), produzível fora do painel e travada só no
// salvar. Sem ela, o bloco que o dono abriu justamente para consertar recebe um
// aviso de chave duplicada do React em vez do editor.
function chavesDasLinhas(lista: unknown[]): string[] {
  const usadas = new Set<string>();
  return lista.map((b, i) => {
    const id = (b as { id?: unknown } | null | undefined)?.id;
    let chave = typeof id === "string" && id ? `id:${id}` : `pos:${i}`;
    while (usadas.has(chave)) chave += `:${i}`;
    usadas.add(chave);
    return chave;
  });
}

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

// ---------------------------------------------------------------------------
// OS BOTÕES DE UM MENU. É a tela que faz nascer o `botoes` que o motor, a
// conferência e as alças do quadro já liam desde a Tarefa 4 — até aqui NADA no
// sistema gravava essa chave.
//
// APARECE PELA CHAVE, `botoes !== undefined`, como o campo do endereço aparece
// por `url !== undefined`. É a vizinha da convenção da chave `url`, e ela está
// escrita por extenso em `./modelos`. Pela FORMA (`envioDaDm`) o menu que ficou
// sem nenhum botão perderia o próprio editor, e o dono não teria como pôr o
// primeiro de volta.
//
// A LISTA É LIDA COMO JSONB, e não como o `Botao[]` que o tipo promete: `Passo`
// aqui é uma AFIRMAÇÃO de `passosDoBanco` (app/automacoes/[id]/page.tsx) sobre
// um `unknown` do banco. Por isso `unknown[]` e `comoTexto` em cada rótulo — um
// `botoes: [null]` chega inteiro até aqui (`envioDaDm` valida a LISTA e não os
// elementos, de propósito), e ler `b.rotulo` cru derrubaria o painel do bloco
// que o dono abriu justamente para consertá-lo. `conferirLista` acusa cada uma
// das cinco causas, e quatro delas travam o salvar; o que este editor garante é
// que exista o gesto de CONSERTAR o que elas acusam.
//
// GRAVAR REESCREVE A CHAVE COMO LISTA, e isso conserta o caso "não é uma lista":
// nada acontece só por desenhar — quem reescreve é o gesto do dono (digitar,
// acrescentar, remover, reordenar), e é ele que troca um `botoes: "x"` gravado
// por fora por uma lista de verdade.
//
// O RÓTULO NOVO NASCE EM BRANCO, e é decisão da Tarefa 5, não descuido: das
// cinco causas de `botoesCrus` (lib/steps.ts) essa é a única que NÃO trava o
// salvar. O dono clica "adicionar botão", o campo nasce vazio e ele consegue
// guardar o meio do trabalho; o que ele não consegue é publicar assim.
//
// APAGAR NÃO PASSA POR `aoMudar`, e é a única coisa aqui que precisa de outra
// porta: o gesto mexe nas DUAS listas do quadro — o bloco perde o botão e as
// ligações perdem a seta dele (`desligarBotao`, lib/steps.ts). Quem tem as duas
// é `quadro.tsx`; este painel nunca viu `ligacoes` e continua sem ver.
// ---------------------------------------------------------------------------
function Botoes({
  passo,
  aoMudar,
  aoApagarBotao,
}: {
  passo: PassoDm;
  aoMudar: (p: Passo) => void;
  aoApagarBotao: (indice: number) => void;
}) {
  const lista: unknown[] = Array.isArray(passo.botoes) ? passo.botoes : [];
  const chaves = chavesDasLinhas(lista);
  const gravar = (novos: unknown[]) => aoMudar({ ...passo, botoes: novos as Botao[] });

  return (
    <div className={CAMPO_DOS_BOTOES}>
      {/* `span` e não `label`: o rótulo é da LISTA, e um `label` sem campo
          próprio roubaria o nome de acessibilidade do primeiro input. Cada
          linha traz o nome dela no `aria-label`. */}
      <span className={labelCls}>Botões</span>

      <ul className="flex flex-col gap-1.5">
        {lista.map((bruto, i) => {
          const objeto = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};
          return (
            <li key={chaves[i]} className="flex items-center gap-1">
              <input
                value={comoTexto(objeto.rotulo)}
                onChange={(e) =>
                  gravar(lista.map((o, j) => (j === i ? { ...objeto, rotulo: e.target.value } : o)))
                }
                maxLength={20}
                placeholder="Texto do botão"
                className={input}
                aria-label={`Texto do botão ${i + 1}`}
              />
              <button
                type="button"
                className={BOTAO_DA_LINHA}
                disabled={i === 0}
                onClick={() => gravar(trocar(lista, i, i - 1))}
                title="Subir"
                aria-label={`Subir o botão ${i + 1}`}
              >
                ↑
              </button>
              <button
                type="button"
                className={BOTAO_DA_LINHA}
                disabled={i === lista.length - 1}
                onClick={() => gravar(trocar(lista, i, i + 1))}
                title="Descer"
                aria-label={`Descer o botão ${i + 1}`}
              >
                ↓
              </button>
              <button
                type="button"
                className={BOTAO_DE_APAGAR}
                onClick={() => aoApagarBotao(i)}
                title="Remover — a seta deste botão sai junto"
                aria-label={`Remover o botão ${i + 1}`}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => gravar([...lista, { id: novoIdDeBotao(), rotulo: "" }])}
        className="mt-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
      >
        + Adicionar botão
      </button>

      <p className={hintCls}>
        Cada botão vira uma alça no bloco, e a seta que sai dela é o caminho daquele botão —
        apagar o botão apaga a seta junto. Trocar o texto não troca o caminho. Máx. 20 letras por
        botão, e cabem {LIMITE_DE_BOTOES} botões numa mensagem.
      </p>

      {!lista.length && (
        <p className={hintCls}>
          Sem nenhum botão, esta mensagem sai como texto puro: o fluxo não para e não há o que
          escolher.
        </p>
      )}

      {passo.botoes !== undefined && !Array.isArray(passo.botoes) && (
        <p className={hintCls}>
          O que está gravado aqui não é uma lista de botões. Acrescentar um botão substitui isso
          por uma lista de verdade.
        </p>
      )}
    </div>
  );
}

export default function Painel({
  passo,
  indice,
  configuracao,
  editandoGatilho,
  problemas,
  aoMudar,
  aoApagarBotao,
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
  // APAGAR UM BOTÃO É O ÚNICO GESTO DESTE PAINEL QUE NÃO CABE EM `aoMudar`: ele
  // mexe também nas LIGAÇÕES, e o painel não as conhece. O índice é o da lista
  // de `botoes` do bloco selecionado, e quem resolve as duas metades é
  // `quadro.tsx`.
  aoApagarBotao: (indice: number) => void;
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

              {/* DUAS PERGUNTAS, e cada uma vai a quem sabe respondê-la.

                  QUE BLOCO É ESTE? — pela CHAVE, e não por `!passo.url`, pelo
                  mesmo motivo de `resumoDoBloco`: `url: ""` é o bloco de LINK sem
                  endereço, e nele `conferirLista` já acende ERRO. Ler o VALOR
                  poria este aviso — que descreve o funcionamento normal de uma
                  resposta rápida — coladinho num erro que fala de outra coisa, e o
                  cabeçalho do painel ainda diria MENSAGEM COM LINK. Esta metade é
                  da convenção da chave `url`, documentada em modelos.ts, e ela NÃO
                  pode sair daqui.

                  O FLUXO PARA NELE? — de `esperaResposta` (lib/steps.ts), que é
                  a pergunta que este aviso FAZ, escrita uma vez só. Aqui havia
                  `Boolean(passo.botao_label)`, a última cópia solta da regra; ela
                  saiu, e a linha passou a perguntar `envioDaDm(passo).forma ===
                  "resposta_rapida"` — que é uma cópia mais discreta da MESMA
                  coisa, listando as formas que param.

                  E ELA JÁ FICOU ERRADA, no commit seguinte: a Tarefa 4 fez o
                  menu de `botoes` parar o fluxo, `esperaResposta` ganhou a forma
                  nova, e esta linha não. Um bloco só de botões passava a travar
                  o fluxo com este aviso APAGADO — a tela dizendo o contrário do
                  que o motor faz. A ironia está medida: o parágrafo acima existe
                  justamente para não haver "a segunda cópia que precisaria ser
                  lembrada no dia em que a forma mudar", e a forma mudou no dia
                  seguinte sem esta linha ser lembrada. Por isso ela agora
                  pergunta pela PARADA, e não pela lista de formas que param.

                  A DIVERGÊNCIA COM `envioDaDm` FICA DE PÉ, e é intencional: em
                  `{botao_label, url: ""}` ele diz `resposta_rapida` — e portanto
                  `esperaResposta` diz que para — e esta tela não mostra o aviso.
                  Quem a produz é a guarda da chave, do lado de fora — o que saiu
                  foi a repetição da regra, não a convenção. */}
              {/* A LISTA DE BOTÕES, pela CHAVE. O comentário inteiro está em
                  `Botoes`, logo acima deste componente. */}
              {passo.botoes !== undefined && (
                <Botoes passo={passo} aoMudar={aoMudar} aoApagarBotao={aoApagarBotao} />
              )}

              {passo.url === undefined && esperaResposta(passo) && (
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
                <p className={hintCls}>Separadas por vírgula. Sem diferença de maiúsculas nem de acentos.</p>
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
