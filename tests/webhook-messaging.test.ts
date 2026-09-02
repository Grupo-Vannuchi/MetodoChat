import { describe, it, expect } from "vitest";
import {
  destinoDoMessaging,
  ehSoApagamento,
  ehConhecidoEIgnorado,
  FORMAS_CONHECIDAS_E_IGNORADAS,
  FORMAS_DO_MOTOR,
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

// ============================================================
// PARA QUAL RAMO VAI O ITEM — a rede que faltava, e o defeito que a obrigou.
//
// Esta decisão morava em três linhas da rota do webhook, e a primeira delas era
// a única linha que fazia a PORTA DE ENTRADA existir. Apagar os dois tokens
// `|| postback` de lá deixava tsc, eslint, os 693 puros, a varredura e os 46 de
// integração TODOS VERDES, com o toque em pergunta de abertura morto em
// produção — porque os casos de integração chamam `handleMessagingEvent`
// direto, e o defeito morava uma camada acima deles.
//
// O caso "um postback vai para o motor", abaixo, é o vermelho que faltava.
// ============================================================

describe("para qual ramo vai um item de `messaging`", () => {
  it("uma mensagem comum vai para o MOTOR", () => {
    expect(
      destinoDoMessaging({
        sender: { id: "918596204654394" },
        recipient: { id: "17841454481842903" },
        message: { mid: "m1", text: "quero" },
      })
    ).toBe("motor");
  });

  it("UM POSTBACK VAI PARA O MOTOR — é a porta de entrada, e é o que some calado", () => {
    // Copiado da forma que o experimento de primeiro contato mediu em produção:
    // sem `message`, com `title` (o texto da pergunta) e `payload` (o
    // identificador). Sem este caso, tirar `postback` da decisão passa por
    // todos os gates do projeto.
    expect(
      destinoDoMessaging({
        sender: { id: "918596204654394" },
        recipient: { id: "17841454481842903" },
        postback: { mid: "m1", title: "Quero saber mais", payload: "AUTO:abc" },
      })
    ).toBe("motor");
  });

  it("as duas formas do motor estão nomeadas, e são só duas", () => {
    // Uma forma a mais aqui é um ramo novo do motor, e quem a acrescentar tem de
    // acrescentar o caso junto. Uma forma a menos é uma funcionalidade morta.
    expect([...FORMAS_DO_MOTOR]).toEqual(["message", "postback"]);
  });

  it("confirmação de leitura é IGNORADA — não vira linha e não vai ao motor", () => {
    expect(destinoDoMessaging({ read: { mid: "m1" } })).toBe("ignorar");
    expect(destinoDoMessaging({ message_edit: { mid: "m1", num_edit: 0 } })).toBe("ignorar");
  });

  it("o que não tem nome é REGISTRADO, e é esse o padrão", () => {
    expect(destinoDoMessaging({ referral: { ref: "exp-abertura-digitar" } })).toBe("registrar");
    expect(destinoDoMessaging({ delivery: { mids: ["m1"] } })).toBe("registrar");
    expect(destinoDoMessaging({ message_edit: { mid: "m1", num_edit: 2 } })).toBe("registrar");
    expect(destinoDoMessaging({})).toBe("registrar");
  });

  it("o MOTOR vem primeiro: forma tratada nunca cai no silêncio", () => {
    // Um item que traz as duas coisas ao mesmo tempo é do motor, e não da lista
    // do silêncio. Sem a ordem, escrever `message` na lista das ignoradas um dia
    // desligaria o motor inteiro sem uma linha em lugar nenhum.
    expect(destinoDoMessaging({ read: { mid: "m1" }, message: { mid: "m2", text: "oi" } })).toBe(
      "motor"
    );
    expect(
      destinoDoMessaging({ message_edit: { mid: "m1", num_edit: 0 }, postback: { payload: "AUTO:a" } })
    ).toBe("motor");
  });

  it("campo presente e VAZIO não é forma do motor", () => {
    // Era o teste que a rota fazia (`messaging.message || messaging.postback`), e
    // ele é o certo: um `postback` nulo não tem postback nenhum para o motor ler.
    expect(destinoDoMessaging({ postback: null })).toBe("registrar");
    expect(destinoDoMessaging({ message: undefined, sender: { id: "1" } })).toBe("registrar");
  });

  it("nulo, lista e escalar viram linha em vez de derrubar a rota", () => {
    // A rota fazia `messaging.message` direto: um `null` no meio do array
    // estourava e o item inteiro sumia dentro do `catch`.
    expect(destinoDoMessaging(null)).toBe("registrar");
    expect(destinoDoMessaging(undefined)).toBe("registrar");
    expect(destinoDoMessaging([{ message: { mid: "m" } }])).toBe("registrar");
    expect(destinoDoMessaging("message")).toBe("registrar");
    expect(destinoDoMessaging(7)).toBe("registrar");
  });
});

// ============================================================
// O AVISO DE APAGAMENTO — o defeito que custou dois 403 em produção.
//
// Ele tem `message` verdadeiro, então ia para o motor; o motor o tratou como
// resposta e empurrou `last_reply_at` para a hora do apagamento. A janela de 24h
// passou a contar de um instante em que a pessoa não falou nada.
//
// Os casos abaixo usam o payload CRU de @eng.luishreis, 27/08/2026 às 19:39,
// lido no banco de produção — os dois avisos que fizeram os envios de 28/08
// tomarem 403 (code 10, subcode 2534022).
// ============================================================

// O item exatamente como a Meta o entregou. `mid` inteiro, sem cortar: é ele que
// prova que o aviso não carrega texto nenhum, só a referência.
const APAGAMENTO_REAL = {
  sender: { id: "985206161205789" },
  message: {
    mid: "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAzNDgzMjM0MzM3OjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI2MDIwMjk5MzEzODI1NTA3MDozMjk3ODUxNTg0NzYyODc0MzEwOTUzODA1NjI2ODQxNDk3NgZDZD",
    is_deleted: true,
  },
  recipient: { id: "17841403483234337" },
  timestamp: 1787859579053,
};

describe("apagamento não é mensagem, e por isso não vai ao motor", () => {
  it("O AVISO REAL DE 27/08 NÃO VAI AO MOTOR — é o defeito, e é este o vermelho", () => {
    // Sem esta linha, `last_reply_at` anda para a hora do apagamento e o produto
    // acha que a janela está aberta quando a Meta já a fechou. Medido: os dois
    // envios de 28/08 para @eng.luishreis levaram 403 com a nossa conta
    // marcando 17,6h de janela.
    expect(destinoDoMessaging(APAGAMENTO_REAL)).not.toBe("motor");
  });

  it("o aviso real é reconhecido pelo predicado", () => {
    expect(ehSoApagamento(APAGAMENTO_REAL)).toBe(true);
  });

  it("o aviso REGISTRA: vira linha em Atividade, e o porquê está no arquivo", () => {
    expect(destinoDoMessaging(APAGAMENTO_REAL)).toBe("registrar");
  });

  it("o eco apagado também sai do motor — a conta apagando não é conta enviando", () => {
    // 4 dos 12 apagamentos medidos vieram com `is_echo: true` e viravam
    // `message_sent`, que afirma um envio que não houve.
    expect(
      destinoDoMessaging({
        sender: { id: "17841403483234337" },
        recipient: { id: "985206161205789" },
        message: { mid: "m-eco", is_echo: true, is_deleted: true },
        timestamp: 1787859579053,
      })
    ).toBe("registrar");
  });
});

// O DANO OPOSTO, E ELE É PIOR: um predicado largo demais tira MENSAGEM DE VERDADE
// do motor, e aí a automação inteira para em silêncio. Estes são os casos que
// seguram esse lado.
describe("mensagem de verdade continua indo ao motor", () => {
  it("mensagem comum não tem `is_deleted`, e continua sendo do motor", () => {
    const comum = {
      sender: { id: "985206161205789" },
      recipient: { id: "17841403483234337" },
      message: { mid: "m1", text: "quero" },
      timestamp: 1787859579053,
    };
    expect(ehSoApagamento(comum)).toBe(false);
    expect(destinoDoMessaging(comum)).toBe("motor");
  });

  it("`is_deleted: false` É MENSAGEM DE VERDADE — tirá-la do motor mata o produto", () => {
    const naoApagada = {
      sender: { id: "985206161205789" },
      recipient: { id: "17841403483234337" },
      message: { mid: "m2", text: "quero", is_deleted: false },
      timestamp: 1787859579053,
    };
    expect(ehSoApagamento(naoApagada)).toBe(false);
    expect(destinoDoMessaging(naoApagada)).toBe("motor");
  });

  it("SÓ o booleano `true` é apagamento — foi o que o banco viu, e nada além", () => {
    // Medido em 02/09/2026: `jsonb_typeof` dos 12 é `boolean` nos 12. Uma string
    // `"true"` seria forma NOVA, e este arquivo não trata o que não observou.
    expect(ehSoApagamento({ message: { mid: "m", is_deleted: "true" } })).toBe(false);
    expect(ehSoApagamento({ message: { mid: "m", is_deleted: 1 } })).toBe(false);
    expect(ehSoApagamento({ message: { mid: "m", is_deleted: null } })).toBe(false);
  });

  it("UM POSTBACK SOBREVIVE À MARCA — mesmo trazendo `message` apagada junto", () => {
    // A porta de entrada não pode morrer por causa deste conserto. O toque em
    // pergunta de abertura chega SEM `message`; um item que traga as duas coisas
    // continua sendo do motor, porque tem postback para o motor ler.
    expect(
      ehSoApagamento({
        postback: { mid: "m1", title: "Quero saber mais", payload: "AUTO:abc" },
        message: { mid: "m2", is_deleted: true },
      })
    ).toBe(false);
    expect(
      destinoDoMessaging({
        sender: { id: "918596204654394" },
        postback: { mid: "m1", title: "Quero saber mais", payload: "AUTO:abc" },
        message: { mid: "m2", is_deleted: true },
      })
    ).toBe("motor");
    expect(
      destinoDoMessaging({
        sender: { id: "918596204654394" },
        postback: { mid: "m1", title: "Quero saber mais", payload: "AUTO:abc" },
      })
    ).toBe("motor");
  });

  it("o predicado não quebra com nulo, lista, escalar ou `message` torto", () => {
    expect(ehSoApagamento(null)).toBe(false);
    expect(ehSoApagamento(undefined)).toBe(false);
    expect(ehSoApagamento([{ message: { is_deleted: true } }])).toBe(false);
    expect(ehSoApagamento("is_deleted")).toBe(false);
    expect(ehSoApagamento(7)).toBe(false);
    expect(ehSoApagamento({})).toBe(false);
    expect(ehSoApagamento({ message: null })).toBe(false);
    expect(ehSoApagamento({ message: "apagada" })).toBe(false);
    expect(ehSoApagamento({ read: { mid: "m" } })).toBe(false);
  });
});

// O SOBREVIVENTE DA REVISAO DE 02/09/2026, e a linha que o mata.
//
// Trocar `Boolean(registro[chave])` por `chave in registro` atravessava os
// QUATRO portoes — 1023 puros, integracao, lint e typecheck — e devolvia
// `{postback: null, message:{is_deleted:true}}` ao motor, ou seja, o defeito da
// janela de volta. O arquivo declara a doutrina "presenca COM VALOR" em
// comentario, mas nenhum caso a prendia JUNTO com apagamento.
//
// Alcancabilidade real medida: 0 de 2019 itens do banco tem `postback` nulo.
// E lacuna de teste, nao defeito vivo — e por isso mesmo custa uma linha.
describe("ehSoApagamento na fronteira de presenca-por-valor", () => {
  it("postback NULO nao resgata o apagamento", () => {
    expect(ehSoApagamento({ postback: null, message: { mid: "m", is_deleted: true } })).toBe(true);
  });
  // O OUTRO LADO DA MESMA MOEDA: postback COM VALOR resgata, e tem de resgatar —
  // o toque em pergunta de abertura nao pode morrer por causa deste conserto.
  it("postback COM VALOR tira o item da regra do apagamento", () => {
    expect(
      ehSoApagamento({ postback: { payload: "ABERTURA_x" }, message: { mid: "m", is_deleted: true } })
    ).toBe(false);
  });
});
