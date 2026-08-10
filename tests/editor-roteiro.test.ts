import { describe, it, expect } from "vitest";
import { roteiro, textoDoTempo, type Cena } from "../app/automacoes/editor/roteiro";
import type { Passo } from "../lib/steps";

// Os tipos das bolhas de uma cena, na ordem. É o que quase todo teste daqui
// pergunta — "o que este bloco desenha, e nessa ordem?" — e escrever isso à mão
// em cada `expect` esconderia a pergunta no meio do objeto.
function feitio(cenas: Cena[], i = 0): string[] {
  return cenas[i].itens.map((b) => b.tipo);
}

describe("textoDoTempo", () => {
  it("zero não é erro: é espera que não atrasa nada", () => {
    expect(textoDoTempo(0)).toBe("logo em seguida");
  });

  it("arredonda, porque `conferir` aceita minuto quebrado", () => {
    // `conferir` (lib/steps.ts) só exige número finito não negativo, e o campo
    // do painel produz 0,5 se alguém digitar isso. "0,5 minutos depois" não é
    // frase — e meio minuto arredonda para "logo em seguida", não para 1.
    expect(textoDoTempo(0.4)).toBe("logo em seguida");
    expect(textoDoTempo(1.6)).toBe("2 minutos depois");
  });

  it("concorda o singular", () => {
    expect(textoDoTempo(1)).toBe("1 minuto depois");
    expect(textoDoTempo(60)).toBe("1 hora depois");
  });

  it("passa a contar em horas a partir de 60", () => {
    expect(textoDoTempo(59)).toBe("59 minutos depois");
    expect(textoDoTempo(120)).toBe("2 horas depois");
    expect(textoDoTempo(90)).toBe("1 hora e 30 min depois");
    expect(textoDoTempo(61)).toBe("1 hora e 1 min depois");
  });
});

describe("roteiro — os seis tipos de bloco", () => {
  it("`dm` sem rótulo é um balão só, e a conversa continua", () => {
    const cenas = roteiro([{ tipo: "dm", texto: "Oi!" }] as Passo[]);
    expect(cenas).toEqual([
      { indice: 0, itens: [{ tipo: "balao", texto: "Oi!", botao: null, link: false }] },
    ]);
  });

  it("`dm` com rótulo e sem url é PARADA DURA, e o toque vem depois dela", () => {
    // A cena inteira, e não só a presença da parada: a ordem é o que a prévia
    // promete — a pessoa lê o balão, vê a pílula, e só depois de tocar é que a
    // conversa segue.
    const cenas = roteiro([
      { tipo: "dm", texto: "Quer o link?", botao_label: "Quero!" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Quer o link?", botao: "Quero!", link: false },
      { tipo: "parada", motivo: "toque" },
      { tipo: "resposta", texto: "Quero!" },
    ]);
  });

  it("`dm` com url é botão de link, e NÃO para o fluxo", () => {
    const cenas = roteiro([
      { tipo: "dm", texto: "Aqui está", botao_label: "Abrir", url: "https://x.com" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Aqui está", botao: "Abrir", link: true },
    ]);
  });

  it("`pedir_follow` é balão, parada de follow e o toque no botão", () => {
    const cenas = roteiro([
      { tipo: "pedir_follow", texto: "Me segue lá 🙏", botao_label: "Já sigo! ✅" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Me segue lá 🙏", botao: "Já sigo! ✅", link: false },
      { tipo: "parada", motivo: "follow" },
      { tipo: "resposta", texto: "Já sigo! ✅" },
    ]);
  });

  it("`pedir_email` é balão sem botão, parada de e-mail e o endereço de exemplo", () => {
    const cenas = roteiro([{ tipo: "pedir_email", texto: "Seu e-mail?" }] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Seu e-mail?", botao: null, link: false },
      { tipo: "parada", motivo: "email" },
      { tipo: "resposta", texto: "ana@email.com" },
    ]);
  });

  it("`esperar` NÃO é mensagem: é marca de tempo", () => {
    const cenas = roteiro([{ tipo: "esperar", minutos: 5 }] as Passo[]);
    expect(cenas[0].itens).toEqual([{ tipo: "tempo", texto: "5 minutos depois" }]);
  });

  it("`resposta_publica` e `reagir_story` não viram balão", () => {
    const cenas = roteiro([
      { tipo: "resposta_publica", textos: ["Te mandei no direct! 📩"] },
      { tipo: "reagir_story", emoji: "❤️" },
    ] as Passo[]);
    expect(feitio(cenas, 0)).toEqual(["publica"]);
    expect(feitio(cenas, 1)).toEqual(["reacao"]);
  });
});

describe("roteiro — as paradas", () => {
  // O CASO QUE ESTA PRÉVIA EXISTE PARA MOSTRAR, e o defeito que esta base já
  // teve: um bloco de link SEM ENDEREÇO (`url: ""` com rótulo) é enviado pelo
  // motor como RESPOSTA RÁPIDA — `enfileirarPasso` (lib/engine.ts) decide por
  // `Boolean(botao_label) && !url` — e o fluxo para nele para sempre,
  // esperando o toque num botão que não leva a lugar nenhum.
  //
  // Desenhá-lo como botão de link seria a prévia escondendo exatamente a coisa
  // que ela deveria denunciar.
  it("link SEM ENDEREÇO aparece como parada dura, não como botão de link", () => {
    const cenas = roteiro([
      { tipo: "dm", texto: "Aqui está o seu link!", botao_label: "Abrir link", url: "" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Aqui está o seu link!", botao: "Abrir link", link: false },
      { tipo: "parada", motivo: "toque" },
      { tipo: "resposta", texto: "Abrir link" },
    ]);
  });

  it("`url: \"\"` SEM rótulo é mensagem comum: não há botão, logo não há parada", () => {
    // `esperaResposta` exige o rótulo, e o motor manda texto puro. Marcar
    // parada aqui acusaria de travar o fluxo um bloco por onde o fluxo passa.
    const cenas = roteiro([{ tipo: "dm", texto: "Oi", botao_label: "", url: "" }] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Oi", botao: null, link: false },
    ]);
  });

  it("a lista continua DEPOIS da parada dura, e a parada fica visível", () => {
    // Esconder a cauda depois da primeira parada apagaria metade da lista mais
    // comum que existe — a que começa com a boas-vindas de resposta rápida.
    const cenas = roteiro([
      { tipo: "dm", texto: "Quer?", botao_label: "Quero!" },
      { tipo: "dm", texto: "Toma o link", url: "https://x.com", botao_label: "Abrir" },
    ] as Passo[]);
    expect(cenas).toHaveLength(2);
    expect(feitio(cenas, 0)).toEqual(["balao", "parada", "resposta"]);
    expect(feitio(cenas, 1)).toEqual(["balao"]);
  });

  it("duas paradas duras seguidas marcam as duas", () => {
    const cenas = roteiro([
      { tipo: "dm", texto: "Um", botao_label: "A" },
      { tipo: "dm", texto: "Dois", botao_label: "B" },
    ] as Passo[]);
    expect(feitio(cenas, 0)).toEqual(["balao", "parada", "resposta"]);
    expect(feitio(cenas, 1)).toEqual(["balao", "parada", "resposta"]);
  });
});

describe("roteiro — rótulo em branco", () => {
  // `conferir` (lib/steps.ts) exige o TEXTO, nunca o rótulo do botão. Um rótulo
  // vazio é bloco VÁLIDO, e desenhar uma pílula em branco esconderia isso.
  it("`pedir_follow` sem rótulo cai no padrão da paleta", () => {
    const cenas = roteiro([
      { tipo: "pedir_follow", texto: "Me segue", botao_label: "" },
    ] as Passo[]);
    expect(cenas[0].itens[0]).toEqual({
      tipo: "balao",
      texto: "Me segue",
      botao: "Já sigo! ✅",
      link: false,
    });
  });

  it("botão de link sem rótulo cai em “Abrir link”", () => {
    const cenas = roteiro([
      { tipo: "dm", texto: "Toma", botao_label: "", url: "https://x.com" },
    ] as Passo[]);
    expect(cenas[0].itens[0]).toEqual({
      tipo: "balao",
      texto: "Toma",
      botao: "Abrir link",
      link: true,
    });
  });
});

describe("roteiro — resposta pública", () => {
  it("mostra a PRIMEIRA variação com texto, não a primeira linha", () => {
    // O painel guarda as linhas em branco de propósito — sem elas não dá para
    // digitar a segunda variação —, então `textos[0]` é "" com frequência.
    const cenas = roteiro([
      { tipo: "resposta_publica", textos: ["", "Te mandei! 📩", "Olha o direct"] },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "publica", texto: "Te mandei! 📩", variacoes: 3 },
    ]);
  });

  it("todas em branco não inventam texto — e a contagem continua honesta", () => {
    // Esta lista é ERRO em `conferirLista` (o motor sorteia e desiste), mas
    // `conferir` a aceita, então ela chega aqui como bloco válido.
    const cenas = roteiro([{ tipo: "resposta_publica", textos: ["", " "] }] as Passo[]);
    expect(cenas[0].itens).toEqual([{ tipo: "publica", texto: "", variacoes: 2 }]);
  });
});

describe("roteiro — bloco que não é enviado", () => {
  it("bloco inválido vira `incompleto`, nunca balão", () => {
    // `interpretar` (lib/steps.ts) IGNORA este bloco: ele nunca é enviado.
    // Desenhá-lo como mensagem seria a prévia prometendo um envio que não
    // acontece — a falha mais silenciosa que existe aqui.
    const cenas = roteiro([{ tipo: "dm", texto: "   " }] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "incompleto", mensagem: "Esta mensagem está sem texto." },
    ]);
  });

  it("a mensagem é a do DONO, sem nome de tipo interno", () => {
    const cenas = roteiro([{ tipo: "pedir_email", texto: "" }] as Passo[]);
    expect(cenas[0].itens[0]).toEqual({
      tipo: "incompleto",
      mensagem: "Este pedido de e-mail está sem texto.",
    });
  });

  it("tipo desconhecido também não vira mensagem", () => {
    const cenas = roteiro([{ tipo: "ramificar" }]);
    expect(feitio(cenas, 0)).toEqual(["incompleto"]);
  });

  it("o bloco inválido NÃO desloca o índice dos outros", () => {
    // O índice é o que liga a cena ao bloco selecionado no quadro. Pulando o
    // inválido, o destaque cairia no bloco errado a partir dele.
    const cenas = roteiro([
      { tipo: "dm", texto: "Um" },
      { tipo: "dm", texto: "" },
      { tipo: "dm", texto: "Três" },
    ] as Passo[]);
    expect(cenas.map((c) => c.indice)).toEqual([0, 1, 2]);
    expect(feitio(cenas, 1)).toEqual(["incompleto"]);
  });
});

describe("roteiro — o que não pode quebrar a tela", () => {
  it("lista vazia devolve roteiro vazio", () => {
    expect(roteiro([])).toEqual([]);
  });

  it("o que não é lista devolve roteiro vazio", () => {
    // A lista também chega do banco, onde ela é `unknown` e nada confere o tipo
    // em runtime — o mesmo motivo pelo qual `interpretar` se defende disso.
    expect(roteiro(null)).toEqual([]);
    expect(roteiro(undefined)).toEqual([]);
    expect(roteiro("dm")).toEqual([]);
    expect(roteiro({ tipo: "dm" })).toEqual([]);
  });

  it("lista só com bloco corrompido não desenha mensagem nenhuma", () => {
    const cenas = roteiro([null, 7]);
    expect(cenas.map((c) => c.itens.map((b) => b.tipo))).toEqual([
      ["incompleto"],
      ["incompleto"],
    ]);
  });
});
