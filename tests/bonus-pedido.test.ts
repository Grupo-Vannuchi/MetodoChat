import { describe, expect, it } from "vitest";
import {
  TETO_DIARIO,
  ehIdDeBonus,
  lerPedido,
  normalizarPalavra,
  palavraFinal,
  palavraValida,
  restamHoje,
} from "@/lib/bonus/pedido";

const RESOLVE = "Montar um cronograma de lançamento em 7 dias";

describe("normalizarPalavra", () => {
  it("tira acento e cedilha e põe em maiúscula, como o Labs grava", () => {
    expect(normalizarPalavra("Ação")).toBe("ACAO");
    expect(normalizarPalavra("coração")).toBe("CORACAO");
    expect(normalizarPalavra("  iakids ")).toBe("IAKIDS");
  });

  it("o acento que chega decomposto (letra + marca) também sai", () => {
    expect(normalizarPalavra("a" + String.fromCodePoint(0x0301) + "cao")).toBe("ACAO");
  });
});

describe("palavraValida", () => {
  it("aceita uma palavra de 3 a 30 letras ou números", () => {
    expect(palavraValida("KIT")).toBe(true);
    expect(palavraValida("IAKIDS2026")).toBe(true);
    expect(palavraValida("X".repeat(30))).toBe(true);
  });

  it("recusa curta, longa, com espaço ou com hífen", () => {
    expect(palavraValida("AB")).toBe(false);
    expect(palavraValida("X".repeat(31))).toBe(false);
    expect(palavraValida("KIT LANCAMENTO")).toBe(false);
    expect(palavraValida("KIT-LANCAMENTO")).toBe(false);
  });
});

describe("lerPedido", () => {
  it("aceita um pedido completo, com a palavra já na forma que o Labs grava", () => {
    expect(lerPedido({ tema: " Marketing ", oQueResolve: RESOLVE, palavra: "lançamento" })).toEqual({
      ok: true,
      pedido: { tema: "Marketing", oQueResolve: RESOLVE, palavraDigitada: "LANCAMENTO" },
    });
  });

  it("palavra em branco vira null, e não string vazia", () => {
    const r = lerPedido({ tema: "Marketing", oQueResolve: RESOLVE, palavra: "   " });
    expect(r).toEqual({ ok: true, pedido: { tema: "Marketing", oQueResolve: RESOLVE, palavraDigitada: null } });
  });

  it.each([
    [{ tema: "", oQueResolve: RESOLVE, palavra: "" }, "tema_vazio"],
    [{ tema: "x".repeat(81), oQueResolve: RESOLVE, palavra: "" }, "tema_longo"],
    [{ tema: "Marketing", oQueResolve: "curto demais", palavra: "" }, "o_que_resolve_curto"],
    [{ tema: "Marketing", oQueResolve: "x".repeat(1001), palavra: "" }, "o_que_resolve_longo"],
    [{ tema: "Marketing", oQueResolve: RESOLVE, palavra: "ab" }, "palavra_invalida"],
    [{ tema: "Marketing", oQueResolve: RESOLVE, palavra: "kit lancamento" }, "palavra_invalida"],
  ])("recusa %j com %s", (bruto, motivo) => {
    expect(lerPedido(bruto)).toEqual({ ok: false, motivo });
  });

  it("campo que não é texto (o FormData devolve null ou File) conta como vazio", () => {
    expect(lerPedido({ tema: null, oQueResolve: RESOLVE, palavra: null })).toEqual({
      ok: false,
      motivo: "tema_vazio",
    });
  });
});

describe("palavraFinal", () => {
  it("a digitada vence a sugerida pela IA (a armadilha IAKIDS/EDUCAIA do Labs)", () => {
    expect(palavraFinal("IAKIDS", "EDUCAIA")).toBe("IAKIDS");
  });

  it("sem digitada, vale a sugerida, normalizada", () => {
    expect(palavraFinal(null, "educação")).toBe("EDUCACAO");
  });
});

describe("o teto diário", () => {
  it("é 5, decidido pelo Eduardo em 29/09", () => {
    expect(TETO_DIARIO).toBe(5);
  });

  it("restamHoje nunca fica negativo", () => {
    expect(restamHoje(0)).toBe(5);
    expect(restamHoje(5)).toBe(0);
    expect(restamHoje(7)).toBe(0);
  });
});

describe("ehIdDeBonus", () => {
  it("aceita uuid e recusa o resto, antes de a consulta chegar ao banco", () => {
    expect(ehIdDeBonus("0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f")).toBe(true);
    expect(ehIdDeBonus("1; drop table bonus_gerados")).toBe(false);
    expect(ehIdDeBonus(null)).toBe(false);
  });
});
