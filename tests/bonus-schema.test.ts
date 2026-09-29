import { describe, expect, it } from "vitest";
import { BonusGeradoSchema } from "@/lib/bonus/schema";

const GERADO_VALIDO = {
  titulo: "Kit de lançamento em 7 dias",
  slug: "kit-de-lancamento",
  palavraChave: "LANCAMENTO",
  descricao:
    "Um cronograma de sete dias para lançar um produto sem travar na véspera, com o que fazer e o que conferir em cada dia.",
  intro:
    "Use quando tiver data de lançamento marcada. Preencha o produto e o público, cole no ChatGPT e receba o cronograma dia a dia.",
  prompt: "Aja como um estrategista de lançamento. ".repeat(12),
};

describe("BonusGeradoSchema (o do Labs, como está)", () => {
  it("aceita um bônus dentro da régua", () => {
    expect(BonusGeradoSchema.safeParse(GERADO_VALIDO).success).toBe(true);
  });

  it.each([
    ["palavra em minúscula", { palavraChave: "lancamento" }],
    ["slug com acento", { slug: "kit-de-lançamento" }],
    ["prompt curto (menos de 400)", { prompt: "curto" }],
    ["prompt do tamanho de uma skill paga (mais de 2000)", { prompt: "x".repeat(2001) }],
    ["título curto", { titulo: "Kit" }],
  ])("recusa %s", (_nome, troca) => {
    expect(BonusGeradoSchema.safeParse({ ...GERADO_VALIDO, ...troca }).success).toBe(false);
  });
});
