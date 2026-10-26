// O RLS EM TODA TABELA (a 019), conferido no banco de verdade (o container).
//
// MEDIDO NA PRODUÇÃO EM 26/10/2026, numa transação `read only`: as 12 tabelas do `public` estavam com o
// RLS desligado, e os papéis `anon` e `authenticated` do Supabase tinham SELECT, INSERT, UPDATE, DELETE e
// TRUNCATE em todas, inclusive `accounts` (os tokens do Instagram) e `config` (as chaves do app). Quem
// tivesse a chave pública (anon) do projeto lia e mudava tudo pela API REST do Supabase, sem passar pelo
// painel. O app entra como `postgres`, que é o dono das tabelas e passa por cima do RLS (`bypassrls`),
// então ligar o RLS sem nenhuma regra fecha a API pública e não muda nada no painel.
//
// O PRIMEIRO CASO É A GUARDA DO FUTURO: a 019 liga o RLS no que existe, e uma tabela criada por uma
// migração depois dela nasce aberta. Este caso cai nesse dia, e quem criou a tabela liga o RLS nela.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { bancoDescartavel } from "./harness";
import { urlComSchema, urlDoBanco } from "./banco-descartavel";
import { migracoesEmOrdem } from "./migracoes";

const banco = bancoDescartavel();

// UM PAPEL COMUM, COMO O `anon`: sem `bypassrls`, sem ser dono, mas com permissão de ler e gravar. O
// nome é único por rodada, porque papel é do servidor inteiro, e não do schema.
const PAPEL = `rls_teste_${process.pid}_${Date.now()}`;
let cliente: ReturnType<typeof postgres> | null = null;

beforeAll(async () => {
  const sql = banco.db().sql();
  await sql.query(`create role ${PAPEL} nologin`);
  await sql.query(`grant usage on schema ${banco.nome()} to ${PAPEL}`);
  await sql.query(`grant select, insert, update, delete on all tables in schema ${banco.nome()} to ${PAPEL}`);
  cliente = postgres(urlComSchema(urlDoBanco(), banco.nome()), { max: 1, prepare: false });
});

afterAll(async () => {
  await cliente?.end({ timeout: 5 });
  const sql = banco.db().sql();
  await sql.query(`drop owned by ${PAPEL}`);
  await sql.query(`drop role if exists ${PAPEL}`);
});

/** Roda `corpo` dentro de uma transação como o papel comum, e desfaz tudo no fim. */
async function comoPapelComum<T>(corpo: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let resultado: T | undefined;
  await cliente!
    .begin(async (tx) => {
      await tx.unsafe(`set local role ${PAPEL}`);
      resultado = await corpo(tx);
      throw new Error("desfazer");
    })
    .catch((e: Error) => {
      if (e.message !== "desfazer") throw e;
    });
  return resultado as T;
}

describe("o RLS nas tabelas", () => {
  it("toda tabela do schema tem o RLS ligado", async () => {
    const abertas = (await banco
      .db()
      .sql()
      .query(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = current_schema() and c.relkind in ('r', 'p') and not c.relrowsecurity
          order by 1`
      )) as { relname: string }[];
    expect(abertas.map((t) => t.relname)).toEqual([]);
  });

  it("o papel comum não lê nenhuma linha, mesmo com permissão de leitura", async () => {
    await banco.db().sql().query(`delete from config`);
    await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
    const linhas = await comoPapelComum((tx) => tx.unsafe(`select * from config`));
    expect(linhas).toHaveLength(0);
  });

  it("o papel comum não grava, mesmo com permissão de escrita", async () => {
    await expect(
      comoPapelComum((tx) =>
        tx.unsafe(`insert into accounts (ig_user_id, access_token) values ('rls-teste', 'x')`)
      )
    ).rejects.toThrow(/row-level security/);
  });

  it("o dono continua lendo e gravando, como o painel", async () => {
    await banco.db().sql().query(`delete from config`);
    await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
    const linhas = (await banco.db().sql().query(`select id from config`)) as { id: number }[];
    expect(linhas).toHaveLength(1);
  });

  it("a 019 roda duas vezes sem mudar nada", async () => {
    const m019 = migracoesEmOrdem().find((m) => m.nome === "019-rls-nas-tabelas.sql");
    expect(m019).toBeDefined();
    await banco.db().sql().query(m019!.comandos);
    await banco.db().sql().query(m019!.comandos);
    const [{ n }] = (await banco
      .db()
      .sql()
      .query(
        `select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = current_schema() and c.relkind in ('r', 'p') and not c.relrowsecurity`
      )) as { n: number }[];
    expect(n).toBe(0);
  });
});
