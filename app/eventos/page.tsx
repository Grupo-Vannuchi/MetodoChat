import { sql, QueueItem } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
import { card, muted, tableWrap, thead, rowDivide, btnGhost } from "../ui";
import {
  eventBadge,
  kindLabel,
  paraQuemLabel,
  statusBadge,
  friendlyError,
  eventText,
  eventUsername,
  eventMedia,
} from "../labels";
import Avatar from "../avatar";
import PostLine from "./post-line";
import Realce from "./realce";
import Filtros, { type OpcaoPost } from "./filtros";
import FiltrosEnvios from "./filtros-envios";
import DonoDosFiltros, { Carregando, LimparSecao } from "./filtros-dono";
import { dataDaLinhaDeEnvio, fraseDaDataDaLinha } from "@/lib/publicacao";
import { resolvePosts, type PostRef } from "@/lib/media-lookup";
import {
  PASSO_DO_FEED,
  MAX_DO_FEED,
  quantosEventos,
  parseFilters,
  hasFilters,
} from "@/lib/event-filters";
import { EVENTS_FROM, buildWhere, postsComEventos } from "@/lib/event-query";
import {
  ENVIOS_LIMIT,
  parseEnvioFilters,
  hasEnvioFilters,
  resumoSituacoes,
  totalDeEnvios,
  type ContagemPorSituacao,
} from "@/lib/envio-filters";
import { ENVIOS_FROM, ENVIOS_QUANDO, buildEnviosWhere, contagemPorSituacao } from "@/lib/envio-query";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  type: string;
  payload: unknown;
  created_at: Date;
  person_username: string | null;
  person_pic: string | null;
};

type QueueRow = QueueItem & {
  person_username: string | null;
  person_name: string | null;
  person_pic: string | null;
};

// Quantos posts o seletor oferece. Mais que isso vira parede de miniaturas —
// e esse é o motivo inteiro, hoje.
//
// A METADE QUE SAIU DAQUI ("estoura o teto de buscas avulsas do resolvePosts()")
// era FALSA antes desta branch e ficou mais falsa agora: o teto nunca foi 12,
// era 8 — 12 já o estourava quando a frase foi escrita — e hoje
// `MAX_INDIVIDUAL_LOOKUPS` (lib/media-lookup.ts) é 32. Um comentário que
// explica um número com uma restrição que não existe convida a mexer no número
// pelo motivo errado.
const POSTS_NO_SELETOR = 12;

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await getSelectedAccount();
  const params = await searchParams;
  const filtros = parseFilters(params);
  // QUANTOS EVENTOS ESTA PÁGINA TRAZ. Ele vem da barra de endereço e NÃO de
  // `FiltrosDaPagina` — ver `quantosEventos` (lib/event-filters.ts) para o
  // porquê: fora do estado dos filtros, mudar qualquer filtro o descarta
  // sozinho e o feed volta à primeira página, que é o certo quando o recorte
  // muda.
  const quantos = quantosEventos(params.ver);
  const envios = parseEnvioFilters(params);
  const where = account ? buildWhere(account.ig_user_id, filtros) : null;
  const whereEnvios = account ? buildEnviosWhere(account.ig_user_id, envios) : null;
  const situacoes = whereEnvios ? contagemPorSituacao(whereEnvios) : null;
  const opcoes = account ? postsComEventos(account.ig_user_id, POSTS_NO_SELETOR) : null;

  // Junta com contatos para mostrar QUEM é a pessoa, não o número dela.
  // As cinco consultas são independentes — em paralelo para não empilhar
  // latência de rede uma atrás da outra.
  const [eventRows, queueRows, totalRows, situacaoRows, postRows] =
    account && where && whereEnvios && situacoes && opcoes
      ? await Promise.all([
          sql().query(
            `select e.*,
                    coalesce(cf.username, cs.username) as person_username,
                    coalesce(cf.profile_pic, cs.profile_pic) as person_pic
             ${EVENTS_FROM}
             where ${where.sql}
             order by e.created_at desc limit ${quantos}`,
            where.params
          ),
          // Ordena pela MESMA data que a linha mostra, e não por created_at:
          // com a lista cortada em ENVIOS_LIMIT, um item recente ficando de fora
          // por causa de outro critério de "recente" pareceria sumiço.
          sql().query(
            `select q.*, c.username as person_username, c.name as person_name,
                    c.profile_pic as person_pic
             ${ENVIOS_FROM}
             where ${whereEnvios.sql}
             order by ${ENVIOS_QUANDO} desc limit ${ENVIOS_LIMIT}`,
            whereEnvios.params
          ),
          // Mesmo where da listagem: o número na tela nunca discorda da lista.
          sql().query(`select count(*)::int as total ${EVENTS_FROM} where ${where.sql}`, where.params),
          sql().query(situacoes.sql, situacoes.params),
          sql().query(opcoes.sql, opcoes.params),
        ])
      : [[], [], [], [], []];

  const events = eventRows as EventRow[];
  const queue = queueRows as QueueRow[];
  const total = (totalRows as { total: number }[])[0]?.total ?? 0;
  const contagens = postRows as { id: string; total: number }[];

  // Total e resumo saem da MESMA contagem, do MESMO recorte da listagem: o
  // número grande é a soma exata das parcelas que aparecem ao lado dele.
  const porSituacao = situacaoRows as ContagemPorSituacao;
  const totalEnvios = totalDeEnvios(porSituacao);
  const resumoEnvios = resumoSituacoes(porSituacao);
  const filtrandoEnvios = hasEnvioFilters(envios);

  // De qual post veio cada comentário, e as capas do seletor. Os ids repetem
  // muito (vários comentários no mesmo post), então juntamos os dois conjuntos
  // e resolvemos os distintos numa chamada só.
  const mediaIds = [
    ...new Set([
      ...contagens.map((p) => p.id),
      ...events.map((e) => eventMedia(e.payload)?.id).filter((id) => Boolean(id)),
    ]),
  ] as string[];
  const posts: Map<string, PostRef> =
    account && mediaIds.length
      ? await resolvePosts(account.ig_user_id, account.access_token, mediaIds)
      : new Map();

  const opcoesPost: OpcaoPost[] = contagens.map((p) => ({
    id: p.id,
    total: p.total,
    thumb: posts.get(p.id)?.thumb ?? null,
    caption: posts.get(p.id)?.caption ?? null,
  }));

  const filtrando = hasFilters(filtros);

  // As duas seções dividem uma barra de endereço, e agora dividem também um dono
  // dela: é ele quem segura os dois conjuntos de filtro e quem escreve na URL.
  // As barras só leem o que ele tem; o que esmaece enquanto a navegação corre
  // são os números e as listas, que é onde o dado muda.
  return (
    <DonoDosFiltros eventos={filtros} envios={envios}>
      <div className="space-y-10">
        <section className="space-y-3">
          <div>
            {/* O título antigo dizia "Tudo que o robô mandou por você", e 20 das
                28 linhas eram resposta digitada pelo dono na caixa de entrada. A
                lista é das DUAS origens, e agora diz isso. */}
            <h1 className="titulo text-2xl font-bold">Tudo que saiu da sua conta</h1>
            <p className={`mt-1 text-sm ${muted}`}>
              O que o robô enviou por você e o que você mesmo respondeu — e o que ainda está a
              caminho.
            </p>
            {account && <FiltrosEnvios />}
            {account && (
              <Carregando secao="envios">
                <p className={`mt-2 text-xs ${muted}`}>
                  <b className="font-semibold">{totalEnvios}</b>{" "}
                  {totalEnvios === 1 ? "envio" : "envios"}
                  {filtrandoEnvios && " neste recorte"}
                  {resumoEnvios && ` · ${resumoEnvios}`}
                  {totalEnvios > ENVIOS_LIMIT && ` · mostrando os ${ENVIOS_LIMIT} mais recentes`}
                </p>
              </Carregando>
            )}
          </div>

          <Carregando secao="envios">
            {!queue.length ? (
              <div
                className={`flex flex-col items-center gap-3 p-6 text-center text-sm ${card} ${muted}`}
              >
                {!account ? (
                  <p>Conecte uma conta do Instagram primeiro.</p>
                ) : filtrandoEnvios ? (
                  <>
                    <p>Nenhum envio com esses filtros.</p>
                    {/* Limpa só os filtros DESTA seção: os da de baixo seguem. */}
                    <LimparSecao
                      secao="envios"
                      className="font-semibold text-tinta underline decoration-quieto/50 underline-offset-2 hover:decoration-tinta dark:text-tinta-escuro dark:decoration-quieto-escuro/50"
                    />
                  </>
                ) : (
                  <p>
                    Nenhuma mensagem enviada ainda. Assim que alguém comentar sua palavra-chave,
                    aparece aqui.
                  </p>
                )}
              </div>
            ) : (
              <div className={tableWrap}>
                <table className="w-full text-left text-sm">
                  <thead className={thead}>
                    <tr>
                      <th className="px-3 py-2">Para quem</th>
                      <th className="px-3 py-2">O que foi enviado</th>
                      <th className="px-3 py-2">Quando</th>
                    </tr>
                  </thead>
                  <tbody className={rowDivide}>
                    {queue.map((q) => {
                      // O MOTIVO VAI JUNTO DO STATUS, e é ele que separa os
                      // dois fatos que `skipped` guarda: o SISTEMA pulou (janela
                      // de 24h fechada, lote vencido) e o DONO cancelou. Até
                      // 10/09/2026 a linha do post cancelado dizia "Não
                      // enviada", que lê como falha sobre uma decisão de quem
                      // está lendo a tela. Ver `statusBadge` (app/labels.ts).
                      const badge = statusBadge(q.status, q.error);
                      const erro = friendlyError(q.error);
                      // A coluna "Situação" saiu: 28 de 28 linhas diziam "Entregue".
                      // Ela virou filtro, e a contagem lá em cima diz o placar
                      // completo. O selo só aparece na linha que FOGE do normal —
                      // que é a única em que ele informava alguma coisa.
                      const normal = q.status === "sent";
                      // A PUBLICAÇÃO NÃO TEM CONTATO, e por isso a reserva
                      // "Visitante" mentia aqui. A decisão é de `paraQuemLabel`
                      // (app/labels.ts), com caso por saída; o avatar usa a
                      // MESMA palavra para não haver duas respostas na linha.
                      const paraQuem = paraQuemLabel(q);
                      // A DATA DA LINHA DEIXOU DE SER `sent_at ?? created_at`,
                      // e o defeito que isso conserta foi medido em 04/09: um
                      // post marcado para o dia 20, criado hoje, aparecia nesta
                      // coluna com a DATA DE HOJE — a data em que foi agendado,
                      // e nao a em que sai. Vale para qualquer tipo, e nao so
                      // para publicacao: o lote guardado tinha o mesmo
                      // problema. Ver `dataDaLinhaDeEnvio` (lib/publicacao.ts).
                      const quando = dataDaLinhaDeEnvio(q);
                      return (
                        <tr key={q.id}>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Avatar
                                src={q.person_pic}
                                name={paraQuem}
                                className="h-6 w-6"
                                textClassName="text-[11px]"
                              />
                              <span className="truncate font-medium">{paraQuem}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="inline-flex flex-wrap items-center gap-2">
                              {kindLabel(q.kind)}
                              {!normal && <span className={badge.className}>{badge.label}</span>}
                            </span>
                            {erro && <p className={`max-w-md text-xs ${muted}`}>{erro}</p>}
                          </td>
                          <td className={`whitespace-nowrap px-3 py-1.5 text-xs ${muted}`}>
                            {/* A FRASE VEM DE `fraseDaDataDaLinha`, e ate
                                09/09/2026 ela era decidida AQUI, com palavras
                                diferentes das da tela de agendados para o mesmo
                                fato. Esta e a tela do PASSADO, e a coluna dela
                                significa "quando aconteceu": uma data de futuro
                                sem aviso seria a mesma coluna querendo dizer
                                duas coisas — e um item ATRASADO (a hora venceu e
                                ele ainda esta na fila) tambem, que e o terceiro
                                caso que esta coluna nao distinguia. */}
                            {fraseDaDataDaLinha(quando)}
                            {fmtDate(quando.quando)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Carregando>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="titulo text-xl font-bold">O que aconteceu no seu Instagram</h2>
            <p className={`mt-1 text-sm ${muted}`}>
              Cada comentário, story respondido e mensagem que chegou até você.
            </p>
            {account && <Filtros posts={opcoesPost} />}
            {account && (
              <Carregando secao="eventos">
                <p className={`mt-3 text-xs ${muted}`}>
                  <b className="font-semibold">{total}</b>{" "}
                  {total === 1 ? "interação" : "interações"}
                  {filtrando && " neste recorte"}
                  {total > quantos && ` · mostrando as ${quantos} mais recentes`}
                </p>
              </Carregando>
            )}
          </div>

          <Carregando secao="eventos">
            {!events.length ? (
              <div
                className={`flex flex-col items-center gap-3 p-8 text-center text-sm ${card} ${muted}`}
              >
                {!account ? (
                  <p>Conecte uma conta do Instagram primeiro.</p>
                ) : filtrando ? (
                  <>
                    <p>Nenhuma interação com esses filtros.</p>
                    {/* Limpa só os filtros DESTA seção: os da de cima seguem. */}
                    <LimparSecao
                      secao="eventos"
                      className="font-semibold text-tinta underline decoration-quieto/50 underline-offset-2 hover:decoration-tinta dark:text-tinta-escuro dark:decoration-quieto-escuro/50"
                    />
                  </>
                ) : (
                  <p>
                    Nada por aqui ainda. Quando alguém interagir com seus posts, aparece nesta
                    lista.
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => {
                  const badge = eventBadge(e.type);
                  const texto = eventText(e.payload, e.type);
                  const quem = e.person_username ?? eventUsername(e.payload);
                  const media = eventMedia(e.payload);
                  return (
                    <li key={e.id} className={`px-4 py-3 ${card}`}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={badge.className}>{badge.label}</span>
                        {quem && (
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <Avatar
                              src={e.person_pic}
                              name={quem}
                              className="h-5 w-5"
                              textClassName="text-[11px]"
                            />
                            @{quem}
                          </span>
                        )}
                        <span className={`ml-auto text-xs ${muted}`}>
                          {fmtDate(e.created_at)}
                        </span>
                      </div>

                      {texto && (
                        <p className="mt-2 border-l-2 border-zinc-200 pl-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                          “<Realce texto={texto} termo={filtros.q} />”
                        </p>
                      )}

                      {media && <PostLine kind={media.kind} post={posts.get(media.id) ?? null} />}

                      <details className="mt-2">
                        <summary className={`cursor-pointer text-xs ${muted} hover:text-zinc-900 dark:hover:text-zinc-100`}>
                          Ver detalhes técnicos
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                          {JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carregando>

          {/* CARREGAR MAIS — achado M6, e o link é deliberadamente um `<Link>`
              comum e não um botão do dono dos filtros.

              `lib/eventos-url.ts` avisa que esta página já teve DOIS escritores
              para a mesma URL, e que o conserto foi centralizar tudo em
              `DonoDosFiltros`. Este link não reabre aquela porta porque `ver`
              NÃO é um campo daquele estado: o dono nunca o escreve e nunca o
              lê, então não há o que um sobrescrever do outro. O que acontece —
              e é o comportamento certo — é que trocar um filtro reconstrói a
              URL por `queryDaPagina`, que não conhece `ver`, e o feed volta à
              primeira página.

              O `href` carrega os filtros do render do servidor. Clicar aqui
              durante uma navegação de filtro em voo é a mesma corrida de
              clicar qualquer link no meio de uma navegação, e o desfecho é
              benigno: uma das duas vence inteira. */}
          {/* O BOTÃO SOME QUANDO NÃO HÁ MAIS O QUE CARREGAR, e isso é conserto
              de um defeito achado por revisão em 11/09/2026: a condição era só
              `events.length >= quantos`, e `quantosEventos` corta em
              MAX_DO_FEED. Numa conta com 300 eventos a pessoa clicava sete
              vezes até `ver=200`, o botão continuava desenhado, e a oitava
              recarregava a página inteira para devolver exatamente os mesmos
              200. Nada na tela dizia que tinha acabado. */}
          {account && events.length >= quantos && quantos < MAX_DO_FEED && (
            /* A ÂNCORA É AQUI, E NÃO `#conteudo`. A primeira versão apontava
               para o `<main id="conteudo">`, que é o começo do documento: a
               pessoa rolava 25 eventos, clicava, e o navegador a depositava no
               `<h1>` — para ver os 25 novos ela rolava de novo os 25 que já
               tinha lido, a cada clique. */
            <div id="mais-interacoes" className="flex scroll-mt-24 justify-center pt-1">
              <a
                href={`/eventos?${new URLSearchParams({
                  ...Object.fromEntries(
                    Object.entries(params).flatMap(([k, v]) =>
                      k === "ver" || v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]]
                    )
                  ),
                  ver: String(quantos + PASSO_DO_FEED),
                }).toString()}#mais-interacoes`}
                className={btnGhost}
              >
                Carregar mais {PASSO_DO_FEED}
              </a>
            </div>
          )}
        </section>
      </div>
    </DonoDosFiltros>
  );
}
