import { describe, expect, it } from "vitest";
import { textoDosCampos } from "@/lib/bonus/arte-cabimento";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { corteDoCard, corteDoSlide, juntarCortes, slidesQueSaemCortados } from "@/lib/bonus/publicar-cabimento";

// O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87): a conta da arte (`tamanhoDoSlide`), no
// modo em que cada slide sai na imagem publicada. O "Só texto" sai sem o espaço da imagem, o com foto
// sai com ele, e o slide pronto do Canva sai com a imagem dele: nunca conta.

const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};
/** Um corpo que cabe sem o espaço da imagem e não cabe com ele (o de tests/bonus-arte-cabimento.test.ts). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
/** Um corpo que não cabe nem sem o espaço da imagem. */
const TRINTA_LINHAS = Array(30).fill("x".repeat(17)).join("\n");
/** Uma palavra de 71 letras, sem espaço, como a da prova da Etapa 8: mais larga que a linha em todo degrau. */
const PALAVRA_DA_PROVA = "x".repeat(71);

/** O slide 2 (o primeiro de conteúdo) de um carrossel de 3, com o corpo dado. */
const slide2 = (texto: string) => slidesDoTexto(textoDosCampos(3, { ...VALORES, slide_1_texto: texto }))[1];
const SO_TEXTO = { comFoto: false };
const COM_FOTO = { comFoto: true };

describe("o corte de um slide, no modo em que ele sai", () => {
  it("o só texto que não cabe sem o espaço sai cortado, e só encurtar resolve", () => {
    expect(corteDoSlide(slide2(TRINTA_LINHAS), SO_TEXTO)).toBe("encurtar");
  });

  it("o só texto que cabe sem o espaço não sai cortado, mesmo sem caber com ele", () => {
    expect(corteDoSlide(slide2(OITO_LINHAS), SO_TEXTO)).toBeNull();
  });

  it("o com foto que não cabe com o espaço sai cortado, e marcar Só texto resolve", () => {
    expect(corteDoSlide(slide2(OITO_LINHAS), COM_FOTO)).toBe("so_texto_resolve");
  });

  it("o com foto que não cabe nem sem o espaço sai cortado, e só encurtar resolve", () => {
    expect(corteDoSlide(slide2(TRINTA_LINHAS), COM_FOTO)).toBe("encurtar");
  });

  it("o com foto que cabe com o espaço passa", () => {
    expect(corteDoSlide(slide2(VALORES.slide_1_texto), COM_FOTO)).toBeNull();
  });

  it("o slide pronto do Canva nunca sai cortado, mesmo com o texto que não cabe", () => {
    expect(corteDoSlide(slide2(TRINTA_LINHAS), null)).toBeNull();
    expect(corteDoSlide(slide2(PALAVRA_DA_PROVA), null)).toBeNull();
  });

  it("a palavra de 71 letras da prova sai cortada nos dois modos, no gancho, no conteúdo e no post", () => {
    const gancho = slidesDoTexto(textoDosCampos(3, { ...VALORES, gancho: PALAVRA_DA_PROVA }))[0];
    const post = slidesDoTexto(textoDosCampos(1, { texto: PALAVRA_DA_PROVA, chamada: "Salve este post.", legenda: "x" }))[0];
    for (const s of [gancho, slide2(PALAVRA_DA_PROVA), post]) {
      expect(corteDoSlide(s, SO_TEXTO)).toBe("encurtar");
      expect(corteDoSlide(s, COM_FOTO)).toBe("encurtar");
    }
  });
});

describe("os slides que sairiam cortados num carrossel", () => {
  const CINCO = {
    gancho: PALAVRA_DA_PROVA,
    slide_1_titulo: "Primeiro",
    slide_1_texto: OITO_LINHAS,
    slide_2_titulo: "Segundo",
    slide_2_texto: OITO_LINHAS,
    slide_3_titulo: "Terceiro",
    slide_3_texto: TRINTA_LINHAS,
    chamada: VALORES.chamada,
    legenda: VALORES.legenda,
  };

  // O 1 é só texto (a palavra), o 2 tem foto (oito linhas), o 3 é slide pronto (oito linhas, não conta),
  // o 4 tem foto (trinta linhas) e o 5 é só texto (cabe).
  it("só os que saem com a arte do Chat contam, em ordem, com os que Só texto resolve", () => {
    const artes = [
      { numero: 1, comFoto: false },
      { numero: 2, comFoto: true },
      { numero: 4, comFoto: true },
      { numero: 5, comFoto: false },
    ];
    expect(slidesQueSaemCortados(slidesDoTexto(textoDosCampos(5, CINCO)), artes)).toEqual({ slides: [1, 2, 4], soTextoResolve: [2] });
  });

  it("nada cortado: as duas listas vazias", () => {
    const artes = [
      { numero: 1, comFoto: false },
      { numero: 2, comFoto: true },
    ];
    expect(slidesQueSaemCortados(slidesDoTexto(textoDosCampos(3, VALORES)), artes)).toEqual({ slides: [], soTextoResolve: [] });
  });
});

describe("o corte do slide de um card, com o texto dos campos dele", () => {
  const card2 = (texto: string) => ({ slide_1_titulo: VALORES.slide_1_titulo, slide_1_texto: texto });

  it("com a foto no espaço, conta com o espaço", () => {
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: false, jeito: "foto" })).toBe("so_texto_resolve");
  });

  it("marcado Só texto, conta sem o espaço, e a foto guardada não conta", () => {
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: true, jeito: "foto" })).toBeNull();
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: true, jeito: null })).toBe("encurtar");
  });

  it("com o slide pronto do Canva, ou ainda sem imagem, não conta", () => {
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: "slide" })).toBeNull();
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: null })).toBeNull();
  });

  it("no post, o texto e a chamada são do mesmo card", () => {
    const valores = { texto: PALAVRA_DA_PROVA, chamada: "Salve este post." };
    expect(corteDoCard({ total: 1, numero: 1, valores, soTexto: false, jeito: "foto" })).toBe("encurtar");
  });
});

describe("o que os cards avisaram, na forma da falta", () => {
  it("em ordem, sem os que deixaram de cortar, e com os que Só texto resolve", () => {
    expect(juntarCortes({ 4: "encurtar", 2: "so_texto_resolve", 3: null })).toEqual({ slides: [2, 4], soTextoResolve: [2] });
    expect(juntarCortes({})).toEqual({ slides: [], soTextoResolve: [] });
  });
});
