import { describe, expect, it } from "vitest";
import type { SlideParaArte } from "@/lib/bonus/arte-slides";
import { versoesDosSlides } from "@/lib/bonus/arte-tela";
import {
  FOTO_DO_ESPACO_MAX_BYTES,
  PROPORCAO_DA_FOTO_MAX,
  PROPORCAO_DA_FOTO_MIN,
  PROPORCAO_MAX,
  PROPORCAO_MIN,
  caminhoDaImagem,
  ehCaminhoDoDestino,
  formaDoCarrossel,
  fotosDaArte,
  imagensDaArte,
  jeitoDoCaminho,
  problemaDaFotoDoEspaco,
  problemaDaProporcaoDoSlide,
  publicacaoDaArte,
  recorteDaFoto,
  versaoDoDesenho,
  versaoDoTextoDoSlide,
} from "@/lib/bonus/publicar-regras";

// AS REGRAS PURAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro").

const PASTA = "17841400000000001";
const UUID = "0f8e2a4b-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

describe("os caminhos das imagens no bucket", () => {
  it("o slide pronto vai para <pasta>/bonus, a foto para <pasta>/bonus-foto, e a da fila para <pasta>/bonus-fila", () => {
    expect(caminhoDaImagem(PASTA, "slide", UUID)).toBe(`${PASTA}/bonus/${UUID}.jpg`);
    expect(caminhoDaImagem(PASTA, "foto", UUID)).toBe(`${PASTA}/bonus-foto/${UUID}.jpg`);
    expect(caminhoDaImagem(PASTA, "fila", UUID)).toBe(`${PASTA}/bonus-fila/${UUID}.jpg`);
  });

  it("cada destino aceita só o próprio prefixo, na pasta da conta do carrossel", () => {
    expect(ehCaminhoDoDestino(`${PASTA}/bonus/${UUID}.jpg`, PASTA, "slide")).toBe(true);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-foto/${UUID}.jpg`, PASTA, "foto")).toBe(true);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-fila/${UUID}.jpg`, PASTA, "fila")).toBe(true);
    // O prefixo de um não serve ao outro: a guardada nunca vai para a fila, e o dreno nunca a apaga.
    expect(ehCaminhoDoDestino(`${PASTA}/bonus/${UUID}.jpg`, PASTA, "fila")).toBe(false);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-fila/${UUID}.jpg`, PASTA, "slide")).toBe(false);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-foto/${UUID}.jpg`, PASTA, "slide")).toBe(false);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-foto/${UUID}.jpg`, PASTA, "fila")).toBe(false);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus/${UUID}.jpg`, PASTA, "foto")).toBe(false);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-fila/${UUID}.jpg`, PASTA, "foto")).toBe(false);
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
      versoesDosSlides([slide], [], { nome: "Thiago", arroba: "thiago", foto, iniciais: "TH" }, {})[0];
    expect(comFoto("https://cdn/a.jpg")).not.toBe(comFoto("https://cdn/b.jpg"));
    expect(versaoDoTextoDoSlide(slide)).toBe(versaoDoTextoDoSlide(slide));
  });
});

// A VERSÃO DO DESENHO: a da arte que sai no post, conferida pelo servidor ao publicar. O "Só texto" é
// a versão do texto (a de antes do adendo); o slide com foto leva o caminho da foto junto.
describe("a versão do desenho", () => {
  const slide: SlideParaArte = {
    numero: 2,
    total: 5,
    tipo: "conteudo",
    titulo: "Os três sinais",
    texto: "Responda o cliente no mesmo dia.",
    assinaturaNoPe: false,
  };
  const FOTO = `${PASTA}/bonus-foto/${UUID}.jpg`;

  it("sem foto, é a versão do texto", () => {
    expect(versaoDoDesenho(slide, null)).toBe(versaoDoTextoDoSlide(slide));
  });

  it("com foto, muda com o caminho dela e com o texto do slide", () => {
    const v = versaoDoDesenho(slide, FOTO);
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(v).not.toBe(versaoDoTextoDoSlide(slide));
    expect(versaoDoDesenho(slide, `${PASTA}/bonus-foto/${UUID.slice(0, -1)}c.jpg`)).not.toBe(v);
    expect(versaoDoDesenho({ ...slide, texto: "Responda no mesmo dia." }, FOTO)).not.toBe(v);
    expect(versaoDoDesenho({ ...slide }, FOTO)).toBe(v);
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

// O JEITO DE CADA IMAGEM É O PREFIXO DO CAMINHO (adendo de 05/10, revisão da auditoria): o servidor o
// lê do caminho que ele mesmo assinou, e não há campo que possa discordar dele.
describe("o jeito de cada imagem guardada, lido do caminho", () => {
  const foto = (n: number) => ({ caminho: `${PASTA}/bonus-foto/${UUID.slice(0, -1)}${n}.jpg`, versao: "0a1b2c3d" });
  const pronto = (n: number) => ({ caminho: `${PASTA}/bonus/${UUID.slice(0, -1)}${n}.jpg`, versao: "0a1b2c3d" });

  it("bonus-foto é a foto no espaço; bonus é o slide pronto, inclusive o guardado antes do adendo", () => {
    expect(jeitoDoCaminho(foto(2).caminho)).toBe("foto");
    expect(jeitoDoCaminho(pronto(2).caminho)).toBe("slide");
  });

  it.each([
    ["a da fila", `${PASTA}/bonus-fila/${UUID}.jpg`],
    ["o formato do /publicar, com uma barra só", `${PASTA}/${UUID}.jpg`],
    ["outro prefixo", `${PASTA}/bonus-video/${UUID}.jpg`],
    ["subir de pasta", `${PASTA}/bonus-foto/../${UUID}.jpg`],
    ["nome que não é uuid", `${PASTA}/bonus-foto/foto.jpg`],
    ["outra extensão", `${PASTA}/bonus-foto/${UUID}.png`],
    ["sem pasta", `bonus-foto/${UUID}.jpg`],
    ["pasta fora da higienização", `a.b/bonus-foto/${UUID}.jpg`],
  ])("outro caminho não tem jeito, e não conta: %s", (_nome, caminho) => {
    expect(jeitoDoCaminho(caminho)).toBeNull();
  });

  it("a entrada sem jeito fica de fora das imagens: o slide volta a pedir a imagem", () => {
    const daFila = { caminho: `${PASTA}/bonus-fila/${UUID}.jpg`, versao: "0a1b2c3d" };
    expect(imagensDaArte({ imagens: { "2": foto(2), "3": pronto(3), "4": daFila } }, 5)).toEqual({ 2: foto(2), 3: pronto(3) });
  });

  it("as fotos da arte são só as de bonus-foto, pelo número do slide", () => {
    expect(fotosDaArte({ imagens: { "2": foto(2), "3": pronto(3), "4": foto(4) } }, 5)).toEqual({ 2: foto(2).caminho, 4: foto(4).caminho });
    expect(fotosDaArte(null, 5)).toEqual({});
  });
});

// A FOTO DECLARADA PARA O ESPAÇO DA ARTE (adendo de 05/10): 860:573, deitada, com 1% de tolerância,
// entre 860×573 e 1720×1146, e até 2 MB (achado 79: a rota não lê mais que isso, e a foto que passasse
// travaria o slide para sempre). O 4:5 não vale para a foto.
describe("a foto declarada para o espaço da arte", () => {
  it("o espaço e o dobro dele passam", () => {
    expect(problemaDaFotoDoEspaco(860, 573, 300_000)).toBeNull();
    expect(problemaDaFotoDoEspaco(1720, 1146, 300_000)).toBeNull();
  });

  it("as bordas de 1% da proporção passam, e o que passa delas é recusado", () => {
    expect(PROPORCAO_DA_FOTO_MIN).toBeCloseTo((860 / 573) * 0.99, 12);
    expect(PROPORCAO_DA_FOTO_MAX).toBeCloseTo((860 / 573) * 1.01, 12);
    expect(problemaDaFotoDoEspaco(1486, 1000, 1)).toBeNull();
    expect(problemaDaFotoDoEspaco(1515, 1000, 1)).toBeNull();
    expect(problemaDaFotoDoEspaco(1485, 1000, 1)).toBe("proporcao");
    expect(problemaDaFotoDoEspaco(1516, 1000, 1)).toBe("proporcao");
  });

  it("o 4:5 do slide pronto é recusado como foto", () => {
    expect(problemaDaFotoDoEspaco(1080, 1350, 1)).toBe("proporcao");
  });

  it("menor que o espaço é pequena; maior que o dobro é grande", () => {
    expect(problemaDaFotoDoEspaco(859, 572, 1)).toBe("pequena");
    expect(problemaDaFotoDoEspaco(1722, 1147, 1)).toBe("grande");
  });

  it("2 MB passa, e 2 MB e 1 byte é pesada (achado 79)", () => {
    expect(FOTO_DO_ESPACO_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(problemaDaFotoDoEspaco(860, 573, FOTO_DO_ESPACO_MAX_BYTES)).toBeNull();
    expect(problemaDaFotoDoEspaco(860, 573, FOTO_DO_ESPACO_MAX_BYTES + 1)).toBe("pesada");
  });

  it("sem medida, ou sem o tamanho em bytes, é recusada", () => {
    expect(problemaDaFotoDoEspaco(undefined, 573, 1)).toBe("sem_medida");
    expect(problemaDaFotoDoEspaco(860, 0, 1)).toBe("sem_medida");
    expect(problemaDaFotoDoEspaco(860, 573, undefined)).toBe("sem_medida");
    expect(problemaDaFotoDoEspaco(860, 573, Number.NaN)).toBe("sem_medida");
  });
});

// O RECORTE DA FOTO NO NAVEGADOR: ao centro, na proporção do espaço, reduzido até 1720×1146 e nunca
// ampliado. O que sai do recorte passa sempre na regra da foto declarada.
describe("o recorte da foto", () => {
  it("a foto deitada mais larga que o espaço perde as laterais, ao centro", () => {
    const r = recorteDaFoto(2000, 1000);
    expect(r).toEqual({ ok: true, recorte: { x: 249, y: 0, largura: 1501, altura: 1000, saida: { largura: 1501, altura: 1000 } } });
  });

  it("a foto em pé perde o alto e o baixo, ao centro", () => {
    const r = recorteDaFoto(1080, 1350);
    expect(r).toEqual({ ok: true, recorte: { x: 0, y: 315, largura: 1080, altura: 720, saida: { largura: 1080, altura: 720 } } });
  });

  it("a foto grande é reduzida ao dobro do espaço", () => {
    const r = recorteDaFoto(4032, 3024);
    expect(r.ok && r.recorte.saida).toEqual({ largura: 1720, altura: 1146 });
    expect(r.ok && r.recorte).toMatchObject({ x: 0, largura: 4032, altura: 2686, y: 169 });
  });

  it("a foto cujo recorte fica menor que o espaço é pequena, e não é ampliada", () => {
    expect(recorteDaFoto(1000, 572)).toEqual({ ok: false, problema: "pequena" });
    expect(recorteDaFoto(859, 2000)).toEqual({ ok: false, problema: "pequena" });
    expect(recorteDaFoto(860, 573)).toEqual({ ok: true, recorte: { x: 0, y: 0, largura: 860, altura: 573, saida: { largura: 860, altura: 573 } } });
  });

  it("sem medida não recorta", () => {
    expect(recorteDaFoto(0, 573)).toEqual({ ok: false, problema: "sem_medida" });
  });

  it.each([
    [860, 573],
    [1000, 3000],
    [3000, 1000],
    [1719, 1145],
    [1721, 1147],
    [6000, 4000],
    [4000, 6000],
    [1366, 911],
  ])("o recorte de %i×%i passa na regra da foto declarada", (largura, altura) => {
    const r = recorteDaFoto(largura, altura);
    if (!r.ok) throw new Error(`recusou: ${r.problema}`);
    expect(problemaDaFotoDoEspaco(r.recorte.saida.largura, r.recorte.saida.altura, 1)).toBeNull();
    expect(r.recorte.x + r.recorte.largura).toBeLessThanOrEqual(largura);
    expect(r.recorte.y + r.recorte.altura).toBeLessThanOrEqual(altura);
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
