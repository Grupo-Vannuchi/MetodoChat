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
  campoUrlDoFiltro,
  resumoDasCategorias,
  casoDaListaDeEmail,
} from "@/lib/categorias";
import {
  campoDoFiltro,
  destinoDoLote,
  linhasDoDestino,
  hojeNoFusoDoPrazo,
} from "@/lib/lote";
import {
  normalizarBusca,
  casaComBusca,
  recorteDaTabela,
  BUSCA_MAX,
} from "@/lib/busca-de-contatos";
import { avisoDaUrl } from "@/lib/avisos";
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
  badgeAcao,
  badgeNeutral,
  emptyWrap,
  alertOk,
  alertError,
  numero,
  link,
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
        <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
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
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        aberta
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {aberta ? "aberta" : "fechada"}
    </span>
  );
}

// A coluna de e-mail só aparece na lista de quem tem e-mail — na outra ela
// seria uma coluna inteira de travessões.
// A TABELA CORTA, E DIZ QUANTO CORTOU — achado M6.
//
// MEDIDO EM 11/09/2026: `/contatos` tinha 8477px, catorze telas de rolagem, e
// 7887 deles eram 127 linhas a 61px. O volume não era enfeite; era uma linha
// por contato. Compactar a linha levaria a página a ~6300px, ainda dez telas —
// o que resolve é mostrar menos, e dar um jeito de achar quem se procura (a
// busca, logo acima).
//
// O NÚMERO DE ESCONDIDAS NÃO É DECORAÇÃO. O comentário da consulta desta página
// explica por que o `limit 200` anterior era um DEFEITO: ele cortava calado, e
// "todos (200)" numa conta de 250 era mentira. O mesmo comentário escreve o
// caminho — *"uma paginação que diz o próprio tamanho, e não um corte calado
// com outro número"* —, e é o que `recorteDaTabela` serve.
function Tabela({ rows, comEmail }: { rows: Row[]; comEmail: boolean }) {
  const { mostradas, escondidas } = recorteDaTabela(rows);
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
          {mostradas.map((c) => (
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
      {escondidas > 0 && (
        <p className={`border-t border-traco px-4 py-2.5 text-xs dark:border-traco-escuro ${muted}`}>
          Mostrando{" "}
          <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
            {mostradas.length}
          </span>{" "}
          de{" "}
          <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
            {rows.length}
          </span>{" "}
          — use a busca acima, ou uma categoria, para achar quem você procura.
        </p>
      )}
    </div>
  );
}

export default async function ContatosPage({
  searchParams,
}: {
  // `aviso` e `tom` chegam do `redirect` das duas ações desta tela
  // (./actions.ts). São texto de URL, digitável por qualquer um — quem os lê
  // e os valida é `avisoDaUrl` (lib/avisos.ts), e não este componente.
  searchParams: Promise<{ categoria?: string; aviso?: string; tom?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filtro = filtroDaUrl(sp.categoria);
  // O QUE A AÇÃO ANTERIOR FEZ, se houve uma. A decisão do tom é de
  // `avisoDaUrl`: um tom desconhecido cai em "erro", e nunca vira classe de
  // CSS montada com texto vindo de fora.
  const aviso = avisoDaUrl(sp.aviso, sp.tom);
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

  // A BUSCA VEM DEPOIS DO FILTRO DE CATEGORIA E ANTES DAS DUAS LISTAS.
  //
  // A ORDEM É A DECISÃO: as FICHAS continuam contando a conta inteira (o
  // comentário acima diz por quê), o ALCANCE do lote continua contando o
  // recorte de categoria — quem clica em "todos (127)" e confirma manda para
  // 127, busque ou não busque —, e a BUSCA só afeta o que a TABELA mostra.
  //
  // Se a busca entrasse antes de `destinoDoLote`, o formulário passaria a
  // prometer um número e a ação a enfileirar outro. É a mesma família do
  // Crítico de 01/09, por um caminho novo: tela e ação contando conjuntos
  // diferentes. `visiveis` continua sendo o conjunto do ENVIO; `achados` é o
  // conjunto da LEITURA.
  const busca = normalizarBusca(sp.q);
  const achados = busca ? visiveis.filter((c) => casaComBusca(c, busca)) : visiveis;

  const comEmail = achados.filter((c) => c.email);
  const semEmail = achados.filter((c) => !c.email);
  const semNome = rows.filter((c) => !c.username).length;

  // O PISO DO CAMPO DE PRAZO, calculado aqui e não no JSX. Um dia já passado
  // naquele campo é o caminho mais curto para um lote que não sai: todo item
  // vira `skipped` na primeira drenagem, antes de qualquer envio. O fuso é o do
  // PRAZO, e vem da mesma constante de `validadeDoDia` — ver `hojeNoFusoDoPrazo`
  // (lib/lote.ts) para o porquê de não ser `toISOString()` nem `-3h`.
  const hoje = hojeNoFusoDoPrazo();

  // A decisão de qual texto a seção "Com e-mail" mostra — e se "Sem e-mail"
  // ainda faz sentido na tela — é de `casoDaListaDeEmail` (lib/categorias.ts),
  // não do JSX abaixo: ver o comentário lá para o porquê.
  const filtrado = filtro.tipo === "uma";
  const caso = casoDaListaDeEmail({
    visiveis: achados.length,
    comEmail: comEmail.length,
    filtrado,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo text-2xl font-bold">Contatos</h1>
          {account && (
            <p className={`text-sm ${muted}`}>
              de @{account.username ?? account.ig_user_id} · {rows.length}{" "}
              {rows.length === 1 ? "pessoa" : "pessoas"}
            </p>
          )}
        </div>
        {semNome > 0 && (
          <form action={atualizarPerfis}>
            {/* O RECORTE VAI JUNTO, pelo mesmo campo do formulário de envio:
                sem ele, o aviso de volta levaria quem estava filtrando por
                uma categoria de volta para a conta inteira. `campoDoFiltro`
                (lib/lote.ts) é quem distingue "todos" de "sem categoria".

                E `atualizarPerfis` (./actions.ts) LÊ este campo — até 02/09 não
                lia, a assinatura dela nem recebia `FormData`, e este comentário
                afirmava o contrário do de lá. A BUSCA continua sendo sobre a
                conta inteira; o que o recorte decide é só o caminho de volta. */}
            <input type="hidden" name="categoria" value={campoDoFiltro(filtro)} />
            <button className={btnGhost}>Buscar nomes ({semNome} sem nome)</button>
          </form>
        )}
      </div>

      {/* A FAIXA DO QUE ACABOU DE ACONTECER — no molde de app/setup/page.tsx.
          Fica ANTES do ramo de lista vazia de propósito: a recusa "esta conta
          ainda não tem contatos" chega justamente numa tela sem ninguém. */}
      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      {rows.length === 0 ? (
        <div className={`p-8 text-center text-sm ${card} ${muted}`}>
          {account ? "Ninguém interagiu ainda." : "Conecte uma conta do Instagram primeiro."}
        </div>
      ) : (
        <div className="space-y-10">
          <div className="flex flex-wrap gap-2">
            <Link href="/contatos" className={filtro.tipo === "tudo" ? badgeAcao : badgeNeutral}>
              todos ({rows.length})
            </Link>
            {fichas.map((f) => (
              <Link
                key={f.nome ?? "__sem__"}
                href={urlComFiltro("/contatos", { tipo: "uma", nome: f.nome })}
                className={fichaSelecionada(filtro, f.nome) ? badgeAcao : badgeNeutral}
              >
                {f.nome ?? "sem categoria"} · {f.total} · {f.alcancaveis} alcançáveis
              </Link>
            ))}
          </div>

          {/* A BUSCA — achado M6, e é ela que torna o corte da tabela honesto.
              Sem um jeito de achar alguém, mostrar 25 de 127 seria esconder;
              com ela, 25 é o que cabe na tela e o resto está a uma palavra.

              FORMULÁRIO GET, SEM JAVASCRIPT: submete no Enter, funciona com o
              botão de voltar, e o resultado é um endereço que se copia.

              O CAMPO ESCONDIDO DA CATEGORIA SÓ EXISTE QUANDO DEVE EXISTIR, e
              esse `null` é a defesa contra o Crítico de 01/09 por uma porta
              nova. Um `<input type="hidden">` sempre presente apagaria a
              diferença entre `?categoria=` AUSENTE ("todos") e PRESENTE-E-VAZIO
              ("sem categoria") — e buscar dentro de "todos" cairia em "sem
              categoria". `campoUrlDoFiltro` (lib/categorias.ts) devolve `null`
              justamente para mandar NÃO renderizar, e um caso de
              `tests/categorias.test.ts` amarra a URL do formulário à mesma que
              a ficha produz. */}
          <form method="get" action="/contatos" className="flex flex-wrap items-center gap-2">
            {campoUrlDoFiltro(filtro) !== null && (
              <input type="hidden" name="categoria" value={campoUrlDoFiltro(filtro)!} />
            )}
            <input
              type="search"
              name="q"
              defaultValue={busca ?? ""}
              maxLength={BUSCA_MAX}
              placeholder="Buscar por @, nome ou e-mail…"
              className={`${input} max-w-xs flex-1`}
            />
            <button type="submit" className={btnGhost}>
              Buscar
            </button>
            {busca && (
              <Link href={urlComFiltro("/contatos", filtro)} className={`text-xs ${link}`}>
                limpar
              </Link>
            )}
          </form>

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
              {/* MANDAR PARA ESTE RECORTE — E ELE FICA FECHADO ATÉ ALGUÉM PEDIR.
                  
                  ACHADO D4 DA AUDITORIA: este formulário era a PRIMEIRA coisa da
                  página, montado, com "todos (125)" pré-selecionado e o botão
                  "Enviar" visível sem rolar. Quem abria Contatos para OLHAR
                  contatos encontrava um disparo para 125 pessoas armado, a um
                  clique da única barreira que existia (a confirmação).

                  `<details>` e não um botão de cliente: ele é um controle de
                  divulgação de verdade — teclado e leitor de tela já o
                  entendem —, não custa nenhum `"use client"` novo e não mexe em
                  uma linha da ação de servidor. A confirmação obrigatória
                  continua onde estava; o que muda é que agora são DOIS gestos
                  deliberados até o envio, e nenhum deles acontece por rolagem.

                  E ele encolhe a página, que é metade do achado M6: `/contatos`
                  media 8777px, e este bloco é a maior peça fixa dela. */}
              <details className={`group ${subtle}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium">
                  <span>
                    Mandar mensagem para {visiveis.length}{" "}
                    {visiveis.length === 1 ? "pessoa" : "pessoas"}
                  </span>
                  <span className={`text-xs ${muted} group-open:hidden`}>abrir</span>
                  <span className={`hidden text-xs ${muted} group-open:inline`}>fechar</span>
                </summary>
              <form action={enviarLote} className="space-y-3 border-t border-traco p-4 dark:border-traco-escuro">
                {/* O CAMPO CARREGA A FORMA DO FILTRO, E NÃO O VALOR CRU DA URL.
                    Com `sp.categoria ?? ""`, a ficha "sem categoria"
                    (`?categoria=` vazio) e "todos" (`?categoria=` ausente)
                    chegavam à ação como a MESMA string vazia — campo escondido
                    sempre existe no DOM, então a presença do parâmetro, que é
                    quem distingue os dois pedidos, se perdia aqui. A tela
                    prometia 16 e a ação enfileirava para 126. Ver `campoDoFiltro`
                    (lib/lote.ts). */}
                <input type="hidden" name="categoria" value={campoDoFiltro(filtro)} />
                {/* O ALCANCE, EM DOIS IRMÃOS E UMA ANOTAÇÃO — achado D5.
                    Antes eram três itens iguais empilhados, somando 181 de 125
                    pessoas: `improvaveis` é RECORTE de `esperam` (ver
                    `destinoDoLote`, que só o incrementa dentro daquele ramo), e
                    três irmãos leem como três partes de um todo.

                    A forma vem de `linhasDoDestino` (lib/lote.ts) e os casos de
                    `tests/lote.test.ts` prendem as duas igualdades. Esta tela
                    não decide mais quem contém quem — ela só RECUA o que a
                    função marcou como aninhado. */}
                <ul className={`space-y-0.5 text-xs ${muted}`}>
                  {linhasDoDestino(destino).map((l) => (
                    <li
                      key={l.chave}
                      className={l.aninhada ? "ml-4 border-l border-traco pl-2.5 dark:border-traco-escuro" : ""}
                    >
                      <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
                        {l.n}
                      </span>{" "}
                      {l.texto}
                    </li>
                  ))}
                </ul>
                <textarea name="texto" required rows={3} className={`w-full ${input}`}
                  placeholder="O que você quer dizer" />
                <input name="url" className={`w-full ${input}`} placeholder="Link (opcional)" />
                <input name="rotulo" className={`w-full ${input}`}
                  placeholder="Texto do botão (só com link)" />
                <label className={`block text-xs ${muted}`}>
                  Vale até (vazio = sem prazo)
                  {/* `min` É CONSERTO, E NÃO POLIMENTO: sem ele, um dia no
                      passado escolhido por engano faz TODO item do lote virar
                      `skipped` na primeira drenagem — nada sai, nada vai sair.
                      `hojeNoFusoDoPrazo` (lib/lote.ts) é a mesma fonte de fuso
                      de `validadeDoDia`, que é quem lê este campo do outro lado.
                      O navegador é conveniência; quem fecha o outro lado é a
                      contagem dos cinco status em `enviarLote`. */}
                  <input
                    type="date"
                    name="valido_ate"
                    min={hoje}
                    className={`mt-1 w-full ${input}`}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="confirmado" value="1" required />
                  Confirmo que quero mandar para estas {visiveis.length} pessoas
                </label>
                <button type="submit" className={btnPrimary}>Enviar</button>
              </form>
              </details>

              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="titulo flex items-center gap-2 text-lg font-bold">
                      <IconMail className="h-4 w-4 text-quieto dark:text-quieto-escuro" />
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
                    <h2 className="titulo flex items-center gap-2 text-lg font-bold">
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
