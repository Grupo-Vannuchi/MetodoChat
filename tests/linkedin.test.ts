import { afterEach, describe, expect, it, vi } from "vitest";
import {
  baseDoPainelParaOLinkedin,
  basesDoLinkedin,
  credenciaisDoLinkedin,
  ESCOPO_DO_LINKEDIN,
  temPermissaoDePublicar,
  urlDeAutorizacaoDoLinkedin,
} from "@/lib/linkedin";

// O CLIENTE DO LINKEDIN, NO QUE É PURO (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §4; a parte 1, a
// conexão). As chamadas de rede (a troca do código e o userinfo) são provadas contra um LinkedIn falso no
// loopback, em testes-integracao/linkedin-convite.integracao.ts.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a autorização no LinkedIn", () => {
  it("vai a www.linkedin.com com o código pedido, o client_id, a volta, o state e o escopo fixo", () => {
    const url = new URL(urlDeAutorizacaoDoLinkedin("id-do-app", "https://painel.exemplo.com.br/api/oauth/linkedin/callback", "e".repeat(64)));
    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.pathname).toBe("/oauth/v2/authorization");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "id-do-app",
      redirect_uri: "https://painel.exemplo.com.br/api/oauth/linkedin/callback",
      state: "e".repeat(64),
      scope: "openid profile w_member_social",
    });
  });

  it("o escopo é um só para todo convite: um escopo diferente invalidaria a autorização de antes", () => {
    expect(ESCOPO_DO_LINKEDIN).toBe("openid profile w_member_social");
  });
});

describe("a permissão de publicar, no scope que o LinkedIn devolve", () => {
  it("aceita a vírgula (medida na troca de 09/11) e o espaço (o da documentação)", () => {
    expect(temPermissaoDePublicar("openid,profile,w_member_social")).toBe(true);
    expect(temPermissaoDePublicar("openid profile w_member_social")).toBe(true);
    expect(temPermissaoDePublicar("w_member_social")).toBe(true);
  });

  it("recusa o scope sem ela, com um nome parecido, vazio ou que não é texto", () => {
    expect(temPermissaoDePublicar("openid,profile")).toBe(false);
    expect(temPermissaoDePublicar("openid,profile,w_member_socialx")).toBe(false);
    expect(temPermissaoDePublicar("")).toBe(false);
    expect(temPermissaoDePublicar(undefined)).toBe(false);
    expect(temPermissaoDePublicar(["w_member_social"])).toBe(false);
  });
});

describe("o endereço do painel para o LinkedIn (o link do convite e a volta)", () => {
  const CANONICA = "https://metodochat.vercel.app";

  it("na produção e no computador é o canônico", () => {
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "production", urlDaBranch: "x-git-y.vercel.app" }, CANONICA)).toBe(CANONICA);
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "development", urlDaBranch: "x-git-y.vercel.app" }, CANONICA)).toBe(CANONICA);
    expect(baseDoPainelParaOLinkedin({}, CANONICA)).toBe(CANONICA);
  });

  it("no preview é o endereço da branch, que não muda a cada deploy e é o cadastrado no app para a prova", () => {
    expect(
      baseDoPainelParaOLinkedin({ vercelEnv: "preview", urlDaBranch: "metodochat-git-linkedin-conexao-time.vercel.app" }, CANONICA)
    ).toBe("https://metodochat-git-linkedin-conexao-time.vercel.app");
  });

  it("no preview sem o endereço da branch, cai no canônico", () => {
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "preview" }, CANONICA)).toBe(CANONICA);
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "preview", urlDaBranch: "" }, CANONICA)).toBe(CANONICA);
  });
});

describe("as chaves do app do LinkedIn", () => {
  it("vêm das duas variáveis, sem espaço em volta", () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", " id-do-app ");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "segredo-de-teste");
    expect(credenciaisDoLinkedin()).toEqual({ clientId: "id-do-app", clientSecret: "segredo-de-teste" });
  });

  it("sem uma das duas, não há chave nenhuma", () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "id-do-app");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "  ");
    expect(credenciaisDoLinkedin()).toBeNull();
    vi.stubEnv("LINKEDIN_CLIENT_ID", "");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "segredo-de-teste");
    expect(credenciaisDoLinkedin()).toBeNull();
  });
});

describe("as bases das chamadas ao LinkedIn só se movem sob as duas travas", () => {
  it("sem a variável, são as de verdade", () => {
    vi.stubEnv("LINKEDIN_API_BASE", "");
    expect(basesDoLinkedin()).toEqual({ oauth: "https://www.linkedin.com", api: "https://api.linkedin.com" });
  });

  it("com o vitest e o loopback, as duas vão juntas para o servidor falso", () => {
    vi.stubEnv("LINKEDIN_API_BASE", "http://127.0.0.1:4567");
    expect(basesDoLinkedin()).toEqual({ oauth: "http://127.0.0.1:4567", api: "http://127.0.0.1:4567" });
  });

  it("fora do loopback, ou fora do vitest, a variável é ignorada", () => {
    vi.stubEnv("LINKEDIN_API_BASE", "https://outro.exemplo.com");
    expect(basesDoLinkedin().api).toBe("https://api.linkedin.com");
    vi.stubEnv("LINKEDIN_API_BASE", "http://127.0.0.1:4567");
    vi.stubEnv("VITEST", "");
    expect(basesDoLinkedin()).toEqual({ oauth: "https://www.linkedin.com", api: "https://api.linkedin.com" });
  });
});
