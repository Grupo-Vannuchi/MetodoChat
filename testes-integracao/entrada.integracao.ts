// A ENTRADA COM E-MAIL E SENHA E A SESSÃO NO BANCO (docs/specs/2026-11-04-logins.md, seções 2, 3 e 6),
// pela ação de entrar de verdade (app/entrar/actions.ts), no contexto de requisição semeado e no banco
// descartável.
//
// O que se mede: a entrada certa abre UMA sessão e grava o cookie; toda entrada errada dá a mesma frase e
// nenhuma sessão; o freio de tentativas segue valendo; o login sem senha não entra; e o cookie v2 de antes
// não vale mais.
//
// A PASSAGEM DA SENHA ÚNICA SAIU (docs/specs/2026-11-05-contas-por-login.md, seção 5): até a entrega 2, um
// login sem senha entrava uma vez pela `ADMIN_PASSWORD` e gravava ali a senha própria. Agora ele tem a
// resposta de qualquer entrada errada, com o tempo de uma conferência, mesmo com a variável no ambiente (ela
// fica na Vercel até depois do merge).
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
});

const SENHA = "uma senha de login comprida";

async function novoLogin(email: string, senha: string | null = SENHA): Promise<string> {
  const r = await repo.criarLogin({
    email,
    nome: "Fulano",
    senhaHash: senha === null ? null : await logins.hashDaSenha(senha),
    administrador: true,
  });
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

/**
 * Roda o corpo com a ADMIN_PASSWORD de teste no ambiente, como ela ainda está na Vercel até depois do merge, e
 * a devolve como estava. É o pior caso para a entrada: a senha que antes era a única está à mão.
 */
async function comASenhaUnicaNoAmbiente<T>(corpo: () => Promise<T>): Promise<T> {
  const antes = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = SENHA_DE_TESTE;
  try {
    return await corpo();
  } finally {
    if (antes === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = antes;
  }
}

const senhaDe = async (id: string) => (await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash;

describe("o login sem senha", () => {
  it("é recusado com a frase de sempre, e nada é gravado no senha_hash", async () => {
    const id = await novoLogin("sem-senha@exemplo.invalid", null);
    const r = await entrar("sem-senha@exemplo.invalid", "uma senha qualquer que ele tentou");
    expect(r).toEqual({ erro: logins.FRASE_DA_ENTRADA_ERRADA, destino: null, cookie: null });
    expect(await senhaDe(id)).toBeNull();
    expect(await quantasSessoes()).toBe(0);
  });

  it("nem a senha de teste que antes era a única abre esse login, mesmo com a ADMIN_PASSWORD no ambiente", async () => {
    const id = await novoLogin("sem-senha@exemplo.invalid", null);
    const r = await comASenhaUnicaNoAmbiente(() => entrar("sem-senha@exemplo.invalid", SENHA_DE_TESTE));
    expect(r).toEqual({ erro: logins.FRASE_DA_ENTRADA_ERRADA, destino: null, cookie: null });
    expect(await senhaDe(id)).toBeNull();
    expect(await quantasSessoes()).toBe(0);
  });

  // O TEMPO NÃO CONTA: o login sem senha paga o scrypt de fachada, como o e-mail que não existe, para a
  // resposta não dizer de fora que aquele e-mail tem login.
  it("leva o tempo de uma conferência de senha", async () => {
    await novoLogin("sem-senha@exemplo.invalid", null);
    const t = performance.now();
    await entrar("sem-senha@exemplo.invalid", "uma senha qualquer que ele tentou");
    expect(performance.now() - t).toBeGreaterThan(150);
  });

  it("um login COM senha também não aceita a ADMIN_PASSWORD", async () => {
    await novoLogin("com-senha@exemplo.invalid");
    const r = await comASenhaUnicaNoAmbiente(() => entrar("com-senha@exemplo.invalid", SENHA_DE_TESTE));
    expect(r.erro).toBe(logins.FRASE_DA_ENTRADA_ERRADA);
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
