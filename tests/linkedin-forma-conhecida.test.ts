import { describe, expect, it } from "vitest";
import { FORMAS_NO_LINKEDIN, soAFormaConhecidaDoLinkedin } from "@/lib/linkedin-publicacao";
import { AVISO_DO_REMARCAR_DA_FORMA_NOVA } from "@/lib/post-da-fila";

// A FORMA DO POST DO LINKEDIN QUE ESTE CÓDIGO CONHECE (a preparação da parte 3 do LinkedIn;
// docs/plans/2026-11-11-linkedin-forma-conhecida.md).
//
// O banco é um só para a produção e os previews. A parte 3 grava posts do LinkedIn de forma nova (o carrossel em PDF,
// o vídeo), e o dreno da produção, com o código de antes, pegaria a linha e a mandaria a `failed` por payload torto.
// O predicado deste arquivo é o que os quatro pontos do dreno e o remarcar usam para deixar essa linha intocada; o
// efeito dele contra o Postgres de verdade está em testes-integracao/dreno-forma-desconhecida.integracao.ts.

describe("as formas do post do LinkedIn que este código conhece", () => {
  it("são as que o ramo do dreno publica hoje: só texto e imagem", () => {
    expect([...FORMAS_NO_LINKEDIN]).toEqual(["texto", "imagem"]);
  });
});

describe("o predicado da forma conhecida", () => {
  it("deixa passar todo tipo que não é o post do LinkedIn, o post cuja forma não é texto, e a forma da lista", () => {
    expect(soAFormaConhecidaDoLinkedin("$5")).toBe(
      "(kind <> 'publicacao_linkedin' or jsonb_typeof(payload->'forma') is distinct from 'string' or payload->>'forma' = any($5::text[]))"
    );
  });

  it("aceita só um marcador de parâmetro ($ e número), para nenhum texto de fora entrar no SQL", () => {
    expect(soAFormaConhecidaDoLinkedin("$12")).toContain("any($12::text[])");
    expect(() => soAFormaConhecidaDoLinkedin("$5; drop table queue")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("5")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("$0")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("")).toThrow();
  });
});

describe("o aviso do remarcar de um post de forma nova", () => {
  it("é erro, diz que esta versão ainda não publica o formato, e que nada foi remarcado", () => {
    expect(AVISO_DO_REMARCAR_DA_FORMA_NOVA).toEqual({
      tom: "erro",
      texto: "Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.",
    });
  });
});
