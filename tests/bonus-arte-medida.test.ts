import { describe, expect, it } from "vitest";
import type { LinhaDaArte } from "@/lib/bonus/arte-composicao";
import { ESPACAMENTO_DO_NEGRITO } from "@/lib/bonus/arte-geometria";
import { larguraDoTexto, medidaDaComposicao, pedacosDaLinha, quebraDaLinha } from "@/lib/bonus/arte-medida";

// A CONTA DO "NÃO CABE" (spec da Etapa 4, "A largura real de cada letra"): a mesma quebra gulosa que o
// Satori faz, com a largura de cada letra tirada da Carlito. Os números esperados aqui vêm da tabela
// (unidades da fonte, 2048 por em) em fontes que dão escala exata em ponto flutuante: 2048px dá
// escala 1, e 128px dá 1/16. Os vetores combinados com o Labs conferem a mesma conta contra o desenho.

const linha = (texto: string, negrito = false, antes: LinhaDaArte["antes"] = "nada"): LinhaDaArte => ({
  texto,
  negrito,
  espacamento: negrito ? ESPACAMENTO_DO_NEGRITO : 0,
  antes,
});

describe("a largura de um texto", () => {
  it("soma o avanço de cada letra, em unidades da fonte vezes a escala", () => {
    expect(larguraDoTexto(" ", 2048, false, 0)).toBe(463);
    expect(larguraDoTexto("MM", 2048, false, 0)).toBe(2 * 1751);
    expect(larguraDoTexto("txyam mmmmm", 128, false, 0)).toBe(860);
  });

  it("o negrito usa a tabela do Bold e tira o espaçamento de cada letra", () => {
    const m = larguraDoTexto("M", 2048, true, 0);
    expect(m).toBeGreaterThan(1751);
    expect(larguraDoTexto("MM", 2048, true, ESPACAMENTO_DO_NEGRITO)).toBeCloseTo(2 * m - 0.8, 9);
  });

  it("o emoji (e todo caractere sem desenho na fonte) vale 1em, sem o espaçamento", () => {
    expect(larguraDoTexto("✅", 50, true, ESPACAMENTO_DO_NEGRITO)).toBe(50);
    expect(larguraDoTexto("❤\uFE0F", 50, false, 0)).toBe(50);
    expect(larguraDoTexto("\u{1F525}", 50, false, 0)).toBe(50);
    expect(larguraDoTexto("a\u{1F525}", 2048, false, 0)).toBe(981 + 2048);
  });
});

describe("os pedaços que a linha pode quebrar", () => {
  it("quebra depois de cada espaço, e o espaço vai com a palavra de antes", () => {
    expect(pedacosDaLinha("um dois três")).toEqual(["um ", "dois ", "três"]);
  });

  // Medido no quebrador do Satori (o do pacote linebreak, dentro do og do Next 16.3.8), em 02/10:
  // em todos os pares de 230 caracteres, só estes quatro casos colam no espaço.
  it("não quebra antes de ! ) , . / : ; ? ] }", () => {
    for (const c of "!),./:;?]}") expect(pedacosDaLinha(`bem ${c} sim`), c).toEqual([`bem ${c} `, "sim"]);
  });

  it("não quebra depois de ( [ { ¡ ¿ „ ‚", () => {
    for (const c of "([{¡¿„‚") expect(pedacosDaLinha(`sim ${c} bem`), c).toEqual(["sim ", `${c} bem`]);
  });

  it("não quebra entre a aspa e o parêntese que abre, nem entre dois travessões", () => {
    expect(pedacosDaLinha("“texto” (nota) fim")).toEqual(["“texto” (nota) ", "fim"]);
    expect(pedacosDaLinha("a — — b")).toEqual(["a ", "— — ", "b"]);
  });

  // O Satori também quebra DENTRO da palavra (depois do hífen entre letras, em volta do travessão e
  // do emoji colados). A conta não: com menos pontos de quebra, ela nunca prevê menos linhas.
  it("o hífen, o travessão e o emoji colados não quebram na conta, que fica do lado seguro", () => {
    expect(pedacosDaLinha("palavra-chave e-mail")).toEqual(["palavra-chave ", "e-mail"]);
    expect(pedacosDaLinha("antes—depois")).toEqual(["antes—depois"]);
  });
});

describe("a quebra gulosa", () => {
  it("a linha que soma exatamente a largura útil cabe, e uma letra a mais desce", () => {
    expect(quebraDaLinha(linha("txyam mmmmm"), 128)).toEqual({ linhas: 1, vaza: false });
    expect(quebraDaLinha(linha("txyam mmmmmn"), 128)).toEqual({ linhas: 2, vaza: false });
  });

  // "txyam mmmmm " soma 860 mais o espaço do fim, e cabe: o espaço do fim da palavra não conta.
  // Contado, "mmmmm" desceria, e a linha de baixo também transbordaria: 3 linhas em vez de 2.
  it("o espaço do fim da última palavra da linha não conta", () => {
    expect(quebraDaLinha(linha("txyam mmmmm txyam mmmmm"), 128)).toEqual({ linhas: 2, vaza: false });
  });

  it("a palavra mais larga que a linha fica numa linha só e vaza pela direita", () => {
    const longa = "m".repeat(20);
    expect(quebraDaLinha(linha(`a ${longa} b`), 128)).toEqual({ linhas: 3, vaza: true });
    expect(quebraDaLinha(linha(longa), 128)).toEqual({ linhas: 1, vaza: true });
  });
});

describe("a altura da composição", () => {
  it("cada linha quebrada ocupa fonte × 1,32 arredondado", () => {
    expect(medidaDaComposicao([linha("Curto", true)], 86)).toEqual({ altura: 114, vaza: false });
    expect(medidaDaComposicao([linha("Um"), linha("Dois")], 34)).toEqual({ altura: 90, vaza: false });
  });

  // O desenho dá à manchete o avanço de 77 até o corpo: a 46px, a linha (61) e o espaço (16).
  it("o corpo começa no avanço da manchete, e o parágrafo seguinte depois de 41", () => {
    const linhas = [linha("Manchete", true), linha("Corpo", false, "manchete"), linha("Fecho", true, "paragrafo")];
    expect(medidaDaComposicao(linhas, 46)).toEqual({ altura: 77 + 61 + 41 + 61, vaza: false });
    expect(medidaDaComposicao(linhas, 86)).toEqual({ altura: 114 + 114 + 41 + 114, vaza: false });
  });

  it("vaza quando alguma linha vaza", () => {
    expect(medidaDaComposicao([linha("ok"), linha("m".repeat(20))], 128).vaza).toBe(true);
  });
});
