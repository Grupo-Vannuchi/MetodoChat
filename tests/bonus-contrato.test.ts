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

  // O NAVEGADOR MANDA TODO TEXTAREA COM \r\n, e o texto da IA vem com \n. Medido na
  // prova real de 29/09: as 21 quebras do prompt chegaram ao Labs como \r\n.
  const comCr = (s: string) => s.replace(/\n/g, "\r\n");

  it("devolve a quebra de linha do formulário (\\r\\n) para \\n em todo campo", () => {
    const r = lerRevisado({
      ...REVISADO,
      descricao: comCr("Primeira linha da descrição.\nSegunda linha."),
      intro: comCr("Cole na IA.\nResponda às perguntas."),
      prompt: comCr("Aja como um estrategista.\nMonte o cronograma.\nUm dia por linha."),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const campo of ["descricao", "intro", "prompt"] as const) expect(r.revisado[campo]).not.toContain("\r");
      expect(r.revisado.prompt).toBe("Aja como um estrategista.\nMonte o cronograma.\nUm dia por linha.");
    }
  });

  it("conta o prompt depois de desfazer o \\r\\n: 20 000 caracteres na tela cabem", () => {
    // 200 linhas de 100 caracteres (99 + a quebra): 20 000 na tela, 20 200 com \r\n.
    const prompt = ("x".repeat(99) + "\n").repeat(200);
    expect(lerRevisado({ ...REVISADO, prompt: comCr(prompt) }).ok).toBe(true);
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
