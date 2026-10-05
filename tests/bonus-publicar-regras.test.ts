import { describe, expect, it } from "vitest";
import type { SlideParaArte } from "@/lib/bonus/arte-slides";
import { versoesDosSlides } from "@/lib/bonus/arte-tela";
import {
  PROPORCAO_MAX,
  PROPORCAO_MIN,
  caminhoDaImagem,
  ehCaminhoDoDestino,
  formaDoCarrossel,
  imagensDaArte,
  problemaDaProporcaoDoSlide,
  publicacaoDaArte,
  versaoDoTextoDoSlide,
} from "@/lib/bonus/publicar-regras";

// AS REGRAS PURAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro").

const PASTA = "17841400000000001";
const UUID = "0f8e2a4b-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

describe("os caminhos das imagens no bucket", () => {
  it("a guardada no slide vai para <pasta>/bonus, e a da fila para <pasta>/bonus-fila", () => {
    expect(caminhoDaImagem(PASTA, "slide", UUID)).toBe(`${PASTA}/bonus/${UUID}.jpg`);
    expect(caminhoDaImagem(PASTA, "fila", UUID)).toBe(`${PASTA}/bonus-fila/${UUID}.jpg`);
  });

  it("cada destino aceita só o próprio prefixo, na pasta da conta do carrossel", () => {
    expect(ehCaminhoDoDestino(`${PASTA}/bonus/${UUID}.jpg`, PASTA, "slide")).toBe(true);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-fila/${UUID}.jpg`, PASTA, "fila")).toBe(true);
    // O prefixo de um não serve ao outro: a guardada nunca vai para a fila, e o dreno nunca a apaga.
    expect(ehCaminhoDoDestino(`${PASTA}/bonus/${UUID}.jpg`, PASTA, "fila")).toBe(false);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-fila/${UUID}.jpg`, PASTA, "slide")).toBe(false);
  });

  it.each([
    ["outra pasta", `17841400000000002/bonus/${UUID}.jpg`],
    ["o formato do /publicar, com uma barra só", `${PASTA}/${UUID}.jpg`],
    ["subir de pasta", `${PASTA}/bonus/../${UUID}.jpg`],
    ["barra a mais", `${PASTA}/bonus/x/${UUID}.jpg`],
    ["outra extensão", `${PASTA}/bonus/${UUID}.png`],
    ["uuid em maiúsculas", `${PASTA}/bonus/${UUID.toUpperCase()}.jpg`],
    ["nome que não é uuid", `${PASTA}/bonus/foto.jpg`],
    ["espaço no fim", `${PASTA}/bonus/${UUID}.jpg `],
    ["a pasta como prefixo de outra", `${PASTA}9/bonus/${UUID}.jpg`],
  ])("recusa %s", (_nome, caminho) => {
    expect(ehCaminhoDoDestino(caminho, PASTA, "slide")).toBe(false);
  });

  it("recusa o que não é texto, e a pasta vazia ou com caractere fora da higienização", () => {
    expect(ehCaminhoDoDestino(null, PASTA, "slide")).toBe(false);
    expect(ehCaminhoDoDestino(42, PASTA, "slide")).toBe(false);
    expect(ehCaminhoDoDestino(`/bonus/${UUID}.jpg`, "", "slide")).toBe(false);
    expect(ehCaminhoDoDestino(`a.b/bonus/${UUID}.jpg`, "a.b", "slide")).toBe(false);
  });
});

// A IMAGEM DO SLIDE TEM DE SER 4:5, COMO A ARTE (achado 76, decisão do Eduardo em 05/10): o Instagram
// corta todos os itens do carrossel pela proporção do PRIMEIRO (lib/dedupe.ts:211-212).
describe("a proporção da imagem do slide", () => {
  it("a arte, 1080×1350, passa", () => {
    expect(problemaDaProporcaoDoSlide(1080, 1350)).toBeNull();
    expect(problemaDaProporcaoDoSlide(1440, 1800)).toBeNull();
  });

  it("as bordas de 1% passam, e o que passa delas é recusado", () => {
    expect(PROPORCAO_MIN).toBe(0.792);
    expect(PROPORCAO_MAX).toBe(0.808);
    expect(problemaDaProporcaoDoSlide(792, 1000)).toBeNull();
    expect(problemaDaProporcaoDoSlide(808, 1000)).toBeNull();
    expect(problemaDaProporcaoDoSlide(791, 1000)).toBe("proporcao");
    expect(problemaDaProporcaoDoSlide(809, 1000)).toBe("proporcao");
  });

  it("quadrada e paisagem são recusadas, mesmo que o /publicar as aceite", () => {
    expect(problemaDaProporcaoDoSlide(1080, 1080)).toBe("proporcao");
    expect(problemaDaProporcaoDoSlide(1910, 1000)).toBe("proporcao");
  });

  it("sem medida, ou com medida zero, é recusada: não dá para saber a proporção", () => {
    expect(problemaDaProporcaoDoSlide(undefined, 1350)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(1080, undefined)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(0, 1350)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(1080, 0)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(Number.NaN, 1350)).toBe("sem_medida");
  });
});

describe("a versão do texto do slide", () => {
  const slide: SlideParaArte = {
    numero: 2,
    total: 5,
    tipo: "conteudo",
    titulo: "Os três sinais",
    texto: "Responda o cliente no mesmo dia.",
    assinaturaNoPe: false,
  };

  it("muda com a manchete e com o texto daquele slide", () => {
    const v = versaoDoTextoDoSlide(slide);
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(versaoDoTextoDoSlide({ ...slide, titulo: "Os quatro sinais" })).not.toBe(v);
    expect(versaoDoTextoDoSlide({ ...slide, texto: "Responda no mesmo dia." })).not.toBe(v);
    expect(versaoDoTextoDoSlide({ ...slide })).toBe(v);
  });

  // A versão da miniatura leva a URL da foto da conta, que a Meta troca sozinha: usá-la aqui faria o
  // aviso "o texto mudou" aparecer sem o texto ter mudado.
  it("não muda com a foto da conta, ao contrário da versão da miniatura", () => {
    const comFoto = (foto: string | null) =>
      versoesDosSlides([slide], [], { nome: "Thiago", arroba: "thiago", foto, iniciais: "TH" })[0];
    expect(comFoto("https://cdn/a.jpg")).not.toBe(comFoto("https://cdn/b.jpg"));
    expect(versaoDoTextoDoSlide(slide)).toBe(versaoDoTextoDoSlide(slide));
  });
});

describe("a forma pela quantidade", () => {
  it("1 slide é imagem única; de 2 a 10 é carrossel", () => {
    expect(formaDoCarrossel(1)).toBe("imagem");
    expect(formaDoCarrossel(2)).toBe("carrossel");
    expect(formaDoCarrossel(10)).toBe("carrossel");
  });
});

describe("as imagens guardadas, lidas da coluna arte", () => {
  const img = (n: number) => ({ caminho: `${PASTA}/bonus/${UUID.slice(0, -1)}${n}.jpg`, versao: "0a1b2c3d" });

  it("lê as imagens de cada slide", () => {
    expect(imagensDaArte({ conta: PASTA, imagens: { "2": img(2), "4": img(4) } }, 5)).toEqual({ 2: img(2), 4: img(4) });
  });

  it("o que não tem a forma certa fica de fora, e não quebra a página", () => {
    expect(imagensDaArte(null, 5)).toEqual({});
    expect(imagensDaArte({}, 5)).toEqual({});
    expect(imagensDaArte({ imagens: [] }, 5)).toEqual({});
    expect(
      imagensDaArte(
        {
          imagens: {
            "0": img(0),
            "6": img(6),
            "02": img(2),
            "3": { caminho: "", versao: "0a1b2c3d" },
            "4": { caminho: img(4).caminho },
            "5": "texto",
            "1": img(1),
          },
        },
        5
      )
    ).toEqual({ 1: img(1) });
  });
});

describe("a publicação, lida da coluna arte", () => {
  const publicacao = {
    chave: `pub:${PASTA}:carrossel:a,b`,
    caminhos: ["a", "b"],
    reservada_em: "2026-10-05T15:00:00.000+00:00",
  };

  it("sem a chave publicacao, não há publicação", () => {
    expect(publicacaoDaArte({ conta: PASTA })).toBeNull();
    expect(publicacaoDaArte(null)).toBeNull();
  });

  it("lê a reserva, e a marca de enfileirada quando existe", () => {
    expect(publicacaoDaArte({ publicacao })).toEqual({
      chave: publicacao.chave,
      caminhos: ["a", "b"],
      reservadaEm: new Date("2026-10-05T15:00:00.000Z"),
      enfileiradaEm: null,
    });
    expect(publicacaoDaArte({ publicacao: { ...publicacao, enfileirada_em: "2026-10-05T15:00:01+00:00" } })).toEqual({
      chave: publicacao.chave,
      caminhos: ["a", "b"],
      reservadaEm: new Date("2026-10-05T15:00:00.000Z"),
      enfileiradaEm: new Date("2026-10-05T15:00:01Z"),
    });
  });

  // A PUBLICAÇÃO COM FORMA ESTRANHA TRAVA, e não vira "sem publicação": a regra da trava é escrita
  // pelo que libera, e o que não se reconhece não libera (spec, "A trava no servidor").
  it.each([
    ["chave vazia", { ...publicacao, chave: "" }],
    ["sem caminhos", { ...publicacao, caminhos: [] }],
    ["caminho que não é texto", { ...publicacao, caminhos: ["a", 2] }],
    ["reserva sem data", { ...publicacao, reservada_em: "ontem" }],
    ["marca de enfileirada sem data", { ...publicacao, enfileirada_em: "agora" }],
    ["um texto no lugar do objeto", "publicado"],
  ])("a forma estranha (%s) é 'estranha', e não nula", (_nome, valor) => {
    expect(publicacaoDaArte({ publicacao: valor })).toBe("estranha");
  });
});
