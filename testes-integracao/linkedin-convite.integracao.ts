// O CONVITE DO LINKEDIN DE PONTA A PONTA (docs/specs/2026-11-06-linkedin-no-perfil.md, §3; a parte 1, a
// conexão): o começo pelo link (`/api/oauth/convite/[codigo]`) com um convite do LinkedIn e a volta nova
// (`/api/oauth/linkedin/callback`), contra o banco descartável.
//
// O LINKEDIN FALSO: um servidor HTTP na própria máquina, para a troca do código e o `userinfo`. As duas bases
// do LinkedIn (lib/linkedin.ts) vão para ele sob as duas travas (`VITEST` e o loopback), e uma guarda confere
// isso ANTES de qualquer requisição. O `fetch` é interceptado só neste arquivo e RECUSA qualquer endereço que
// não seja o loopback. **NADA AQUI CHAMA O LINKEDIN DE VERDADE.** Valores inventados: nenhuma credencial de
// verdade entra em teste.
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloComeco = typeof import("@/app/api/oauth/convite/[codigo]/route");
type ModuloVolta = typeof import("@/app/api/oauth/linkedin/callback/route");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");
type ModuloLinkedin = typeof import("@/lib/linkedin");

const banco = bancoDescartavel();

const APP_URL = "https://painel.exemplo.com.br";
const CLIENT_ID = "idDoAppDoLinkedinDeTeste";
const CLIENT_SECRET = "segredo-do-app-do-linkedin-de-teste-que-nao-vale-nada";
const CONTA = "17800000000024101";
const CODE = "AQTcodigoDaVoltaDoLinkedinDeTeste";
const STATE = "c".repeat(64);
const TOKEN = "AQVautorizacaoDoLinkedinDeTesteQueNaoValeNada";
const ID_TOKEN = "eyJidDoOpenIdDeTesteQueNaoPodeIrAoBanco";
const COOKIE_DO_STATE = "metodochat_oauth_state";
const COOKIE_DO_CONVITE = "metodochat_oauth_convite";
const VOLTA = `${APP_URL}/api/oauth/linkedin/callback`;

const linkedin = {
  troca: { status: 200, corpo: "" },
  userinfo: { status: 200, corpo: "" },
  /** Roda no meio da troca, antes de ela responder: é como o caso da disputa entra. */
  noMeioDaTroca: null as null | (() => Promise<void>),
  pedidosDeTroca: [] as URLSearchParams[],
  autorizacoesDoUserinfo: [] as string[],
  desconhecidos: [] as string[],
};

const trocaQueDaCerto = (scope = "openid,profile,w_member_social") =>
  JSON.stringify({ access_token: TOKEN, expires_in: 5_183_999, scope, token_type: "Bearer", id_token: ID_TOKEN });
const pessoaQueDaCerto = (sub = "pessoaDoLinkedinA1", name = "Dra. Ana Souza") =>
  JSON.stringify({ sub, name, given_name: "Ana", family_name: "Souza", locale: { country: "BR", language: "pt" } });

let servidor: Server;
let comeco: ModuloComeco;
let volta: ModuloVolta;
let repo: ModuloRepositorio;
let li: ModuloLinkedin;
let Pedido: typeof import("next/server").NextRequest;

function responder(res: ServerResponse, status: number, corpo: string) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(corpo);
}

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "POST" && u.pathname === "/oauth/v2/accessToken") {
      let corpo = "";
      req.on("data", (pedaco) => (corpo += pedaco));
      req.on("end", async () => {
        linkedin.pedidosDeTroca.push(new URLSearchParams(corpo));
        if (linkedin.noMeioDaTroca) await linkedin.noMeioDaTroca();
        responder(res, linkedin.troca.status, linkedin.troca.corpo);
      });
      return;
    }
    if (req.method === "GET" && u.pathname === "/v2/userinfo") {
      linkedin.autorizacoesDoUserinfo.push(String(req.headers.authorization ?? ""));
      return responder(res, linkedin.userinfo.status, linkedin.userinfo.corpo);
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, JSON.stringify({ message: "o LinkedIn falso não conhece esse caminho" }));
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  process.env.LINKEDIN_API_BASE = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  // O INTERCEPTADOR: só o loopback passa.
  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  li = await import("@/lib/linkedin");
  comeco = await import("@/app/api/oauth/convite/[codigo]/route");
  volta = await import("@/app/api/oauth/linkedin/callback/route");
  repo = await import("@/lib/convites-repositorio");
  Pedido = (await import("next/server")).NextRequest;

  // A GUARDA, ANTES DE QUALQUER REQUISIÇÃO.
  const bases = li.basesDoLinkedin();
  if (bases.api !== process.env.LINKEDIN_API_BASE || bases.oauth !== process.env.LINKEDIN_API_BASE) {
    throw new Error(
      `RECUSADO: as bases do LinkedIn são ${JSON.stringify(bases)}, e tinham de ser as desta rodada ` +
        `(${process.env.LINKEDIN_API_BASE}). Sem o desvio, este teste chamaria o LinkedIn de verdade.`
    );
  }
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.LINKEDIN_API_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv("LINKEDIN_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", CLIENT_SECRET);
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
  linkedin.troca = { status: 200, corpo: trocaQueDaCerto() };
  linkedin.userinfo = { status: 200, corpo: pessoaQueDaCerto() };
  linkedin.noMeioDaTroca = null;
  linkedin.pedidosDeTroca.length = 0;
  linkedin.autorizacoesDoUserinfo.length = 0;
  linkedin.desconhecidos.length = 0;
  const sql = banco.db().sql();
  await sql.query(`delete from linkedin_conexoes`);
  await sql.query(`delete from convites_de_conexao`);
  await sql.query(`delete from accounts where ig_user_id = $1`, [CONTA]);
  await sql.query(`insert into accounts (ig_user_id, username, access_token) values ($1, 'conta_da_ana', 'ig-token-de-teste')`, [
    CONTA,
  ]);
  await sql.query(`update config set app_url = $1 where id = 1`, [APP_URL]);
});

const conviteDoLinkedin = () => repo.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });

function cookies(resposta: Response): Map<string, string> {
  const todos = (resposta.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  return new Map(todos.map((c) => [c.slice(0, c.indexOf("=")), c]));
}

const destino = (resposta: Response) => new URL(resposta.headers.get("location") ?? "");
const apagado = (cookie: string | undefined) =>
  !!cookie && /=;/.test(cookie) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(cookie);

async function comecar(codigo: string): Promise<Response> {
  return comeco.GET(new Pedido(`${APP_URL}/api/oauth/convite/${codigo}`, { method: "GET" }), {
    params: Promise.resolve({ codigo }),
  });
}

/** A volta como o LinkedIn a chama, com os cookies que o começo gravou. */
async function voltar(opcoes: { convite?: string | null; state?: string; query?: string } = {}): Promise<Response> {
  const lista = [`${COOKIE_DO_STATE}=${opcoes.state ?? STATE}`];
  if (opcoes.convite) lista.push(`${COOKIE_DO_CONVITE}=${opcoes.convite}`);
  const query = opcoes.query ?? `code=${CODE}&state=${STATE}`;
  return volta.GET(new Pedido(`${VOLTA}?${query}`, { method: "GET", headers: { cookie: lista.join("; ") } }));
}

const conviteNoBanco = async (id: string) =>
  ((await banco.db().sql().query(`select * from convites_de_conexao where id = $1`, [id])) as Record<string, unknown>[])[0];

const conexaoNoBanco = async () =>
  ((await banco.db().sql().query(`select * from linkedin_conexoes where account_id = $1`, [CONTA])) as Record<
    string,
    unknown
  >[])[0] ?? null;

function oFim(resposta: Response, caminho: string, motivo?: string) {
  expect(destino(resposta).origin).toBe(APP_URL);
  expect(destino(resposta).pathname).toBe(caminho);
  expect(destino(resposta).searchParams.get("rede")).toBe("linkedin");
  expect(destino(resposta).searchParams.get("motivo")).toBe(motivo ?? null);
  const c = cookies(resposta);
  expect(apagado(c.get(COOKIE_DO_STATE))).toBe(true);
  expect(apagado(c.get(COOKIE_DO_CONVITE))).toBe(true);
}

const nenhumaChamada = () => {
  expect(linkedin.pedidosDeTroca).toHaveLength(0);
  expect(linkedin.autorizacoesDoUserinfo).toHaveLength(0);
};

// ---------------------------------------------------------------------------------------------------
// O COMEÇO
// ---------------------------------------------------------------------------------------------------

describe("o começo da conexão pelo convite do LinkedIn", () => {
  it("manda à autorização do LinkedIn, com a volta nova no endereço canônico, e grava os dois cookies", async () => {
    const { id, codigo } = await conviteDoLinkedin();
    const resposta = await comecar(codigo);
    const para = destino(resposta);
    expect(para.origin).toBe("https://www.linkedin.com");
    expect(para.pathname).toBe("/oauth/v2/authorization");
    expect(para.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(para.searchParams.get("redirect_uri")).toBe(VOLTA);
    expect(para.searchParams.get("scope")).toBe("openid profile w_member_social");
    const state = para.searchParams.get("state") ?? "";
    expect(state).toMatch(/^[0-9a-f]{64}$/);

    const c = cookies(resposta);
    expect(c.get(COOKIE_DO_STATE)?.startsWith(`${COOKIE_DO_STATE}=${state};`)).toBe(true);
    expect(c.get(COOKIE_DO_CONVITE)?.startsWith(`${COOKIE_DO_CONVITE}=${id};`)).toBe(true);
    for (const cookie of [c.get(COOKIE_DO_STATE) ?? "", c.get(COOKIE_DO_CONVITE) ?? ""]) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/oauth/i);
      expect(cookie).toMatch(/Max-Age=600/i);
      expect(cookie).toMatch(/SameSite=lax/i);
    }
    // A chave secreta nunca vai no endereço da autorização.
    expect(para.toString()).not.toContain(CLIENT_SECRET);
  });

  it("no preview, a volta é o endereço da branch (o cadastrado no app para a prova)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "metodochat-git-linkedin-conexao-time.vercel.app");
    const { codigo } = await conviteDoLinkedin();
    expect(destino(await comecar(codigo)).searchParams.get("redirect_uri")).toBe(
      "https://metodochat-git-linkedin-conexao-time.vercel.app/api/oauth/linkedin/callback"
    );
  });

  it("sem as chaves do app nas variáveis, manda para o erro do LinkedIn, sem cookie", async () => {
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    const { codigo } = await conviteDoLinkedin();
    const resposta = await comecar(codigo);
    expect(destino(resposta).pathname).toBe("/convite/erro");
    expect(destino(resposta).searchParams.get("motivo")).toBe("falhou");
    expect(destino(resposta).searchParams.get("rede")).toBe("linkedin");
    expect(cookies(resposta).size).toBe(0);
  });

  it("o convite do LinkedIn que já não vale volta para a página do link, sem cookie", async () => {
    const { id, codigo } = await conviteDoLinkedin();
    await repo.cancelarConvite(id);
    const resposta = await comecar(codigo);
    expect(destino(resposta).toString()).toBe(`${APP_URL}/convite/${codigo}`);
    expect(cookies(resposta).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------
// A VOLTA
// ---------------------------------------------------------------------------------------------------

describe("a volta do LinkedIn", () => {
  it("troca o código com a mesma volta do começo, lê a pessoa, grava a conexão na conta-alvo e usa o convite", async () => {
    const { id, codigo } = await conviteDoLinkedin();
    const redirectDoComeco = destino(await comecar(codigo)).searchParams.get("redirect_uri");
    const antes = Date.now();
    const resposta = await voltar({ convite: id });
    oFim(resposta, "/convite/pronto");

    expect(linkedin.pedidosDeTroca).toHaveLength(1);
    expect(Object.fromEntries(linkedin.pedidosDeTroca[0])).toEqual({
      grant_type: "authorization_code",
      code: CODE,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectDoComeco,
    });
    expect(linkedin.autorizacoesDoUserinfo).toEqual([`Bearer ${TOKEN}`]);

    const conexao = await conexaoNoBanco();
    expect(conexao).toMatchObject({ pessoa_id: "pessoaDoLinkedinA1", nome: "Dra. Ana Souza", access_token: TOKEN });
    const expira = (conexao!.expira_em as Date).getTime();
    expect(expira).toBeGreaterThanOrEqual(antes + 5_183_999_000);
    expect(expira).toBeLessThanOrEqual(Date.now() + 5_183_999_000);

    const convite = await conviteNoBanco(id);
    expect(convite).toMatchObject({ conta_conectada: CONTA, ultimo_erro: null });
    expect(convite.usado_em).toBeInstanceOf(Date);
    expect(linkedin.desconhecidos).toEqual([]);
  });

  it("o id_token da troca é descartado: não vai a coluna nenhuma", async () => {
    const { id } = await conviteDoLinkedin();
    await voltar({ convite: id });
    const linhas = [await conexaoNoBanco(), await conviteNoBanco(id)];
    for (const linha of linhas) {
      for (const valor of Object.values(linha ?? {})) expect(String(valor)).not.toContain(ID_TOKEN);
    }
  });

  it("o state diferente, ou a volta sem o cookie do convite, recusa sem escrever nada e sem chamar o LinkedIn", async () => {
    const { id } = await conviteDoLinkedin();
    oFim(await voltar({ convite: id, state: "d".repeat(64) }), "/convite/erro", "falhou");
    oFim(await voltar({ convite: null }), "/convite/erro", "falhou");
    expect(await conviteNoBanco(id)).toMatchObject({ ultimo_erro: null, usado_em: null });
    expect(await conexaoNoBanco()).toBeNull();
    nenhumaChamada();
  });

  it("a recusa no LinkedIn anota \"autorização negada no LinkedIn\" e não chama o LinkedIn", async () => {
    const { id } = await conviteDoLinkedin();
    oFim(
      await voltar({ convite: id, query: `error=user_cancelled_authorize&error_description=x&state=${STATE}` }),
      "/convite/erro",
      "negado"
    );
    expect((await conviteNoBanco(id)).ultimo_erro).toBe("autorização negada no LinkedIn");
    nenhumaChamada();
  });

  it("o convite cancelado, usado ou vencido manda para o erro sem chamar o LinkedIn", async () => {
    const cancelado = await conviteDoLinkedin();
    await repo.cancelarConvite(cancelado.id);
    const vencido = await conviteDoLinkedin();
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);
    const usado = await conviteDoLinkedin();
    await repo.reivindicarEGravarConexao(usado.id, {
      pessoa_id: "p",
      nome: "n",
      access_token: "t",
      expira_em: new Date(Date.now() + 86_400_000),
    });
    for (const convite of [cancelado.id, vencido.id, usado.id, "00000000-0000-4000-8000-000000000000", "torto"]) {
      oFim(await voltar({ convite }), "/convite/erro", "vencido");
    }
    nenhumaChamada();
  });

  it("o convite do Instagram na volta do LinkedIn não conecta nada e não chama o LinkedIn", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    oFim(await voltar({ convite: id }), "/convite/erro", "vencido");
    expect(await conviteNoBanco(id)).toMatchObject({ usado_em: null });
    expect(await conexaoNoBanco()).toBeNull();
    nenhumaChamada();
  });

  it("a conta-alvo apagada leva o convite junto, e a volta não grava nada", async () => {
    const { id } = await conviteDoLinkedin();
    await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
    oFim(await voltar({ convite: id }), "/convite/erro", "vencido");
    nenhumaChamada();
  });

  it("sem a permissão de publicar no scope, não conecta, e o motivo fica no convite", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.troca = { status: 200, corpo: trocaQueDaCerto("openid,profile") };
    oFim(await voltar({ convite: id }), "/convite/erro", "falhou");
    const convite = await conviteNoBanco(id);
    expect(convite.usado_em).toBeNull();
    expect(String(convite.ultimo_erro)).toContain("w_member_social");
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("o LinkedIn em erro na troca deixa o convite pendente, com o erro limpo do código e da chave", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.troca = {
      status: 400,
      corpo: JSON.stringify({ error: "invalid_request", error_description: `codigo ${CODE} com a chave ${CLIENT_SECRET}` }),
    };
    oFim(await voltar({ convite: id }), "/convite/erro", "falhou");
    const convite = await conviteNoBanco(id);
    expect(convite.usado_em).toBeNull();
    const erro = String(convite.ultimo_erro);
    expect(erro).toContain("OCULTO");
    expect(erro).not.toContain(CODE);
    expect(erro).not.toContain(CLIENT_SECRET);
    expect(erro.length).toBeLessThanOrEqual(160);
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("o userinfo em erro não leva a autorização para o texto do erro", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.userinfo = { status: 401, corpo: JSON.stringify({ message: `token ${TOKEN} recusado` }) };
    oFim(await voltar({ convite: id }), "/convite/erro", "falhou");
    const erro = String((await conviteNoBanco(id)).ultimo_erro);
    expect(erro).toContain("OCULTO");
    expect(erro).not.toContain(TOKEN);
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("o convite reivindicado no meio da troca (outra aba, ou cancelado) não grava a conexão", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.noMeioDaTroca = async () => {
      await repo.cancelarConvite(id);
    };
    oFim(await voltar({ convite: id }), "/convite/erro", "vencido");
    expect(linkedin.pedidosDeTroca).toHaveLength(1);
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("a reconexão com outra pessoa troca a pessoa e o nome da conexão da conta", async () => {
    const primeiro = await conviteDoLinkedin();
    await voltar({ convite: primeiro.id });
    const segundo = await conviteDoLinkedin();
    linkedin.userinfo = { status: 200, corpo: pessoaQueDaCerto("pessoaDoLinkedinB2", "Dr. Bruno Lima") };
    oFim(await voltar({ convite: segundo.id }), "/convite/pronto");
    expect(await conexaoNoBanco()).toMatchObject({ pessoa_id: "pessoaDoLinkedinB2", nome: "Dr. Bruno Lima" });
    expect(((await banco.db().sql().query(`select count(*)::int as n from linkedin_conexoes`)) as { n: number }[])[0].n).toBe(1);
  });
});
