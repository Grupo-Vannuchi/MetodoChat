import { describe, expect, it } from "vitest";
import { comEspaco, ehCapa, escolhasDaArte, lerCapaDoFormulario } from "@/lib/bonus/arte-escolhas";
import {
  ALTURA_DA_CAPA_GERADA,
  CAPA_MAX_ALTURA,
  CAPA_MAX_LARGURA,
  LARGURA_DA_CAPA_GERADA,
  capaDaArte,
  caminhoDaImagem,
  ehCaminhoDoDestino,
  fotosDaArte,
  imagensDaArte,
  jeitoDoCaminho,
  problemaDaFotoDaCapa,
  recorteDaCapa,
  valeNoSlide,
} from "@/lib/bonus/publicar-regras";

// AS REGRAS PURAS DA CAPA DO CARROSSEL (spec da Etapa 11, docs/specs/2026-10-13-capa-do-carrossel.md): o
// jeito do slide 1 guardado na coluna `arte`, o destino `capa` no bucket, a imagem que vale em cada jeito
// e a regra da foto da capa. Tudo o que a tela, as actions e a rota decidem sobre a capa sai daqui.

const PASTA = "17841400000000001";
const UUID = "0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c";
const CAPA = `${PASTA}/bonus-capa/${UUID}.jpg`;
const FOTO = `${PASTA}/bonus-foto/${UUID}.jpg`;
const PRONTO = `${PASTA}/bonus/${UUID}.jpg`;

describe("o jeito do slide 1, lido da coluna arte", () => {
  it("a linha sem a chave capa tem a capa desligada, como os carrosséis de hoje", () => {
    expect(escolhasDaArte({}, 5).capa).toBe(false);
    expect(escolhasDaArte({ soTexto: [2] }, 5).capa).toBe(false);
  });

  it("capa: true liga a capa no carrossel de 2 slides ou mais", () => {
    expect(escolhasDaArte({ capa: true }, 2).capa).toBe(true);
    expect(escolhasDaArte({ capa: true }, 10).capa).toBe(true);
  });

  it("o post de 1 slide nunca tem capa, mesmo com a chave gravada (achado 98)", () => {
    expect(escolhasDaArte({ capa: true }, 1).capa).toBe(false);
  });

  it("só o booleano true liga: o texto, o número e o objeto ficam desligados", () => {
    for (const v of ["true", 1, {}, [], null]) expect(escolhasDaArte({ capa: v }, 5).capa).toBe(false);
  });

  it("com o slide 1 em Só texto, a capa fica desligada: os dois não convivem, e o Só texto de hoje vale", () => {
    const e = escolhasDaArte({ capa: true, soTexto: [1] }, 5);
    expect(e.capa).toBe(false);
    expect(e.soTexto).toEqual([1]);
  });

  it("a capa só vale no slide 1, e ele deixa de ter o espaço da imagem", () => {
    const e = escolhasDaArte({ capa: true, soTexto: [3] }, 4);
    expect([1, 2, 3, 4].map((n) => ehCapa(e, n))).toEqual([true, false, false, false]);
    expect([1, 2, 3, 4].map((n) => comEspaco(e, n))).toEqual([false, true, false, true]);
  });

  it("sem a capa, o slide 1 continua com o espaço", () => {
    const e = escolhasDaArte({}, 4);
    expect(ehCapa(e, 1)).toBe(false);
    expect(comEspaco(e, 1)).toBe(true);
  });
});

// A CAPA MANDADA PELO FORMULÁRIO DA ARTE não é confiável: o navegador manda o que quiser. "1" liga, a
// ausência desliga, e o resto é recusado. Ligar a capa no post de 1 slide, ou junto do Só texto no slide
// 1, também é recusado: a tela nunca manda os dois, e o servidor não escolhe por ela.
describe("a capa mandada pelo formulário da arte", () => {
  it('"1" liga, e a ausência desliga', () => {
    expect(lerCapaDoFormulario("1", [], 3)).toEqual({ ok: true, capa: true });
    expect(lerCapaDoFormulario(null, [], 3)).toEqual({ ok: true, capa: false });
  });

  it.each(["", "0", "true", "on", "01"])("outro valor é recusado: %j", (v) => {
    expect(lerCapaDoFormulario(v, [], 3)).toEqual({ ok: false, motivo: "capa" });
  });

  it("o post de 1 slide recusa a capa (achado 98)", () => {
    expect(lerCapaDoFormulario("1", [], 1)).toEqual({ ok: false, motivo: "capa_no_post" });
  });

  it("a capa junto do Só texto no slide 1 é recusada; com o Só texto em outro slide, passa", () => {
    expect(lerCapaDoFormulario("1", [1, 3], 3)).toEqual({ ok: false, motivo: "capa_e_so_texto" });
    expect(lerCapaDoFormulario("1", [3], 3)).toEqual({ ok: true, capa: true });
  });
});

describe("o destino da capa no bucket", () => {
  it("a capa vai para <pasta>/bonus-capa, ao lado dos três destinos de hoje", () => {
    expect(caminhoDaImagem(PASTA, "capa", UUID)).toBe(CAPA);
  });

  it("o destino capa aceita só o próprio prefixo, na pasta da conta do carrossel", () => {
    expect(ehCaminhoDoDestino(CAPA, PASTA, "capa")).toBe(true);
    expect(ehCaminhoDoDestino(FOTO, PASTA, "capa")).toBe(false);
    expect(ehCaminhoDoDestino(CAPA, PASTA, "foto")).toBe(false);
    expect(ehCaminhoDoDestino(CAPA, "17841400000000002", "capa")).toBe(false);
  });

  it("bonus-capa é o jeito capa, e os jeitos de hoje continuam", () => {
    expect(jeitoDoCaminho(CAPA)).toBe("capa");
    expect(jeitoDoCaminho(FOTO)).toBe("foto");
    expect(jeitoDoCaminho(PRONTO)).toBe("slide");
  });

  it("a imagem da capa é lida com as outras, e não entra nas fotos do espaço", () => {
    const arte = { imagens: { "1": { caminho: CAPA, versao: "v1" }, "2": { caminho: FOTO, versao: "v2" } } };
    expect(imagensDaArte(arte, 3)).toEqual({ 1: { caminho: CAPA, versao: "v1" }, 2: { caminho: FOTO, versao: "v2" } });
    expect(fotosDaArte(arte, 3)).toEqual({ 2: FOTO });
  });
});

// A IMAGEM DE OUTRO JEITO CONTA COMO SEM IMAGEM (nota da revisão da spec): uma bonus-capa com a capa
// desligada, ou uma bonus-foto com a capa ligada, não é desenhada, e a tela, as faltas e o servidor a
// tratam como a imagem que falta.
describe("a imagem que vale em cada jeito do slide", () => {
  const comCapa = escolhasDaArte({ capa: true }, 3);
  const semCapa = escolhasDaArte({}, 3);
  const soTexto = escolhasDaArte({ soTexto: [1] }, 3);

  it("na capa, só a imagem da capa vale", () => {
    expect(valeNoSlide(comCapa, 1, "capa")).toBe(true);
    expect(valeNoSlide(comCapa, 1, "foto")).toBe(false);
    expect(valeNoSlide(comCapa, 1, "slide")).toBe(false);
  });

  it("no slide com espaço, valem a foto e o slide pronto, e a capa não", () => {
    expect(valeNoSlide(semCapa, 1, "foto")).toBe(true);
    expect(valeNoSlide(semCapa, 1, "slide")).toBe(true);
    expect(valeNoSlide(semCapa, 1, "capa")).toBe(false);
    expect(valeNoSlide(comCapa, 2, "capa")).toBe(false);
  });

  it("no Só texto nenhuma vale, e sem imagem nunca vale", () => {
    for (const j of ["capa", "foto", "slide"] as const) expect(valeNoSlide(soTexto, 1, j)).toBe(false);
    expect(valeNoSlide(comCapa, 1, null)).toBe(false);
  });

  it("a capa da arte: ligada, com o caminho só quando a imagem do slide 1 é da capa", () => {
    expect(capaDaArte({ capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } }, 3)).toEqual({ ligada: true, caminho: CAPA });
    expect(capaDaArte({ capa: true, imagens: { "1": { caminho: FOTO, versao: "v" } } }, 3)).toEqual({ ligada: true, caminho: null });
    expect(capaDaArte({ capa: true }, 3)).toEqual({ ligada: true, caminho: null });
    expect(capaDaArte({ imagens: { "1": { caminho: CAPA, versao: "v" } } }, 3)).toEqual({ ligada: false, caminho: null });
    expect(capaDaArte({ capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } }, 1)).toEqual({ ligada: false, caminho: null });
  });
});

// A FOTO DA CAPA (spec, "A imagem da capa"): 4:5 com 1% de tolerância, de 1080×1350 a 2160×2700, e até 2
// MB, o teto da foto do espaço (achado 79). A gerada por IA sai em 1024×1536, e só ela passa fora do 4:5:
// o desenho recorta em cima e embaixo.
describe("a foto declarada para a capa", () => {
  it("1080×1350 e 2160×2700 passam", () => {
    expect(problemaDaFotoDaCapa(1080, 1350, 500_000)).toBeNull();
    expect(problemaDaFotoDaCapa(CAPA_MAX_LARGURA, CAPA_MAX_ALTURA, 500_000)).toBeNull();
  });

  it("as bordas de 1% da proporção passam, e o que passa delas é recusado", () => {
    // 1080/1363 = 0,7924 e 1090/1350 = 0,8074 ficam dentro; 1080/1364 = 0,7918 e 1091/1350 = 0,8081, fora.
    expect(problemaDaFotoDaCapa(1080, 1363, 1)).toBeNull();
    expect(problemaDaFotoDaCapa(1090, 1350, 1)).toBeNull();
    expect(problemaDaFotoDaCapa(1080, 1364, 1)).toBe("proporcao");
    expect(problemaDaFotoDaCapa(1091, 1350, 1)).toBe("proporcao");
    expect(problemaDaFotoDaCapa(1350, 1080, 1)).toBe("proporcao");
  });

  it("menor que 1080×1350 é pequena; maior que 2160×2700 é grande", () => {
    expect(problemaDaFotoDaCapa(1076, 1345, 1)).toBe("pequena");
    expect(problemaDaFotoDaCapa(2164, 2705, 1)).toBe("grande");
  });

  it("2 MB passa, e 2 MB e 1 byte é pesada", () => {
    expect(problemaDaFotoDaCapa(1080, 1350, 2 * 1024 * 1024)).toBeNull();
    expect(problemaDaFotoDaCapa(1080, 1350, 2 * 1024 * 1024 + 1)).toBe("pesada");
  });

  it("a gerada por IA, 1024×1536, passa, e pesa como as outras", () => {
    expect([LARGURA_DA_CAPA_GERADA, ALTURA_DA_CAPA_GERADA]).toEqual([1024, 1536]);
    expect(problemaDaFotoDaCapa(1024, 1536, 2 * 1024 * 1024)).toBeNull();
    expect(problemaDaFotoDaCapa(1024, 1536, 2 * 1024 * 1024 + 1)).toBe("pesada");
    expect(problemaDaFotoDaCapa(1023, 1536, 1)).toBe("proporcao");
  });

  it("a medida da IA vale inteira: a largura dela com outra altura segue a regra do 4:5", () => {
    expect(problemaDaFotoDaCapa(1024, 1280, 1)).toBe("pequena");
    expect(problemaDaFotoDaCapa(1024, 1535, 1)).toBe("proporcao");
  });

  it("a foto deitada do espaço é recusada como capa", () => {
    expect(problemaDaFotoDaCapa(1536, 1024, 1)).toBe("proporcao");
  });

  it("sem medida, ou sem o tamanho em bytes, é recusada", () => {
    expect(problemaDaFotoDaCapa(undefined, 1350, 1)).toBe("sem_medida");
    expect(problemaDaFotoDaCapa(1080, 0, 1)).toBe("sem_medida");
    expect(problemaDaFotoDaCapa(1080, 1350, undefined)).toBe("sem_medida");
  });

  // O achado 149: a assinatura da capa não passa pela `decisaoDeAssinatura`, que recusa o zero em todo
  // outro destino (lib/publicacao.ts:504-506). A régua da capa o recusa por conta própria.
  it("a capa declarada com 0 byte é recusada, como em todo outro destino", () => {
    expect(problemaDaFotoDaCapa(1080, 1350, 0)).toBe("sem_medida");
    expect(problemaDaFotoDaCapa(1024, 1536, 0)).toBe("sem_medida");
  });
});

describe("o recorte da foto da capa", () => {
  it("a foto de celular 3:4 perde o alto e o baixo, ao centro, e é reduzida a 2160×2700", () => {
    expect(recorteDaCapa(3024, 4032)).toEqual({
      ok: true,
      recorte: { x: 0, y: 126, largura: 3024, altura: 3780, saida: { largura: 2160, altura: 2700 } },
    });
  });

  it("a foto deitada perde as laterais, ao centro", () => {
    expect(recorteDaCapa(1920, 1440)).toEqual({
      ok: true,
      recorte: { x: 384, y: 0, largura: 1152, altura: 1440, saida: { largura: 1152, altura: 1440 } },
    });
  });

  it("a foto já em 4:5, entre o mínimo e o máximo, não muda de tamanho", () => {
    expect(recorteDaCapa(1080, 1350)).toEqual({
      ok: true,
      recorte: { x: 0, y: 0, largura: 1080, altura: 1350, saida: { largura: 1080, altura: 1350 } },
    });
  });

  it("a foto cujo recorte fica menor que 1080×1350 é pequena, e não é ampliada", () => {
    expect(recorteDaCapa(1000, 1600)).toEqual({ ok: false, problema: "pequena" });
  });

  it("sem medida não recorta", () => {
    expect(recorteDaCapa(0, 1350)).toEqual({ ok: false, problema: "sem_medida" });
  });

  it("toda saída passa na regra da foto da capa", () => {
    for (const [l, a] of [
      [3024, 4032],
      [4032, 3024],
      [1080, 1350],
      [2161, 2701],
      [1200, 1500],
    ]) {
      const r = recorteDaCapa(l, a);
      if (!r.ok) throw new Error(`${l}×${a} não recortou`);
      expect(problemaDaFotoDaCapa(r.recorte.saida.largura, r.recorte.saida.altura, 1)).toBeNull();
    }
  });
});
