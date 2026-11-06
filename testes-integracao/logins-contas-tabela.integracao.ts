// A TABELA DAS CONTAS POR LOGIN (a 023, docs/specs/2026-11-05-contas-por-login.md, seção 1) e o repositório
// dela (lib/logins-repositorio.ts), conferidos no banco de verdade (o container).
//
// A 023 é observável, como a 022: lib/esquema.ts a exige na partida (testes-integracao/
// esquema-de-partida.integracao.ts). O RLS e a falta de permissão de `anon` e `authenticated` são conferidos
// para toda tabela por testes-integracao/rls-nas-tabelas.integracao.ts e sem-permissao-publica.integracao.ts.
// Este arquivo confere as colunas, as chaves, o padrão novo do papel e as regras do repositório, com a peça
// mais delicada no fim: a trava do último administrador na troca do papel (o mesmo achado 168 do desativar).
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepositorio = typeof import("@/lib/logins-repositorio");

const banco = bancoDescartavel();

// Um hash com o formato certo, sem pagar o scrypt: o repositório não confere senha, só guarda.
const HASH = `scrypt$131072$8$1$${Buffer.alloc(16, 1).toString("base64")}$${Buffer.alloc(64, 2).toString("base64")}`;

let repo: ModuloRepositorio;

const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

beforeEach(async () => {
  repo ??= await import("@/lib/logins-repositorio");
  await q(`delete from logins_contas`);
  await q(`delete from sessoes`);
  await q(`delete from logins`);
  await q(`delete from accounts where ig_user_id like 'contas-por-login-%'`);
});

async function novoLogin(email: string, administrador: boolean): Promise<string> {
  const r = await repo.criarLogin({ email, nome: email.split("@")[0], senhaHash: HASH, administrador });
  if ("erro" in r) throw new Error(r.erro);
  return r.id;
}

async function novaConta(sufixo: string): Promise<string> {
  const id = `contas-por-login-${sufixo}`;
  await q(`insert into accounts (ig_user_id, username, access_token) values ($1, $2, 'token-de-teste')`, [id, sufixo]);
  return id;
}

const ligacoesDo = async (loginId: string) =>
  (await q(`select account_id from logins_contas where login_id = $1 order by account_id`, [loginId])).map((l) => l.account_id);

describe("a tabela logins_contas", () => {
  it("nasce da 023 com as colunas, a chave primária, o índice da conta e o RLS ligado", async () => {
    const colunas = await q(
      `select column_name, data_type, is_nullable from information_schema.columns
        where table_schema = current_schema() and table_name = 'logins_contas' order by ordinal_position`
    );
    expect(colunas).toEqual([
      { column_name: "login_id", data_type: "uuid", is_nullable: "NO" },
      { column_name: "account_id", data_type: "text", is_nullable: "NO" },
      { column_name: "criado_em", data_type: "timestamp with time zone", is_nullable: "NO" },
    ]);
    const [pk] = await q(
      `select pg_get_constraintdef(c.oid) as def from pg_constraint c
        join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = current_schema() and t.relname = 'logins_contas' and c.conname = 'logins_contas_pkey'`
    );
    expect(pk.def).toBe("PRIMARY KEY (login_id, account_id)");
    const indices = await q(
      `select indexname from pg_indexes where schemaname = current_schema() and tablename = 'logins_contas' order by indexname`
    );
    expect(indices.map((i) => i.indexname)).toEqual(["logins_contas_account_id_idx", "logins_contas_pkey"]);
    const [rls] = await q(
      `select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = current_schema() and c.relname = 'logins_contas'`
    );
    expect(rls.relrowsecurity).toBe(true);
  });

  it("as duas chaves estrangeiras apagam a ligação junto com o login e com a conta", async () => {
    const chaves = await q(
      `select c.conname, pg_get_constraintdef(c.oid) as def from pg_constraint c
        join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = current_schema() and t.relname = 'logins_contas' and c.contype = 'f' order by c.conname`
    );
    expect(chaves).toEqual([
      { conname: "logins_contas_account_id_fkey", def: "FOREIGN KEY (account_id) REFERENCES accounts(ig_user_id) ON DELETE CASCADE" },
      { conname: "logins_contas_login_id_fkey", def: "FOREIGN KEY (login_id) REFERENCES logins(id) ON DELETE CASCADE" },
    ]);
    const login = await novoLogin("cascata@exemplo.invalid", false);
    const a = await novaConta("a");
    const b = await novaConta("b");
    expect(await repo.definirContasDoLogin(login, [a, b])).toBe("ok");
    await q(`delete from accounts where ig_user_id = $1`, [a]);
    expect(await ligacoesDo(login)).toEqual([b]);
    await q(`delete from logins where id = $1`, [login]);
    expect(Number((await q(`select count(*)::int as n from logins_contas`))[0].n)).toBe(0);
  });

  it("o login criado sem dizer o papel nasce comum (o padrão novo da 023)", async () => {
    await q(`insert into logins (email, nome, senha_hash) values ('sem-papel@exemplo.invalid', 'Sem papel', $1)`, [HASH]);
    const [linha] = await q(`select administrador from logins where email = 'sem-papel@exemplo.invalid'`);
    expect(linha.administrador).toBe(false);
  });
});

describe("o repositório das contas por login", () => {
  it("criar grava o papel que veio, e nunca o padrão", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const linhas = await q(`select id, administrador from logins order by email`);
    expect(linhas).toEqual([
      { id: adm, administrador: true },
      { id: comum, administrador: false },
    ]);
  });

  it("salvar as contas troca o conjunto inteiro, e as contas voltam na ordem do id", async () => {
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    const b = await novaConta("b");
    const c = await novaConta("c");
    expect(await repo.definirContasDoLogin(comum, [b, a])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a, b]);
    expect(await repo.definirContasDoLogin(comum, [c])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([c]);
    expect(await repo.definirContasDoLogin(comum, [])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([]);
    // A MESMA CONTA DUAS VEZES vira uma ligação só, e não um erro de chave repetida.
    expect(await repo.definirContasDoLogin(comum, [a, a])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a]);
  });

  it("salvar as contas recusa a conta que não existe, sem mudar nada", async () => {
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    expect(await repo.definirContasDoLogin(comum, [a])).toBe("ok");
    expect(await repo.definirContasDoLogin(comum, [a, "contas-por-login-que-nao-existe"])).toBe("conta_inexistente");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a]);
  });

  it("salvar as contas recusa o administrador, o login desativado e o que não existe", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    expect(await repo.definirContasDoLogin(adm, [a])).toBe("administrador");
    expect(await ligacoesDo(adm)).toEqual([]);
    await q(`update logins set desativado_em = now() where id = $1`, [comum]);
    expect(await repo.definirContasDoLogin(comum, [a])).toBe("nao_encontrado");
    expect(await repo.definirContasDoLogin("00000000-0000-4000-8000-000000000000", [a])).toBe("nao_encontrado");
    expect(await repo.definirContasDoLogin("isto-nao-e-um-uuid", [a])).toBe("nao_encontrado");
  });

  it("trocar o papel recusa o próprio e o login que não existe", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    expect(await repo.definirPapelDoLogin(adm, false, adm)).toBe("proprio");
    expect(await repo.definirPapelDoLogin("00000000-0000-4000-8000-000000000000", true, adm)).toBe("nao_encontrado");
    expect(await repo.definirPapelDoLogin("isto-nao-e-um-uuid", true, adm)).toBe("nao_encontrado");
  });

  it("trocar o papel: o comum vira administrador, e o administrador vira comum, menos o último", async () => {
    const a = await novoLogin("a@exemplo.invalid", true);
    const b = await novoLogin("b@exemplo.invalid", false);
    expect(await repo.definirPapelDoLogin(b, true, a)).toBe("ok");
    expect(await repo.definirPapelDoLogin(b, false, a)).toBe("ok");
    // B voltou a comum, e A é o último administrador ativo. O pedido sai em nome de B só para passar da trava do
    // próprio: o repositório não confere quem pede, e a trava do último tem de segurar sozinha.
    expect(await repo.definirPapelDoLogin(a, false, b)).toBe("ultimo_administrador");
    const [linha] = await q(`select administrador from logins where id = $1`, [a]);
    expect(linha.administrador).toBe(true);
  });

  it("virar comum mantém as ligações que o login já tinha", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    expect(await repo.definirContasDoLogin(comum, [a])).toBe("ok");
    expect(await repo.definirPapelDoLogin(comum, true, adm)).toBe("ok");
    expect(await repo.definirPapelDoLogin(comum, false, adm)).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a]);
  });

  it("duas trocas de papel ao mesmo tempo deixam 1 administrador ativo, e não 0 (achado 168)", async () => {
    const a = await novoLogin("a@exemplo.invalid", true);
    const b = await novoLogin("b@exemplo.invalid", true);
    // O ACERTO DO TEMPO É FEITO PELO BANCO, como no teste do desativar: uma transação de fora segura as linhas dos
    // administradores, as duas trocas saem enquanto ela segura, e só então ela solta. Com o `for update`, a
    // segunda conta de novo depois da primeira; sem ele, as duas contam 2, e cada uma rebaixa a outra.
    let juntas: Promise<string[]> | undefined;
    await banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select id from logins where administrador and desativado_em is null for update`);
        juntas = Promise.all([repo.definirPapelDoLogin(b, false, a), repo.definirPapelDoLogin(a, false, b)]);
        await new Promise((r) => setTimeout(r, 400));
      });
    const resultados = await juntas!;
    expect([...resultados].sort()).toEqual(["ok", "ultimo_administrador"]);
    const [n] = await q(`select count(*)::int as n from logins where administrador and desativado_em is null`);
    expect(Number(n.n)).toBe(1);
  });
});
