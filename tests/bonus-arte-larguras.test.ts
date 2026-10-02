import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lerLarguras, textoDaTabela } from "@/lib/bonus/arte-larguras-do-ttf";

// A TABELA DE LARGURAS do "não cabe" (spec da Etapa 4, "A largura real de cada letra") não é cópia
// à mão: sai dos .ttf versionados por lib/bonus/fonte/gerar-larguras.ts. Este teste a recalcula dos
// mesmos arquivos e compara com o versionado, byte a byte. Uma fonte trocada sem tabela nova, ou uma
// tabela editada à mão, derruba o caso.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`);
const regular = lerLarguras(ler("lib/bonus/fonte/Carlito-Regular.ttf"));
const negrito = lerLarguras(ler("lib/bonus/fonte/Carlito-Bold.ttf"));

describe("a tabela de larguras", () => {
  it("é a que o gerador tira dos .ttf de hoje", () => {
    // O git pode entregar a cópia de trabalho em CRLF (core.autocrlf); o gerador escreve LF.
    const versionada = ler("lib/bonus/arte-larguras.ts").toString("utf8").replace(/\r\n/g, "\n");
    expect(versionada).toBe(textoDaTabela(regular, negrito));
  });

  // Números conferidos à parte, com o leitor descartável da auditoria (02/10): a Carlito é desenhada
  // em 2048 unidades por em, o espaço tem 463 nos dois pesos, e o negrito alarga as letras.
  it("lê os avanços da Carlito em unidades da fonte", () => {
    expect(regular.unidadesPorEm).toBe(2048);
    expect(regular.avancos.get(0x20)).toBe(463);
    expect(negrito.avancos.get(0x20)).toBe(463);
    expect(regular.avancos.get("M".codePointAt(0)!)).toBe(1751);
    expect(negrito.avancos.get("M".codePointAt(0)!)).toBeGreaterThan(regular.avancos.get("M".codePointAt(0)!)!);
  });

  it("não tem desenho para emoji nem para o que fica fora do plano básico", () => {
    expect(regular.avancos.has(0x2705)).toBe(false);
    expect([...regular.avancos.keys()].every((c) => c <= 0xffff)).toBe(true);
  });
});
