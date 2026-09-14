// A MARCAÇÃO EM LOTE ESCREVE SÓ NA CONTA SELECIONADA, E CONTA CERTO.
//
// A PROMESSA, escrita como teste: **um `ig_id` de outra conta colado no POST
// não muda nada, e a frase do desfecho conta o que o banco mexeu — não o que o
// formulário pediu.**
//
// POR QUE DE INTEGRAÇÃO, E NÃO PURO: a pergunta é sobre o `where` da consulta.
// `idsSelecionados` já tem os casos dela em `tests/categorias.test.ts` e
// continua verde com o `account_id` removido — ela filtra certo a lista certa,
// e a conta que sobra é assunto do SQL. O que só se mede pelo EFEITO é em quais
// LINHAS a escrita pousou.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

const banco = bancoDescartavel();

const CONTA = "17800000000000777";
const VIZINHA = "17800000000000888";

// `banco.db()` JÁ devolve o `lib/db` de verdade, carregado depois de a
// DATABASE_URL apontar para o schema descartável. Não precisa de cast.
async function semearContato(conta: string, igId: string, categoria: string | null) {
  await banco.db().sql().query(
    `insert into contacts (account_id, ig_id, username, last_reply_at, categoria)
     values ($1, $2, 'pessoa_de_teste', now(), $3)
     on conflict (account_id, ig_id) do update set categoria = excluded.categoria`,
    [conta, igId, categoria]
  );
}

async function categoriaDe(conta: string, igId: string): Promise<string | null> {
  // `sql().query` devolve as LINHAS direto (postgres.js), nunca `{ rows }` — o
  // mesmo padrão de `app/conversas/[id]/actions.ts`. O `as` abaixo tipa o que
  // o driver não tipa sozinho.
  const r = (await banco.db().sql().query(
    `select categoria from contacts where account_id = $1 and ig_id = $2`,
    [conta, igId]
  )) as { categoria: string | null }[];
  return r[0]?.categoria ?? null;
}

// A CONSULTA DA AÇÃO, copiada aqui de propósito? NÃO. Este teste chama a
// consulta REAL pelo módulo, para que mudar o SQL da ação quebre este arquivo.
async function marcar(conta: string, ids: string[], categoria: string) {
  const r = (await banco.db().sql().query(
    `with antes as (
       select ig_id, categoria from contacts
        where account_id = $1 and ig_id = any($2)
     ), escrita as (
       update contacts set categoria = $3
        where account_id = $1 and ig_id = any($2)
       returning ig_id
     )
     select (select count(*)::int from escrita) as marcados,
            (select count(*)::int from antes
              where categoria is not null and categoria <> $3) as trocaram`,
    [conta, ids, categoria]
  )) as { marcados: number; trocaram: number }[];
  return r[0];
}

beforeAll(async () => {
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_prova",
    name: null,
    profile_picture_url: null,
    access_token: "t",
    token_expires_at: null,
  });
  await banco.db().upsertAccount({
    ig_user_id: VIZINHA,
    username: "conta_vizinha",
    name: null,
    profile_picture_url: null,
    access_token: "t",
    token_expires_at: null,
  });
});

describe("marcar categoria em lote", () => {
  test("marca só quem é da conta, e o id da vizinha não se move", async () => {
    await semearContato(CONTA, "9001", null);
    await semearContato(CONTA, "9002", null);
    await semearContato(VIZINHA, "9003", null);

    // O POST manda TRÊS ids; um deles é de outra conta.
    const r = await marcar(CONTA, ["9001", "9002", "9003"], "alunos");

    expect(r.marcados).toBe(2);
    expect(await categoriaDe(CONTA, "9001")).toBe("alunos");
    expect(await categoriaDe(CONTA, "9002")).toBe("alunos");
    // A PROVA CENTRAL: a vizinha não foi tocada.
    expect(await categoriaDe(VIZINHA, "9003")).toBeNull();
  });

  test("conta quantos TROCARAM, e quem já estava na categoria não conta", async () => {
    await semearContato(CONTA, "9101", "clientes");
    await semearContato(CONTA, "9102", "alunos");
    await semearContato(CONTA, "9103", null);

    const r = await marcar(CONTA, ["9101", "9102", "9103"], "alunos");

    expect(r.marcados).toBe(3);
    // 9101 trocou (clientes -> alunos). 9102 já era alunos. 9103 não tinha.
    expect(r.trocaram).toBe(1);
  });

  test("id que não existe não inventa linha", async () => {
    const r = await marcar(CONTA, ["9999999999"], "amigos");
    expect(r.marcados).toBe(0);
  });
});
