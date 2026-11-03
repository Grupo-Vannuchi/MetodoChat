import { describe, expect, it } from "vitest";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { corteDoCard, corteDoSlide, slidesQueSaemCortados } from "@/lib/bonus/publicar-cabimento";
import { artesParaPublicar, faltasParaPublicar } from "@/lib/bonus/publicar-estado";

// O PUBLICAR COM A CAPA, NA TELA (spec da Etapa 11, "O publicar"): o slide 1 em capa pede a imagem da capa,
// e só ela conta; ele sai com a arte do Chat, com a imagem desenhada (o "sim" da rota) e com a conta do
// corte da capa. A imagem de outro jeito conta como a que falta. O servidor confere o mesmo
// (testes-integracao/bonus-publicar-processo, "publicar com a capa").

const BASE = {
  total: 5,
  soTexto: [5],
  origem: "gravada" as const,
  slidesNaoSalvos: [],
  legendaNaoSalva: false,
  cortados: { slides: [], soTextoResolve: [] },
};
const PRONTOS = { 2: { jeito: "slide" as const }, 3: { jeito: "slide" as const }, 4: { jeito: "foto" as const } };

describe("o que falta para publicar com a capa", () => {
  it("a capa com a imagem dela não falta", () => {
    expect(faltasParaPublicar({ ...BASE, capa: true, imagens: { ...PRONTOS, 1: { jeito: "capa" } } })).toEqual([]);
  });

  it("a capa sem imagem falta", () => {
    expect(faltasParaPublicar({ ...BASE, capa: true, imagens: PRONTOS })).toEqual([{ tipo: "imagens", slides: [1] }]);
  });

  it("na capa, a foto do espaço ou o slide pronto guardados contam como a imagem que falta", () => {
    for (const jeito of ["foto", "slide"] as const) {
      expect(faltasParaPublicar({ ...BASE, capa: true, imagens: { ...PRONTOS, 1: { jeito } } })).toEqual([{ tipo: "imagens", slides: [1] }]);
    }
  });

  it("com a capa desligada, a imagem da capa no slide 1 conta como a que falta", () => {
    expect(faltasParaPublicar({ ...BASE, capa: false, imagens: { ...PRONTOS, 1: { jeito: "capa" } } })).toEqual([{ tipo: "imagens", slides: [1] }]);
  });

  it("a imagem sem o jeito dito continua contando no slide com espaço, como antes", () => {
    expect(faltasParaPublicar({ ...BASE, capa: false, imagens: { ...PRONTOS, 1: { caminho: "c1", versao: "v" } } })).toEqual([]);
  });
});

describe("as artes que a tela prepara com a capa", () => {
  it("a capa com a imagem dela sai com a arte, a imagem desenhada e a marca da capa", () => {
    expect(artesParaPublicar({ total: 5, soTexto: [5], imagens: { ...PRONTOS, 1: { jeito: "capa" } }, capa: true })).toEqual([
      { numero: 1, comFoto: true, capa: true },
      { numero: 4, comFoto: true },
      { numero: 5, comFoto: false },
    ]);
  });

  it("a capa sem a imagem dela não sai: falta a imagem", () => {
    expect(artesParaPublicar({ total: 5, soTexto: [5], imagens: { ...PRONTOS, 1: { jeito: "foto" } }, capa: true })).toEqual([
      { numero: 4, comFoto: true },
      { numero: 5, comFoto: false },
    ]);
  });
});

describe("o corte da capa", () => {
  const texto = (gancho: string): TextoDeCarrossel => ({
    tipo: "carrossel",
    titulo: "",
    gancho,
    slides: [{ titulo: "Um", texto: "Texto do slide." }],
    chamada: "Comente SUMIDO e receba as mensagens.",
    legenda: "x".repeat(100),
  });
  const CABE = "Seu cliente sumiu? Não é culpa dele.";
  const NAO_CABE = "Desinconstitucionalissimamente proibido";

  it("a capa usa a conta da capa: o gancho que cabe não corta, e o que não cabe só se resolve encurtando", () => {
    expect(corteDoSlide(slidesDoTexto(texto(CABE))[0], { comFoto: true, capa: true })).toBeNull();
    expect(corteDoSlide(slidesDoTexto(texto(NAO_CABE))[0], { comFoto: true, capa: true })).toBe("encurtar");
  });

  it("no servidor, a arte da capa conta pela capa", () => {
    expect(slidesQueSaemCortados(slidesDoTexto(texto(NAO_CABE)), [{ numero: 1, comFoto: true, capa: true }])).toEqual({
      slides: [1],
      soTextoResolve: [],
    });
  });

  it("o card da capa avisa antes da imagem: o fundo escuro existe para o não cabe aparecer antes", () => {
    const valores = { gancho: NAO_CABE, slide_1_titulo: "Um", slide_1_texto: "Texto do slide.", chamada: "Comente SUMIDO." };
    expect(corteDoCard({ total: 3, numero: 1, valores, soTexto: false, jeito: null, capa: true })).toBe("encurtar");
    expect(corteDoCard({ total: 3, numero: 1, valores: { ...valores, gancho: CABE }, soTexto: false, jeito: null, capa: true })).toBeNull();
  });

  it("sem a capa, o mesmo gancho segue a conta de hoje", () => {
    const valores = { gancho: CABE, slide_1_titulo: "Um", slide_1_texto: "Texto do slide.", chamada: "Comente SUMIDO." };
    expect(corteDoCard({ total: 3, numero: 1, valores, soTexto: false, jeito: null, capa: false })).toBeNull();
  });
});
