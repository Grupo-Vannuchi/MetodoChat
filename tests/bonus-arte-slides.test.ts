import { describe, expect, it } from "vitest";
import {
  slidesDoTexto,
  slidesQueNaoCabem,
  tamanhoDoSlide,
  type SlideParaArte,
  type TipoDeSlide,
} from "@/lib/bonus/arte-slides";
import { CarrosselDoChatSchema, PostDoChatSchema, SlideSchema } from "@/lib/bonus/carrossel-schema";
import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";

// OS TESTES DOS SLIDES DA ARTE, vindos do Labs (site-ia, src/lib/ia/slides.test.ts, 45bc973) e
// adaptados à forma do texto do Chat (carrossel-texto.ts). A escolha da fonte e o "não cabe" medem a
// composição com a conta exata (Etapa 4): os números daqui são os da conta, e os vetores combinados
// com o Labs (tests/bonus-arte-vetores.test.ts) conferem a conta contra o desenho.

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

// Textos de palavras de verdade: a conta quebra por palavra, e "x".repeat(200) seria uma palavra só,
// mais larga que a linha em qualquer degrau.
const PALAVRAS =
  "mande uma mensagem curta para o cliente que sumiu e lembre do que ele comprou na última vez porque quem some ainda pode voltar se a conversa certa chegar".split(
    " "
  );
/** As palavras em ordem, até `n` caracteres sem cortar palavra. */
function textoDe(n: number, caixaAlta = false): string {
  const ps: string[] = [];
  while (`${ps.join(" ")} ${PALAVRAS[ps.length % PALAVRAS.length]}`.trim().length <= n) ps.push(PALAVRAS[ps.length % PALAVRAS.length]);
  const t = ps.join(" ");
  return caixaAlta ? t.toUpperCase() : t;
}
const slide = (tipo: TipoDeSlide, texto: string, titulo: string | null = null): SlideParaArte => ({
  numero: 2,
  total: 3,
  tipo,
  titulo,
  texto,
  assinaturaNoPe: tipo === "cta",
});
const fonte = (s: SlideParaArte, comIlustracao = true) => tamanhoDoSlide(s, comIlustracao).fonte;

describe("tamanhoDoSlide", () => {
  it("nunca cresce conforme o texto cresce, e desce quando precisa", () => {
    const tamanhos = [40, 100, 200, 260, 300].map((n) => fonte(slide("conteudo", textoDe(n))));
    for (let i = 1; i < tamanhos.length; i++) {
      expect(tamanhos[i], `${i}: cresceu com texto maior`).toBeLessThanOrEqual(tamanhos[i - 1]);
    }
    expect(tamanhos[tamanhos.length - 1]).toBeLessThan(tamanhos[0]);
  });

  it("o gancho é sempre maior que o conteúdo do mesmo texto", () => {
    for (const n of [20, 60, 110]) {
      const t = textoDe(n);
      expect(fonte(slide("gancho", t))).toBeGreaterThan(fonte(slide("conteudo", t)));
    }
  });

  it("nunca desce abaixo de 34px, e no piso diz que não cabe", () => {
    for (const tipo of ["gancho", "conteudo", "cta"] as const) {
      expect(tamanhoDoSlide(slide(tipo, textoDe(900)), true)).toEqual({ fonte: 34, cabe: false });
    }
  });

  it("cresce sem o espaço da imagem, nos três tipos, sem fração de pixel", () => {
    for (const tipo of ["gancho", "conteudo", "cta"] as const) {
      const t = textoDe(50);
      expect(fonte(slide(tipo, t), false)).toBeGreaterThan(fonte(slide(tipo, t), true));
      expect(Number.isInteger(fonte(slide(tipo, t), false))).toBe(true);
    }
  });

  // O CONTRAPESO da descida: ela só pode ser acionada por quem NÃO CABE. Sem este caso, devolver
  // sempre o piso passaria em todos os outros.
  it("a descida não encolhe texto que já cabia", () => {
    expect(fonte(slide("gancho", textoDe(20, true)))).toBe(86);
    expect(fonte(slide("conteudo", textoDe(60)))).toBe(46);
    expect(fonte(slide("cta", textoDe(70, true)))).toBe(60);
  });

  // As capas que o Labs desenhou na comparação de 02/10 (site-ia-83): a de 109 caracteres cabe em 56 e
  // tem de continuar lá; a de 120 só cabe no degrau de 46, que entrou nesta etapa (sem ele, ia ao piso).
  it("o gancho longo desce para o degrau de 46, e a capa de 109 continua em 56", () => {
    const capa = "VOCÊ ESTÁ PERDENDO CLIENTES TODOS OS DIAS POR CAUSA DE UM ERRO QUE QUASE NINGUÉM PERCEBE NA HORA DE RESPONDER";
    expect(tamanhoDoSlide(slide("gancho", capa), true)).toEqual({ fonte: 56, cabe: true });
    expect(tamanhoDoSlide(slide("gancho", `${capa} O WHATSAPP`), true)).toEqual({ fonte: 46, cabe: true });
  });

  // A arte não pede `wordBreak`: a palavra mais larga que a linha vaza pela direita. O degrau em que
  // isso acontece não cabe, mesmo que a altura caiba.
  it("o degrau em que uma palavra vaza pela direita não cabe", () => {
    const url = "Pegue em https://metodolabs.com.br/bonus/planilha-de-precificacao";
    expect(tamanhoDoSlide(slide("gancho", url), true)).toEqual({ fonte: 34, cabe: true });
  });
});

// A MANCHETE CONTA, e conta como o desenho a desenha: o corpo começa 77px abaixo do topo dela.
describe("a manchete", () => {
  it("o mesmo corpo que cabe sozinho deixa de caber com uma manchete", () => {
    const sete = Array(7).fill("mande uma mensagem curta").join("\n");
    expect(tamanhoDoSlide(slide("conteudo", sete), true)).toEqual({ fonte: 34, cabe: true });
    expect(tamanhoDoSlide(slide("conteudo", sete, "O que fazer primeiro"), true)).toEqual({ fonte: 34, cabe: false });
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

  it("o gancho e a chamada cabem nos dois modos no teto do schema, em caixa alta", () => {
    for (const tipo of ["gancho", "cta"] as const) {
      for (const comIlustracao of [true, false]) {
        expect(tamanhoDoSlide(slide(tipo, textoDe(TETOS[tipo], true)), comIlustracao).cabe, `${tipo} ${comIlustracao}`).toBe(true);
      }
    }
  });

  // Com a manchete medida, o slide de conteúdo no PIOR caso do schema (manchete de 70 e corpo de 300,
  // em caixa alta) não cabe em modo nenhum. O aviso existe para isto, e diz "corta sempre": o operador
  // encurta. Um slide do tamanho que a instrução pede cabe com o espaço.
  it("o conteúdo no pior caso do schema é acusado como 'corta sempre', e o tamanho comum cabe com o espaço", () => {
    const pior = slide("conteudo", textoDe(TETOS.conteudo, true), textoDe(TITULO_MAX, true));
    expect(slidesQueNaoCabem([pior])).toEqual([{ numero: 1, tipo: "conteudo", cortaSempre: true }]);
    expect(slidesQueNaoCabem([slide("conteudo", textoDe(200), textoDe(40))])).toEqual([]);
  });

  // O post de uma imagem: texto, linha em branco e chamada. No teto do schema em caixa alta ele não
  // cabe nem sem o espaço, e o aviso diz; em texto corrido, cabe sem o espaço.
  it("o post no teto do schema cabe sem o espaço em texto corrido, e em caixa alta é acusado", () => {
    const post = (caixaAlta: boolean): SlideParaArte => ({
      numero: 1,
      total: 1,
      tipo: "cta",
      titulo: null,
      texto: `${textoDe(PostDoChatSchema.shape.texto.maxLength!, caixaAlta)}\n\n${textoDe(TETOS.cta, caixaAlta)}`,
      assinaturaNoPe: false,
    });
    expect(tamanhoDoSlide(post(false), false).cabe).toBe(true);
    expect(slidesQueNaoCabem([post(true)])).toEqual([{ numero: 1, tipo: "cta", cortaSempre: true }]);
  });
});

describe("slidesQueNaoCabem", () => {
  const um = (texto: string): SlideParaArte[] => [
    { numero: 1, total: 1, tipo: "conteudo", titulo: null, texto, assinaturaNoPe: false },
  ];

  it("silencia quando cabe", () => {
    expect(slidesQueNaoCabem(um(textoDe(200)))).toEqual([]);
  });

  // No piso, com o espaço, cabem 7 linhas (7 × 45 = 315 de 334); a 8ª já não.
  it("acusa o que não cabe nem no piso, e distingue 'corta só com o espaço' de 'corta sempre'", () => {
    const oito = Array(8).fill("x".repeat(20)).join("\n");
    expect(slidesQueNaoCabem(um(oito))).toEqual([{ numero: 1, tipo: "conteudo", cortaSempre: false }]);
    const trinta = Array(30).fill("x".repeat(17)).join("\n");
    expect(slidesQueNaoCabem(um(trinta))[0].cortaSempre).toBe(true);
  });

  it("cala no que passou a caber porque a fonte desce um degrau", () => {
    const sete = Array(7).fill("x".repeat(22)).join("\n");
    expect(fonte(um(sete)[0])).toBe(34);
    expect(slidesQueNaoCabem(um(sete))).toEqual([]);
  });
});
