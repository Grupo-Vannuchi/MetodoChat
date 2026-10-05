import { describe, expect, it } from "vitest";
import { composicaoDoSlide, type LinhaDaArte } from "@/lib/bonus/arte-composicao";
import { ESPACAMENTO_DO_NEGRITO } from "@/lib/bonus/arte-geometria";

// A COMPOSIÇÃO DO SLIDE (spec da Etapa 4, "Dois donos"; a 48.1 e a 48.4 do Labs): as linhas que o
// desenho desenha e a conta mede, com o texto já normalizado. Nenhum dos dois normaliza por conta
// própria, e é isso que impede o aviso de medir um texto e o desenho desenhar outro.

const normal = (texto: string, antes: LinhaDaArte["antes"] = "nada"): LinhaDaArte => ({
  texto,
  negrito: false,
  espacamento: 0,
  antes,
});
const forte = (texto: string, antes: LinhaDaArte["antes"] = "nada"): LinhaDaArte => ({
  texto,
  negrito: true,
  espacamento: ESPACAMENTO_DO_NEGRITO,
  antes,
});

describe("as linhas e o negrito", () => {
  it("o gancho e a chamada, sem manchete e num bloco só, saem inteiros em negrito", () => {
    expect(composicaoDoSlide(null, "Seu cliente sumiu?\nNão é culpa dele.")).toEqual([
      forte("Seu cliente sumiu?"),
      forte("Não é culpa dele."),
    ]);
  });

  it("com manchete, a manchete é negrito, o corpo de um bloco é normal, e o corpo começa depois do avanço da manchete", () => {
    expect(composicaoDoSlide("O primeiro passo", "Responda no mesmo dia.\nMesmo que curto.")).toEqual([
      forte("O primeiro passo"),
      normal("Responda no mesmo dia.", "manchete"),
      normal("Mesmo que curto."),
    ]);
  });

  it("com mais de um bloco, o último é a linha de fechamento, em negrito, depois do intervalo de parágrafo", () => {
    expect(composicaoDoSlide("Manchete", "Um.\nDois.\n\nFechamento.")).toEqual([
      forte("Manchete"),
      normal("Um.", "manchete"),
      normal("Dois."),
      forte("Fechamento.", "paragrafo"),
    ]);
    expect(composicaoDoSlide(null, "Um.\n\nDois.\n\nTrês.")).toEqual([
      normal("Um."),
      normal("Dois.", "paragrafo"),
      forte("Três.", "paragrafo"),
    ]);
  });
});

describe("a normalização, feita uma vez, aqui", () => {
  it("as sete quebras obrigatórias viram \\n: \\r\\n, \\r, \\v, \\f, NEL, U+2028 e U+2029", () => {
    for (const q of ["\r\n", "\r", "\u000B", "\u000C", "\u0085", "\u2028", "\u2029"]) {
      expect(composicaoDoSlide(null, `a${q}b${q}${q}c`), JSON.stringify(q)).toEqual([
        normal("a"),
        normal("b"),
        forte("c", "paragrafo"),
      ]);
    }
  });

  it("espaços e tabs seguidos viram um espaço, e as pontas de cada linha saem", () => {
    expect(composicaoDoSlide(null, "  um \t  dois  \n\t três\t")).toEqual([forte("um dois"), forte("três")]);
  });

  it("a linha só de espaços separa parágrafo, como a linha vazia (antes, desenhava uma linha de 0px)", () => {
    expect(composicaoDoSlide(null, "a\n \t \nb")).toEqual([normal("a"), forte("b", "paragrafo")]);
  });

  it("três ou mais quebras seguidas dão um parágrafo só, e as quebras das pontas somem", () => {
    expect(composicaoDoSlide(null, "\n\n\na\n\n\n\nb\n\n")).toEqual([normal("a"), forte("b", "paragrafo")]);
  });

  it("o acento em NFD vira NFC: o desenho põe o espaçamento do negrito por glifo, e o NFD dá dois glifos", () => {
    const [linha] = composicaoDoSlide(null, "cafe\u0301");
    expect(linha.texto).toBe("café");
    expect(linha.texto).toHaveLength(4);
  });

  it("a manchete perde as quebras, como o desenho de hoje faz com ela, e só de espaços é manchete nenhuma", () => {
    expect(composicaoDoSlide("  Uma\r\nmanchete  ", "Corpo.")[0]).toEqual(forte("Uma manchete"));
    expect(composicaoDoSlide(" \n ", "Corpo.")).toEqual([forte("Corpo.")]);
  });

  it("o espaço sem quebra (U+00A0) do meio fica: ele cola as palavras no desenho", () => {
    expect(composicaoDoSlide(null, "R$\u00A0100")[0].texto).toBe("R$\u00A0100");
  });

  it("um corpo vazio não tem linha", () => {
    expect(composicaoDoSlide(null, " \n\n ")).toEqual([]);
    expect(composicaoDoSlide("Só manchete", "")).toEqual([forte("Só manchete")]);
  });
});
