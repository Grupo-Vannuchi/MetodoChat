import Link from "next/link";
import { sql, Contact } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
import { windowState } from "@/lib/inbox-window";
import {
  filtroDaUrl,
  contatosDoFiltro,
  fichaSelecionada,
  urlComFiltro,
  resumoDasCategorias,
  casoDaListaDeEmail,
} from "@/lib/categorias";
import { atualizarPerfis } from "./actions";
import {
  card,
  btnGhost,
  muted,
  tableWrap,
  thead,
  rowDivide,
  badgeOk,
  badgeNeutral,
  emptyWrap,
} from "../ui";
import { IconMail, IconUsers } from "../icons";
import Avatar from "../avatar";

export const dynamic = "force-dynamic";

type Row = Contact & { automation_name: string | null };

function Pessoa({ c }: { c: Row }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar
        src={c.profile_pic}
        name={c.name ?? c.username ?? "?"}
        className="h-10 w-10"
        textClassName="text-sm"
      />
      <div className="min-w-0">
        <p className="truncate font-medium">
          {c.username ? `@${c.username}` : c.name ?? "Sem nome"}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {c.username && c.name ? c.name : `id ${c.ig_id}`}
        </p>
      </div>
    </div>
  );
}

function Janela({ c }: { c: Row }) {
  // A MESMA função que o motor de envio usa para recusar (`lib/queue-drain.ts`).
  // Aqui havia `hoursAgo(...) < 24`, uma segunda regra — e ela é QUASE igual:
  // `windowState` fecha 5 minutos antes, e nessa faixa a lista dizia "aberta"
  // sobre alguém que o envio recusaria. Cerca de 7 travessias por dia, de 5
  // minutos cada, medido em 31/08/2026.
  const aberta = windowState(c.last_reply_at).open;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        aberta
          ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400"
          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500"
      }`}
    >
      {aberta ? "aberta" : "fechada"}
    </span>
  );
}

// A coluna de e-mail só aparece na lista de quem tem e-mail — na outra ela
// seria uma coluna inteira de travessões.
function Tabela({ rows, comEmail }: { rows: Row[]; comEmail: boolean }) {
  return (
    <div className={tableWrap}>
      <table className="w-full text-left text-sm">
        <thead className={thead}>
          <tr>
            <th className="px-4 py-3">Pessoa</th>
            <th className="px-4 py-3">Categoria</th>
            {comEmail && <th className="px-4 py-3">E-mail</th>}
            <th className="px-4 py-3">Primeiro contato</th>
            <th className="px-4 py-3">Última resposta</th>
            <th className="px-4 py-3">Janela de 24h</th>
            <th className="px-4 py-3">Última automação</th>
          </tr>
        </thead>
        <tbody className={rowDivide}>
          {rows.map((c) => (
            <tr key={c.ig_id}>
              <td className="px-4 py-2.5">
                <Pessoa c={c} />
              </td>
              <td className={`px-4 py-2.5 ${muted}`}>{c.categoria ?? "—"}</td>
              {comEmail && (
                <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{c.email}</td>
              )}
              <td className={`px-4 py-2.5 ${muted}`}>{fmtDate(c.first_contact_at)}</td>
              <td className={`px-4 py-2.5 ${muted}`}>{fmtDate(c.last_reply_at)}</td>
              <td className="px-4 py-2.5">
                <Janela c={c} />
              </td>
              <td className={`px-4 py-2.5 ${muted}`}>{c.automation_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const sp = await searchParams;
  const filtro = filtroDaUrl(sp.categoria);
  const account = await getSelectedAccount();
  const rows = account
    ? ((await sql().query(
        `select c.*, a.name as automation_name
         from contacts c
         left join automations a on a.id = c.last_automation_id
         where c.account_id = $1
         order by c.first_contact_at desc
         limit 200`,
        [account.ig_user_id]
      )) as Row[])
    : [];

  // As fichas contam o conjunto INTEIRO da conta — não o filtrado —, para os
  // números não mudarem quando alguém clica num filtro. O filtro em si é
  // aplicado em memória sobre o resultado; ver a nota no plano da tarefa 3
  // sobre por que não é uma segunda consulta.
  const fichas = resumoDasCategorias(rows);
  // QUEM DECIDE O FILTRO É `lib/categorias.ts`, e não este arquivo: `?categoria=`
  // ausente e `?categoria=` vazio normalizam para o mesmo nome e NÃO são o mesmo
  // pedido, e essa linha vivia aqui defendida só por um comentário. Agora ela
  // tem caso em `tests/categorias.test.ts`, que fica vermelho quando ela muda.
  const visiveis = contatosDoFiltro(rows, filtro);

  const comEmail = visiveis.filter((c) => c.email);
  const semEmail = visiveis.filter((c) => !c.email);
  const semNome = rows.filter((c) => !c.username).length;

  // A decisão de qual texto a seção "Com e-mail" mostra — e se "Sem e-mail"
  // ainda faz sentido na tela — é de `casoDaListaDeEmail` (lib/categorias.ts),
  // não do JSX abaixo: ver o comentário lá para o porquê.
  const filtrado = filtro.tipo === "uma";
  const caso = casoDaListaDeEmail({
    visiveis: visiveis.length,
    comEmail: comEmail.length,
    filtrado,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          {account && (
            <p className={`text-sm ${muted}`}>
              de @{account.username ?? account.ig_user_id} · {rows.length}{" "}
              {rows.length === 1 ? "pessoa" : "pessoas"}
            </p>
          )}
        </div>
        {semNome > 0 && (
          <form action={atualizarPerfis}>
            <button className={btnGhost}>Buscar nomes ({semNome} sem nome)</button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className={`p-8 text-center text-sm ${card} ${muted}`}>
          {account ? "Ninguém interagiu ainda." : "Conecte uma conta do Instagram primeiro."}
        </div>
      ) : (
        <div className="space-y-10">
          <div className="flex flex-wrap gap-2">
            <Link href="/contatos" className={filtro.tipo === "tudo" ? badgeOk : badgeNeutral}>
              todos ({rows.length})
            </Link>
            {fichas.map((f) => (
              <Link
                key={f.nome ?? "__sem__"}
                href={urlComFiltro("/contatos", { tipo: "uma", nome: f.nome })}
                className={fichaSelecionada(filtro, f.nome) ? badgeOk : badgeNeutral}
              >
                {f.nome ?? "sem categoria"} · {f.total} · {f.alcancaveis} alcançáveis
              </Link>
            ))}
          </div>

          {caso === "filtro_vazio" ? (
            // O caso pior do Achado 1: um filtro que não casa ninguém (uma
            // categoria que deixou de existir, por exemplo). Antes, a seção
            // "Sem e-mail" sumia inteira (só renderiza com gente) e sobrava
            // só a frase de "Com e-mail" dizendo "ninguém informou e-mail" —
            // verdade por acidente, mentira por omissão: a tela nunca dizia
            // que o filtro não achou NINGUÉM.
            <div className={emptyWrap}>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nenhum contato nesta categoria
              </p>
              <p className={`max-w-sm text-xs ${muted}`}>
                O filtro não encontrou ninguém. Use “todos”, ali em cima, para ver a conta
                inteira.
              </p>
            </div>
          ) : (
            <>
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <IconMail className="h-4 w-4 text-indigo-500" />
                      Com e-mail
                    </h2>
                    <p className={`text-sm ${muted}`}>
                      {caso === "tem_email"
                        ? `${comEmail.length} ${comEmail.length === 1 ? "pessoa" : "pessoas"} — prontas para sua lista`
                        : caso === "sem_email_no_filtro"
                          ? "Ninguém nesta categoria informou e-mail ainda."
                          : "Ninguém informou o e-mail ainda. Ligue “Pedir o e-mail antes do link” numa automação."}
                    </p>
                  </div>
                  {comEmail.length > 0 && (
                    <a href="/api/contatos/csv" className={btnGhost} download>
                      Exportar CSV
                    </a>
                  )}
                </div>
                {comEmail.length > 0 && <Tabela rows={comEmail} comEmail />}
              </section>

              {semEmail.length > 0 && (
                <section>
                  <div className="mb-4">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <IconUsers className="h-4 w-4 text-zinc-400" />
                      Sem e-mail
                    </h2>
                    <p className={`text-sm ${muted}`}>
                      {semEmail.length} {semEmail.length === 1 ? "pessoa" : "pessoas"} que
                      interagiram mas não informaram e-mail
                    </p>
                  </div>
                  <Tabela rows={semEmail} comEmail={false} />
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
