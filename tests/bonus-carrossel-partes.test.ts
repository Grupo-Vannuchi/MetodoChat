import { describe, expect, it } from "vitest";
import { campoDoAviso } from "@/lib/bonus/arte-cabimento";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import {
  camposDaParte,
  camposDoFormulario,
  juntarParte,
  lerParte,
  type TextoDeCarrossel,
  type TextoDePost,
} from "@/lib/bonus/carrossel-texto";

// AS PARTES DO CARROSSEL (spec da Etapa 4, "Qual campo é o slide N" e "Salvar um slide"). Cada slide
// tem o seu card e o seu "Salvar slide N", e a legenda tem o dela. Uma função só diz quais campos
// formam cada parte, e o salvar junta a parte ao texto salvo e recusa só pelos problemas dela.

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const CARROSSEL: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda:
    "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: "Mensagens para reativar clientes",
  texto: "T".repeat(80),
  chamada: CARROSSEL.chamada,
  legenda: CARROSSEL.legenda,
};
const doSlide = (numero: number) => ({ tipo: "slide" as const, numero });

describe("qual campo é o slide N", () => {
  it.each([
    [1, 1, ["texto", "chamada"]],
    [2, 1, ["gancho"]],
    [2, 2, ["chamada"]],
    [3, 1, ["gancho"]],
    [3, 2, ["slide_1_titulo", "slide_1_texto"]],
    [3, 3, ["chamada"]],
    [10, 1, ["gancho"]],
    [10, 5, ["slide_4_titulo", "slide_4_texto"]],
    [10, 10, ["chamada"]],
  ])("total %i, slide %i: %j", (total, numero, campos) => {
    expect(camposDaParte(total, doSlide(numero))).toEqual(campos);
  });

  it("a legenda é parte própria, e slide fora do carrossel não tem campo", () => {
    expect(camposDaParte(5, { tipo: "legenda" })).toEqual(["legenda"]);
    expect(camposDaParte(5, doSlide(0))).toEqual([]);
    expect(camposDaParte(5, doSlide(6))).toEqual([]);
  });

  it.each([1, 2, 3, 4, 10])("total %i: os slides e a legenda cobrem os campos do formulário, uma vez cada, na ordem", (total) => {
    const partes = [
      ...Array.from({ length: total }, (_, i) => camposDaParte(total, doSlide(i + 1))).flat(),
      ...camposDaParte(total, { tipo: "legenda" }),
    ];
    expect(partes).toEqual(camposDoFormulario(total).map((c) => c.nome));
  });

  it.each([1, 2, 3, 10])("total %i: o aviso do não cabe de cada slide cai num campo daquele slide", (total) => {
    for (let n = 1; n <= total; n++) expect(camposDaParte(total, doSlide(n))).toContain(campoDoAviso(n, total));
  });

  it("os slides da arte são os mesmos: gancho, conteúdo e chamada, na ordem", () => {
    expect(slidesDoTexto(CARROSSEL).map((s) => s.tipo)).toEqual(["gancho", "conteudo", "conteudo", "conteudo", "cta"]);
    expect(slidesDoTexto(POST)).toHaveLength(1);
  });
});

describe("a parte que o formulário diz salvar", () => {
  it.each([
    ["slide_1", doSlide(1)],
    ["slide_5", doSlide(5)],
    ["legenda", { tipo: "legenda" }],
  ])("%s", (bruta, parte) => {
    expect(lerParte(bruta, 5)).toEqual(parte);
  });

  it.each(["slide_0", "slide_6", "slide_01", "slide_x", "gancho", "", null, 3])("recusa %j", (bruta) => {
    expect(lerParte(bruta, 5)).toBeNull();
  });
});

describe("juntar uma parte ao texto salvo", () => {
  it("troca só os campos da parte; o resto vem do texto salvo, mesmo se o formulário trouxer mais", () => {
    const r = juntarParte(5, "SUMIDO", CARROSSEL, doSlide(3), {
      slide_2_titulo: "Outro título do slide",
      slide_2_texto: "Outro texto do slide dois, com mais de trinta.",
      gancho: "isto não entra",
    });
    expect(r).toEqual({
      ok: true,
      texto: {
        ...CARROSSEL,
        slides: [slide(1), { titulo: "Outro título do slide", texto: "Outro texto do slide dois, com mais de trinta." }, slide(3)],
      },
      avisos: [],
    });
  });

  it("recusa pelo problema da parte salva", () => {
    expect(juntarParte(5, "SUMIDO", CARROSSEL, doSlide(5), { chamada: "Comente PROMPT e receba as mensagens." })).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }],
    });
  });

  // Uma regra que mude num deploy pode deixar outro campo inválido no texto salvo. Sem isto, todo
  // "Salvar slide N" seria recusado por causa do outro campo, e sem "salvar tudo" não haveria saída.
  it("um problema em OUTRO campo vira aviso, e não impede o salvar", () => {
    const velho = { ...CARROSSEL, chamada: "Comente PROMPT e receba as mensagens." };
    const gancho = "Seu cliente sumiu? Traga ele de volta.";
    expect(juntarParte(5, "SUMIDO", velho, doSlide(1), { gancho })).toEqual({
      ok: true,
      texto: { ...velho, gancho },
      avisos: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }],
    });
  });

  it("a parte é limpa como no salvar de tudo: o \\r\\n vira \\n, e as pontas saem", () => {
    const r = juntarParte(5, "SUMIDO", CARROSSEL, doSlide(1), { gancho: "  Seu cliente sumiu?\r\nNão é culpa dele.  " });
    expect(r.ok && r.texto.tipo === "carrossel" && r.texto.gancho).toBe("Seu cliente sumiu?\nNão é culpa dele.");
  });

  it("campo da parte que falta no formulário conta como vazio, e é recusado", () => {
    const r = juntarParte(5, "SUMIDO", CARROSSEL, doSlide(1), {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.campo)).toEqual(["gancho"]);
  });

  it("no post, o slide 1 é o texto e a chamada", () => {
    const texto = "U".repeat(90);
    expect(juntarParte(1, "SUMIDO", POST, doSlide(1), { texto, chamada: POST.chamada })).toEqual({
      ok: true,
      texto: { ...POST, texto },
      avisos: [],
    });
  });

  it("a legenda se salva sozinha, e sem a palavra é recusada", () => {
    const legenda = `${CARROSSEL.legenda} Vale para quem sumiu há meses.`;
    expect(juntarParte(5, "SUMIDO", CARROSSEL, { tipo: "legenda" }, { legenda })).toEqual({
      ok: true,
      texto: { ...CARROSSEL, legenda },
      avisos: [],
    });
    expect(juntarParte(5, "SUMIDO", CARROSSEL, { tipo: "legenda" }, { legenda: "x".repeat(100) }).ok).toBe(false);
  });
});
