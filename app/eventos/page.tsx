import { sql, ensureSchema, QueueItem } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
import { card, muted, tableWrap, thead, rowDivide } from "../ui";
import {
  eventBadge,
  kindLabel,
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
import { resolvePosts, type PostRef } from "@/lib/media-lookup";
import { EVENTS_LIMIT, parseFilters, hasFilters } from "@/lib/event-filters";
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

// Quantos posts o seletor oferece. Mais que isso vira parede de miniaturas e
// estoura o teto de buscas avulsas do resolvePosts().
const POSTS_NO_SELETOR = 12;

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensureSchema();
  const account = await getSelectedAccount();
  const params = await searchParams;
  const filtros = parseFilters(params);
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
             order by e.created_at desc limit ${EVENTS_LIMIT}`,
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
            <h1 className="text-2xl font-bold">Tudo que saiu da sua conta</h1>
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
                      className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
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
                      const badge = statusBadge(q.status);
                      const erro = friendlyError(q.error);
                      // A coluna "Situação" saiu: 28 de 28 linhas diziam "Entregue".
                      // Ela virou filtro, e a contagem lá em cima diz o placar
                      // completo. O selo só aparece na linha que FOGE do normal —
                      // que é a única em que ele informava alguma coisa.
                      const normal = q.status === "sent";
                      return (
                        <tr key={q.id}>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Avatar
                                src={q.person_pic}
                                name={q.person_name ?? q.person_username ?? "?"}
                                className="h-6 w-6"
                                textClassName="text-[10px]"
                              />
                              <span className="truncate font-medium">
                                {q.person_username
                                  ? `@${q.person_username}`
                                  : q.person_name ?? "Visitante"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="inline-flex flex-wrap items-center gap-2">
                              {kindLabel(q.kind)}
                              {!normal && <span className={badge.className}>{badge.label}</span>}
                            </span>
                            {erro && <p className="max-w-md text-xs text-zinc-500">{erro}</p>}
                          </td>
                          <td className={`whitespace-nowrap px-3 py-1.5 text-xs ${muted}`}>
                            {fmtDate(q.sent_at ?? q.created_at)}
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
            <h2 className="text-xl font-bold">O que aconteceu no seu Instagram</h2>
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
                  {total > EVENTS_LIMIT && ` · mostrando as ${EVENTS_LIMIT} mais recentes`}
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
                      className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
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
                              textClassName="text-[9px]"
                            />
                            @{quem}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-zinc-500">
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
                        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
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
        </section>
      </div>
    </DonoDosFiltros>
  );
}
