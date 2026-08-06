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
  lerPayload,
  cursorDaRetomada,
  conferirLista,
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
    // Desde a Fase 1b, `FOLLOW:<automação>:<bloco>` nomeia o BLOCO em que a
    // pessoa tocou — o comentário de `indiceDoPortao` (lib/steps.ts) já foi
    // corrigido para dizer isso. Quando o bloco resolve, `retomadaDoFollow`
    // acha aquele portão direto e nem chega a `indiceDoPortao`.
    //
    // Este teste cobre o que SOBRA: payload sem bloco algum (é o que
    // `retomadaDoFollow` recebe aqui, `passoId: null`) — a forma antiga
    // `FOLLOW:<automação>`, que continua tocável para sempre, ou o cursor não
    // resolvendo por nenhum caminho. Nesses casos o primeiro portão ainda
    // vence: quem estava parado no SEGUNDO e toca em "Já sigo!" sem cursor
    // desta automação retoma no PRIMEIRO, e o que houver entre os dois é
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

describe("lerPayload", () => {
  // Um botão já entregue vive na conversa da pessoa PARA SEMPRE — ela pode
  // tocar nele daqui a um mês. Por isso as duas formas convivem, e isto não é
  // dívida a limpar: é a forma final.

  it("lê a forma nova, com o bloco", () => {
    expect(lerPayload("AUTO:auto-1:b_7f3a91c2")).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: "b_7f3a91c2",
    });
  });

  it("lê a forma ANTIGA, sem o bloco — botão entregue antes da Fase 1b", () => {
    expect(lerPayload("AUTO:auto-1")).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: null,
    });
  });

  it("vale para o FOLLOW nas duas formas", () => {
    expect(lerPayload("FOLLOW:auto-1:b_por002")).toEqual({
      prefixo: "FOLLOW",
      automationId: "auto-1",
      passoId: "b_por002",
    });
    expect(lerPayload("FOLLOW:auto-1")).toEqual({
      prefixo: "FOLLOW",
      automationId: "auto-1",
      passoId: null,
    });
  });

  it("o id da automação é um uuid, que tem hífen mas não dois-pontos", () => {
    expect(lerPayload("AUTO:39ae24ec-c487-40ff-a387-c041cb3f0d23:b_aaa111")).toEqual({
      prefixo: "AUTO",
      automationId: "39ae24ec-c487-40ff-a387-c041cb3f0d23",
      passoId: "b_aaa111",
    });
  });

  it("o bloco SEM id vira identidade por índice, e ela também cabe no payload", () => {
    // `identidadeDoPasso` devolve o índice em texto para bloco sem id, e é essa
    // string que o motor põe no payload. Ela não tem forma especial nenhuma —
    // quem exigir aqui o prefixo `b_` recusaria o botão de toda automação que a
    // migração não alcançou, e o toque deixaria de fazer qualquer coisa.
    expect(lerPayload("AUTO:auto-1:2")).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: "2",
    });
  });

  it("devolve null para o que não é payload nosso", () => {
    // O webhook aceita o que a Meta mandar, e a Meta aceita o que o cliente
    // mandar. Nada aqui pode estourar.
    expect(lerPayload("OUTRACOISA:x")).toBe(null);
    expect(lerPayload("AUTO:")).toBe(null);
    expect(lerPayload("AUTO")).toBe(null);
    expect(lerPayload("")).toBe(null);
    expect(lerPayload(null)).toBe(null);
    expect(lerPayload(42)).toBe(null);
    expect(lerPayload("AUTO:a:b:c")).toBe(null);
  });

  it("bloco VAZIO na forma de três partes é null, e não bloco vazio", () => {
    // `AUTO:auto-1:` tem três partes, a última em branco. Deixar passar poria
    // `passoId: ""` no ramo do payload, e "" não é identidade de bloco nenhum:
    // `indiceDoId` devolveria null e o toque cairia no zero — a boas-vindas de
    // novo. Como null, o toque usa o cursor, que é o que ele já fazia antes.
    expect(lerPayload("AUTO:auto-1:")).toBe(null);
    expect(lerPayload("FOLLOW:auto-1:")).toBe(null);
  });

  it("o prefixo é conferido por igualdade, não por parecença", () => {
    // Nada nosso emite estas formas. Elas estão aqui porque o payload volta do
    // cliente pela Meta: quem afrouxar a comparação (minúsculas, `startsWith`,
    // `includes`) passa a aceitar string digitada por terceiro como se fosse
    // botão nosso, e o toque falso retoma o fluxo de uma automação escolhida
    // por quem digitou.
    expect(lerPayload("auto:auto-1")).toBe(null);
    expect(lerPayload("AUTOX:auto-1")).toBe(null);
    expect(lerPayload("XAUTO:auto-1")).toBe(null);
    expect(lerPayload(" AUTO:auto-1")).toBe(null);
  });

  it("lê de volta exatamente o que o motor emite — as duas pontas casam", () => {
    // O motor monta o payload com `identidadeDoPasso` (lib/engine.ts), e este
    // teste é o único lugar em que as duas pontas se encontram: o que monta o
    // payload está dentro de `server-only` e nenhum teste chega lá. Se o formato
    // emitido e o formato lido divergirem, o sintoma não é erro — é o botão
    // parar de fazer efeito, calado.
    const lista = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    ];
    const automationId = "39ae24ec-c487-40ff-a387-c041cb3f0d23";

    const doBotao = `AUTO:${automationId}:${identidadeDoPasso(lista[0], 0)}`;
    const lidoDoBotao = lerPayload(doBotao);
    expect(lidoDoBotao).toEqual({ prefixo: "AUTO", automationId, passoId: "b_bem001" });
    expect(indiceDoId(lista, lidoDoBotao!.passoId!)).toBe(0);

    const doPortao = `FOLLOW:${automationId}:${identidadeDoPasso(lista[1], 1)}`;
    const lidoDoPortao = lerPayload(doPortao);
    expect(lidoDoPortao).toEqual({ prefixo: "FOLLOW", automationId, passoId: "b_por002" });
    expect(indiceDoId(lista, lidoDoPortao!.passoId!)).toBe(1);
  });

  it("o bloco do payload, quando é a RESERVA, vira cursor desta automação", () => {
    // O uso: quando o cursor do contato não serve, `cursorDaRetomada` entrega o
    // bloco do payload como cursor desta automação, e é ele que entra em
    // `retomadaDoBotao`/`retomadaDoFollow`. Isto fixa a consequência do bloco no
    // payload, para ela não mudar em silêncio — nesse caminho, e SÓ nele, o
    // bloco é o do BOTÃO e não o do lugar onde a pessoa parou. Quando o cursor
    // serve, ele manda: ver `describe("cursorDaRetomada")`.
    const lista = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
      { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 2
    ];
    const p = lerPayload("AUTO:A:b_bem001")!;
    const cursorDoPayload = { passoId: p.passoId, automationId: "A" };
    // O toque na boas-vindas retoma do SEGUINTE, que é o portão: o portão
    // continua sendo atravessado por `resolverFollow`, e não pulado.
    expect(retomadaDoBotao(cursorDoPayload, "A", lista)).toBe(1);

    // Já o botão cujo bloco não está mais na lista não afirma nada, e cai no
    // zero — a boas-vindas de novo. Com o cursor mandando, chegar aqui exige que
    // os DOIS blocos tenham sumido, o do cursor e o do botão: é o que um save
    // faz de uma vez enquanto `montarPassos` (app/automacoes/actions.ts) gerar id
    // novo a cada salvamento. Fecha na Tarefa 8.
    const doApagado = lerPayload("AUTO:A:b_sumiu9")!;
    expect(retomadaDoBotao({ passoId: doApagado.passoId, automationId: "A" }, "A", lista)).toBe(0);
  });

  it("o payload SALVA quem está no meio de OUTRA automação", () => {
    // O ganho mais concreto da forma nova. Cenário: a pessoa está parada na
    // automação B, e toca num botão antigo da A, que continua na conversa dela.
    //
    // Este é EXATAMENTE o caminho da reserva, e o único em que o payload decide:
    // `cursorDesta` descarta o cursor de B, então não sobra nada a afirmar além
    // do bloco do botão. A composição está fixada em `describe("cursorDaRetomada")`;
    // aqui ficam as duas pontas, para ver de onde vem cada número.
    const lista = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
      { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 2
    ];
    const cursorEmOutra = { passoId: "b_qqq111", automationId: "B" };

    // Com o payload ANTIGO só havia o cursor do contato, que é de B: `cursorDesta`
    // o descarta e a A recomeça do ZERO — a boas-vindas de novo.
    expect(retomadaDoBotao(cursorEmOutra, "A", lista)).toBe(0);

    // Com o payload NOVO o bloco é o do botão da A, e a retomada é a certa.
    const p = lerPayload("AUTO:A:b_bem001")!;
    expect(retomadaDoBotao({ passoId: p.passoId, automationId: "A" }, "A", lista)).toBe(1);
  });

  it("no FOLLOW, os dois cursores possíveis dão respostas DIFERENTES", () => {
    // As duas pontas do ramo `FOLLOW:`, lado a lado, para ficar visível o que a
    // ORDEM entre elas decide — e ela é decidida em `cursorDaRetomada`, não
    // aqui.
    //
    // Com o cursor do contato (adiante do portão) a resposta é 3: a pessoa
    // continua onde estava. Com o bloco do payload a resposta é 1: ela volta ao
    // portão, e `executarFluxo` reenfileira tudo entre 1 e 3 — a `passoKey` só
    // segura isso dentro do dia.
    //
    // Uma versão anterior desta fase preferia o payload e produzia o 1. É por
    // isso que este par existe: enquanto os dois números forem diferentes, o
    // teste de composição em `describe("cursorDaRetomada")` tem o que separar.
    const lista = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
      { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 2
      { id: "b_lem006", tipo: "dm", texto: "não esquece" }, // 3
    ];
    const cursorAdiante = { passoId: "b_lem006", automationId: "A" };
    expect(retomadaDoFollow(cursorAdiante, "A", lista)).toBe(3);

    const p = lerPayload("FOLLOW:A:b_por002")!;
    expect(retomadaDoFollow({ passoId: p.passoId, automationId: "A" }, "A", lista)).toBe(1);
  });
});

describe("cursorDaRetomada", () => {
  // O CURSOR MANDA; o bloco do payload é reserva.
  //
  // Esta é a peça que faltava ter teste, e a ausência dela custou uma onda: a
  // escolha morava em lib/engine.ts, dentro de `server-only`, e quando ela
  // passou a preferir o payload, TODOS os testes de `retomadaDoFollow`
  // continuaram verdes — inclusive o que existe justamente para impedir que quem
  // atravessou o portão volte a ele. Teste de função pura não vê o motor trocar
  // o argumento que passa para ela. Enquanto a escolha estiver aqui, ele vê.

  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0 parada dura
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1 portão
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 2
    { id: "b_lem006", tipo: "dm", texto: "não esquece" }, // 3
  ];

  it("cursor DESTA automação que resolve MANDA, mesmo com bloco no payload", () => {
    // O ramo principal, e o que a inversão comprou. O botão fica congelado na
    // conversa desde o dia da entrega; o cursor é a informação mais recente.
    const real = { passoId: "b_lem006", automationId: "A" };
    expect(cursorDaRetomada(real, "A", "b_bem001", lista)).toEqual(real);
  });

  it("cursor de OUTRA automação cai no bloco do payload", () => {
    // Sem isto, tocar num botão antigo da A estando no meio da B recomeçava a A
    // do ZERO: `cursorDesta` descarta o cursor de B e não sobra o que afirmar.
    expect(cursorDaRetomada({ passoId: "b_qqq111", automationId: "B" }, "A", "b_bem001", lista)).toEqual({
      passoId: "b_bem001",
      automationId: "A",
    });
  });

  it("cursor de OUTRA automação cuja identidade EXISTE nesta lista não pode mandar", () => {
    // O caso que separa `const id = cursorDesta(real, automationId)` de
    // `const id = real.passoId` — a mutação mais perigosa possível aqui, porque
    // ela sobrevivia à suíte inteira (246 testes) sem um só falhar.
    //
    // Os outros testes de "cursor de OUTRA automação" (acima, e em
    // `retomadaDoBotao`/`retomadaDoFollow`) usam um id que TAMBÉM não existe na
    // lista de destino: `indiceDoId` devolve null pelos dois caminhos, e a
    // reserva ganha de qualquer jeito — a mutação fica invisível.
    //
    // Aqui o id do cursor de B COLIDE com a identidade de um bloco de A. Não é
    // hipótese remota: bloco sem id tem o índice em texto por identidade
    // (`identidadeDoPasso`), e "0" existe em toda lista não vazia — é o dado
    // legado, que existe hoje.
    //
    //   certa   → `cursorDesta` descarta o cursor de B (automação errada), a
    //             reserva entra e devolve o bloco do PAYLOAD, desta automação.
    //   mutante → `real.passoId` é "0", `indiceDoId(passos, "0")` acha o bloco 0
    //             de A, e a mutação devolve `real` inteiro — automationId "B" —
    //             deixando o cursor de B mandar na lista de A.
    const passos = [
      { tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0 — sem id, identidade "0"
      { tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
    ];
    const cursorDeB = { passoId: "0", automationId: "B" };
    expect(cursorDaRetomada(cursorDeB, "A", "1", passos)).toEqual({
      passoId: "1",
      automationId: "A",
    });
  });

  it("sem cursor nenhum, cai no bloco do payload", () => {
    expect(cursorDaRetomada({ passoId: null, automationId: null }, "A", "b_por002", lista)).toEqual({
      passoId: "b_por002",
      automationId: "A",
    });
  });

  it("cursor desta apontando para bloco APAGADO cai no bloco do payload", () => {
    // A conferência com `indiceDoId` é o que torna a reserva alcançável com
    // cursor desta automação presente. Sem ela, este caso devolveria o cursor
    // morto e a retomada cairia no zero.
    expect(cursorDaRetomada({ passoId: "b_sumiu9", automationId: "A" }, "A", "b_bem001", lista)).toEqual({
      passoId: "b_bem001",
      automationId: "A",
    });
  });

  it("payload SEM bloco vira cursor VAZIO, e não o cursor que não serve", () => {
    // Botão entregue antes da Fase 1b (`AUTO:<automação>`). Não há bloco a
    // afirmar, então a reserva é o vazio — e daí `retomadaDoBotao` cai no zero e
    // `retomadaDoFollow` cai no portão, que é o que os dois já faziam com cursor
    // nulo. A compatibilidade com o botão antigo sai sem ramo próprio.
    expect(cursorDaRetomada({ passoId: "b_qqq111", automationId: "B" }, "A", null, lista)).toEqual({
      passoId: null,
      automationId: null,
    });
    expect(cursorDaRetomada({ passoId: "b_sumiu9", automationId: "A" }, "A", null, lista)).toEqual({
      passoId: null,
      automationId: null,
    });
  });

  it("payload sem bloco NÃO joga fora um cursor que serve", () => {
    // O botão antigo continua retomando de onde a pessoa está, exatamente como
    // antes desta fase.
    const real = { passoId: "b_lem006", automationId: "A" };
    expect(cursorDaRetomada(real, "A", null, lista)).toEqual(real);
  });

  it("identidade por ÍNDICE vale como bloco do payload, inclusive o zero", () => {
    // Bloco sem id tem o índice em texto por identidade (`identidadeDoPasso`), e
    // "0" é identidade legítima — não ausência de bloco.
    //
    // Com a medida certa: este caso NÃO discrimina o `=== null` de um teste por
    // veracidade, e não tem como — "0" é string não vazia, logo truthy, e a
    // única string falsy é "", que `lerPayload` já recusa. O que ele fixa é
    // outra coisa, e ela é plausível: quem exigir aqui a forma `b_...` (como
    // `FORMA_DO_ID` faz em `identidadeDoPasso`) recusaria o botão de toda
    // automação que a migração `scripts/dar-ids-aos-passos.mjs` não alcançou, e
    // o toque deixaria de fazer qualquer coisa. É a mesma armadilha que o
    // comentário de `lerPayload` descreve, um andar acima.
    const semIds = [
      { tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0
      { tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
    ];
    expect(cursorDaRetomada({ passoId: null, automationId: null }, "A", "0", semIds)).toEqual({
      passoId: "0",
      automationId: "A",
    });
  });

  it("lista que NÃO É LISTA cai no bloco do payload, sem estourar", () => {
    // `indiceDoId` devolve null, então o cursor não resolve. O payload também
    // não vai resolver depois, e a retomada cai no zero — mas nada estoura.
    expect(cursorDaRetomada({ passoId: "b_lem006", automationId: "A" }, "A", "b_bem001", null)).toEqual({
      passoId: "b_bem001",
      automationId: "A",
    });
  });

  // A COMPOSIÇÃO, que é o que o motor faz de verdade. Os casos abaixo são os
  // três que a correção exigiu provar, e cada um diz o que a versão INVERTIDA
  // (payload mandando) devolvia — é isso que os torna discriminantes.

  it("quem está ADIANTE do portão e toca no 'Já sigo!' antigo NÃO volta ao portão", () => {
    // A certa devolve 3. A invertida devolvia 1, e reenfileirava 1..3.
    const real = { passoId: "b_lem006", automationId: "A" };
    const cursor = cursorDaRetomada(real, "A", "b_por002", lista);
    expect(retomadaDoFollow(cursor, "A", lista)).toBe(3);
  });

  it("quem está no meio da B e toca num botão antigo da A retoma A no lugar certo", () => {
    // A certa devolve 1 (a boas-vindas foi tocada, o `+1` cai no portão, e o
    // portão é atravessado por `resolverFollow`, não pulado). Sem o bloco no
    // payload — antes da Fase 1b — dava 0: a boas-vindas de novo.
    const real = { passoId: "b_qqq111", automationId: "B" };
    const cursor = cursorDaRetomada(real, "A", "b_bem001", lista);
    expect(retomadaDoBotao(cursor, "A", lista)).toBe(1);
  });

  it("cursor apontando para bloco APAGADO cai no bloco do payload, e não no zero", () => {
    // A certa devolve 1. Sem a conferência de `indiceDoId` dentro de
    // `cursorDaRetomada`, o cursor morto ganharia e a resposta seria 0 — a
    // boas-vindas repetida.
    const real = { passoId: "b_sumiu9", automationId: "A" };
    const cursor = cursorDaRetomada(real, "A", "b_bem001", lista);
    expect(retomadaDoBotao(cursor, "A", lista)).toBe(1);
  });
});

describe("conferirLista", () => {
  const bem = { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" };
  const portao = { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" };
  const link = { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com", botao_label: "Abrir" };

  const erros = (ps: unknown, g = "dm") => conferirLista(ps, g).filter((p) => p.nivel === "erro");
  const avisos = (ps: unknown, g = "dm") => conferirLista(ps, g).filter((p) => p.nivel === "aviso");

  it("lista boa não tem problema nenhum", () => {
    expect(conferirLista([bem, portao, link], "dm")).toEqual([]);
  });

  it("ERRO: lista vazia entrega zero", () => {
    expect(erros([])).toHaveLength(1);
    expect(erros([])[0].indice).toBe(null);
  });

  it("ERRO: o que não é lista", () => {
    expect(erros(null)).toHaveLength(1);
    expect(erros(null)[0].indice).toBe(null);
    // Os dois motivos são diferentes — coluna quebrada não é lista vazia —, e a
    // mensagem tem que separá-los, porque é ela que o dono lê.
    expect(erros(null)[0].mensagem).not.toBe(erros([])[0].mensagem);
  });

  it("ERRO: bloco com campo obrigatório vazio, apontando o bloco", () => {
    const r = erros([bem, { id: "b_vaz004", tipo: "dm", texto: "  " }]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  it("ERRO: bloco que não pode disparar naquele gatilho", () => {
    const coracao = { id: "b_cor005", tipo: "reagir_story", emoji: "❤️" };
    expect(erros([bem, coracao], "dm")).toHaveLength(1);
    expect(erros([bem, coracao], "dm")[0].indice).toBe(1);
    expect(erros([bem, coracao], "story")).toHaveLength(0);

    const publica = { id: "b_pub006", tipo: "resposta_publica", textos: ["oi"] };
    expect(erros([publica, bem], "dm")).toHaveLength(1);
    expect(erros([publica, bem], "dm")[0].indice).toBe(0);
    expect(erros([publica, bem], "comment")).toHaveLength(0);
  });

  it("ERRO: dois portões de follow", () => {
    const outro = { id: "b_por007", tipo: "pedir_follow", texto: "De novo", botao_label: "Sigo" };
    const r = erros([bem, portao, outro]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(2);
  });

  it("ERRO: dois pedidos de e-mail — o segundo é pulado antes de ser enviado", () => {
    // O motivo NÃO é a chave, e a diferença importa para a mensagem: o ramo
    // `pedir_email` de lib/engine.ts PULA o bloco quando o e-mail do contato já
    // é conhecido, e depois do primeiro pedido respondido ele já está gravado.
    // `emailAskKey(auto, pessoa, dia)` — igual para os dois — só decide quando
    // os dois chegam a ser enfileirados no mesmo dia sem resposta entre eles.
    const um = { id: "b_eml011", tipo: "pedir_email", texto: "Seu e-mail?" };
    const dois = { id: "b_eml012", tipo: "pedir_email", texto: "E agora o e-mail?" };
    const r = erros([bem, um, dois]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(2);
  });

  it("ERRO: duas reações a story — `storyReactionKey` só conhece a mensagem", () => {
    const um = { id: "b_rea013", tipo: "reagir_story", emoji: "❤️" };
    const dois = { id: "b_rea014", tipo: "reagir_story", emoji: "🔥" };
    const r = erros([um, dois], "story");
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  it("ERRO: duas respostas públicas — `commentReplyKey` só conhece o comentário", () => {
    const um = { id: "b_pub015", tipo: "resposta_publica", textos: ["oi"] };
    const dois = { id: "b_pub016", tipo: "resposta_publica", textos: ["oi de novo"] };
    const r = erros([um, dois], "comment");
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  it("os três dizem por que o segundo não chega, e não dizem a mesma coisa", () => {
    // O item 5 da spec junta três tipos numa regra só, mas o MECANISMO é
    // diferente em cada um — chave de deduplicação nos dois de baixo, o motor
    // pulando o bloco no de cima. Uma mensagem só para os três esconderia isso
    // justamente de quem precisa entender o que fazer com o bloco.
    const dosEmails = erros([
      { id: "b_eml021", tipo: "pedir_email", texto: "E-mail?" },
      { id: "b_eml022", tipo: "pedir_email", texto: "E-mail de novo?" },
    ])[0].mensagem;
    const dasStories = erros(
      [
        { id: "b_rea023", tipo: "reagir_story", emoji: "❤️" },
        { id: "b_rea024", tipo: "reagir_story", emoji: "🔥" },
      ],
      "story"
    )[0].mensagem;
    const dasPublicas = erros(
      [
        { id: "b_pub025", tipo: "resposta_publica", textos: ["oi"] },
        { id: "b_pub026", tipo: "resposta_publica", textos: ["tchau"] },
      ],
      "comment"
    )[0].mensagem;

    expect(new Set([dosEmails, dasStories, dasPublicas]).size).toBe(3);
    expect(dosEmails).toMatch(/e-mail/i);
    expect(dasStories).toMatch(/story/i);
    expect(dasPublicas).toMatch(/pública/i);
  });

  it("um de cada um deles continua valendo", () => {
    // A regra é sobre o SEGUNDO, não sobre o tipo: um bloco de cada é o que
    // `montarPassos` sempre emitiu, e nada nele é engolido.
    const email = { id: "b_eml017", tipo: "pedir_email", texto: "Seu e-mail?" };
    expect(erros([bem, portao, email, link])).toHaveLength(0);
  });

  it("AVISO, não erro: link antes do portão", () => {
    // Pode ser engano, pode ser estratégia — entregar primeiro e pedir follow
    // depois. Quem decide é o dono.
    const r = conferirLista([bem, link, portao], "dm");
    expect(r.filter((p) => p.nivel === "erro")).toHaveLength(0);
    expect(r.filter((p) => p.nivel === "aviso")).toHaveLength(1);
    // É problema da ORDEM da lista, não de um bloco: apontar o link sugeriria
    // que o link é que está errado.
    expect(r[0].indice).toBe(null);
  });

  it("sem portão nenhum, o link não é avisado", () => {
    // O aviso fala do portão não segurar o link. Sem portão não há o que dizer,
    // e avisar aqui seria ruído em toda automação que só manda um link.
    expect(avisos([bem, link])).toHaveLength(0);
  });

  it("AVISO: espera no fim da lista não atrasa nada", () => {
    const esperar = { id: "b_esp008", tipo: "esperar", minutos: 5 };
    expect(avisos([bem, portao, link, esperar])).toHaveLength(1);
    expect(avisos([bem, portao, link, esperar])[0].indice).toBe(3);
    expect(avisos([bem, esperar, link])).toHaveLength(0);
  });

  it("acumula vários problemas em vez de parar no primeiro", () => {
    const quebrado = { id: "b_vaz009", tipo: "dm", texto: "" };
    const outroQuebrado = { id: "b_vaz010", tipo: "pedir_email", texto: "" };
    const r = erros([quebrado, outroQuebrado]);
    expect(r).toHaveLength(2);
    // Cada um aponta o SEU bloco e diz o SEU motivo. Sem isto, dois problemas
    // com o mesmo texto e o mesmo índice passariam por "acumulou".
    expect(r.map((p) => p.indice)).toEqual([0, 1]);
    expect(r[0].mensagem).not.toBe(r[1].mensagem);
    expect(r[1].mensagem).toContain("pedir_email");
  });
});
