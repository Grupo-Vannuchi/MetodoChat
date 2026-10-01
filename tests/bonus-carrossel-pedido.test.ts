import { describe, expect, it } from "vitest";
import {
  SLIDES_MAX,
  SLIDES_MIN,
  SLIDES_PADRAO,
  TETO_CARROSSEL_DIARIO,
  lerPedidoDeCarrossel,
  restamCarrosseisHoje,
  slidesDeConteudo,
} from "@/lib/bonus/carrossel-pedido";
import { CARROSSEL_ITENS_MAX } from "@/lib/publicacao";

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";

describe("o pedido de carrossel", () => {
  it("o teto de slides é o da Meta, o mesmo do /publicar", () => {
    expect(SLIDES_MAX).toBe(CARROSSEL_ITENS_MAX);
  });

  it("o padrão cabe na faixa", () => {
    expect(SLIDES_PADRAO).toBeGreaterThanOrEqual(SLIDES_MIN);
    expect(SLIDES_PADRAO).toBeLessThanOrEqual(SLIDES_MAX);
  });

  it.each(["1", "2", "7", "10", " 10 "])("aceita o total %j", (total) => {
    expect(lerPedidoDeCarrossel({ bonusId: BONUS, total })).toEqual({
      ok: true,
      pedido: { bonusId: BONUS, total: Number(total.trim()) },
    });
  });

  it.each(["0", "11", "", "abc", "5.5", "-3", "100", null])("recusa o total %j", (total) => {
    expect(lerPedidoDeCarrossel({ bonusId: BONUS, total })).toEqual({ ok: false, motivo: "total_invalido" });
  });

  it.each(["", "abc", "0f8e2a8c", null])("recusa o bônus %j antes de olhar o total", (bonusId) => {
    expect(lerPedidoDeCarrossel({ bonusId, total: "10" })).toEqual({ ok: false, motivo: "bonus_invalido" });
  });
});

describe("as contas do carrossel", () => {
  it("o teto é 10 por dia, decidido pelo Eduardo em 30/09", () => {
    expect(TETO_CARROSSEL_DIARIO).toBe(10);
  });

  it("restamCarrosseisHoje nunca fica negativo", () => {
    expect(restamCarrosseisHoje(0)).toBe(10);
    expect(restamCarrosseisHoje(12)).toBe(0);
  });

  it.each([
    [1, 0],
    [2, 0],
    [3, 1],
    [10, 8],
  ])("com %i no total, há %i de conteúdo", (total, conteudo) => {
    expect(slidesDeConteudo(total)).toBe(conteudo);
  });
});
