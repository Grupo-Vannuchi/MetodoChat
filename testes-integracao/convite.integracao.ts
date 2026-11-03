// O LINK DE CONVITE DE PONTA A PONTA (docs/specs/2026-11-03-link-de-convite.md): o começo pelo convite
// (`/api/oauth/convite/[codigo]`), a volta do Instagram com o cookie do convite e as actions do painel, contra
// o banco descartável.
//
// AS ROTAS SÃO CHAMADAS COMO A VERCEL AS CHAMA: o handler de verdade, com um `NextRequest`. A sessão, quando
// há, é a do login de verdade (`cabecalhoDaSessaoDeTeste`, ./semear-requisicao.ts). Valores inventados:
// nenhuma credencial de verdade entra em teste.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { cabecalhoDaSessaoDeTeste } from "./semear-requisicao";

type ModuloComeco = typeof import("@/app/api/oauth/convite/[codigo]/route");
type ModuloLogin = typeof import("@/app/api/oauth/login/route");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");

const banco = bancoDescartavel();

const APP_ID = "1234567890123456";
const APP_URL = "https://painel.exemplo.com.br";
const COOKIE_DO_STATE = "metodochat_oauth_state";
const COOKIE_DO_CONVITE = "metodochat_oauth_convite";

let comeco: ModuloComeco;
let login: ModuloLogin;
let repo: ModuloRepositorio;
let Pedido: typeof import("next/server").NextRequest;

beforeAll(async () => {
  comeco = await import("@/app/api/oauth/convite/[codigo]/route");
  login = await import("@/app/api/oauth/login/route");
  repo = await import("@/lib/convites-repositorio");
  Pedido = (await import("next/server")).NextRequest;
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from convites_de_conexao`);
  await banco.db().sql().query(
    `update config set instagram_app_id = $1, instagram_app_secret = null, app_url = $2 where id = 1`,
    [APP_ID, APP_URL]
  );
});

/** Todos os Set-Cookie da resposta, por nome. */
function cookies(resposta: Response): Map<string, string> {
  const todos = (resposta.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  return new Map(todos.map((c) => [c.slice(0, c.indexOf("=")), c]));
}

const destino = (resposta: Response) => new URL(resposta.headers.get("location") ?? "");

async function comecar(codigo: string): Promise<Response> {
  return comeco.GET(new Pedido(`${APP_URL}/api/oauth/convite/${codigo}`, { method: "GET" }), {
    params: Promise.resolve({ codigo }),
  });
}

// ---------------------------------------------------------------------------------------------------
// O COMEÇO PELO CONVITE
// ---------------------------------------------------------------------------------------------------

describe("o começo da conexão pelo convite", () => {
  it("com o convite pendente, manda ao Instagram com um state novo e grava os dois cookies", async () => {
    const { id, codigo } = await repo.criarConvite("Dr. Marcus");
    const resposta = await comecar(codigo);
    const para = destino(resposta);
    expect(para.origin).toBe("https://www.instagram.com");
    expect(para.searchParams.get("redirect_uri")).toBe(`${APP_URL}/api/oauth/callback`);
    const state = para.searchParams.get("state") ?? "";
    expect(state).toMatch(/^[0-9a-f]{64}$/);

    const c = cookies(resposta);
    const doState = c.get(COOKIE_DO_STATE) ?? "";
    const doConvite = c.get(COOKIE_DO_CONVITE) ?? "";
    expect(doState.startsWith(`${COOKIE_DO_STATE}=${state};`)).toBe(true);
    expect(doConvite.startsWith(`${COOKIE_DO_CONVITE}=${id};`)).toBe(true);
    for (const cookie of [doState, doConvite]) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/oauth/i);
      expect(cookie).toMatch(/Max-Age=600/i);
      expect(cookie).toMatch(/SameSite=lax/i);
    }
  });

  it("o convite cancelado, usado, vencido, inexistente ou torto volta para a página, sem cookie", async () => {
    const cancelado = await repo.criarConvite("cancelado");
    await repo.cancelarConvite(cancelado.id);
    const usado = await repo.criarConvite("usado");
    await repo.reivindicarEGravarConta(usado.id, {
      ig_user_id: "17800000000021002",
      username: "u",
      name: null,
      profile_picture_url: null,
      access_token: "t",
      token_expires_at: null,
    });
    const vencido = await repo.criarConvite("vencido");
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);

    for (const codigo of [cancelado.codigo, usado.codigo, vencido.codigo, "a".repeat(43), "torto"]) {
      const resposta = await comecar(codigo);
      expect(destino(resposta).toString()).toBe(`${APP_URL}/convite/${codigo}`);
      expect(cookies(resposta).size).toBe(0);
    }
  });

  it("sem o App ID cadastrado, manda para o erro, sem cookie", async () => {
    await banco.db().sql().query(`update config set instagram_app_id = null where id = 1`);
    const { codigo } = await repo.criarConvite("Dr. Marcus");
    const resposta = await comecar(codigo);
    expect(destino(resposta).pathname).toBe("/convite/erro");
    expect(destino(resposta).searchParams.get("motivo")).toBe("falhou");
    expect(cookies(resposta).size).toBe(0);
  });
});

describe("o começo da conexão de hoje, com a sessão", () => {
  it("apaga o cookie do convite, para a conexão normal não virar convite", async () => {
    const cookie = await cabecalhoDaSessaoDeTeste();
    const resposta = await login.GET(new Pedido(`${APP_URL}/api/oauth/login`, { method: "GET", headers: { cookie } }));
    const doConvite = cookies(resposta).get(COOKIE_DO_CONVITE) ?? "";
    expect(doConvite.startsWith(`${COOKIE_DO_CONVITE}=;`)).toBe(true);
    expect(doConvite).toMatch(/Path=\/api\/oauth/i);
    expect(doConvite).toMatch(/(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
    expect(cookies(resposta).get(COOKIE_DO_STATE)).toBeTruthy();
  });
});
