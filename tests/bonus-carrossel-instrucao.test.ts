import { describe, expect, it } from "vitest";
import { INSTRUCAO_CARROSSEL } from "@/lib/bonus/instrucao-carrossel";
import { INSTRUCAO_POST } from "@/lib/bonus/instrucao-post";
import { REGRA_DE_PORTUGUES } from "@/lib/bonus/regra-de-portugues";

// A instrução é TEXTO, e texto nenhum passa por tsc ou lint: trocar uma pela outra, ou perder
// a regra de português, passaria calado por todo o resto.
describe("as instruções do carrossel trazidas do Labs", () => {
  it("a do carrossel é a do carrossel", () => {
    expect(
      INSTRUCAO_CARROSSEL.startsWith(
        "Você escreve os carrosséis de Instagram de um estrategista de vendas e marketing."
      )
    ).toBe(true);
  });

  it("a do post é a do post de imagem única", () => {
    expect(
      INSTRUCAO_POST.startsWith(
        "Você escreve os posts de imagem única do Instagram de um estrategista de vendas e marketing."
      )
    ).toBe(true);
  });

  it("as duas levam a regra de português junto", () => {
    expect(INSTRUCAO_CARROSSEL).toContain(REGRA_DE_PORTUGUES);
    expect(INSTRUCAO_POST).toContain(REGRA_DE_PORTUGUES);
  });

  it("a do carrossel pede os campos do formato", () => {
    for (const campo of ["titulo", "gancho", "slides", "chamadaParaAcao", "legenda"]) {
      expect(INSTRUCAO_CARROSSEL, campo).toContain(`**${campo}**`);
    }
  });

  it("a do post pede os campos do formato", () => {
    for (const campo of ["titulo", "texto", "chamadaParaAcao", "legenda"]) {
      expect(INSTRUCAO_POST, campo).toContain(`**${campo}**`);
    }
  });
});
