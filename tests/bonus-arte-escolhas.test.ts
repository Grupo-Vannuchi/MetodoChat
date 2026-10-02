import { describe, expect, it } from "vitest";
import { comEspaco, escolhasDaArte, lerEscolhasDoFormulario } from "@/lib/bonus/arte-escolhas";

// AS ESCOLHAS DA ARTE lidas da coluna `arte` (migrations/015-arte-do-carrossel.sql). O que vem do
// banco não é confiável por forma: uma linha antiga tem `{}`, e uma escrita errada não pode quebrar
// a página. O que não tiver a forma certa volta ao padrão, que é "com espaço" e sem conta gravada.
describe("as escolhas da arte de um carrossel", () => {
  it("a linha antiga, sem nada, é a conta selecionada no Chat e todo slide com espaço", () => {
    expect(escolhasDaArte({}, 5)).toEqual({ conta: null, soTexto: [] });
  });

  it("lê a conta gravada e os slides só de texto, em ordem e sem repetir", () => {
    expect(escolhasDaArte({ conta: "17841400000000001", soTexto: [4, 2, 2] }, 5)).toEqual({
      conta: "17841400000000001",
      soTexto: [2, 4],
    });
  });

  it.each([null, "texto", [], 7])("forma errada inteira volta ao padrão: %j", (v) => {
    expect(escolhasDaArte(v, 5)).toEqual({ conta: null, soTexto: [] });
  });

  it("descarta o slide fora do total, o que não é inteiro e a conta vazia", () => {
    expect(escolhasDaArte({ conta: "", soTexto: [0, 1, 6, 2.5, "3", 5] }, 5)).toEqual({ conta: null, soTexto: [1, 5] });
  });

  it("com espaço é o padrão, e só texto é o que foi marcado", () => {
    const e = escolhasDaArte({ soTexto: [2] }, 3);
    expect([1, 2, 3].map((n) => comEspaco(e, n))).toEqual([true, false, true]);
  });
});

// O QUE O FORMULÁRIO DA ARTE MANDA não é confiável: o navegador manda o que quiser. A conta tem de
// ser uma das conectadas, e cada slide "só texto" tem de existir no carrossel.
describe("as escolhas mandadas pelo formulário da arte", () => {
  const CONECTADAS = ["1001", "1002"];

  it("a conta conectada e os slides marcados, em ordem e sem repetir", () => {
    expect(lerEscolhasDoFormulario({ conta: "1002", soTexto: ["4", "2", "2"] }, 5, CONECTADAS)).toEqual({
      ok: true,
      escolhas: { conta: "1002", soTexto: [2, 4] },
    });
  });

  it("nenhum slide marcado é todos com espaço", () => {
    expect(lerEscolhasDoFormulario({ conta: "1001", soTexto: [] }, 5, CONECTADAS)).toEqual({
      ok: true,
      escolhas: { conta: "1001", soTexto: [] },
    });
  });

  it.each([["9999"], [""], [null]])("conta que não está conectada é recusada: %j", (conta) => {
    expect(lerEscolhasDoFormulario({ conta, soTexto: [] }, 5, CONECTADAS)).toEqual({ ok: false, motivo: "conta" });
  });

  it.each([["0"], ["6"], ["2.5"], ["02"], ["x"], [7]])("slide fora do carrossel é recusado: %j", (slide) => {
    expect(lerEscolhasDoFormulario({ conta: "1001", soTexto: [slide] }, 5, CONECTADAS)).toEqual({
      ok: false,
      motivo: "slide",
    });
  });
});
