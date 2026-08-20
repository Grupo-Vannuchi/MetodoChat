import { describe, it, expect } from "vitest";
import { roteiro, textoDoTempo, type Cena } from "../app/automacoes/editor/roteiro";
import { identidadeDoPasso, type Ligacao, type Passo } from "../lib/steps";

// Os tipos das bolhas de uma cena, na ordem. É o que quase todo teste daqui
// pergunta — "o que este bloco desenha, e nessa ordem?" — e escrever isso à mão
// em cada `expect` esconderia a pergunta no meio do objeto.
function feitio(cenas: Cena[], i = 0): string[] {
  return cenas[i].itens.map((b) => b.tipo);
}

// A CORRENTE `bloco i → bloco i+1`, toda de `sempre`.
//
// Ela existe porque `roteiro` deixou de percorrer o array e passou a percorrer
// as SETAS: sem ligação nenhuma, uma lista de cinco blocos desenha um só, e
// todo teste de conteúdo daqui viraria um teste de grafo por acidente.
//
// E ela não é um andaime inventado para o teste: é EXATAMENTE o que a migração
// (`scripts/ligar-passos-existentes.mjs`) gravou em toda automação que já
// existia, e portanto a forma em que a maioria dos fluxos deste produto chega à
// prévia. Os testes que perguntam sobre BIFURCAÇÃO montam as ligações à mão, com
// `cenasCom` logo abaixo.
function corrente(passos: unknown): Ligacao[] {
  if (!Array.isArray(passos)) return [];
  const ligacoes: Ligacao[] = [];
  for (let i = 0; i + 1 < passos.length; i++) {
    ligacoes.push({
      de: identidadeDoPasso(passos[i], i),
      quando: { tipo: "sempre" },
      para: identidadeDoPasso(passos[i + 1], i + 1),
    });
  }
  return ligacoes;
}

// O gatilho é obrigatório em `roteiro`, e de propósito (o motivo está lá). Aqui
// o padrão é `dm` porque é o gatilho em que os quatro tipos de DM rodam sem
// ressalva — os testes que perguntam sobre gatilho passam o seu.
function cenasDe(passos: unknown, gatilho = "dm"): Cena[] {
  return roteiro(passos, gatilho, corrente(passos), null);
}

// A mesma coisa com o grafo na mão: as ligações e o bloco selecionado.
function cenasCom(passos: unknown, ligacoes: Ligacao[], selecionado: string | null): Cena[] {
  return roteiro(passos, "dm", ligacoes, selecionado);
}

// Quais blocos a conversa mostrou, na ordem. É a pergunta inteira dos testes de
// caminho — "que braço apareceu?" — e ela se lê pela identidade, que é o que o
// quadro usa para saber qual nó está aceso.
function trilha(cenas: Cena[]): string[] {
  return cenas.map((c) => c.id);
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
      { id: "0", itens: [{ tipo: "balao", texto: "Oi!", botao: null, link: false }] },
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

  it("bloco de `botoes` desenha o MENU e a parada, mesmo sem braço nenhum ligado", () => {
    // A prévia afirmava `passo.botao_label!` no ramo da parada, e a asserção
    // ficou FALSA no dia em que `esperaResposta` passou a dizer sim a um `dm`
    // com `botoes`: um bloco assim não tem rótulo nenhum, e o `!` escondia isso
    // do `tsc`. A prévia teria desenhado uma pílula `undefined` e uma parada
    // sobre uma mensagem que o motor manda como texto puro.
    //
    // ATÉ A TAREFA 8 A PRÉVIA MENTIA AO CONTRÁRIO: `roteiro.ts` não tinha ramo
    // para `envio.forma === "botoes"`, o menu caía no `else` de texto puro, e a
    // tela desenhava como mensagem solta uma parada que o motor executa. Este
    // teste fixava aquela mentira de propósito, para ela não sumir de vista.
    //
    // Agora o menu tem ramo: os botões saem, e a parada com eles — quem diz que
    // ela existe continua sendo `esperaResposta` (lib/steps.ts), não uma cópia
    // da regra escrita aqui.
    //
    // NENHUM `escolhido`, e é o ponto deste caso: sem ligação de botão nenhuma
    // não há braço a mostrar, então não há toque a desenhar. Marcar um botão
    // aqui seria a prévia escolhendo caminho por conta própria.
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
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Qual?", botao: null, link: false },
      {
        tipo: "botoes",
        botoes: [
          { rotulo: "A", escolhido: false },
          { rotulo: "B", escolhido: false },
        ],
      },
      { tipo: "parada", motivo: "toque" },
    ]);
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

  it("o bloco inválido NÃO some do caminho nem troca a identidade dos outros", () => {
    // A identidade é o que liga a cena ao bloco selecionado no quadro. Pulando
    // o inválido, o destaque cairia no bloco errado a partir dele — e, pior
    // desde a Tarefa 8, a caminhada perderia a seta que ATRAVESSA o bloco
    // inválido e a conversa acabaria ali.
    //
    // Sem `id` gravado, a identidade É a posição (`identidadeDoPasso`,
    // lib/steps.ts) — daí os "0", "1", "2".
    const cenas = cenasDe([
      { tipo: "dm", texto: "Um" },
      { tipo: "dm", texto: "" },
      { tipo: "dm", texto: "Três" },
    ] as Passo[]);
    expect(trilha(cenas)).toEqual(["0", "1", "2"]);
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

// ---------------------------------------------------------------------------
// O CAMINHO MOSTRADO — a Tarefa 8.
//
// Até aqui a prévia desenhava o ARRAY, de cabo a rabo. Com bifurcação isso
// deixou de ser uma conversa: uma lista com dois braços não é uma conversa que
// alguém tenha, é duas — e desenhá-las emendadas mostra ao dono uma sequência
// que o motor nunca executa.
//
// A prévia passa a mostrar UM caminho: o que leva até o bloco aberto no painel,
// e o que segue dali. Clicar noutro braço troca a conversa mostrada, e é isso
// que liga o que a pessoa está editando ao que ela vê.
// ---------------------------------------------------------------------------
describe("roteiro — o caminho mostrado", () => {
  // Um menu com dois braços que voltam a se encontrar. É a forma mais comum de
  // bifurcação do produto — "qual você quer?", duas respostas, e o mesmo fecho.
  //
  //   b_menu01 --botao op_a--> b_aum001 --> b_ados01 --> b_junta1
  //       +-----botao op_b--> b_bum001 --------------------^
  const bifurcado = [
    {
      id: "b_menu01",
      tipo: "dm",
      texto: "Qual?",
      botoes: [
        { id: "op_aaaaaa", rotulo: "A" },
        { id: "op_bbbbbb", rotulo: "B" },
      ],
    },
    { id: "b_aum001", tipo: "dm", texto: "Braço A" },
    { id: "b_ados01", tipo: "dm", texto: "Ainda o A" },
    { id: "b_bum001", tipo: "dm", texto: "Braço B" },
    { id: "b_junta1", tipo: "dm", texto: "Fecho" },
  ] as Passo[];

  const setas: Ligacao[] = [
    { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_aum001" },
    { de: "b_menu01", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_bum001" },
    { de: "b_aum001", quando: { tipo: "sempre" }, para: "b_ados01" },
    { de: "b_ados01", quando: { tipo: "sempre" }, para: "b_junta1" },
    { de: "b_bum001", quando: { tipo: "sempre" }, para: "b_junta1" },
  ];

  it("clicar num bloco de um braço mostra o caminho ATÉ ele, e o que segue dali", () => {
    expect(trilha(cenasCom(bifurcado, setas, "b_bum001"))).toEqual([
      "b_menu01",
      "b_bum001",
      "b_junta1",
    ]);
  });

  it("clicar no OUTRO braço troca a conversa mostrada", () => {
    // É a prova da tarefa inteira: o mesmo fluxo, a mesma tela, e duas
    // conversas diferentes conforme o bloco aberto. O braço A não aparece no
    // teste acima, e o B não aparece neste.
    expect(trilha(cenasCom(bifurcado, setas, "b_ados01"))).toEqual([
      "b_menu01",
      "b_aum001",
      "b_ados01",
      "b_junta1",
    ]);
  });

  // A ESCOLHA ARBITRÁRIA DESTA TAREFA, e é por isso que ela está fixada aqui.
  //
  // `b_junta1` é alcançado pelos DOIS braços. Algum tem que ganhar, e ganha o
  // PRIMEIRO EM ORDEM DE LIGAÇÃO — a mesma regra de desempate que `ligacoesDe`
  // (lib/steps.ts) já usa em todo o resto do grafo.
  //
  // Repare que o braço A é o MAIS LONGO dos dois. É de propósito: se a busca
  // fosse por largura, o caminho mostrado seria o do B (dois saltos contra
  // três), e a regra escrita acima seria falsa sem nada acusar. Este teste
  // separa as duas.
  //
  // Sem a regra fixada, a prévia trocaria de braço sozinha conforme as ligações
  // fossem reordenadas no banco, e o dono veria a conversa mudar sem ter mexido
  // em nada.
  it("num bloco de JUNÇÃO ganha o primeiro braço em ordem de ligação, não o mais curto", () => {
    expect(trilha(cenasCom(bifurcado, setas, "b_junta1"))).toEqual([
      "b_menu01",
      "b_aum001",
      "b_ados01",
      "b_junta1",
    ]);
  });

  it("sem bloco selecionado, o caminho começa em `steps[0]` e segue o primeiro braço", () => {
    // A ENTRADA DO FLUXO É `steps[0]` — o único significado que a ordem do
    // array guardou depois que as ligações passaram a dizer quem vem depois.
    expect(trilha(cenasCom(bifurcado, setas, null))).toEqual([
      "b_menu01",
      "b_aum001",
      "b_ados01",
      "b_junta1",
    ]);
  });

  it("bloco SOLTO mostra só ele, sem tronco", () => {
    // Ninguém aponta para `b_solto1`, então não há caminho da entrada até ele.
    // Mostrar o tronco assim mesmo seria emendar duas conversas que não se
    // encostam; mostrar nada esconderia o bloco que a pessoa acabou de abrir.
    const passos = [
      { id: "b_um00001", tipo: "dm", texto: "Oi" },
      { id: "b_solto1", tipo: "dm", texto: "Sozinho" },
    ] as Passo[];
    expect(trilha(cenasCom(passos, [], "b_solto1"))).toEqual(["b_solto1"]);
  });

  it("bloco solto SEGUE dali: o que sai dele aparece, o que não chega nele não", () => {
    const passos = [
      { id: "b_um00001", tipo: "dm", texto: "Oi" },
      { id: "b_solto1", tipo: "dm", texto: "Sozinho" },
      { id: "b_dep0001", tipo: "dm", texto: "Depois do sozinho" },
    ] as Passo[];
    const so: Ligacao[] = [{ de: "b_solto1", quando: { tipo: "sempre" }, para: "b_dep0001" }];
    expect(trilha(cenasCom(passos, so, "b_solto1"))).toEqual(["b_solto1", "b_dep0001"]);
  });

  // O CICLO É PRODUZÍVEL PELA TELA, e não é defeito: um menu que volta para si
  // mesmo ("escolha outra opção") é padrão legítimo, e `temCicloDeSempre`
  // (lib/steps.ts) só recusa o anel de `sempre`.
  //
  // Sem visitados, a caminhada aqui não termina — e o que trava não é um teste,
  // é a tela de quem está editando.
  describe("ciclo", () => {
    const passos = [
      { id: "b_um00001", tipo: "dm", texto: "Oi" },
      {
        id: "b_menu01",
        tipo: "dm",
        texto: "Qual?",
        botoes: [
          { id: "op_aaaaaa", rotulo: "De novo" },
          { id: "op_bbbbbb", rotulo: "Voltar" },
        ],
      },
    ] as Passo[];
    const setas: Ligacao[] = [
      { de: "b_um00001", quando: { tipo: "sempre" }, para: "b_menu01" },
      // O menu volta para SI MESMO.
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_menu01" },
      // …e para o bloco que já passou.
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_um00001" },
    ];

    it("um menu que volta para si mesmo não trava, e não se repete na conversa", () => {
      expect(trilha(cenasCom(passos, setas, null))).toEqual(["b_um00001", "b_menu01"]);
    });

    it("selecionar o menu do anel também termina", () => {
      expect(trilha(cenasCom(passos, setas, "b_menu01"))).toEqual(["b_um00001", "b_menu01"]);
    });

    // O CASO QUE DE FATO EXIGE OS VISITADOS NA BUSCA, e ele não é nenhum dos
    // dois acima — os dois foram MEDIDOS: com o `Set` de `caminhoAte` arrancado,
    // a suíte inteira continuava VERDE. A razão é que os dois acham o alvo antes
    // de dar a segunda volta (ou nem chamam a busca, no caso sem seleção, que
    // tem visitados PRÓPRIOS em `seguindoDe`).
    //
    // O que trava é procurar um bloco que o anel NÃO alcança: a busca varre tudo
    // o que dá para alcançar antes de desistir, e sem visitados ela dá voltas no
    // anel para sempre. `b_solto1` não tem seta chegando nele, então abri-lo no
    // painel obriga a busca a percorrer o anel inteiro e concluir que não há
    // caminho.
    //
    // O QUE ISSO CUSTA NA TELA é uma aba travada enquanto o dono edita — não um
    // teste vermelho. Por isso ele está aqui, e por isso este comentário diz
    // exatamente qual gesto o produz.
    it("procurar um bloco que o anel NÃO alcança termina, em vez de dar voltas", () => {
      const comSolto = [...passos, { id: "b_solto1", tipo: "dm", texto: "Sozinho" }] as Passo[];
      expect(trilha(cenasCom(comSolto, setas, "b_solto1"))).toEqual(["b_solto1"]);
    });

    it("o botão que volta para trás NÃO é marcado como escolhido", () => {
      // A conversa acaba ali — o destino já está desenhado acima. Marcar o
      // botão prometeria uma continuação que a prévia não mostra.
      //
      // NESTE GRAFO OS DOIS BOTÕES VOLTAM, e por isso ele NÃO separa "esta saída
      // repete" de "TODAS repetem". Quem separa é o teste logo abaixo, e ele
      // existe porque a suíte ficou verde com o defeito.
      expect(cenasCom(passos, setas, null)[1].itens[1]).toEqual({
        tipo: "botoes",
        botoes: [
          { rotulo: "De novo", escolhido: false },
          { rotulo: "Voltar", escolhido: false },
        ],
      });
    });

    // A CAUDA NÃO PODE DESISTIR NA PRIMEIRA SAÍDA QUE REPETE — o caso que o
    // teste acima deixava passar, e que foi MEDIDO antes de ser consertado.
    //
    // O grafo é o padrão legítimo do produto que `caminhoAte` já nomeia: um menu
    // com "Escolher de novo" e um braço que segue. O botão que VOLTA está
    // gravado PRIMEIRO — que é a ordem natural de quem desenhou o "voltar" antes
    // de desenhar o resto —, e com `saidasMostradas(...)[0]` a prévia parava no
    // menu e `b_novo001` sumia da tela.
    //
    // COM O DEFEITO A SUÍTE INTEIRA FICAVA VERDE: 632 de 632. É por isso que
    // este teste está escrito com a trilha E com a pílula — o braço escondido e
    // a marca que diz por onde ele segue são a mesma informação, e o dono perdia
    // as duas de uma vez.
    it("a cauda PULA a saída que repete e segue pela próxima, em vez de acabar ali", () => {
      const comBraco = [
        { id: "b_um00001", tipo: "dm", texto: "Oi" },
        {
          id: "b_menu01",
          tipo: "dm",
          texto: "Qual?",
          botoes: [
            { id: "op_denovo", rotulo: "Escolher de novo" },
            { id: "op_seguir", rotulo: "Seguir" },
          ],
        },
        { id: "b_novo001", tipo: "dm", texto: "O braço que continua" },
      ] as Passo[];
      const comVolta: Ligacao[] = [
        { de: "b_um00001", quando: { tipo: "sempre" }, para: "b_menu01" },
        // A volta está gravada ANTES do braço que segue, de propósito.
        { de: "b_menu01", quando: { tipo: "botao", botao: "op_denovo" }, para: "b_um00001" },
        { de: "b_menu01", quando: { tipo: "botao", botao: "op_seguir" }, para: "b_novo001" },
      ];
      const cenas = cenasCom(comBraco, comVolta, null);
      expect(trilha(cenas)).toEqual(["b_um00001", "b_menu01", "b_novo001"]);
      // E a pílula do braço mostrado é a do SEGUNDO botão, não a do primeiro.
      expect(cenas[1].itens[1]).toEqual({
        tipo: "botoes",
        botoes: [
          { rotulo: "Escolher de novo", escolhido: false },
          { rotulo: "Seguir", escolhido: true },
        ],
      });
    });
  });

  // O PASSO 4 DA TAREFA: o menu desenha os botões, e o do braço que está sendo
  // mostrado aparece marcado. É o que liga o bloco aberto no painel à conversa.
  describe("o botão do braço mostrado", () => {
    it("marca o botão que leva ao braço mostrado, e o toque dele vira resposta", () => {
      const cenas = cenasCom(bifurcado, setas, "b_bum001");
      expect(cenas[0].itens).toEqual([
        { tipo: "balao", texto: "Qual?", botao: null, link: false },
        {
          tipo: "botoes",
          botoes: [
            { rotulo: "A", escolhido: false },
            { rotulo: "B", escolhido: true },
          ],
        },
        { tipo: "parada", motivo: "toque" },
        { tipo: "resposta", texto: "B" },
      ]);
    });

    it("trocar de braço troca o botão marcado e o toque desenhado", () => {
      const cenas = cenasCom(bifurcado, setas, "b_aum001");
      expect(cenas[0].itens[1]).toEqual({
        tipo: "botoes",
        botoes: [
          { rotulo: "A", escolhido: true },
          { rotulo: "B", escolhido: false },
        ],
      });
      expect(cenas[0].itens[3]).toEqual({ tipo: "resposta", texto: "A" });
    });

    it("botão SEM destino não é marcado, e o menu segue pelo que tem", () => {
      // É o estado normal de quem está montando: um braço ligado e o outro
      // ainda não. `conferirLista` (lib/steps.ts) recusa isso no ATIVAR, não no
      // salvar — então a prévia precisa saber desenhá-lo.
      const passos = [
        {
          id: "b_menu01",
          tipo: "dm",
          texto: "Qual?",
          botoes: [
            { id: "op_aaaaaa", rotulo: "Sem destino" },
            { id: "op_bbbbbb", rotulo: "Com destino" },
          ],
        },
        { id: "b_dep0001", tipo: "dm", texto: "Chegou" },
      ] as Passo[];
      const so: Ligacao[] = [
        { de: "b_menu01", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_dep0001" },
      ];
      const cenas = cenasCom(passos, so, null);
      expect(trilha(cenas)).toEqual(["b_menu01", "b_dep0001"]);
      expect(cenas[0].itens[1]).toEqual({
        tipo: "botoes",
        botoes: [
          { rotulo: "Sem destino", escolhido: false },
          { rotulo: "Com destino", escolhido: true },
        ],
      });
    });
  });

  // `envioDaDm` (lib/steps.ts) VALIDA A LISTA E NÃO OS ELEMENTOS — está escrito
  // no comentário dela —, e o que sai de lá é `Botao[]` por CAST. `conferir` não
  // olha `botoes`, então o que chega aqui é `jsonb` cru: quem trava o salvar de
  // um botão quebrado é `conferirLista`, e ele só trava o que passa PELO EDITOR.
  //
  // A PRÉVIA NÃO PODE CAIR POR CAUSA DISSO. É a mesma classe de defeito que
  // `enfileirarPasso` (lib/engine.ts) já teve com `[null].map(b => b.rotulo)`, e
  // ali o preço foi o lote inteiro de eventos daquela requisição; aqui seria a
  // tela onde se conserta o bloco.
  it("elemento quebrado em `botoes` não derruba a prévia, e não vira botão marcado", () => {
    const passos = [
      {
        id: "b_menu01",
        tipo: "dm",
        texto: "Qual?",
        botoes: [null, { id: "op_aaaaaa", rotulo: "A" }, { id: "op_bbbbbb" }, "solto"],
      },
      { id: "b_dep0001", tipo: "dm", texto: "Chegou" },
    ] as unknown as Passo[];
    const so: Ligacao[] = [
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_dep0001" },
    ];
    const cenas = cenasCom(passos, so, null);
    expect(trilha(cenas)).toEqual(["b_menu01", "b_dep0001"]);
    expect(cenas[0].itens[1]).toEqual({
      tipo: "botoes",
      botoes: [
        { rotulo: "", escolhido: false },
        { rotulo: "A", escolhido: true },
        { rotulo: "", escolhido: false },
        { rotulo: "", escolhido: false },
      ],
    });
  });

  it("botão escolhido SEM rótulo não desenha toque: não há texto que entre na conversa", () => {
    // Mesmo caso do `pedir_follow` sem rótulo: a bolha da direita é o TEXTO que
    // o toque põe na conversa, e um botão sem rótulo não põe nenhum. A parada
    // fica — quem a decide é `esperaResposta` —, e a conversa acaba ali, sem
    // ninguém para destravá-la.
    const passos = [
      { id: "b_menu01", tipo: "dm", texto: "Qual?", botoes: [{ id: "op_aaaaaa", rotulo: "" }] },
      { id: "b_dep0001", tipo: "dm", texto: "Chegou" },
    ] as Passo[];
    const so: Ligacao[] = [
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_dep0001" },
    ];
    const cenas = cenasCom(passos, so, null);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Qual?", botao: null, link: false },
      { tipo: "botoes", botoes: [{ rotulo: "", escolhido: true }] },
      { tipo: "parada", motivo: "toque" },
    ]);
    // O braço continua sendo mostrado: o que falta é o rótulo, não o caminho.
    expect(trilha(cenas)).toEqual(["b_menu01", "b_dep0001"]);
  });

  // ---------------------------------------------------------------------------
  // AS SETAS QUE A PRÉVIA ESCONDIA — a revisão da Tarefa 8.
  //
  // A Tarefa 7 fixou que o quadro não pode desenhar uma seta que promete um
  // caminho que o motor não percorre. A pergunta simétrica foi medida, e a
  // resposta é que A PRÉVIA NÃO PODE ESCONDER UM CAMINHO QUE O MOTOR PERCORRE.
  //
  // Estes testes são dessa regra. O que estava escrito aqui antes era o
  // contrário — "a `senao` não entra no caminho mostrado" —, e a decisão foi
  // contestada com medição: no MESMO painel, o quadro desenha aquela seta na
  // alça "digitou", o motor entrega por ela (`retomadaDoTexto`, lib/steps.ts) e
  // a conferência trata o destino como rio abaixo da entrada, sem dizer "Nenhuma
  // seta chega neste bloco". Três superfícies concordavam, e a prévia era a
  // dissidente — mostrando o bloco solto, sem tronco.
  //
  // O ARGUMENTO QUE SUSTENTAVA A REGRA ANTIGA — que desenhar esse passo obrigaria
  // a prévia a inventar o texto que a pessoa digitou — caiu junto: o passo é uma
  // MARCA, não uma bolha, e não carrega texto nenhum.
  // ---------------------------------------------------------------------------

  // O BLOCO DA `senao` DEIXA DE SER BLOCO SOLTO, que é a correção inteira.
  it("a `senao` entra no caminho, e o bloco dela ganha o tronco que o motor percorre", () => {
    const passos = [
      {
        id: "b_menu01",
        tipo: "dm",
        texto: "Qual?",
        botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
      },
      { id: "b_digit1", tipo: "dm", texto: "Quem digitou" },
      { id: "b_tocou1", tipo: "dm", texto: "Quem tocou" },
    ] as Passo[];
    // A `senao` foi gravada ANTES da ligação do botão, de propósito — ver o
    // teste seguinte, que é o que impede a correção de virar sobre-correção.
    const so: Ligacao[] = [
      { de: "b_menu01", quando: { tipo: "senao" }, para: "b_digit1" },
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_tocou1" },
    ];
    const cenas = cenasCom(passos, so, "b_digit1");
    expect(trilha(cenas)).toEqual(["b_menu01", "b_digit1"]);
    // NENHUMA PÍLULA MARCADA, e a marca no lugar dela. As duas metades são a
    // mesma informação: ninguém tocou em botão nenhum, e a conversa seguiu
    // assim mesmo. Marcar uma pílula aqui seria a prévia inventando um toque.
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Qual?", botao: null, link: false },
      { tipo: "botoes", botoes: [{ rotulo: "A", escolhido: false }] },
      { tipo: "parada", motivo: "toque" },
      { tipo: "retomada", via: "digitou" },
    ]);
  });

  // O GUARDA-COSTAS DA CORREÇÃO ACIMA: percorrer a `senao` não pode fazer dela o
  // caminho PADRÃO. Ela está gravada primeiro nestas setas, então uma
  // `saidasMostradas` que devolvesse as ligações "na ordem em que foram
  // gravadas" a poria na frente do botão e trocaria a conversa que o dono vê ao
  // abrir o fluxo. Quem manda na ordem é o gesto, não a gravação.
  it("a `senao` NÃO rouba o caminho padrão: sem seleção, o menu segue pelo botão", () => {
    const passos = [
      {
        id: "b_menu01",
        tipo: "dm",
        texto: "Qual?",
        botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
      },
      { id: "b_digit1", tipo: "dm", texto: "Quem digitou" },
      { id: "b_tocou1", tipo: "dm", texto: "Quem tocou" },
    ] as Passo[];
    const so: Ligacao[] = [
      { de: "b_menu01", quando: { tipo: "senao" }, para: "b_digit1" },
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_tocou1" },
    ];
    const cenas = cenasCom(passos, so, null);
    expect(trilha(cenas)).toEqual(["b_menu01", "b_tocou1"]);
    // E aí a pílula É marcada, e a marca não sai: houve toque.
    expect(cenas[0].itens[1]).toEqual({
      tipo: "botoes",
      botoes: [{ rotulo: "A", escolhido: true }],
    });
    expect(cenas[0].itens.some((b) => b.tipo === "retomada")).toBe(false);
  });

  // A `sempre` DE UM MENU — a segunda seta que este arquivo escondia, e a que o
  // comentário antigo de `saidasMostradas` negava existir ao chamar a `senao` de
  // "a única exclusão desta função".
  //
  // ELA NÃO É SETA MORTA, e quem mede isso por extenso é o comentário de
  // `conferirLista` (lib/steps.ts): `retomadaDoTexto` cai nela pelo
  // `?? seguinteDe` quando não há `senao`, e `retomadaDoBotao` e
  // `retomadaDoFallback` saem por ela sempre. Medido neste grafo, com o menu
  // inteiramente ligado: o motor entrega `b_smp004` e a prévia desenhava só
  // `["b_smp004"]`, um bloco solto.
  //
  // A CONFERÊNCIA NÃO CALA NESTE GRAFO, e a versão anterior deste comentário
  // dizia que ela devolvia "`[]` — nem erro, nem aviso". Medido: o menu aqui tem
  // UM botão só, e `conferirLista` (lib/steps.ts) dá AVISO por isso ("Esta
  // bifurcação tem um botão só..."). O aviso é sobre o botão único, e não sobre a
  // `sempre` escondida — a conferência continua sem ter o que dizer sobre a seta
  // que a prévia omitia —, mas a frase como estava era falsa sobre a saída da
  // função. O grafo em que ela realmente devolve `[]` é o do CRÍTICO A, mais
  // abaixo, com o menu que virou link.
  it("a `sempre` de um MENU entra no caminho, com a marca da retomada", () => {
    const passos = [
      {
        id: "b_menu01",
        tipo: "dm",
        texto: "Qual?",
        botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
      },
      { id: "b_tocou1", tipo: "dm", texto: "Quem tocou" },
      { id: "b_smp004", tipo: "dm", texto: "Retomado sem gesto" },
    ] as Passo[];
    const so: Ligacao[] = [
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_tocou1" },
      { de: "b_menu01", quando: { tipo: "sempre" }, para: "b_smp004" },
    ];
    const cenas = cenasCom(passos, so, "b_smp004");
    expect(trilha(cenas)).toEqual(["b_menu01", "b_smp004"]);
    expect(cenas[0].itens[3]).toEqual({ tipo: "retomada", via: "continuacao" });
    // E ela é a ÚLTIMA da fila: com o botão ligado, o caminho padrão é o dele.
    expect(trilha(cenasCom(passos, so, null))).toEqual(["b_menu01", "b_tocou1"]);
  });

  // A `sempre` DE UM BLOCO COMUM NÃO GANHA MARCA, e é a única assimetria da
  // regra. Ali ela é a conversa simplesmente seguindo — marcar toda continuação
  // encheria de ruído a corrente que a migração gravou em toda automação que já
  // existia.
  it("a `sempre` de um bloco COMUM segue sem marca nenhuma", () => {
    const passos = [
      { id: "b_um00001", tipo: "dm", texto: "Oi" },
      { id: "b_dois001", tipo: "dm", texto: "Tchau" },
    ] as Passo[];
    const cenas = cenasDe(passos);
    expect(trilha(cenas)).toEqual(["b_um00001", "b_dois001"]);
    expect(cenas[0].itens).toEqual([{ tipo: "balao", texto: "Oi", botao: null, link: false }]);
  });

  // A ORDEM DAS DUAS SETAS DEPENDE DE O BLOCO PARAR, e quem responde isso é
  // `esperaResposta` (lib/steps.ts) — a mesma fonte que decide a parada, e não
  // uma cópia da regra escrita na prévia.
  describe("a ordem entre `senao` e `sempre`", () => {
    // O BLOCO QUE NÃO PARA NÃO TEM `senao` NENHUMA — e a versão anterior deste
    // teste só perguntava a ORDEM, com a `sempre` presente para ganhar dela.
    // Assim ele ficava verde com a `senao` na lista, bastando estar no fim: no
    // fim ainda é percorrida quando não sobra mais nada.
    //
    // AQUI NÃO HÁ `sempre` PARA GANHAR DELA, e é isso que discrimina. Medido no
    // motor com este mesmo grafo: `interpretar` enfileira `b_um00001` e devolve
    // `pararEm: null` — o fluxo ACABA ali, ninguém fica parado para digitar, e
    // `retomadaDoTexto` (o único ponto que lê esta `senao`) só é chamada do ramo
    // do CURSOR. A prévia desenhava `b_sen001` e ainda fechava a cena com a marca
    // "quem respondeu digitando", afirmando um gesto que não existe.
    it("num bloco que NÃO para, a `senao` não entra nem quando é a única saída", () => {
      const passos = [
        { id: "b_um00001", tipo: "dm", texto: "Oi" },
        { id: "b_sen001", tipo: "dm", texto: "Quem digitou" },
      ] as Passo[];
      const so: Ligacao[] = [
        { de: "b_um00001", quando: { tipo: "senao" }, para: "b_sen001" },
      ];
      const cenas = cenasCom(passos, so, null);
      expect(trilha(cenas)).toEqual(["b_um00001"]);
      // E nenhuma marca: não houve retomada nenhuma a contar.
      expect(cenas[0].itens.some((b) => b.tipo === "retomada")).toBe(false);
    });

    // O GUARDA-COSTAS DO ANEL: a cauda pula a saída que repete (`seguindoDe`),
    // então numa corrente que volta para si mesma a `senao` de um bloco que não
    // para era a próxima da fila — e a prévia caía nela. É o mesmo defeito por
    // um caminho que não precisa de menu nenhum.
    it("num anel de `sempre`, a `senao` de um bloco que não para continua fora", () => {
      const passos = [
        { id: "b_um00001", tipo: "dm", texto: "Um" },
        { id: "b_dois001", tipo: "dm", texto: "Dois" },
        { id: "b_sen001", tipo: "dm", texto: "Quem digitou" },
      ] as Passo[];
      const so: Ligacao[] = [
        { de: "b_um00001", quando: { tipo: "sempre" }, para: "b_dois001" },
        { de: "b_dois001", quando: { tipo: "sempre" }, para: "b_um00001" },
        { de: "b_dois001", quando: { tipo: "senao" }, para: "b_sen001" },
      ];
      expect(trilha(cenasCom(passos, so, null))).toEqual(["b_um00001", "b_dois001"]);
    });

    // A `sempre` DE UM BLOCO QUE NÃO PARA VEM ANTES DO BRAÇO DO BOTÃO, e a
    // pergunta só passou a existir quando o toque deixou de exigir `forma ===
    // "botoes"` (o CRÍTICO A, logo abaixo). `interpretar` percorre a `sempre`
    // SOZINHA, no mesmo disparo, para todo mundo; o braço do botão de um bloco
    // que não para só acende se alguém tocar depois num botão congelado. Pôr o
    // caso raro na frente mostraria ao dono como conversa o que é a exceção.
    it("num bloco que NÃO para, a `sempre` vem antes do braço do botão congelado", () => {
      const passos = [
        {
          id: "b_menu001",
          tipo: "dm",
          texto: "Virou link",
          url: "https://exemplo.com",
          botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
        },
        { id: "b_smp001", tipo: "dm", texto: "Continuação" },
        { id: "b_toca001", tipo: "dm", texto: "Quem tocou" },
      ] as Passo[];
      // O botão está gravado PRIMEIRO de propósito: quem manda na ordem é o
      // gesto, não a gravação.
      const so: Ligacao[] = [
        { de: "b_menu001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_toca001" },
        { de: "b_menu001", quando: { tipo: "sempre" }, para: "b_smp001" },
      ];
      expect(trilha(cenasCom(passos, so, null))).toEqual(["b_menu001", "b_smp001"]);
      // E o braço do botão continua sendo caminho: abrir `b_toca001` o alcança.
      expect(trilha(cenasCom(passos, so, "b_toca001"))).toEqual(["b_menu001", "b_toca001"]);
    });

    // O BLOCO QUE PARA segue pela `senao`, porque é essa a ordem do
    // `ligacaoEscolhida(...) ?? seguinteDe` de `retomadaDoTexto`: quem digita
    // segue a `senao` sempre que ela existe. A `sempre` gravada primeiro aqui é
    // de propósito — a ordem é do GESTO, não da gravação.
    it("num bloco que PARA, a `senao` vem antes da `sempre`", () => {
      const passos = [
        { id: "b_mail01", tipo: "pedir_email", texto: "Seu e-mail?" },
        { id: "b_smp001", tipo: "dm", texto: "Continuação" },
        { id: "b_sen001", tipo: "dm", texto: "Quem digitou" },
      ] as Passo[];
      const so: Ligacao[] = [
        { de: "b_mail01", quando: { tipo: "sempre" }, para: "b_smp001" },
        { de: "b_mail01", quando: { tipo: "senao" }, para: "b_sen001" },
      ];
      expect(trilha(cenasCom(passos, so, null))).toEqual(["b_mail01", "b_sen001"]);
    });
  });

  // A ÚNICA EXCLUSÃO QUE SOBROU, e ela não é escolha desta tela: `retomadaDoTexto`
  // (lib/steps.ts) retoma o portão DELE MESMO, com ou sem `senao`, e o comentário
  // de lá diz por quê — bastaria mandar "ok" para receber o link sem seguir. Há
  // teste fixando isso no motor; este fixa que a PRÉVIA não desenha a porta dos
  // fundos que o motor recusa.
  //
  // A `senao` num `pedir_follow` só é produzível fora do editor — o quadro não
  // dá a alça —, e é exatamente por isso que ela precisa de teste: nenhum gesto
  // da tela a produz, então nenhum gesto da tela acusaria a volta do defeito.
  it("a `senao` de um `pedir_follow` NÃO entra: o portão retoma dele mesmo", () => {
    const passos = [
      { id: "b_port01", tipo: "pedir_follow", texto: "Segue lá", botao_label: "Já sigo" },
      { id: "b_link01", tipo: "dm", texto: "O link", url: "https://exemplo.com" },
    ] as Passo[];
    const so: Ligacao[] = [{ de: "b_port01", quando: { tipo: "senao" }, para: "b_link01" }];
    // O link continua sendo bloco solto na prévia, como é no motor.
    expect(trilha(cenasCom(passos, so, "b_link01"))).toEqual(["b_link01"]);
    expect(trilha(cenasCom(passos, so, null))).toEqual(["b_port01"]);
  });

  // O BLOCO QUE DEIXOU DE SER MENU — o CRÍTICO A, e ele é o defeito das duas
  // correções anteriores acontecendo num vizinho.
  //
  // O ramo do toque de `saidasMostradas` exigia `envioDaDm(passo).forma ===
  // "botoes"`, e O MOTOR NÃO PERGUNTA ISSO: `caminhoDoBotao` (lib/steps.ts) lê
  // `ligacaoEscolhida(..., {tipo:"botao"})` do bloco que veio no payload e
  // confere só se o DESTINO está na lista. O porquê está em `cursorDaRetomada`,
  // ao lado dela — o botão fica congelado na conversa desde o dia em que foi
  // entregue e continua tocável para sempre.
  //
  // UM GESTO PRODUZ O CASO: digitar uma URL num menu já ligado. `envioDaDm` dá
  // precedência a `url` sobre `botoes`, `apagarBotao` (../app/automacoes/editor/
  // modelos) não roda, e as ligações de botão ficam para trás.
  //
  // MEDIDO, neste mesmo grafo, antes do conserto:
  //   prévia sem seleção      = ["b_menu001","b_digit01"]  (o braço do botão sumiu)
  //   prévia com b_toca001    = ["b_toca001"]              (bloco solto)
  //   caminhoDoBotao(op_aaaaaa) -> {portao:null, destino:"b_toca001"}
  //   conferirLista(...)      = []                          (nem erro, nem aviso)
  // Motor entrega, conferência cala, prévia esconde.
  it("um menu que virou LINK continua percorrendo o braço do botão congelado", () => {
    const passos = [
      {
        id: "b_menu001",
        tipo: "dm",
        texto: "Escolha",
        url: "https://exemplo.com",
        botoes: [{ id: "op_aaaaaa", rotulo: "Quero" }],
      },
      { id: "b_toca001", tipo: "dm", texto: "Quem tocou" },
    ] as Passo[];
    const so: Ligacao[] = [
      { de: "b_menu001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_toca001" },
    ];
    const cenas = cenasCom(passos, so, null);
    expect(trilha(cenas)).toEqual(["b_menu001", "b_toca001"]);
    // E O BLOCO NÃO DESENHA PÍLULA NENHUMA: ele não é mais um menu, então não há
    // `botoes` na cena e não há rótulo a marcar. O braço aparece sem dizer por
    // qual botão saiu — é o preço de não esconder o que o motor entrega, e está
    // anotado no comentário de `Bolha.botoes` (./roteiro).
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Escolha", botao: "Abrir link", link: true },
    ]);
  });

  // A `senao` DE UM BLOCO QUE NÃO PARA NÃO ROUBA O BRAÇO DO BOTÃO, e este é o
  // grafo em que os dois Críticos se cruzam: o mesmo bloco tem as duas setas.
  // Antes do conserto a prévia percorria a `senao` (seta morta) e escondia o
  // botão (seta viva) — as duas direções da regra erradas de uma vez.
  it("no mesmo bloco, o braço do botão entra e o da `senao` fica fora", () => {
    const passos = [
      {
        id: "b_menu001",
        tipo: "dm",
        texto: "Escolha",
        url: "https://exemplo.com",
        botoes: [{ id: "op_aaaaaa", rotulo: "Quero" }],
      },
      { id: "b_toca001", tipo: "dm", texto: "Quem tocou" },
      { id: "b_digit01", tipo: "dm", texto: "Quem digitou" },
    ] as Passo[];
    const so: Ligacao[] = [
      { de: "b_menu001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_toca001" },
      { de: "b_menu001", quando: { tipo: "senao" }, para: "b_digit01" },
    ];
    expect(trilha(cenasCom(passos, so, null))).toEqual(["b_menu001", "b_toca001"]);
    // `b_digit01` não é alcançável nem sendo o bloco aberto: ele é solto.
    expect(trilha(cenasCom(passos, so, "b_digit01"))).toEqual(["b_digit01"]);
  });

  // O BLOCO QUE `conferir` RECUSA TAMBÉM TEM BRAÇO DE BOTÃO. `caminhoDoBotao`
  // não chama `conferir` em lugar nenhum, então o toque num botão congelado de
  // um bloco cujo texto foi apagado DEPOIS continua sendo entregue — e cortar o
  // caminho ali esconderia toda a cauda do fluxo por causa de um campo vazio.
  it("um bloco incompleto não perde o braço do botão", () => {
    const passos = [
      { id: "b_quebra1", tipo: "dm", texto: "", botoes: [{ id: "op_aaaaaa", rotulo: "A" }] },
      { id: "b_toca001", tipo: "dm", texto: "Quem tocou" },
    ] as Passo[];
    const so: Ligacao[] = [
      { de: "b_quebra1", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_toca001" },
    ];
    const cenas = cenasCom(passos, so, null);
    expect(trilha(cenas)).toEqual(["b_quebra1", "b_toca001"]);
    expect(cenas[0].itens[0].tipo).toBe("incompleto");
  });

  // A BOLHA DO TOQUE NÃO SAI NO CAMINHO DE QUEM DIGITOU — o IMPORTANTE 1. A
  // bolha da direita é o que A PESSOA MANDA, e num caminho que sai pela `senao`
  // ela não tocou na pílula: ela escreveu. Medido, antes do conserto, a cena
  // saía `[balão "Toca ai"/Quero, parada, resposta "Quero", retomada digitou]` —
  // a tela mostrava o toque em "Quero" e, uma linha abaixo, a marca dizendo que
  // ela respondeu digitando. Era a prévia inventando a mensagem que a marca
  // existe para NÃO inventar.
  it("a resposta rápida não desenha o toque quando o caminho sai pela `senao`", () => {
    const passos = [
      { id: "b_rr00001", tipo: "dm", texto: "Toca ai", botao_label: "Quero" },
      { id: "b_digit01", tipo: "dm", texto: "Quem digitou" },
    ] as Passo[];
    const so: Ligacao[] = [{ de: "b_rr00001", quando: { tipo: "senao" }, para: "b_digit01" }];
    const cenas = cenasCom(passos, so, null);
    expect(trilha(cenas)).toEqual(["b_rr00001", "b_digit01"]);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Toca ai", botao: "Quero", link: false },
      { tipo: "parada", motivo: "toque" },
      { tipo: "retomada", via: "digitou" },
    ]);
  });

  // E ELA VOLTA A SAIR QUANDO O CAMINHO SAI PELO TOQUE — o guarda-costas da
  // correção acima: a guarda é sobre a `senao`, e não sobre a bolha inteira.
  it("a resposta rápida desenha o toque quando o caminho sai pela `sempre`", () => {
    const passos = [
      { id: "b_rr00001", tipo: "dm", texto: "Toca ai", botao_label: "Quero" },
      { id: "b_smp001", tipo: "dm", texto: "Depois do toque" },
    ] as Passo[];
    const cenas = cenasDe(passos);
    expect(cenas[0].itens).toEqual([
      { tipo: "balao", texto: "Toca ai", botao: "Quero", link: false },
      { tipo: "parada", motivo: "toque" },
      { tipo: "resposta", texto: "Quero" },
    ]);
    // E no ÚLTIMO bloco do caminho ela também sai: não há `senao` a contradizer,
    // e o toque é o gesto que a parada está pedindo.
    const so: Ligacao[] = [];
    expect(cenasCom(passos, so, null)[0].itens.some((b) => b.tipo === "resposta")).toBe(true);
  });

  // O `pedir_email` MANTÉM O EXEMPLO NO CAMINHO DA `senao`, e ele NÃO é o mesmo
  // caso da resposta rápida acima. A medição é do motor: `handleMessage`
  // (lib/engine.ts) só chega em `retomadaDoTexto` DEPOIS de `extractEmail(text)`
  // ter dado certo — e-mail que não parece e-mail re-pergunta e RETORNA, sem sair
  // do bloco. Logo, a `senao` de um `pedir_email` é o caminho de quem digitou um
  // e-mail VÁLIDO, e `ana@email.com` é um EXEMPLO do que ela digitou, não um
  // gesto inventado.
  it("o `pedir_email` mostra o e-mail de exemplo mesmo saindo pela `senao`", () => {
    const passos = [
      { id: "b_mail001", tipo: "pedir_email", texto: "Seu e-mail?" },
      { id: "b_digit01", tipo: "dm", texto: "Depois do e-mail" },
    ] as Passo[];
    const so: Ligacao[] = [{ de: "b_mail001", quando: { tipo: "senao" }, para: "b_digit01" }];
    expect(cenasCom(passos, so, null)[0].itens).toEqual([
      { tipo: "balao", texto: "Seu e-mail?", botao: null, link: false },
      { tipo: "parada", motivo: "email" },
      { tipo: "resposta", texto: "ana@email.com" },
      { tipo: "retomada", via: "digitou" },
    ]);
  });


  it("identidade selecionada que não existe mais na lista cai no caminho da entrada", () => {
    // Produzível: numa lista SEM `id` a identidade é a POSIÇÃO
    // (`identidadeDoPasso`, lib/steps.ts), então apagar um bloco RENOMEIA os
    // outros e a seleção guardada pode apontar para uma posição que sumiu.
    expect(trilha(cenasCom(bifurcado, setas, "b_sumiu1"))).toEqual([
      "b_menu01",
      "b_aum001",
      "b_ados01",
      "b_junta1",
    ]);
  });

  it("ligação para um bloco que não existe encerra a conversa sem quebrar a tela", () => {
    // `haCaminho` (lib/steps.ts) documenta o mesmo caso: uma seta pode citar um
    // id que não está na lista. Aqui não há bloco a desenhar, e a conversa acaba
    // no último que existe.
    const passos = [{ id: "b_um00001", tipo: "dm", texto: "Oi" }] as Passo[];
    const so: Ligacao[] = [{ de: "b_um00001", quando: { tipo: "sempre" }, para: "b_fantas1" }];
    expect(trilha(cenasCom(passos, so, null))).toEqual(["b_um00001"]);
  });

  // A CONTAGEM DAS RESPOSTAS PÚBLICAS PASSOU A SER POR CAMINHO, e não por
  // array. É a consequência certa: `commentReplyKey` (lib/dedupe.ts) engole a
  // SEGUNDA QUE EXECUTA, e só executa quem está no caminho percorrido. Uma
  // pública no braço A não faz a do braço B deixar de ser publicada — os dois
  // braços nunca rodam no mesmo disparo.
  it("a resposta pública de OUTRO braço não torna esta `repetida`", () => {
    const passos = [
      {
        id: "b_menu01",
        tipo: "dm",
        texto: "Qual?",
        botoes: [
          { id: "op_aaaaaa", rotulo: "A" },
          { id: "op_bbbbbb", rotulo: "B" },
        ],
      },
      { id: "b_puba001", tipo: "resposta_publica", textos: ["Do braço A"] },
      { id: "b_pubb001", tipo: "resposta_publica", textos: ["Do braço B"] },
    ] as Passo[];
    const so: Ligacao[] = [
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_puba001" },
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_pubb001" },
    ];
    const b = roteiro(passos, "comment", so, "b_pubb001");
    expect(trilha(b)).toEqual(["b_menu01", "b_pubb001"]);
    expect(b[1].itens[0]).toMatchObject({ situacao: "publicada", texto: "Do braço B" });
  });
});
