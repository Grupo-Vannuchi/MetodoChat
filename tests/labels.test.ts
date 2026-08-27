import { describe, it, expect } from "vitest";
import { eventBadge, eventText } from "@/app/labels";
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
