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
      expect(cenasCom(passos, setas, null)[1].itens[1]).toEqual({
        tipo: "botoes",
        botoes: [
          { rotulo: "De novo", escolhido: false },
          { rotulo: "Voltar", escolhido: false },
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

  // A `senao` É DE QUEM DIGITOU, e a prévia não a percorre — nem para chegar ao
  // bloco selecionado, nem para seguir dali. O motivo está em `roteiro.ts`: a
  // conversa desenhada é a de quem TOCA, e a prévia não tem o que a pessoa
  // digitou para pôr no balão dela.
  it("a `senao` não entra no caminho mostrado", () => {
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
    // A `senao` foi gravada ANTES da ligação do botão, de propósito: se a
    // caminhada seguisse "a primeira seta que sai", ela ganharia.
    const so: Ligacao[] = [
      { de: "b_menu01", quando: { tipo: "senao" }, para: "b_digit1" },
      { de: "b_menu01", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_tocou1" },
    ];
    expect(trilha(cenasCom(passos, so, null))).toEqual(["b_menu01", "b_tocou1"]);
    // E o bloco da `senao` é inalcançável pela prévia: abri-lo mostra só ele.
    expect(trilha(cenasCom(passos, so, "b_digit1"))).toEqual(["b_digit1"]);
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
