import { describe, it, expect } from "vitest";
import { fmtRelative, semPrefixo } from "../lib/format";

describe("semPrefixo", () => {
  it("tira o ha das tres formas que o tem", () => {
    expect(semPrefixo("há 5 min")).toBe("5 min");
    expect(semPrefixo("há 9 h")).toBe("9 h");
    expect(semPrefixo("há 335 dias")).toBe("335 dias");
  });
  // AS DUAS SAIDAS DE `fmtRelative` QUE NAO TEM PREFIXO passam inteiras. Um
  // `replace(/ha /, "")` solto comeria letra de palavra que comecasse assim.
  it("agora e ontem passam inteiros", () => {
    expect(semPrefixo("agora")).toBe("agora");
    expect(semPrefixo("ontem")).toBe("ontem");
  });
  it("o travessao de data ausente passa inteiro", () => {
    expect(semPrefixo("—")).toBe("—");
  });
  // O RECORTE E DO COMECO, e nao de qualquer posicao.
  it("nao mexe num ha no meio do texto", () => {
    expect(semPrefixo("2 há 3")).toBe("2 há 3");
  });
});

// A AMARRACAO QUE IMPEDE AS DUAS DE DIVERGIREM: se `fmtRelative` mudar o
// formato, este caso cai — e nao a tela, semanas depois.
describe("semPrefixo sobre a saida real de fmtRelative", () => {
  it("nenhuma saida de fmtRelative sai comecando com ha", () => {
    const agora = Date.now();
    const horas = [0, 0.01, 0.5, 3, 23, 25, 48, 24 * 335];
    for (const h of horas) {
      const saida = semPrefixo(fmtRelative(new Date(agora - h * 3600_000)));
      expect(saida.startsWith("há ")).toBe(false);
      expect(saida.length).toBeGreaterThan(0);
    }
  });
});
