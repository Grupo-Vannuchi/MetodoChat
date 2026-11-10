import { afterEach, describe, expect, it, vi } from "vitest";
import { enderecoDeEnvioConfiavel, LINKEDIN_VERSION, nomeLimpo } from "@/lib/linkedin";
import { chaveDaPublicacaoNoLinkedin, publicacaoKey } from "@/lib/dedupe";

// O QUE É PURO NAS CHAMADAS DE PUBLICAR NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §4 e §6; a
// parte 2a). As chamadas de rede (a reserva, o envio da imagem e o post) são provadas contra um LinkedIn falso no
// loopback, em testes-integracao/linkedin-publicacao.integracao.ts.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a versão da API do LinkedIn", () => {
  it("é a 202610", () => {
    expect(LINKEDIN_VERSION).toBe("202610");
  });

  // DE PROPÓSITO, ESTE CASO FICA VERMELHO a partir de 01/09/2027, e com ele todo `npm test`, até a versão ser
  // trocada: a 202610 tem suporte por pelo menos um ano (a página de versões do LinkedIn), e a troca é lembrada
  // seis semanas antes de 15/10/2027, e não por um post que falha em produção (spec, §4).
  it("ainda não chegou a hora de trocar a versão (01/09/2027)", () => {
    expect(Date.now()).toBeLessThan(Date.parse("2027-09-01T00:00:00Z"));
  });
});

describe("o endereço de envio da imagem que o LinkedIn devolve", () => {
  it("só um endereço https do LinkedIn recebe a autorização", () => {
    expect(enderecoDeEnvioConfiavel("https://www.linkedin.com/dms-uploads/C4E10AQ/uploaded-image/0?ca=x")).toBe(true);
    expect(enderecoDeEnvioConfiavel("https://api.linkedin.com/mediaUpload/x")).toBe(true);
    for (const outro of [
      "http://www.linkedin.com/dms-uploads/x",
      "https://linkedin.com.exemplo.com/x",
      "https://www.exemplo.com/x",
      "https://xlinkedin.com/x",
      "nao é endereço",
    ]) {
      expect(enderecoDeEnvioConfiavel(outro)).toBe(false);
    }
  });

  it("o loopback só vale nos testes, sob a trava do vitest", () => {
    expect(enderecoDeEnvioConfiavel("http://127.0.0.1:4567/envio")).toBe(true);
    vi.stubEnv("VITEST", "");
    expect(enderecoDeEnvioConfiavel("http://127.0.0.1:4567/envio")).toBe(false);
  });
});

describe("o nome que o LinkedIn devolve", () => {
  it("tem os espaços juntados e as pontas aparadas (a prova de 09/11 trouxe dois espaços no meio)", () => {
    expect(nomeLimpo("  Thiago  Vannuchi ")).toBe("Thiago Vannuchi");
    expect(nomeLimpo("Ana\tSouza")).toBe("Ana Souza");
  });
});

describe("a chave da linha do LinkedIn na fila", () => {
  it("tem prefixo próprio e nunca é igual à do Instagram", () => {
    const chave = chaveDaPublicacaoNoLinkedin("17800000000000001", "imagem", ["17800000000000001/a.jpg"], "x");
    expect(chave).toBe("pub-linkedin:17800000000000001:imagem:17800000000000001/a.jpg");
    expect(chave).not.toBe(publicacaoKey("17800000000000001", "imagem", ["17800000000000001/a.jpg"]));
  });

  it("na forma só texto, que não tem arquivo, é a do envio da tela: o mesmo envio não entra duas vezes", () => {
    const envio = "9f1c2e3d-0000-4000-8000-000000000001";
    expect(chaveDaPublicacaoNoLinkedin("17800000000000001", "texto", [], envio)).toBe(
      `pub-linkedin:17800000000000001:texto:${envio}`
    );
  });
});
