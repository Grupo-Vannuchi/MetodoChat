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

  // \s não cobre os invisíveis de largura zero (categoria Unicode Cf) que
  // texto colado do Instagram e de teclado de celular carrega nas pontas.
  // Sem tratar isso, a ficha "sem categoria" ganha uma terceira forma —
  // invisível — além do nulo e do vazio.
  it("caracteres invisíveis (zero-width) não sobrevivem à normalização", () => {
    expect(normalizarCategoria("​")).toBe(null);
    expect(normalizarCategoria("​aluno​")).toBe("aluno");
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
  //
  // Números fixos aqui, de propósito: se o teste gerasse a entrada e a saída
  // esperada a partir de LIMITE_DA_CATEGORIA, mudar a constante para
  // qualquer valor — inclusive um grande o bastante para a coluna virar um
  // parágrafo, o problema que ela existe para evitar — não deixaria nenhum
  // caso vermelho. O teste tem que prender o limite, não seguí-lo.
  it("corta em 40 caracteres, e o corte não deixa espaço na ponta", () => {
    expect(LIMITE_DA_CATEGORIA).toBe(40);
    const longo = "a".repeat(60);
    expect(normalizarCategoria(longo)).toBe("a".repeat(40));
    const comEspaco = "b".repeat(39) + "   fim";
    expect(normalizarCategoria(comEspaco)).toBe("b".repeat(39));
  });

  // slice corta em unidades UTF-16, não em caracteres: um emoji fora do
  // plano básico ocupa duas unidades, e cortar no meio deixa um surrogate
  // solto (vira "�" ao serializar). Não é espaço, então .trim() não limpa.
  it("não corta um emoji ao meio (par substituto)", () => {
    const resultado = normalizarCategoria("a".repeat(39) + "😀");
    // 39 "a" + 1 emoji = 40 pontos de código (cabe no limite), mas 41
    // unidades UTF-16 — se tivesse sobrado só metade do par substituto, o
    // length UTF-16 seria 40, não 41.
    expect(resultado).toBe("a".repeat(39) + "😀");
    expect(resultado).toHaveLength(41);
  });

  it("acento é preservado: é nome de gente, não identificador", () => {
    expect(normalizarCategoria("Não respondeu")).toBe("não respondeu");
  });
});
