// AS AÇÕES DO LINKEDIN NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §7; a parte 1, a
// conexão): gerar o convite do LinkedIn de uma conta e desconectar, com a sessão do administrador de teste,
// contra o banco descartável. Que o login comum não chega a nenhuma das duas é conferido em
// testes-integracao/contas-por-login.integracao.ts, com as outras ações da Configuração.
//
// Nenhuma das duas fala com o LinkedIn. Valores inventados: nenhuma credencial de verdade entra em teste.
import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComSessao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/setup/actions");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const APP_URL = "https://painel.exemplo.com.br";
const CONTA = "17800000000024401";

let acoes: ModuloAcoes;

beforeAll(async () => {
  acoes = await import("@/app/setup/actions");
  await q(`insert into config (id) values (1) on conflict do nothing`);
});

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv("LINKEDIN_CLIENT_ID", "idDoAppDoLinkedinDeTeste");
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", "segredo-do-app-do-linkedin-de-teste");
  // A URL do app vem do ambiente antes do banco (`envAppUrl`, lib/app-url.ts).
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
  await q(`delete from linkedin_conexoes`);
  await q(`delete from convites_de_conexao`);
  await q(`delete from accounts where ig_user_id = $1`, [CONTA]);
  await q(`insert into accounts (ig_user_id, username, access_token) values ($1, 'conta_da_ana', 'ig-token-de-teste')`, [CONTA]);
  await q(`update config set app_url = $1 where id = 1`, [APP_URL]);
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

const gerar = (conta: string) =>
  comoNumaRequisicaoComSessao("/setup", () => acoes.gerarConviteDoLinkedin(null, form({ conta })));

describe("gerar o convite do LinkedIn de uma conta", () => {
  it("grava o convite do LinkedIn da conta, para o @ dela, e devolve o link no endereço canônico, uma vez", async () => {
    const { valor, tags } = await gerar(CONTA);
    expect(valor && "link" in valor).toBe(true);
    const { link, paraQuem } = valor as { link: string; paraQuem: string };
    expect(paraQuem).toBe("@conta_da_ana");
    expect(link).toMatch(new RegExp(`^${APP_URL}/convite/[A-Za-z0-9_-]{43}$`));
    const codigo = link.slice(link.lastIndexOf("/") + 1);
    const [linha] = await q(`select * from convites_de_conexao`);
    expect(linha).toMatchObject({ rede: "linkedin", conta_alvo: CONTA, para_quem: "@conta_da_ana", usado_em: null });
    expect(linha.codigo_hash).toBe(createHash("sha256").update(codigo).digest("hex"));
    expect(tags.length).toBeGreaterThan(0);
  });

  it("no preview, o link é o do endereço da branch, o mesmo da volta", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "metodochat-git-linkedin-conexao-time.vercel.app");
    const { valor } = await gerar(CONTA);
    expect((valor as { link: string }).link).toMatch(
      /^https:\/\/metodochat-git-linkedin-conexao-time\.vercel\.app\/convite\/[A-Za-z0-9_-]{43}$/
    );
  });

  it("a conta que não está no painel não gera convite", async () => {
    for (const conta of ["17800000000029999", ""]) {
      const { valor } = await gerar(conta);
      expect(valor).toEqual({ erro: "Esta conta não está conectada neste painel." });
    }
    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(0);
  });

  it("sem as chaves do app nas variáveis, não gera, e diz o motivo", async () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "");
    const { valor } = await gerar(CONTA);
    expect(valor).toEqual({
      erro: "O LinkedIn está desligado: faltam as chaves do app do LinkedIn nas variáveis da Vercel.",
    });
    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(0);
  });

  it("o @ comprido é cortado nos 60 caracteres do \"para quem\"", async () => {
    await q(`update accounts set username = $2 where ig_user_id = $1`, [CONTA, "x".repeat(70)]);
    const { valor } = await gerar(CONTA);
    expect((valor as { paraQuem: string }).paraQuem).toBe(`@${"x".repeat(59)}`);
  });
});

describe("desconectar o LinkedIn de uma conta", () => {
  it("apaga a conexão da conta, e a conta fica", async () => {
    await q(
      `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
       values ($1, 'p', 'Dra. Ana Souza', 't', now() + interval '60 days')`,
      [CONTA]
    );
    await comoNumaRequisicaoComSessao("/setup", () => acoes.desconectarLinkedin(form({ conta: CONTA })));
    expect(await q(`select 1 from linkedin_conexoes where account_id = $1`, [CONTA])).toHaveLength(0);
    expect(await q(`select 1 from accounts where ig_user_id = $1`, [CONTA])).toHaveLength(1);
  });
});
