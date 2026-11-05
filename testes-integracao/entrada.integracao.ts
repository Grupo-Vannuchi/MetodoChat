// A ENTRADA COM E-MAIL E SENHA E A SESSÃO NO BANCO (docs/specs/2026-11-04-logins.md, seções 2, 3 e 6),
// pela ação de entrar de verdade (app/entrar/actions.ts), no contexto de requisição semeado e no banco
// descartável.
//
// O que se mede: a entrada certa abre UMA sessão e grava o cookie; toda entrada errada dá a mesma frase e
// nenhuma sessão; o freio de tentativas segue valendo; a passagem da senha única grava o hash uma vez, só
// num login sem senha; e o cookie v2 de antes não vale mais.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao, SENHA_DE_TESTE } from "./semear-requisicao";

type ModuloEntrar = typeof import("@/app/entrar/actions");
type ModuloRepositorio = typeof import("@/lib/logins-repositorio");
type ModuloLogins = typeof import("@/lib/logins");
type ModuloSessao = typeof import("@/lib/sessao");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

let entrarMod: ModuloEntrar;
let repo: ModuloRepositorio;
let logins: ModuloLogins;
let sessao: ModuloSessao;

beforeAll(async () => {
  entrarMod = await import("@/app/entrar/actions");
  repo = await import("@/lib/logins-repositorio");
  logins = await import("@/lib/logins");
  sessao = await import("@/lib/sessao");
});

beforeEach(async () => {
  await q(`delete from sessoes`);
  await q(`delete from logins`);
  await q(`delete from login_attempts`);
  process.env.ADMIN_PASSWORD = SENHA_DE_TESTE;
});

const SENHA = "uma senha de login comprida";

async function novoLogin(email: string, senha: string | null = SENHA): Promise<string> {
  const r = await repo.criarLogin({ email, nome: "Fulano", senhaHash: senha === null ? null : await logins.hashDaSenha(senha) });
  if ("erro" in r) throw new Error(r.erro);
  return r.id;
}

/** Roda a ação de entrar e devolve para onde ela mandou, o erro e o cookie que gravou. */
async function entrar(email: string, senha: string) {
  const { valor } = await comoNumaRequisicao("/entrar", async () => {
    const { cookies } = await import("next/headers");
    const { SESSION_COOKIE } = await import("@/lib/auth");
    const form = new FormData();
    form.set("email", email);
    form.set("password", senha);
    let erro: string | undefined;
    let destino: string | null = null;
    try {
      erro = (await entrarMod.login(undefined, form)).error;
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d !== "string" || !d.startsWith("NEXT_REDIRECT;")) throw e;
      destino = d.split(";").slice(2, -2).join(";");
    }
    return { erro, destino, cookie: (await cookies()).get(SESSION_COOKIE)?.value ?? null };
  });
  return valor;
}

const quantasSessoes = async () => Number((await q(`select count(*)::int as n from sessoes`))[0].n);

describe("a entrada", () => {
  it("a certa abre uma sessão, grava o cookie e manda para /", async () => {
    const id = await novoLogin("certa@exemplo.invalid");
    const r = await entrar("  Certa@Exemplo.INVALID ", SENHA);
    expect(r.destino).toBe("/");
    expect(r.erro).toBeUndefined();
    expect(logins.codigoDeSessaoBemFormado(r.cookie ?? undefined)).toBe(true);
    expect(await quantasSessoes()).toBe(1);
    expect((await sessao.sessaoDoCookie(r.cookie ?? undefined))?.id).toBe(id);
  });

  it("a senha errada, o e-mail que não existe e o login desativado dão a mesma frase e nenhuma sessão", async () => {
    const desativado = await novoLogin("desativado@exemplo.invalid");
    await q(`update logins set desativado_em = now() where id = $1`, [desativado]);
    await novoLogin("existe@exemplo.invalid");
    const respostas = [
      await entrar("existe@exemplo.invalid", "uma senha errada qualquer"),
      await entrar("ninguem@exemplo.invalid", SENHA),
      await entrar("desativado@exemplo.invalid", SENHA),
      await entrar("nem-e-email", SENHA),
    ];
    for (const r of respostas) {
      expect(r).toEqual({ erro: "E-mail ou senha incorretos.", destino: null, cookie: null });
    }
    expect(await quantasSessoes()).toBe(0);
  });

  it("o e-mail que não existe leva o tempo de uma conferência de senha", async () => {
    const t = performance.now();
    await entrar("ninguem@exemplo.invalid", SENHA);
    expect(performance.now() - t).toBeGreaterThan(150);
  });

  it("o freio de tentativas segue valendo: com 8 erros, nem a senha certa entra", async () => {
    await novoLogin("freio@exemplo.invalid");
    for (let i = 0; i < 8; i++) await entrar("freio@exemplo.invalid", "uma senha errada qualquer");
    const r = await entrar("freio@exemplo.invalid", SENHA);
    expect(r.erro).toMatch(/Muitas tentativas/);
    expect(r.cookie).toBeNull();
    expect(await quantasSessoes()).toBe(0);
  });
});

describe("a passagem da senha única", () => {
  it("o login sem senha entra com a ADMIN_PASSWORD, uma vez, e a segunda entrada já usa o hash", async () => {
    const id = await novoLogin("eduardo@exemplo.invalid", null);
    const primeira = await entrar("eduardo@exemplo.invalid", SENHA_DE_TESTE);
    expect(primeira.destino).toBe("/");
    const [linha] = await q(`select senha_hash from logins where id = $1`, [id]);
    expect(String(linha.senha_hash)).toMatch(/^scrypt\$/);
    expect(await logins.senhaConfere(SENHA_DE_TESTE, String(linha.senha_hash))).toBe(true);

    // A partir daqui, quem decide é o hash: trocar a ADMIN_PASSWORD não muda nada.
    process.env.ADMIN_PASSWORD = "outra senha unica qualquer";
    expect((await entrar("eduardo@exemplo.invalid", SENHA_DE_TESTE)).destino).toBe("/");
    expect((await entrar("eduardo@exemplo.invalid", "outra senha unica qualquer")).erro).toBe("E-mail ou senha incorretos.");
  });

  it("sem a ADMIN_PASSWORD no ambiente, a passagem recusa e não grava nada", async () => {
    const id = await novoLogin("eduardo@exemplo.invalid", null);
    delete process.env.ADMIN_PASSWORD;
    const r = await entrar("eduardo@exemplo.invalid", SENHA_DE_TESTE);
    expect(r.erro).toBe("E-mail ou senha incorretos.");
    expect((await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash).toBeNull();
  });

  it("a senha errada na passagem não grava nada", async () => {
    const id = await novoLogin("eduardo@exemplo.invalid", null);
    expect((await entrar("eduardo@exemplo.invalid", "nao e a senha unica")).erro).toBe("E-mail ou senha incorretos.");
    expect((await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash).toBeNull();
  });

  it("um login COM senha não aceita a ADMIN_PASSWORD", async () => {
    await novoLogin("com-senha@exemplo.invalid");
    const r = await entrar("com-senha@exemplo.invalid", SENHA_DE_TESTE);
    expect(r.erro).toBe("E-mail ou senha incorretos.");
    expect(await quantasSessoes()).toBe(0);
  });
});

describe("a sessão", () => {
  it("o cookie v2 de antes de 04/11 não vale", async () => {
    expect(await sessao.sessaoDoCookie("v2.1790000000.0123456789abcdef")).toBeNull();
  });

  it("a sessão apagada no banco deixa de valer na hora", async () => {
    await novoLogin("apagada@exemplo.invalid");
    const r = await entrar("apagada@exemplo.invalid", SENHA);
    expect(await sessao.sessaoDoCookie(r.cookie ?? undefined)).not.toBeNull();
    await q(`delete from sessoes`);
    expect(await sessao.sessaoDoCookie(r.cookie ?? undefined)).toBeNull();
  });
});
