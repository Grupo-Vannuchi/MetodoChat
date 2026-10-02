import { describe, expect, it } from "vitest";
import {
  slidesDoTexto,
  slidesQueNaoCabem,
  tamanhoDoTexto,
  textoMedido,
  type SlideParaArte,
  type TipoDeSlide,
} from "@/lib/bonus/arte-slides";
import { ALTURA_TEXTO_SEM_ILUSTRACAO, alturaDisponivel, alturaEstimada } from "@/lib/bonus/arte-geometria";
import { CarrosselDoChatSchema, PostDoChatSchema, SlideSchema } from "@/lib/bonus/carrossel-schema";
import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";

// OS TESTES DOS SLIDES DA ARTE, trazidos do Labs (site-ia, src/lib/ia/slides.test.ts, 45bc973) e
// adaptados à forma do texto do Chat (carrossel-texto.ts). O que muda de lá está dito em cada
// bloco. Os números dos degraus e da geometria são os de lá: se um caso daqui cair, a régua mudou
// num dos dois lados, e o outro precisa saber ("Dois donos", na spec da Etapa 3).

const carrossel = (conteudo: number): TextoDeCarrossel => ({
  tipo: "carrossel",
  titulo: "Nome interno da geração para o operador reconhecer",
  gancho: "Sua planilha está mentindo sobre o seu lucro",
  slides: Array.from({ length: conteudo }, (_, i) => ({
    titulo: `Título do slide ${i + 1}`,
    texto: `Texto do slide ${i + 1}, com duas ou três linhas de conteúdo real.`,
  })),
  chamada: "Comente SUMIDO e eu te mando o prompt completo, de graça.",
  legenda: "x".repeat(120),
});

const POST: TextoDePost = {
  tipo: "post",
  titulo: "rotulo interno da peca",
  texto: "Descanse bem e recarregue as energias.\n\nAmanha sera mais um dia produtivo.",
  chamada: "Comente SUMIDO que eu te mando o banco.",
  legenda: "x".repeat(100),
};

describe("os slides do texto do carrossel", () => {
  // O Chat pede de 2 a 10 slides (0 a 8 de conteúdo); o Labs, de 8 a 11. Os totais pequenos são
  // novos para esta arte, e é por isso que a lista inteira é conferida.
  it.each([0, 1, 2, 8])("junta gancho, %i de conteúdo e chamada numa lista só, numerada sem buraco", (n) => {
    const s = slidesDoTexto(carrossel(n));
    expect(s.map((x) => x.numero)).toEqual(Array.from({ length: n + 2 }, (_, i) => i + 1));
    expect(new Set(s.map((x) => x.total))).toEqual(new Set([n + 2]));
    expect(s[0].tipo).toBe("gancho");
    expect(s[s.length - 1].tipo).toBe("cta");
    expect(s.slice(1, -1).every((x) => x.tipo === "conteudo")).toBe(true);
  });

  it("só o ÚLTIMO slide do carrossel assina no pé", () => {
    const s = slidesDoTexto(carrossel(6));
    expect(s[s.length - 1].assinaturaNoPe).toBe(true);
    expect(s.slice(0, -1).every((x) => x.assinaturaNoPe === false)).toBe(true);
  });

  it("só os slides do meio têm título, e o texto vai como está", () => {
    const c = carrossel(6);
    const s = slidesDoTexto(c);
    expect(s[0]).toMatchObject({ titulo: null, texto: c.gancho });
    expect(s[1]).toMatchObject({ titulo: "Título do slide 1", texto: c.slides[0].texto });
    expect(s[s.length - 1]).toMatchObject({ titulo: null, texto: c.chamada });
  });
});

describe("o post de uma imagem", () => {
  it("vira um slide só, do tipo `cta` pelos degraus de fonte, assinado no TOPO", () => {
    expect(slidesDoTexto(POST)).toEqual([
      { numero: 1, total: 1, tipo: "cta", titulo: null, texto: `${POST.texto}\n\n${POST.chamada}`, assinaturaNoPe: false },
    ]);
  });

  // A chamada entra como ÚLTIMO BLOCO separado por linha em branco, que é como a arte reconhece a
  // linha de fechamento em negrito. No Chat, todo post tem chamada (carrossel-schema.ts).
  it("a chamada vira o último bloco", () => {
    const blocos = slidesDoTexto(POST)[0].texto.split(/\n{2,}/);
    expect(blocos[blocos.length - 1]).toBe(POST.chamada);
  });
});

describe("tamanhoDoTexto", () => {
  it("nunca cresce conforme o texto cresce, e desce quando precisa", () => {
    const tamanhos = [40, 60, 100, 150, 200, 260, 320].map((n) => tamanhoDoTexto("conteudo", "x".repeat(n)));
    for (let i = 1; i < tamanhos.length; i++) {
      expect(tamanhos[i], `${i}: cresceu com texto maior`).toBeLessThanOrEqual(tamanhos[i - 1]);
    }
    expect(tamanhos[tamanhos.length - 1]).toBeLessThan(tamanhos[0]);
  });

  it("o gancho é sempre maior que o texto de conteúdo do mesmo tamanho", () => {
    for (const n of [30, 70, 110]) {
      const t = "x".repeat(n);
      expect(tamanhoDoTexto("gancho", t)).toBeGreaterThan(tamanhoDoTexto("conteudo", t));
    }
  });

  it("nunca desce abaixo de 34px", () => {
    for (const tipo of ["gancho", "conteudo", "cta"] as const) {
      expect(tamanhoDoTexto(tipo, "x".repeat(400))).toBeGreaterThanOrEqual(34);
    }
  });

  it("cresce sem o espaço da imagem, nos três tipos, sem fração de pixel", () => {
    for (const tipo of ["gancho", "conteudo", "cta"] as const) {
      const t = "x".repeat(50);
      expect(tamanhoDoTexto(tipo, t, false)).toBeGreaterThan(tamanhoDoTexto(tipo, t, true));
      expect(Number.isInteger(tamanhoDoTexto(tipo, t, false))).toBe(true);
    }
  });

  it("o padrão é COM o espaço da imagem", () => {
    const t = "x".repeat(100);
    expect(tamanhoDoTexto("conteudo", t)).toBe(tamanhoDoTexto("conteudo", t, true));
  });

  // O CONTRAPESO da descida: ela só pode ser acionada por quem NÃO CABE. Sem este caso, devolver
  // sempre o piso passaria em todos os outros.
  it("a descida não encolhe texto que já cabia, e os degraus do cta são os decididos", () => {
    expect(tamanhoDoTexto("gancho", "x".repeat(30))).toBe(86);
    expect(tamanhoDoTexto("conteudo", "x".repeat(60))).toBe(46);
    expect(tamanhoDoTexto("cta", "x".repeat(70))).toBe(60);
    expect(tamanhoDoTexto("cta", "x".repeat(200))).toBe(46);
    expect(tamanhoDoTexto("cta", "x".repeat(350))).toBe(34);
  });
});

// O TEXTO QUE A ARTE MEDE É O QUE ELA DESENHA: o título e o corpo (a rota do Labs mede assim, em
// src/app/admin/carrossel/arte/route.tsx). ⚠️ DIFERENTE DO LABS, de propósito: lá o aviso de
// `slidesQueNaoCabem` mede só o corpo, e um slide de conteúdo com título comprido podia cortar na
// imagem com o aviso calado. Aqui o aviso e a arte medem o mesmo `textoMedido`.
describe("o texto medido", () => {
  const slide = (titulo: string | null, texto: string): SlideParaArte => ({
    numero: 2,
    total: 3,
    tipo: "conteudo",
    titulo,
    texto,
    assinaturaNoPe: false,
  });

  it("com título, é o título e o corpo em linhas separadas; sem, é só o corpo", () => {
    expect(textoMedido(slide("Título", "Corpo"))).toBe("Título\nCorpo");
    expect(textoMedido(slide(null, "Corpo"))).toBe("Corpo");
  });

  // O conserto do Labs (dev 1254847, 01/10) também apara a manchete: só de espaços, ela não é linha.
  it("o título só de espaços não conta, e o com espaço nas pontas conta aparado", () => {
    expect(textoMedido(slide("   ", "Corpo"))).toBe("Corpo");
    expect(textoMedido(slide("  Título  ", "Corpo"))).toBe("Título\nCorpo");
  });

  // 8 linhas no piso de 34 dão 359px dos 382 com o espaço da imagem; a manchete é a 9ª, e dá 404.
  it("o título conta: o mesmo corpo que cabe sozinho deixa de caber com um título", () => {
    const corpo = Array(8).fill("x".repeat(20)).join("\n");
    expect(slidesQueNaoCabem([slide(null, corpo)])).toEqual([]);
    expect(slidesQueNaoCabem([slide("Um título de slide de conteúdo", corpo)])).toHaveLength(1);
  });
});

describe("o texto cabe na peça", () => {
  const TETOS: Record<TipoDeSlide, number> = {
    gancho: CarrosselDoChatSchema.shape.gancho.maxLength!,
    conteudo: SlideSchema.shape.texto.maxLength!,
    cta: CarrosselDoChatSchema.shape.chamadaParaAcao.maxLength!,
  };
  const TITULO_MAX = SlideSchema.shape.titulo.maxLength!;

  it("os tetos vieram mesmo do schema", () => {
    for (const n of [...Object.values(TETOS), TITULO_MAX]) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it("o gancho e a chamada cabem nos dois modos, no pior caso que o schema permite", () => {
    for (const tipo of ["gancho", "cta"] as const) {
      for (const comIlustracao of [true, false]) {
        const t = "x".repeat(TETOS[tipo]);
        expect(alturaEstimada(t, tamanhoDoTexto(tipo, t, comIlustracao)), `${tipo} ${comIlustracao}`).toBeLessThanOrEqual(
          alturaDisponivel(comIlustracao)
        );
      }
    }
  });

  // ⚠️ DIFERENTE DO LABS: com a manchete medida, o slide de conteúdo no PIOR caso do schema
  // (manchete de 70 e corpo de 300, em caixa alta) não cabe em modo nenhum: sem o espaço da imagem
  // o piso também sobe (34 × 1,6 = 54px), e dá 998px dos 955. O aviso existe para isto, e diz
  // "corta sempre": o operador encurta. Um slide do tamanho que a instrução pede cabe com folga.
  it("o conteúdo no pior caso do schema é acusado como 'corta sempre', e o tamanho comum cabe com o espaço", () => {
    const slideDe = (titulo: string, texto: string): SlideParaArte => ({
      numero: 2,
      total: 3,
      tipo: "conteudo",
      titulo,
      texto,
      assinaturaNoPe: false,
    });
    const pior = slideDe("x".repeat(TITULO_MAX), "x".repeat(TETOS.conteudo));
    expect(slidesQueNaoCabem([pior])).toEqual([{ numero: 1, tipo: "conteudo", linhas: 2, cortaSempre: true }]);
    expect(slidesQueNaoCabem([slideDe("x".repeat(40), "x".repeat(200))])).toEqual([]);
  });

  it("o post de uma imagem cabe no pior caso: texto, linha em branco e chamada", () => {
    const pior = "x".repeat(PostDoChatSchema.shape.texto.maxLength! + TETOS.cta + 2);
    expect(alturaEstimada(pior, tamanhoDoTexto("cta", pior, false))).toBeLessThanOrEqual(ALTURA_TEXTO_SEM_ILUSTRACAO);
  });
});

describe("a previsão de altura conta as quebras de linha", () => {
  it("um texto quebrado ocupa MAIS que o mesmo texto corrido", () => {
    expect(alturaEstimada("x".repeat(50) + "\n" + "x".repeat(50), 40)).toBeGreaterThan(alturaEstimada("x".repeat(100), 40));
  });

  it("cada bloco ocupa ao menos uma linha, e a linha em branco também", () => {
    expect(alturaEstimada(Array(5).fill("ok").join("\n"), 40)).toBe(5 * 40 * 1.32);
    expect(alturaEstimada(["um", "dois", "tres", "quatro", "cinco"].join("\n\n"), 40)).toBe(9 * 40 * 1.32);
  });
});

describe("slidesQueNaoCabem", () => {
  const slide = (texto: string): SlideParaArte[] => [
    { numero: 1, total: 1, tipo: "conteudo", titulo: null, texto, assinaturaNoPe: false },
  ];

  it("silencia quando cabe", () => {
    expect(slidesQueNaoCabem(slide("x".repeat(200)))).toEqual([]);
  });

  it("acusa o que não cabe nem no piso, e distingue 'corta só com o espaço' de 'corta sempre'", () => {
    const dez = Array(10).fill("x".repeat(17)).join("\n");
    expect(slidesQueNaoCabem(slide(dez))).toEqual([{ numero: 1, tipo: "conteudo", linhas: 10, cortaSempre: false }]);
    const trinta = Array(30).fill("x".repeat(17)).join("\n");
    expect(slidesQueNaoCabem(slide(trinta))[0].cortaSempre).toBe(true);
  });

  it("cala no que passou a caber porque a fonte desce um degrau", () => {
    const oito = Array(8).fill("x".repeat(22)).join("\n");
    expect(tamanhoDoTexto("conteudo", oito)).toBe(34);
    expect(slidesQueNaoCabem(slide(oito))).toEqual([]);
  });
});
