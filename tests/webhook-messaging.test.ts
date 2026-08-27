import { describe, it, expect } from "vitest";
import {
  ehConhecidoEIgnorado,
  FORMAS_CONHECIDAS_E_IGNORADAS,
} from "@/lib/webhook-messaging";

// O que este arquivo protege é uma ASSIMETRIA, e ela é o ponto inteiro da
// mudança: o silêncio vale só para as formas escritas à mão, uma a uma, depois
// de vistas no banco. Tudo o mais — inclusive o que ninguém nomeou ainda —
// continua virando linha em Atividade.
//
// Se um dia alguém alargar a lista com o catálogo da Meta para "ficar
// completo", o caso "forma nunca vista continua registrando" fica vermelho, e é
// exatamente o aviso que se quer.

describe("o que é conhecido e ignorado de propósito", () => {
  it("reconhece a confirmação de leitura — a forma medida no banco", () => {
    // Copiado do payload cru gravado em produção em 26/08/2026.
    expect(
      ehConhecidoEIgnorado({
        read: { mid: "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQx" },
        sender: { id: "1264753011158221" },
        recipient: { id: "17841403483234337" },
        timestamp: 1787762157610,
      })
    ).toBe(true);
  });

  it("a lista é curta e cada entrada diz quando foi observada", () => {
    // Uma entrada sem data é uma entrada que veio da documentação, e não da
    // medição — que é o erro que este arquivo existe para impedir.
    for (const forma of FORMAS_CONHECIDAS_E_IGNORADAS) {
      expect(forma.observado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(forma.porque.length).toBeGreaterThan(10);
    }
  });
});

describe("o que continua virando evento — o valor da mudança", () => {
  it("um referral não é conhecido: é o que o experimento está esperando", () => {
    expect(
      ehConhecidoEIgnorado({
        sender: { id: "918596204654394" },
        recipient: { id: "17841454481842903" },
        timestamp: 1787762157610,
        referral: { ref: "exp-abertura-digitar", source: "IG_ME", type: "OPEN_THREAD" },
      })
    ).toBe(false);
  });

  it("um postback não é conhecido: é o outro caminho do experimento", () => {
    expect(
      ehConhecidoEIgnorado({
        sender: { id: "918596204654394" },
        recipient: { id: "17841454481842903" },
        postback: {
          mid: "m1",
          title: "Como funciona?",
          payload: "abertura-como-funciona",
          referral: { ref: "exp-abertura-toque", source: "IG_ME", type: "OPEN_THREAD" },
        },
      })
    ).toBe(false);
  });

  it("uma forma NUNCA VISTA continua registrando, e é essa a regra", () => {
    // `delivery` e `reaction` existem na documentação da Meta e este banco
    // nunca os viu. Enquanto não vir, eles têm de aparecer em Atividade.
    expect(ehConhecidoEIgnorado({ delivery: { mids: ["m1"] } })).toBe(false);
    expect(ehConhecidoEIgnorado({ reaction: { emoji: "❤️" } })).toBe(false);
    expect(ehConhecidoEIgnorado({ campo_que_a_meta_ainda_vai_inventar: 1 })).toBe(false);
  });

  it("um item vazio registra: ausência de forma não é forma conhecida", () => {
    expect(ehConhecidoEIgnorado({})).toBe(false);
  });
});

describe("o que chega é JSON da Meta, e a única garantia é a assinatura", () => {
  it("não quebra com nulo, lista ou escalar", () => {
    expect(ehConhecidoEIgnorado(null)).toBe(false);
    expect(ehConhecidoEIgnorado(undefined)).toBe(false);
    expect(ehConhecidoEIgnorado([{ read: { mid: "m" } }])).toBe(false);
    expect(ehConhecidoEIgnorado("read")).toBe(false);
    expect(ehConhecidoEIgnorado(7)).toBe(false);
  });
});

// A METADE QUE NÃO SE IGNORA.
//
// `message_edit` acompanha toda mensagem comum com `num_edit: 0` — 6 linhas em 6
// horas, contra 226 eventos, medidas em 26/08/2026. Isso é ruído.
//
// Mas `num_edit` maior que zero é outra coisa: a pessoa MUDOU o texto depois de
// mandá-lo, e o motor pode já ter agido sobre o original. Ignorar a forma
// inteira trocaria ruído por cegueira, e é isto que estes casos seguram.
describe("message_edit: ruído quando num_edit é 0, notícia quando não é", () => {
  it("num_edit 0 é ignorado — é o companheiro silencioso de uma mensagem comum", () => {
    expect(ehConhecidoEIgnorado({ message_edit: { mid: "m1", num_edit: 0 } })).toBe(true);
  });

  it("num_edit MAIOR QUE ZERO registra: houve edição de verdade", () => {
    expect(ehConhecidoEIgnorado({ message_edit: { mid: "m1", num_edit: 1 } })).toBe(false);
    expect(ehConhecidoEIgnorado({ message_edit: { mid: "m1", num_edit: 7 } })).toBe(false);
  });

  it("forma sem num_edit registra: o recorte não vale para o que não se reconhece", () => {
    expect(ehConhecidoEIgnorado({ message_edit: { mid: "m1" } })).toBe(false);
    expect(ehConhecidoEIgnorado({ message_edit: null })).toBe(false);
    expect(ehConhecidoEIgnorado({ message_edit: "editado" })).toBe(false);
  });

  it("`read` continua valendo para a forma inteira — lá não há metade que interesse", () => {
    expect(ehConhecidoEIgnorado({ read: { mid: "m1" } })).toBe(true);
    expect(ehConhecidoEIgnorado({ read: {} })).toBe(true);
  });
});
