// A VOLTA DO INSTAGRAM COM O COOKIE DO CONVITE (docs/specs/2026-11-03-link-de-convite.md), e a volta de
// hoje, sem ele, contra o banco descartável.
//
// A META FALSA: um servidor HTTP na própria máquina para o Graph (`IG_GRAPH_BASE` preso ao loopback por
// uma guarda que falha ANTES de qualquer requisição sair, como em `agendados.integracao.ts`), e o `fetch`
// interceptado só neste arquivo para a troca do código, que vai a `api.instagram.com` sem desvio nenhum
// (`exchangeCodeForShortToken`, lib/ig.ts). O interceptador RECUSA qualquer endereço que não seja o
// loopback ou essa troca. **NADA AQUI CHAMA A META DE VERDADE.**
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloVolta = typeof import("@/app/api/oauth/callback/route");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");
type ModuloIg = typeof import("@/lib/ig");

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const APP_ID = "1234567890123456";
const APP_SECRET = "chave-secreta-do-app-de-teste-que-nao-vale-nada";
const APP_URL = "https://painel.exemplo.com.br";
const CONTA = "17800000000021501";
const CODE = "AQBcodigoDaVoltaDoInstagramDeTeste";
const STATE = "a".repeat(64);
const TOKEN_CURTO = "IGcurtoDeTesteQueNaoValeNada";
const TOKEN_LONGO = "IGlongoDeTesteQueNaoValeNada";
const COOKIE_DO_STATE = "metodochat_oauth_state";
const COOKIE_DO_CONVITE = "metodochat_oauth_convite";
const COOKIE_DA_CONTA = "metodochat_account";

const meta = {
  /** A resposta da troca do código em `api.instagram.com`. */
  troca: { status: 200, corpo: JSON.stringify({ access_token: TOKEN_CURTO, user_id: CONTA }) },
  /** Roda no meio da troca, antes de ela responder: é como o caso da disputa entra. */
  noMeioDaTroca: null as null | (() => Promise<void>),
  assinatura: { status: 200, corpo: JSON.stringify({ success: true }) },
  trocas: 0,
  assinaturas: 0,
  desconhecidos: [] as string[],
};

let servidorMeta: Server;
let volta: ModuloVolta;
let repo: ModuloRepositorio;
let ig: ModuloIg;
let Pedido: typeof import("next/server").NextRequest;

function responder(res: ServerResponse, status: number, corpo: string) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(corpo);
}

beforeAll(async () => {
  servidorMeta = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && u.pathname === "/access_token") {
      return responder(res, 200, JSON.stringify({ access_token: TOKEN_LONGO, expires_in: 5_184_000 }));
    }
    if (req.method === "GET" && u.pathname.endsWith("/me")) {
      return responder(res, 200, JSON.stringify({ user_id: CONTA, username: "conta_do_convite", name: "Conta" }));
    }
    if (req.method === "POST" && u.pathname.endsWith(`/${CONTA}/subscribed_apps`)) {
      meta.assinaturas++;
      return responder(res, meta.assinatura.status, meta.assinatura.corpo);
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, JSON.stringify({ error: { message: "a Meta falsa não conhece esse caminho" } }));
  });
  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${(servidorMeta.address() as AddressInfo).port}`;

  // O INTERCEPTADOR: só a troca do código e o loopback passam.
  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.href === "https://api.instagram.com/oauth/access_token") {
      meta.trocas++;
      if (meta.noMeioDaTroca) await meta.noMeioDaTroca();
      return new Response(meta.troca.corpo, { status: meta.troca.status });
    }
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  ig = await import("@/lib/ig");
  volta = await import("@/app/api/oauth/callback/route");
  repo = await import("@/lib/convites-repositorio");
  Pedido = (await import("next/server")).NextRequest;

  // A GUARDA, ANTES DE QUALQUER REQUISIÇÃO.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta rodada ` +
        `(${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste chamaria a Meta de verdade.`
    );
  }
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
});

beforeEach(async () => {
  meta.troca = { status: 200, corpo: JSON.stringify({ access_token: TOKEN_CURTO, user_id: CONTA }) };
  meta.noMeioDaTroca = null;
  meta.assinatura = { status: 200, corpo: JSON.stringify({ success: true }) };
  meta.trocas = 0;
  meta.assinaturas = 0;
  meta.desconhecidos.length = 0;
  await banco.db().sql().query(`delete from convites_de_conexao`);
  await banco.db().sql().query(`delete from events where account_id = $1`, [CONTA]);
  await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
  await banco.db().sql().query(
    `update config set instagram_app_id = $1, instagram_app_secret = $2, app_url = $3 where id = 1`,
    [APP_ID, APP_SECRET, APP_URL]
  );
});

/** A volta como o Instagram a chama, com os cookies que o começo gravou. */
async function voltar(opcoes: { convite?: string; state?: string; query?: string } = {}): Promise<Response> {
  const cookies = [`${COOKIE_DO_STATE}=${opcoes.state ?? STATE}`];
  if (opcoes.convite) cookies.push(`${COOKIE_DO_CONVITE}=${opcoes.convite}`);
  const query = opcoes.query ?? `code=${CODE}&state=${STATE}`;
  return volta.GET(
    new Pedido(`${APP_URL}/api/oauth/callback?${query}`, { method: "GET", headers: { cookie: cookies.join("; ") } })
  );
}

function setCookies(resposta: Response): Map<string, string> {
  const todos = (resposta.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  return new Map(todos.map((c) => [c.slice(0, c.indexOf("=")), c]));
}

const destino = (resposta: Response) => new URL(resposta.headers.get("location") ?? "");
const apagado = (cookie: string | undefined) => !!cookie && /=;/.test(cookie) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(cookie);

const conviteNoBanco = async (id: string) =>
  ((await banco.db().sql().query(`select * from convites_de_conexao where id = $1`, [id])) as Record<string, unknown>[])[0];

const tokenDaConta = async () =>
  ((await banco.db().sql().query(`select access_token from accounts where ig_user_id = $1`, [CONTA])) as {
    access_token: string;
  }[])[0]?.access_token ?? null;

function oFimDoConvite(resposta: Response, caminho: string, motivo?: string) {
  expect(destino(resposta).origin).toBe(APP_URL);
  expect(destino(resposta).pathname).toBe(caminho);
  expect(destino(resposta).searchParams.get("motivo")).toBe(motivo ?? null);
  const c = setCookies(resposta);
  expect(apagado(c.get(COOKIE_DO_STATE))).toBe(true);
  expect(apagado(c.get(COOKIE_DO_CONVITE))).toBe(true);
  expect(c.has(COOKIE_DA_CONTA)).toBe(false);
}

describe("a volta do Instagram pelo convite", () => {
  it("conecta a conta, usa o convite e manda para o \"Pronto\", sem o cookie da conta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/pronto");
    expect(await tokenDaConta()).toBe(TOKEN_LONGO);
    expect(await conviteNoBanco(id)).toMatchObject({ conta_conectada: CONTA, ultimo_erro: null });
    expect((await conviteNoBanco(id)).usado_em).toBeInstanceOf(Date);
    expect(meta.assinaturas).toBe(1);
    expect(meta.desconhecidos).toEqual([]);
  });

  it("o convite reivindicado no meio da troca (outra aba, ou cancelado) não grava a conta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    meta.noMeioDaTroca = async () => {
      await repo.cancelarConvite(id);
    };
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/erro", "vencido");
    expect(meta.trocas).toBe(1);
    expect(await tokenDaConta()).toBeNull();
    expect(meta.assinaturas).toBe(0);
  });

  it("o convite que já não vale manda para o erro sem chamar a Meta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    await repo.cancelarConvite(id);
    for (const convite of [id, "00000000-0000-4000-8000-000000000000", "torto"]) {
      oFimDoConvite(await voltar({ convite }), "/convite/erro", "vencido");
    }
    expect(meta.trocas).toBe(0);
    expect(await tokenDaConta()).toBeNull();
  });

  it("a Meta em erro deixa o convite pendente, com o erro limpo dos segredos (achado 159)", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    meta.troca = {
      status: 400,
      corpo: `{"error_message":"codigo ${CODE} recusado","pedido":"access_token=vazado&client_secret=${APP_SECRET}"}`,
    };
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/erro", "falhou");
    const linha = await conviteNoBanco(id);
    expect(linha.usado_em).toBeNull();
    const erro = String(linha.ultimo_erro);
    expect(erro).toContain("OCULTO");
    expect(erro).not.toContain(CODE);
    expect(erro).not.toContain("vazado");
    expect(erro).not.toContain(APP_SECRET);
    expect(erro.length).toBeLessThanOrEqual(160);
    expect(await tokenDaConta()).toBeNull();
  });

  it("a recusa no Instagram anota \"autorização negada\" e não chama a Meta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    const resposta = await voltar({ convite: id, query: `error=access_denied&state=${STATE}` });
    oFimDoConvite(resposta, "/convite/erro", "negado");
    expect((await conviteNoBanco(id)).ultimo_erro).toBe("autorização negada");
    expect(meta.trocas).toBe(0);
  });

  it("o state diferente recusa sem escrever nada, nem no convite", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    const resposta = await voltar({ convite: id, state: "b".repeat(64) });
    oFimDoConvite(resposta, "/convite/erro", "falhou");
    expect(await conviteNoBanco(id)).toMatchObject({ ultimo_erro: null, usado_em: null });
    expect(meta.trocas).toBe(0);
  });

  // O CONVITE DO LINKEDIN GRAVA OS MESMOS COOKIES (docs/specs/2026-11-06-linkedin-no-perfil.md, §3). Na volta do
  // Instagram, ele não pode servir para pôr um Instagram qualquer no painel.
  it("o convite do LinkedIn na volta do Instagram não conecta conta nenhuma, e não chama a Meta", async () => {
    const ALVO = "17800000000024301";
    await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [ALVO]);
    await banco
      .db()
      .sql()
      .query(`insert into accounts (ig_user_id, username, access_token) values ($1, 'alvo', 'ig-token-de-teste')`, [ALVO]);
    const { id } = await repo.criarConvite("@alvo", { rede: "linkedin", contaAlvo: ALVO });
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/erro", "vencido");
    expect(await conviteNoBanco(id)).toMatchObject({ usado_em: null, conta_conectada: null });
    expect(await tokenDaConta()).toBeNull();
    expect(meta.trocas).toBe(0);
  });

  it("a assinatura dos webhooks que falha fica no convite usado (achado 158), e a conta fica", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    meta.assinatura = { status: 500, corpo: JSON.stringify({ error: { message: "a Meta caiu" } }) };
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/pronto");
    expect(await tokenDaConta()).toBe(TOKEN_LONGO);
    const linha = await conviteNoBanco(id);
    expect(linha.conta_conectada).toBe(CONTA);
    expect(String(linha.ultimo_erro)).toMatch(/^conectada, mas a assinatura dos webhooks falhou: /);
    expect(String(linha.ultimo_erro)).not.toContain(TOKEN_LONGO);
    const eventos = (await banco
      .db()
      .sql()
      .query(`select type from events where account_id = $1`, [CONTA])) as { type: string }[];
    expect(eventos.map((e) => e.type)).toContain("subscribe_failed");
  });
});

describe("a volta do Instagram sem o convite, como hoje", () => {
  it("conecta, manda para o painel e grava o cookie da conta", async () => {
    const resposta = await voltar();
    expect(destino(resposta).toString()).toBe(`${APP_URL}/?conectado=1`);
    expect(setCookies(resposta).get(COOKIE_DA_CONTA)?.startsWith(`${COOKIE_DA_CONTA}=${CONTA};`)).toBe(true);
    expect(apagado(setCookies(resposta).get(COOKIE_DO_STATE))).toBe(true);
    expect(await tokenDaConta()).toBe(TOKEN_LONGO);
  });
});
