import { describe, expect, it } from "vitest";
import { AVISOS_DA_PAGINA, avisoDaPagina } from "@/lib/logins-textos";

// O AVISO DA PÁGINA LOGINS VEM DA URL (docs/specs/2026-11-04-logins.md, seção 4), e a lista é fechada: o
// texto que veio na URL nunca aparece na tela.
describe("o aviso da página Logins", () => {
  it("cada chave da lista vira a frase dela", () => {
    for (const [chave, frase] of Object.entries(AVISOS_DA_PAGINA)) {
      expect(avisoDaPagina(chave)).toBe(frase);
    }
  });

  it("o que não está na lista não vira nada, nem as chaves herdadas de objeto", () => {
    for (const fora of [undefined, "", "outro", "<b>vazado</b>", "toString", "__proto__", ["desativado"]]) {
      expect(avisoDaPagina(fora as string | string[] | undefined), String(fora)).toBeNull();
    }
  });

  it("as duas travas têm frase própria", () => {
    expect(AVISOS_DA_PAGINA.proprio).toMatch(/próprio login/);
    expect(AVISOS_DA_PAGINA.ultimo_administrador).toMatch(/último administrador/);
  });
});
