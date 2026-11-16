import { describe, expect, it } from "vitest";
import { cabecalhoDoJpeg, medidasDoJpeg } from "@/lib/bonus/imagem-jpeg";
import { pdfDeFotos } from "@/lib/pdf-de-fotos";
import {
  problemaDoCarrosselNoLinkedin,
  textoDoProblemaDoCarrosselNoLinkedin,
  TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES,
  tituloDoDocumento,
  vaiCruParaOLinkedin,
} from "@/lib/linkedin-publicacao";
import { textoDoBotaoDePublicar } from "@/lib/redes-do-post";

// AS REGRAS PURAS DO CARROSSEL EM PDF NO LINKEDIN (a parte 3a; o desenho, scratchpad/desenho-li3.md, §6): o
// cabeçalho do JPEG, o PDF de fotos, o título do documento, o teto do carrossel, o JPEG que pode ir cru com o LinkedIn
// marcado, e o botão que diz onde o post sai (o achado 215).

// DOIS JPEGS DE VERDADE, feitos pelo ffmpeg (testsrc, 16×20 e testsrc2, 20×16, yuvj420p): baseline, 3 componentes.
const FOTO_A = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACAoKCwoLDQ0NDQ0NEA8QEBAQEBAQEBAQEBISEhUVFRISEhAQEhIUFBUVFxcXFRUVFRcXGRkZHh4cHCMjJCsrM//EAHUAAQEBAQAAAAAAAAAAAAAAAAUGAgMBAQEBAAAAAAAAAAAAAAAAAAECAxAAAgECBAQFBQEAAAAAAAAAAgEDBBESBgAhMQUyQjPDgkEHIyKRYVFSEQABAgUFAQEBAAAAAAAAAAABAgMSEQQTIiEUAAUjMYEy/8AAEQgAFAAQAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AFdHzLKPLo/qqKstiNCo5BixMWg+4SEiQyNG1cb9Ldruoq66lybXRnBTt0ou0kQkRHhJAsQFKTbIXIRIWSRdLa2a1ngSrQZ0oupErYShTlEvC4MLp8Hw/mp7PZDUnIEBKYla4xtGS8Lihu/Z/jR2AtDqNlpe3e9sa3IbEG4gnOGNyCP8AmJUuLKjUuUiHZKcUK0OokApW3FeKe4gAElFimgKhObbZ+gc7ZSnq+bU0VPNVSgI3wuMIEQ2cn+oSXalunpPLFPS8/qnU1dPGikRIwjKYQfXvvKRJrB7Fbd/rRHx72erztO/HvZ6vO1PXeCXw15BRdiCMQrVX2GU/3mvYC3XJqEYPFFD7J0dybYizGWUzPXWZ5//Z", "base64"));
const FOTO_B = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACBAQExATFhYWFhYWGhgaGxsbGhoaGhsbGx0dHSIiIh0dHRsbHR0gICIiJSYlIyMiIyYmKCgoMDAuLjg4OkVFU//EAHQAAQEBAQEAAAAAAAAAAAAAAAUEAQcGAQEBAQAAAAAAAAAAAAAAAAAFAwYQAAEDAwIDCQEBAAAAAAAAAAECAxEEEiEAURMiU6LSQTJhFDEVIzNSEQACAQIGAwEAAAAAAAAAAAABAhEDIQASIjEEBXFhI2L/wAARCAAQABQDASIAAhEAAxEA/9oADAMBAAIRAxEAPwDlxL63VIb8BcfKAABJJUrAHqTqp9Va9XKWrLhSFlUICbAgC6cItjE/E+ukWCD7tuL1K4Kg3MFYQZUAd42ztppbjZpzTWy7/T28m6ziX2T/AKs8PPGY1Gr2ld+RnUEWKjUSUSpkZjMjQIAIsDFzjSPRArFS5+bEg/oMQFG8NaRefWCBXV9OEoLluJHK2QQcyCEkEHcHW/a1vV7Dfd16GmqWaVlDbn5K5lcPmUUBSyUgkA5gj5zvq37Gl6nZX3dGt2PIDH5O1zqBaG9iJ38nzgOp1XEquzvUpZnYs2ZULSTJkkyTO84//9k=", "base64"));

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];

/**
 * O COMEÇO DE UM JPEG NA FORMA DE UM DE VERDADE, para os casos que o ffmpeg não faz (o progressivo, o cinza, o
 * CMYK e o de 12 bits): SOI, APP0, uma tabela de Huffman (C4, que não é SOF), o SOF pedido e o SOS. O SOF leva um
 * byte por componente a mais do que conta, como o de verdade (o id, a amostragem e a tabela de cada um).
 */
function jpeg(p: { largura: number; altura: number; sof?: number; componentes?: number; precisao?: number; antes?: number[] }): Uint8Array {
  const componentes = p.componentes ?? 3;
  const app0 = segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const dht = segmento(0xc4, [0x00, ...Array(16).fill(0)]);
  const porComponente = Array.from({ length: componentes }, (_, i) => [i + 1, 0x11, 0]).flat();
  const sofN = segmento(p.sof ?? 0xc0, [
    p.precisao ?? 8,
    p.altura >> 8,
    p.altura & 0xff,
    p.largura >> 8,
    p.largura & 0xff,
    componentes,
    ...porComponente,
  ]);
  const sos = segmento(0xda, [1, 1, 0, 0, 0x3f, 0]);
  return new Uint8Array([0xff, 0xd8, ...(p.antes ?? []), ...app0, ...dht, ...sofN, ...sos, 0x55, 0x55, 0xff, 0xd9]);
}

describe("o cabeçalho do JPEG: as medidas, os componentes e a precisão", () => {
  it("os dois JPEGs de verdade do ffmpeg: baseline, 3 componentes, 8 bits", () => {
    expect(cabecalhoDoJpeg(FOTO_A)).toEqual({ largura: 16, altura: 20, componentes: 3, precisao: 8, marcador: 0xc0 });
    expect(cabecalhoDoJpeg(FOTO_B)).toEqual({ largura: 20, altura: 16, componentes: 3, precisao: 8, marcador: 0xc0 });
  });

  it("o progressivo (SOF2), o cinza (1 componente), o CMYK (4) e o de 12 bits", () => {
    expect(cabecalhoDoJpeg(jpeg({ largura: 1080, altura: 1350, sof: 0xc2 }))).toEqual({
      largura: 1080,
      altura: 1350,
      componentes: 3,
      precisao: 8,
      marcador: 0xc2,
    });
    expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, componentes: 1 }))).toMatchObject({ componentes: 1 });
    expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, componentes: 4 }))).toMatchObject({ componentes: 4 });
    expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, precisao: 12 }))).toMatchObject({ precisao: 12 });
  });

  it("o sem perda (C3) e o aritmético (C9) também são lidos, com o marcador de cada um", () => {
    expect(cabecalhoDoJpeg(jpeg({ largura: 8, altura: 8, sof: 0xc3 }))).toMatchObject({ marcador: 0xc3 });
    expect(cabecalhoDoJpeg(jpeg({ largura: 8, altura: 8, sof: 0xc9 }))).toMatchObject({ marcador: 0xc9 });
  });

  it("o SOF depois de segmentos grandes (um EXIF e um perfil de cor de 60 KB cada, 120 KB antes dele) ainda é achado", () => {
    // UM SEGMENTO VAI ATÉ 64 KB (o tamanho tem dois bytes); a foto de celular com perfil de cor leva vários.
    const exif = segmento(0xe1, Array(60_000).fill(0x20));
    const perfil = segmento(0xe2, Array(60_000).fill(0x21));
    expect(cabecalhoDoJpeg(jpeg({ largura: 1080, altura: 1080, antes: [...exif, ...perfil] }))).toMatchObject({ largura: 1080, altura: 1080 });
  });

  it("o que não é JPEG, ou o JPEG cortado antes do SOF, não tem cabeçalho", () => {
    expect(cabecalhoDoJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBeNull();
    expect(cabecalhoDoJpeg(FOTO_A.slice(0, 40))).toBeNull();
    expect(cabecalhoDoJpeg(new Uint8Array())).toBeNull();
  });

  it("as medidas do gerador continuam as mesmas", () => {
    expect(medidasDoJpeg(FOTO_A)).toEqual({ largura: 16, altura: 20 });
  });
});

/** O PDF como texto (latin1), para achar as marcas; as fotos entram como bytes, e a busca delas é pelos bytes. */
const comoTexto = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("o PDF de fotos", () => {
  it("uma página por foto, na ordem, cada uma do tamanho da foto, com o JPEG dentro como está", () => {
    const pdf = pdfDeFotos([FOTO_A, FOTO_B]);
    const t = comoTexto(pdf);
    expect(t.startsWith("%PDF-1.4\n")).toBe(true);
    expect(t.endsWith("%%EOF\n")).toBe(true);
    expect(t).toContain("/Type /Pages /Kids [3 0 R 6 0 R] /Count 2");
    expect(t).toContain("/MediaBox [0 0 16 20]");
    expect(t).toContain("/MediaBox [0 0 20 16]");
    expect(t.indexOf("/MediaBox [0 0 16 20]")).toBeLessThan(t.indexOf("/MediaBox [0 0 20 16]"));
    expect(t.match(/\/Filter \/DCTDecode/g)?.length).toBe(2);
    expect(t.match(/\/ColorSpace \/DeviceRGB/g)?.length).toBe(2);
    // O JPEG ENTRA COMO ESTÁ, byte a byte, sem recomprimir.
    expect(Buffer.from(pdf).indexOf(Buffer.from(FOTO_A))).toBeGreaterThan(0);
    expect(Buffer.from(pdf).indexOf(Buffer.from(FOTO_B))).toBeGreaterThan(Buffer.from(pdf).indexOf(Buffer.from(FOTO_A)));
  });

  it("a tabela de posições aponta para cada objeto, e o startxref para a tabela", () => {
    const pdf = pdfDeFotos([FOTO_A, FOTO_B]);
    const t = comoTexto(pdf);
    const inicioDaTabela = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(t)?.[1]);
    expect(t.slice(inicioDaTabela, inicioDaTabela + 5)).toBe("xref\n");
    const cabeca = /^xref\n0 (\d+)\n/.exec(t.slice(inicioDaTabela));
    const total = Number(cabeca?.[1]);
    expect(total).toBe(1 + 2 + 2 * 3);
    const linhas = t.slice(inicioDaTabela + (cabeca?.[0].length ?? 0)).split("\n").slice(0, total);
    expect(linhas[0]).toBe("0000000000 65535 f ");
    for (let n = 1; n < total; n++) {
      const posicao = Number(linhas[n].slice(0, 10));
      expect(linhas[n].endsWith(" 00000 n ")).toBe(true);
      expect(t.slice(posicao, posicao + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    }
    expect(t).toContain(`trailer\n<< /Size ${total} /Root 1 0 R >>`);
  });

  it("o tamanho do fluxo da foto é o do JPEG, e o do desenho da página é o do texto dele", () => {
    const t = comoTexto(pdfDeFotos([FOTO_A]));
    expect(t).toContain(`/Length ${FOTO_A.length} >>\nstream\n`);
    const desenho = "q 16 0 0 20 0 0 cm /Im0 Do Q";
    expect(t).toContain(`<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`);
  });

  it("a foto em tons de cinza vai como cinza", () => {
    expect(comoTexto(pdfDeFotos([jpeg({ largura: 8, altura: 8, componentes: 1 })]))).toContain("/ColorSpace /DeviceGray");
  });

  it("recusa, com o número da foto, o CMYK, o de 12 bits e o que não é JPEG; e recusa a lista vazia", () => {
    expect(() => pdfDeFotos([FOTO_A, jpeg({ largura: 8, altura: 8, componentes: 4 })])).toThrow(/foto 2/);
    expect(() => pdfDeFotos([jpeg({ largura: 8, altura: 8, precisao: 12 })])).toThrow(/foto 1/);
    expect(() => pdfDeFotos([FOTO_A, new Uint8Array([1, 2, 3])])).toThrow(/foto 2/);
    expect(() => pdfDeFotos([])).toThrow();
  });

  it("recusa, com o número da foto, o JPEG que o filtro do PDF não decodifica: o sem perda (C3) e o aritmético (C9)", () => {
    // A TABELA B.1 DA NORMA DO JPEG (ITU T.81): C3, C7, CB e CF são sem perda, sem a DCT; C9 a CB e CD a CF, aritméticos.
    expect(() => pdfDeFotos([FOTO_A, jpeg({ largura: 8, altura: 8, sof: 0xc3 })])).toThrow(/foto 2/);
    expect(() => pdfDeFotos([jpeg({ largura: 8, altura: 8, sof: 0xc9 })])).toThrow(/foto 1/);
    expect(comoTexto(pdfDeFotos([jpeg({ largura: 8, altura: 8, sof: 0xc1 }), jpeg({ largura: 8, altura: 8, sof: 0xc2 })]))).toContain("/Count 2");
  });
});

describe("o título do documento no LinkedIn: o começo do texto (a decisão do Eduardo, 11/11)", () => {
  it("o texto curto vai inteiro, numa linha só, sem os espaços das pontas", () => {
    expect(tituloDoDocumento("  Cinco dicas\npara o seu   perfil  ")).toBe("Cinco dicas para o seu perfil");
  });

  it("o texto longo é cortado no fim de uma palavra, com reticências, em até 100 caracteres", () => {
    const longo = "Palavra ".repeat(30).trim();
    const titulo = tituloDoDocumento(longo);
    expect(Array.from(titulo).length).toBeLessThanOrEqual(100);
    expect(titulo.endsWith("Palavra…")).toBe(true);
    expect(titulo).not.toContain(" …");
  });

  it("uma palavra só, maior que 100, é cortada no meio, com reticências", () => {
    const titulo = tituloDoDocumento("x".repeat(150));
    expect(titulo).toBe(`${"x".repeat(99)}…`);
  });

  it("o texto de exatos 100 caracteres não ganha reticências", () => {
    const cem = `${"a".repeat(49)} ${"b".repeat(50)}`;
    expect(tituloDoDocumento(cem)).toBe(cem);
  });
});

describe("o carrossel no LinkedIn: só fotos, até 15 MB no total", () => {
  it("o teto é 15 MB", () => {
    expect(TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES).toBe(15 * 1024 * 1024);
  });

  it("um vídeo no carrossel não vai ao LinkedIn; o total acima do teto também não; o resto passa", () => {
    expect(problemaDoCarrosselNoLinkedin([{ video: false, bytes: 1000 }, { video: true, bytes: 1000 }])).toBe("video");
    expect(
      problemaDoCarrosselNoLinkedin([
        { video: false, bytes: TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES },
        { video: false, bytes: 1 },
      ])
    ).toBe("grande");
    expect(problemaDoCarrosselNoLinkedin([{ video: false, bytes: TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES - 1 }, { video: false, bytes: 1 }])).toBeNull();
  });

  it("cada problema tem a sua frase", () => {
    expect(textoDoProblemaDoCarrosselNoLinkedin("video")).toBe("O carrossel do LinkedIn vai como PDF, só com fotos.");
    expect(textoDoProblemaDoCarrosselNoLinkedin("grande")).toBe(
      "As fotos do carrossel passam de 15 MB juntas, o limite do LinkedIn neste painel. Tire fotos ou use fotos menores."
    );
  });
});

describe("o JPEG que pode ir cru com o LinkedIn marcado", () => {
  it("só o de 1 ou 3 componentes (cinza ou cor de tela); o CMYK e o que não deu para ler passam pelo canvas", () => {
    expect(vaiCruParaOLinkedin({ componentes: 1, precisao: 8, marcador: 0xc0 })).toBe(true);
    expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 8, marcador: 0xc0 })).toBe(true);
    for (const outro of [0, 2, 4]) expect(vaiCruParaOLinkedin({ componentes: outro, precisao: 8, marcador: 0xc0 })).toBe(false);
    expect(vaiCruParaOLinkedin(null)).toBe(false);
  });

  it("só o baseline, o estendido e o progressivo (C0, C1 e C2), de 8 bits; o sem perda e o aritmético passam pelo canvas", () => {
    for (const marcador of [0xc0, 0xc1, 0xc2]) expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 8, marcador })).toBe(true);
    for (const marcador of [0xc3, 0xc5, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xcf]) {
      expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 8, marcador })).toBe(false);
    }
    expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 12, marcador: 0xc1 })).toBe(false);
  });
});

describe("o botão diz onde o post sai (o achado 215)", () => {
  it("com as caixinhas na tela, o botão diz as redes marcadas, e o verbo segue o Quando", () => {
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: true, linkedin: false, agendar: false })).toBe("Publicar no Instagram");
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: false, linkedin: true, agendar: false })).toBe("Publicar no LinkedIn");
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: true, linkedin: true, agendar: false })).toBe(
      "Publicar no Instagram e no LinkedIn"
    );
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: false, linkedin: true, agendar: true })).toBe("Agendar no LinkedIn");
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: true, linkedin: true, agendar: true })).toBe(
      "Agendar no Instagram e no LinkedIn"
    );
  });

  it("sem nenhuma rede marcada, ou sem as caixinhas (a conta sem LinkedIn), o botão é o de antes", () => {
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: false, linkedin: false, agendar: false })).toBe("Publicar");
    expect(textoDoBotaoDePublicar({ comRedes: false, instagram: true, linkedin: false, agendar: false })).toBe("Publicar");
    expect(textoDoBotaoDePublicar({ comRedes: false, instagram: true, linkedin: false, agendar: true })).toBe("Publicar");
  });
});
