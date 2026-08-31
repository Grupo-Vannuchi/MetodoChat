import { describe, it, expect } from "vitest";
import { LIMITE_DA_CATEGORIA, normalizarCategoria } from "@/lib/categorias";

// ============================================================
// A NORMALIZAÇÃO É O QUE SUBSTITUI A GOVERNANÇA.
//
// Este produto NÃO tem tela para criar e renomear categorias, por decisão de
// desenho: a lista é o conjunto de valores em uso. Isso só se sustenta se
// `Aluno`, `aluno ` e `ALUNO` forem a MESMA categoria — sem isso a lista
// apodrece em três semanas e ninguém confia mais no filtro.
// ============================================================
describe("normalizarCategoria", () => {
  it("maiúscula e espaço nas pontas não criam categoria nova", () => {
    expect(normalizarCategoria("Aluno")).toBe("aluno");
    expect(normalizarCategoria("  aluno  ")).toBe("aluno");
    expect(normalizarCategoria("ALUNO")).toBe("aluno");
  });

  it("espaço repetido no meio vira um só", () => {
    expect(normalizarCategoria("turma   de    setembro")).toBe("turma de setembro");
    expect(normalizarCategoria("ex\tAluno")).toBe("ex aluno");
  });

  // Devolver "" faria a coluna guardar texto vazio, e a ficha "sem categoria"
  // passaria a ter DUAS formas — o balde do null e o balde do vazio.
  it("vazio e só-espaço viram null, e não texto vazio", () => {
    expect(normalizarCategoria("")).toBe(null);
    expect(normalizarCategoria("   ")).toBe(null);
    expect(normalizarCategoria("\n\t ")).toBe(null);
  });

  it("o que não é texto vira null em vez de estourar", () => {
    expect(normalizarCategoria(null)).toBe(null);
    expect(normalizarCategoria(undefined)).toBe(null);
    expect(normalizarCategoria(42)).toBe(null);
    expect(normalizarCategoria({})).toBe(null);
    expect(normalizarCategoria([])).toBe(null);
  });

  // O limite existe para a coluna da tabela não virar um parágrafo. Cortar é
  // melhor que recusar: quem colou um texto longo por engano vê o que ficou.
  it("corta no limite, e o corte não deixa espaço na ponta", () => {
    const longo = "a".repeat(LIMITE_DA_CATEGORIA + 20);
    expect(normalizarCategoria(longo)).toHaveLength(LIMITE_DA_CATEGORIA);
    const comEspaco = "b".repeat(LIMITE_DA_CATEGORIA - 1) + "   fim";
    expect(normalizarCategoria(comEspaco)).toBe("b".repeat(LIMITE_DA_CATEGORIA - 1));
  });

  it("acento é preservado: é nome de gente, não identificador", () => {
    expect(normalizarCategoria("Não respondeu")).toBe("não respondeu");
  });
});
