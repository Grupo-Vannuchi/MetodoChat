// A CHAVE PÚBLICA SEM PERMISSÃO NENHUMA (a 020), conferida no banco de verdade (o container).
//
// MEDIDO NA PRODUÇÃO EM 26/10/2026, numa transação `read only`: as 24 permissões de `anon` e
// `authenticated` nas 12 tabelas do `public` foram concedidas pelo `postgres`, e os privilégios PADRÃO
// do `public` para o criador `postgres` (pg_default_acl) dão tudo aos dois em toda tabela, sequência e
// função nova. A 019 fecha as linhas das tabelas que existem; a 020 tira as permissões delas E as das
// tabelas que uma migração futura criar.
//
// OS DOIS PAPÉIS SÓ EXISTEM NO SUPABASE. No container eles não existem, e a 020 não faz nada ao rodar
// pelo harness. Por isso este arquivo os cria, reproduz o que o Supabase concede (nas tabelas e nos
// privilégios padrão do schema descartável), roda a 020 de novo e mede. Os papéis são do servidor
// inteiro, e não do schema: só os apaga quem os criou, e os arquivos de integração rodam um por vez
// (`fileParallelism: false`), então nenhum outro arquivo os vê.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { migracoesEmOrdem } from "./migracoes";

const banco = bancoDescartavel();
const PAPEIS = ["anon", "authenticated"] as const;
const criados: string[] = [];

const sql = () => banco.db().sql();
const m020 = () => {
  const m = migracoesEmOrdem().find((x) => x.nome === "020-sem-permissao-publica.sql");
  if (!m) throw new Error("a 020-sem-permissao-publica.sql não está na pasta migrations/");
  return m;
};

beforeAll(async () => {
  for (const papel of PAPEIS) {
    const [{ existe }] = (await sql().query(
      `select exists (select 1 from pg_roles where rolname = $1) as existe`,
      [papel]
    )) as { existe: boolean }[];
    if (!existe) {
      await sql().query(`create role ${papel} nologin`);
      criados.push(papel);
    }
  }
  // O que o Supabase concede: tudo nas tabelas que existem, e tudo nas que vierem.
  const schema = banco.nome();
  await sql().query(`grant usage on schema ${schema} to anon, authenticated`);
  await sql().query(`grant all on all tables in schema ${schema} to anon, authenticated`);
  for (const tipo of ["tables", "sequences", "functions"]) {
    await sql().query(
      `alter default privileges for role current_user in schema ${schema} grant all on ${tipo} to anon, authenticated`
    );
  }
  await sql().query(m020().comandos);
});

afterAll(async () => {
  // `drop owned by` também tira os privilégios PADRÃO que citam o papel, sem o quê o `drop role` cai.
  for (const papel of criados) {
    await sql().query(`drop owned by ${papel}`);
    await sql().query(`drop role if exists ${papel}`);
  }
});

/** Toda permissão que `anon` ou `authenticated` têm num objeto do schema descartável. */
async function permissoesDosPapeis(relkinds: string[]): Promise<string[]> {
  const linhas = (await sql().query(
    `select c.relname || ':' || a.grantee::regrole::text || ':' || a.privilege_type as p
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace,
       lateral aclexplode(c.relacl) a
      where n.nspname = current_schema()
        and c.relkind = any($1)
        and a.grantee <> 0
        and a.grantee::regrole::text in ('anon', 'authenticated')
      order by 1`,
    [relkinds]
  )) as { p: string }[];
  return linhas.map((l) => l.p);
}

describe("a chave pública sem permissão", () => {
  it("nenhuma tabela que existe dá permissão a anon ou authenticated", async () => {
    expect(await permissoesDosPapeis(["r", "p"])).toEqual([]);
  });

  it("os privilégios padrão do schema não citam anon nem authenticated", async () => {
    const linhas = (await sql().query(
      `select d.defaclobjtype::text || ':' || d.defaclacl::text as p
         from pg_default_acl d
        where d.defaclnamespace = current_schema()::regnamespace
          and d.defaclrole = current_user::regrole
          and d.defaclacl::text ~ '(^|[{,])(anon|authenticated)='`
    )) as { p: string }[];
    expect(linhas.map((l) => l.p)).toEqual([]);
  });

  it("uma tabela e uma sequência criadas DEPOIS da 020 nascem sem permissão para os dois", async () => {
    await sql().query(`create table tabela_futura (id int)`);
    await sql().query(`create sequence sequencia_futura`);
    expect(await permissoesDosPapeis(["r", "p", "S"])).toEqual([]);
    await sql().query(`drop table tabela_futura`);
    await sql().query(`drop sequence sequencia_futura`);
  });

  it("o dono continua lendo e gravando", async () => {
    await sql().query(`delete from config`);
    await sql().query(`insert into config (id) values (1) on conflict do nothing`);
    const linhas = (await sql().query(`select id from config`)) as { id: number }[];
    expect(linhas).toHaveLength(1);
  });

  it("a 020 roda duas vezes sem erro e sem mudar nada", async () => {
    await sql().query(m020().comandos);
    await sql().query(m020().comandos);
    expect(await permissoesDosPapeis(["r", "p", "S"])).toEqual([]);
  });
});
