import { describe, expect, it } from "vitest";
import { lerRevisado, montarCorpo, type Revisado } from "@/lib/bonus/contrato";

const REVISADO: Revisado = {
  titulo: "Kit de lançamento em 7 dias",
  slug: "kit-de-lancamento",
  palavra: "LANCAMENTO",
  descricao: "Um passo a passo para lançar sem travar na véspera.",
  intro: "",
  prompt: "Aja como um estrategista de lançamento e monte o cronograma dos sete dias.",
  tema: "Marketing",
};

describe("lerRevisado", () => {
  it("aceita e normaliza: slug em minúscula, palavra sem acento", () => {
    expect(lerRevisado({ ...REVISADO, slug: "Kit-De-Lancamento", palavra: "lançamento" })).toEqual({
      ok: true,
      revisado: REVISADO,
    });
  });

  it.each(["ab", "kit--x", "-kit", "kit-", "kit_x", "kit de", "x".repeat(91)])(
    "recusa o slug %j",
    (slug) => {
      const r = lerRevisado({ ...REVISADO, slug });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problemas.map((p) => p.campo)).toContain("slug");
    }
  );

  it.each([
    ["titulo", "ab"],
    ["titulo", "x".repeat(221)],
    ["descricao", "curta"],
    ["descricao", "x".repeat(1201)],
    ["prompt", "curto demais"],
    ["prompt", "x".repeat(20_001)],
    ["intro", "x".repeat(4001)],
    ["tema", ""],
    ["tema", "x".repeat(81)],
    ["palavra", "ab"],
  ] as const)("recusa %s = %j", (campo, valor) => {
    const r = lerRevisado({ ...REVISADO, [campo]: valor });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.campo)).toContain(campo);
  });

  it("devolve TODOS os problemas de uma vez, e não o primeiro", () => {
    const r = lerRevisado({ ...REVISADO, titulo: "", slug: "", tema: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.campo).sort()).toEqual(["slug", "tema", "titulo"]);
  });

  it("recusa o bônus cujo corpo inteiro passa de 64 000 bytes, mesmo com cada campo no limite", () => {
    // "中" ocupa 3 bytes em UTF-8 e 1 posição em `.length`: 20 000 no prompt são
    // 60 000 bytes, e o resto do corpo passa do teto do Labs.
    const r = lerRevisado({ ...REVISADO, prompt: "中".repeat(20_000), intro: "中".repeat(4_000) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas[0].erro).toContain("64 000");
  });
});

describe("montarCorpo", () => {
  it("serializa com as chaves do contrato, nesta ordem, e intro vazia vira null", () => {
    expect(montarCorpo(REVISADO)).toBe(
      '{"slug":"kit-de-lancamento","title":"Kit de lançamento em 7 dias",' +
        '"description":"Um passo a passo para lançar sem travar na véspera.",' +
        '"prompt":"Aja como um estrategista de lançamento e monte o cronograma dos sete dias.",' +
        '"theme":"Marketing","keyword":"LANCAMENTO","intro":null,"skillId":null}'
    );
  });

  it("intro preenchida vai como texto", () => {
    expect(JSON.parse(montarCorpo({ ...REVISADO, intro: "Cole no ChatGPT." })).intro).toBe(
      "Cole no ChatGPT."
    );
  });
});
