import { describe, it, expect } from "vitest";
import { eventBadge, eventText, oQueDispara } from "@/app/labels";
import { EVENT_TYPES } from "@/lib/event-filters";

// O QUE ESTE ARQUIVO PROTEGE é a tela de Atividade dizendo o que aconteceu.
//
// `app/labels.ts` é a tradução dos nomes internos para a linguagem de quem usa
// o painel, e ela não tinha rede nenhuma: um tipo de evento novo no motor
// aparecia como "Interação" cinza, e um texto legível não mostrado
// simplesmente sumia — sem erro, sem log, sem teste vermelho.

describe("todo tipo filtrável tem rótulo de verdade", () => {
  it("nenhum cai no UNKNOWN", () => {
    // A barra de filtros de /eventos monta os botões a partir de EVENT_TYPES e
    // escreve o rótulo com eventBadge. Um tipo listado lá sem entrada aqui vira
    // um botão escrito "Interação", que não diz nada.
    for (const tipo of EVENT_TYPES) {
      expect(eventBadge(tipo).label, tipo).not.toBe("Interação");
    }
  });

  it("o que ninguém nomeou ainda cai no UNKNOWN, e é esse o padrão", () => {
    expect(eventBadge("tipo_que_o_motor_ainda_vai_inventar").label).toBe("Interação");
  });
});

// ---------------------------------------------------------------------------
// A PORTA DE ENTRADA — o achado que este arquivo nasceu para fechar.
//
// O toque numa pergunta de abertura era gravado como `quick_reply`, cujo
// `eventText` devolve null POR DEFINIÇÃO ("o payload dele é um identificador
// interno"). Resultado: as quatro portas ficavam iguais entre si, iguais aos
// botões de dentro do fluxo, e sem texto — e o número que a fase inteira existe
// para produzir (qual das quatro traz gente) não era legível em lugar nenhum.
// ---------------------------------------------------------------------------
describe("a porta de entrada é distinguível, e traz o texto da pergunta", () => {
  const EVENTO = {
    sender: { id: "918596204654394" },
    recipient: { id: "17841454481842903" },
    postback: { mid: "m1", title: "Quero saber mais", payload: "AUTO:abc" },
  };

  it("tem rótulo próprio, e ele não é o do botão de dentro do fluxo", () => {
    expect(eventBadge("abertura").label).not.toBe(eventBadge("quick_reply").label);
    expect(eventBadge("abertura").label).not.toBe("Interação");
  });

  it("é filtrável em /eventos", () => {
    expect([...EVENT_TYPES]).toContain("abertura");
  });

  it("MOSTRA A PERGUNTA que a pessoa leu — é o `title`, não o `payload`", () => {
    expect(eventText(EVENTO, "abertura")).toBe("Quero saber mais");
    // E nunca o identificador interno: ele não é para os olhos do dono.
    expect(eventText(EVENTO, "abertura")).not.toContain("AUTO:");
  });

  it("duas portas diferentes dão textos diferentes — é o ponto da tela", () => {
    const outra = { postback: { title: "Como funciona?", payload: "AUTO:def" } };
    expect(eventText(outra, "abertura")).toBe("Como funciona?");
    expect(eventText(outra, "abertura")).not.toBe(eventText(EVENTO, "abertura"));
  });

  it("pergunta sem título, ou só com espaço, não vira bolha vazia", () => {
    expect(eventText({ postback: { payload: "AUTO:abc" } }, "abertura")).toBe(null);
    expect(eventText({ postback: { title: "   " } }, "abertura")).toBe(null);
    expect(eventText({}, "abertura")).toBe(null);
    expect(eventText(null, "abertura")).toBe(null);
  });

  it("o `title` só é lido para `abertura` — o resto da tela não muda", () => {
    // Um `quick_reply` continua sem texto, de propósito, e uma mensagem comum
    // continua mostrando o que a pessoa escreveu.
    expect(eventText(EVENTO, "quick_reply")).toBe(null);
    expect(eventText({ message: { text: "quero" } }, "message")).toBe("quero");
    expect(eventText({ text: "comentei" }, "comment")).toBe("comentei");
  });
});

describe("oQueDispara — a coluna da lista de automações", () => {
  // O QUE ESTE BLOCO PROTEGE: a coluna morava dentro do JSX de
  // `list-client.tsx`, e ali era rede zero — a revisão reverteu as duas metades
  // para o `some` que ESCOLHIA e a suíte ficou verde. A suíte não testa
  // componente, e não vai passar a testar; a decisão mudou de lado.

  it("nos três gatilhos de texto, a coluna é a palavra-chave", () => {
    expect(
      oQueDispara({ triggers: ["dm"], keywords: ["promo"], match_type: "contains" })
    ).toBe("promo");
    expect(
      oQueDispara({ triggers: ["comment"], keywords: ["oi", "eu"], match_type: "exact" })
    ).toBe("oi, eu");
  });

  it("com `any` não há palavra a mostrar, e as que sobraram no banco não saem", () => {
    // Aquela automação casa com QUALQUER mensagem; escrever as `keywords`
    // herdadas seria a lista prometendo um filtro que o motor não aplica.
    expect(
      oQueDispara({ triggers: ["dm"], keywords: ["promo", "cupom"], match_type: "any" })
    ).toBe("qualquer texto");
  });

  it("três palavras e o resto CONTADO, porque a linha trunca por CSS", () => {
    const cinco = ["a", "b", "c", "d", "e"];
    expect(oQueDispara({ triggers: ["dm"], keywords: cinco, match_type: "contains" })).toBe(
      "a, b, c +2"
    );
    expect(
      oQueDispara({ triggers: ["dm"], keywords: ["a", "b", "c"], match_type: "contains" })
    ).toBe("a, b, c");
  });

  it("na abertura a coluna diz o que dispara, em vez de ficar vazia", () => {
    // `keywords` é `[]` e `match_type` não é "any": sem esta pergunta o `join`
    // devolvia "" e a linha ficava com o separador e mais nada.
    expect(
      oQueDispara({ triggers: ["abertura"], keywords: [], match_type: "contains" })
    ).toBe("pergunta de abertura");
  });

  it("AS DUAS METADES SAEM JUNTAS, e nenhuma esconde a outra", () => {
    // ESTE É O CASO QUE A VERSÃO ANTIGA ERRAVA: com um `some` escolhendo, a
    // linha `["dm","abertura"]` dizia "pergunta de abertura" e sumia com as
    // palavras do `dm`, que são dado de verdade daquela linha. A tela só
    // escreve um gatilho por automação, mas `triggers` é coluna de array e já
    // teve outros valores.
    expect(
      oQueDispara({ triggers: ["dm", "abertura"], keywords: ["promo"], match_type: "contains" })
    ).toBe("pergunta de abertura · promo");
    expect(
      oQueDispara({ triggers: ["abertura", "dm"], keywords: ["promo"], match_type: "any" })
    ).toBe("pergunta de abertura · qualquer texto");
  });

  it("metade vazia some sozinha, e não deixa separador na ponta", () => {
    expect(
      oQueDispara({ triggers: ["dm"], keywords: [], match_type: "contains" })
    ).toBe("");
    expect(
      oQueDispara({ triggers: ["dm", "abertura"], keywords: [], match_type: "contains" })
    ).toBe("pergunta de abertura");
    expect(oQueDispara({ triggers: [], keywords: ["promo"], match_type: "contains" })).toBe("");
  });

  it("gatilho desconhecido cai na metade das palavras — é `abertura` que é a exceção", () => {
    // MEDIDO, e não deduzido: `gatilhoPedePalavraChave` (lib/steps.ts) é
    // `gatilho !== "abertura"`, então todo gatilho novo entra na metade que
    // MOSTRA palavra-chave. A coluna não reescreve essa pergunta — ela a faz.
    expect(
      oQueDispara({ triggers: ["gatilho_novo"], keywords: ["promo"], match_type: "contains" })
    ).toBe("promo");
    // E um gatilho novo SEM palavra nenhuma sai em branco. É a metade que a
    // função não tem como preencher: quem sabe o que aquele gatilho dispara é
    // `lib/steps.ts`, e enquanto ele não souber, inventar frase aqui seria a
    // lista afirmando sobre um gatilho que o produto ainda não conhece.
    expect(
      oQueDispara({ triggers: ["gatilho_novo"], keywords: [], match_type: "contains" })
    ).toBe("");
  });
});
