import { describe, expect, it } from "vitest";
import {
  PROPORCOES_DO_POST,
  PROPORCAO_PADRAO,
  acrescentarNaLista,
  caixaDaMiniatura,
  capaDoPost,
  ehVideoNoPost,
  geometriaDoEnquadramento,
  orientacaoDoJpeg,
  pareceVideo,
  problemaDaSaida,
  problemaDoArquivo,
  problemaDoPrimeiroSlide,
  textoDaContagem,
  textoDaQuantidadeNaTela,
  textoDaRecusaDaPublicacao,
  textoDaRecusaDaTela,
  textoDoEnvioQueNaoFoi,
  textoDoProblema,
  textoDoProblemaDaSaida,
  textoDoProblemaDoPrimeiroSlide,
  vaiSemRedesenho,
  type ModoDoEnquadramento,
  type ProporcaoDoPost,
} from "@/lib/publicacao";

// O ENQUADRAMENTO DO /publicar (spec 2026-10-19-enquadrar-imagens): a proporção escolhida, o corte ao
// centro ou a imagem inteira com bordas, o arquivo que vai como veio, e as travas da lista. Tudo puro,
// porque o `canvas` e o `XMLHttpRequest` não rodam aqui: o que a tela desenha sai daqui.

const MIB = 1024 * 1024;
const PROPORCOES: ProporcaoDoPost[] = ["4:5", "1:1", "1,91:1"];
const MODOS: ModoDoEnquadramento[] = ["cortar", "inteira"];

describe("as proporções do post", () => {
  it("são as três, com 4:5 como padrão", () => {
    expect(PROPORCOES_DO_POST.map((p) => p.id)).toEqual(["4:5", "1:1", "1,91:1"]);
    expect(PROPORCOES_DO_POST.map((p) => p.rotulo)).toEqual(["4:5 (em pé)", "1:1 (quadrado)", "1,91:1 (deitado)"]);
    expect(PROPORCAO_PADRAO).toBe("4:5");
  });
});

describe("geometriaDoEnquadramento", () => {
  it("a foto de celular em pé, cortada em 4:5: o miolo da foto, sem mudar a escala", () => {
    expect(geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: true,
      largura: 1080,
      altura: 1350,
      origem: { x: 0, y: 285, largura: 1080, altura: 1350 },
      destino: { x: 0, y: 0, largura: 1080, altura: 1350 },
    });
  });

  it("a mesma foto inteira em 4:5: a altura toda, com borda dos dois lados, e a largura no teto de 1440", () => {
    expect(geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "inteira" })).toEqual({
      ok: true,
      largura: 1440,
      altura: 1800,
      origem: { x: 0, y: 0, largura: 1080, altura: 1920 },
      destino: { x: 213, y: 0, largura: 1013, altura: 1800 },
    });
  });

  it("o print deitado cortado em 4:5: a faixa do meio, na altura toda", () => {
    expect(geometriaDoEnquadramento({ largura: 1920, altura: 1080, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: true,
      largura: 864,
      altura: 1080,
      origem: { x: 528, y: 0, largura: 864, altura: 1080 },
      destino: { x: 0, y: 0, largura: 864, altura: 1080 },
    });
  });

  it("o print deitado inteiro em 4:5: a largura toda, com borda em cima e embaixo", () => {
    expect(geometriaDoEnquadramento({ largura: 1920, altura: 1080, proporcao: "4:5", modo: "inteira" })).toEqual({
      ok: true,
      largura: 1440,
      altura: 1800,
      origem: { x: 0, y: 0, largura: 1920, altura: 1080 },
      destino: { x: 0, y: 495, largura: 1440, altura: 810 },
    });
  });

  it("a arte já em 4:5 não perde nada, nos dois modos", () => {
    for (const modo of MODOS) {
      expect(geometriaDoEnquadramento({ largura: 1080, altura: 1350, proporcao: "4:5", modo })).toEqual({
        ok: true,
        largura: 1080,
        altura: 1350,
        origem: { x: 0, y: 0, largura: 1080, altura: 1350 },
        destino: { x: 0, y: 0, largura: 1080, altura: 1350 },
      });
    }
  });

  it("acima de 1440 reduz até 1440, mantendo o recorte inteiro", () => {
    expect(geometriaDoEnquadramento({ largura: 2000, altura: 2500, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: true,
      largura: 1440,
      altura: 1800,
      origem: { x: 0, y: 0, largura: 2000, altura: 2500 },
      destino: { x: 0, y: 0, largura: 1440, altura: 1800 },
    });
  });

  it("o quadrado corta o meio de uma arte em pé", () => {
    expect(geometriaDoEnquadramento({ largura: 1080, altura: 1350, proporcao: "1:1", modo: "cortar" })).toEqual({
      ok: true,
      largura: 1080,
      altura: 1080,
      origem: { x: 0, y: 135, largura: 1080, altura: 1080 },
      destino: { x: 0, y: 0, largura: 1080, altura: 1080 },
    });
  });

  it("o 1,91:1 arredonda a altura para cima, para nunca passar de 1,91", () => {
    const g = geometriaDoEnquadramento({ largura: 1080, altura: 1350, proporcao: "1,91:1", modo: "cortar" });
    expect(g).toEqual({
      ok: true,
      largura: 1080,
      altura: 566,
      origem: { x: 0, y: 392, largura: 1080, altura: 566 },
      destino: { x: 0, y: 0, largura: 1080, altura: 566 },
    });
  });

  it("o corte que deixa a imagem estreita demais sugere as bordas", () => {
    expect(geometriaDoEnquadramento({ largura: 640, altura: 360, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: false,
      problema: "estreito_demais",
      sugereBordas: true,
    });
    expect(geometriaDoEnquadramento({ largura: 640, altura: 360, proporcao: "4:5", modo: "inteira" }).ok).toBe(true);
  });

  it("a imagem pequena demais nos dois modos não sugere nada: não se amplia imagem", () => {
    for (const modo of MODOS) {
      expect(geometriaDoEnquadramento({ largura: 300, altura: 300, proporcao: "1:1", modo })).toEqual({
        ok: false,
        problema: "estreito_demais",
        sugereBordas: false,
      });
    }
  });

  // O PISO DE 320 É DO `canvas`, E NÃO DO DESENHO DENTRO DELE: inteira, a
  // imagem de 1×1600 em 1,91:1 daria um canvas de 1440×754 com um desenho de
  // 0 px de largura, e subiria um slide todo branco.
  it("o desenho de menos de 1 pixel é recusa, e o corte dessa imagem não sugere as bordas", () => {
    for (const modo of MODOS) {
      expect(geometriaDoEnquadramento({ largura: 1, altura: 1600, proporcao: "1,91:1", modo })).toEqual({
        ok: false,
        problema: "estreito_demais",
        sugereBordas: false,
      });
    }
    // Deitada: 3000×1 inteira em 4:5 daria um desenho de 1440×0.
    expect(geometriaDoEnquadramento({ largura: 3000, altura: 1, proporcao: "4:5", modo: "inteira" }).ok).toBe(false);
  });

  it("medida que não é número positivo não tem geometria", () => {
    for (const [largura, altura] of [
      [0, 100],
      [100, 0],
      [Number.NaN, 100],
      [-5, 100],
    ]) {
      expect(geometriaDoEnquadramento({ largura, altura, proporcao: "4:5", modo: "cortar" }).ok).toBe(false);
    }
  });

  // A VARREDURA DO ARREDONDAMENTO (achado 112). 4:5 fica EXATAMENTE no limite de 0,8 da Meta
  // (`problemaDoArquivo` recusa `proporcao < 0.8`), e um meio pixel para o lado errado vira recusa na
  // rota de assinar, depois de a pessoa montar o post inteiro. A auditoria contou, de 320 a 1440: a altura
  // do 4:5 arredondada ao mais próximo dá 560 saídas fora da faixa; para baixo, 0. A varredura passa cada
  // saída pela MESMA função que a rota usa, e confere o invariante pela razão.
  // O PRAZO É PRÓPRIO (achado 148): são cerca de 20 mil geometrias e 250 mil `expect`, que levaram de 3,4 a
  // 5,4 s nesta máquina em 30/10, contra os 5 s do padrão do vitest. O prazo padrão derrubava o caso por
  // tempo, e não por defeito; os casos pesados do repositório já têm prazo próprio (bonus-arte-desenho).
  it("toda saída, de 320 a 1440 de largura, nas três proporções e nos dois modos, passa na regra da Meta", () => {
    const formas: [number, number][] = [];
    for (let l = 320; l <= 1440; l++) {
      formas.push([l, l * 3]); // em pé: a largura de saída é a da origem
      formas.push([l, Math.round(l * 1.3)]); // pouco mais alta que 4:5
      formas.push([l * 2, l]); // deitada
    }
    let conferidas = 0;
    for (const [largura, altura] of formas) {
      for (const proporcao of PROPORCOES) {
        for (const modo of MODOS) {
          const g = geometriaDoEnquadramento({ largura, altura, proporcao, modo });
          if (!g.ok) continue;
          conferidas++;
          const campos = [g.largura, g.altura, ...Object.values(g.origem), ...Object.values(g.destino)];
          expect(campos.every(Number.isInteger), `${largura}x${altura} ${proporcao} ${modo}`).toBe(true);
          expect(g.largura).toBeGreaterThanOrEqual(320);
          expect(g.largura).toBeLessThanOrEqual(1440);
          // O recorte dentro da imagem, e o desenho dentro do canvas.
          expect(g.origem.x >= 0 && g.origem.y >= 0).toBe(true);
          expect(g.origem.x + g.origem.largura).toBeLessThanOrEqual(largura);
          expect(g.origem.y + g.origem.altura).toBeLessThanOrEqual(altura);
          expect(g.destino.x >= 0 && g.destino.y >= 0).toBe(true);
          expect(g.destino.largura >= 1 && g.destino.altura >= 1).toBe(true);
          expect(g.destino.x + g.destino.largura).toBeLessThanOrEqual(g.largura);
          expect(g.destino.y + g.destino.altura).toBeLessThanOrEqual(g.altura);
          // O invariante pela razão.
          const razao = g.largura / g.altura;
          if (proporcao === "4:5") expect(razao, `${largura}x${altura} ${modo}`).toBeGreaterThanOrEqual(0.8);
          if (proporcao === "1,91:1") expect(razao, `${largura}x${altura} ${modo}`).toBeLessThanOrEqual(1.91);
          if (proporcao === "1:1") expect(g.largura).toBe(g.altura);
          // E a mesma régua da rota de assinar.
          expect(problemaDoArquivo("carrossel", { mime: "image/jpeg", bytes: 1, largura: g.largura, altura: g.altura }, Infinity)).toBe(null);
        }
      }
    }
    expect(conferidas).toBeGreaterThan(18_000);
  }, 60_000);
});

// UM SEGMENTO DO JPEG: o marcador, o tamanho (que conta os próprios 2 bytes) e o corpo.
function segmento(marcador: number, corpo: number[]): number[] {
  const tamanho = corpo.length + 2;
  return [0xff, marcador, tamanho >> 8, tamanho & 0xff, ...corpo];
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

// O EXIF DE UM JPEG MÍNIMO: SOI, um APP1 com a IFD0, e EOI. A ordem dos bytes do TIFF vem nas duas formas
// que existem, "II" (Intel) e "MM" (Motorola). `valor` nulo é o EXIF sem a etiqueta 0x0112; `etiquetasAntes`
// põe outras entradas na IFD0 antes dela, como a 0x010F (o fabricante), que as câmeras gravam primeiro.
function jpegComOrientacao(
  valor: number | null,
  ordem: "II" | "MM",
  antes: number[] = [],
  etiquetasAntes: number[] = []
): Uint8Array {
  const u16 = (n: number) => (ordem === "II" ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) =>
    ordem === "II" ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const entradas = [...etiquetasAntes.map((t) => [t, 1]), ...(valor === null ? [] : [[0x0112, valor]])];
  const tiff = [
    ...(ordem === "II" ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42),
    ...u32(8),
    ...u16(entradas.length),
    ...entradas.flatMap(([etiqueta, v]) => [...u16(etiqueta), ...u16(3), ...u32(1), ...u16(v), 0, 0]),
    ...u32(0),
  ];
  return new Uint8Array([0xff, 0xd8, ...antes, ...segmento(0xe1, [...ascii("Exif"), 0, 0, ...tiff]), 0xff, 0xd9]);
}

describe("orientacaoDoJpeg", () => {
  it.each([1, 3, 6, 8])("lê a orientação %i, nas duas ordens de bytes", (valor) => {
    expect(orientacaoDoJpeg(jpegComOrientacao(valor, "II"))).toBe(valor);
    expect(orientacaoDoJpeg(jpegComOrientacao(valor, "MM"))).toBe(valor);
  });

  it("acha o APP1 depois de um APP0 (JFIF)", () => {
    const app0 = segmento(0xe0, [...ascii("JFIF"), 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
    expect(orientacaoDoJpeg(jpegComOrientacao(6, "MM", app0))).toBe(6);
  });

  it("pula um APP1 de XMP antes do EXIF: só o que começa com Exif\\0\\0 é EXIF", () => {
    const xmp = segmento(0xe1, [...ascii("http://ns.adobe.com/xap/1.0/"), 0, ...ascii("<x:xmpmeta/>")]);
    expect(orientacaoDoJpeg(jpegComOrientacao(6, "II", xmp))).toBe(6);
  });

  it("acha a etiqueta 0x0112 depois de outras na IFD0", () => {
    expect(orientacaoDoJpeg(jpegComOrientacao(8, "II", [], [0x010f, 0x0110]))).toBe(8);
    expect(orientacaoDoJpeg(jpegComOrientacao(3, "MM", [], [0x010f]))).toBe(3);
  });

  it("aceita os bytes de preenchimento 0xFF antes de um marcador, como a norma permite", () => {
    expect(orientacaoDoJpeg(jpegComOrientacao(6, "II", [0xff, 0xff]))).toBe(6);
  });

  // O 1 SÓ SAI DE UMA LEITURA QUE CHEGOU AO FIM: "nada a girar" deixa o JPEG ir cru.
  it("vale 1 o JPEG sem EXIF até o SOS ou o EOI, e o EXIF sem a etiqueta", () => {
    expect(orientacaoDoJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(1);
    const app0 = segmento(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    expect(orientacaoDoJpeg(new Uint8Array([0xff, 0xd8, ...app0, 0xff, 0xda, 0x00, 0x08]))).toBe(1);
    expect(orientacaoDoJpeg(jpegComOrientacao(null, "II", [], [0x010f]))).toBe(1);
  });

  // O ACHADO 117: NÃO CONSEGUIR LER É 0, E O 0 VAI PELO `canvas`. Antes isso era 1, e a leitura falhava
  // aberta: a tela só passa os primeiros 64 KiB, e um APP1 que terminasse depois deles subia cru.
  it("vale 0 o que não deu para ler: outro formato, vazio, bytes cortados e o APP1 que passa dos 64 KiB", () => {
    expect(orientacaoDoJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(0);
    expect(orientacaoDoJpeg(new Uint8Array([]))).toBe(0);
    expect(orientacaoDoJpeg(jpegComOrientacao(6, "II").slice(0, 20))).toBe(0);
    const app0 = segmento(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    expect(orientacaoDoJpeg(new Uint8Array([0xff, 0xd8, ...app0]))).toBe(0);

    const grande = segmento(0xe2, new Array(65_514).fill(0));
    const inteiro = jpegComOrientacao(6, "II", grande);
    expect(2 + grande.length).toBeLessThan(64 * 1024); // o APP1 começa antes dos 64 KiB…
    expect(orientacaoDoJpeg(inteiro)).toBe(6);
    expect(orientacaoDoJpeg(inteiro.slice(0, 64 * 1024))).toBe(0); // …e termina depois deles
  });

  it("vale 0 o segmento malformado: valor fora de 1 a 8, TIFF sem a marca, e marcador sem tamanho", () => {
    expect(orientacaoDoJpeg(jpegComOrientacao(9, "II"))).toBe(0);
    expect(orientacaoDoJpeg(jpegComOrientacao(0, "MM"))).toBe(0);
    const semMarca = new Uint8Array([0xff, 0xd8, ...segmento(0xe1, [...ascii("Exif"), 0, 0, ...ascii("XX"), 42, 0, 8, 0, 0, 0]), 0xff, 0xd9]);
    expect(orientacaoDoJpeg(semMarca)).toBe(0);
    expect(orientacaoDoJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd0, 0x00, 0x04, 0, 0, 0xff, 0xd9]))).toBe(0);
  });
});

describe("vaiSemRedesenho: o JPEG que o enquadramento não mudaria vai como veio", () => {
  const base = { mime: "image/jpeg", largura: 1080, altura: 1350, bytes: 500_000, proporcao: "4:5" as ProporcaoDoPost, orientacao: 1 };

  it("o JPEG exatamente em 4:5, de até 1440 px, com a orientação 1", () => {
    expect(vaiSemRedesenho(base)).toBe(true);
    expect(vaiSemRedesenho({ ...base, largura: 1080, altura: 1080, proporcao: "1:1" })).toBe(true);
    expect(vaiSemRedesenho({ ...base, largura: 1146, altura: 600, proporcao: "1,91:1" })).toBe(true);
  });

  // NO 1,91:1 A PROPORÇÃO EXATA QUASE NÃO EXISTE (só larguras múltiplas de 191): o que vai cru é o
  // JPEG com a medida que o `canvas` daria, como o 1080×566 (razão 1,908).
  it("no 1,91:1, o JPEG igual à saída do canvas vai cru", () => {
    expect(vaiSemRedesenho({ ...base, largura: 1080, altura: 566, proporcao: "1,91:1" })).toBe(true);
    expect(vaiSemRedesenho({ ...base, largura: 1080, altura: 567, proporcao: "1,91:1" })).toBe(false);
  });

  it.each([3, 6, 8])("a foto girada pelo EXIF (%i) passa pelo canvas", (orientacao) => {
    expect(vaiSemRedesenho({ ...base, orientacao })).toBe(false);
  });

  it("a orientação que não deu para ler (0) passa pelo canvas", () => {
    expect(vaiSemRedesenho({ ...base, orientacao: 0 })).toBe(false);
  });

  it("PNG e WebP passam pelo canvas", () => {
    expect(vaiSemRedesenho({ ...base, mime: "image/png" })).toBe(false);
    expect(vaiSemRedesenho({ ...base, mime: "image/webp" })).toBe(false);
  });

  it("o que não é exato passa pelo canvas, mesmo a 1% da proporção", () => {
    expect(vaiSemRedesenho({ ...base, altura: 1351 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, largura: 1081 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, largura: 1000, altura: 1258 })).toBe(false); // 0,795
    expect(vaiSemRedesenho({ ...base, largura: 1152, altura: 600, proporcao: "1,91:1" })).toBe(false); // 1,92
    expect(vaiSemRedesenho({ ...base, proporcao: "1:1" })).toBe(false);
  });

  it("acima de 1440 px, acima de 8 MiB e sem medida passam pelo canvas", () => {
    expect(vaiSemRedesenho({ ...base, largura: 2000, altura: 2500 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, bytes: 8 * MIB + 1 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, bytes: 8 * MIB })).toBe(true);
    expect(vaiSemRedesenho({ ...base, largura: undefined })).toBe(false);
    expect(vaiSemRedesenho({ ...base, altura: undefined })).toBe(false);
  });
});

describe("problemaDaSaida: o vermelho da lista é o da saída prevista, e não o do original", () => {
  const imagem = (p: Partial<{ mime: string; largura: number; altura: number; bytes: number }> = {}) => ({
    mime: "image/jpeg",
    largura: 3024,
    altura: 4032,
    bytes: 3 * MIB,
    orientacao: 1,
    ...p,
  });

  it("a foto de celular 3:4 e o PNG em pé não ficam vermelhos: o canvas os enquadra", () => {
    expect(problemaDaSaida("carrossel", imagem(), "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("carrossel", imagem({ mime: "image/png", largura: 2000, altura: 3000 }), "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("imagem", imagem({ mime: "image/webp" }), "1:1", "inteira", Infinity)).toBe(null);
  });

  it("o original acima de 8 MiB não fica vermelho quando vai pelo canvas", () => {
    expect(problemaDaSaida("carrossel", imagem({ bytes: 12 * MIB }), "4:5", "cortar", Infinity)).toBe(null);
  });

  it("o formato que nem o canvas nem a Meta aceitam fica vermelho", () => {
    expect(problemaDaSaida("carrossel", imagem({ mime: "image/gif" }), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
    expect(problemaDaSaida("imagem", imagem({ mime: "image/heic" }), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
  });

  it("a imagem que o navegador não abriu fica vermelha, com frase própria", () => {
    expect(problemaDaSaida("carrossel", imagem({ largura: undefined as unknown as number }), "4:5", "cortar", Infinity)).toBe("imagem_ilegivel");
  });

  it("o corte estreito sugere as bordas; a imagem pequena nos dois modos, não", () => {
    expect(problemaDaSaida("carrossel", imagem({ largura: 640, altura: 360 }), "4:5", "cortar", Infinity)).toBe("estreito_no_corte");
    expect(problemaDaSaida("carrossel", imagem({ largura: 640, altura: 360 }), "4:5", "inteira", Infinity)).toBe(null);
    expect(problemaDaSaida("carrossel", imagem({ largura: 300, altura: 300 }), "1:1", "cortar", Infinity)).toBe("estreito_demais");
  });

  it("o cru é conferido como vai: o teto do armazenamento vale para ele", () => {
    const cru = imagem({ largura: 1080, altura: 1350, bytes: 600_000 });
    expect(problemaDaSaida("carrossel", cru, "4:5", "cortar", 100_000)).toBe("grande_para_o_bucket");
    expect(problemaDaSaida("carrossel", cru, "4:5", "cortar", Infinity)).toBe(null);
  });

  it("o vídeo do carrossel segue as regras de hoje", () => {
    const video = { mime: "video/mp4", largura: 1080, altura: 1920, bytes: 20 * MIB, segundos: 10, orientacao: 1 };
    expect(problemaDaSaida("carrossel", video, "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("carrossel", { ...video, segundos: 2 }, "4:5", "cortar", Infinity)).toBe("curto_demais");
    expect(problemaDaSaida("imagem", video, "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
  });

  it("o reels e o story continuam com as regras de hoje", () => {
    const video = { mime: "video/mp4", largura: 1080, altura: 1920, bytes: 20 * MIB, segundos: 30, orientacao: 1 };
    expect(problemaDaSaida("reels", video, "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("reels", imagem(), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
    expect(problemaDaSaida("story", imagem({ mime: "image/png" }), "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("story", imagem({ mime: "image/gif" }), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
    expect(problemaDaSaida("story", imagem({ largura: 200, altura: 400, bytes: 30_000 }), "4:5", "cortar", Infinity)).toBe("estreito_demais");
  });

  it("cada problema tem a sua frase, e os de hoje usam a frase de hoje", () => {
    expect(textoDoProblemaDaSaida("estreito_no_corte")).toBe(
      'Cortada nesta proporção, a imagem fica estreita demais (menos de 320 pixels). Use "Inteira, com bordas".'
    );
    expect(textoDoProblemaDaSaida("imagem_ilegivel")).toBe(
      "Não consegui abrir esta imagem neste navegador. Exporte em JPEG ou PNG e tente de novo."
    );
    expect(textoDoProblemaDaSaida("tipo_nao_suportado")).toBe(textoDoProblema("tipo_nao_suportado"));
  });
});

describe("problemaDoPrimeiroSlide: a Meta corta todos pela proporção do primeiro que sai", () => {
  const img = (valido = true) => ({ video: false, largura: 1080, altura: 1350, valido });
  const video = (largura?: number, altura?: number, valido = true) => ({ video: true, largura, altura, valido });

  it("a imagem em primeiro nunca trava", () => {
    expect(problemaDoPrimeiroSlide([img(), video(1080, 1920)], "4:5")).toBe(null);
  });

  it("o vídeo em primeiro na proporção escolhida, a 1%, não trava", () => {
    expect(problemaDoPrimeiroSlide([video(1080, 1350), img()], "4:5")).toBe(null);
    expect(problemaDoPrimeiroSlide([video(1086, 1350), img()], "4:5")).toBe(null);
  });

  it("a borda da tolerância: 1080×1340 (0,75% de 4:5) passa, 1080×1330 (1,5%) trava", () => {
    expect(problemaDoPrimeiroSlide([video(1080, 1340), img()], "4:5")).toBe(null);
    expect(problemaDoPrimeiroSlide([video(1080, 1330), img()], "4:5")).toEqual({ motivo: "video_fora", proporcaoProxima: null });
  });

  it("o primeiro VÁLIDO decide: a imagem recusada na frente não conta", () => {
    expect(problemaDoPrimeiroSlide([img(false), video(1080, 1920), img()], "4:5")).toEqual({ motivo: "video_fora", proporcaoProxima: null });
  });

  it("o vídeo fora da proporção trava, e sugere a proporção só quando ele está a 1% de uma delas", () => {
    expect(problemaDoPrimeiroSlide([video(1080, 1080), img()], "4:5")).toEqual({ motivo: "video_fora", proporcaoProxima: "1:1" });
    expect(problemaDoPrimeiroSlide([video(1920, 1080), img()], "1,91:1")).toEqual({ motivo: "video_fora", proporcaoProxima: null });
  });

  it("o vídeo sem medida em primeiro trava, com frase própria", () => {
    expect(problemaDoPrimeiroSlide([video(), img()], "4:5")).toEqual({ motivo: "video_sem_medida" });
  });

  it("o carrossel só de vídeos não trava: não há imagem a proteger", () => {
    expect(problemaDoPrimeiroSlide([video(1080, 1920), video(1080, 1920)], "4:5")).toBe(null);
    expect(problemaDoPrimeiroSlide([video(1080, 1920), img(false)], "4:5")).toBe(null);
    expect(problemaDoPrimeiroSlide([], "4:5")).toBe(null);
  });

  it("as frases", () => {
    expect(textoDoProblemaDoPrimeiroSlide({ motivo: "video_fora", proporcaoProxima: null })).toBe(
      "O primeiro slide decide o corte de todos: ponha uma imagem em primeiro."
    );
    expect(textoDoProblemaDoPrimeiroSlide({ motivo: "video_fora", proporcaoProxima: "1:1" })).toBe(
      "O primeiro slide decide o corte de todos: ponha uma imagem em primeiro, ou escolha a proporção 1:1 (quadrado)."
    );
    expect(textoDoProblemaDoPrimeiroSlide({ motivo: "video_sem_medida" })).toBe(
      "Não consegui medir o vídeo do primeiro slide: ponha uma imagem em primeiro."
    );
  });
});

describe("a lista de montagem", () => {
  it("o carrossel acrescenta ao fim, até 10, e conta o que ficou de fora", () => {
    expect(acrescentarNaLista([1, 2], [3, 4], "carrossel")).toEqual({ lista: [1, 2, 3, 4], deFora: 0 });
    expect(acrescentarNaLista([1, 2, 3, 4, 5, 6, 7, 8], [9, 10, 11, 12], "carrossel")).toEqual({
      lista: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      deFora: 2,
    });
  });

  it("nas outras formas, escolher de novo troca o arquivo", () => {
    expect(acrescentarNaLista([1], [2], "imagem")).toEqual({ lista: [2], deFora: 0 });
    expect(acrescentarNaLista([1], [2, 3], "reels")).toEqual({ lista: [2], deFora: 1 });
    expect(acrescentarNaLista([1], [], "story")).toEqual({ lista: [1], deFora: 0 });
  });

  it("a contagem do post", () => {
    expect(textoDaContagem(1)).toBe("O post vai sair com 1 slide.");
    expect(textoDaContagem(4)).toBe("O post vai sair com 4 slides.");
  });

  it("a caixa da miniatura é a proporção escolhida", () => {
    expect(caixaDaMiniatura("imagem", [], "4:5")).toEqual({ largura: 4, altura: 5 });
    expect(caixaDaMiniatura("carrossel", [{ video: false, largura: 3000, altura: 2000, valido: true }], "1,91:1")).toEqual({
      largura: 191,
      altura: 100,
    });
    // Com uma imagem válida, o vídeo é cortado pela proporção escolhida, como as imagens.
    const misto = [
      { video: true, largura: 1080, altura: 1920, valido: true },
      { video: false, largura: 1080, altura: 1350, valido: true },
    ];
    expect(caixaDaMiniatura("carrossel", misto, "1:1")).toEqual({ largura: 1, altura: 1 });
  });

  it("no carrossel só de vídeos, a caixa é a do primeiro vídeo válido: é por ele que a Meta corta", () => {
    const videos = [
      { video: false, largura: 10, altura: 10, valido: false },
      { video: true, largura: 1080, altura: 1920, valido: true },
      { video: true, largura: 1920, altura: 1080, valido: true },
    ];
    expect(caixaDaMiniatura("carrossel", videos, "4:5")).toEqual({ largura: 1080, altura: 1920 });
    // Sem medida do primeiro, fica a escolhida.
    expect(caixaDaMiniatura("carrossel", [{ video: true, valido: true }, videos[1]], "4:5")).toEqual({ largura: 4, altura: 5 });
  });
});

describe("as frases do clique, fora do JSX", () => {
  it("a quantidade na tela é a da action, e aponta a lista quando há arquivo escolhido e nenhum serve", () => {
    expect(textoDaQuantidadeNaTela("imagem", 1, 1)).toBe(null);
    expect(textoDaQuantidadeNaTela("carrossel", 3, 2)).toBe(null);
    expect(textoDaQuantidadeNaTela("imagem", 0, 0)).toBe(textoDaRecusaDaPublicacao("sem_arquivo"));
    expect(textoDaQuantidadeNaTela("carrossel", 3, 1)).toBe(textoDaRecusaDaPublicacao("carrossel_curto_demais"));
    expect(textoDaQuantidadeNaTela("imagem", 1, 0)).toBe("O arquivo escolhido não serve: o motivo está na lista. Escolha outro.");
    expect(textoDaQuantidadeNaTela("carrossel", 3, 0)).toBe(
      "Nenhum dos arquivos escolhidos serve: o motivo de cada um está na lista."
    );
  });

  it("as recusas que só a tela faz", () => {
    expect(textoDaRecusaDaTela("lendo_arquivos")).toBe("Espere a tela terminar de ler os arquivos.");
    expect(textoDaRecusaDaTela("conta_mudou")).toBe(
      "A conta mudou durante o envio. Recarregue a página e monte o post de novo."
    );
  });

  it("a subida que não foi diz qual, e que o próximo clique não sobe de novo o que já subiu", () => {
    expect(textoDoEnvioQueNaoFoi("foto.jpg (2 de 3)")).toBe(
      "O envio de foto.jpg (2 de 3) não foi. Confira o motivo na lista de envios e clique em Publicar de novo: o que já subiu não sobe outra vez."
    );
  });
});

describe("o vídeo nas prévias", () => {
  it("pareceVideo lê a extensão, sem a query e sem o fragmento", () => {
    for (const c of ["a/b.mp4", "a/b.MOV", "a/b.m4v", "a/b.webm", "a/b.mp4?token=1", "a/b.mov#t=1"]) expect(pareceVideo(c), c).toBe(true);
    for (const c of ["a/b.jpg", "a/b.bin", "a/mp4", "a/b.mp4.jpg"]) expect(pareceVideo(c), c).toBe(false);
  });

  it("o reels é sempre vídeo; as outras formas, pela extensão, como o dreno faz", () => {
    expect(ehVideoNoPost("reels", "a/b.bin")).toBe(true);
    expect(ehVideoNoPost("story", "a/b.mp4")).toBe(true);
    expect(ehVideoNoPost("carrossel", "a/b.jpg")).toBe(false);
  });

  it("a capa é a primeira imagem do post, e o post só de vídeo não tem capa", () => {
    expect(capaDoPost("carrossel", ["a/1.mp4", "a/2.jpg", "a/3.jpg"])).toBe("a/2.jpg");
    expect(capaDoPost("carrossel", ["a/1.mp4", "a/2.mov"])).toBe(null);
    expect(capaDoPost("reels", ["a/1.bin"])).toBe(null);
    expect(capaDoPost("imagem", ["a/1.jpg"])).toBe("a/1.jpg");
    expect(capaDoPost("imagem", [])).toBe(null);
  });
});
