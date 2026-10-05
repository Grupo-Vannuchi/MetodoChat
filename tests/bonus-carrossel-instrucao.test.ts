import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { composicaoDoSlide } from "@/lib/bonus/arte-composicao";
import { alturaDisponivel } from "@/lib/bonus/arte-geometria";
import { larguraDoTexto, medidaDaComposicao } from "@/lib/bonus/arte-medida";
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

// O LIMITE DE LINHAS SAI DA ARTE, e não de gosto (Etapa 4 aqui, 48.6 no Labs, 02/10). Com 6
// linhas, um slide com manchete e o espaço da imagem invadia a margem de baixo mesmo no piso de
// 34px; e uma manchete que quebra vale duas linhas. Os números são recalculados com a conta exata
// do "não cabe" (arte-medida.ts), sobre a composição que o desenho desenha: se um espaço da peça
// mudar, o teste diz que a instrução ficou pedindo o que não cabe.
describe("o limite de linhas por slide, na instrução do carrossel", () => {
  it("diz 5 linhas, 4 com a linha de fechamento, e conta o item de lista", () => {
    expect(INSTRUCAO_CARROSSEL).toMatch(/NO MÁXIMO 5 LINHAS FÍSICAS/);
    expect(INSTRUCAO_CARROSSEL).toMatch(/inclui item de lista/i);
    expect(INSTRUCAO_CARROSSEL).toMatch(/no máximo 4, contando ela/i);
    expect(INSTRUCAO_CARROSSEL).not.toMatch(/6 LINHAS/);
  });

  it("limita o título a uma linha, e a lista a 4 itens (2 com fechamento)", () => {
    expect(INSTRUCAO_CARROSSEL).toMatch(/título do slide cabe numa linha: até 50 caracteres/i);
    expect(INSTRUCAO_CARROSSEL).toMatch(/no máximo 4 itens/i);
    expect(INSTRUCAO_CARROSSEL).toMatch(/no máximo 2 itens/i);
  });

  it("o 5 e o 4 são o que cabe na arte, no piso, com manchete de uma linha e o espaço da imagem", () => {
    const PISO = 34;
    const LINHA_CURTA = "Responda o cliente no mesmo dia";
    const altura = (corpo: number, fechamento: boolean) => {
      const blocos = [Array(corpo).fill(LINHA_CURTA).join("\n")];
      if (fechamento) blocos.push("E espere a resposta.");
      return medidaDaComposicao(composicaoDoSlide("Os três sinais", blocos.join("\n\n")), PISO).altura;
    };
    const util = alturaDisponivel(true);
    expect(util).toBe(334);
    expect(altura(5, false), "5 linhas deixaram de caber").toBeLessThanOrEqual(util);
    expect(altura(6, false), "6 linhas passaram a caber: a instrução está pedindo de menos").toBeGreaterThan(util);
    // "No máximo 4, contando ela": 3 de corpo e a de fechamento.
    expect(altura(3, true), "4 linhas com fechamento deixaram de caber").toBeLessThanOrEqual(util);
    expect(altura(4, true), "5 com fechamento passaram a caber: a instrução está pedindo de menos").toBeGreaterThan(util);
  });

  it("um título de 50 caracteres cabe numa linha no piso, e o de 65 já não", () => {
    const largura = (titulo: string) => larguraDoTexto(titulo, 34, true, -0.4);
    expect(largura("Os erros que travam as suas vendas e como resolver")).toBeLessThanOrEqual(860);
    expect(largura("O que fazer quando o cliente some depois de pedir o preço do item")).toBeGreaterThan(860);
  });

  // DOIS DONOS: a cópia do Labs (site-ia, src/lib/ia/instrucao-carrossel.ts, 64ca3e7) dá este mesmo
  // sha256 do VALOR, com a regra de português dentro. Mudou o texto, muda o número: combine com o
  // Labs antes, porque é o prefixo cacheado dos dois geradores.
  it("é a mesma do Labs, pelo sha256 do valor", () => {
    expect(createHash("sha256").update(INSTRUCAO_CARROSSEL, "utf8").digest("hex")).toBe(
      "1046fe8e0af550b0a39d53cb8697dfef59d7316c1ef84ca76eb44be34600cb34"
    );
    expect(INSTRUCAO_CARROSSEL).toHaveLength(7361);
  });
});
