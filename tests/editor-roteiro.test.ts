import { describe, it, expect } from "vitest";
import { roteiro, textoDoTempo, type Cena } from "../app/automacoes/editor/roteiro";
import type { Passo } from "../lib/steps";

// Os tipos das bolhas de uma cena, na ordem. É o que quase todo teste daqui
// pergunta — "o que este bloco desenha, e nessa ordem?" — e escrever isso à mão
// em cada `expect` esconderia a pergunta no meio do objeto.
function feitio(cenas: Cena[], i = 0): string[] {
  return cenas[i].itens.map((b) => b.tipo);
}

// O gatilho é obrigatório em `roteiro`, e de propósito (o motivo está lá). Aqui
// o padrão é `dm` porque é o gatilho em que os quatro tipos de DM rodam sem
// ressalva — os testes que perguntam sobre gatilho passam o seu.
function cenasDe(passos: unknown, gatilho = "dm"): Cena[] {
  return roteiro(passos, gatilho);
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
    const cenas = cenasDe([{ tipo: "dm", texto: "Oi!" }] as Passo[]);
    expect(cenas).toEqual([
      { indice: 0, itens: [{ tipo: "balao", texto: "Oi!", botao: null, link: false }] },
    ]);
  });

  it("`dm` com rótulo e sem url é PARADA DURA, e o toque vem depois dela", () => {
    // A cena inteira, e não só a presença da parada: a ordem é o que a prévia
    // promete — a pessoa lê o balão, vê a pílula, e só depois de tocar é que a
    // conversa segue.
    const cenas = cenasDe([
      { tipo: "dm", texto: "Quer o link?", botao_label: "Quero!" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Quer o link?", botao: "Quero!", link: false },
      { tipo: "parada", motivo: "toque" },
      { tipo: "resposta", texto: "Quero!" },
    ]);
  });

  it("`dm` com url é botão de link, e NÃO para o fluxo", () => {
    const cenas = cenasDe([
      { tipo: "dm", texto: "Aqui está", botao_label: "Abrir", url: "https://x.com" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Aqui está", botao: "Abrir", link: true },
    ]);
  });

  it("`pedir_follow` é balão, parada de follow e o toque no botão", () => {
    const cenas = cenasDe([
      { tipo: "pedir_follow", texto: "Me segue lá 🙏", botao_label: "Já sigo! ✅" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Me segue lá 🙏", botao: "Já sigo! ✅", link: false },
      { tipo: "parada", motivo: "follow" },
      { tipo: "resposta", texto: "Já sigo! ✅" },
    ]);
  });

  it("`pedir_email` é balão sem botão, parada de e-mail e o endereço de exemplo", () => {
    const cenas = cenasDe([{ tipo: "pedir_email", texto: "Seu e-mail?" }] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Seu e-mail?", botao: null, link: false },
      { tipo: "parada", motivo: "email" },
      { tipo: "resposta", texto: "ana@email.com" },
    ]);
  });

  it("`esperar` NÃO é mensagem: é marca de tempo", () => {
    const cenas = cenasDe([{ tipo: "esperar", minutos: 5 }] as Passo[]);
    expect(cenas[0].itens).toEqual([{ tipo: "tempo", texto: "5 minutos depois" }]);
  });

  it("`resposta_publica` e `reagir_story` não viram balão", () => {
    const cenas = cenasDe([
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
  // motor como RESPOSTA RÁPIDA — `envioDaDm` (lib/steps.ts) decide isso, e
  // `enfileirarPasso` (lib/engine.ts) pergunta a ela — e o fluxo para nele para
  // sempre, esperando o toque num botão que não leva a lugar nenhum.
  //
  // Desenhá-lo como botão de link seria a prévia escondendo exatamente a coisa
  // que ela deveria denunciar.
  it("link SEM ENDEREÇO aparece como parada dura, não como botão de link", () => {
    const cenas = cenasDe([
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
    const cenas = cenasDe([{ tipo: "dm", texto: "Oi", botao_label: "", url: "" }] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Oi", botao: null, link: false },
    ]);
  });

  it("a lista continua DEPOIS da parada dura, e a parada fica visível", () => {
    // Esconder a cauda depois da primeira parada apagaria metade da lista mais
    // comum que existe — a que começa com a boas-vindas de resposta rápida.
    const cenas = cenasDe([
      { tipo: "dm", texto: "Quer?", botao_label: "Quero!" },
      { tipo: "dm", texto: "Toma o link", url: "https://x.com", botao_label: "Abrir" },
    ] as Passo[]);
    expect(cenas).toHaveLength(2);
    expect(feitio(cenas, 0)).toEqual(["balao", "parada", "resposta"]);
    expect(feitio(cenas, 1)).toEqual(["balao"]);
  });

  it("bloco de `botoes` sem rótulo não desenha botão nem parada", () => {
    // A prévia afirmava `passo.botao_label!` no ramo da parada, e a asserção
    // ficou FALSA no dia em que `esperaResposta` passou a dizer sim a um `dm`
    // com `botoes`: um bloco assim não tem rótulo nenhum, e o `!` escondia isso
    // do `tsc`. A prévia teria desenhado uma pílula `undefined` e uma parada
    // sobre uma mensagem que o motor manda como texto puro.
    //
    // Hoje as duas perguntas — o que sai e onde para — são a mesma
    // (`envioDaDm`, lib/steps.ts), e a cena mostra um balão sem botão.
    //
    // ESTA CENA NÃO MUDOU SOZINHA NA TAREFA 4, e a frase que dizia que mudaria
    // ficou aqui depois de MEDIDA COMO FALSA — quem pegar a Tarefa 8 lê esta
    // linha, não o relatório de outra tarefa. O motor passou a entregar os dois
    // botões e a parar no menu; esta cena continuou idêntica porque
    // `roteiro.ts` não tem ramo para `envio.forma === "botoes"` — ele só trata
    // `"resposta_rapida"` e `"link"`, e um menu cai no `else` de texto puro.
    // Ou seja: a prévia hoje MENTE sobre este bloco, desenhando como mensagem
    // solta uma parada que o motor executa.
    //
    // QUEM FECHA ISSO É A TAREFA 8 (docs/plans/2026-08-11-ramificacao.md, Passo
    // 4 — "a prévia mostra o botão escolhido"), e é ela que vai reescrever as
    // asserções abaixo. Até lá elas fixam o que a prévia realmente faz, para a
    // divergência não sumir de vista.
    const cenas = cenasDe([
      {
        tipo: "dm",
        texto: "Qual?",
        botoes: [
          { id: "op_aaaaaa", rotulo: "A" },
          { id: "op_bbbbbb", rotulo: "B" },
        ],
      },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([{ tipo: "balao", texto: "Qual?", botao: null, link: false }]);
  });

  it("duas paradas duras seguidas marcam as duas", () => {
    const cenas = cenasDe([
      { tipo: "dm", texto: "Um", botao_label: "A" },
      { tipo: "dm", texto: "Dois", botao_label: "B" },
    ] as Passo[]);
    expect(feitio(cenas, 0)).toEqual(["balao", "parada", "resposta"]);
    expect(feitio(cenas, 1)).toEqual(["balao", "parada", "resposta"]);
  });
});

describe("roteiro — rótulo em branco", () => {
  // O `FOLLOW_PADRAO` SAIU DAQUI, e este teste é o que ele fixava ao contrário.
  //
  // A versão anterior desenhava a pílula "Já sigo! ✅" quando o campo estava
  // vazio, com o argumento de que `conferir` (lib/steps.ts) aceita o bloco. Ele
  // aceita — mas o que o motor faz com ele NÃO é o que a pílula prometia:
  // `resolverFollow` (lib/engine.ts) enfileira `quick_reply_label: ""` e
  // `lib/queue-drain.ts` exige `quick_reply_label && quick_reply_payload` para
  // montar a resposta rápida. Com o rótulo vazio a mensagem sai como TEXTO
  // PURO, sem botão nenhum, e o fluxo para no portão sem nada para tocar.
  //
  // A prévia inventava um botão que o Instagram nunca entrega — e escondia
  // exatamente a armadilha que ela existe para denunciar. Agora ela mostra o
  // que sai: balão sem botão, a parada, e NENHUM toque da pessoa, porque não há
  // em que tocar. Quem recusa o bloco é `conferirLista` (lib/steps.ts), com
  // ERRO, no painel logo acima da prévia.
  //
  // O `LINK_PADRAO` ficou, e a assimetria é do MOTOR: `linkMessage` (lib/ig.ts)
  // monta o botão com `title: buttonLabel || "Abrir link"`, então ali o padrão
  // diz a verdade. O teste logo abaixo é o par deste.
  it("`pedir_follow` sem rótulo NÃO inventa pílula: sai texto puro, e não há o que tocar", () => {
    const cenas = cenasDe([
      { tipo: "pedir_follow", texto: "Me segue", botao_label: "" },
    ] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Me segue", botao: null, link: false },
      { tipo: "parada", motivo: "follow" },
    ]);
  });

  it("botão de link sem rótulo cai em “Abrir link”", () => {
    const cenas = cenasDe([
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
    const cenas = cenasDe(
      [{ tipo: "resposta_publica", textos: ["", "Te mandei! 📩", "Olha o direct"] }] as Passo[],
      "comment"
    );
    expect(cenas[0].itens).toEqual([
      {
        tipo: "publica",
        texto: "Te mandei! 📩",
        variacoes: 3,
        vazias: 1,
        situacao: "publicada",
      },
    ]);
  });

  it("todas em branco não inventam texto — e a contagem continua honesta", () => {
    // Esta lista é ERRO em `conferirLista` (o motor sorteia e desiste), mas
    // `conferir` a aceita, então ela chega aqui como bloco válido.
    const cenas = cenasDe([{ tipo: "resposta_publica", textos: ["", " "] }] as Passo[], "comment");
    expect(cenas[0].itens).toEqual([
      { tipo: "publica", texto: "", variacoes: 2, vazias: 2, situacao: "publicada" },
    ]);
  });

  // A CONTAGEM DAS VAZIAS EXISTE PARA UM GESTO, e ele é o normal: logo depois do
  // Enter — que é como se cria a segunda variação — existe uma linha em branco,
  // e a prévia prometia "uma das 2 variações, sorteada" sem dizer que uma delas
  // não publica nada. `enfileirarPasso` (lib/engine.ts) sorteia e faz
  // `if (!texto?.trim()) return`: naquele disparo a resposta some.
  //
  // É a perda intermitente que `conferirLista` (lib/steps.ts) decidiu NÃO
  // acusar, de propósito — basta um texto aproveitável para ela calar. A prévia
  // pode dizer, porque ela é o lugar onde se vê o resultado, não o que trava o
  // salvar.
  it("conta as variações em branco separadamente das que publicam", () => {
    const cenas = cenasDe(
      [{ tipo: "resposta_publica", textos: ["Te mandei! 📩", ""] }] as Passo[],
      "comment"
    );
    expect(cenas[0].itens[0]).toEqual({
      tipo: "publica",
      texto: "Te mandei! 📩",
      variacoes: 2,
      vazias: 1,
      situacao: "publicada",
    });
  });

  // O CARTÃO DO POST DESENHA UMA SÓ, e antes a segunda mandava olhar "acima"
  // apontando para o texto da PRIMEIRA. `commentReplyKey` (lib/dedupe.ts) é a
  // mesma string para as duas e o `on conflict do nothing` engole a segunda —
  // é o mesmo mecanismo que `conferirLista` (lib/steps.ts) acusa como ERRO.
  it("a SEGUNDA resposta pública é `repetida`, e não aponta para o cartão", () => {
    const cenas = cenasDe(
      [
        { tipo: "resposta_publica", textos: ["Primeira"] },
        { tipo: "resposta_publica", textos: ["Segunda"] },
      ] as Passo[],
      "comment"
    );
    expect(cenas[0].itens[0]).toMatchObject({ situacao: "publicada", texto: "Primeira" });
    expect(cenas[1].itens[0]).toMatchObject({ situacao: "repetida", texto: "Segunda" });
  });

  // Fora do gatilho de comentário nada é publicado, e o cartão do post sequer
  // existe: `enfileirarPasso` faz `if (!contexto.commentId) return`.
  it("fora do gatilho de comentário a situação é `fora_do_gatilho`, mesmo na primeira", () => {
    const lista = [{ tipo: "resposta_publica", textos: ["Te mandei! 📩"] }] as Passo[];
    expect(cenasDe(lista, "dm")[0].itens[0]).toMatchObject({ situacao: "fora_do_gatilho" });
    expect(cenasDe(lista, "story")[0].itens[0]).toMatchObject({ situacao: "fora_do_gatilho" });
  });
});

// O DEFEITO QUE ESTE BLOCO FIXA: `roteiro` não recebia o gatilho, então a cena
// do coraçãozinho saía IGUAL nos três. Com o gatilho de comentário o nó ficava
// com borda vermelha (`conferirLista` acusa) e a prévia, logo abaixo do mesmo
// erro, escrevia "reage à mensagem que a pessoa mandou" — prometendo entrega de
// um bloco que nunca roda.
//
// A assimetria era o que denunciava: a `resposta_publica` já era consciente do
// gatilho, o `reagir_story` não. Agora os dois são, e no mesmo lugar.
describe("roteiro — o coraçãozinho depende do gatilho", () => {
  const coracao = [{ tipo: "reagir_story", emoji: "❤️" }] as Passo[];

  it("no gatilho de story reage à resposta que a pessoa mandou ao story", () => {
    expect(cenasDe(coracao, "story")[0].itens).toEqual([
      { tipo: "reacao", emoji: "❤️", alvo: "story" },
    ]);
  });

  it("no gatilho de DM ele RODA, na mensagem comum — é o AVISO de `conferirLista`", () => {
    // `handleMessage` (lib/engine.ts) atende os dois pelo mesmo caminho e chama
    // `executarFluxo(..., { messageId: msg.mid })` nos dois. Marcar isto como
    // "não sai" acusaria de não rodar um bloco que roda.
    expect(cenasDe(coracao, "dm")[0].itens).toEqual([
      { tipo: "reacao", emoji: "❤️", alvo: "mensagem" },
    ]);
  });

  it("no gatilho de comentário NÃO PROMETE ENTREGA: não há mensagem a que reagir", () => {
    expect(cenasDe(coracao, "comment")[0].itens).toEqual([
      { tipo: "reacao", emoji: "❤️", alvo: "nenhum" },
    ]);
  });
});

describe("roteiro — bloco que não é enviado", () => {
  it("bloco inválido vira `incompleto`, nunca balão", () => {
    // `interpretar` (lib/steps.ts) IGNORA este bloco: ele nunca é enviado.
    // Desenhá-lo como mensagem seria a prévia prometendo um envio que não
    // acontece — a falha mais silenciosa que existe aqui.
    const cenas = cenasDe([{ tipo: "dm", texto: "   " }] as Passo[]);
    expect(cenas[0].itens).toEqual([
      { tipo: "incompleto", mensagem: "Esta mensagem está sem texto." },
    ]);
  });

  it("a mensagem é a do DONO, sem nome de tipo interno", () => {
    const cenas = cenasDe([{ tipo: "pedir_email", texto: "" }] as Passo[]);
    expect(cenas[0].itens[0]).toEqual({
      tipo: "incompleto",
      mensagem: "Este pedido de e-mail está sem texto.",
    });
  });

  it("tipo desconhecido também não vira mensagem", () => {
    const cenas = cenasDe([{ tipo: "ramificar" }]);
    expect(feitio(cenas, 0)).toEqual(["incompleto"]);
  });

  it("o bloco inválido NÃO desloca o índice dos outros", () => {
    // O índice é o que liga a cena ao bloco selecionado no quadro. Pulando o
    // inválido, o destaque cairia no bloco errado a partir dele.
    const cenas = cenasDe([
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
    expect(cenasDe([])).toEqual([]);
  });

  it("o que não é lista devolve roteiro vazio", () => {
    // A lista também chega do banco, onde ela é `unknown` e nada confere o tipo
    // em runtime — o mesmo motivo pelo qual `interpretar` se defende disso.
    expect(cenasDe(null)).toEqual([]);
    expect(cenasDe(undefined)).toEqual([]);
    expect(cenasDe("dm")).toEqual([]);
    expect(cenasDe({ tipo: "dm" })).toEqual([]);
  });

  it("lista só com bloco corrompido não desenha mensagem nenhuma", () => {
    const cenas = cenasDe([null, 7]);
    expect(cenas.map((c) => c.itens.map((b) => b.tipo))).toEqual([
      ["incompleto"],
      ["incompleto"],
    ]);
  });
});
