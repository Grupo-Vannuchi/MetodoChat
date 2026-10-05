import { describe, expect, it } from "vitest";
import { comEspaco, escolhasDaArte, lerSoTextoDoFormulario } from "@/lib/bonus/arte-escolhas";

// AS ESCOLHAS DA ARTE lidas da coluna `arte` (migrations/015-arte-do-carrossel.sql). O que vem do
// banco não é confiável por forma: uma linha antiga tem `{}`, e uma escrita errada não pode quebrar
// a página. O que não tiver a forma certa volta ao padrão, que é "com espaço" e sem conta gravada.
// Desde a Etapa 4, a coluna guarda também o nome e o @ da conta, gravados quando o carrossel nasce.
describe("as escolhas da arte de um carrossel", () => {
  const VAZIA = { conta: null, nome: null, arroba: null, soTexto: [] };

  it("a linha antiga, sem nada, não tem conta e tem todo slide com espaço", () => {
    expect(escolhasDaArte({}, 5)).toEqual(VAZIA);
  });

  it("lê a conta, o nome e o @ guardados, e os slides só de texto, em ordem e sem repetir", () => {
    expect(
      escolhasDaArte({ conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [4, 2, 2] }, 5)
    ).toEqual({ conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [2, 4] });
  });

  it("a conta da Etapa 3, gravada sem o nome, volta sem o nome", () => {
    expect(escolhasDaArte({ conta: "17841400000000001", soTexto: [] }, 5)).toEqual({ ...VAZIA, conta: "17841400000000001" });
  });

  it.each([null, "texto", [], 7])("forma errada inteira volta ao padrão: %j", (v) => {
    expect(escolhasDaArte(v, 5)).toEqual(VAZIA);
  });

  it("descarta o slide fora do total, o que não é inteiro, e a conta, o nome e o @ vazios ou de outro tipo", () => {
    expect(escolhasDaArte({ conta: "", nome: 7, arroba: "", soTexto: [0, 1, 6, 2.5, "3", 5] }, 5)).toEqual({
      ...VAZIA,
      soTexto: [1, 5],
    });
  });

  it("com espaço é o padrão, e só texto é o que foi marcado", () => {
    const e = escolhasDaArte({ soTexto: [2] }, 3);
    expect([1, 2, 3].map((n) => comEspaco(e, n))).toEqual([true, false, true]);
  });
});

// O "SÓ TEXTO" MANDADO PELO FORMULÁRIO não é confiável: o navegador manda o que quiser. Cada slide
// tem de existir no carrossel. A conta não vem mais do formulário (spec da Etapa 4): o carrossel é
// da conta em que nasceu.
describe("o só texto mandado pelo formulário da arte", () => {
  it("os slides marcados, em ordem e sem repetir", () => {
    expect(lerSoTextoDoFormulario(["4", "2", "2"], 5)).toEqual({ ok: true, soTexto: [2, 4] });
  });

  it("nenhum slide marcado é todos com espaço", () => {
    expect(lerSoTextoDoFormulario([], 5)).toEqual({ ok: true, soTexto: [] });
  });

  it.each([["0"], ["6"], ["2.5"], ["02"], ["x"], [7]])("slide fora do carrossel é recusado: %j", (slide) => {
    expect(lerSoTextoDoFormulario([slide], 5)).toEqual({ ok: false, motivo: "slide" });
  });
});
