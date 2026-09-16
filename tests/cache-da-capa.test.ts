import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { chaveDaLista, chaveDoPost, VIDA_DA_LISTA_S, VIDA_DO_POST_S } from "@/lib/media-lookup";

// O DESENHO DESTE CACHE SE APOIA NUM FATO DA FONTE DO NEXT, e não na doc dele.
//
// A doc diz que `dynamic = "force-dynamic"` equivale a
// `fetchCache = 'force-no-store'`. Se isso valesse para `unstable_cache`, o
// cache das capas não guardaria NADA em producao — as quatro telas sao
// `force-dynamic` — e ninguem perceberia: a tela continuaria certa, so lenta.
//
// MEDIDO na fonte do Next 16.2.10: `unstable_cache` so desiste quando
// `workStore.fetchCache === 'force-no-store'`, e NUNCA olha
// `workStore.forceDynamic`, que e o unico campo que `force-dynamic` seta
// (create-component-tree.js:151). Quem trata `forceDynamic` e o `fetch`,
// noutro arquivo (patch-fetch.js:353).
//
// ESTE CASO EXISTE PARA MORRER EM VERMELHO numa atualizacao do Next que junte
// os dois. Sem ele, a juncao viraria uma perda de desempenho silenciosa.
const FONTE = "node_modules/next/dist/server/web/spec-extension/unstable-cache.js";

describe("o fato do Next em que este cache se apoia", () => {
  const fonte = readFileSync(FONTE, "utf8");

  test("o ramo que LE do cache existe e pergunta por `fetchCache`", () => {
    expect(fonte).toContain("workStore.fetchCache !== 'force-no-store'");
  });

  test("o ramo que LE do cache NAO consulta `forceDynamic`", () => {
    // Recorte generoso ao redor da condicao, para pegar uma consulta
    // acrescentada perto dela.
    const i = fonte.indexOf("workStore.fetchCache !== 'force-no-store'");
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i - 600, i + 600);
    expect(trecho).not.toContain("forceDynamic");
  });
});

const TOKEN = "IGQVJXtoken-que-nao-pode-vazar-para-lugar-nenhum";

describe("a chave do cache", () => {
  test("a lista e por conta, e o token NAO entra", () => {
    const k = chaveDaLista("17900000000000901");
    expect(k).toContain("17900000000000901");
    expect(k.join("|")).not.toContain(TOKEN);
    expect(k.join("|")).not.toContain("token");
  });

  test("o post e por id, e o token NAO entra", () => {
    const k = chaveDoPost("17900000000000002");
    expect(k).toContain("17900000000000002");
    expect(k.join("|")).not.toContain(TOKEN);
  });

  test("duas contas nunca compartilham chave", () => {
    expect(chaveDaLista("111")).not.toEqual(chaveDaLista("222"));
  });

  test("as vidas ficam MUITO abaixo do prazo da miniatura (~2 semanas)", () => {
    // Medido em 15/09/2026: URL de 14/09 -> 200; de 31/08 e 24/08 -> 403.
    const DUAS_SEMANAS_S = 14 * 24 * 3600;
    expect(VIDA_DA_LISTA_S).toBeLessThan(DUAS_SEMANAS_S / 100);
    expect(VIDA_DO_POST_S).toBeLessThan(DUAS_SEMANAS_S / 10);
  });
});
