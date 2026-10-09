import { describe, expect, it } from "vitest";
import { medidasDoJpeg } from "@/lib/bonus/imagem-jpeg";
import { problemaDaImagemGerada } from "@/lib/bonus/imagem-regras";
import { FOTO_DO_ESPACO_MAX_BYTES } from "@/lib/bonus/publicar-regras";

// A IMAGEM QUE VOLTA DA OPENAI, CONFERIDA PELO SERVIDOR (spec da Etapa 6, "Guardar como foto"). Ela não
// passa pelo navegador, que mede a foto subida: as medidas saem do cabeçalho do próprio JPEG, e a regra é
// a mesma da foto do espaço (`problemaDaFotoDoEspaco`).

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];

/** O começo de um JPEG de verdade: SOI, APP0 (JFIF), uma tabela, o SOF com as medidas e o SOS. */
function jpeg(largura: number, altura: number, sof = 0xc0, extra = 0): Uint8Array {
  const app0 = segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const dht = segmento(0xc4, [0x00, ...Array(16).fill(0)]);
  const sofN = segmento(sof, [8, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const sos = segmento(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]);
  return new Uint8Array([0xff, 0xd8, ...app0, ...dht, ...sofN, ...sos, ...Array(extra).fill(0x55), 0xff, 0xd9]);
}

describe("as medidas do JPEG, lidas do cabeçalho", () => {
  it("o 1536×1024 que a OpenAI devolve", () => {
    expect(medidasDoJpeg(jpeg(1536, 1024))).toEqual({ largura: 1536, altura: 1024 });
  });

  it("o progressivo (SOF2) também", () => {
    expect(medidasDoJpeg(jpeg(1536, 1024, 0xc2))).toEqual({ largura: 1536, altura: 1024 });
  });

  it("a tabela de Huffman (C4) não é confundida com as medidas", () => {
    expect(medidasDoJpeg(jpeg(860, 573))).toEqual({ largura: 860, altura: 573 });
  });

  it("o que não é JPEG, ou o JPEG cortado antes das medidas, não tem medida", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(medidasDoJpeg(png)).toBeNull();
    expect(medidasDoJpeg(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(medidasDoJpeg(jpeg(1536, 1024).slice(0, 30))).toBeNull();
    expect(medidasDoJpeg(new Uint8Array())).toBeNull();
  });
});

describe("a imagem gerada, pela regra da foto do espaço", () => {
  it("o JPEG de 1536×1024 e poucos bytes passa", () => {
    expect(problemaDaImagemGerada(jpeg(1536, 1024))).toBeNull();
  });

  it("o que não é JPEG é formato", () => {
    expect(problemaDaImagemGerada(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("formato");
  });

  it("outra proporção, pequena demais ou acima de 2 MB não passa", () => {
    expect(problemaDaImagemGerada(jpeg(1024, 1024))).toBe("proporcao");
    expect(problemaDaImagemGerada(jpeg(768, 512))).toBe("pequena");
    expect(problemaDaImagemGerada(jpeg(1536, 1024, 0xc0, FOTO_DO_ESPACO_MAX_BYTES))).toBe("pesada");
  });
});
