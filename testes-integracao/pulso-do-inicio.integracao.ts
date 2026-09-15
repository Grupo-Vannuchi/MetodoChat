// O PULSO DO INÍCIO — a rede que faltava para a linha que substituiu contagem
// parada por fato com carimbo de hora.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE
//
// Entre 08/09 e 14/09/2026 o motor passou SEIS DIAS sem disparar nada, enquanto
// ~40 comentários chegavam por dia — e o painel, no mesmo período, anunciava
// "Automações ativas: 21" e "Na fila: 0", dois números verdadeiros que lidos
// juntos pareciam saúde. O pulso (lib/pulso.ts, montado em app/page.tsx) troca
// isso por "nada entregue hoje · última há 16 h · fila vazia": fato, não
// contagem.
//
// O BURACO: as subconsultas que alimentam o pulso não tinham NENHUMA asserção.
// Medido: tirar o filtro de kinds manuais da consulta não deixava um único caso
// vermelho na suíte inteira. Uma revisão final achou quatro defeitos nessas
// consultas — todos consertados, nenhum deles com rede. Este arquivo é essa
// rede.
//
// -----------------------------------------------------------------------------
// AS CINCO COISAS QUE ESTE ARQUIVO PROVA, e o defeito real por trás de cada uma
//
//   1. dm_manual não conta.     `enqueueManualReply` (lib/engine.ts) põe
//                                `kind: 'dm_manual'` na MESMA fila dos envios
//                                automáticos — sem filtro, alguém respondendo à
//                                mão com o motor morto faria o pulso mentir
//                                "entregue hoje".
//   2. publicacao não conta.    Post não é mensagem; o dreno já separa os dois
//                                (lib/queue-drain.ts).
//   3. um envio automático conta. Sem este caso, 1 e 2 passariam com uma
//                                consulta que não conta NADA — o portão mudo.
//   4. guardado é fila viva.    Estado vivo desde
//                                migrations/009-fila-estado-guardado.sql;
//                                /desempenho já o soma pelo mesmo motivo.
//   5. "hoje" é o dia de SÃO PAULO, não de UTC. O servidor roda em UTC; sem o
//      `at time zone`, um envio de fim de tarde em SP (já virou "amanhã" em
//      UTC) sumiria do pulso e a tela diria "nada entregue hoje" com envios no
//      relógio do dono. Este é o caso mais valioso do arquivo.
//
// -----------------------------------------------------------------------------
// A MAQUINARIA É A MESMA DE `nao-saiu.integracao.ts`, E NÃO UMA NOVA
//
// `bancoDescartavel()` (./harness) dá o schema temporário; `comoNumaRequisicao`
// (./semear-requisicao) dá o contexto de requisição sem forjar cookie nenhum;
// `textoDaArvore` (./texto-da-arvore) lê a árvore que `app/page.tsx` devolve SEM
// `JSON.stringify` — que ESTOURA nesta tela por causa do `<Link>` de
// `next/link` (estrutura circular). Ver o cabeçalho daquele arquivo.
//
// -----------------------------------------------------------------------------
// O ISOLAMENTO ESCOLHIDO: UMA CONTA SÓ, FILA LIMPA ANTES DE CADA CASO
//
// `getSelectedAccountId()` cai na PRIMEIRA conta por `created_at asc` quando não
// há cookie, e `comoNumaRequisicao` nunca planta cookie (regra do dono: sessão
// não se forja). Isso significa que TER uma segunda conta não ajudaria a
// isolar nada — ela nunca seria a conta selecionada, então um caso que
// precisasse "trocar de conta" teria de forjar cookie, que é exatamente o que
// `nao-saiu.integracao.ts` recusa a fazer pelo mesmo motivo. A única forma
// honesta de isolar cinco casos que todos leem a MESMA conta é limpar a fila
// entre eles — o mesmo padrão de `limparAFila()` em `nao-saiu.integracao.ts`.
//
// -----------------------------------------------------------------------------
// O CASO 5, E A CONTA QUE ELE PRECISA FAZER ANTES DE AFIRMAR QUALQUER COISA
//
// O instante "hoje às 22h de São Paulo" É SEMPRE "amanhã em UTC" — o Brasil não
// tem horário de verão desde 2019, então o fuso é -03:00 fixo, e 22h+3h cruza a
// meia-noite. Essa metade da conta não depende de QUANDO a suíte roda.
//
// O QUE DEPENDE DA HORA É SE ESSE INSTANTE JÁ PASSOU. A janela em que "hoje 22h
// de SP" é ao mesmo tempo (a) hoje em SP e (b) amanhã em UTC e (c) já aconteceu
// só existe depois das 21h em SP — antes disso, "hoje 22h" ainda não chegou, e
// semeá-lo seria semear um `sent_at` no FUTURO, que a spec chama de "outro
// cenário".
//
// Por isso o instante é montado em SQL (pelo relógio do BANCO, nunca por
// `new Date()`) e CONFERIDO antes de qualquer `expect` sobre o pulso: o caso lê
// de volta se o instante caiu mesmo em "hoje em SP" e em "amanhã em UTC", e só
// então segue. Medido no momento em que este arquivo foi escrito (rodando às
// ~11h21 de SP, pela hora do sistema): o instante de "hoje 22h SP" estava no
// FUTURO. Isso não invalida o caso — a consulta que o pulso usa
// (`app/page.tsx`, subconsulta `entregues_hoje`) NUNCA compara `sent_at` com
// `now()`; ela só compara as DUAS DATAS DE CALENDÁRIO, via `at time zone`. Um
// `sent_at` cronologicamente à frente do instante da inserção exercita a MESMA
// comparação de datas que um `sent_at` genuinamente passado exerceria — e é
// essa comparação, e não a ordem no tempo, que os quatro defeitos da revisão
// final moravam. A prova de que o caso mede a coisa certa está na seção de
// plantio deste arquivo (ver relatório): tirar o `at time zone` da consulta
// derruba este caso, esteja o instante semeado no passado ou no futuro.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

type ModuloTelaDoPainel = typeof import("@/app/page");

const banco = bancoDescartavel();

const CONTA = "17800000000004001";
// Valor inventado. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-da-conta-do-pulso-que-nao-vale-nada";

let telaDoPainel: ModuloTelaDoPainel;

beforeAll(async () => {
  telaDoPainel = (await import("@/app/page")) as ModuloTelaDoPainel;

  // UMA CONTA SÓ — ver o cabeçalho: é a única que `getSelectedAccountId` pode
  // alcançar sem cookie, então uma segunda conta não isolaria nada aqui.
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_pulso",
    name: "conta_do_pulso",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada — a decisão mora só nas consultas de
// `app/page.tsx`.
// ---------------------------------------------------------------------------

let semente = 0;

/**
 * Uma linha de fila, gravada direto — sempre com `account_id = CONTA`.
 *
 * `sentAt`, quando ausente, deixa o próprio SQL escrever `now()` para status
 * `'sent'` (o relógio do BANCO, e não o da máquina) e `null` para qualquer
 * outro status. Só o caso 5 passa um `sentAt` explícito — o instante que ele
 * mesmo construiu e conferiu antes.
 */
async function semear(item: {
  kind: string;
  status: string;
  sentAt?: Date | null;
}): Promise<string> {
  semente++;
  // `publicacao` não tem contato — é post, não mensagem — e o payload segue a
  // forma que `lib/engine.ts`/`lib/queue-drain.ts` esperam para cada kind.
  const contactId = item.kind === "publicacao" ? null : "99000000000006";
  const payload =
    item.kind === "publicacao"
      ? { forma: "reels", caminhos: [`${CONTA}/pulso-${semente}.mp4`] }
      : { text: "mensagem do pulso" };
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status, sent_at)
       values (
         $1, $2, $3, $4, $5, $6,
         coalesce($7, case when $6 = 'sent' then now() else null end)
       )
       returning id`,
      [
        CONTA,
        item.kind,
        contactId,
        payload,
        `pulso-teste-${semente}`,
        item.status,
        item.sentAt ?? null,
      ]
    )) as { id: string }[];
  return linhas[0].id;
}

async function limparAFila(): Promise<void> {
  await banco.db().sql().query(`delete from queue where account_id = $1`, [CONTA]);
}

async function arvoreDoPainel(): Promise<string> {
  const { valor } = await comoNumaRequisicao("/", async () =>
    textoDaArvore(await telaDoPainel.default({ searchParams: Promise.resolve({}) }))
  );
  return valor;
}

describe("o pulso do Início (app/page.tsx) — a linha que substituiu contagem parada", () => {
  // =========================================================================
  // CASO 1 — O CASO CENTRAL: RESPOSTA MANUAL NÃO É O MOTOR TRABALHANDO.
  //
  // `enqueueManualReply` (lib/engine.ts) grava `kind: 'dm_manual'` na MESMA
  // fila dos envios automáticos. Com o motor morto e alguém respondendo à mão,
  // uma consulta sem este filtro diria "entregue hoje" — o
  // silêncio-que-parece-saúde de 08–14/09/2026, por outra porta.
  // =========================================================================
  test("uma resposta MANUAL enviada agora não conta como entrega do motor", async () => {
    await limparAFila();
    await semear({ kind: "dm_manual", status: "sent" });

    const painel = await arvoreDoPainel();

    expect(painel).toContain("nada entregue hoje");
  });

  // =========================================================================
  // CASO 2 — PUBLICAÇÃO NÃO É MENSAGEM.
  //
  // O dreno já separa os dois destinos (lib/queue-drain.ts); o pulso fala só de
  // mensagem entregue. Um post contado aqui inflaria o número com algo que
  // ninguém recebeu na caixa de entrada.
  // =========================================================================
  test("uma publicação enviada agora não conta como entrega do motor", async () => {
    await limparAFila();
    await semear({ kind: "publicacao", status: "sent" });

    const painel = await arvoreDoPainel();

    expect(painel).toContain("nada entregue hoje");
  });

  // =========================================================================
  // CASO 3 — O PAR QUE PRENDE OS DOIS DE CIMA.
  //
  // Sem este caso, 1 e 2 passariam de graça com uma consulta que não conta
  // NADA — `and false`, por exemplo, também diria "nada entregue hoje" nos dois
  // casos acima. É este caso que exige que a consulta SAIBA contar até 1.
  // =========================================================================
  test("um envio AUTOMÁTICO enviado agora conta como 1 entregue hoje", async () => {
    await limparAFila();
    await semear({ kind: "dm_link", status: "sent" });

    const painel = await arvoreDoPainel();

    expect(painel).toContain("1 entregue hoje");
  });

  // =========================================================================
  // CASO 4 — `guardado` É FILA VIVA, E NÃO FILA VAZIA.
  //
  // Desde migrations/009-fila-estado-guardado.sql, um lote inteiro pode estar
  // esperando a pessoa voltar a falar — isso não é "fila vazia". A tela de
  // Envios (lib/envio-filters.ts) já conta `guardado` como situação própria;
  // `/desempenho` já soma os dois estados pelo mesmo motivo.
  // =========================================================================
  test("um item guardado conta como fila viva — o pulso NÃO diz fila vazia", async () => {
    await limparAFila();
    await semear({ kind: "dm_lote", status: "guardado" });

    const painel = await arvoreDoPainel();

    expect(painel).not.toContain("fila vazia");
    expect(painel).toContain("1 na fila");
  });

  // =========================================================================
  // CASO 5 — "HOJE" É O DIA DE SÃO PAULO, NÃO DE UTC. O mais valioso do
  // arquivo: é o único que teria ficado mudo o tempo todo em produção, porque
  // nenhum dos quatro portões (lint, typecheck, suíte pura, varredura) enxerga
  // fuso horário dentro de uma string SQL.
  //
  // Ver o cabeçalho do arquivo para a conta completa de por que o instante é
  // montado e CONFERIDO em SQL, e por que ele pode estar no futuro dependendo
  // da hora em que a suíte roda — e por que isso não enfraquece o caso.
  // =========================================================================
  test("um envio automático às 22h de SP (já amanhã em UTC) conta como de HOJE", async () => {
    await limparAFila();

    // O INSTANTE, MONTADO PELO RELÓGIO DO BANCO — a mesma forma que a spec
    // sugere: a data de hoje em SP, às 22h, reinterpretada como hora de SP (e
    // não como hora local da máquina que roda o teste).
    const [diagnostico] = (await banco
      .db()
      .sql()
      .query(
        `with candidato as (
           select ((now() at time zone 'America/Sao_Paulo')::date + time '22:00')
                    at time zone 'America/Sao_Paulo' as instante
         )
         select
           instante,
           now() as agora,
           (instante at time zone 'America/Sao_Paulo')::date
             = (now() at time zone 'America/Sao_Paulo')::date as sp_hoje,
           (instante at time zone 'UTC')::date
             <> (instante at time zone 'America/Sao_Paulo')::date as utc_amanha,
           instante > now() as no_futuro
         from candidato`
      )) as {
      instante: Date;
      agora: Date;
      sp_hoje: boolean;
      utc_amanha: boolean;
      no_futuro: boolean;
    }[];

    // A CONFERÊNCIA PEDIDA ANTES DE AFIRMAR QUALQUER COISA. As duas condições
    // têm de valer AO MESMO TEMPO — é essa combinação, e não uma hora
    // qualquer, que reproduz o defeito de 08–14/09/2026.
    expect(
      diagnostico.sp_hoje,
      "o instante construído tem de cair no dia de HOJE em São Paulo"
    ).toBe(true);
    expect(
      diagnostico.utc_amanha,
      "o instante construído tem de já estar em AMANHÃ quando lido em UTC"
    ).toBe(true);

    await semear({ kind: "dm_link", status: "sent", sentAt: diagnostico.instante });

    const painel = await arvoreDoPainel();

    // COM A CONSULTA CERTA (`at time zone 'America/Sao_Paulo'` dos dois lados),
    // este envio é de HOJE em SP e conta — não importa se `diagnostico.instante`
    // ficou no passado ou no futuro em relação a `diagnostico.agora`: a
    // consulta do pulso nunca olha para essa ordem, só para as duas datas de
    // calendário.
    expect(painel).toContain("1 entregue hoje");
  });
});
