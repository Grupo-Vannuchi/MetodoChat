// A PROVA DO CONSERTO DO GRÁFICO — revisão final da branch, item 1.
//
// -----------------------------------------------------------------------------
// O DEFEITO
//
// `app/desempenho/page.tsx` tem duas consultas no mesmo `Promise.all`: uma
// alimenta os quatro `StatCard` (entre eles "Mensagens entregues", já
// consertada nesta branch para excluir `KINDS_FORA_DA_ENTREGA_DO_MOTOR`), a
// outra alimenta `<SentChart>` — o gráfico "Mensagens por dia" logo abaixo,
// que imprime "{total} em 14 dias" e cujo estado vazio diz "Nenhuma mensagem
// enviada ainda nesse período". A segunda consulta NÃO tinha o filtro de
// `kind`: o defeito medido em produção em 15/09/2026 ("Mensagens entregues: 5"
// com o motor tendo entregue 3, porque dois eram POSTS) não foi consertado —
// foi movido meio metro para baixo, e a tela ficaria dizendo "Mensagens
// entregues: 3" no cartão e somando 5 nas barras do gráfico logo abaixo, o
// mesmo substantivo contradito na MESMA tela.
//
// O CONSERTO acrescenta `and not (kind = any($3::text[]))` à consulta do
// gráfico, com a MESMA lista (`KINDS_FORA_DA_ENTREGA_DO_MOTOR`,
// lib/envio-filters.ts) que já protege `sent7`.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO NÃO LÊ O TOTAL PELA ÁRVORE — medido, não suposto
//
// `textoDaArvore` (./texto-da-arvore.ts) não visita o `type` de nenhum
// elemento — é assim que ela evita o `next/link` circular (ver o cabeçalho
// daquele arquivo). O efeito colateral, que o cabeçalho de `texto-da-arvore.ts`
// já nomeia por extenso — "`StatCard` e `SentChart` têm a mesma propriedade —
// nenhum número deles é legível daqui" —: o total do gráfico só existe depois
// que `SentChart` (app/dashboard-parts.tsx) RODA, e ela nunca roda aqui. O que
// chega à leitura é só o elemento `<SentChart dias={...} />`: `dias` é um
// ARRAY, e `descer` (texto-da-arvore.ts) só desce em props chamadas
// `children` ou copia string/number — um array não é nenhum dos dois, então a
// prop inteira é ignorada, e o corpo de `SentChart` (onde `{total}` é
// escrito) nunca chega a executar.
//
// MEDIDO, direto: semeando os dois itens deste arquivo e lendo a árvore de
// `/desempenho`, a linha `value=1` do cartão "Mensagens entregues" aparece
// (prop ESCALAR de `StatCard`, essa sim visível) — mas nenhuma linha do
// gráfico aparece: nem `dias=`, nem o total, nem "em 14 dias". A tela tem
// componente filho de verdade no meio do caminho, exatamente o caso que o
// cabeçalho de `texto-da-arvore.ts` avisa, e fingir que a árvore prova o
// gráfico seria medir o nada.
//
// -----------------------------------------------------------------------------
// A PROVA, ENTÃO, É POR INSTRUMENTAÇÃO — e não por mock
//
// `banco.db().sql()` é o MESMO objeto singleton que `app/desempenho/page.tsx`
// importa de `@/lib/db` — mesmo processo, mesmo cache de módulos
// (`harness.ts` documenta isso: "`_sql` é singleton de módulo"). Este arquivo
// embrulha o método `.query` NESSE objeto, DELEGANDO toda chamada para a
// implementação de sempre — nada é substituído, nada é fingido, a consulta
// continua indo para o Postgres de verdade — e guarda o RESULTADO da chamada
// cuja consulta é a do gráfico (reconhecida por um pedaço estável do SQL,
// `"as dia,"`, que só a consulta do gráfico tem — a outra consulta do mesmo
// arquivo não tem essa coluna).
//
// O que sai é o resultado de UMA CHAMADA DE VERDADE, feita pelo código de
// verdade de `app/desempenho/page.tsx` — não uma segunda cópia da consulta
// escrita à mão aqui, que só provaria que ESTE arquivo sabe somar. Remover o
// `and not (kind = any($3::text[]))` do arquivo real muda o SQL que chega a
// este embrulho, muda o resultado capturado, e este caso fica vermelho — é
// isto que o plantio do relatório confirma.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

type ModuloTelaDeDesempenho = typeof import("@/app/desempenho/page");

const banco = bancoDescartavel();

const CONTA = "17800000000005001";
// Valor inventado. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-da-conta-do-desempenho-que-nao-vale-nada";

let telaDeDesempenho: ModuloTelaDeDesempenho;

beforeAll(async () => {
  telaDeDesempenho = (await import("@/app/desempenho/page")) as ModuloTelaDeDesempenho;

  // UMA CONTA SÓ — o mesmo tombo dos irmãos deste arquivo
  // (`pulso-do-inicio.integracao.ts`, `nao-saiu.integracao.ts`):
  // `getSelectedAccount` cai na PRIMEIRA conta quando não há cookie, e nenhum
  // cookie é forjado aqui (regra do dono).
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_desempenho",
    name: "conta_do_desempenho",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

let semente = 0;

/** Uma linha de fila `sent`, gravada direto — sempre com `account_id = CONTA`. */
async function semearEnviado(kind: string): Promise<void> {
  semente++;
  const contactId = kind === "publicacao" ? null : "99000000000005";
  const payload =
    kind === "publicacao"
      ? { forma: "reels", caminhos: [`${CONTA}/desempenho-${semente}.mp4`] }
      : { text: "mensagem do desempenho" };
  await banco
    .db()
    .sql()
    .query(
      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status, sent_at)
       values ($1, $2, $3, $4, $5, 'sent', now())`,
      [CONTA, kind, contactId, payload, `desempenho-teste-${semente}`]
    );
}

/**
 * Chama a tela real, capturando o RESULTADO da consulta do gráfico — ver o
 * cabeçalho do arquivo para o porquê de não ler pela árvore.
 *
 * O embrulho é desfeito no `finally`: sem isso, uma segunda chamada neste
 * mesmo arquivo empilharia embrulhos um sobre o outro.
 */
async function totalDoGrafico(): Promise<{ arvore: string; linhasDoGrafico: { dia: string; n: number }[] }> {
  const s = banco.db().sql();
  const original = s.query.bind(s);
  let capturado: { dia: string; n: number }[] | null = null;

  s.query = ((texto: string, params?: unknown[]) => {
    const chamada = original(texto, params);
    // O PEDAÇO ESTÁVEL: só a consulta do gráfico seleciona uma coluna `dia` —
    // a dos cartões (`Counts`) não tem essa coluna nenhuma.
    if (texto.includes("as dia,")) {
      chamada.then((linhas) => {
        capturado = linhas as { dia: string; n: number }[];
      });
    }
    return chamada;
  }) as typeof s.query;

  try {
    const { valor: arvore } = await comoNumaRequisicao("/desempenho", async () =>
      textoDaArvore(await telaDeDesempenho.default())
    );
    if (capturado === null) {
      throw new Error(
        "A CAPTURA NÃO ACHOU A CONSULTA DO GRÁFICO — nenhuma chamada a " +
          "`sql().query` continha 'as dia,'. Ou a consulta mudou de forma (e este " +
          "arquivo precisa de um pedaço estável novo), ou `app/desempenho/page.tsx` " +
          "parou de rodá-la."
      );
    }
    return { arvore, linhasDoGrafico: capturado };
  } finally {
    s.query = original;
  }
}

describe("o gráfico de /desempenho (app/desempenho/page.tsx) — 'Mensagens por dia'", () => {
  // =========================================================================
  // O CASO CENTRAL: um envio automático e uma publicação, os dois `sent` —
  // exatamente a forma do defeito medido em produção (post contado como
  // mensagem). O total do gráfico tem de ser 1, o mesmo número que o cartão
  // "Mensagens entregues" já mostra (consertado por Tarefa 2 desta branch).
  // =========================================================================
  test("uma publicação enviada não entra na soma do gráfico — só a mensagem conta", async () => {
    await semearEnviado("dm_link");
    await semearEnviado("publicacao");

    const { arvore, linhasDoGrafico } = await totalDoGrafico();

    // O CARTÃO, que já está certo (Tarefa 2): confirma que a mesma conta e os
    // mesmos dois itens produzem "1" no lado que já tinha rede. Sem esta
    // linha, um total de gráfico errado poderia ser culpa de outra coisa (a
    // conta errada, os itens não terem sido semeados) em vez do defeito que
    // este caso mede.
    expect(arvore).toContain("value=1");

    // O GRÁFICO: soma das barras dos 14 dias. Com o defeito (sem o filtro de
    // `kind`), este total seria 2 — o post entrando junto.
    const total = linhasDoGrafico.reduce((soma, l) => soma + l.n, 0);
    expect(total).toBe(1);
  });
});
