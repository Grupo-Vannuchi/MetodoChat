import { describe, expect, it } from "vitest";
import { INSTRUCAO_BONUS } from "@/lib/bonus/instrucao-bonus";
import { REGRA_DE_PORTUGUES } from "@/lib/bonus/regra-de-portugues";

// A instrução é TEXTO, e texto nenhum passa por tsc ou lint. Foi assim que o Labs
// gerou bônus com a instrução da skill paga por uma semana (spec de 24/08, 11.1).
describe("a instrução do bônus trazida do Labs", () => {
  it("é a do bônus GRATUITO, e não a da skill paga", () => {
    expect(
      INSTRUCAO_BONUS.startsWith("Você escreve prompts prontos para uso, entregues como material GRATUITO")
    ).toBe(true);
  });

  it("leva a regra de português junto", () => {
    expect(INSTRUCAO_BONUS).toContain(REGRA_DE_PORTUGUES);
  });

  it("pede os seis campos do schema", () => {
    for (const campo of ["titulo", "slug", "palavraChave", "descricao", "intro", "prompt"]) {
      expect(INSTRUCAO_BONUS).toContain(`**${campo}**`);
    }
  });
});
