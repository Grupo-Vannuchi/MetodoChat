import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { montarCorpo, type Revisado } from "@/lib/bonus/contrato";
import { prepararEnvio } from "@/lib/bonus/envio";

const SEGREDO = "segredo-inventado-para-o-teste-que-nao-vale-nada";
const T0 = Date.parse("2026-09-29T12:00:00Z");

const REVISADO: Revisado = {
  titulo: "Kit de lançamento em 7 dias",
  slug: "kit-de-lancamento",
  palavra: "LANCAMENTO",
  descricao: "Um passo a passo para lançar sem travar na véspera.",
  intro: "",
  prompt: "Aja como um estrategista de lançamento e monte o cronograma dos sete dias.",
  tema: "Marketing",
};
const CORPO_X = montarCorpo(REVISADO);

function t(cabecalho: string): number {
  return Number(/^t=(\d+),/.exec(cabecalho)?.[1]);
}

describe("prepararEnvio", () => {
  it("sem incerteza, o corpo nasce do que o operador revisou, e é novo", () => {
    const p = prepararEnvio({ slug: null, corpo_enviado: null, incerto_pendente: false }, REVISADO, SEGREDO, T0);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.corpo).toBe(CORPO_X);
    expect(p.slug).toBe("kit-de-lancamento");
    expect(p.corpoNovo).toBe(true);
  });

  it("sem incerteza, campo inválido volta como problema, e nada é preparado", () => {
    const p = prepararEnvio(
      { slug: null, corpo_enviado: null, incerto_pendente: false },
      { ...REVISADO, slug: "com espaço" },
      SEGREDO,
      T0
    );
    expect(p.ok).toBe(false);
  });

  it("com incerteza, vai o corpo GRAVADO, e o que veio do formulário é ignorado", () => {
    const linha = { slug: "kit-de-lancamento", corpo_enviado: CORPO_X, incerto_pendente: true };
    const p = prepararEnvio(linha, { ...REVISADO, slug: "outro-slug", titulo: "Outro título qualquer" }, SEGREDO, T0);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.corpo).toBe(CORPO_X);
    expect(p.slug).toBe("kit-de-lancamento");
    expect(p.corpoNovo).toBe(false);
  });

  it("reenvio 6 minutos depois: t novo, dentro da janela, e corpo idêntico (proposto pelo auditor)", () => {
    const linha = { slug: "kit-de-lancamento", corpo_enviado: CORPO_X, incerto_pendente: true };
    const antes = prepararEnvio(linha, REVISADO, SEGREDO, T0);
    const agora = T0 + 6 * 60_000;
    // O formulário da segunda chamada é OUTRO de propósito: com o mesmo REVISADO, o
    // corpo refeito sairia igual ao gravado e este caso passaria sem o congelamento
    // (medido na execução da FASE 1.4).
    const depois = prepararEnvio(linha, { ...REVISADO, titulo: "Outro título que o operador tentou pôr" }, SEGREDO, agora);
    expect(antes.ok && depois.ok).toBe(true);
    if (!antes.ok || !depois.ok) return;
    expect(depois.corpo).toBe(antes.corpo);
    expect(t(depois.cabecalho)).not.toBe(t(antes.cabecalho));
    expect(Math.abs(t(depois.cabecalho) - agora / 1000)).toBeLessThan(300);
  });

  it("o cabeçalho assina exatamente a string que sai no corpo", () => {
    const p = prepararEnvio({ slug: null, corpo_enviado: null, incerto_pendente: false }, REVISADO, SEGREDO, T0);
    if (!p.ok) throw new Error("devia preparar");
    const [, tt, v1] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(p.cabecalho) ?? [];
    expect(createHmac("sha256", SEGREDO).update(`${tt}.${p.corpo}`).digest("hex")).toBe(v1);
  });

  it("incerteza sem corpo gravado (morreu antes de gravar, logo antes de enviar) refaz o corpo", () => {
    const p = prepararEnvio({ slug: null, corpo_enviado: null, incerto_pendente: true }, REVISADO, SEGREDO, T0);
    expect(p.ok && p.corpoNovo).toBe(true);
  });
});
