import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AVISO_SEM_CREDITO, ehTabelaAusente, mensagemDeErro, mensagemDeFalhaInesperada } from "@/lib/bonus/erros";

// Erros da SDK construídos direto, sem rede, como no Labs (site-ia, erros.test.ts).
const cabecalhos = new Headers();
const corpo = (mensagem: string) => ({ type: "error", error: { type: "invalid_request_error", message: mensagem } });

describe("mensagemDeErro", () => {
  it("crédito esgotado vira instrução, e não JSON", () => {
    const c = corpo("Your credit balance is too low to access the Anthropic API.");
    const m = mensagemDeErro(new Anthropic.BadRequestError(400, c, JSON.stringify(c), cabecalhos));
    expect(m.startsWith(AVISO_SEM_CREDITO)).toBe(true);
    expect(m).not.toContain("{");
  });

  it("chave inválida aponta a variável", () => {
    const c = corpo("invalid x-api-key");
    expect(mensagemDeErro(new Anthropic.AuthenticationError(401, c, JSON.stringify(c), cabecalhos))).toContain("ANTHROPIC_API_KEY");
  });

  it("limite de chamadas diz para esperar", () => {
    const c = corpo("rate limited");
    expect(mensagemDeErro(new Anthropic.RateLimitError(429, c, JSON.stringify(c), cabecalhos))).toContain("Tente de novo");
  });

  it("timeout diz rede ou tempo", () => {
    expect(mensagemDeErro(new Anthropic.APIConnectionTimeoutError())).toContain("rede ou tempo esgotado");
  });
});

describe("mensagemDeFalhaInesperada", () => {
  it("diz que é erro do servidor, com o detalhe cortado", () => {
    const m = mensagemDeFalhaInesperada(new TypeError("x".repeat(1000)));
    expect(m.startsWith("A geração falhou por um erro inesperado no servidor")).toBe(true);
    expect(m.length).toBeLessThan(400);
  });
});

describe("ehTabelaAusente", () => {
  it("reconhece o 42P01 do Postgres, e só ele", () => {
    expect(ehTabelaAusente({ code: "42P01" })).toBe(true);
    expect(ehTabelaAusente({ code: "23505" })).toBe(false);
    expect(ehTabelaAusente(new Error("x"))).toBe(false);
  });
});
