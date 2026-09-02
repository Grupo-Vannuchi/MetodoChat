// O CONTADOR DE "SEM CATEGORIA" CONTA A CONTA, E NAO A PAGINA.
//
// A PROMESSA, escrita como teste: **o numero do cabecalho de Conversas fala da
// CONTA INTEIRA, e continua aparecendo enquanto houver conversa por marcar —
// inclusive depois de tudo que cabe na tela ja estar marcado.**
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE
//
// O contador nasceu aplicando `quantasSemCategoria` sobre o resultado de
// `listConversations`, e aquele resultado e uma PAGINA: as 50 conversas mais
// recentes (`limite = 50`). Medido em producao em 02/09/2026, na conta
// principal: 46 sem categoria dentro das 50, 114 na conta inteira.
//
// E O NUMERO ERRADO ERA O MENOR DOS DOIS PROBLEMAS. Marcar acontece de cima
// para baixo, das conversas mais recentes. Assim que as 50 do topo ficam
// marcadas, um contador de pagina vai a ZERO, o cabecalho SOME — anunciando que
// nao ha nada a marcar — e tudo abaixo do corte fica la para sempre. O sinal se
// apagava exatamente a medida que funcionava.
//
// -----------------------------------------------------------------------------
// POR QUE DE INTEGRACAO, E NAO PURO
//
// A pergunta e sobre SQL: se a consulta que alimenta o contador tem `limit` ou
// nao. Nenhum teste puro alcanca isso — a regra pura (`semCategoria`,
// `quantasSemCategoria`) ja tem os seus casos em `tests/categorias.test.ts` e
// continua verde com o defeito no lugar, porque ela conta certo a lista errada.
// O que so se mede pelo EFEITO e o TAMANHO da lista que chega ate ela.
//
// O cenario e montado por `insert` cru, como a producao grava, e conferido pelo
// que saiu — nunca perguntando de novo a funcao que decide.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
// `lib/categorias.ts` nao fala com o banco (so `lib/inbox-window.ts`, que e
// puro): pode ser importado no topo. `lib/conversations.ts` entra dentro do
// `beforeAll`, depois de a DATABASE_URL estar pronta.
import { quantasSemCategoria } from "@/lib/categorias";

type ModuloConversas = typeof import("@/lib/conversations");

const banco = bancoDescartavel();

const CONTA = "17800000000000444";
// A conta VIZINHA nao recebe conversa nenhuma: ela existe para que "a conta
// inteira" signifique ESTA conta, e nao "o banco inteiro".
const VIZINHA = "17800000000000555";

// O retrato do pior caso, e ele e o do parecer: sessenta conversas, as
// CINQUENTA mais recentes ja marcadas, as DEZ mais antigas por marcar.
const TOTAL = 60;
const MARCADAS = 50;
const POR_MARCAR = TOTAL - MARCADAS;

let conversas: ModuloConversas;

beforeAll(async () => {
  conversas = await import("@/lib/conversations");

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_sinal",
    name: "Conta do sinal",
    profile_picture_url: null,
    access_token: "token-de-teste-que-nao-vale-nada",
    token_expires_at: null,
  });
  await banco.db().upsertAccount({
    ig_user_id: VIZINHA,
    username: "conta_vizinha",
    name: "Conta vizinha",
    profile_picture_url: null,
    access_token: "token-de-teste-que-nao-vale-nada",
    token_expires_at: null,
  });

  // Uma mensagem recebida por pessoa, `i` minutos atras: `i = 1` e a mais
  // recente e `i = 60` a mais antiga. E essa ordem que decide quem cai dentro
  // da pagina de 50 e quem fica abaixo do corte.
  await banco
    .db()
    .sql()
    .query(
      `insert into events (account_id, type, payload, created_at)
       select $1::text, 'message',
              jsonb_build_object(
                'sender', jsonb_build_object('id', 'sinal-' || i),
                'recipient', jsonb_build_object('id', $1::text)
              ),
              now() - (i || ' minutes')::interval
       from generate_series(1, $2::int) as i`,
      [CONTA, TOTAL]
    );

  // As 50 do topo tem categoria; as 10 do fundo, nao. E UMA DELAS TEM SO
  // ESPACO EM BRANCO, de proposito: quem contar "sem categoria" em SQL
  // (`categoria is null`) acha NOVE, e quem usar a regra que a marca da linha
  // usa (`semCategoria`, lib/categorias.ts) acha DEZ. As duas assercoes do
  // primeiro caso prendem essa diferenca, que e a razao de a contagem nao
  // poder ser reescrita dentro da consulta.
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, username, categoria)
       select $1::text, 'sinal-' || i, 'pessoa_' || i,
              case
                when i <= $3::int then 'aluno'
                when i = $2::int then '   '
                else null
              end
       from generate_series(1, $2::int) as i`,
      [CONTA, TOTAL, MARCADAS]
    );
});

describe("o sinal de sem categoria", () => {
  test("o contador enxerga a conta inteira, e nao a pagina da lista", async () => {
    const categorias = await conversas.categoriasDasConversas(CONTA);

    // 1) A CONTA INTEIRA CHEGA — uma linha por conversa, sem corte.
    expect(categorias.length, "a consulta do contador voltou cortada").toBe(TOTAL);

    // 2) E A REGRA E A DE `semCategoria`, e nao `is null`: a conversa com so
    //    espaco em branco na coluna conta como por marcar, do mesmo jeito que a
    //    marca da linha a marca.
    expect(categorias.filter((c) => c.categoria === null).length).toBe(POR_MARCAR - 1);
    expect(quantasSemCategoria(categorias)).toBe(POR_MARCAR);
  });

  test("sobre a pagina o contador daria zero, e o cabecalho sumiria", async () => {
    // A CONTRAPROVA, e a razao inteira de `categoriasDasConversas` existir. O
    // `limite` vai EXPLICITO para este caso nao depender do padrao da lista:
    // ele fala do formato "uma pagina", e nao do numero 50.
    const pagina = await conversas.listConversations(CONTA, MARCADAS);
    expect(pagina.length).toBe(MARCADAS);
    expect(
      quantasSemCategoria(pagina),
      "o topo marcado zera o contador da pagina — e e por isso que ele nao serve"
    ).toBe(0);

    // Enquanto isso, o que o cabecalho tem de dizer continua sendo dez.
    expect(quantasSemCategoria(await conversas.categoriasDasConversas(CONTA))).toBe(POR_MARCAR);
  });

  test("o contador nao enxerga conversa de outra conta", async () => {
    // A vizinha nao tem evento nenhum: se o `where` da conta cair, ela passa a
    // ver as sessenta desta.
    expect(await conversas.categoriasDasConversas(VIZINHA)).toEqual([]);
  });
});
