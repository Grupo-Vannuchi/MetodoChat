// A ROTINA DIÁRIA E A CONEXÃO DO INSTAGRAM COM PORTEIRO (docs/specs/2026-10-27-cron-e-oauth.md).
//
// A rotina diária liberava sem senha onde a `CRON_SECRET` não existia (os previews leem o banco de
// produção), e a conexão do Instagram começava sem login e usava um `state` fixo, derivado da senha do
// painel, que servia para sempre. Aqui as três rotas são chamadas como a Vercel as chama: o handler de
// verdade, com um `NextRequest`, contra o banco descartável.
//
// A SESSÃO É A DO LOGIN DE VERDADE (`cabecalhoDaSessaoDeTeste`, ./semear-requisicao.ts): nenhum cookie é
// montado à mão. O segredo do cron é um literal de teste, e o cabeçalho é o mesmo que a Vercel manda.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { cabecalhoDaSessaoDeTeste, comoNumaRequisicao } from "./semear-requisicao";

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const SEGREDO_DO_CRON = "segredo-de-cron-de-teste-que-nao-vale-nada";
const APP_ID = "1234567890123456";
const APP_URL = "https://painel.exemplo.com.br";
const COOKIE_DO_STATE = "metodochat_oauth_state";
const CONTA_SEM_TOKEN = "17841400000000555";

type ModuloCron = typeof import("@/app/api/cron/daily/route");
type ModuloLogin = typeof import("@/app/api/oauth/login/route");
type ModuloVolta = typeof import("@/app/api/oauth/callback/route");
let cron: ModuloCron;
let login: ModuloLogin;
let volta: ModuloVolta;
let Pedido: typeof import("next/server").NextRequest;

beforeAll(async () => {
  cron = await import("@/app/api/cron/daily/route");
  login = await import("@/app/api/oauth/login/route");
  volta = await import("@/app/api/oauth/callback/route");
  Pedido = (await import("next/server")).NextRequest;
  // O App ID existe e a chave NÃO: a volta que passa do `state` cai no passo seguinte ("App ID e chave
  // secreta não cadastrados"), sem chamar a Meta. O app_url é estável, para o começo não regravá-lo.
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
  await banco.db().sql().query(
    `update config set instagram_app_id = $1, instagram_app_secret = null, app_url = $2 where id = 1`,
    [APP_ID, APP_URL]
  );
});

// ---------------------------------------------------------------------------------------------------
// A ROTINA DIÁRIA
// ---------------------------------------------------------------------------------------------------

/**
 * Um lote GUARDADO e VENCIDO. A rotina o encerra em `cancelarLotesVencidos` (lib/queue-drain.ts) mesmo
 * sem conta conectada, ao contrário do dreno, que volta cedo sem contas. É o sinal de que ela rodou.
 */
async function semearLoteVencido(): Promise<string> {
  // O objeto é montado NO SQL: um JSON serializado à mão e passado como parâmetro vira uma string jsonb, e
  // `lerPayloadDoLote` não o reconhece (o mesmo tropeço que o dono documentou nas colunas jsonb).
  const [{ id }] = (await banco.db().sql().query(
    `insert into queue (kind, status, account_id, contact_ig_id, payload)
     values ('dm_lote', 'guardado', $1, '123',
             jsonb_build_object('lote_id', 'lote-de-teste', 'text', 'texto de teste', 'valido_ate', $2::text))
     returning id`,
    [CONTA_SEM_TOKEN, new Date(Date.now() - 2 * 86_400_000).toISOString()]
  )) as { id: string }[];
  return id;
}

async function estadoDo(id: string): Promise<string> {
  const [{ status }] = (await banco.db().sql().query(`select status from queue where id = $1`, [id])) as {
    status: string;
  }[];
  return status;
}

async function chamarCron(autorizacao: string | null): Promise<number> {
  const { valor } = await comoNumaRequisicao("/api/cron/daily", async () => {
    const resposta = await cron.GET(
      new Pedido("https://exemplo.invalid/api/cron/daily", {
        method: "GET",
        headers: autorizacao ? { authorization: autorizacao } : {},
      })
    );
    return resposta.status;
  });
  return valor;
}

describe("a rotina diária", () => {
  it("sem CRON_SECRET, recusa e não mexe em nada", async () => {
    delete process.env.CRON_SECRET;
    const id = await semearLoteVencido();
    expect(await chamarCron(null)).toBe(401);
    expect(await estadoDo(id)).toBe("guardado");
  });

  it("com CRON_SECRET e o cabeçalho errado, recusa e não mexe em nada", async () => {
    process.env.CRON_SECRET = SEGREDO_DO_CRON;
    const id = await semearLoteVencido();
    expect(await chamarCron("Bearer outro-segredo")).toBe(401);
    expect(await estadoDo(id)).toBe("guardado");
  });

  it("com o cabeçalho que a Vercel manda, roda e encerra o lote vencido", async () => {
    process.env.CRON_SECRET = SEGREDO_DO_CRON;
    const id = await semearLoteVencido();
    expect(await chamarCron(`Bearer ${SEGREDO_DO_CRON}`)).toBe(200);
    expect(await estadoDo(id)).toBe("skipped");
  });
});

// ---------------------------------------------------------------------------------------------------
// O COMEÇO DA CONEXÃO
// ---------------------------------------------------------------------------------------------------

async function comecar(comSessao: boolean): Promise<Response> {
  const cookie = comSessao ? await cabecalhoDaSessaoDeTeste() : null;
  return login.GET(
    new Pedido(`${APP_URL}/api/oauth/login`, { method: "GET", headers: cookie ? { cookie } : {} })
  );
}

/** Os atributos do Set-Cookie do `state`, se a resposta gravou um. */
function cookieDoState(resposta: Response): string | null {
  const todos = (resposta.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  return todos.find((c) => c.startsWith(`${COOKIE_DO_STATE}=`)) ?? null;
}

describe("o começo da conexão do Instagram", () => {
  it("sem sessão, manda para /entrar e não entrega state nenhum", async () => {
    const resposta = await comecar(false);
    expect(new URL(resposta.headers.get("location") ?? "").pathname).toBe("/entrar");
    expect(cookieDoState(resposta)).toBe(null);
  });

  it("com sessão, manda ao Instagram com um state novo e o guarda no cookie dele", async () => {
    const resposta = await comecar(true);
    const destino = new URL(resposta.headers.get("location") ?? "");
    const state = destino.searchParams.get("state") ?? "";
    expect(destino.hostname).not.toBe(new URL(APP_URL).hostname);
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    const cookie = cookieDoState(resposta) ?? "";
    expect(cookie.startsWith(`${COOKIE_DO_STATE}=${state};`)).toBe(true);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/oauth/i);
    expect(cookie).toMatch(/Max-Age=600/i);
  });

  it("duas conexões seguidas têm state diferentes", async () => {
    const um = new URL((await comecar(true)).headers.get("location") ?? "").searchParams.get("state");
    const outro = new URL((await comecar(true)).headers.get("location") ?? "").searchParams.get("state");
    expect(um).not.toBe(outro);
  });
});

// ---------------------------------------------------------------------------------------------------
// A VOLTA DA CONEXÃO
// ---------------------------------------------------------------------------------------------------

const STATE = "a".repeat(64);

async function voltar(cookieDoStateEnviado: string | null): Promise<Response> {
  return volta.GET(
    new Pedido(`${APP_URL}/api/oauth/callback?code=codigo-de-teste&state=${STATE}`, {
      method: "GET",
      headers: cookieDoStateEnviado ? { cookie: `${COOKIE_DO_STATE}=${cookieDoStateEnviado}` } : {},
    })
  );
}

const erroDa = (resposta: Response) => new URL(resposta.headers.get("location") ?? "").searchParams.get("erro");

/** A resposta apaga o cookie do state: um Set-Cookie dele vazio, que expira. */
function apagaOCookie(resposta: Response): boolean {
  const c = cookieDoState(resposta) ?? "";
  return c.startsWith(`${COOKIE_DO_STATE}=;`) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(c);
}

describe("a volta da conexão do Instagram", () => {
  it("sem o cookie do state, recusa como state inválido, e apaga o cookie", async () => {
    const resposta = await voltar(null);
    expect(erroDa(resposta)).toBe("state inválido");
    expect(apagaOCookie(resposta)).toBe(true);
  });

  it("com o cookie diferente do state, recusa igual, e apaga o cookie", async () => {
    const resposta = await voltar("b".repeat(64));
    expect(erroDa(resposta)).toBe("state inválido");
    expect(apagaOCookie(resposta)).toBe(true);
  });

  it("com o cookie igual ao state, passa da conferência, e apaga o cookie", async () => {
    const resposta = await voltar(STATE);
    expect(erroDa(resposta)).toBe("App ID e chave secreta não cadastrados no /setup");
    expect(apagaOCookie(resposta)).toBe(true);
  });
});
