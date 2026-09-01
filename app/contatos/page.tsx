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
import { campoDoFiltro, destinoDoLote } from "@/lib/lote";
import { atualizarPerfis, enviarLote } from "./actions";
import {
  card,
  btnGhost,
  btnPrimary,
  muted,
  subtle,
  input,
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
// O TETO VALE PARA AS AÇÕES DESTA PÁGINA, e `enviarLote` drena a fila antes de
// responder: uma drenagem é até 15 envios com 600 ms entre eles, ~9 segundos.
// O padrão da plataforma é curto demais para isso, e um corte no meio deixaria
// o dono sem saber quantos saíram. Mesmo teto das rotas que já drenam
// (app/api/queue/tick, app/api/cron/daily).
export const maxDuration = 60;

type Row = Contact & { automation_name: string | null; recebidas: number };

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
  // SEM `limit`, E ISSO É A CORREÇÃO DE UM DEFEITO, não uma folga.
  //
  // A consulta tinha `limit 200`, e as fichas — inclusive o número de
  // alcançáveis, que é o que justifica esta funcionalidade inteira — eram
  // contadas sobre no máximo 200 linhas. Nada na tela dizia que houve corte:
  // uma conta com 250 contatos mostraria "todos (200)".
  //
  // O CORTE ERA POR `first_contact_at desc`, E ALCANCE NÃO TEM NADA A VER COM
  // ISSO. Medido em 31/08/2026 na conta maior (106 contatos): os alcançáveis
  // estão nas posições 1, 2, 3, 45, 97, 100 e 103 dessa ordem — quatro dos sete
  // na metade de baixo. Quem tem primeiro contato antigo e respondeu há uma hora
  // é alcançável de verdade, o motor enviaria, e sairia da contagem em silêncio.
  // A tela deixaria de casar com o motor, que é o defeito que esta branch existe
  // para impedir.
  //
  // HOJE O CORTE NÃO CORTA NADA (126 contatos ao todo, a maior conta com 106),
  // e é por isso que ele passou despercebido. Mas os 126 entraram TODOS nas
  // últimas 6 semanas, e ~21 por semana, dos quais a conta maior fica com uns
  // 84%: ela precisa de 94 contatos para chegar aos 200, ou cerca de CINCO
  // SEMANAS no ritmo de hoje. É prazo de mês, e não de ano.
  //
  // POR QUE NÃO CONTAR NO SQL e deixar o `limit` na tabela: contar alcançáveis
  // em SQL exigiria uma janela de 24h cravada na consulta — uma SEGUNDA fonte
  // para a janela, que é exatamente o que esta branch removeu (`windowState`,
  // lib/inbox-window.ts, é a mesma que `lib/queue-drain.ts` usa para recusar, e
  // ela só roda em JS sobre linha carregada). Então as linhas TÊM de ser a conta
  // inteira.
  //
  // QUANDO ISTO PESAR, o caminho é uma paginação que diz o próprio tamanho, e
  // não um corte calado com outro número. Enquanto a maior conta couber numa
  // tabela, contar errado é pior que carregar tudo.
  const rows = account
    ? ((await sql().query(
        // `recebidas` é a MESMA subconsulta de `enviarLote` (app/contatos/actions.ts):
        // conta quantas vezes o contato já recebeu mensagem (evento de tipo
        // message/story_reply/abertura/quick_reply). É o que `destinoDoLote`
        // usa para o palpite de "provavelmente nunca" — duas conta iguais em
        // lugares diferentes é o mesmo risco que a tela e o CSV já correram.
        `select c.*, a.name as automation_name,
                (select count(*)::int from events e
                  where e.account_id = c.account_id
                    and e.payload->'sender'->>'id' = c.ig_id
                    and e.type in ('message','story_reply','abertura','quick_reply')) as recebidas
         from contacts c
         left join automations a on a.id = c.last_automation_id
         where c.account_id = $1
         order by c.first_contact_at desc`,
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

  const destino = destinoDoLote(
    visiveis.map((c) => ({
      ig_id: c.ig_id,
      last_reply_at: c.last_reply_at,
      recebidas: c.recebidas ?? 0,
    }))
  );

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
              {/* MANDAR PARA ESTE RECORTE.
                  Os dois primeiros números são fato; o terceiro é palpite, e a
                  palavra "provavelmente" fica na tela por isso. Ele NÃO é subtraído
                  dos outros dois: quem é improvável continua dentro de "esperam". */}
              <form action={enviarLote} className={`space-y-3 p-4 ${subtle}`}>
                {/* O CAMPO CARREGA A FORMA DO FILTRO, E NÃO O VALOR CRU DA URL.
                    Com `sp.categoria ?? ""`, a ficha "sem categoria"
                    (`?categoria=` vazio) e "todos" (`?categoria=` ausente)
                    chegavam à ação como a MESMA string vazia — campo escondido
                    sempre existe no DOM, então a presença do parâmetro, que é
                    quem distingue os dois pedidos, se perdia aqui. A tela
                    prometia 16 e a ação enfileirava para 126. Ver `campoDoFiltro`
                    (lib/lote.ts). */}
                <input type="hidden" name="categoria" value={campoDoFiltro(filtro)} />
                <p className="text-sm font-medium">
                  Mandar mensagem para {visiveis.length}{" "}
                  {visiveis.length === 1 ? "pessoa" : "pessoas"}
                </p>
                <ul className={`text-xs ${muted}`}>
                  <li>{destino.agora.length} recebem agora</li>
                  <li>{destino.esperam.length} quando voltarem a falar</li>
                  {/* O TEXTO CONTA O QUE `destinoDoLote` CONTA, e não outra
                      coisa: ela soma `recebidas <= 1` — zero OU uma —, e quem
                      tem zero nunca escreveu (chegou por comentar num post),
                      que é o caso MAIS forte de "provavelmente nunca". A frase
                      dizia "falaram uma única vez" e deixava esses de fora do
                      que o número já incluía. O comentário de `lib/lote.ts` foi
                      corrigido antes; a tela é a outra metade. */}
                  <li>
                    {destino.improvaveis} provavelmente nunca — nunca falaram, ou falaram uma
                    única vez
                  </li>
                </ul>
                <textarea name="texto" required rows={3} className={`w-full ${input}`}
                  placeholder="O que você quer dizer" />
                <input name="url" className={`w-full ${input}`} placeholder="Link (opcional)" />
                <input name="rotulo" className={`w-full ${input}`}
                  placeholder="Texto do botão (só com link)" />
                <label className={`block text-xs ${muted}`}>
                  Vale até (vazio = sem prazo)
                  <input type="date" name="valido_ate" className={`mt-1 w-full ${input}`} />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="confirmado" value="1" required />
                  Confirmo que quero mandar para estas {visiveis.length} pessoas
                </label>
                <button type="submit" className={btnPrimary}>Enviar</button>
              </form>

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
                    // O ENDEREÇO CARREGA O FILTRO, e o mesmo `urlComFiltro` das
                    // fichas o monta: este botão fica embaixo da frase que conta
                    // o filtro, e baixava a conta inteira.
                    <a
                      href={urlComFiltro("/api/contatos/csv", filtro)}
                      className={btnGhost}
                      download
                    >
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
