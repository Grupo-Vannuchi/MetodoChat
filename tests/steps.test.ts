import { describe, it, expect } from "vitest";
import {
  interpretar,
  passoEsperado,
  retomadaDoFallback,
  retomadaDoBotao,
  retomadaDoFollow,
  retomadaDoTexto,
  interrompeOFluxo,
  indiceDoPortao,
  cursorDesta,
  identidadeDoPasso,
  novoIdDeBloco,
  indiceDoId,
  lerPayload,
  cursorDaRetomada,
  conferirLista,
  conferir,
  tentativasDeHoje,
  oQuePortaoFaz,
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
  it("com a boas-vindas antes dele, o portão NÃO é o índice 0", () => {
    // Este é o teste que prova que a correção faz diferença. O ramo `FOLLOW:`
    // caía no zero quando o cursor não era desta automação, e o comentário
    // dizia que "a lista é percorrida desde o início e o portão é reavaliado no
    // lugar certo". Era falso para TODA lista que o formulário produzia, e por
    // construção: a boas-vindas era obrigatória (ele recusava salvar sem ela),
    // vinha sempre antes do portão, e o rótulo do botão tinha padrão não vazio —
    // rótulo sem url é resposta rápida, ou seja, PARADA DURA. Essas listas
    // continuam no banco, e é a forma mais comum que o quadro monta.
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
    // reentregue. Inalcançável pelo formulário, que emitia um portão só;
    // no quadro o segundo portão é ERRO em `conferirLista` e não chega a ser
    // gravado, então o que sobra é lista escrita fora do editor.
    const passos = [
      { tipo: "pedir_follow", texto: "a", botao_label: "x" },
      { tipo: "pedir_follow", texto: "b", botao_label: "y" },
    ];
    expect(indiceDoPortao(passos)).toBe(0);
    // Sem passagem: o destino É o portão, e `interpretar` o encontra sozinho.
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", passos)).toEqual({
      portao: null,
      destino: 0,
    });
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

// A lista que o formulário gravava — e que continua no banco de quem não abriu
// a automação no quadro desde então. O nome fica porque é a FORMA que importa:
// é nela que os dois ramos de resposta rápida decidem, e é dela que saem os
// índices citados abaixo.
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
    // O seguinte é o portão, e por isso não há passagem a marcar: `interpretar`
    // começa NELE e `resolverFollow` o resolve no caminho, como sempre fez.
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });
  });

  it("cursor num PORTÃO retoma DELE — o toque não entrega o follow", () => {
    // Sem isto, tocar no botão antigo da boas-vindas pulava o portão e o link
    // saía para quem não segue.
    //
    // `portao: null` com o destino EM CIMA do portão é a metade "igual não é
    // passagem" da regra: marcar passagem aqui faria `resolverFollow` consultar
    // a Meta duas vezes no mesmo toque, decidindo de novo o que já foi decidido.
    expect(retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });
  });

  it("o id sobrevive à REORDENAÇÃO — é o ponto desta fase", () => {
    // Mesma lista, ordem trocada: o cursor continua achando o portão, agora
    // no índice 2. Com índice, ele apontaria para o bloco errado.
    const trocada = [lista[0], lista[2], lista[1]];
    expect(retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", trocada)).toEqual({
      portao: null,
      destino: 2,
    });
  });

  it("cursor de outra automação retoma do zero", () => {
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "B" }, "A", lista)).toEqual({
      portao: null,
      destino: 0,
    });
  });

  it("cursor NULO retoma do zero", () => {
    // A outra metade do `cursorDesta` devolvendo null, e ela é o caso comum:
    // quem nunca começou o fluxo, e quem o TERMINOU (`executarFluxo` limpa o
    // cursor no fim da lista) — a coluna não separa os dois. O zero é o único
    // ponto afirmável, e o preço é uma mensagem repetida, segurada pela
    // `passoKey` dentro do dia.
    expect(retomadaDoBotao({ passoId: null, automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 0,
    });
    expect(retomadaDoBotao({ passoId: null, automationId: null }, "A", lista)).toEqual({
      portao: null,
      destino: 0,
    });
  });

  it("bloco APAGADO retoma do zero", () => {
    // O que esta fase PRETENDE é que este ramo só seja alcançado quando o dono
    // apagar aquele bloco de verdade — antes, com índice, ele era alcançado a
    // cada edição que mexesse no começo da lista.
    //
    // E É O QUE VALE AGORA. Enquanto o formulário foi o editor, ele sorteava id
    // novo para todo bloco a cada save e gravava o `steps` inteiro sem casar com
    // os ids antigos, então todo salvamento órfanava o cursor de quem estivesse
    // em fluxo. O formulário saiu; `salvarAutomacao` (app/automacoes/actions.ts)
    // grava a lista como ela veio do quadro, com os ids preservados. Este ramo
    // só é alcançado quando o dono apaga o bloco de verdade.
    expect(retomadaDoBotao({ passoId: "b_sumiu9", automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 0,
    });
  });

  it("cursor por índice, gravado antes desta fase, continua funcionando", () => {
    // Lista sem ids e cursor "0": a identidade do primeiro bloco é "0".
    const antiga = [{ tipo: "dm", texto: "Oi!", botao_label: "Quero" }, { tipo: "dm", texto: "Link", url: "https://x.com" }];
    expect(retomadaDoBotao({ passoId: "0", automationId: "A" }, "A", antiga)).toEqual({
      portao: null,
      destino: 1,
    });
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
    expect(retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", passos)).toEqual({
      portao: null,
      destino: 1,
    });
    expect(retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", passos)).not.toEqual({
      portao: null,
      destino: 2,
    });
    // Pedido INVÁLIDO não é portão, pela mesma regra do `pedir_follow` sem
    // texto: `interpretar` o ignora, logo ele nunca foi enviado.
    const comPedidoQuebrado = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" },
      { id: "b_eml004", tipo: "pedir_email", texto: "   " }, // texto em branco
    ];
    expect(
      retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", comPedidoQuebrado)
    ).toEqual({ portao: null, destino: 2 });
  });

  it("bloco que EXISTE mas não espera mais nada avança um", () => {
    // A OUTRA forma de cursor obsoleto, e a que o id não elimina: o bloco
    // continua na lista, mas foi editado e deixou de esperar resposta. Ela não
    // cai no zero — do zero a boas-vindas sairia de novo.
    //
    // O índice 2 de `listaDoFormulario` é o link (rótulo E url): virou botão de
    // link, e botão de link não espera toque nenhum.
    //
    // O DESTINO é 3, e o portão do índice 1 vira PASSAGEM. Antes da regra este
    // caso devolvia o 3 pelado, e o comentário aqui dizia que "avançar não pula
    // portão nenhum, porque passo que não espera não é portão" — verdade sobre o
    // BLOCO do cursor, e irrelevante sobre a POSIÇÃO dele: o destino cai do
    // outro lado do portão do mesmo jeito, e o portão deixava de ser avaliado.
    // Com a passagem ele é avaliado, e vencido o fluxo segue para o 3, que é
    // para onde ia — nada entre 1 e 3 é reenfileirado.
    expect(retomadaDoBotao({ passoId: "2", automationId: "A" }, "A", listaDoFormulario)).toEqual({
      portao: 1,
      destino: 3,
    });
    // Portão INVÁLIDO não é portão: `interpretar` o ignora, logo ele nunca foi
    // entregue e não há o que reavaliar. Vale para os dois papéis dele neste
    // caso — nem é o bloco do cursor, nem é passagem (`portao: null`).
    const comPortaoQuebrado = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" },
      { id: "b_por002", tipo: "pedir_follow", botao_label: "já sigo" }, // sem texto
    ];
    expect(
      retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", comPortaoQuebrado)
    ).toEqual({ portao: null, destino: 2 });
    // E quando o `+1` cai além do fim, `interpretar` não enfileira nada: o
    // toque não faz nada, e a pessoa destrava mandando qualquer mensagem.
    expect(interpretar(listaDoFormulario, 5).enfileirar).toEqual([]);
  });

  it("lista que NÃO É LISTA retoma do zero, sem estourar", () => {
    // Mesmo ramo do bloco apagado: `indiceDoId` devolve null quando `steps` não
    // é um array. Antes desta fase isto caía no `+1` e devolvia 2 — um índice
    // inventado sobre uma lista que não existe.
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", null)).toEqual({
      portao: null,
      destino: 0,
    });
  });
});

describe("retomadaDoFollow", () => {
  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" },
  ];

  it("cursor desta automação retoma DELE, para o portão ser reavaliado", () => {
    expect(retomadaDoFollow({ passoId: "b_por002", automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });
  });

  it("sem cursor desta, retoma do PORTÃO — o toque afirma onde a pessoa está", () => {
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });
    expect(retomadaDoFollow({ passoId: "b_bem001", automationId: "B" }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });
  });

  it("lista sem portão nenhum retoma do zero", () => {
    const semPortao = [{ id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }];
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", semPortao)).toEqual({
      portao: null,
      destino: 0,
    });
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

  it("cursor DESTA num bloco DEPOIS do portão continua sendo o DESTINO — o portão vira passagem", () => {
    // ESTE É O TESTE QUE A REGRA DO PORTÃO MUDOU, e vale escrever as três
    // versões porque cada uma comprou uma coisa diferente.
    //
    //   ANTES DA REGRA devolvia o número 2 pelado. O que ele fixava era que a
    //     função LÊ O CURSOR: a implementação cega (`indiceDoPortao(passos) ??
    //     0`, ignorando cursor e automação) devolve 1, e sem este caso nada
    //     nesta suíte separava as duas — o portão do `lista` acima está no
    //     índice 1, que é justamente a resposta esperada em todos os outros.
    //     O preço: o portão do índice 1 ficava para trás sem ser avaliado.
    //   A REGRA QUE FOI PEDIDA PRIMEIRO clampava o resultado para 1, o portão.
    //     Fechava o buraco e abria outro maior — a lista com resposta rápida
    //     depois do portão prendia todo mundo antes do link, para sempre. Ver o
    //     comentário de `atravessandoOPortao` (lib/steps.ts).
    //   A REGRA QUE FICOU devolve `{portao: 1, destino: 2}`: atravessa o portão
    //     e SEGUE PARA O 2, que é onde o cursor está.
    //
    // O que a mudança comprou, então: o portão volta a ser avaliado (é a metade
    // que o número pelado perdia) SEM custar o destino (é a metade que o clamp
    // custava). E o teste continua discriminando a implementação cega, que não
    // teria como produzir `destino: 2`.
    //
    // Retomar DO portão, e não através dele, seria reentrega: a pessoa já
    // atravessou o portão — é por isso que o cursor está adiante dele —, e
    // `executarFluxo` reenfileiraria tudo entre os dois.
    expect(
      retomadaDoFollow({ passoId: "b_eml004", automationId: "A" }, "A", comEmailDepoisDoPortao)
    ).toEqual({ portao: 1, destino: 2 });
  });

  it("o bloco do cursor NÃO precisa ser portão — vale para qualquer um", () => {
    // Mesma lista, cursor no link (índice 3), que não é portão de espécie
    // nenhuma. A certa devolve destino 3, a cega devolve 1.
    expect(
      retomadaDoFollow({ passoId: "b_lnk003", automationId: "A" }, "A", comEmailDepoisDoPortao)
    ).toEqual({ portao: 1, destino: 3 });
  });

  it("ZERO é identidade legítima, e não ausência de cursor", () => {
    // O `??` de `retomadaDoFollow` tem que ser `??` e não `||`. Com `||`, o
    // índice 0 — falsy — seria lido como "não achei" e a função cairia no
    // portão: a pessoa parada na boas-vindas seria empurrada para o portão.
    //
    // A certa devolve destino 0; tanto a versão com `||` quanto a cega devolvem
    // 1. E `portao: null`, porque o portão está DEPOIS do destino: ele está no
    // caminho que `interpretar` vai percorrer, e não atrás dele.
    expect(retomadaDoFollow({ passoId: "b_bem001", automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 0,
    });
  });

  it("bloco APAGADO cai no PORTÃO, e não no zero", () => {
    // Ramo NOVO desta fase, e ele não existia com índice: um índice sempre
    // resolvia para alguma coisa, então o cursor desta automação nunca caía no
    // `??`. Agora `indiceDoId` sabe dizer "esse bloco não está mais aqui", e o
    // ponto afirmável volta a ser o portão — pela mesma razão do cursor
    // ausente: o `FOLLOW:<id>` só existe porque o portão DESTA automação foi
    // entregue.
    expect(retomadaDoFollow({ passoId: "b_sumiu9", automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });

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
    expect(
      retomadaDoFollow({ passoId: "b_sumiu9", automationId: "A" }, "A", portaoLaAtras)
    ).toEqual({ portao: null, destino: 3 });
  });

  it("cursor por índice, gravado antes desta fase, continua funcionando", () => {
    // `listaDoFormulario` não tem ids: a identidade do portão é "1".
    expect(retomadaDoFollow({ passoId: "1", automationId: "A" }, "A", listaDoFormulario)).toEqual({
      portao: null,
      destino: 1,
    });
    // E do zero seria no-op: `interpretar` para na boas-vindas (parada dura) e
    // nunca chega ao portão.
    expect(interpretar(listaDoFormulario, 0).pararEm).toBe(0);
  });

  it("lista que NÃO É LISTA retoma do zero, sem estourar", () => {
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", null)).toEqual({
      portao: null,
      destino: 0,
    });
    expect(retomadaDoFollow({ passoId: "b_por002", automationId: "A" }, "A", null)).toEqual({
      portao: null,
      destino: 0,
    });
  });
});

describe("retomadaDoTexto", () => {
  // O QUARTO ponto de retomada, e o que estava sem teste nenhum: ele era uma
  // expressão solta em lib/engine.ts, dentro de `server-only`. Os casos abaixo
  // são os que o motor produz de verdade — o `indice` chega já resolvido por
  // `indiceDoId` e já confirmado por `passoEsperado` lá.
  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0 resposta rápida
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
    { id: "b_eml004", tipo: "pedir_email", texto: "seu e-mail?" }, // 2
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 3
  ];

  it("parado no PORTÃO retoma DELE — a mensagem de texto não é o follow", () => {
    // Avançar aqui bastaria mandar "ok" para receber o link sem nunca ter
    // seguido. É o único tipo que não avança.
    expect(retomadaDoTexto(lista, 1)).toEqual({ portao: null, destino: 1 });
  });

  it("parado numa RESPOSTA RÁPIDA retoma do SEGUINTE — o texto vale como resposta", () => {
    expect(retomadaDoTexto(lista, 0)).toEqual({ portao: null, destino: 1 });
  });

  it("parado num PEDIDO DE E-MAIL retoma do SEGUINTE, e aqui difere do ramo `AUTO:`", () => {
    // No toque do botão o pedido de e-mail retoma DELE MESMO, porque o toque não
    // é um endereço. Aqui é: o motor extraiu o e-mail desta mensagem e gravou em
    // `contacts.email` uma linha antes. Repetir o pedido seria pedir de novo o
    // que a pessoa acabou de mandar.
    //
    // E o destino cai depois do portão do índice 1, então ele vira PASSAGEM.
    expect(retomadaDoTexto(lista, 2)).toEqual({ portao: 1, destino: 3 });
    // A diferença entre os dois ramos, lado a lado: o DESTINO é 2 no toque do
    // botão e 3 no texto. A passagem é a mesma nos dois, porque ela olha a
    // posição do destino, não o tipo do bloco.
    expect(retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", lista)).toEqual({
      portao: 1,
      destino: 2,
    });
  });

  it("índice que não espera mais nada avança um, e lista que não é lista não estoura", () => {
    // O motor não chega aqui com nenhum dos dois — `passoEsperado` já barrou —,
    // mas a função é pura e a decisão é dela: sem tipo, avança, que é o mesmo
    // que os outros ramos fazem com cursor obsoleto.
    expect(retomadaDoTexto(lista, 3)).toEqual({ portao: 1, destino: 4 });
    expect(retomadaDoTexto(null, 0)).toEqual({ portao: null, destino: 1 });
  });
});

// ---------------------------------------------------------------------------
// A REGRA DO PORTÃO, medida nas duas entradas que a motivaram e na armadilha que
// derrubou a primeira versão dela.
//
// As listas e os argumentos são os mesmos da medição que produziu o
// NEEDS_CONTEXT — inclusive o `b_seg00003`, que é o que torna a ENTRADA 2 e a
// ARMADILHA indistinguíveis: mesma lista, mesmo cursor, mesma chamada. Uma
// função pura não tem como saber se o portão foi posto na frente do bloco ou se
// a pessoa passou por ele, e é por isso que a resposta certa tem que servir aos
// dois casos ao mesmo tempo. Serve: atravessa o portão, e segue para o destino.
// ---------------------------------------------------------------------------
describe("a regra do portão — ponto de passagem", () => {
  // ENTRADA 1: a lista REORDENADA no quadro, com o portão na frente da
  // boas-vindas. O caminho é o ramo de TEXTO.
  const entrada1 = [
    { id: "b_por00001", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 0
    { id: "b_bem00002", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 1
    { id: "b_lnk00003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 2
  ];

  // ENTRADA 2 e ARMADILHA: a MESMA lista, com uma resposta rápida DEPOIS do
  // portão. É a montagem que o quadro permite e que `conferirLista` aceita sem
  // uma queixa — de propósito: ela é legítima (portão, pergunta com botão, link).
  const entrada2 = [
    { id: "b_bem00001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0
    { id: "b_por00002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
    { id: "b_seg00003", tipo: "dm", texto: "Pronto?", botao_label: "Pronto" }, // 2
    { id: "b_lnk00004", tipo: "dm", texto: "Link", url: "https://x.com" }, // 3
  ];
  const noBloco2 = { passoId: "b_seg00003", automationId: "A" };

  it("ENTRADA 1 FECHA: texto de quem está parado na boas-vindas não pula o portão", () => {
    // Sem a regra o resultado era 2 — o LINK —, com o portão do índice 0 nunca
    // avaliado: quem não segue recebia o link mandando qualquer mensagem.
    //
    // Com ela o portão é atravessado, e o destino continua sendo o link para
    // quem vencer.
    expect(retomadaDoTexto(entrada1, 1)).toEqual({ portao: 0, destino: 2 });
  });

  it("ENTRADA 2 FECHA: o toque no botão do bloco depois do portão não o pula", () => {
    // Sem a regra o resultado era 3 — o LINK —, com o portão do índice 1 nunca
    // avaliado.
    expect(retomadaDoBotao(noBloco2, "A", entrada2)).toEqual({ portao: 1, destino: 3 });
    // O "Já sigo!" e o texto chegam ao mesmo lugar pela mesma regra: nenhum dos
    // três caminhos de volta atravessa um portão sem avaliá-lo.
    expect(retomadaDoFollow(noBloco2, "A", entrada2)).toEqual({ portao: 1, destino: 2 });
    expect(retomadaDoTexto(entrada2, 2)).toEqual({ portao: 1, destino: 3 });
  });

  it("A ARMADILHA SUMIU: quem venceu o portão e está parado no bloco 2 ALCANÇA o link", () => {
    // O caso que derrubou a primeira versão da regra, e ele é MEDIDO aqui, não
    // deduzido: `interpretar` é o que o motor roda depois de vencer o portão.
    //
    // Os argumentos são IDÊNTICOS aos da ENTRADA 2 acima. A diferença está só na
    // história: aqui o cursor é o real de quem seguiu o perfil, venceu o portão,
    // recebeu o bloco 2 e parou nele.
    const r = retomadaDoBotao(noBloco2, "A", entrada2);
    expect(r).toEqual({ portao: 1, destino: 3 });

    // Vencido o portão, o motor executa a partir do DESTINO: o link sai, e a
    // lista termina (`pararEm: null`, o que faz `executarFluxo` limpar o cursor).
    const daPassagem = interpretar(entrada2, r.destino);
    expect(daPassagem.enfileirar.map((a) => a.indice)).toEqual([3]);
    expect(daPassagem.pararEm).toBeNull();

    // E a versão RECUSADA da regra, `portão + 1`, medida no mesmo lugar: ela
    // reinterpreta a lista e para na PRÓPRIA resposta rápida do índice 2. O
    // bloco 3 — o link — não é alcançado.
    const daRebobinada = interpretar(entrada2, r.portao! + 1);
    expect(daRebobinada.enfileirar.map((a) => a.indice)).toEqual([2]);
    expect(daRebobinada.pararEm).toBe(2);

    // O que fecha o ciclo, e é o que tornava a armadilha SEM SAÍDA: parando no
    // 2, `executarFluxo` regrava o cursor no 2 — o mesmo com que este teste
    // começou. O toque seguinte devolve a mesma coisa, e o seguinte também.
    // Mandar texto não salvava: o ramo de texto rebobinaria igual.
    expect(retomadaDoBotao(noBloco2, "A", entrada2)).toEqual(r);
    expect(retomadaDoTexto(entrada2, 2).portao).toBe(1);
  });

  it("NINGUÉM RECEBE MENSAGEM REPETIDA por causa da regra", () => {
    // O preço que a versão recusada cobrava e esta não cobra. A passagem não
    // reenfileira nada: `interpretar` começa em `destino`, então todo bloco
    // entre o portão e o destino fica de fora — inclusive o bloco 2, que a
    // pessoa acabou de receber.
    const r = retomadaDoBotao(noBloco2, "A", entrada2);
    const daPassagem = interpretar(entrada2, r.destino).enfileirar.map((a) => a.indice);
    expect(daPassagem.every((i) => i >= r.destino)).toBe(true);
    expect(daPassagem).not.toContain(2);

    // A rebobinada reenviava o bloco 2 — segurado pela `passoKey` só dentro do
    // dia, e virado o balde ele sai de novo para uma pessoa real.
    expect(interpretar(entrada2, r.portao! + 1).enfileirar.map((a) => a.indice)).toContain(2);

    // O portão em si não é reenviado quando é vencido: `resolverFollow`
    // (lib/engine.ts) só enfileira o pedido no ramo em que BARRA. Isso é do
    // motor e não cabe aqui; o que cabe é que a passagem não o põe na lista de
    // enfileirar — o índice 1 não aparece em nenhuma das duas medições acima.
    expect(daPassagem).not.toContain(1);
  });

  it("a regra é INALCANÇÁVEL em `retomadaDoFallback`, e é por isso que ele não a recebe", () => {
    // `interpretar(passos, 0)` para no PRIMEIRO passo que espera resposta, e
    // portão espera. Logo nenhum portão precede `pararEm`, e o `+1` do ramo `dm`
    // cai no máximo EM CIMA do portão seguinte — nunca depois dele.
    //
    // A condição da regra, escrita aqui de novo para o teste não depender da
    // implementação dela: existe portão ATRÁS do destino?
    const dispararia = (passos: unknown[]) => {
      const destino = retomadaDoFallback(passos);
      const portao = indiceDoPortao(passos);
      return destino !== null && portao !== null && portao < destino;
    };

    // Portão DEPOIS da parada dura: o `+1` cai em cima dele, não depois.
    const portaoDepois = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(portaoDepois)).toBe(1);
    expect(dispararia(portaoDepois)).toBe(false);

    // Portão em PRIMEIRO: `interpretar` para NELE, e o destino é ele mesmo.
    const portaoPrimeiro = [
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(portaoPrimeiro)).toBe(0);
    expect(dispararia(portaoPrimeiro)).toBe(false);

    // Duas paradas duras: não retoma nada, e não há destino sobre o qual a
    // regra pudesse decidir. É a MESMA lista da armadilha, o que mostra que a
    // proteção do fallback vem de outro lugar (`contarParadasDuras`).
    expect(retomadaDoFallback(entrada2)).toBeNull();
    expect(dispararia(entrada2)).toBe(false);
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
    // `blocoNovo` (app/automacoes/editor/modelos.ts) dá id a todo bloco que a
    // paleta cria. O teste existe para a premissa não deixar de valer em
    // silêncio.
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
    // continua sendo atravessado por `resolverFollow`, e não pulado. Aqui ele é
    // o próprio DESTINO, então não há passagem a marcar.
    expect(retomadaDoBotao(cursorDoPayload, "A", lista)).toEqual({ portao: null, destino: 1 });

    // Já o botão cujo bloco não está mais na lista não afirma nada, e cai no
    // zero — a boas-vindas de novo. Com o cursor mandando, chegar aqui exige que
    // os DOIS blocos tenham sumido, o do cursor e o do botão — o que um save do
    // formulário fazia de uma vez, sorteando ids novos. Com o quadro
    // preservando os ids, é preciso apagar os dois blocos de verdade.
    const doApagado = lerPayload("AUTO:A:b_sumiu9")!;
    expect(
      retomadaDoBotao({ passoId: doApagado.passoId, automationId: "A" }, "A", lista)
    ).toEqual({ portao: null, destino: 0 });
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
    expect(retomadaDoBotao(cursorEmOutra, "A", lista)).toEqual({ portao: null, destino: 0 });

    // Com o payload NOVO o bloco é o do botão da A, e a retomada é a certa.
    const p = lerPayload("AUTO:A:b_bem001")!;
    expect(retomadaDoBotao({ passoId: p.passoId, automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });
  });

  it("no FOLLOW, os dois cursores possíveis dão respostas DIFERENTES", () => {
    // As duas pontas do ramo `FOLLOW:`, lado a lado, para ficar visível o que a
    // ORDEM entre elas decide — e ela é decidida em `cursorDaRetomada`, não
    // aqui.
    //
    // Com o cursor do contato (adiante do portão) o destino é 3: a pessoa
    // continua onde estava, e o portão do índice 1 é atravessado a caminho. Com
    // o bloco do payload o destino é o próprio 1: ela VOLTA ao portão, e
    // `executarFluxo` reenfileira tudo entre 1 e 3 — a `passoKey` só segura isso
    // dentro do dia.
    //
    // É a diferença entre atravessar o portão e voltar a ele, e ela é justamente
    // o que a regra do portão preserva: `{portao: 1, destino: 3}` avalia o portão
    // sem reenfileirar nada entre os dois.
    //
    // Uma versão anterior desta fase preferia o payload e produzia o destino 1.
    // É por isso que este par existe: enquanto os dois resultados forem
    // diferentes, o teste de composição em `describe("cursorDaRetomada")` tem o
    // que separar.
    const lista = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 1
      { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 2
      { id: "b_lem006", tipo: "dm", texto: "não esquece" }, // 3
    ];
    const cursorAdiante = { passoId: "b_lem006", automationId: "A" };
    expect(retomadaDoFollow(cursorAdiante, "A", lista)).toEqual({ portao: 1, destino: 3 });

    const p = lerPayload("FOLLOW:A:b_por002")!;
    expect(retomadaDoFollow({ passoId: p.passoId, automationId: "A" }, "A", lista)).toEqual({
      portao: null,
      destino: 1,
    });
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
    // A certa devolve destino 3, com o portão do 1 como PASSAGEM. A invertida
    // devolvia destino 1, e reenfileirava 1..3 — a diferença entre atravessar o
    // portão e voltar a ele continua sendo a coisa que este teste mede.
    const real = { passoId: "b_lem006", automationId: "A" };
    const cursor = cursorDaRetomada(real, "A", "b_por002", lista);
    expect(retomadaDoFollow(cursor, "A", lista)).toEqual({ portao: 1, destino: 3 });
  });

  it("quem está no meio da B e toca num botão antigo da A retoma A no lugar certo", () => {
    // A certa devolve destino 1 (a boas-vindas foi tocada, o `+1` cai no portão,
    // e o portão é atravessado por `resolverFollow`, não pulado). Sem o bloco no
    // payload — antes da Fase 1b — dava 0: a boas-vindas de novo.
    const real = { passoId: "b_qqq111", automationId: "B" };
    const cursor = cursorDaRetomada(real, "A", "b_bem001", lista);
    expect(retomadaDoBotao(cursor, "A", lista)).toEqual({ portao: null, destino: 1 });
  });

  it("cursor apontando para bloco APAGADO cai no bloco do payload, e não no zero", () => {
    // A certa devolve destino 1. Sem a conferência de `indiceDoId` dentro de
    // `cursorDaRetomada`, o cursor morto ganharia e a resposta seria 0 — a
    // boas-vindas repetida.
    const real = { passoId: "b_sumiu9", automationId: "A" };
    const cursor = cursorDaRetomada(real, "A", "b_bem001", lista);
    expect(retomadaDoBotao(cursor, "A", lista)).toEqual({ portao: null, destino: 1 });
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

  it("ERRO: resposta pública fora do gatilho de comentário — sem o id, nunca roda", () => {
    // Só `handleComment` (lib/engine.ts) preenche `contexto.commentId`, e o ramo
    // `resposta_publica` de `enfileirarPasso` desiste sem ele. Em qualquer outro
    // gatilho o bloco nunca roda, e é isso que ERRO quer dizer aqui.
    const publica = { id: "b_pub006", tipo: "resposta_publica", textos: ["oi"] };
    expect(erros([publica, bem], "dm")).toHaveLength(1);
    expect(erros([publica, bem], "dm")[0].indice).toBe(0);
    expect(erros([publica, bem], "story")).toHaveLength(1);
    expect(erros([publica, bem], "comment")).toHaveLength(0);
  });

  it("AVISO, não erro: coraçãozinho no gatilho de DM — o motor EXECUTA esse", () => {
    // A outra metade da regra não tem o mesmo mecanismo, e por isso não tem o
    // mesmo nível. `handleMessage` (lib/engine.ts) atende a resposta de story e
    // a DM comum pelo MESMO caminho e chama `executarFluxo(..., { messageId:
    // msg.mid })` nos dois; `lib/queue-drain.ts` entrega ("reação na mensagem
    // que a pessoa mandou"). Travar o salvar aqui travaria uma lista que roda.
    const coracao = { id: "b_cor005", tipo: "reagir_story", emoji: "❤️" };
    expect(erros([bem, coracao], "dm")).toHaveLength(0);
    expect(avisos([bem, coracao], "dm")).toHaveLength(1);
    expect(avisos([bem, coracao], "dm")[0].indice).toBe(1);
  });

  it("no gatilho de story o coraçãozinho não tem nem erro nem aviso", () => {
    const coracao = { id: "b_cor005", tipo: "reagir_story", emoji: "❤️" };
    expect(conferirLista([bem, coracao], "story")).toHaveLength(0);
  });

  it("ERRO: coraçãozinho no gatilho de comentário — ali não chega mensagem nenhuma", () => {
    // `handleComment` passa só `{ commentId }`, e `enfileirarPasso` faz
    // `if (!contexto.messageId) return`. Este é o caso em que a metade do
    // coraçãozinho volta a ser ERRO, pelo mesmo critério da resposta pública.
    const coracao = { id: "b_cor005", tipo: "reagir_story", emoji: "❤️" };
    const r = erros([bem, coracao], "comment");
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  // O PORTÃO SEM RÓTULO É IMPOSSÍVEL DE ATRAVESSAR, e nada o recusava.
  //
  // `resolverFollow` (lib/engine.ts) enfileira
  // `quick_reply_label: passo.botao_label`, e `lib/queue-drain.ts` só monta a
  // resposta rápida quando `quick_reply_label && quick_reply_payload`. Com o
  // rótulo vazio a mensagem cai no `else` e sai como TEXTO PURO, sem botão. O
  // fluxo para no portão — `esperaResposta` diz sim a todo `pedir_follow` — e a
  // pessoa lê um pedido cujo botão não existe.
  it("ERRO: portão de follow sem o texto do botão — o Instagram não entrega botão nenhum", () => {
    const semRotulo = { id: "b_por031", tipo: "pedir_follow", texto: "Me segue", botao_label: "" };
    const r = erros([bem, semRotulo]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
    // A chave ausente é o mesmo caso da vazia: `passo.botao_label` é falso nos
    // dois, e é a falsidade que o `queue-drain` lê.
    const semChave = { id: "b_por032", tipo: "pedir_follow", texto: "Me segue" };
    expect(erros([bem, semChave])).toHaveLength(1);
  });

  // A RECUSA MORA AQUI E NÃO EM `conferir`, e este teste é o que fixa a
  // diferença. Se ela estivesse em `conferir`, o portão viraria bloco inválido e
  // `interpretar` o IGNORARIA — seguiria o laço e entregaria a cauda inteira, o
  // link inclusive, a quem não segue. `indiceDoPortao` também deixaria de
  // achá-lo, e `atravessandoOPortao` não marcaria passagem nenhuma.
  //
  // Travar o salvar impede que a lista nasça; ignorar o portão quebraria a
  // promessa central do produto em toda lista que já nasceu. O raciocínio por
  // extenso está no ramo `pedir_follow` de `conferir` (lib/steps.ts).
  it("o portão sem rótulo continua sendo PORTÃO para o motor, e não bloco ignorado", () => {
    const semRotulo = { id: "b_por033", tipo: "pedir_follow", texto: "Me segue", botao_label: "" };
    const lista = [semRotulo, { id: "b_lnk034", tipo: "dm", texto: "Link", url: "https://x.com" }];
    // `conferir` continua aceitando: o bloco É enviado (como texto puro).
    expect(conferir(semRotulo).passo).toBeTruthy();
    // `indiceDoPortao` continua achando o portão.
    expect(indiceDoPortao(lista)).toBe(0);
    // E `interpretar` PARA nele em vez de pular para o link.
    const r = interpretar(lista, 0);
    expect(r.pararEm).toBe(0);
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0]);
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
    // A regra é sobre o SEGUNDO, não sobre o tipo: um bloco de cada é o que o
    // formulário sempre emitiu, e nada nele é engolido.
    const email = { id: "b_eml017", tipo: "pedir_email", texto: "Seu e-mail?" };
    expect(erros([bem, portao, email, link])).toHaveLength(0);
  });

  it("AVISO, não erro: link antes do portão, apontando o BLOCO do link", () => {
    // Pode ser engano, pode ser estratégia — entregar primeiro e pedir follow
    // depois. Quem decide é o dono; a mensagem continua falando da ORDEM, que
    // é onde o problema está.
    //
    // O índice, porém, tem que ser fixado: sem ele o editor (Tarefa 5) não
    // tem onde acender o culpado. `link` está no índice 1 desta lista.
    const r = conferirLista([bem, link, portao], "dm");
    expect(r.filter((p) => p.nivel === "erro")).toHaveLength(0);
    expect(r.filter((p) => p.nivel === "aviso")).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  it("aponta o PRIMEIRO link antes do portão, quando há mais de um", () => {
    const outroLink = { id: "b_lnk099", tipo: "dm", texto: "Outro link", url: "https://z.com" };
    const r = conferirLista([bem, link, outroLink, portao], "dm");
    expect(r.filter((p) => p.nivel === "aviso")).toHaveLength(1);
    expect(r.filter((p) => p.nivel === "aviso")[0].indice).toBe(1);
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

  // AS QUATRO FORMAS de uma `dm` com a chave `url` em jogo, uma por teste.
  //
  // Um teste por forma, e não um teste com quatro `expect`, porque cada uma
  // delas já foi decidida errado alguma vez. Separadas, uma condição pela metade
  // não tem como ficar verde.
  //
  // QUEM DECIDE É A CHAVE `url`, e não o par rótulo+endereço. A condição já
  // espelhou `esperaResposta` (`Boolean(botao_label) && !url`), e essa metade
  // saiu: a chave presente é o que faz o nó dizer MENSAGEM COM LINK
  // (`resumoDoBloco`, app/automacoes/editor/modelos.ts), e mensagem que promete
  // link e sai sem link é defeito com ou sem rótulo. O rótulo continua mudando a
  // MENSAGEM do erro, porque muda a consequência — armadilha com ele, promessa
  // quebrada sem ele. O raciocínio inteiro está no comentário da regra em
  // lib/steps.ts.

  it("1 de 4 · ERRO: rótulo E `url` vazia — é o link sem endereço, e trava o fluxo", () => {
    // O defeito de verdade: `blocoNovo("dm_link")` (Tarefa 5) semeia `url: ""`.
    // Sem endereço digitado, o bloco fica `{tipo:"dm", texto, botao_label,
    // url:""}` — `esperaResposta` faz `Boolean(botao_label) && !url`, `""` é
    // falso, e o bloco vira resposta rápida aos olhos do motor: o fluxo para
    // nele para sempre, esperando o toque num botão sem endereço para abrir.
    const semEndereco = {
      id: "b_lnk020",
      tipo: "dm",
      texto: "Aqui está o link!",
      botao_label: "Abrir link",
      url: "",
    };
    const r = erros([bem, semEndereco]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
    expect(r[0].mensagem).toMatch(/trava o fluxo/i);
  });

  it("2 de 4 · ERRO: `url` vazia e SEM rótulo — o nó diz LINK e chega texto puro", () => {
    // ESTE caso já foi decidido nos dois sentidos, e a decisão de agora é a
    // terceira. Ele é ALCANÇÁVEL pela tela em dois cliques a partir da paleta:
    // bloco de link criado, rótulo apagado no painel, endereço ainda vazio.
    //
    // Ele NÃO trava o fluxo — sem `botao_label`, `esperaResposta` é falso, e foi
    // por isso que uma versão anterior o liberou chamando-o de "DM comum, e ela
    // funciona". Só que TRÊS peças descreviam esse mesmo bloco de três jeitos: o
    // nó dizia MENSAGEM COM LINK (classifica pela CHAVE), a conferência dizia
    // que estava tudo certo, e o motor mandava `linkMessage(texto, "Abrir link",
    // "")`, que sem url devolve TEXTO PURO — sem link e sem botão. Salvava
    // limpo e entregava uma promessa quebrada.
    const semRotulo = { id: "b_dmc022", tipo: "dm", texto: "Texto puro", url: "" };
    const r = erros([bem, semRotulo]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  it("as duas formas sem endereço dizem coisas DIFERENTES, porque o preço é diferente", () => {
    // Com rótulo é armadilha: `esperaResposta` para o fluxo ali para sempre.
    // Sem rótulo o fluxo SEGUE e o que se perde é o link. Uma frase só para as
    // duas esconderia justamente o que o dono precisa saber para decidir o que
    // fazer com o bloco — e "trava o fluxo" seria mentira na segunda.
    const comRotulo = { id: "b_lnk060", tipo: "dm", texto: "Link", botao_label: "Abrir", url: "" };
    const semRotulo = { id: "b_lnk061", tipo: "dm", texto: "Link", url: "" };
    const a = erros([comRotulo])[0].mensagem;
    const b = erros([semRotulo])[0].mensagem;
    expect(a).not.toBe(b);
    expect(a).toMatch(/trava o fluxo/i);
    expect(b).not.toMatch(/trava o fluxo/i);
    // O rótulo VAZIO é o mesmo caso do rótulo ausente: é a falsidade que o
    // `queue-drain` lê, e é ela que decide qual mensagem sai.
    const rotuloVazio = { id: "b_lnk062", tipo: "dm", texto: "Link", botao_label: "", url: "" };
    expect(erros([rotuloVazio])[0].mensagem).toBe(b);
  });

  it("3 de 4 · sem erro: rótulo com `url: undefined` — lista ainda EM MEMÓRIA", () => {
    // A chave EXISTE (`"url" in passo` é `true`) e o valor é `undefined`, que é
    // o que sobra de um campo montado como `url: algo || undefined` antes de a
    // lista virar jsonb — era assim que o formulário a montava, e o `undefined`
    // só some no `JSON.stringify` da serialização. Conferir a PRESENÇA da chave
    // recusaria aqui toda automação sem link conferida antes de ser
    // serializada.
    const emMemoria = {
      id: "b_bot023",
      tipo: "dm",
      texto: "Confirma?",
      botao_label: "Confirmo",
      url: undefined,
    };
    expect("url" in emMemoria).toBe(true);
    expect(erros([bem, emMemoria])).toHaveLength(0);
  });

  it("4 de 4 · sem erro: rótulo SEM a chave `url` — resposta rápida legítima", () => {
    // É o que a convenção promete: `dm_botao` nunca grava `url`. Esta é também
    // a forma que o formulário gravou para um link sem endereço, e a regra é
    // cega para ela de propósito — as duas são o mesmo dado, e não há como
    // separá-las sem adivinhar. O que o quadro faz com esse bloco legado (tratar
    // como resposta rápida, sem mexer na chave) está no comentário de
    // `quadro.tsx`; a regra em si, em lib/steps.ts.
    const respostaRapida = {
      id: "b_bot021",
      tipo: "dm",
      texto: "Confirma?",
      botao_label: "Confirmo",
    };
    expect(erros([bem, respostaRapida])).toHaveLength(0);
  });

  it("link COM endereço não dá erro, mesmo com a chave presente", () => {
    expect(erros([bem, link])).toHaveLength(0);
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
    // Diz de QUAL bloco fala, na língua do dono. Antes fixava o `motivo` cru
    // (`"pedir_email"`), que é nome de tipo interno e não significa nada para
    // quem está montando a automação na tela.
    expect(r[1].mensagem).toMatch(/pedido de e-mail/i);
  });

  it("as mensagens de bloco inválido não vazam jargão interno", () => {
    // Todas as outras mensagens da função foram escritas na língua do dono, e
    // estas herdavam o `motivo` técnico de `conferir` — a tela chegava a
    // mostrar "Bloco incompleto: pedir_email sem texto." e "tipo desconhecido:
    // coisa_nova". O `motivo` continua existindo, para diagnóstico, nos
    // `ignorados` de `interpretar`; o que a TELA mostra é outra coisa.
    const invalidos: unknown[] = [
      { id: "b_dmx030", tipo: "dm", texto: "  " },
      { id: "b_esx031", tipo: "esperar", minutos: -1 },
      { id: "b_pux032", tipo: "resposta_publica", textos: [] },
      { id: "b_rex033", tipo: "reagir_story", emoji: "" },
      { id: "b_fox034", tipo: "pedir_follow", texto: "" },
      { id: "b_emx035", tipo: "pedir_email", texto: "" },
      { id: "b_nvx036", tipo: "coisa_nova" },
      "nem é objeto",
    ];
    const r = erros(invalidos, "comment");
    expect(r).toHaveLength(invalidos.length);
    for (const p of r) {
      expect(p.mensagem).not.toMatch(
        /pedir_email|pedir_follow|reagir_story|resposta_publica|tipo desconhecido|não é um objeto|\bdm\b/
      );
      // Frase inteira, na língua de quem lê a tela.
      expect(p.mensagem).toMatch(/^[A-ZÀ-Ú].*\.$/);
    }
    // E continuam distinguindo uma falha da outra: oito falhas, oito frases.
    expect(new Set(r.map((p) => p.mensagem)).size).toBe(invalidos.length);
  });

  it("ERRO: resposta pública com todos os textos em branco não é publicada", () => {
    // `enfileirarPasso` (lib/engine.ts) sorteia um dos textos e faz
    // `if (!texto?.trim()) return` — sem enfileirar e sem `step_ignorado`.
    // `conferir` só exige que a lista não esteja vazia, então `[""]` passa
    // inteiro por ela.
    const branca = { id: "b_pub040", tipo: "resposta_publica", textos: ["", "   "] };
    const r = erros([branca], "comment");
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(0);
  });

  it("um texto aproveitável basta para a resposta pública passar", () => {
    const mista = { id: "b_pub041", tipo: "resposta_publica", textos: ["", "Te mandei!"] };
    expect(erros([mista], "comment")).toHaveLength(0);
  });

  it("ERRO: dois blocos com o mesmo id — o segundo envio é engolido pela `passoKey`", () => {
    // A identidade entra na `dedupe_key`. Mesma identidade, mesma `passoKey`, e
    // o `on conflict do nothing` descarta o segundo item sem erro nenhum.
    // Duplicar um bloco no editor é exatamente o gesto que produz isso.
    const um = { id: "b_dup050", tipo: "dm", texto: "Primeiro" };
    const dois = { id: "b_dup050", tipo: "dm", texto: "Segundo" };
    const r = erros([um, dois]);
    expect(r).toHaveLength(1);
    // Aponta o SEGUNDO: é ele que o dono precisa mudar.
    expect(r[0].indice).toBe(1);
  });

  it("ERRO: id fora da forma `b_` + 6 — cai no índice e colide com outro bloco", () => {
    // `identidadeDoPasso` recusa o id e usa o ÍNDICE, e a chave passa a colidir
    // com a de um vizinho sem id válido. É a colisão que `FORMA_DO_ID` existe
    // para tornar impossível, e a partir da Tarefa 6 o id vem do navegador.
    expect(erros([{ id: "2", tipo: "dm", texto: "Oi" }])).toHaveLength(1);
    expect(erros([{ id: "b_curto", tipo: "dm", texto: "Oi" }])).toHaveLength(1);
    expect(erros([{ id: "B_MAIUS01", tipo: "dm", texto: "Oi" }])).toHaveLength(1);
    expect(erros([{ id: 7, tipo: "dm", texto: "Oi" }])).toHaveLength(1);
    expect(erros([{ id: "b_abc123", tipo: "dm", texto: "Oi" }])).toHaveLength(0);
  });

  it("bloco SEM id não é erro — é toda automação anterior à Fase 1b", () => {
    // `identidadeDoPasso` lhe dá a identidade que ele sempre teve na prática, o
    // índice. Recusá-lo trancaria o dono fora do painel de toda lista antiga —
    // o mesmo estrago da condição pela metade do link sem endereço.
    const antigos = [
      { tipo: "dm", texto: "Oi!", botao_label: "Quero" },
      { tipo: "dm", texto: "Link", url: "https://x.com" },
    ];
    expect(erros(antigos)).toHaveLength(0);
  });

  it("id repetido e id inválido não se sobrepõem: um erro por bloco", () => {
    // Dois ids inválidos IGUAIS acusam a forma, não a repetição: cada um deles
    // cai no índice, então as identidades resolvidas ("0" e "1") nem chegam a
    // colidir entre si. Duas mensagens de repetição aqui seriam mentira.
    const r = erros([
      { id: "x", tipo: "dm", texto: "Um" },
      { id: "x", tipo: "dm", texto: "Dois" },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].mensagem).toBe(r[1].mensagem);
    expect(r[0].mensagem).toMatch(/identidade inválida/i);
  });
});

describe("novoIdDeBloco", () => {
  // O defeito que estes testes trancam era PROBABILÍSTICO: a geração antiga
  // (`Math.random().toString(36).slice(2, 10)`) amarrava o comprimento da saída
  // à representação decimal do sorteio, e devolvia menos de 6 caracteres quando
  // o sorteio caía num número de representação curta. Amostrar não pega isso —
  // a chance é ínfima e o teste passaria mil vezes antes de o cliente falhar uma.
  // Por isso o que se afirma aqui é a CONSTRUÇÃO, não a sorte: comprimento fixo,
  // alfabeto fixo, em toda amostra.
  it("gera sempre a mesma forma: `b_` e mais 8 caracteres de [0-9a-z]", () => {
    for (let i = 0; i < 2000; i++) {
      const id = novoIdDeBloco();
      expect(id).toMatch(/^b_[0-9a-z]{8}$/);
      expect(id).toHaveLength(10);
    }
  });

  it("o id gerado é sempre aceito como identidade, nunca cai no índice", () => {
    // Esta é a consequência que importa: id fora de `FORMA_DO_ID` faz
    // `identidadeDoPasso` cair no ÍNDICE e `conferirLista` travar o salvar.
    for (let i = 0; i < 2000; i++) {
      const id = novoIdDeBloco();
      expect(identidadeDoPasso({ id, tipo: "dm", texto: "oi" }, 7)).toBe(id);
    }
  });

  it("não repete dentro de uma automação de tamanho realista", () => {
    const ids = new Set(Array.from({ length: 500 }, () => novoIdDeBloco()));
    expect(ids.size).toBe(500);
  });
});

describe("tentativas do portão, por dia", () => {
  // O contador era por contato e nunca zerava. Quem estourasse o limite ficava
  // sem receber o pedido para sempre — em toda automação, todo dia.

  it("conta as de hoje quando o dia gravado é hoje", () => {
    expect(tentativasDeHoje(3, "2026-08-10", "2026-08-10")).toBe(3);
  });

  it("ZERA quando o dia gravado é outro — é o ponto da mudança", () => {
    expect(tentativasDeHoje(5, "2026-08-09", "2026-08-10")).toBe(0);
  });

  it("zera quando nunca houve dia gravado", () => {
    // Todo contato anterior a esta mudança cai aqui: tem contador e não tem dia.
    // Zerar é o certo — o contador acumulado não é de hoje.
    expect(tentativasDeHoje(5, null, "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(5, undefined, "2026-08-10")).toBe(0);
  });

  it("não estoura com lixo vindo do banco", () => {
    expect(tentativasDeHoje("3", "2026-08-10", "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(null, "2026-08-10", "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(-2, "2026-08-10", "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(2.7, "2026-08-10", "2026-08-10")).toBe(2);
  });
});

describe("o que o portão faz", () => {
  it("pede enquanto não chegou ao limite", () => {
    expect(oQuePortaoFaz(0, 5)).toBe("pedir");
    expect(oQuePortaoFaz(4, 5)).toBe("pedir");
  });

  it("SOLTA a partir do limite, em vez de segurar calado", () => {
    // Era aqui que a pessoa ficava presa: o portão parava de pedir e continuava
    // gravando o cursor. 4.078 estados sem saida, todos desta forma.
    expect(oQuePortaoFaz(5, 5)).toBe("soltar");
    expect(oQuePortaoFaz(9, 5)).toBe("soltar");
  });

  it("com limite zero, solta sempre", () => {
    expect(oQuePortaoFaz(0, 0)).toBe("soltar");
  });
});
