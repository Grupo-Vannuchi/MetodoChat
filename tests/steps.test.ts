import { describe, it, expect } from "vitest";
import {
  interpretar,
  passoEsperado,
  retomadaDoFallback,
  retomadaDoBotao,
  retomadaDoFollow,
  interrompeOFluxo,
  indiceDoPortao,
  cursorDesta,
  identidadeDoPasso,
  indiceDoId,
} from "../lib/steps";

describe("interpretar", () => {
  it("enfileira uma sequência simples até o fim", () => {
    const r = interpretar(
      [
        { tipo: "dm", texto: "oi" },
        { tipo: "dm", texto: "aqui está o link", url: "https://x.y" },
      ],
      0
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("para no passo que espera, e o inclui no que enfileira", () => {
    // O pedido de follow É enviado; o que para é o fluxo depois dele.
    const r = interpretar(
      [
        { tipo: "dm", texto: "oi" },
        { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
        { tipo: "dm", texto: "link" },
      ],
      0
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBe(1);
  });

  it("dm com botão e sem url é resposta rápida: enfileira e para", () => {
    // O fluxo antigo mandava as boas-vindas com botão e só seguia depois do
    // toque. Sem isto, o portão de follow consultaria a Meta antes de a pessoa
    // ter engajado.
    const r = interpretar(
      [
        { tipo: "dm", texto: "oi", botao_label: "quero!" },
        { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      ],
      0
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0]);
    expect(r.pararEm).toBe(0);
  });

  it("dm com botão E url é botão de link: não para", () => {
    // A pessoa abre o link e a vida segue — não há toque para esperar.
    const r = interpretar(
      [
        { tipo: "dm", texto: "o link", botao_label: "abrir", url: "https://x.y" },
        { tipo: "dm", texto: "depois" },
      ],
      0
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("dm sem botão não para", () => {
    const r = interpretar(
      [
        { tipo: "dm", texto: "oi" },
        { tipo: "dm", texto: "tchau" },
      ],
      0
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("retoma do índice pedido, sem repetir o que já saiu", () => {
    const r = interpretar(
      [
        { tipo: "dm", texto: "oi" },
        { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
        { tipo: "dm", texto: "link" },
      ],
      2
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([2]);
    expect(r.pararEm).toBeNull();
  });

  it("esperar não é enfileirado: ele atrasa o que vem depois", () => {
    const r = interpretar(
      [
        { tipo: "dm", texto: "link" },
        { tipo: "esperar", minutos: 60 },
        { tipo: "dm", texto: "lembrete" },
      ],
      0
    );
    expect(r.enfileirar.map((a) => [a.indice, a.atrasoSegundos])).toEqual([
      [0, 0],
      [2, 3600],
    ]);
  });

  it("esperas somam", () => {
    const r = interpretar(
      [
        { tipo: "esperar", minutos: 10 },
        { tipo: "esperar", minutos: 5 },
        { tipo: "dm", texto: "depois" },
      ],
      0
    );
    expect(r.enfileirar[0].atrasoSegundos).toBe(900);
  });

  it("pula passo inválido e diz por quê, em vez de estourar", () => {
    // Automação mal montada tem que virar linha em Atividade, não exceção que
    // derruba o webhook e faz a Meta reenviar por 36 horas.
    const r = interpretar(
      [{ tipo: "dm", texto: "ok" }, { tipo: "inventado" }, { tipo: "dm", texto: "fim" }],
      0
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 2]);
    expect(r.ignorados).toEqual([{ indice: 1, motivo: "tipo desconhecido: inventado" }]);
  });

  it("pula dm sem texto", () => {
    const r = interpretar([{ tipo: "dm" }, { tipo: "dm", texto: "vale" }], 0);
    expect(r.enfileirar.map((a) => a.indice)).toEqual([1]);
    expect(r.ignorados[0].motivo).toBe("dm sem texto");
  });

  it("lista que não é lista não estoura", () => {
    const r = interpretar(null, 0);
    expect(r.enfileirar).toEqual([]);
    expect(r.pararEm).toBeNull();
    expect(r.ignorados[0].motivo).toBe("a automação não tem lista de passos");
  });

  it("lista VAZIA registra o motivo, em vez de entregar zero em silêncio", () => {
    // Impede a única falha do produto que não deixaria rastro em Atividade: o
    // laço não itera, o resultado fica igual ao de uma lista que TERMINOU, o
    // motor limpa o cursor e ninguém recebe nada — sem nenhum evento dizendo
    // por quê. E `[]` é o `default '[]'::jsonb` da coluna, ou seja, é o que
    // toda automação criada antes desta branch tem até ser salva de novo.
    const r = interpretar([], 0);
    expect(r.enfileirar).toEqual([]);
    expect(r.pararEm).toBeNull();
    expect(r.ignorados).toEqual([{ indice: -1, motivo: "a automação não tem nenhum passo" }]);
    // Motivo PRÓPRIO: quem lê Atividade precisa distinguir "a coluna não é uma
    // lista" (dado corrompido) de "a lista está vazia" (automação sem fluxo).
    expect(r.ignorados[0].motivo).not.toBe(interpretar(null, 0).ignorados[0].motivo);
  });

  it("dm com rótulo VAZIO não espera nada", () => {
    // Impede o fluxo travar para sempre: string vazia é ausência de rótulo, e
    // sem rótulo o dreno não monta botão nenhum. Se ela contasse como resposta
    // rápida, `interpretar` pararia num passo cujo botão nunca foi entregue —
    // não haveria o que tocar, e o link nunca sairia.
    const r = interpretar(
      [
        { tipo: "dm", texto: "oi", botao_label: "" },
        { tipo: "dm", texto: "o link", url: "https://x.y" },
      ],
      0
    );
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("índice além do fim devolve nada, sem estourar", () => {
    const r = interpretar([{ tipo: "dm", texto: "oi" }], 99);
    expect(r.enfileirar).toEqual([]);
    expect(r.pararEm).toBeNull();
  });

  it("esperar com minutos inválido é ignorado e não atrasa nada", () => {
    const r = interpretar(
      [{ tipo: "esperar", minutos: -5 }, { tipo: "dm", texto: "x" }],
      0
    );
    expect(r.enfileirar[0].atrasoSegundos).toBe(0);
    expect(r.ignorados[0].motivo).toBe("esperar com minutos inválido");
  });
});

describe("passoEsperado", () => {
  it("devolve o passo quando ele espera resposta", () => {
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "pedir_email", texto: "seu e-mail?" },
    ];
    expect(passoEsperado(passos, 0)?.tipo).toBe("dm");
    expect(passoEsperado(passos, 1)?.tipo).toBe("pedir_follow");
    expect(passoEsperado(passos, 2)?.tipo).toBe("pedir_email");
  });

  it("não devolve passo que não espera nada", () => {
    // Cursor obsoleto: a lista foi editada depois de ele ser gravado.
    const passos = [
      { tipo: "dm", texto: "o link", botao_label: "abrir", url: "https://x.y" },
      { tipo: "dm", texto: "texto puro" },
    ];
    expect(passoEsperado(passos, 0)).toBeUndefined();
    expect(passoEsperado(passos, 1)).toBeUndefined();
  });

  it("não devolve passo que o interpretador ignoraria", () => {
    // O ramo do cursor não pode tratar como pedido de e-mail um passo que nunca
    // chegou a ser enviado: ele consumiria a mensagem da pessoa como endereço.
    expect(passoEsperado([{ tipo: "pedir_email" }], 0)).toBeUndefined();
    expect(passoEsperado([{ tipo: "pedir_follow", botao_label: "x" }], 0)).toBeUndefined();
    expect(passoEsperado([{ tipo: "inventado" }], 0)).toBeUndefined();
  });

  it("índice inexistente ou lista que não é lista devolve undefined", () => {
    expect(passoEsperado([{ tipo: "dm", texto: "oi", botao_label: "b" }], 9)).toBeUndefined();
    expect(passoEsperado(null, 0)).toBeUndefined();
    expect(passoEsperado(undefined, 0)).toBeUndefined();
  });

  it("índice NEGATIVO devolve undefined", () => {
    // O que este teste fixa é a SEMÂNTICA DE INDEXAÇÃO, e só isso: acesso por
    // `passos[i]`, em que índice negativo é propriedade inexistente e devolve
    // undefined — não o último elemento, como em linguagens que contam de trás
    // para frente. Trocar o acesso por algo como `.at(i)` mudaria o resultado
    // em silêncio, e o ramo do cursor passaria a tratar o ÚLTIMO passo da lista
    // como o passo esperado.
    //
    // O que ele NÃO faz, e a versão anterior deste comentário prometia: impedir
    // um cenário real. Nenhum caminho grava índice negativo — `interpretar` já
    // faz `Math.max(0, deIndice)` e o cursor só recebe índices de passo. É rede
    // contra mudança de implementação, não contra dado do banco.
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "pedir_email", texto: "seu e-mail?" },
    ];
    expect(passoEsperado(passos, -1)).toBeUndefined();
    expect(passoEsperado(passos, -2)).toBeUndefined();
  });
});

describe("interrompeOFluxo", () => {
  const parada = { id: "A", match_type: "contains" };

  it("a mesma automação não interrompe a si mesma", () => {
    // Impede o defeito que fazia o link nunca sair, em silêncio: quem respondia
    // à boas-vindas repetindo a própria palavra-chave era tratado como pedido de
    // outra coisa, o fluxo reiniciava do índice 0, parava de novo na boas-vindas
    // e não enfileirava nada — a `passoKey` do dia já estava na fila e o
    // `on conflict do nothing` engolia o item. O cursor não andava, nenhuma
    // mensagem saía, e no dia seguinte a boas-vindas era reenviada.
    expect(interrompeOFluxo({ id: "A", match_type: "contains" }, parada)).toBe(false);
  });

  it("outra automação com palavra-chave específica interrompe", () => {
    // Impede o oposto: sem isto, quem está parado esperando o toque num botão
    // fica surdo a toda outra automação. A pessoa digitou a palavra-chave da B —
    // é pedido explícito, e não atendê-lo prende o contato na A para sempre.
    expect(interrompeOFluxo({ id: "B", match_type: "contains" }, parada)).toBe(true);
  });

  it('outra automação em "Qualquer texto" NÃO interrompe', () => {
    // Impede o sequestro: uma automação com `match_type: "any"` casa com toda
    // mensagem, de todo mundo, sempre. Quando ela podia interromper, qualquer
    // resposta de quem estava no meio de outro fluxo era lida como gatilho dela,
    // todo contato parado era arrastado para a mesma automação, e ninguém
    // chegava ao link.
    expect(interrompeOFluxo({ id: "B", match_type: "any" }, parada)).toBe(false);
  });

  it("nenhuma automação casada não interrompe", () => {
    // Sem gatilho novo não há o que interromper: a mensagem é resposta ao passo
    // em que a pessoa está parada, e tratá-la como interrupção descartaria o
    // cursor de quem só estava conversando.
    expect(interrompeOFluxo(undefined, parada)).toBe(false);
  });
});

describe("indiceDoPortao", () => {
  it("na lista do formulário, o portão NÃO é o índice 0", () => {
    // Este é o teste que prova que a correção faz diferença. O ramo `FOLLOW:`
    // caía no zero quando o cursor não era desta automação, e o comentário
    // dizia que "a lista é percorrida desde o início e o portão é reavaliado no
    // lugar certo". É falso para TODA lista que o formulário produz, e por
    // construção: a boas-vindas é obrigatória (o `saveAutomation` recusa salvar
    // sem ela), vem sempre antes do portão, e o rótulo do botão tem padrão não
    // vazio — rótulo sem url é resposta rápida, ou seja, PARADA DURA.
    //
    // `interpretar` a partir do zero para na boas-vindas e nunca chega ao
    // portão: o toque em "Já sigo!" não fazia nada.
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "Quero o link! 🔗" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo! ✅" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(indiceDoPortao(passos)).toBe(1);
    expect(indiceDoPortao(passos)).not.toBe(0);
    // E a confirmação do porquê: do zero, o fluxo para antes do portão.
    expect(interpretar(passos, 0).pararEm).toBe(0);
  });

  it("lista sem pedir_follow devolve null", () => {
    // Quem chama cai no `?? 0` — lista sem portão nenhum não tem o que afirmar.
    expect(indiceDoPortao([{ tipo: "dm", texto: "oi", botao_label: "b" }])).toBeNull();
    expect(indiceDoPortao([])).toBeNull();
    expect(indiceDoPortao(null)).toBeNull();
  });

  it("portão INVÁLIDO não conta, e o válido depois dele é o encontrado", () => {
    // Mesma regra de `contarParadasDuras` e `passoEsperado`: `interpretar`
    // ignora o passo inválido, então ele nunca foi enviado e não é portão. Se
    // ele contasse, o toque em "Já sigo!" retomaria de um passo que a pessoa
    // nunca recebeu — e tudo o que vem depois dele sairia sem portão nenhum,
    // que é entregar o link a quem não segue.
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "pedir_follow", botao_label: "já sigo" }, // sem texto: inválido
      { tipo: "pedir_follow", texto: "me segue mesmo", botao_label: "já sigo" },
    ];
    expect(indiceDoPortao(passos)).toBe(2);
  });

  it("portão sem rótulo de botão CONTA — `conferir` só exige o texto", () => {
    // Está aqui porque é contraintuitivo e alguém vai querer "consertar":
    // `Passo` declara `botao_label` obrigatório no `pedir_follow`, mas
    // `conferir` valida só o texto. Apertar `conferir` faria `interpretar`
    // IGNORAR esse portão — e ignorar um portão é pular o portão, entregando o
    // que vem depois a quem não segue. Sem rótulo o pedido sai sem botão, o que
    // é ruim mas ainda barra; ignorado, não barra nada.
    expect(indiceDoPortao([{ tipo: "pedir_follow", texto: "me segue" }])).toBe(0);
  });

  it("o primeiro portão vence, quando há mais de um", () => {
    // A consequência, que o nome não diz: `FOLLOW:<id>` nomeia a automação, não
    // o portão. Quem estava parado no SEGUNDO portão e toca em "Já sigo!" sem
    // cursor desta automação retoma no PRIMEIRO, e o que houver entre os dois é
    // reentregue. Inalcançável pelo formulário, que emite um portão só;
    // alcançável por lista montada à mão, que é para onde a Fase 1b vai.
    const passos = [
      { tipo: "pedir_follow", texto: "a", botao_label: "x" },
      { tipo: "pedir_follow", texto: "b", botao_label: "y" },
    ];
    expect(indiceDoPortao(passos)).toBe(0);
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", passos)).toBe(0);
  });
});

describe("cursorDesta", () => {
  it("devolve o id do bloco quando o cursor é desta automação", () => {
    expect(cursorDesta({ passoId: "b_aaa111", automationId: "A" }, "A")).toBe("b_aaa111");
  });

  it("devolve null quando o cursor é de OUTRA automação", () => {
    // Aplicar o cursor de B à lista de A já entregou o link a quem não segue.
    expect(cursorDesta({ passoId: "b_aaa111", automationId: "B" }, "A")).toBe(null);
  });

  it("devolve null quando não há cursor", () => {
    expect(cursorDesta({ passoId: null, automationId: "A" }, "A")).toBe(null);
    expect(cursorDesta({ passoId: null, automationId: null }, "A")).toBe(null);
  });

  it("bloco SEM automação não é desta automação — é a forma que `lerCursor` emite", () => {
    // Não é caso inventado: `lerCursor` (lib/engine.ts) monta exatamente isto
    // quando `last_automation_id` está nulo e `flow_step_id` não. Acontece de
    // verdade — `limparCursor` zera o cursor sem tocar `last_automation_id`, e
    // os `upsertContact` dos gatilhos escrevem `last_automation_id` sozinhos —,
    // e um bloco sem automação não afirma nada: a identidade só é única dentro
    // de UMA lista. Aplicá-la à lista de A é o defeito que esta função mata.
    expect(cursorDesta({ passoId: "x", automationId: null }, "A")).toBe(null);
  });
});

describe("retomadaDoFallback", () => {
  it("na lista típica, retoma depois da boas-vindas", () => {
    // Impede o defeito de reenviar a boas-vindas: retomar do zero reinterpretava
    // a lista inteira e reenfileirava a mensagem que a pessoa acabou de receber
    // — e sem colisão de chave, porque a primeira saiu como `privateReplyKey` e
    // a repetição sairia como `passoKey`. Duas mensagens iguais, pessoa real.
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(passos)).toBe(1);
  });

  it("quando o ponto de espera é o portão de follow, retoma DELE MESMO", () => {
    // Impede entregar o link a quem não segue: pular o portão para "adiantar" o
    // fluxo dispensaria a consulta à Meta, e bastaria mandar qualquer texto para
    // receber o link sem nunca ter seguido.
    const passos = [
      { tipo: "dm", texto: "oi" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(passos)).toBe(1);
  });

  it("lista sem ponto de espera não retoma nada", () => {
    // Impede repetir a lista inteira: sem passo de espera tudo já foi
    // enfileirado, link incluído, e retomar do zero mandaria tudo de novo.
    const passos = [
      { tipo: "dm", texto: "oi" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(passos)).toBeNull();
    // Automação sem lista nenhuma: o `steps` vem CRU do banco.
    expect(retomadaDoFallback(null)).toBeNull();
  });

  it("com duas dm de resposta rápida, não retoma nada", () => {
    // Impede a mensagem repetida que a Fase 1b vai tornar possível: a dedução
    // supõe que o primeiro ponto de espera é o último passo entregue, e com dois
    // botões na lista isso pode ser falso — a pessoa pode ter tocado no primeiro
    // e travado no segundo. Como nenhuma das duas é `dm_link`, o fallback
    // continua disparando a cada mensagem, e retomar do índice deduzido
    // REENVIARIA a segunda. Mandar nada é recuperável; mandar de novo não é.
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "dm", texto: "confirma?", botao_label: "confirmo" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(passos)).toBeNull();
  });
});

// A lista que o formulário grava, com lembrete: é nela que os dois ramos de
// resposta rápida decidem, e é dela que saem os índices citados abaixo.
const listaDoFormulario = [
  { tipo: "dm", texto: "oi", botao_label: "Quero o link! 🔗" }, // 0 parada dura
  { tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo! ✅" }, // 1 portão
  { tipo: "dm", texto: "o link", botao_label: "Abrir link", url: "https://x.y" }, // 2
  { tipo: "esperar", minutos: 60 }, // 3
  { tipo: "dm", texto: "não esquece do link" }, // 4
];

describe("retomadaDoBotao", () => {
  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com", botao_label: "Abrir" },
  ];

  it("cursor numa dm de resposta rápida retoma do SEGUINTE — o toque É a resposta", () => {
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", lista)).toBe(1);
  });

  it("cursor num PORTÃO retoma DELE — o toque não entrega o follow", () => {
    // Sem isto, tocar no botão antigo da boas-vindas pulava o portão e o link
    // saía para quem não segue.
    expect(retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", lista)).toBe(1);
  });

  it("o id sobrevive à REORDENAÇÃO — é o ponto desta fase", () => {
    // Mesma lista, ordem trocada: o cursor continua achando o portão, agora
    // no índice 2. Com índice, ele apontaria para o bloco errado.
    const trocada = [lista[0], lista[2], lista[1]];
    expect(retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", trocada)).toBe(2);
  });

  it("cursor de outra automação retoma do zero", () => {
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "B" }, "A", lista)).toBe(0);
  });

  it("cursor NULO retoma do zero", () => {
    // A outra metade do `cursorDesta` devolvendo null, e ela é o caso comum:
    // quem nunca começou o fluxo, e quem o TERMINOU (`executarFluxo` limpa o
    // cursor no fim da lista) — a coluna não separa os dois. O zero é o único
    // ponto afirmável, e o preço é uma mensagem repetida, segurada pela
    // `passoKey` dentro do dia.
    expect(retomadaDoBotao({ passoId: null, automationId: "A" }, "A", lista)).toBe(0);
    expect(retomadaDoBotao({ passoId: null, automationId: null }, "A", lista)).toBe(0);
  });

  it("bloco APAGADO retoma do zero", () => {
    // O que esta fase PRETENDE é que este ramo só seja alcançado quando o dono
    // apagar aquele bloco de verdade — antes, com índice, ele era alcançado a
    // cada edição que mexesse no começo da lista.
    //
    // HOJE ele ainda é alcançado a cada SALVAMENTO. `montarPassos`
    // (app/automacoes/actions.ts) gera id novo para todo bloco a cada save e
    // grava o `steps` inteiro sem casar com os ids antigos, então todo save
    // pelo formulário — o único editor até a Tarefa 8 — órfã o cursor de todo
    // mundo que estiver em fluxo. Fecha quando o quadro substituir o formulário
    // e preservar os ids ao salvar.
    expect(retomadaDoBotao({ passoId: "b_sumiu9", automationId: "A" }, "A", lista)).toBe(0);
  });

  it("cursor por índice, gravado antes desta fase, continua funcionando", () => {
    // Lista sem ids e cursor "0": a identidade do primeiro bloco é "0".
    const antiga = [{ tipo: "dm", texto: "Oi!", botao_label: "Quero" }, { tipo: "dm", texto: "Link", url: "https://x.com" }];
    expect(retomadaDoBotao({ passoId: "0", automationId: "A" }, "A", antiga)).toBe(1);
  });

  it("cursor num PEDIDO DE E-MAIL retoma DELE, não do seguinte", () => {
    // O pedido de e-mail é portão pelo mesmo critério do de follow: o toque no
    // botão `AUTO:` antigo não é a resposta que ele espera. Com o `+1`, o pedido
    // era pulado e o endereço nunca era capturado — o dono marcou "pedir e-mail"
    // justamente para capturá-lo, e pular em silêncio esvazia a opção.
    //
    // Retomar dele é idempotente: `executarFluxo` pula o passo sozinho quando
    // `contacts.email` já está preenchido, então quem respondeu não fica preso;
    // e quem não respondeu recebe o pedido de novo, deduplicado por
    // `emailAskKey` no balde do dia.
    const passos = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" },
      { id: "b_eml004", tipo: "pedir_email", texto: "seu e-mail?" },
      { id: "b_lnk003", tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", passos)).toBe(1);
    expect(retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", passos)).not.toBe(2);
    // Pedido INVÁLIDO não é portão, pela mesma regra do `pedir_follow` sem
    // texto: `interpretar` o ignora, logo ele nunca foi enviado.
    const comPedidoQuebrado = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" },
      { id: "b_eml004", tipo: "pedir_email", texto: "   " }, // texto em branco
    ];
    expect(retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", comPedidoQuebrado)).toBe(2);
  });

  it("bloco que EXISTE mas não espera mais nada avança um", () => {
    // A OUTRA forma de cursor obsoleto, e a que o id não elimina: o bloco
    // continua na lista, mas foi editado e deixou de esperar resposta. Ela não
    // cai no zero — avançar não pula portão nenhum, porque passo que não espera
    // não é portão, e os que vierem depois continuam sendo interpretados. Do
    // zero, a alternativa, a boas-vindas sairia de novo.
    //
    // O índice 2 de `listaDoFormulario` é o link (rótulo E url): virou botão de
    // link, e botão de link não espera toque nenhum.
    expect(retomadaDoBotao({ passoId: "2", automationId: "A" }, "A", listaDoFormulario)).toBe(3);
    // Portão INVÁLIDO não é portão: `interpretar` o ignora, logo ele nunca foi
    // entregue e não há o que reavaliar.
    const comPortaoQuebrado = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" },
      { id: "b_por002", tipo: "pedir_follow", botao_label: "já sigo" }, // sem texto
    ];
    expect(retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", comPortaoQuebrado)).toBe(2);
    // E quando o `+1` cai além do fim, `interpretar` não enfileira nada: o
    // toque não faz nada, e a pessoa destrava mandando qualquer mensagem.
    expect(interpretar(listaDoFormulario, 5).enfileirar).toEqual([]);
  });

  it("lista que NÃO É LISTA retoma do zero, sem estourar", () => {
    // Mesmo ramo do bloco apagado: `indiceDoId` devolve null quando `steps` não
    // é um array. Antes desta fase isto caía no `+1` e devolvia 2 — um índice
    // inventado sobre uma lista que não existe.
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", null)).toBe(0);
  });
});

describe("retomadaDoFollow", () => {
  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" },
  ];

  it("cursor desta automação retoma DELE, para o portão ser reavaliado", () => {
    expect(retomadaDoFollow({ passoId: "b_por002", automationId: "A" }, "A", lista)).toBe(1);
  });

  it("sem cursor desta, retoma do PORTÃO — o toque afirma onde a pessoa está", () => {
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", lista)).toBe(1);
    expect(retomadaDoFollow({ passoId: "b_bem001", automationId: "B" }, "A", lista)).toBe(1);
  });

  it("lista sem portão nenhum retoma do zero", () => {
    const semPortao = [{ id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }];
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", semPortao)).toBe(0);
  });

  // Os casos acima NÃO fixam nada, e isso foi provado por mutação: com o corpo
  // trocado por `return indiceDoPortao(passos) ?? 0` — ignorando o cursor e a
  // automação por completo — todos eles continuam verdes. A causa é que em
  // `lista` o portão está no índice 1, que é justamente a resposta esperada em
  // todos eles. Os casos abaixo existem para separar as duas implementações, e
  // cada um diz o que a cega devolveria.
  //
  // Nesta lista o portão está no 1 e há blocos DEPOIS dele, então "retoma do
  // cursor" e "retoma do portão" deixam de coincidir.
  const comEmailDepoisDoPortao = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1 portão
    { id: "b_eml004", tipo: "pedir_email", texto: "seu e-mail?" }, // 2
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 3
  ];

  it("cursor DESTA num bloco DEPOIS do portão retoma DELE, não do portão", () => {
    // O caso mais barato que separa as duas implementações: a certa devolve 2,
    // a cega devolve 1. Sem ele, nada nesta suíte afirma que a função lê o
    // cursor — e esta é a função do botão "Já sigo!".
    //
    // Retomar do portão aqui seria reentrega: a pessoa já atravessou o portão
    // (é por isso que o cursor está adiante dele), e voltar reenfileiraria tudo
    // entre os dois.
    expect(
      retomadaDoFollow({ passoId: "b_eml004", automationId: "A" }, "A", comEmailDepoisDoPortao)
    ).toBe(2);
  });

  it("o bloco do cursor NÃO precisa ser portão — vale para qualquer um", () => {
    // Mesma lista, cursor no link (índice 3), que não é portão de espécie
    // nenhuma. A certa devolve 3, a cega devolve 1.
    expect(
      retomadaDoFollow({ passoId: "b_lnk003", automationId: "A" }, "A", comEmailDepoisDoPortao)
    ).toBe(3);
  });

  it("ZERO é identidade legítima, e não ausência de cursor", () => {
    // O `??` de `retomadaDoFollow` tem que ser `??` e não `||`. Com `||`, o
    // índice 0 — falsy — seria lido como "não achei" e a função cairia no
    // portão: a pessoa parada na boas-vindas seria empurrada para o portão.
    //
    // A certa devolve 0; tanto a versão com `||` quanto a cega devolvem 1.
    expect(retomadaDoFollow({ passoId: "b_bem001", automationId: "A" }, "A", lista)).toBe(0);
  });

  it("bloco APAGADO cai no PORTÃO, e não no zero", () => {
    // Ramo NOVO desta fase, e ele não existia com índice: um índice sempre
    // resolvia para alguma coisa, então o cursor desta automação nunca caía no
    // `??`. Agora `indiceDoId` sabe dizer "esse bloco não está mais aqui", e o
    // ponto afirmável volta a ser o portão — pela mesma razão do cursor
    // ausente: o `FOLLOW:<id>` só existe porque o portão DESTA automação foi
    // entregue.
    expect(retomadaDoFollow({ passoId: "b_sumiu9", automationId: "A" }, "A", lista)).toBe(1);

    // E com o portão LONGE do começo, para o acerto não vir do lugar errado.
    //
    // Com a medida certa: contra a versão CEGA este caso não discrimina, e não
    // tem como discriminar — neste ramo a implementação certa também devolve
    // `indiceDoPortao`, então as duas concordam por construção. O que ele fixa
    // são os outros erros plausíveis: cair no zero (devolveria 0), parar na
    // primeira parada dura (0), ou parar no primeiro passo que espera resposta
    // (1, o pedido de e-mail). A resposta certa é 3, e nenhum desses a alcança.
    const portaoLaAtras = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0 parada dura
      { id: "b_eml004", tipo: "pedir_email", texto: "seu e-mail?" }, // 1
      { id: "b_esp005", tipo: "esperar", minutos: 5 }, // 2
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 3 portão
      { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 4
    ];
    expect(retomadaDoFollow({ passoId: "b_sumiu9", automationId: "A" }, "A", portaoLaAtras)).toBe(3);
  });

  it("cursor por índice, gravado antes desta fase, continua funcionando", () => {
    // `listaDoFormulario` não tem ids: a identidade do portão é "1".
    expect(retomadaDoFollow({ passoId: "1", automationId: "A" }, "A", listaDoFormulario)).toBe(1);
    // E do zero seria no-op: `interpretar` para na boas-vindas (parada dura) e
    // nunca chega ao portão.
    expect(interpretar(listaDoFormulario, 0).pararEm).toBe(0);
  });

  it("lista que NÃO É LISTA retoma do zero, sem estourar", () => {
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", null)).toBe(0);
    expect(retomadaDoFollow({ passoId: "b_por002", automationId: "A" }, "A", null)).toBe(0);
  });
});

describe("identidade do passo", () => {
  // A identidade é o que entra na chave de deduplicação. Antes era o índice,
  // e por isso arrastar um bloco reenviava tudo que vinha depois dele.

  it("usa o id quando ele existe e tem a forma certa", () => {
    expect(identidadeDoPasso({ id: "b_7f3a91c2", tipo: "dm", texto: "oi" }, 5)).toBe("b_7f3a91c2");
  });

  it("cai no índice quando não há id — bloco gravado antes desta fase", () => {
    // Isto NÃO é tolerância a dado ruim: é o que faz a chave de um bloco
    // antigo continuar igual à que já está na fila, ou seja, é o que impede
    // o deploy de reenviar mensagem para quem já recebeu.
    expect(identidadeDoPasso({ tipo: "dm", texto: "oi" }, 5)).toBe("5");
  });

  it("recusa id com forma errada e cai no índice", () => {
    // Sem o prefixo `b_`, um id como "2" colidiria com a chave por índice de
    // OUTRO bloco. O formato é a defesa contra isso.
    expect(identidadeDoPasso({ id: "2", tipo: "dm", texto: "oi" }, 5)).toBe("5");
    expect(identidadeDoPasso({ id: "", tipo: "dm", texto: "oi" }, 5)).toBe("5");
    expect(identidadeDoPasso({ id: 7, tipo: "dm", texto: "oi" }, 5)).toBe("5");
  });

  it("passo que não é objeto cai no índice sem estourar", () => {
    expect(identidadeDoPasso(null, 3)).toBe("3");
    expect(identidadeDoPasso("x", 3)).toBe("3");
  });
});

describe("indiceDoId", () => {
  const lista = [
    { id: "b_aaa111", tipo: "dm", texto: "um" },
    { tipo: "dm", texto: "dois" },
    { id: "b_ccc333", tipo: "dm", texto: "três" },
  ];

  it("acha o bloco pelo id, esteja ele onde estiver", () => {
    expect(indiceDoId(lista, "b_ccc333")).toBe(2);
  });

  it("acha bloco antigo pela identidade por índice", () => {
    // O bloco do meio não tem id; a identidade dele é "1". Um cursor gravado
    // antes desta fase guarda exatamente isso.
    expect(indiceDoId(lista, "1")).toBe(1);
  });

  it("devolve null quando o bloco não existe mais — foi apagado", () => {
    expect(indiceDoId(lista, "b_zzz999")).toBe(null);
  });

  it("SEM id, editar a lista faz a identidade apontar OUTRO bloco — limitação conhecida", () => {
    // Este teste DOCUMENTA UMA LIMITAÇÃO, não um comportamento desejado.
    //
    // Para bloco sem id a identidade é a posição, e posição não acompanha o
    // bloco. Apagar um bloco antes dele não devolve null: devolve outro bloco,
    // calado. É o modo de falhar mais caro que existe aqui, porque o cursor
    // (Tarefa 2) é montado em cima desta função e retomar do bloco errado é
    // entregar o link a quem não segue.
    //
    // O que segura isso é o dado, não o código: a migração
    // (scripts/dar-ids-aos-passos.mjs) dá id a todo bloco já gravado, e
    // `montarPassos` grava id em tudo que cria. O teste existe para a premissa
    // não deixar de valer em silêncio.
    // São precisos DOIS blocos sem id para o erro ser SILENCIOSO. Com um só, a
    // identidade some da lista e a função devolve null — errado, mas barulhento.
    const antes = [
      { id: "b_aaa111", tipo: "dm", texto: "um" },
      { tipo: "dm", texto: "dois" }, // sem id: identidade "1"
      { tipo: "dm", texto: "três" }, // sem id: identidade "2"
    ];
    const i = indiceDoId(antes, "1");
    expect(antes[i ?? -1]).toBe(antes[1]);

    // O dono apaga o primeiro bloco. As identidades viram "0" e "1".
    const depois = [antes[1], antes[2]];
    const j = indiceDoId(depois, "1");
    // Não é null — é isto que o comentário de `indiceDoId` afirmava ao contrário.
    expect(j).toBe(1);
    expect(depois[j ?? -1]).toBe(antes[2]);
    expect(depois[j ?? -1]).not.toBe(antes[1]);
  });

  it("devolve null quando não é lista", () => {
    expect(indiceDoId(null, "b_aaa111")).toBe(null);
    expect(indiceDoId({}, "b_aaa111")).toBe(null);
  });
});
