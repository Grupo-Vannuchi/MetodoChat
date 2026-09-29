import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinar } from "@/lib/bonus/assinatura";

const SEGREDO = "segredo-inventado-para-o-teste-que-nao-vale-nada";

function partes(cabecalho: string): { t: number; v1: string } {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(cabecalho);
  if (!m) throw new Error(`cabeçalho fora do formato do contrato: ${cabecalho}`);
  return { t: Number(m[1]), v1: m[2] };
}

describe("assinar", () => {
  it("o HMAC recalculado sobre a string exata confere com o v1", () => {
    const corpo = '{"slug":"kit","title":"Kit de lançamento"}';
    const { t, v1 } = partes(assinar(corpo, SEGREDO, 1_790_000_000_123));
    expect(createHmac("sha256", SEGREDO).update(`${t}.${corpo}`).digest("hex")).toBe(v1);
  });

  it("t vai em SEGUNDOS, e não em milissegundos", () => {
    expect(partes(assinar("{}", SEGREDO, 1_790_000_000_999)).t).toBe(1_790_000_000);
  });

  it("um byte a mais no corpo muda a assinatura", () => {
    const a = partes(assinar('{"a":1}', SEGREDO, 1_790_000_000_000)).v1;
    const b = partes(assinar('{"a":1} ', SEGREDO, 1_790_000_000_000)).v1;
    expect(a).not.toBe(b);
  });
});
