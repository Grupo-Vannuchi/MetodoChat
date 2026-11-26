import { describe, it, expect } from "vitest";
import { gradeDoMes, gradeDaSemana, listaDoCalendario } from "@/lib/calendario";

// A LISTA DO CALENDÁRIO NO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2, os achados 365 e
// 367): abaixo de 640 px, o calendário de Publicações vira uma lista com as casas da grade que têm posts, um dia
// embaixo do outro.
//
// Novembro de 2026 começa num domingo: a grade do mês vai de 1/11 a 12/12, e as casas de dezembro são do mês
// vizinho.
const NOVEMBRO = gradeDoMes("2026-11", "2026-11-26");

describe("a lista do calendário no celular", () => {
  it("o dia do mês vizinho entra, como na grade, com o mês dele no título (o achado 365)", () => {
    const lista = listaDoCalendario(NOVEMBRO.casas, new Map([["2026-12-01", ["post de dezembro"]]]));
    expect(lista.map((d) => [d.casa.chave, d.casa.doMes, d.titulo, d.itens])).toEqual([
      ["2026-12-01", false, "ter, 1 de dezembro", ["post de dezembro"]],
    ]);
  });

  it("o post que cai só na folga da janela não tem casa e não entra (o achado 365)", () => {
    const porDia = new Map([
      ["2026-10-31", ["antes da grade"]],
      ["2026-11-10", ["dentro da grade"]],
      ["2026-12-13", ["depois da grade"]],
    ]);
    expect(listaDoCalendario(NOVEMBRO.casas, porDia).map((d) => d.casa.chave)).toEqual(["2026-11-10"]);
    // Só com posts na folga, a lista sai vazia: é ela, e não a consulta, que decide o vazio do celular.
    porDia.delete("2026-11-10");
    expect(listaDoCalendario(NOVEMBRO.casas, porDia)).toEqual([]);
  });

  it("os dias saem na ordem da grade, e os posts de cada dia na ordem em que chegaram (o achado 367)", () => {
    const porDia = new Map([
      ["2026-11-20", ["c"]],
      ["2026-11-05", ["b", "a"]],
    ]);
    const lista = listaDoCalendario(NOVEMBRO.casas, porDia);
    expect(lista.map((d) => d.titulo)).toEqual(["qui, 5 de novembro", "sex, 20 de novembro"]);
    // A função não ordena: "b" chegou antes de "a" e continua antes.
    expect(lista[0].itens).toEqual(["b", "a"]);
  });

  it("a semana que atravessa a virada do mês dá os dois meses nos títulos", () => {
    const semana = gradeDaSemana("2026-11-30", "2026-11-26");
    const porDia = new Map([
      ["2026-11-30", ["x"]],
      ["2026-12-02", ["y"]],
    ]);
    expect(listaDoCalendario(semana.casas, porDia).map((d) => d.titulo)).toEqual([
      "seg, 30 de novembro",
      "qua, 2 de dezembro",
    ]);
  });

  it("uma grade sem posts dá uma lista vazia", () => {
    expect(listaDoCalendario(NOVEMBRO.casas, new Map())).toEqual([]);
  });

  it("um dia com a lista de posts vazia não entra", () => {
    const porDia = new Map<string, string[]>([
      ["2026-11-03", []],
      ["2026-11-04", ["d"]],
    ]);
    expect(listaDoCalendario(NOVEMBRO.casas, porDia).map((d) => d.casa.chave)).toEqual(["2026-11-04"]);
  });
});
