import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { composicaoDoSlide } from "@/lib/bonus/arte-composicao";
import { alturaDaLinha } from "@/lib/bonus/arte-geometria";
import { medidaDaComposicao } from "@/lib/bonus/arte-medida";
import { tamanhoDoSlide } from "@/lib/bonus/arte-slides";
import { conteudoDosVetores, lerVetores, type Vetor } from "./vetores-da-arte";

// A CONTA CONTRA OS VETORES DESENHADOS (spec da Etapa 4, "Dois donos"; a 48.5 do Labs). O arquivo
// tests/vetores-da-arte.json é o mesmo, byte a byte, nos dois repositórios, e as respostas dele saem do
// desenho no Satori (tests/bonus-arte-desenho.test.ts), e não desta conta. Duas contas escritas pela
// mesma regra erram nos mesmos pontos; o desenho não.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const { origem, vetores } = lerVetores();

/** O sha256 do arquivo em LF, o mesmo que o Labs confere do lado de lá. Muda quando o arquivo muda. */
const SHA256_DOS_VETORES = "a9e1d6a61196b45d172e9a64ab80fa1e8baee09e500356fc89ed0fcf91bd5040";

const conta = (v: Vetor) => {
  const slide = { numero: 2, total: 3, tipo: v.tipo, titulo: v.titulo, texto: v.texto, assinaturaNoPe: v.assinaturaNoPe };
  const t = tamanhoDoSlide(slide, v.comIlustracao);
  const noDegrauDoDesenho = medidaDaComposicao(composicaoDoSlide(v.titulo, v.texto), v.degrau);
  return { ...t, alturaNoDegrauDoDesenho: noDegrauDoDesenho.altura, vazaNoDegrauDoDesenho: noDegrauDoDesenho.vaza };
};

describe("o arquivo dos vetores", () => {
  it("é o combinado com o Labs, pelo sha256 do conteúdo em LF", () => {
    expect(sha256(conteudoDosVetores())).toBe(SHA256_DOS_VETORES);
  });

  it("foi desenhado com as fontes daqui", () => {
    for (const [nome, hash] of Object.entries(origem.fontes)) {
      expect(sha256(readFileSync(`${RAIZ}/lib/bonus/fonte/${nome}`)), nome).toBe(hash);
    }
  });

  // As categorias que o Labs pediu, e os 4 casos da comparação desenhada por ele.
  it("cobre as categorias combinadas", () => {
    const categorias = new Set(vetores.map((v) => v.categoria));
    for (const c of ["labs", "limite", "emoji", "pontuacao", "paragrafos", "860", "palavra-longa", "nfd", "negrito", "conservador"]) {
      expect(categorias, c).toContain(c);
    }
    expect(vetores.filter((v) => v.categoria === "labs")).toHaveLength(4);
    // A régua: o gancho nos quatro degraus e no piso, com o espaço da imagem.
    const degrausDoGancho = new Set(vetores.filter((v) => v.nome.startsWith("limite-gancho-com-")).map((v) => v.degrau));
    expect([...degrausDoGancho].sort((a, b) => b - a)).toEqual([86, 72, 56, 46, 34]);
  });
});

describe("os vetores exatos: a conta dá o que o desenho deu", () => {
  it.each(vetores.filter((v) => v.exato).map((v) => [v.nome, v] as const))("%s", (_, v) => {
    const c = conta(v);
    expect({ degrau: c.fonte, cabe: c.cabe, altura: c.alturaNoDegrauDoDesenho }).toEqual({
      degrau: v.degrau,
      cabe: v.cabe,
      altura: v.alturaDesenhada,
    });
  });
});

// Onde o Satori quebra também dentro da palavra (hífen, travessão e emoji colados, URL), a conta só
// quebra no espaço, e erra para o lado seguro: nunca um degrau maior, nunca "cabe" onde o desenho
// não cabe, e, no degrau do desenho, nunca menos altura (ou então ela recusa o degrau porque a
// palavra inteira vazaria, como a URL que o Satori parte na barra).
describe("os vetores conservadores: a conta erra só para o lado seguro", () => {
  it.each(vetores.filter((v) => !v.exato).map((v) => [v.nome, v] as const))("%s", (_, v) => {
    const c = conta(v);
    expect(c.fonte).toBeLessThanOrEqual(v.degrau);
    if (c.cabe) expect(v.cabe).toBe(true);
    if (!c.vazaNoDegrauDoDesenho) expect(c.alturaNoDegrauDoDesenho).toBeGreaterThanOrEqual(v.alturaDesenhada);
  });

  it("há um caso em que a conta erra por uma linha inteira", () => {
    const v = vetores.find((x) => x.categoria === "conservador")!;
    expect(v.exato).toBe(false);
    expect(conta(v).alturaNoDegrauDoDesenho - v.alturaDesenhada).toBeGreaterThanOrEqual(alturaDaLinha(v.degrau));
  });
});
