import { describe, expect, it } from "vitest";
import {
  conferirGerado,
  juntarParte,
  lerRevisaoDoCarrossel,
  outrasGritadas,
  valoresPorCampo,
  type TextoDeCarrossel,
  type TextoDePost,
} from "@/lib/bonus/carrossel-texto";
import { textoDaConferencia, textoDaGritadaSemPalavra } from "@/lib/bonus/carrossel-textos";

// A CONFERÊNCIA DO TEXTO SEM PALAVRA-CHAVE (spec da Etapa 8, "A conferência do texto"): sem palavra, a
// chamada não pode ter NENHUMA palavra gritada (fora as permitidas, como o VENCE do bordão), porque
// um "Comente GUIA" sem automação deixaria quem comentou sem resposta. A legenda fica livre. O Chat
// não confere se a chamada pede a ação escolhida: isso fica com o operador.

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const SEM: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Como vender sem parecer chato",
  gancho: "Você vende como quem pede desculpa?",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Salve este post para reler antes da próxima venda.",
  legenda:
    "Vender não é incomodar. Salve este post e leia de novo antes da próxima conversa com um cliente.",
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: SEM.titulo,
  texto: "T".repeat(80),
  chamada: SEM.chamada,
  legenda: SEM.legenda,
};
const COM_GUIA = "Comente GUIA e receba o roteiro da venda.";

describe("as palavras gritadas, sem palavra-chave", () => {
  it("toda palavra gritada conta, fora as permitidas", () => {
    expect(outrasGritadas("Comente GUIA ou PDF AGORA, e Quem vende, VENCE.", null)).toEqual(["GUIA"]);
  });
});

describe("a conferência do que a IA devolveu, sem palavra-chave", () => {
  it("passa sem a palavra na chamada e na legenda", () => {
    expect(conferirGerado(5, null, SEM)).toBeNull();
    expect(conferirGerado(1, null, POST)).toBeNull();
  });

  it("acusa a chamada com palavra gritada", () => {
    expect(conferirGerado(5, null, { ...SEM, chamada: COM_GUIA })).toEqual({ motivo: "gritada", palavras: ["GUIA"] });
  });

  it("o bordão VENCE pode", () => {
    expect(conferirGerado(5, null, { ...SEM, chamada: "Salve este post. Quem vende, VENCE." })).toBeNull();
  });

  it("a legenda não tem regra de palavra", () => {
    expect(conferirGerado(5, null, { ...SEM, legenda: `${SEM.legenda} Vale a LEITURA.` })).toBeNull();
  });

  it("as regras do formato continuam", () => {
    expect(conferirGerado(6, null, SEM)).toEqual({ motivo: "slides", vieram: 3, esperados: 4 });
    expect(conferirGerado(1, null, SEM)).toEqual({ motivo: "tipo_errado" });
  });

  it("a falha diz o que fazer", () => {
    expect(textoDaConferencia({ motivo: "gritada", palavras: ["GUIA", "ROTEIRO"] }, null)).toBe(
      "A chamada tem GUIA, ROTEIRO em maiúsculas, e este carrossel não tem palavra-chave. Gere de novo."
    );
  });
});

describe("a revisão do operador, sem palavra-chave", () => {
  const bruto = valoresPorCampo(SEM);

  it("aceita a chamada e a legenda sem palavra", () => {
    expect(lerRevisaoDoCarrossel(5, null, SEM.titulo, bruto)).toEqual({ ok: true, texto: SEM });
  });

  it("recusa a chamada com palavra gritada, com o motivo", () => {
    expect(lerRevisaoDoCarrossel(5, null, SEM.titulo, { ...bruto, chamada: COM_GUIA })).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "não pode ter palavra em maiúsculas (GUIA): este carrossel não tem palavra-chave" }],
    });
  });

  it("salvar só a chamada (o último slide) passa pela mesma regra", () => {
    const parte = { tipo: "slide" as const, numero: 5 };
    expect(juntarParte(5, null, SEM, parte, { chamada: COM_GUIA })).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "não pode ter palavra em maiúsculas (GUIA): este carrossel não tem palavra-chave" }],
    });
    const nova = "Siga o perfil para ver a próxima parte.";
    expect(juntarParte(5, null, SEM, parte, { chamada: nova })).toEqual({ ok: true, texto: { ...SEM, chamada: nova }, avisos: [] });
  });

  it("a legenda sem palavra se salva", () => {
    const legenda = "Vender é ajudar quem precisa a decidir. Leia de novo antes da próxima conversa com um cliente.";
    expect(juntarParte(5, null, SEM, { tipo: "legenda" }, { legenda })).toEqual({ ok: true, texto: { ...SEM, legenda }, avisos: [] });
  });
});

describe("o aviso na hora, embaixo da chamada", () => {
  it("diz quais palavras estão gritadas e por que não pode", () => {
    expect(textoDaGritadaSemPalavra(["GUIA"])).toBe(
      "Tem GUIA em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada."
    );
  });
});
