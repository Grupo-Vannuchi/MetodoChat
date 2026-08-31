import { describe, it, expect } from "vitest";
import {
  LIMITE_DA_CATEGORIA,
  normalizarCategoria,
  resumoDasCategorias,
  type FichaDeCategoria,
} from "@/lib/categorias";

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

// ============================================================
// AS FICHAS, E O NÚMERO QUE ELAS EXISTEM PARA CONTAR.
//
// Medido em 31/08/2026 no banco de produção: 126 contatos, 9 alcançáveis —
// 7,1%. Duas das quatro contas com ZERO. É esse número que a ficha mostra, e
// mostrá-lo ANTES de existir botão de enviar é a razão de esta funcionalidade
// vir primeiro.
// ============================================================
describe("resumoDasCategorias", () => {
  const AGORA = new Date("2026-08-31T12:00:00Z").getTime();
  const HORAS = (h: number) => new Date(AGORA - h * 3_600_000);

  it("conta por categoria, e conta quantos estão alcançáveis", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: "aluno", last_reply_at: HORAS(1) },
        { categoria: "aluno", last_reply_at: HORAS(30) },
        { categoria: "aluno", last_reply_at: null },
        { categoria: "interessado", last_reply_at: HORAS(2) },
      ],
      AGORA
    );
    expect(fichas).toEqual([
      { nome: "aluno", total: 3, alcancaveis: 1 },
      { nome: "interessado", total: 1, alcancaveis: 1 },
    ]);
  });

  // O balde do `null` é uma ficha como as outras — sem ele as contagens não
  // somam o total, e a tela passa a esconder gente.
  it("quem não tem categoria vira a ficha `sem categoria`, sempre por último", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: null, last_reply_at: HORAS(1) },
        { categoria: null, last_reply_at: HORAS(99) },
        { categoria: "aluno", last_reply_at: HORAS(99) },
      ],
      AGORA
    );
    expect(fichas.map((f) => f.nome)).toEqual(["aluno", null]);
    expect(fichas.at(-1)).toEqual({ nome: null, total: 2, alcancaveis: 1 });
  });

  it("a ordem é por tamanho, e empate desempata pelo nome", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: "zeta", last_reply_at: null },
        { categoria: "alfa", last_reply_at: null },
        { categoria: "meio", last_reply_at: null },
        { categoria: "meio", last_reply_at: null },
      ],
      AGORA
    );
    expect(fichas.map((f) => f.nome)).toEqual(["meio", "alfa", "zeta"]);
  });

  // ESTE É O CASO QUE PRENDE A HONESTIDADE, e ele existe por uma medição:
  // `windowState` fecha 5 minutos ANTES das 24h (WINDOW_MARGIN_MS), e o motor de
  // envio usa exatamente essa regra. Uma contagem por "menos de 24h" seria
  // QUASE sempre certa — e erraria ~7 vezes por dia, por 5 minutos cada,
  // prometendo alcance que o envio recusa. Erro que some sozinho é erro que
  // ninguém reproduz.
  it("quem está nos últimos 5 minutos da janela conta como FORA", () => {
    const fichas = resumoDasCategorias(
      [{ categoria: "aluno", last_reply_at: new Date(AGORA - (24 * 60 - 2) * 60_000) }],
      AGORA
    );
    expect(fichas[0]).toEqual({ nome: "aluno", total: 1, alcancaveis: 0 });
  });

  it("as contagens somam o total de contatos", () => {
    const contatos = [
      { categoria: "a", last_reply_at: HORAS(1) },
      { categoria: "b", last_reply_at: HORAS(1) },
      { categoria: null, last_reply_at: HORAS(1) },
    ];
    const fichas = resumoDasCategorias(contatos, AGORA);
    expect(fichas.reduce((s, f) => s + f.total, 0)).toBe(contatos.length);
  });

  it("lista vazia devolve lista vazia, e não estoura", () => {
    expect(resumoDasCategorias([], AGORA)).toEqual([]);
  });
});
