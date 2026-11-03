import { describe, expect, it } from "vitest";
import { slidesDoTexto, type SlideParaArte } from "@/lib/bonus/arte-slides";
import { ALTURA_DO_BLOCO_DA_CAPA, DEGRAUS_DA_CAPA, ENTRELINHA_DA_CAPA, alturaDaLinhaDaCapa } from "@/lib/bonus/capa-geometria";
import { composicaoDaCapa, medidaDaCapa, tamanhoDaCapa, textoDaCapa } from "@/lib/bonus/capa-medida";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";

// A MEDIDA DO GANCHO NA CAPA (spec da Etapa 11, "O desenho da capa" e "Por dentro"): a Carlito negrito,
// toda em maiúscula, com a entrelinha de 1,02, nos degraus próprios da capa (112, 96, 80, 64 e 56), num
// bloco de até 640 px. A conta é a exata de hoje (arte-medida.ts: a largura real de cada letra e a quebra
// do Satori), e a mesma função decide a tela, o desenho e o servidor (o achado 70 nasceu de a conta e o
// desenho divergirem). tests/bonus-capa-desenho.test.ts confere a conta contra o desenho, no pixel.

const carrossel = (gancho: string): TextoDeCarrossel => ({
  tipo: "carrossel",
  titulo: "",
  gancho,
  slides: [{ titulo: "Um", texto: "Texto do slide." }],
  chamada: "Comente SUMIDO e receba as mensagens.",
  legenda: "x".repeat(100),
});
const capa = (gancho: string): SlideParaArte => slidesDoTexto(carrossel(gancho))[0];

/** O gancho mais longo que o schema aceita (120 caracteres), com palavras comuns de um gancho. */
const GANCHO_DE_120 = "Seu cliente sumiu depois da primeira compra e você acha que ele não volta? Veja as três mensagens que trazem ele de vez!";

describe("o texto da capa", () => {
  it("sai todo em maiúscula, com os acentos do português", () => {
    expect(textoDaCapa("ação é já, coração")).toBe("AÇÃO É JÁ, CORAÇÃO");
  });

  it("a maiúscula vem antes de medir: a composição tem o texto que o desenho desenha", () => {
    const linhas = composicaoDaCapa("seu cliente sumiu?");
    expect(linhas.map((l) => l.texto)).toEqual(["SEU CLIENTE SUMIU?"]);
  });

  it("toda linha é negrito, com o espaçamento do negrito, mesmo com mais de um bloco", () => {
    const linhas = composicaoDaCapa("primeira linha\nsegunda\n\nterceira");
    expect(linhas.map((l) => [l.texto, l.negrito, l.espacamento, l.antes])).toEqual([
      ["PRIMEIRA LINHA", true, -0.4, "nada"],
      ["SEGUNDA", true, -0.4, "nada"],
      ["TERCEIRA", true, -0.4, "paragrafo"],
    ]);
  });
});

describe("os números da capa", () => {
  it("os degraus descem de 112 a 56, e o bloco tem 640 px", () => {
    expect(DEGRAUS_DA_CAPA).toEqual([112, 96, 80, 64, 56]);
    expect(ALTURA_DO_BLOCO_DA_CAPA).toBe(640);
    expect(ENTRELINHA_DA_CAPA).toBe(1.02);
  });

  it("a linha da capa é a fonte vezes 1,02, arredondada como o Satori arredonda", () => {
    expect(DEGRAUS_DA_CAPA.map(alturaDaLinhaDaCapa)).toEqual([114, 98, 82, 65, 57]);
  });
});

describe("o tamanho do gancho na capa", () => {
  it("o gancho curto fica no maior degrau", () => {
    expect(tamanhoDaCapa(capa("Ele sumiu?"))).toEqual({ fonte: 112, cabe: true });
  });

  it("o gancho mais longo do schema cabe, e desce até o degrau em que cabe", () => {
    expect(GANCHO_DE_120).toHaveLength(120);
    const t = tamanhoDaCapa(capa(GANCHO_DE_120));
    expect(t.cabe).toBe(true);
    expect(medidaDaCapa(composicaoDaCapa(GANCHO_DE_120), t.fonte).altura).toBeLessThanOrEqual(ALTURA_DO_BLOCO_DA_CAPA);
    // O degrau acima do escolhido não cabe: é o maior que cabe, e nada mais decide.
    const acima = DEGRAUS_DA_CAPA[DEGRAUS_DA_CAPA.indexOf(t.fonte) - 1];
    if (acima !== undefined) expect(medidaDaCapa(composicaoDaCapa(GANCHO_DE_120), acima).altura).toBeGreaterThan(ALTURA_DO_BLOCO_DA_CAPA);
  });

  it("o gancho de 120 caracteres em maiúscula cabe também no pior caso de letras largas", () => {
    // 15 palavras de 7 letras largas e espaços: 120 caracteres que nenhum gancho real passa em largura.
    const largo = Array.from({ length: 15 }, () => "MÁQUINA").join(" ");
    expect(largo).toHaveLength(119);
    expect(tamanhoDaCapa(capa(largo)).cabe).toBe(true);
  });

  it("a palavra mais larga que a linha no menor degrau não cabe: o card avisa e o publicar trava", () => {
    const t = tamanhoDaCapa(capa("Desinconstitucionalissimamente proibido"));
    expect(t).toEqual({ fonte: 56, cabe: false });
  });

  it("cada degrau que a escolha devolve tem o bloco dentro dos 640 px", () => {
    for (const g of ["Ele sumiu?", "Seu cliente sumiu? Não é culpa dele.", GANCHO_DE_120]) {
      const t = tamanhoDaCapa(capa(g));
      expect(medidaDaCapa(composicaoDaCapa(g), t.fonte).altura).toBeLessThanOrEqual(ALTURA_DO_BLOCO_DA_CAPA);
    }
  });
});
