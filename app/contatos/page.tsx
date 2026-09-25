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
  CATEGORIAS_SUGERIDAS,
} from "@/lib/categorias";
import {
  campoDoFiltro,
  destinoDoLote,
  linhasDoDestino,
  hojeNoFusoDoPrazo,
} from "@/lib/lote";
import {
  normalizarBusca,
  recorteDaTabela,
  quantasLinhas,
  LIMITE_DA_TABELA,
  BUSCA_MAX,
} from "@/lib/busca-de-contatos";
import { emailDoContato, recortarTela, urlDaExportacao } from "@/lib/exportacao-de-contatos";
import { FaixaDaExportacaoCompleta } from "./faixa-da-exportacao";
import { avisoDaUrl } from "@/lib/avisos";
// OS QUATRO TIPOS DE "MENSAGEM RECEBIDA", DA MESMA FONTE que app/page.tsx e
// ./actions.ts: esta lista morava em TRÊS lugares até 15/09/2026, e o
// terceiro (app/page.tsx) nasceu com só um tipo — ver lib/event-filters.ts
// para a medição completa.
import { TIPOS_DE_MENSAGEM_RECEBIDA } from "@/lib/event-filters";
import { atualizarPerfis, enviarLote, marcarCategoriaEmLote } from "./actions";
import { MarcarTodas, ContadorDaSelecao } from "./selecao-client";
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
function Tabela({
  rows,
  comEmail,
  limite,
  maisHref,
  idDoForm,
  campoFiltro,
  q,
  linhas,
}: {
  rows: Row[];
  comEmail: boolean;
  limite: number;
  maisHref: string;
  /** Identidade do formulário: a Tarefa 5 alcança as caixas por ele. */
  idDoForm: string;
  campoFiltro: string;
  q: string | null;
  linhas: number;
}) {
  const { mostradas, escondidas } = recorteDaTabela(rows, limite);
  // A IDENTIDADE DA LISTA — o que responde "estas são as mesmas linhas de
  // antes?". Filtro e busca definem QUEM aparece; `limite`/`linhas` define
  // QUANTOS, e por isso fica de fora (ver a chave do `<form>`, abaixo).
  //
  // Concatenação e não template: o portão de `tests/selecao-nao-encolhe.test.ts`
  // lê este arquivo com os template literals removidos, e uma chave escrita com
  // crase ficaria invisível para ele.
  const identidadeDaLista = campoFiltro + "|" + (q ?? "");
  return (
    /* A TABELA INTEIRA É UM FORMULÁRIO, e o `group` é o que deixa a barra
       aparecer por CSS (veja o rodapé). `action` é Server Action: a página
       continua sem uma linha de cliente por causa disto. */
    <form
      action={marcarCategoriaEmLote}
      id={idDoForm}
      className="group"
      // A CHAVE É A IDENTIDADE DA LISTA, e ela existe para a seleção não
      // encolher sozinha.
      //
      // MEDIDO EM PRODUÇÃO em 16/09/2026: marquei três pessoas nas posições 4, 5
      // e 6, troquei o filtro, e sobrou UMA marcada. Ninguém errado foi marcado —
      // o conjunto só encolhe — e o contador diz a verdade, então a tela não
      // mente; mas duas seleções somem sem explicação, e quem aplicar a
      // categoria aplica a uma pessoa achando que aplicou a três.
      //
      // A CAUSA NÃO É O CONTADOR: as caixas são `<input>` NÃO-CONTROLADO, e o
      // React reconcilia por POSIÇÃO. Trocando o filtro, a lista é SUBSTITUÍDA e
      // sobrevive marcado só o que calha de cair no mesmo índice.
      //
      // `linhas` FICA DE FORA DA CHAVE DE PROPÓSITO. "Ver mais"
      // (`/contatos?linhas=50`) só ACRESCENTA linhas — as posições de cima não
      // se mexem —, e ali a seleção sobrevive INTEIRA hoje (medido: 3 de 3, com a
      // lista indo de 33 para 58). Pôr `linhas` aqui quebraria esse caminho para
      // consertar o outro.
      //
      // POR QUE NÃO PRESERVAR POR IDENTIDADE, que seria mais gentil: a seleção
      // teria de virar estado do React, e é exatamente isso que
      // `app/contatos/selecao-client.tsx` evita — as 143 linhas ficam do lado do
      // servidor, e nenhuma atravessa a fronteira de serialização. Lista nova,
      // seleção nova é previsível; meio preservada não é nem uma coisa nem outra.
      key={identidadeDaLista}
    >
      {/* O LUGAR DE ONDE A PESSOA VEIO, para o redirect devolvê-la aqui.
          Sem estes três, limpar 143 contatos em blocos perderia o filtro, a
          busca e o `Ver mais` a cada clique. */}
      <input type="hidden" name="filtro" value={campoFiltro} />
      {q && <input type="hidden" name="q" value={q} />}
      <input type="hidden" name="linhas" value={String(linhas)} />
      {/* SUMIDOURO DA SUBMISSÃO IMPLÍCITA: Enter numa caixa clica o PRIMEIRO
          botão de submit do formulário, MESMO escondido — e o primeiro era
          `clientes`. Sem `name`, este não manda `categoria`, e a ação cai na
          recusa que já existe e já tem caso de integração. `disabled` não serve:
          o navegador pula para o próximo botão. */}
      <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      <div className={tableWrap}>
      <table className="w-full text-left text-sm">
        <thead className={thead}>
          <tr>
            <th className="w-10 px-4 py-3">
              <MarcarTodas alvo={idDoForm} />
            </th>
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
                {/* `name="ig_id"` É O CONTRATO com o SERVIDOR
                    (`formData.getAll("ig_id")` em `marcarCategoriaEmLote`) e
                    não pode mudar. `data-contato` é o gancho do CSS da barra,
                    separado de propósito: enquanto os dois eram a mesma
                    string, a regra do Tailwind que troca `_` por espaço
                    dentro de valor arbitrário transformava
                    `input[name=ig_id]` em `input[name=ig id]` — seletor
                    inválido, que o compilador engolia como `:is()` vazio em
                    vez de acusar erro. A barra nunca aparecia, e nada nos
                    testes, no `tsc` ou no `next build` percebia. Com o nome
                    do campo servindo só o servidor e o atributo servindo só o
                    CSS, essa colisão deixa de poder acontecer. */}
                <label className="-m-2 flex cursor-pointer items-center p-2">
                  <input
                    type="checkbox"
                    name="ig_id"
                    data-contato=""
                    value={c.ig_id}
                    aria-label={`Selecionar ${c.username ? `@${c.username}` : c.name ?? `id ${c.ig_id}`}`}
                    className="h-4 w-4 cursor-pointer"
                  />
                </label>
              </td>
              <td className="px-4 py-2.5">
                <Pessoa c={c} />
              </td>
              <td className={`px-4 py-2.5 ${muted}`}>{c.categoria ?? "—"}</td>
              {comEmail && (
                // A CÉLULA LÊ O REGISTRO, E NÃO `c.email` — é o Passo 1 da
                // Parte 2 nesta linha. `emailDoContato`
                // (lib/exportacao-de-contatos.ts) faz a pergunta pela regra de
                // lib/variables.ts: vale o valor COLETADO e, na falta dele, a
                // coluna antiga. Com `c.email`, a tabela mostraria o e-mail
                // VELHO de quem trocou depois da Parte 1 — enquanto a DM já sai
                // com o novo — e sairia em BRANCO para quem só tem o registro,
                // apesar de a pessoa estar nesta tabela justamente porque o
                // corte (`temEmail`) achou o e-mail dela.
                //
                // É A MESMA FUNÇÃO DO CORTE E DA BUSCA, de propósito: a linha
                // que a tabela mostra, o número que a seção conta e o valor que
                // o arquivo leva têm de ser o mesmo e-mail.
                <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                  {emailDoContato(c)}
                </td>
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
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-t border-traco px-4 py-2.5 text-xs dark:border-traco-escuro ${muted}`}
        >
          <p>
            Mostrando{" "}
            <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
              {mostradas.length}
            </span>{" "}
            de{" "}
            <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
              {rows.length}
            </span>
            .
          </p>
          {/* A SAÍDA, sem a qual o corte esconde. Ela leva a tabela para
              `mostradas + LIMITE`, e não para "tudo": o objetivo continua sendo
              a página curta. */}
          <Link href={maisHref} className={`font-medium ${link}`}>
            Ver mais {Math.min(escondidas, LIMITE_DA_TABELA)}
          </Link>
        </div>
      )}
      </div>

      {/* A BARRA SÓ APARECE COM ALGUÉM MARCADO.

          O SENTIDO DA REGRA É DELIBERADO, e é o mesmo do campo de data em
          `/publicar/novo`: o padrão é ESCONDIDO e a variante MOSTRA. Se
          `group-has-[...]` não compilar num navegador antigo, a barra fica
          invisível e ninguém marca nada — falha para o lado seguro. Escrita ao
          contrário, uma falha de CSS deixaria quatro botões de ESCRITA sempre
          visíveis numa tela de leitura, que é o achado D4 por outra porta.

          O seletor diz `input[data-contato]` e não `input` porque a caixa de
          "selecionar todas" (Tarefa 5) também vive dentro deste `group` — ela
          não tem `data-contato` nem `name`, então marcá-la sozinha, sem linha
          nenhuma, não é seleção.

          O seletor NÃO usa `input[name=ig_id]`. `name="ig_id"` é o contrato
          com o servidor; `data-contato` é o gancho do CSS — propositalmente
          duas strings diferentes. Quando eram a mesma, a regra do Tailwind
          que troca `_` por espaço dentro de valor arbitrário convertia
          `input[name=ig_id]` em `input[name=ig id]`, um seletor inválido que
          o compilador aceitava calado como `:has(:is())` vazio: o CSS
          compilava, só nunca casava com nada, e a barra nunca aparecia — sem
          acusar em `tsc`, na suíte ou no `next build`. Separar o nome do
          campo do gancho do CSS tira do Tailwind qualquer chance de quebrar a
          tela por causa de como o servidor nomeia o campo.

          `sticky bottom-0`: a barra é o último filho do `<form>`, e com 25
          linhas a tabela passa de 1500px — sem `sticky` a barra acendia
          ~700px abaixo da dobra, fora da vista de quem acabou de marcar a
          primeira linha. E ela mora DENTRO do cartão (`rounded-b-2xl` +
          `border`, fundo `bg-white`/`dark:bg-zinc-900`) e não mais fora de
          `tableWrap`: por fora, o `border-t` dela encostava no `border`
          inferior do cartão — linha dupla, cantos quadrados contra o
          `rounded-2xl` do cartão, e fundo transparente por trás. */}
      <div className="sticky bottom-0 z-10 hidden flex-wrap items-center gap-2 rounded-b-2xl border border-traco bg-white px-4 py-2.5 group-has-[input[data-contato]:checked]:flex dark:border-traco-escuro dark:bg-zinc-900">
        <ContadorDaSelecao alvo={idDoForm} />
        <span className={`text-xs ${muted}`}>marcar como</span>
        {CATEGORIAS_SUGERIDAS.map((cat) => (
          <button key={cat} type="submit" name="categoria" value={cat} className={btnGhost}>
            {cat}
          </button>
        ))}
      </div>
    </form>
  );
}

export default async function ContatosPage({
  searchParams,
}: {
  // `aviso` e `tom` chegam do `redirect` das duas ações desta tela
  // (./actions.ts). São texto de URL, digitável por qualquer um — quem os lê
  // e os valida é `avisoDaUrl` (lib/avisos.ts), e não este componente.
  searchParams: Promise<{
    categoria?: string;
    aviso?: string;
    tom?: string;
    q?: string;
    linhas?: string;
  }>;
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
                    and e.type = any($2::text[])) as recebidas
         from contacts c
         left join automations a on a.id = c.last_automation_id
         where c.account_id = $1
         order by c.first_contact_at desc`,
        [account.ig_user_id, Array.from(TIPOS_DE_MENSAGEM_RECEBIDA)]
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
  // diferentes. `visiveis` continua sendo o conjunto do ENVIO; `tela.achados`
  // é o conjunto da LEITURA, e é por isso que ele nasce de outra função.
  const busca = normalizarBusca(sp.q);
  // QUANTAS LINHAS A TABELA MOSTRA. Cresce sob pedido, com teto — ver
  // `quantasLinhas`, e o defeito que ela conserta: sem saída, o corte em 25
  // tornava inalcançáveis os contatos 26 em diante de qualquer busca.
  const linhas = quantasLinhas(sp.linhas);

  // TUDO O QUE A TELA DERIVA DO RECORTE, NUMA CHAMADA SÓ: o recorte que os dois
  // botões de exportar carregam, os conjuntos das duas tabelas e o caso da
  // seção "Com e-mail". Quem deriva é `recortarTela`
  // (lib/exportacao-de-contatos.ts), e ela é PURA — cada ramo disto tem caso em
  // `tests/exportacao-de-contatos.test.ts`, o que aqui dentro é impossível:
  // esta página é `async` e consulta o Postgres, e teste nenhum a monta.
  //
  // ERAM QUATRO DERIVAÇÕES SEGUIDAS AQUI, DO MESMO TIPO — `rows`, `achados`,
  // `comEmail`, `semEmail` —, E ERA A ESCOLHA ENTRE ELAS O DEFEITO. Medido em
  // 24/09/2026: `contatos={comEmail}` no lugar de `contatos={rows}` na faixa de
  // exportar atravessou `tsc`, `eslint`, 1808 casos puros e 47 de DOM — a frase
  // contando só quem tem e-mail e o botão baixando todo mundo do recorte, que é
  // o defeito de 11/09/2026 com os papéis trocados. E `comEmail` nascia DUAS
  // LINHAS acima da faixa, alimentando a tabela logo abaixo dela. Um SEGUNDO
  // recorte remontado à mão no JSX, com a busca de fora, passava igual.
  //
  // COM UM OBJETO SÓ NÃO HÁ O QUE ESCOLHER, e a faixa recebe O OBJETO: não
  // existe conjunto solto para entregar por engano nem `Recorte` solto para
  // remontar no JSX. Os campos são lidos como `tela.algo` de propósito — é o
  // que deixa a procedência à vista em cada uso.
  //
  // O `caso` VEM JUNTO PELO MESMO MOTIVO, e não por arrumação. Quem decide qual
  // texto a seção "Com e-mail" mostra — e se "Sem e-mail" ainda faz sentido na
  // tela — continua sendo `casoDaListaDeEmail` (lib/categorias.ts), e o
  // comentário de lá diz por quê; o que mudou é QUEM o chama. Ele era montado
  // aqui com quatro números passados à mão, e um dos campos se chama `visiveis`
  // — o nome de uma variável desta função que é OUTRO conjunto (o do ENVIO).
  // `visiveis: visiveis.length` no lugar de `visiveis: achados.length` passava
  // por `tsc` e pelas três suítes, e reabria em silêncio o ramo `busca_vazia`:
  // busca sem resultado voltava a mostrar a categoria inteira, com "0 pessoas
  // neste recorte" e um botão que baixa arquivo vazio.
  //
  // `visiveis` (acima) CONTINUA FORA DESTE OBJETO, e isso é decisão: ele é o
  // conjunto do ENVIO, que ignora a busca de propósito — o porquê está escrito
  // na nota de `destinoDoLote`. Pô-lo aqui seria devolver à vizinhança dos
  // conjuntos da LEITURA justamente o conjunto com que eles foram confundidos.
  const tela = recortarTela(rows, filtro, busca);

  const semNome = rows.filter((c) => !c.username).length;

  // O PISO DO CAMPO DE PRAZO, calculado aqui e não no JSX. Um dia já passado
  // naquele campo é o caminho mais curto para um lote que não sai: todo item
  // vira `skipped` na primeira drenagem, antes de qualquer envio. O fuso é o do
  // PRAZO, e vem da mesma constante de `validadeDoDia` — ver `hojeNoFusoDoPrazo`
  // (lib/lote.ts) para o porquê de não ser `toISOString()` nem `-3h`.
  const hoje = hojeNoFusoDoPrazo();

  // O ENDEREÇO DE "VER MAIS" É MONTADO SOBRE `urlComFiltro`, e nunca concatenando
  // `?categoria=` à mão: a distinção entre o parâmetro AUSENTE ("todos") e
  // PRESENTE-E-VAZIO ("sem categoria") foi o Crítico de 01/09, e recair nele por
  // uma porta nova é o que este cuidado existe para impedir. Mesma disciplina de
  // `urlComAviso` (lib/avisos.ts).
  const base = urlComFiltro("/contatos", filtro);
  const separador = base.includes("?") ? "&" : "?";
  const maisLinhas =
    base +
    separador +
    new URLSearchParams({
      ...(busca ? { q: busca } : {}),
      linhas: String(linhas + LIMITE_DA_TABELA),
    }).toString();

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

          {tela.caso === "busca_vazia" ? (
            /* O VAZIO DA BUSCA NOMEIA A BUSCA, e isso conserta um defeito achado
               por revisão em 11/09/2026: quem digitava "joao" com "todos"
               selecionado recebia *"Nenhum contato nesta categoria — use
               'todos', ali em cima"*, com "todos" já clicado. O estado vazio do
               recurso novo acusava a causa errada e mandava fazer o que já
               estava feito. */
            <div className={emptyWrap}>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Ninguém encontrado para “{busca}”
              </p>
              <p className={`max-w-sm text-xs ${muted}`}>
                A busca procura no @, no nome e no e-mail.{" "}
                <Link href={urlComFiltro("/contatos", filtro)} className={link}>
                  Limpar a busca
                </Link>{" "}
                para ver {filtro.tipo === "tudo" ? "a conta inteira" : "a categoria inteira"}.
              </p>
            </div>
          ) : tela.caso === "filtro_vazio" ? (
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
                {/* O ANEL DE FOCO É O MESMO DOS BOTÕES. `list-none` tira o
                    triângulo e, sem isto, sobrava o `outline auto 1px` do
                    navegador — o mesmo fio de baixo contraste que o achado D8
                    tirou da barra lateral. E ele ficou justamente no controle
                    que abre o disparo em massa. */}
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:focus-visible:ring-acao-escuro/25">
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

              {/* EXPORTAR TODOS OS DADOS — o segundo botão, e POR QUE ele mora
                  aqui, entre o bloco de envio e as duas tabelas.

                  A FRASE ACIMA DE UM BOTÃO TEM DE CONTAR O QUE ELE EXPORTA.
                  Essa é a regra que esta tela já quebrou duas vezes, e ela é o
                  que decide a posição — não o desenho.

                  DENTRO DA SEÇÃO "COM E-MAIL", ao lado do botão antigo, a frase
                  de cima é `${tela.comEmail.length} pessoas — prontas para sua
                  lista`, que conta SÓ quem tem e-mail. Este botão leva todo
                  mundo do recorte. Frase e botão discordariam sobre o mesmo
                  clique, que é exatamente o defeito de 11/09/2026 por uma porta
                  nova — e pôr um segundo número lá dentro faria o cabeçalho da
                  seção "Com e-mail" contar gente que não está nela.

                  ACIMA DO BLOCO DE ENVIO também não: a frase de lá é "Mandar
                  mensagem para {visiveis.length} pessoas", e `visiveis` é só a
                  categoria — o envio ignora a busca de propósito (o porquê está
                  na nota de `destinoDoLote`). O leitor teria de atravessar um
                  número que conta OUTRO conjunto para chegar às tabelas.

                  AQUI, O NÚMERO FECHA COM O QUE ESTÁ LOGO ABAIXO:
                  `tela.comEmail` + `tela.semEmail` é exatamente `tela.achados`
                  — as duas seções seguintes, e o caso puro que prende essa
                  partição está em tests/exportacao-de-contatos.test.ts. O botão
                  fica em cima das duas tabelas que ele soma, e a frase conta a
                  soma delas — dá para conferir olhando, sem sair da tela.

                  E ELE APARECE MESMO QUANDO NINGUÉM TEM E-MAIL, que é metade da
                  razão de existir: este fragmento só renderiza com
                  `tela.achados.length > 0` (os dois vazios — busca e filtro —
                  são tratados nos ramos acima), e quem nunca deu e-mail pode
                  ter dado telefone, cidade, ou o campo que o marketing
                  inventou.

                  A FRASE E O BOTÃO SAEM DE `FaixaDaExportacaoCompleta`, e não
                  deste JSX: enquanto moravam aqui, a regra que eles carregam (o
                  número da frase e o `href` do botão têm de falar do mesmo
                  clique) não tinha como ganhar caso — esta página é `async` e
                  consulta o banco, e nada em `testes-dom/` consegue montá-la.

                  E ELA RECEBE `tela` INTEIRA, não um conjunto solto. Enquanto
                  recebia `contatos={rows}` mais o recorte, a página escolhia
                  qual dos quatro conjuntos do mesmo tipo mandar, e era ESSA
                  escolha o defeito: `contatos={comEmail}` atravessou `tsc`,
                  `eslint`, 1808 casos puros e 47 de DOM. As duas formas que o
                  objeto NÃO impede estão nomeadas no comentário da faixa, e as
                  duas exigem escrever código novo de propósito. */}
              <FaixaDaExportacaoCompleta tela={tela} />

              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="titulo flex items-center gap-2 text-lg font-bold">
                      <IconMail className="h-4 w-4 text-quieto dark:text-quieto-escuro" />
                      Com e-mail
                    </h2>
                    <p className={`text-sm ${muted}`}>
                      {tela.caso === "tem_email"
                        ? `${tela.comEmail.length} ${tela.comEmail.length === 1 ? "pessoa" : "pessoas"} — prontas para sua lista`
                        : tela.caso === "sem_email_no_filtro"
                          ? "Ninguém nesta categoria informou e-mail ainda."
                          : "Ninguém informou o e-mail ainda. Ligue “Pedir o e-mail antes do link” numa automação."}
                    </p>
                  </div>
                  {tela.comEmail.length > 0 && (
                    // O ENDEREÇO CARREGA O FILTRO **E A BUSCA**, e quem o monta
                    // é `urlDaExportacao` (lib/exportacao-de-contatos.ts) — a
                    // mesma função do botão novo, e a outra ponta do
                    // `recorteDaUrl` que as duas rotas leem.
                    //
                    // ELE ERA MONTADO AQUI À MÃO, com `urlComFiltro` mais uma
                    // concatenação de `q` — e era essa concatenação que faltava
                    // em 11/09/2026: a tela dizia "1 pessoa — pronta para sua
                    // lista" e o botão logo abaixo baixava os 40 da categoria.
                    // Enquanto o link vivia no JSX, o botão NOVO podia nascer
                    // com metade dele; agora há um dono só, com caso de
                    // ida-e-volta em tests/exportacao-de-contatos.test.ts.
                    <a
                      href={urlDaExportacao("/api/contatos/csv", tela.recorte)}
                      className={btnGhost}
                      download
                    >
                      Exportar CSV
                    </a>
                  )}
                </div>
                {tela.comEmail.length > 0 && (
                  <Tabela
                    rows={tela.comEmail}
                    comEmail
                    limite={linhas}
                    maisHref={maisLinhas}
                    idDoForm="lote-com-email"
                    campoFiltro={campoDoFiltro(filtro)}
                    q={busca}
                    linhas={linhas}
                  />
                )}
              </section>

              {tela.semEmail.length > 0 && (
                <section>
                  <div className="mb-4">
                    <h2 className="titulo flex items-center gap-2 text-lg font-bold">
                      <IconUsers className="h-4 w-4 text-zinc-400" />
                      Sem e-mail
                    </h2>
                    <p className={`text-sm ${muted}`}>
                      {tela.semEmail.length} {tela.semEmail.length === 1 ? "pessoa" : "pessoas"} que
                      interagiram mas não informaram e-mail
                    </p>
                  </div>
                  <Tabela
                    rows={tela.semEmail}
                    comEmail={false}
                    limite={linhas}
                    maisHref={maisLinhas}
                    idDoForm="lote-sem-email"
                    campoFiltro={campoDoFiltro(filtro)}
                    q={busca}
                    linhas={linhas}
                  />
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
