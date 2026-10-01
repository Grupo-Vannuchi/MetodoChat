import { describe, expect, it } from "vitest";
import {
  camposDoFormulario,
  conferirGerado,
  deCarrossel,
  dePost,
  lerRevisaoDoCarrossel,
  outrasGritadas,
  temPalavra,
  textoGravado,
  valoresPorCampo,
  type TextoDeCarrossel,
  type TextoDePost,
  type TextoDoCarrossel,
} from "@/lib/bonus/carrossel-texto";

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

describe("a palavra na chamada", () => {
  it("acha a palavra inteira, em maiúsculas", () => {
    expect(temPalavra("Comente SUMIDO aqui", "SUMIDO")).toBe(true);
    expect(temPalavra("SUMIDO!", "SUMIDO")).toBe(true);
  });

  it("não aceita a palavra dentro de outra, nem em minúscula", () => {
    expect(temPalavra("Comente SUMIDOS", "SUMIDO")).toBe(false);
    expect(temPalavra("Comente RESUMIDO", "SUMIDO")).toBe(false);
    expect(temPalavra("Comente sumido", "SUMIDO")).toBe(false);
  });

  it("letra acentuada colada também conta como parte da palavra (achado 46 do auditor)", () => {
    // Um `\b` do JavaScript acharia PROMO dentro de PROMOÇÃO.
    expect(temPalavra("Comente PROMOÇÃO", "PROMO")).toBe(false);
  });
});

describe("outra palavra gritada na chamada", () => {
  it("acha a palavra a mais", () => {
    expect(outrasGritadas("Comente SUMIDO ou GUIA", "SUMIDO")).toEqual(["GUIA"]);
  });

  it("deixa passar as exceções do Labs e o bordão", () => {
    expect(outrasGritadas("Comente SUMIDO e receba o PDF GRÁTIS AGORA. Quem vende, VENCE.", "SUMIDO")).toEqual([]);
  });

  it("número não é palavra-chave", () => {
    expect(outrasGritadas("Comente SUMIDO e receba 100 mensagens em 2026", "SUMIDO")).toEqual([]);
  });

  it("sigla de duas letras não conta, como no Labs", () => {
    expect(outrasGritadas("Comente SUMIDO para usar com IA", "SUMIDO")).toEqual([]);
  });

  it("palavra com acento é uma palavra inteira", () => {
    expect(outrasGritadas("Comente SUMIDO na PROMOÇÃO", "SUMIDO")).toEqual(["PROMOÇÃO"]);
  });
});

describe("a conferência do que a IA devolveu", () => {
  it("passa quando está tudo certo", () => {
    expect(conferirGerado(5, "SUMIDO", CARROSSEL)).toBeNull();
    expect(conferirGerado(1, "SUMIDO", POST)).toBeNull();
  });

  it("acusa o número de slides", () => {
    expect(conferirGerado(6, "SUMIDO", CARROSSEL)).toEqual({ motivo: "slides", vieram: 3, esperados: 4 });
  });

  it("acusa a palavra que faltou, e onde", () => {
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, chamada: "Comente PROMPT e receba as mensagens." })).toEqual({
      motivo: "palavra",
      onde: "chamada",
    });
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, legenda: "L".repeat(100) })).toEqual({
      motivo: "palavra",
      onde: "legenda",
    });
  });

  it("acusa a chamada que pede outra palavra além da do bônus", () => {
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, chamada: "Comente SUMIDO ou GUIA e receba as mensagens." })).toEqual({
      motivo: "outra_palavra",
      palavras: ["GUIA"],
    });
  });

  it("acusa o tipo trocado", () => {
    expect(conferirGerado(1, "SUMIDO", CARROSSEL)).toEqual({ motivo: "tipo_errado" });
    expect(conferirGerado(5, "SUMIDO", POST)).toEqual({ motivo: "tipo_errado" });
  });

  it("na legenda, só a presença da palavra é conferida (achado 49, decisão do Eduardo)", () => {
    const legenda = `${CARROSSEL.legenda} Vale a LEITURA até o fim.`;
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, legenda })).toBeNull();
  });
});

describe("o texto gravado", () => {
  it("o gerado e o revisado voltam do banco com a mesma forma", () => {
    expect(textoGravado(JSON.parse(JSON.stringify(CARROSSEL)))).toEqual(CARROSSEL);
    expect(textoGravado(JSON.parse(JSON.stringify(POST)))).toEqual(POST);
  });

  it.each([null, {}, { tipo: "carrossel" }, { ...POST, tipo: "outro" }])("forma errada é null: %j", (v) => {
    expect(textoGravado(v)).toBeNull();
  });

  it("a saída da IA vira o texto do Chat", () => {
    expect(
      deCarrossel({
        titulo: CARROSSEL.titulo,
        gancho: CARROSSEL.gancho,
        slides: CARROSSEL.slides,
        chamadaParaAcao: CARROSSEL.chamada,
        legenda: CARROSSEL.legenda,
      })
    ).toEqual(CARROSSEL);
    expect(dePost({ titulo: POST.titulo, texto: POST.texto, chamadaParaAcao: POST.chamada, legenda: POST.legenda })).toEqual(
      POST
    );
  });
});

describe("os campos do formulário", () => {
  it("só a chamada e a legenda pedem a palavra, no carrossel e no post (achado 53)", () => {
    for (const total of [1, 2, 5, 10]) {
      expect(
        camposDoFormulario(total)
          .filter((c) => c.pedePalavra)
          .map((c) => c.nome),
        String(total)
      ).toEqual(["chamada", "legenda"]);
    }
  });

  it("carrossel de 5: gancho, 3 slides com título e texto, chamada e legenda", () => {
    expect(camposDoFormulario(5).map((c) => c.nome)).toEqual([
      "gancho",
      "slide_1_titulo",
      "slide_1_texto",
      "slide_2_titulo",
      "slide_2_texto",
      "slide_3_titulo",
      "slide_3_texto",
      "chamada",
      "legenda",
    ]);
  });

  it("post de 1: texto, chamada e legenda", () => {
    expect(camposDoFormulario(1).map((c) => c.nome)).toEqual(["texto", "chamada", "legenda"]);
  });

  it("carrossel de 2: só gancho, chamada e legenda", () => {
    expect(camposDoFormulario(2).map((c) => c.nome)).toEqual(["gancho", "chamada", "legenda"]);
  });

  it("o rótulo diz em que slide o texto vai", () => {
    const campos = camposDoFormulario(5);
    expect(campos.find((c) => c.nome === "slide_1_texto")?.rotulo).toBe("Slide 2: texto");
    expect(campos.find((c) => c.nome === "chamada")?.rotulo).toBe("Chamada (slide 5)");
  });

  it("cada campo abre com o texto certo", () => {
    expect(valoresPorCampo(CARROSSEL)).toEqual({
      gancho: CARROSSEL.gancho,
      slide_1_titulo: "Título do slide 1",
      slide_1_texto: "Texto do slide 1, com mais de trinta caracteres.",
      slide_2_titulo: "Título do slide 2",
      slide_2_texto: "Texto do slide 2, com mais de trinta caracteres.",
      slide_3_titulo: "Título do slide 3",
      slide_3_texto: "Texto do slide 3, com mais de trinta caracteres.",
      chamada: CARROSSEL.chamada,
      legenda: CARROSSEL.legenda,
    });
  });
});

describe("a revisão do operador", () => {
  const bruto = (t: TextoDoCarrossel): Record<string, unknown> => ({ ...valoresPorCampo(t) });

  it("devolve o texto revisado, com o título interno de antes", () => {
    const editado = { ...bruto(CARROSSEL), gancho: "Seu cliente sumiu? Traga ele de volta." };
    expect(lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, editado)).toEqual({
      ok: true,
      texto: { ...CARROSSEL, gancho: "Seu cliente sumiu? Traga ele de volta." },
    });
  });

  it("o \\r\\n do formulário volta a ser \\n antes de contar", () => {
    const comCr = { ...bruto(CARROSSEL), legenda: CARROSSEL.legenda.replace(" Comente", "\r\nComente") };
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, comCr);
    expect(r.ok && r.texto.legenda).toBe(CARROSSEL.legenda.replace(" Comente", "\nComente"));
  });

  it("tirar a palavra da chamada é recusado, com o motivo", () => {
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, {
      ...bruto(CARROSSEL),
      chamada: "Comente PROMPT e receba as mensagens.",
    });
    expect(r).toEqual({ ok: false, problemas: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }] });
  });

  it("pôr outra palavra gritada na chamada é recusado", () => {
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, {
      ...bruto(CARROSSEL),
      chamada: "Comente SUMIDO ou GUIA e receba as mensagens.",
    });
    expect(r).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "pede também GUIA; deixe só a palavra SUMIDO" }],
    });
  });

  it("campo curto ou longo demais é recusado, na ordem da tela", () => {
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, {
      ...bruto(CARROSSEL),
      gancho: "curto",
      slide_2_texto: "x".repeat(301),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.campo)).toEqual(["gancho", "slide_2_texto"]);
  });

  it("campo que falta no formulário conta como vazio", () => {
    const semGancho = bruto(CARROSSEL);
    delete semGancho.gancho;
    expect(lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, semGancho).ok).toBe(false);
  });

  it("o post de 1 volta como post", () => {
    expect(lerRevisaoDoCarrossel(1, "SUMIDO", POST.titulo, bruto(POST))).toEqual({ ok: true, texto: POST });
  });
});
