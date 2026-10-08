import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACOES_DA_CHAMADA,
  ehAcaoDaChamada,
  pedidoDaAcao,
  pedidoDaChamada,
  rotuloDaAcao,
  type AcaoDaChamada,
} from "@/lib/bonus/acao-da-chamada";

// A AÇÃO DA CHAMADA DO CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): o que o slide final pede quando
// não há palavra. São quatro, o banco confere de novo, e a linha tem palavra OU ação, nunca as duas.

describe("as quatro ações", () => {
  it("são as do Eduardo, na ordem da tela", () => {
    expect([...ACOES_DA_CHAMADA]).toEqual(["salvar", "compartilhar", "seguir", "comentar"]);
  });

  it("são as mesmas do check da 017 no banco", () => {
    const sql = readFileSync("migrations/017-carrossel-sem-palavra.sql", "utf8").replace(/\r\n/g, "\n");
    const lista = /acao_da_chamada in \(([^)]*)\)/.exec(sql)?.[1] ?? "";
    expect(lista.split(",").map((v) => v.trim().replace(/'/g, ""))).toEqual([...ACOES_DA_CHAMADA]);
  });

  it.each(ACOES_DA_CHAMADA)("aceita %s", (acao) => {
    expect(ehAcaoDaChamada(acao)).toBe(true);
  });

  it.each([["curtir"], ["Salvar"], [" salvar"], [""], [null], [undefined], [1]])("recusa %j", (v) => {
    expect(ehAcaoDaChamada(v)).toBe(false);
  });
});

describe("o nome na tela e o pedido à IA", () => {
  const casos: [AcaoDaChamada, string, string][] = [
    ["salvar", "Salvar o post", "peça para salvar o post"],
    ["compartilhar", "Compartilhar", "peça para compartilhar o post com quem precisa ver"],
    ["seguir", "Seguir o perfil", "peça para seguir o perfil"],
    ["comentar", "Comentar a opinião", "peça para comentar a opinião, sem palavra-chave"],
  ];

  it.each(casos)("%s: %s, e %s", (acao, rotulo, pedido) => {
    expect(rotuloDaAcao(acao)).toBe(rotulo);
    expect(pedidoDaAcao(acao)).toBe(pedido);
  });

  it("nenhum pedido manda escrever uma palavra em maiúsculas", () => {
    for (const a of ACOES_DA_CHAMADA) expect(pedidoDaAcao(a)).not.toMatch(/\b[A-Z]{3,}\b/);
  });
});

describe("o que a chamada pede, lido da linha", () => {
  it("com palavra, a palavra", () => {
    expect(pedidoDaChamada({ palavra: "BRUTAL", acao_da_chamada: null })).toEqual({ palavra: "BRUTAL", acao: null });
  });

  it("sem palavra, a ação", () => {
    expect(pedidoDaChamada({ palavra: null, acao_da_chamada: "seguir" })).toEqual({ palavra: null, acao: "seguir" });
  });

  it.each([
    ["as duas juntas", { palavra: "BRUTAL", acao_da_chamada: "salvar" }],
    ["nenhuma das duas", { palavra: null, acao_da_chamada: null }],
    ["a ação fora das quatro", { palavra: null, acao_da_chamada: "curtir" }],
    ["a palavra vazia", { palavra: "", acao_da_chamada: null }],
  ])("a linha fora da regra do banco (%s) não pede nada", (_nome, linha) => {
    expect(pedidoDaChamada(linha)).toBeNull();
  });
});
