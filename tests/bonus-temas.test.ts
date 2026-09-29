import { describe, expect, it } from "vitest";
import { temasDoCatalogo, temasSugeridos } from "@/lib/bonus/temas";

describe("temasDoCatalogo", () => {
  it("os temas distintos dos bônus ativos, em ordem", () => {
    const corpo = {
      total: 4,
      items: [{ tema: "Vendas" }, { tema: "Marketing" }, { tema: "Vendas" }, { tema: null }],
    };
    expect(temasDoCatalogo(corpo)).toEqual(["Marketing", "Vendas"]);
  });

  it("corpo fora da forma vira lista vazia", () => {
    expect(temasDoCatalogo(null)).toEqual([]);
    expect(temasDoCatalogo({ items: "x" })).toEqual([]);
  });
});

describe("temasSugeridos", () => {
  it("sem base, nem pergunta ao Labs", async () => {
    let chamou = false;
    const f = (async () => {
      chamou = true;
      return new Response("{}");
    }) as typeof fetch;
    expect(await temasSugeridos(undefined, f)).toEqual([]);
    expect(chamou).toBe(false);
  });

  it("o Labs fora do ar não trava a tela: vira lista vazia", async () => {
    const f = (async () => new Response("indisponível", { status: 503 })) as typeof fetch;
    expect(await temasSugeridos("https://metodolabs.metodotia.com", f)).toEqual([]);
    const quebra = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await temasSugeridos("https://metodolabs.metodotia.com", quebra)).toEqual([]);
  });

  it("lê o GET da mesma porta", async () => {
    let url = "";
    const f = (async (u: string | URL | Request) => {
      url = String(u);
      return new Response(JSON.stringify({ items: [{ tema: "Marketing" }] }));
    }) as typeof fetch;
    expect(await temasSugeridos("https://metodolabs.metodotia.com", f)).toEqual(["Marketing"]);
    expect(url).toBe("https://metodolabs.metodotia.com/api/bonus");
  });
});
