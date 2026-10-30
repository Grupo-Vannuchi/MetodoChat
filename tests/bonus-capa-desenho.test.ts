import { describe, expect, it } from "vitest";
import { LARGURA_UTIL, MARGEM } from "@/lib/bonus/arte-geometria";
import { respostaDaArte } from "@/lib/bonus/arte-resposta";
import { slidesDoTexto, type SlideParaArte } from "@/lib/bonus/arte-slides";
import type { CabecalhoDaArte } from "@/lib/bonus/arte-tela";
import { ALTURA_DO_BLOCO_DA_CAPA, LADO_DA_CONTA_NA_CAPA, PE_DO_GANCHO } from "@/lib/bonus/capa-geometria";
import { tamanhoDaCapa } from "@/lib/bonus/capa-medida";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { lerPng } from "./arte-desenhada";

// O DESENHO DA CAPA, NO PIXEL (spec da Etapa 11, "O desenho da capa"): o PNG sai do Satori de verdade, com
// a Carlito do disco, pela mesma resposta da arte de hoje (arte-resposta.tsx). O que se confere é o que o
// achado 70 ensinou: o gancho que a conta diz que cabe (capa-medida.ts), desenhado, fica dentro do bloco
// de 640 px, acima da margem do pé, e não passa da margem da direita. Sem imagem, o fundo é escuro e liso;
// com a imagem, ela cobre o slide inteiro, e a sombra do pé a escurece embaixo do gancho.

const CABECALHO: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: null, iniciais: "TV" };

/** Uma imagem de uma cor só, em SVG: o desenho a recebe como `data:`, como a rota entrega a da capa. */
const VERMELHA = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#FF0000"/></svg>'
).toString("base64")}`;

const GANCHO_DE_120 = "Seu cliente sumiu depois da primeira compra e você acha que ele não volta? Veja as três mensagens que trazem ele de vez!";

const capa = (gancho: string): SlideParaArte => {
  const t: TextoDeCarrossel = {
    tipo: "carrossel",
    titulo: "",
    gancho,
    slides: [{ titulo: "Um", texto: "Texto do slide." }],
    chamada: "Comente SUMIDO e receba as mensagens.",
    legenda: "x".repeat(100),
  };
  return slidesDoTexto(t)[0];
};

async function desenhar(slide: SlideParaArte, extra: Partial<Parameters<typeof respostaDaArte>[0]> = {}) {
  const arte = await respostaDaArte({ slide, comEspaco: false, capa: true, cabecalho: CABECALHO, baixar: false, nomeDoArquivo: "capa.png", ...extra });
  if (!arte.ok) throw new Error(`o desenho falhou: ${arte.falha}`);
  const png = Buffer.from(await arte.resposta.arrayBuffer());
  return { r: arte.resposta, img: lerPng(png) };
}

type Imagem = ReturnType<typeof lerPng>;
const cor = (img: Imagem, x: number, y: number): [number, number, number] => {
  const o = (y * img.largura + x) * 4;
  return [img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]];
};
const luz = (img: Imagem, x: number, y: number) => {
  const [r, g, b] = cor(img, x, y);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** A tinta clara do gancho, abaixo da conta: a primeira e a última linha, e a coluna mais à direita. */
function tintaDoGancho(img: Imagem): { topo: number; fim: number; direita: number } {
  let topo = -1;
  let fim = -1;
  let direita = -1;
  for (let y = MARGEM + LADO_DA_CONTA_NA_CAPA + 20; y < img.altura; y++) {
    for (let x = 0; x < img.largura; x++) {
      if (luz(img, x, y) <= 128) continue;
      if (topo < 0) topo = y;
      fim = y;
      direita = Math.max(direita, x);
    }
  }
  return { topo, fim, direita };
}

describe("o PNG da capa", () => {
  it("sai 1080×1350, e sem imagem não manda o X-Arte-Foto", async () => {
    const { r, img } = await desenhar(capa("Ele sumiu?"));
    expect([img.largura, img.altura]).toEqual([1080, 1350]);
    expect(r.headers.get("x-arte-foto")).toBeNull();
  }, 60_000);

  it("sem imagem, o fundo é escuro e liso; a conta vai no topo, com as iniciais no azul", async () => {
    const { img } = await desenhar(capa("Ele sumiu?"));
    expect(luz(img, 1000, 400)).toBeLessThan(40);
    const meio = MARGEM + LADO_DA_CONTA_NA_CAPA / 2;
    expect(cor(img, MARGEM + 6, meio)).toEqual([0x37, 0x97, 0xf0]);
  }, 60_000);

  it("com a imagem, ela cobre o slide inteiro, e a sombra do pé a escurece embaixo", async () => {
    const { r, img } = await desenhar(capa("Ele sumiu?"), { fotoDoEspaco: { foto: VERMELHA }, versao: "abc" });
    expect(cor(img, 1000, 400)).toEqual([255, 0, 0]);
    expect(cor(img, 1000, 1300)[0]).toBeLessThan(80);
    expect(r.headers.get("x-arte-foto")).toBe("sim");
    expect(r.headers.get("x-arte-versao")).toBe("abc");
  }, 60_000);

  it("a imagem que não veio sai como fundo escuro, e a resposta diz que faltou", async () => {
    const { r, img } = await desenhar(capa("Ele sumiu?"), { fotoDoEspaco: { foto: null } });
    expect(luz(img, 1000, 400)).toBeLessThan(40);
    expect(r.headers.get("x-arte-foto")).toBe("faltou");
  }, 60_000);
});

// A CONTA CONTRA O DESENHO (o achado 70): cada gancho no degrau que a conta escolheu, desenhado, com a
// tinta dentro do bloco, acima da margem do pé e antes da margem da direita. Medido no ensaio: o de 120
// caracteres sai em 80, com a tinta de 681 a 1225; o de letras largas, em 64, até a coluna 964; a cedilha
// de "CORAÇÃO", em 112, desce até 1239.
describe("o gancho que a conta diz que cabe, desenhado", () => {
  const LARGO = Array.from({ length: 15 }, () => "MÁQUINA").join(" ");
  it.each([
    ["curto", "Ele sumiu?"],
    ["médio", "Seu cliente sumiu? Não é culpa dele."],
    ["com acentos e cedilha", "Ação já: É hora de agir, coração!"],
    ["de 120 caracteres", GANCHO_DE_120],
    ["de letras largas", LARGO],
  ])("o %s fica dentro do bloco e das margens", async (_, gancho) => {
    const slide = capa(gancho);
    expect(tamanhoDaCapa(slide).cabe).toBe(true);
    const { img } = await desenhar(slide);
    const t = tintaDoGancho(img);
    expect(t.topo).toBeGreaterThanOrEqual(PE_DO_GANCHO - ALTURA_DO_BLOCO_DA_CAPA);
    expect(t.fim).toBeLessThan(PE_DO_GANCHO);
    expect(t.direita).toBeLessThan(MARGEM + LARGURA_UTIL);
  }, 60_000);
});
