import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinar } from "@/lib/bonus/assinatura";
import { montarCorpo } from "@/lib/bonus/contrato";
import { postarNoLabs, urlDaPorta, urlPublicaDoBonus } from "@/lib/bonus/labs";

const SEGREDO = "segredo-inventado-para-o-teste-que-nao-vale-nada";
const URL_DA_PORTA = "https://labs.exemplo.invalid/api/bonus";

type Chamada = { url: string; init: RequestInit };

function fetchQueResponde(status: number, texto: string) {
  const chamadas: Chamada[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} });
    return new Response(texto, { status });
  }) as typeof fetch;
  return { f, chamadas };
}

describe("postarNoLabs", () => {
  it("o fetch recebe exatamente a string assinada, e o HMAC dela confere (proposto pelo auditor)", async () => {
    const corpo = montarCorpo({
      titulo: "Kit de lançamento em 7 dias",
      slug: "kit-de-lancamento",
      palavra: "LANCAMENTO",
      descricao: "Um passo a passo para lançar sem travar.",
      intro: "",
      prompt: "Aja como um estrategista de lançamento e monte o cronograma.",
      tema: "Marketing",
    });
    const cabecalho = assinar(corpo, SEGREDO, Date.parse("2026-09-29T12:00:00Z"));
    const { f, chamadas } = fetchQueResponde(201, '{"ok":true}');

    await postarNoLabs({ url: URL_DA_PORTA, corpo, cabecalho, timeoutMs: 1_000, fetchImpl: f });

    const enviado = chamadas[0].init.body as string;
    const cab = (chamadas[0].init.headers as Record<string, string>)["x-metodolabs-signature"];
    const [, t, v1] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(cab) ?? [];
    expect(enviado).toBe(corpo);
    expect(createHmac("sha256", SEGREDO).update(`${t}.${enviado}`).digest("hex")).toBe(v1);
    expect(chamadas[0].init.method).toBe("POST");
  });

  it("devolve status e texto como vieram", async () => {
    const { f } = fetchQueResponde(409, '{"ok":false,"erro":"titulo_repetido"}');
    expect(await postarNoLabs({ url: URL_DA_PORTA, corpo: "{}", cabecalho: "t=1,v1=x", timeoutMs: 1_000, fetchImpl: f })).toEqual({
      tipo: "http",
      status: 409,
      texto: '{"ok":false,"erro":"titulo_repetido"}',
    });
  });

  it("o Labs que não responde dentro do teto vira timeout", async () => {
    const f = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_ok, falha) => {
        init?.signal?.addEventListener("abort", () => falha(new DOMException("abortado", "AbortError")));
      })) as typeof fetch;
    expect(await postarNoLabs({ url: URL_DA_PORTA, corpo: "{}", cabecalho: "t=1,v1=x", timeoutMs: 20, fetchImpl: f })).toEqual({
      tipo: "falha",
      motivo: "timeout",
    });
  });

  it("queda de conexão vira rede", async () => {
    const f = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await postarNoLabs({ url: URL_DA_PORTA, corpo: "{}", cabecalho: "t=1,v1=x", timeoutMs: 1_000, fetchImpl: f })).toEqual({
      tipo: "falha",
      motivo: "rede",
    });
  });

  it("resposta acima de 16 KB não é lida", async () => {
    const { f } = fetchQueResponde(200, "x".repeat(20_000));
    expect(await postarNoLabs({ url: URL_DA_PORTA, corpo: "{}", cabecalho: "t=1,v1=x", timeoutMs: 1_000, fetchImpl: f })).toEqual({
      tipo: "falha",
      motivo: "grande",
    });
  });
});

describe("urlDaPorta e urlPublicaDoBonus", () => {
  it.each([
    ["https://metodolabs.metodotia.com", "https://metodolabs.metodotia.com/api/bonus"],
    ["https://metodolabs.metodotia.com/", "https://metodolabs.metodotia.com/api/bonus"],
    ["https://exemplo.invalid/base/", "https://exemplo.invalid/base/api/bonus"],
    ["http://localhost:3000", "http://localhost:3000/api/bonus"],
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000/api/bonus"],
  ])("aceita %s", (base, esperado) => {
    expect(urlDaPorta(base)).toBe(esperado);
  });

  it.each([
    ["http fora da máquina", "http://metodolabs.metodotia.com"],
    ["com usuário na URL", "https://eu:senha@metodolabs.metodotia.com"],
    ["com parâmetro", "https://metodolabs.metodotia.com/?x=1"],
    ["que não é URL", "metodolabs"],
    ["vazia", ""],
    ["ausente", undefined],
  ])("recusa a base %s", (_nome, base) => {
    expect(urlDaPorta(base)).toBeNull();
  });

  it("o link público segue a mesma base", () => {
    expect(urlPublicaDoBonus("https://metodolabs.metodotia.com/", "kit")).toBe(
      "https://metodolabs.metodotia.com/bonus/kit"
    );
    expect(urlPublicaDoBonus(undefined, "kit")).toBeNull();
  });
});
