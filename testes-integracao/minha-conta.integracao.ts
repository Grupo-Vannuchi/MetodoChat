// A MINHA CONTA E O SAIR (docs/specs/2026-11-04-logins.md, seção 5), com a sessão do login de teste, no
// contexto de requisição semeado e no banco descartável.
//
// Cada caso começa com o login de teste recriado (o `beforeEach` o apaga, e o harness o cria de novo na
// primeira chamada com sessão), porque a troca de senha muda a senha dele, e o Sair apaga a sessão.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComSessao, EMAIL_DE_TESTE, SENHA_DE_TESTE } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/minha-conta/actions");
type ModuloPagina = typeof import("@/app/minha-conta/page");
type ModuloRepositorio = typeof import("@/lib/logins-repositorio");
type ModuloLogins = typeof import("@/lib/logins");
type ModuloTextos = typeof import("@/lib/logins-textos");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

let acoes: ModuloAcoes;
let pagina: ModuloPagina;
let repo: ModuloRepositorio;
let logins: ModuloLogins;
let textos: ModuloTextos;

beforeAll(async () => {
  acoes = await import("@/app/minha-conta/actions");
  pagina = await import("@/app/minha-conta/page");
  repo = await import("@/lib/logins-repositorio");
  logins = await import("@/lib/logins");
  textos = await import("@/lib/logins-textos");
});

beforeEach(async () => {
  await q(`delete from logins where email = $1`, [EMAIL_DE_TESTE]);
  await q(`delete from login_attempts`);
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

/** Roda o corpo com a sessão de teste e devolve o destino do redirect (ou null), o valor e o cookie no fim. */
async function comSessao<T>(rota: string, corpo: () => Promise<T>) {
  const { valor } = await comoNumaRequisicaoComSessao(rota, async () => {
    const { cookies } = await import("next/headers");
    const { SESSION_COOKIE } = await import("@/lib/auth");
    let destino: string | null = null;
    let resultado: T | undefined;
    try {
      resultado = await corpo();
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d !== "string" || !d.startsWith("NEXT_REDIRECT;")) throw e;
      destino = d.split(";").slice(2, -2).join(";");
    }
    // O cookie apagado volta vazio ou some, conforme a jarra; os dois contam como "sem cookie".
    return { destino, valor: resultado, cookie: (await cookies()).get(SESSION_COOKIE)?.value || null };
  });
  return valor;
}

const NOVA = "a senha nova do login de teste";
const loginDoTeste = async () => (await q(`select id, senha_hash from logins where email = $1`, [EMAIL_DE_TESTE]))[0];
const sessoesDo = async (id: unknown) => Number((await q(`select count(*)::int as n from sessoes where login_id = $1`, [id]))[0].n);

describe("a troca da própria senha", () => {
  it("troca, mantém a sessão de quem trocou e derruba as outras", async () => {
    await comSessao("/minha-conta", async () => null);
    const { id } = await loginDoTeste();
    const outra = await repo.criarSessao(String(id));
    const r = await comSessao("/minha-conta", () =>
      acoes.trocarMinhaSenha({}, form({ atual: SENHA_DE_TESTE, nova: NOVA, confirmacao: NOVA }))
    );
    expect(r.valor).toEqual({ ok: textos.FRASE_DA_SENHA_TROCADA });
    expect(await sessoesDo(id)).toBe(1);
    expect(await repo.sessaoPorCodigo(outra)).toBeNull();
    expect(await logins.senhaConfere(NOVA, String((await loginDoTeste()).senha_hash))).toBe(true);
  });

  it("recusa a senha atual errada, a nova curta e a confirmação diferente, sem trocar", async () => {
    await comSessao("/minha-conta", async () => null);
    const antes = String((await loginDoTeste()).senha_hash);
    const casos: [Record<string, string>, string][] = [
      [{ atual: "nao e a senha atual", nova: NOVA, confirmacao: NOVA }, textos.FRASE_DA_SENHA_ATUAL],
      [{ atual: SENHA_DE_TESTE, nova: "curta", confirmacao: "curta" }, textos.FRASE_DA_SENHA],
      [{ atual: SENHA_DE_TESTE, nova: NOVA, confirmacao: `${NOVA}!` }, textos.FRASE_DA_CONFIRMACAO],
    ];
    for (const [campos, frase] of casos) {
      const r = await comSessao("/minha-conta", () => acoes.trocarMinhaSenha({}, form(campos)));
      expect(r.valor, JSON.stringify(campos)).toEqual({ erro: frase });
    }
    expect(String((await loginDoTeste()).senha_hash)).toBe(antes);
  });

  it("a senha atual errada conta no freio: com 8 erros, nem a certa troca (achado 171)", async () => {
    await comSessao("/minha-conta", async () => null);
    for (let i = 0; i < 8; i++) {
      await comSessao("/minha-conta", () =>
        acoes.trocarMinhaSenha({}, form({ atual: "nao e a senha atual", nova: NOVA, confirmacao: NOVA }))
      );
    }
    expect(Number((await q(`select count(*)::int as n from login_attempts`))[0].n)).toBe(8);
    const r = await comSessao("/minha-conta", () =>
      acoes.trocarMinhaSenha({}, form({ atual: SENHA_DE_TESTE, nova: NOVA, confirmacao: NOVA }))
    );
    expect(r.valor?.erro).toMatch(/Muitas tentativas/);
    expect(await logins.senhaConfere(SENHA_DE_TESTE, String((await loginDoTeste()).senha_hash))).toBe(true);
  });
});

describe("o Sair", () => {
  it("apaga a sessão no banco e o cookie, e manda para /entrar", async () => {
    await comSessao("/minha-conta", async () => null);
    const { id } = await loginDoTeste();
    expect(await sessoesDo(id)).toBe(1);
    const r = await comSessao("/minha-conta", () => acoes.sair());
    expect(r.destino).toBe("/entrar");
    expect(r.cookie).toBeNull();
    expect(await sessoesDo(id)).toBe(0);
  });

  it("abrir a página Minha conta (um GET) não derruba a sessão (achado 169)", async () => {
    const r = await comSessao("/minha-conta", async () => renderToStaticMarkup(await pagina.default()));
    expect(String(r.valor)).toContain(EMAIL_DE_TESTE);
    expect(String(r.valor)).not.toContain("scrypt$");
    const { id } = await loginDoTeste();
    expect(await sessoesDo(id)).toBe(1);
  });
});
