import { describe, it, expect } from "vitest";
import {
  interpretar,
  temCicloDeSempre,
  identidadeNoIndice,
  seguinteDe,
  haCaminho,
  TETO_DE_PASSOS,
  passoEsperado,
  retomadaDoFallback,
  retomadaDoBotao,
  retomadaDoFollow,
  retomadaDoTexto,
  retomadaDoEmailConhecido,
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
  oQuePortaoFaz,
  conferirLigacao,
  ligacoesDe,
  ligacaoEscolhida,
  caminhoDoBotao,
  novoIdDeBotao,
  envioDaDm,
  esperaResposta,
  payloadDoBotao,
  payloadDaRespostaRapida,
  payloadDoPortao,
  botoesDaMensagem,
  LIMITE_DE_BOTOES,
  chaveDoQuando,
  quandoDaChave,
  ligacoesValidas,
  ligar,
  desligarBloco,
  desligarBotao,
  desligarSenao,
  desligarERenumerar,
  apagarLigacoes,
  partirLigacao,
  podeFicarAtiva,
  type Ligacao,
} from "../lib/steps";
import type { EnvioDaDm, Problema } from "../lib/steps";

// A CORRENTE que a lista sempre teve na prática: bloco 0 → bloco 1 → bloco 2 …,
// cada seta `{tipo:"sempre"}`. É exatamente o que `scripts/ligar-passos-existentes.mjs`
// grava em toda automação já existente, e é o que faz os testes escritos antes
// da caminhada por grafo continuarem dizendo o que sempre disseram.
//
// Ela existe para essa continuidade ser VISÍVEL: onde um teste chama
// `interpretar(passos, emCorrente(passos), "0")`, ele está afirmando "com a
// corrente da migração, o comportamento é o de antes". Os testes que provam a
// caminhada em si montam as ligações à mão, e é assim que se distingue um do
// outro.
function emCorrente(passos: unknown[]): unknown[] {
  const ls: unknown[] = [];
  for (let i = 0; i < passos.length - 1; i++) {
    ls.push({
      de: identidadeNoIndice(passos, i),
      quando: { tipo: "sempre" },
      para: identidadeNoIndice(passos, i + 1),
    });
  }
  return ls;
}

describe("interpretar", () => {
  it("enfileira uma sequência simples até o fim", () => {
    const passos = [
      { tipo: "dm", texto: "oi" },
      { tipo: "dm", texto: "aqui está o link", url: "https://x.y" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("para no passo que espera, e o inclui no que enfileira", () => {
    // O pedido de follow É enviado; o que para é o fluxo depois dele.
    const passos = [
      { tipo: "dm", texto: "oi" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "link" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBe("1");
  });

  it("dm com botão e sem url é resposta rápida: enfileira e para", () => {
    // O fluxo antigo mandava as boas-vindas com botão e só seguia depois do
    // toque. Sem isto, o portão de follow consultaria a Meta antes de a pessoa
    // ter engajado.
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0]);
    expect(r.pararEm).toBe("0");
  });

  it("dm com botão E url é botão de link: não para", () => {
    // A pessoa abre o link e a vida segue — não há toque para esperar.
    const passos = [
      { tipo: "dm", texto: "o link", botao_label: "abrir", url: "https://x.y" },
      { tipo: "dm", texto: "depois" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("dm sem botão não para", () => {
    const passos = [
      { tipo: "dm", texto: "oi" },
      { tipo: "dm", texto: "tchau" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("retoma do bloco pedido, sem repetir o que já saiu", () => {
    const passos = [
      { tipo: "dm", texto: "oi" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "link" },
    ];
    const r = interpretar(passos, emCorrente(passos), "2");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([2]);
    expect(r.pararEm).toBeNull();
  });

  it("esperar não é enfileirado: ele atrasa o que vem depois", () => {
    const passos = [
      { tipo: "dm", texto: "link" },
      { tipo: "esperar", minutos: 60 },
      { tipo: "dm", texto: "lembrete" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => [a.indice, a.atrasoSegundos])).toEqual([
      [0, 0],
      [2, 3600],
    ]);
  });

  it("esperas somam", () => {
    const passos = [
      { tipo: "esperar", minutos: 10 },
      { tipo: "esperar", minutos: 5 },
      { tipo: "dm", texto: "depois" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar[0].atrasoSegundos).toBe(900);
  });

  it("pula passo inválido e diz por quê, em vez de estourar", () => {
    // Automação mal montada tem que virar linha em Atividade, não exceção que
    // derruba o webhook e faz a Meta reenviar por 36 horas.
    const passos = [{ tipo: "dm", texto: "ok" }, { tipo: "inventado" }, { tipo: "dm", texto: "fim" }];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 2]);
    expect(r.ignorados).toEqual([{ indice: 1, motivo: "tipo desconhecido: inventado" }]);
  });

  it("pula dm sem texto", () => {
    const passos = [{ tipo: "dm" }, { tipo: "dm", texto: "vale" }];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([1]);
    expect(r.ignorados[0].motivo).toBe("dm sem texto");
  });

  it("lista que não é lista não estoura", () => {
    const r = interpretar(null, [], "0");
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
    const r = interpretar([], [], "0");
    expect(r.enfileirar).toEqual([]);
    expect(r.pararEm).toBeNull();
    expect(r.ignorados).toEqual([{ indice: -1, motivo: "a automação não tem nenhum passo" }]);
    // Motivo PRÓPRIO: quem lê Atividade precisa distinguir "a coluna não é uma
    // lista" (dado corrompido) de "a lista está vazia" (automação sem fluxo).
    expect(r.ignorados[0].motivo).not.toBe(interpretar(null, [], "0").ignorados[0].motivo);
  });

  it("dm com rótulo VAZIO não espera nada", () => {
    // Impede o fluxo travar para sempre: string vazia é ausência de rótulo, e
    // sem rótulo o dreno não monta botão nenhum. Se ela contasse como resposta
    // rápida, `interpretar` pararia num passo cujo botão nunca foi entregue —
    // não haveria o que tocar, e o link nunca sairia.
    const passos = [
      { tipo: "dm", texto: "oi", botao_label: "" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    const r = interpretar(passos, emCorrente(passos), "0");
    expect(r.enfileirar.map((a) => a.indice)).toEqual([0, 1]);
    expect(r.pararEm).toBeNull();
  });

  it("índice além do fim devolve nada, e SEM sinal nenhum", () => {
    // O `+1` de quem parou no último bloco cai aqui — um fim de fluxo NORMAL.
    //
    // Ele já saiu de duas formas, e as duas erravam. Como `ignorado` com o motivo
    // "o fluxo não tem por onde começar" ele afirmava o que não aconteceu, e o
    // tipo era o mesmo do passo mal montado, cuja janela em `logEventThrottled`
    // é de 10 minutos POR AUTOMAÇÃO — a linha benigna suprimia os avisos de
    // verdade da mesma automação pela janela inteira. Depois virou
    // `fluxo_sem_partida`, com tipo e janela próprios, e continuava errado por
    // outro motivo: ele dispara se e só se a pessoa passou o ÚLTIMO bloco, o que
    // é o fim CERTO de todo fluxo de captura — linha em conta saudável.
    //
    // Por isso as duas asserções de silêncio aqui: `ignorados` vazio impede a
    // volta ao balde compartilhado, e a ausência de qualquer outro campo no
    // resultado é o que impede um sinal próprio de renascer.
    const passos = [{ tipo: "dm", texto: "oi" }];
    const r = interpretar(passos, emCorrente(passos), identidadeNoIndice(passos, 99));
    expect(r.enfileirar).toEqual([]);
    expect(r.pararEm).toBeNull();
    expect(r.ignorados).toEqual([]);
    // Fim de fluxo de verdade: a pessoa não está mais no meio de nada.
    expect(r.cursorNoFim).toBe("limpar");
    expect(Object.keys(r).sort()).toEqual(["cursorNoFim", "enfileirar", "ignorados", "pararEm"]);
  });

  it("esperar com minutos inválido é ignorado e não atrasa nada", () => {
    const passos = [{ tipo: "esperar", minutos: -5 }, { tipo: "dm", texto: "x" }];
    const r = interpretar(passos, emCorrente(passos), "0");
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
    expect(interpretar(passos, emCorrente(passos), "0").pararEm).toBe("0");
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
    expect(
      retomadaDoFollow({ passoId: null, automationId: null }, "A", passos, emCorrente(passos))
    ).toEqual({ portao: null, destino: "0" });
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
    // O destino é a seta `sempre` que sai da boas-vindas, e não a posição de
    // baixo: com identidade não há `+1` a escrever.
    expect(retomadaDoFallback(passos, emCorrente(passos))).toEqual({
      portao: null,
      destino: "1",
    });
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
    expect(retomadaDoFallback(passos, emCorrente(passos))).toEqual({
      portao: null,
      destino: "1",
    });
  });

  it("lista sem ponto de espera não retoma nada", () => {
    // Impede repetir a lista inteira: sem passo de espera tudo já foi
    // enfileirado, link incluído, e retomar do zero mandaria tudo de novo.
    const passos = [
      { tipo: "dm", texto: "oi" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(passos, emCorrente(passos))).toBeNull();
    // Automação sem lista nenhuma: o `steps` vem CRU do banco.
    expect(retomadaDoFallback(null, [])).toBeNull();
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
    expect(retomadaDoFallback(passos, emCorrente(passos))).toBeNull();
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
    expect(
      retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
  });

  it("O SEGUINTE É A SETA, e não o vizinho de array", () => {
    // O caso que separa as duas respostas, e ele é a Tarefa 3b inteira num
    // exemplo: a seta `sempre` da boas-vindas pula o portão do meio e vai direto
    // ao link. `indice + 1` devolveria o portão (índice 1); a seta devolve o
    // link (índice 2).
    //
    // E o portão NÃO fica para trás por isso: ele alcança o link, então a regra
    // o marca como passagem. É a metade que impede este teste de virar a
    // descrição de um vazamento.
    const setaQuePula = [
      { de: "b_bem001", quando: { tipo: "sempre" }, para: "b_lnk003" },
      { de: "b_por002", quando: { tipo: "sempre" }, para: "b_lnk003" },
    ];
    expect(
      retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", lista, setaQuePula)
    ).toEqual({ portao: 1, destino: "b_lnk003" });
  });

  it("com o array EMBARALHADO e as mesmas ligações, a retomada é a MESMA", () => {
    // A ordem do array deixou de significar o próximo, e este caso mede isso:
    // as duas listas têm os mesmos blocos e as mesmas setas, em ordens
    // diferentes. Enquanto "o seguinte" foi `indice + 1`, as duas davam
    // respostas diferentes — e uma delas estava errada.
    const embaralhada = [lista[2], lista[0], lista[1]];
    const ligacoes = emCorrente(lista);
    expect(
      retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", lista, ligacoes)
    ).toEqual(
      retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", embaralhada, ligacoes)
    );
  });

  it("cursor num PORTÃO retoma DELE — o toque não entrega o follow", () => {
    // Sem isto, tocar no botão antigo da boas-vindas pulava o portão e o link
    // saía para quem não segue.
    //
    // `portao: null` com o destino EM CIMA do portão é a metade "igual não é
    // passagem" da regra: marcar passagem aqui faria `resolverFollow` consultar
    // a Meta duas vezes no mesmo toque, decidindo de novo o que já foi decidido.
    expect(
      retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
  });

  it("o id sobrevive à REORDENAÇÃO — é o ponto desta fase", () => {
    // Mesma lista, ordem trocada: o cursor continua achando o portão, agora
    // no índice 2. Com índice, ele apontaria para o bloco errado.
    const trocada = [lista[0], lista[2], lista[1]];
    expect(
      retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", trocada, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
  });

  it("cursor de outra automação retoma da ENTRADA", () => {
    expect(
      retomadaDoBotao({ passoId: "b_bem001", automationId: "B" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_bem001" });
  });

  it("cursor NULO retoma do zero", () => {
    // A outra metade do `cursorDesta` devolvendo null, e ela é o caso comum:
    // quem nunca começou o fluxo, e quem o TERMINOU (`executarFluxo` limpa o
    // cursor no fim da lista) — a coluna não separa os dois. O zero é o único
    // ponto afirmável, e o preço é uma mensagem repetida, segurada pela
    // `passoKey` dentro do dia.
    expect(
      retomadaDoBotao({ passoId: null, automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_bem001" });
    expect(
      retomadaDoBotao({ passoId: null, automationId: null }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_bem001" });
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
    expect(
      retomadaDoBotao({ passoId: "b_sumiu9", automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_bem001" });
  });

  it("cursor por índice, gravado antes desta fase, continua funcionando", () => {
    // Lista sem ids e cursor "0": a identidade do primeiro bloco é "0".
    const antiga = [{ tipo: "dm", texto: "Oi!", botao_label: "Quero" }, { tipo: "dm", texto: "Link", url: "https://x.com" }];
    expect(
      retomadaDoBotao({ passoId: "0", automationId: "A" }, "A", antiga, emCorrente(antiga))
    ).toEqual({ portao: null, destino: "1" });
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
    expect(
      retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", passos, emCorrente(passos))
    ).toEqual({ portao: null, destino: "b_eml004" });
    expect(
      retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", passos, emCorrente(passos))
    ).not.toEqual({ portao: null, destino: "b_lnk003" });
    // Pedido INVÁLIDO não é portão, pela mesma regra do `pedir_follow` sem
    // texto: `interpretar` o ignora, logo ele nunca foi enviado.
    const comPedidoQuebrado = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" },
      { id: "b_eml004", tipo: "pedir_email", texto: "   " }, // texto em branco
    ];
    // Sem tipo, segue a seta — e não há seta saindo do último bloco, então o
    // destino é `null`: nada a entregar. Era o `+1` que caía além do fim da
    // lista, e o significado é o mesmo; o que mudou é que agora ele é dito em
    // vez de deduzido de um índice inexistente.
    expect(
      retomadaDoBotao(
        { passoId: "b_eml004", automationId: "A" },
        "A",
        comPedidoQuebrado,
        emCorrente(comPedidoQuebrado)
      )
    ).toEqual({ portao: null, destino: null });
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
    expect(
      retomadaDoBotao(
        { passoId: "2", automationId: "A" },
        "A",
        listaDoFormulario,
        emCorrente(listaDoFormulario)
      )
    ).toEqual({ portao: 1, destino: "3" });
    // Portão INVÁLIDO não é portão: `interpretar` o ignora, logo ele nunca foi
    // entregue e não há o que reavaliar. Vale para os dois papéis dele neste
    // caso — nem é o bloco do cursor, nem é passagem (`portao: null`).
    const comPortaoQuebrado = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" },
      { id: "b_por002", tipo: "pedir_follow", botao_label: "já sigo" }, // sem texto
    ];
    expect(
      retomadaDoBotao(
        { passoId: "b_por002", automationId: "A" },
        "A",
        comPortaoQuebrado,
        emCorrente(comPortaoQuebrado)
      )
    ).toEqual({ portao: null, destino: null });
    // E quando não há seta saindo, `interpretar` não enfileira nada: o toque não
    // faz nada, e a pessoa destrava mandando qualquer mensagem.
    expect(
      interpretar(
        listaDoFormulario,
        emCorrente(listaDoFormulario),
        seguinteDe(emCorrente(listaDoFormulario), "4")
      ).enfileirar
    ).toEqual([]);
  });

  it("lista que NÃO É LISTA não retoma de lugar nenhum, sem estourar", () => {
    // Mesmo ramo do bloco apagado: `indiceDoId` devolve null quando `steps` não
    // é um array, e a ENTRADA de uma lista que não existe também não existe.
    // Antes desta fase isto caía no `+1` e devolvia 2 — um índice inventado
    // sobre uma lista que não existe.
    expect(
      retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", null, [])
    ).toEqual({ portao: null, destino: null });
  });
});

describe("retomadaDoFollow", () => {
  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" },
  ];

  it("cursor desta automação retoma DELE, para o portão ser reavaliado", () => {
    expect(
      retomadaDoFollow({ passoId: "b_por002", automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
  });

  it("sem cursor desta, retoma do PORTÃO — o toque afirma onde a pessoa está", () => {
    expect(
      retomadaDoFollow({ passoId: null, automationId: null }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
    expect(
      retomadaDoFollow({ passoId: "b_bem001", automationId: "B" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
  });

  it("lista sem portão nenhum retoma da ENTRADA", () => {
    const semPortao = [{ id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }];
    expect(
      retomadaDoFollow({ passoId: null, automationId: null }, "A", semPortao, [])
    ).toEqual({ portao: null, destino: "b_bem001" });
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
      retomadaDoFollow(
        { passoId: "b_eml004", automationId: "A" },
        "A",
        comEmailDepoisDoPortao,
        emCorrente(comEmailDepoisDoPortao)
      )
    ).toEqual({ portao: 1, destino: "b_eml004" });
  });

  it("o bloco do cursor NÃO precisa ser portão — vale para qualquer um", () => {
    // Mesma lista, cursor no link (índice 3), que não é portão de espécie
    // nenhuma. A certa devolve destino `b_lnk003`, a cega devolve o portão.
    expect(
      retomadaDoFollow(
        { passoId: "b_lnk003", automationId: "A" },
        "A",
        comEmailDepoisDoPortao,
        emCorrente(comEmailDepoisDoPortao)
      )
    ).toEqual({ portao: 1, destino: "b_lnk003" });
  });

  it("ZERO é identidade legítima, e não ausência de cursor", () => {
    // O `??` de `retomadaDoFollow` tem que ser `??` e não `||`. Com `||`, o
    // índice 0 — falsy — seria lido como "não achei" e a função cairia no
    // portão: a pessoa parada na boas-vindas seria empurrada para o portão.
    //
    // A certa devolve a boas-vindas; tanto a versão com `||` quanto a cega
    // devolvem o portão. E `portao: null`, porque o portão está DEPOIS do
    // destino: ele está no caminho que `interpretar` vai percorrer, e não atrás
    // dele — agora medido por alcançabilidade, e não por posição.
    expect(
      retomadaDoFollow({ passoId: "b_bem001", automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_bem001" });
  });

  it("bloco APAGADO cai no PORTÃO, e não no zero", () => {
    // Ramo NOVO desta fase, e ele não existia com índice: um índice sempre
    // resolvia para alguma coisa, então o cursor desta automação nunca caía no
    // `??`. Agora `indiceDoId` sabe dizer "esse bloco não está mais aqui", e o
    // ponto afirmável volta a ser o portão — pela mesma razão do cursor
    // ausente: o `FOLLOW:<id>` só existe porque o portão DESTA automação foi
    // entregue.
    expect(
      retomadaDoFollow({ passoId: "b_sumiu9", automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });

    // E com o portão LONGE do começo, para o acerto não vir do lugar errado.
    //
    // Com a medida certa: contra a versão CEGA este caso não discrimina, e não
    // tem como discriminar — neste ramo a implementação certa também devolve
    // `indiceDoPortao`, então as duas concordam por construção. O que ele fixa
    // são os outros erros plausíveis: cair no zero (devolveria 0), parar na
    // primeira parada dura (0), ou parar no primeiro passo que espera resposta
    // (1, o pedido de e-mail). A resposta certa é o bloco do índice 3, e nenhum
    // desses a alcança.
    const portaoLaAtras = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }, // 0 parada dura
      { id: "b_eml004", tipo: "pedir_email", texto: "seu e-mail?" }, // 1
      { id: "b_esp005", tipo: "esperar", minutos: 5 }, // 2
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" }, // 3 portão
      { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" }, // 4
    ];
    expect(
      retomadaDoFollow(
        { passoId: "b_sumiu9", automationId: "A" },
        "A",
        portaoLaAtras,
        emCorrente(portaoLaAtras)
      )
    ).toEqual({ portao: null, destino: "b_por002" });
  });

  it("cursor por índice, gravado antes desta fase, continua funcionando", () => {
    // `listaDoFormulario` não tem ids: a identidade do portão é "1".
    expect(
      retomadaDoFollow(
        { passoId: "1", automationId: "A" },
        "A",
        listaDoFormulario,
        emCorrente(listaDoFormulario)
      )
    ).toEqual({ portao: null, destino: "1" });
    // E do zero seria no-op: `interpretar` para na boas-vindas (parada dura) e
    // nunca chega ao portão.
    expect(interpretar(listaDoFormulario, emCorrente(listaDoFormulario), "0").pararEm).toBe("0");
  });

  it("lista que NÃO É LISTA não retoma de lugar nenhum, sem estourar", () => {
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", null, [])).toEqual({
      portao: null,
      destino: null,
    });
    expect(retomadaDoFollow({ passoId: "b_por002", automationId: "A" }, "A", null, [])).toEqual({
      portao: null,
      destino: null,
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
    expect(retomadaDoTexto(lista, emCorrente(lista), 1)).toEqual({
      portao: null,
      destino: "b_por002",
    });
  });

  it("parado numa RESPOSTA RÁPIDA retoma do SEGUINTE — o texto vale como resposta", () => {
    expect(retomadaDoTexto(lista, emCorrente(lista), 0)).toEqual({
      portao: null,
      destino: "b_por002",
    });
  });

  it("parado num PEDIDO DE E-MAIL retoma do SEGUINTE, e aqui difere do ramo `AUTO:`", () => {
    // No toque do botão o pedido de e-mail retoma DELE MESMO, porque o toque não
    // é um endereço. Aqui é: o motor extraiu o e-mail desta mensagem e gravou em
    // `contacts.email` uma linha antes. Repetir o pedido seria pedir de novo o
    // que a pessoa acabou de mandar.
    //
    // E o destino está DEPOIS do portão do índice 1 no caminho, então ele vira
    // PASSAGEM.
    expect(retomadaDoTexto(lista, emCorrente(lista), 2)).toEqual({
      portao: 1,
      destino: "b_lnk003",
    });
    // A diferença entre os dois ramos, lado a lado: o DESTINO é o próprio pedido
    // no toque do botão e o link no texto. A passagem é a mesma nos dois, porque
    // ela olha o CAMINHO até o destino, não o tipo do bloco.
    expect(
      retomadaDoBotao({ passoId: "b_eml004", automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: 1, destino: "b_eml004" });
  });

  it("índice que não espera mais nada segue a seta, e lista que não é lista não estoura", () => {
    // O motor não chega aqui com nenhum dos dois — `passoEsperado` já barrou —,
    // mas a função é pura e a decisão é dela: sem tipo, segue a seta, que é o
    // mesmo que os outros ramos fazem com cursor obsoleto. Do último bloco não
    // sai seta nenhuma, então o destino é `null`.
    expect(retomadaDoTexto(lista, emCorrente(lista), 3)).toEqual({
      portao: null,
      destino: null,
    });
    expect(retomadaDoTexto(null, [], 0)).toEqual({ portao: null, destino: null });
  });

  // A SETA DO "digitou" — a promessa da spec que o motor não percorria.
  //
  // `ligacaoEscolhida(..., {tipo:"texto"})` existia, tinha teste, e NENHUM
  // chamador em produção: quem decidia o destino de quem digita era
  // `seguinteDe`, ou seja, a seta `sempre`. O menu inteiramente ligado não tem
  // `sempre` nenhuma saindo (`retomaPelaSempre`, lib/steps.ts), então quem
  // digitava num menu não ia para lugar nenhum — a seta que o dono desenhou,
  // nomeou e salvou, e que a conferência valida, era ignorada.
  const menu = [
    {
      id: "b_men001",
      tipo: "dm",
      texto: "Escolha:",
      botoes: [{ id: "op_aaaaaa", rotulo: "Quero" }],
    }, // 0 — menu, e o único bloco de espera desta lista
    { id: "b_opa002", tipo: "dm", texto: "veio do botão" }, // 1
    { id: "b_sen003", tipo: "dm", texto: "veio do digitou" }, // 2
  ];
  const doBotao = { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_opa002" };
  const doSenao = { de: "b_men001", quando: { tipo: "senao" }, para: "b_sen003" };
  const daSempre = { de: "b_men001", quando: { tipo: "sempre" }, para: "b_opa002" };

  it("parado num MENU com a seta do `senao`, quem digita vai para o destino DELA", () => {
    expect(retomadaDoTexto(menu, [doBotao, doSenao], 0)).toEqual({
      portao: null,
      destino: "b_sen003",
    });
  });

  it("menu SEM `senao` continua indo pela `sempre` — nada muda para quem já andava", () => {
    expect(retomadaDoTexto(menu, [doBotao, daSempre], 0)).toEqual({
      portao: null,
      destino: "b_opa002",
    });
  });

  it("com as DUAS setas, quem digita segue a do `senao` — a específica ganha da geral", () => {
    // O caso é produzível PELA TELA, e não só por dado de fora: um bloco `dm`
    // de resposta rápida com uma `sempre` desenhada que depois ganha `botoes`
    // vira menu, e nada apaga a `sempre` (o gesto que apaga tem a direção
    // oposta — `desligarSenao`, chamada quando o último botão sai). A `sempre`
    // que sobra nem alça tem: `indiceDaAlca` não acha a chave e a desenha
    // saindo do PRIMEIRO botão.
    //
    // A `senao` ganha porque foi desenhada para ESTE caso — a alça se chama
    // "digitou" (`alcasDeSaida`, app/automacoes/editor/modelos.ts) —, enquanto
    // a `sempre` é a saída que vale sem condição. É a mesma ordem que
    // `envioDaDm` já usa para o bloco que tem `botoes` e `botao_label`: o ramo
    // mais específico entra antes.
    expect(retomadaDoTexto(menu, [doBotao, doSenao, daSempre], 0)).toEqual({
      portao: null,
      destino: "b_sen003",
    });
    // E a ordem das setas na lista não decide nada: a condição decide.
    expect(retomadaDoTexto(menu, [daSempre, doSenao, doBotao], 0)).toEqual({
      portao: null,
      destino: "b_sen003",
    });
  });

  it("PORTÃO com uma `senao` gravada CONTINUA retomando dele mesmo", () => {
    // A garantia central do produto: a mensagem de texto não é o follow, e
    // avançar entregaria o link a quem não segue — bastaria mandar "ok". O
    // `senao` não abre exceção nenhuma nisso.
    const comSenao = [
      ...emCorrente(lista),
      { de: "b_por002", quando: { tipo: "senao" }, para: "b_lnk003" },
    ];
    expect(retomadaDoTexto(lista, comSenao, 1)).toEqual({
      portao: null,
      destino: "b_por002",
    });
  });
});

describe("retomadaDoEmailConhecido", () => {
  // O QUINTO ponto de retomada, e o último a sair de lib/engine.ts. Ele foi o
  // único dos seis pontos da Tarefa 3b que perdeu a aritmética `+ 1` e MESMO
  // ASSIM continuou fora da regra do portão: `seguinteDe` devolve string, e
  // `executarFluxo` embrulha string em `{ portao: null, destino }`. A suíte
  // inteira ficava verde por cima do vazamento, porque a decisão morava dentro
  // de `server-only`.

  it("A JUNÇÃO NO LINK: e-mail já conhecido não entrega o link sem o portão", () => {
    // O grafo medido contra o código anterior, e é o mais banal que se monta no
    // quadro. O portão não está no caminho que `interpretar` percorre a partir
    // da entrada — ele chega no link por uma junção, por fora.
    //
    // Medido antes: a `Retomada` saía `{ portao: null, destino: "b_lnk00003" }`
    // e o link era enfileirado com o `pedir_follow` nunca avaliado.
    const comJuncao = [
      { id: "b_bem00001", tipo: "dm", texto: "oi" }, // 0 entrada
      { id: "b_eml00002", tipo: "pedir_email", texto: "seu e-mail?" }, // 1
      { id: "b_lnk00003", tipo: "dm", texto: "toma", url: "https://x.y" }, // 2 o link
      { id: "b_por00004", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 3
    ];
    const ligacoes = [
      { de: "b_bem00001", quando: { tipo: "sempre" }, para: "b_eml00002" },
      { de: "b_eml00002", quando: { tipo: "sempre" }, para: "b_lnk00003" },
      { de: "b_por00004", quando: { tipo: "sempre" }, para: "b_lnk00003" }, // a junção
    ];
    expect(indiceDoPortao(comJuncao)).toBe(3);
    expect(retomadaDoEmailConhecido(comJuncao, ligacoes, 1)).toEqual({
      portao: 3,
      destino: "b_lnk00003",
    });
  });

  it("A INCONSISTÊNCIA QUE ISSO APAGA: mesmo grafo, mesmo destino, uma resposta só", () => {
    // O grafo medido pela revisão, e o ponto dele é a comparação: DOIS caminhos
    // de código deduziam o MESMO bloco de chegada e respondiam coisas opostas.
    //
    //   fallback -> { portao: 3, destino: "b_lnk00003" }   a regra aplicada
    //   e-mail   -> { portao: null, destino: "b_lnk00003" } a regra pulada
    //
    // A entrada aqui é uma `dm` de RESPOSTA RÁPIDA (rótulo, sem url), então é
    // nela que `interpretar` para e é dela que o fallback deduz o seguinte — que
    // é o link. É o que faz os dois pousarem no mesmo bloco.
    const passos = [
      { id: "b_men00001", tipo: "dm", texto: "escolha", botao_label: "quero" }, // 0
      { id: "b_eml00002", tipo: "pedir_email", texto: "seu e-mail?" }, // 1
      { id: "b_lnk00003", tipo: "dm", texto: "toma", url: "https://x.y" }, // 2
      { id: "b_por00004", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 3
    ];
    const ligacoes = [
      { de: "b_men00001", quando: { tipo: "sempre" }, para: "b_lnk00003" },
      { de: "b_eml00002", quando: { tipo: "sempre" }, para: "b_lnk00003" },
      { de: "b_por00004", quando: { tipo: "sempre" }, para: "b_lnk00003" }, // a junção
    ];
    const esperado = { portao: 3, destino: "b_lnk00003" };
    expect(retomadaDoFallback(passos, ligacoes)).toEqual(esperado);
    expect(retomadaDoEmailConhecido(passos, ligacoes, 1)).toEqual(esperado);
  });

  it("sem portão no caminho, segue a seta `sempre` e não desvia ninguém", () => {
    // O braço sem portão: o portão existe na lista e tem índice MENOR que o
    // destino, e mesmo assim não há nada a atravessar. É o falso-positivo que a
    // comparação de posição fazia.
    const doisBracos = [
      { id: "b_por00001", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 0
      { id: "b_eml00002", tipo: "pedir_email", texto: "seu e-mail?" }, // 1
      { id: "b_out00003", tipo: "dm", texto: "o outro braço" }, // 2
    ];
    const ligacoes = [
      { de: "b_eml00002", quando: { tipo: "sempre" }, para: "b_out00003" },
    ];
    expect(retomadaDoEmailConhecido(doisBracos, ligacoes, 1)).toEqual({
      portao: null,
      destino: "b_out00003",
    });
  });

  it("bloco sem seta `sempre` saindo, e lista que não é lista, devolvem destino null", () => {
    const lista = [{ id: "b_eml00002", tipo: "pedir_email", texto: "seu e-mail?" }];
    expect(retomadaDoEmailConhecido(lista, [], 0)).toEqual({ portao: null, destino: null });
    expect(retomadaDoEmailConhecido(null, [], 0)).toEqual({ portao: null, destino: null });
    // Índice fora da lista: sem identidade não há de onde sair.
    expect(retomadaDoEmailConhecido(lista, [], 7)).toEqual({ portao: null, destino: null });
  });

  it("A REGRA É A MESMA das outras quatro — o portão a montante desvia, o de outro braço não", () => {
    // A prova de que este ponto não ganhou regra própria: nos dois arranjos
    // abaixo o destino é o mesmo bloco, e o que decide é só o CAMINHO.
    const passos = [
      { id: "b_eml00001", tipo: "pedir_email", texto: "seu e-mail?" }, // 0
      { id: "b_lnk00002", tipo: "dm", texto: "toma", url: "https://x.y" }, // 1
      { id: "b_por00003", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 2
    ];
    const base = [{ de: "b_eml00001", quando: { tipo: "sempre" }, para: "b_lnk00002" }];
    // Portão sem seta nenhuma: não alcança o link, não desvia.
    expect(retomadaDoEmailConhecido(passos, base, 0)).toEqual({
      portao: null,
      destino: "b_lnk00002",
    });
    // O MESMO destino, com o portão alcançando-o por um BOTÃO — e não por uma
    // `sempre`. Contar só as `sempre` deixaria este caso passar; é o plantio que
    // a varredura acusa.
    const comBotao = [
      ...base,
      { de: "b_por00003", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_lnk00002" },
    ];
    expect(retomadaDoEmailConhecido(passos, comBotao, 0)).toEqual({
      portao: 2,
      destino: "b_lnk00002",
    });
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
    expect(retomadaDoTexto(entrada1, emCorrente(entrada1), 1)).toEqual({
      portao: 0,
      destino: "b_lnk00003",
    });
  });

  it("ENTRADA 2 FECHA: o toque no botão do bloco depois do portão não o pula", () => {
    // Sem a regra o resultado era 3 — o LINK —, com o portão do índice 1 nunca
    // avaliado.
    expect(retomadaDoBotao(noBloco2, "A", entrada2, emCorrente(entrada2))).toEqual({
      portao: 1,
      destino: "b_lnk00004",
    });
    // O "Já sigo!" e o texto chegam ao mesmo lugar pela mesma regra: nenhum dos
    // três caminhos de volta atravessa um portão sem avaliá-lo.
    expect(retomadaDoFollow(noBloco2, "A", entrada2, emCorrente(entrada2))).toEqual({
      portao: 1,
      destino: "b_seg00003",
    });
    expect(retomadaDoTexto(entrada2, emCorrente(entrada2), 2)).toEqual({
      portao: 1,
      destino: "b_lnk00004",
    });
  });

  it("A ARMADILHA SUMIU: quem venceu o portão e está parado no bloco 2 ALCANÇA o link", () => {
    // O caso que derrubou a primeira versão da regra, e ele é MEDIDO aqui, não
    // deduzido: `interpretar` é o que o motor roda depois de vencer o portão.
    //
    // Os argumentos são IDÊNTICOS aos da ENTRADA 2 acima. A diferença está só na
    // história: aqui o cursor é o real de quem seguiu o perfil, venceu o portão,
    // recebeu o bloco 2 e parou nele.
    const r = retomadaDoBotao(noBloco2, "A", entrada2, emCorrente(entrada2));
    expect(r).toEqual({ portao: 1, destino: "b_lnk00004" });

    // Vencido o portão, o motor executa a partir do DESTINO: o link sai, e a
    // lista termina (`pararEm: null`, o que faz `executarFluxo` limpar o cursor).
    const daPassagem = interpretar(entrada2, emCorrente(entrada2), r.destino);
    expect(daPassagem.enfileirar.map((a) => a.indice)).toEqual([3]);
    expect(daPassagem.pararEm).toBeNull();

    // E a versão RECUSADA da regra, `portão + 1`, medida no mesmo lugar: ela
    // reinterpreta a lista e para na PRÓPRIA resposta rápida do índice 2. O
    // bloco 3 — o link — não é alcançado.
    const daRebobinada = interpretar(entrada2, emCorrente(entrada2), identidadeNoIndice(entrada2, r.portao! + 1));
    expect(daRebobinada.enfileirar.map((a) => a.indice)).toEqual([2]);
    expect(daRebobinada.pararEm).toBe(identidadeNoIndice(entrada2, 2));

    // O que fecha o ciclo, e é o que tornava a armadilha SEM SAÍDA: parando no
    // 2, `executarFluxo` regrava o cursor no 2 — o mesmo com que este teste
    // começou. O toque seguinte devolve a mesma coisa, e o seguinte também.
    // Mandar texto não salvava: o ramo de texto rebobinaria igual.
    expect(retomadaDoBotao(noBloco2, "A", entrada2, emCorrente(entrada2))).toEqual(r);
    expect(retomadaDoTexto(entrada2, emCorrente(entrada2), 2).portao).toBe(1);
  });

  it("NINGUÉM RECEBE MENSAGEM REPETIDA por causa da regra", () => {
    // O preço que a versão recusada cobrava e esta não cobra. A passagem não
    // reenfileira nada: `interpretar` começa em `destino`, então todo bloco
    // entre o portão e o destino fica de fora — inclusive o bloco 2, que a
    // pessoa acabou de receber.
    const r = retomadaDoBotao(noBloco2, "A", entrada2, emCorrente(entrada2));
    const daPassagem = interpretar(entrada2, emCorrente(entrada2), r.destino).enfileirar.map(
      (a) => a.indice
    );
    expect(daPassagem.every((i) => i >= indiceDoId(entrada2, r.destino!)!)).toBe(true);
    expect(daPassagem).not.toContain(2);

    // A rebobinada reenviava o bloco 2 — segurado pela `passoKey` só dentro do
    // dia, e virado o balde ele sai de novo para uma pessoa real.
    expect(
      interpretar(entrada2, emCorrente(entrada2), identidadeNoIndice(entrada2, r.portao! + 1)).enfileirar.map((a) => a.indice)
    ).toContain(2);

    // O portão em si não é reenviado quando é vencido: `resolverFollow`
    // (lib/engine.ts) só enfileira o pedido no ramo em que BARRA. Isso é do
    // motor e não cabe aqui; o que cabe é que a passagem não o põe na lista de
    // enfileirar — o índice 1 não aparece em nenhuma das duas medições acima.
    expect(daPassagem).not.toContain(1);
  });

  it("na CORRENTE a regra não muda nada no fallback, e essa era a demonstração antiga", () => {
    // Enquanto o fluxo foi uma fila, a regra era demonstravelmente inalcançável
    // aqui: `interpretar` a partir da entrada para no PRIMEIRO passo que espera,
    // e portão espera; logo nenhum portão precede `pararEm`, e o `+1` do ramo
    // `dm` caía no máximo EM CIMA do portão seguinte. Numa corrente isso
    // continua valendo, e é o que estes dois casos medem.
    const portaoDepois = [
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(portaoDepois, emCorrente(portaoDepois))).toEqual({
      portao: null,
      destino: "1",
    });

    // Portão em PRIMEIRO: `interpretar` para NELE, e o destino é ele mesmo.
    const portaoPrimeiro = [
      { tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" },
      { tipo: "dm", texto: "oi", botao_label: "quero!" },
      { tipo: "dm", texto: "o link", url: "https://x.y" },
    ];
    expect(retomadaDoFallback(portaoPrimeiro, emCorrente(portaoPrimeiro))).toEqual({
      portao: null,
      destino: "0",
    });

    // Duas paradas duras: não retoma nada, e não há destino sobre o qual a
    // regra pudesse decidir. É a MESMA lista da armadilha, o que mostra que a
    // proteção do fallback vem de outro lugar (`contarParadasDuras`).
    expect(retomadaDoFallback(entrada2, emCorrente(entrada2))).toBeNull();
  });

  it("A DEMONSTRAÇÃO ANTIGA CAIU: com JUNÇÃO, o fallback alcança o link por fora do portão", () => {
    // É por este caso que `retomadaDoFallback` passou a receber a regra, e ele
    // não existia enquanto o fluxo era uma fila.
    //
    // O portão não está no caminho que `interpretar` percorre a partir da
    // entrada — está num braço à parte —, então a demonstração antiga continua
    // dizendo "nenhum portão precede `pararEm`". Só que ele ALCANÇA o link por
    // uma junção, e é o link que o fallback deduz como destino. Entregá-lo sem
    // avaliar o portão é o vazamento.
    //
    // E a guarda POSICIONAL não pega: o portão está no índice 2 e o destino no
    // 1, então `portao < destino` é `2 < 1`, falso. É o falso-negativo medido
    // que esta tarefa recebeu de brinde — aqui ele está exercitado.
    const comJuncao = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero!" }, // 0
      { id: "b_lnk003", tipo: "dm", texto: "o link", url: "https://x.y" }, // 1
      { id: "b_por002", tipo: "pedir_follow", texto: "me segue", botao_label: "já sigo" }, // 2
    ];
    const ligacoes = [
      { de: "b_bem001", quando: { tipo: "sempre" }, para: "b_lnk003" },
      { de: "b_por002", quando: { tipo: "sempre" }, para: "b_lnk003" },
    ];
    expect(indiceDoPortao(comJuncao)).toBe(2);
    expect(retomadaDoFallback(comJuncao, ligacoes)).toEqual({
      portao: 2,
      destino: "b_lnk003",
    });
  });
});

// ---------------------------------------------------------------------------
// O PORTÃO POR CAMINHO, medido nos dois erros que a comparação de posição fazia.
// São os dois casos que separam a regra nova da antiga, e nenhum deles é
// hipotético: os dois são montáveis no quadro.
// ---------------------------------------------------------------------------
describe("o portão deixa de ser posição e passa a ser caminho", () => {
  // O caso da medição que abriu a Tarefa 3b: a seta de um botão saltando por
  // cima do portão. O portão tem índice MENOR que o destino, então a guarda
  // posicional até o pegaria — o que não o pegava era o motor passar um número
  // cru. Fica aqui porque é o vazamento que a tarefa existe para fechar.
  const saltandoOPortao = [
    { id: "b_men001", tipo: "dm", texto: "escolha", botao_label: "quero" }, // 0
    { id: "b_por002", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 1
    { id: "b_lnk003", tipo: "dm", texto: "toma", url: "https://x.y" }, // 2
  ];
  const setaDoBotao = [
    { de: "b_men001", quando: { tipo: "sempre" }, para: "b_por002" },
    { de: "b_por002", quando: { tipo: "sempre" }, para: "b_lnk003" },
    { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_lnk003" },
  ];

  it("O TOQUE NUM BOTÃO QUE SALTA O PORTÃO NÃO ENTREGA O LINK SEM ELE", () => {
    // Medido com o código anterior: `caminhoDoBotao` devolvia `{indice: 2}`, o
    // motor o passava cru a `executarFluxo`, a `Retomada` saía
    // `{portao: null, destino: 2}` e a url era enfileirada com o `pedir_follow`
    // do meio nunca avaliado.
    const r = caminhoDoBotao(
      lerPayload("AUTO:A:b_men001:op_aaaaaa")!,
      saltandoOPortao,
      setaDoBotao
    );
    expect(r).toEqual({ retomada: { portao: 1, destino: "b_lnk003" } });
  });

  it("PORTÃO NO CAMINHO COM ÍNDICE MAIOR é atravessado — é o que a posição não vê", () => {
    // O falso-negativo da guarda posicional, e o caso que a versão de índice não
    // passa: portão no índice 2, link no índice 1, seta do portão para o link.
    // `portao < destino` é `2 < 1`, falso — a comparação não vê portão nenhum e
    // o link sai para quem não segue.
    const portaoDepoisNoArray = [
      { id: "b_men001", tipo: "dm", texto: "escolha", botao_label: "quero" }, // 0
      { id: "b_lnk003", tipo: "dm", texto: "toma", url: "https://x.y" }, // 1
      { id: "b_por002", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 2
    ];
    const ligacoes = [
      { de: "b_men001", quando: { tipo: "sempre" }, para: "b_por002" },
      { de: "b_por002", quando: { tipo: "sempre" }, para: "b_lnk003" },
    ];
    expect(indiceDoPortao(portaoDepoisNoArray)).toBe(2);
    // Pela seta `sempre`, quem está parado na boas-vindas vai para o PORTÃO, que
    // é o destino e não passagem.
    expect(retomadaDoTexto(portaoDepoisNoArray, ligacoes, 0)).toEqual({
      portao: null,
      destino: "b_por002",
    });
    // E quem chega ao link por um salto — um botão, o caso real — atravessa o
    // portão, que está no caminho apesar de ter índice MAIOR.
    const comSalto = [
      ...ligacoes,
      { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_lnk003" },
    ];
    expect(
      caminhoDoBotao(lerPayload("AUTO:A:b_men001:op_aaaaaa")!, portaoDepoisNoArray, comSalto)
    ).toEqual({ retomada: { portao: 2, destino: "b_lnk003" } });
  });

  it("PORTÃO NOUTRO BRAÇO não é atravessado — quem não passa por ele não é desviado", () => {
    // O erro do outro lado, e ele é o que a comparação posicional fazia sozinha:
    // o portão tem índice MENOR que o destino, então `portao < destino` mandava
    // atravessar — um portão que não está no caminho daquela pessoa. Custava uma
    // consulta à Meta e, para quem não segue, um pedido de follow que o braço
    // dela não exigia.
    //
    // POR QUE ESTE TESTE PASSA, dito exatamente, porque o nome dele promete mais
    // do que a regra entrega: ele passa porque o portão NÃO ALCANÇA `b_out004` —
    // não porque a regra saiba de quem é o braço. A pergunta implementada é
    // `haCaminho(portão, destino)`, "o portão está a montante do destino", e não
    // "o portão está no braço desta pessoa". Bastaria uma seta do portão para
    // `b_out004` e este mesmo caso passaria a desviar, com a pessoa continuando
    // a não passar por ele. É conservador de propósito — erra para o lado da
    // consulta a mais — e o porquê está em `atravessandoOPortao` (lib/steps.ts).
    const doisBracos = [
      { id: "b_men001", tipo: "dm", texto: "escolha", botao_label: "quero" }, // 0
      { id: "b_por002", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 1
      { id: "b_lnk003", tipo: "dm", texto: "toma", url: "https://x.y" }, // 2
      { id: "b_out004", tipo: "dm", texto: "o outro braço" }, // 3
    ];
    const ligacoes = [
      { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_por002" },
      { de: "b_por002", quando: { tipo: "sempre" }, para: "b_lnk003" },
      { de: "b_men001", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_out004" },
    ];
    // O braço SEM portão: o índice do portão (1) é menor que o do destino (3), e
    // mesmo assim não há nada a atravessar.
    expect(
      caminhoDoBotao(lerPayload("AUTO:A:b_men001:op_bbbbbb")!, doisBracos, ligacoes)
    ).toEqual({ retomada: { portao: null, destino: "b_out004" } });
    // O braço COM portão: o destino é o próprio portão, e "igual não é
    // passagem" — `interpretar` para nele sozinha.
    expect(
      caminhoDoBotao(lerPayload("AUTO:A:b_men001:op_aaaaaa")!, doisBracos, ligacoes)
    ).toEqual({ retomada: { portao: null, destino: "b_por002" } });
  });

  it("quem já passou pelo portão desvia SE ele ainda alcança o destino, e só então", () => {
    // O NOME ANTES DIZIA "portão JÁ ATRAVESSADO não desvia de novo", e a primeira
    // asserção deste teste diz `{ portao: 0 }` — ou seja, DESVIA. O nome afirmava
    // o contrário do que o teste mede, e foi trocado por isso.
    //
    // A regra implementada não sabe se alguém já atravessou: `haCaminho(portão,
    // destino)` pergunta se o portão está A MONTANTE do destino, e um portão já
    // vencido continua a montante de tudo o que vem depois dele. Quem desvia de
    // novo, desvia; o custo é uma consulta à Meta que devolve "passou".
    //
    // O que o teste mede de verdade é que o desvio acompanha o CAMINHO e nada
    // mais: com seta do portão até o link, desvia; sem ela, não.
    const depoisDoPortao = [
      { id: "b_por002", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" }, // 0
      { id: "b_seg003", tipo: "dm", texto: "Pronto?", botao_label: "Pronto" }, // 1
      { id: "b_lnk004", tipo: "dm", texto: "toma", url: "https://x.y" }, // 2
    ];
    const ligacoes = [
      { de: "b_por002", quando: { tipo: "sempre" }, para: "b_seg003" },
      { de: "b_seg003", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_lnk004" },
    ];
    // Sem seta `sempre` do portão para o link, o portão só alcança o link pelo
    // braço do botão — e ele alcança, então a passagem VALE. É o mesmo resultado
    // da regra antiga, e o motivo é diferente.
    expect(
      caminhoDoBotao(lerPayload("AUTO:A:b_seg003:op_aaaaaa")!, depoisDoPortao, ligacoes)
    ).toEqual({ retomada: { portao: 0, destino: "b_lnk004" } });

    // O caso em que ele NÃO desvia: o link num braço que o portão não alcança.
    const semLigacaoDoPortao = [
      { de: "b_seg003", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_lnk004" },
    ];
    expect(
      caminhoDoBotao(
        lerPayload("AUTO:A:b_seg003:op_aaaaaa")!,
        depoisDoPortao,
        semLigacaoDoPortao
      )
    ).toEqual({ retomada: { portao: null, destino: "b_lnk004" } });
  });
});

describe("haCaminho", () => {
  const ligacoes = [
    { de: "a", quando: { tipo: "sempre" }, para: "b" },
    { de: "b", quando: { tipo: "botao", botao: "op_x" }, para: "c" },
    { de: "z", quando: { tipo: "sempre" }, para: "a" },
  ];

  it("acha o caminho direto e o indireto", () => {
    expect(haCaminho(ligacoes, "a", "b")).toBe(true);
    expect(haCaminho(ligacoes, "a", "c")).toBe(true);
  });

  it("não inventa caminho de volta — as setas têm direção", () => {
    expect(haCaminho(ligacoes, "c", "a")).toBe(false);
    expect(haCaminho(ligacoes, "b", "a")).toBe(false);
  });

  it("conta TODAS as condições, e não só a `sempre`", () => {
    // Se contasse só a `sempre`, o braço do botão ficaria de fora — e é
    // justamente por um braço de botão que o link vazava.
    expect(haCaminho([{ de: "a", quando: { tipo: "botao", botao: "op_x" }, para: "b" }], "a", "b"))
      .toBe(true);
    expect(haCaminho([{ de: "a", quando: { tipo: "senao" }, para: "b" }], "a", "b")).toBe(true);
  });

  it("um ANEL não trava a busca", () => {
    // Sem o conjunto de visitados, isto não retornaria nunca — e o anel é
    // montável no quadro ("menu → opção → volta ao menu").
    const anel = [
      { de: "a", quando: { tipo: "sempre" }, para: "b" },
      { de: "b", quando: { tipo: "sempre" }, para: "a" },
    ];
    expect(haCaminho(anel, "a", "c")).toBe(false);
    expect(haCaminho(anel, "a", "a")).toBe(true);
  });

  it("bloco sem saída nenhuma, e ligações que não são lista, devolvem false", () => {
    expect(haCaminho(ligacoes, "c", "z")).toBe(false);
    expect(haCaminho(null, "a", "b")).toBe(false);
  });
});

describe("seguinteDe", () => {
  const ligacoes = [
    { de: "a", quando: { tipo: "botao", botao: "op_x" }, para: "c" },
    { de: "a", quando: { tipo: "sempre" }, para: "b" },
  ];

  it("devolve o destino da `sempre`, e ignora as outras condições", () => {
    // A ordem importa neste caso: a `botao` vem PRIMEIRO na lista, e mesmo assim
    // quem move a caminhada sozinha é a `sempre`.
    expect(seguinteDe(ligacoes, "a")).toBe("b");
  });

  it("null quando não há `sempre` saindo — o caminho acabou ali", () => {
    expect(seguinteDe([{ de: "a", quando: { tipo: "botao", botao: "op_x" }, para: "c" }], "a"))
      .toBeNull();
    expect(seguinteDe(ligacoes, "b")).toBeNull();
    expect(seguinteDe(null, "a")).toBeNull();
  });

  it("havendo mais de uma `sempre`, ganha a primeira gravada", () => {
    expect(
      seguinteDe(
        [
          { de: "a", quando: { tipo: "sempre" }, para: "b" },
          { de: "a", quando: { tipo: "sempre" }, para: "c" },
        ],
        "a"
      )
    ).toBe("b");
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
  // tocar nele daqui a um mês. Por isso as três formas convivem (a quarta parte
  // chegou na Tarefa 3 — ver describe("lerPayload com o botão")), e isto não é
  // dívida a limpar: é a forma final.

  it("lê a forma nova, com o bloco", () => {
    expect(lerPayload("AUTO:auto-1:b_7f3a91c2")).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: "b_7f3a91c2",
      botaoId: null,
    });
  });

  it("lê a forma ANTIGA, sem o bloco — botão entregue antes da Fase 1b", () => {
    expect(lerPayload("AUTO:auto-1")).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: null,
      botaoId: null,
    });
  });

  it("vale para o FOLLOW nas duas formas", () => {
    expect(lerPayload("FOLLOW:auto-1:b_por002")).toEqual({
      prefixo: "FOLLOW",
      automationId: "auto-1",
      passoId: "b_por002",
      botaoId: null,
    });
    expect(lerPayload("FOLLOW:auto-1")).toEqual({
      prefixo: "FOLLOW",
      automationId: "auto-1",
      passoId: null,
      botaoId: null,
    });
  });

  it("o id da automação é um uuid, que tem hífen mas não dois-pontos", () => {
    expect(lerPayload("AUTO:39ae24ec-c487-40ff-a387-c041cb3f0d23:b_aaa111")).toEqual({
      prefixo: "AUTO",
      automationId: "39ae24ec-c487-40ff-a387-c041cb3f0d23",
      passoId: "b_aaa111",
      botaoId: null,
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
      botaoId: null,
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
    // "AUTO:a:b:c" NÃO entra aqui: são quatro partes (automação "a", bloco
    // "b", botão "c"), e desde a Tarefa 3 essa é a forma VÁLIDA de um botão
    // dentro de um bloco de escolha — ver describe("lerPayload com o botão").
    // Cinco partes é que não é payload nosso, e está lá embaixo.
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
    // Se o formato emitido e o formato lido divergirem, o sintoma não é erro —
    // é o botão parar de fazer efeito, calado.
    //
    // ESTE COMENTÁRIO DIZIA que o teste era "o único lugar em que as duas pontas
    // se encontram, porque o que monta o payload está dentro de `server-only` e
    // nenhum teste chega lá". Deixou de ser verdade na Tarefa 4: as três
    // escritoras — `payloadDoBotao`, `payloadDaRespostaRapida` e
    // `payloadDoPortao` — saíram do motor para `lib/steps.ts` e têm teste
    // próprio.
    //
    // O teste continua valendo, e por um motivo que sobreviveu à mudança: ele é
    // o único que casa a escrita com a LEITURA sobre a mesma lista de blocos.
    // Testar cada ponta em separado deixa passar uma divergência de formato em
    // que as duas estão internamente certas.
    const lista = [
      { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
      { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    ];
    const automationId = "39ae24ec-c487-40ff-a387-c041cb3f0d23";

    const doBotao = `AUTO:${automationId}:${identidadeDoPasso(lista[0], 0)}`;
    const lidoDoBotao = lerPayload(doBotao);
    expect(lidoDoBotao).toEqual({
      prefixo: "AUTO", automationId, passoId: "b_bem001", botaoId: null,
    });
    expect(indiceDoId(lista, lidoDoBotao!.passoId!)).toBe(0);

    const doPortao = `FOLLOW:${automationId}:${identidadeDoPasso(lista[1], 1)}`;
    const lidoDoPortao = lerPayload(doPortao);
    expect(lidoDoPortao).toEqual({
      prefixo: "FOLLOW", automationId, passoId: "b_por002", botaoId: null,
    });
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
    expect(retomadaDoBotao(cursorDoPayload, "A", lista, emCorrente(lista))).toEqual({
      portao: null,
      destino: "b_por002",
    });

    // Já o botão cujo bloco não está mais na lista não afirma nada, e cai na
    // ENTRADA — a boas-vindas de novo. Com o cursor mandando, chegar aqui exige que
    // os DOIS blocos tenham sumido, o do cursor e o do botão — o que um save do
    // formulário fazia de uma vez, sorteando ids novos. Com o quadro
    // preservando os ids, é preciso apagar os dois blocos de verdade.
    const doApagado = lerPayload("AUTO:A:b_sumiu9")!;
    expect(
      retomadaDoBotao(
        { passoId: doApagado.passoId, automationId: "A" },
        "A",
        lista,
        emCorrente(lista)
      )
    ).toEqual({ portao: null, destino: "b_bem001" });
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
    // o descarta e a A recomeça da ENTRADA — a boas-vindas de novo.
    expect(retomadaDoBotao(cursorEmOutra, "A", lista, emCorrente(lista))).toEqual({
      portao: null,
      destino: "b_bem001",
    });

    // Com o payload NOVO o bloco é o do botão da A, e a retomada é a certa.
    const p = lerPayload("AUTO:A:b_bem001")!;
    expect(
      retomadaDoBotao({ passoId: p.passoId, automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
  });

  it("no FOLLOW, os dois cursores possíveis dão respostas DIFERENTES", () => {
    // As duas pontas do ramo `FOLLOW:`, lado a lado, para ficar visível o que a
    // ORDEM entre elas decide — e ela é decidida em `cursorDaRetomada`, não
    // aqui.
    //
    // Com o cursor do contato (adiante do portão) o destino é `b_lem006`: a
    // pessoa continua onde estava, e o portão do índice 1 é atravessado a
    // caminho. Com o bloco do payload o destino é o próprio portão: ela VOLTA a
    // ele, e `executarFluxo` reenfileira tudo entre os dois — a `passoKey` só
    // segura isso dentro do dia.
    //
    // É a diferença entre atravessar o portão e voltar a ele, e ela é justamente
    // o que a regra do portão preserva: atravessar avalia o portão sem
    // reenfileirar nada entre os dois.
    //
    // Uma versão anterior desta fase preferia o payload e produzia o portão.
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
    expect(retomadaDoFollow(cursorAdiante, "A", lista, emCorrente(lista))).toEqual({
      portao: 1,
      destino: "b_lem006",
    });

    const p = lerPayload("FOLLOW:A:b_por002")!;
    expect(
      retomadaDoFollow({ passoId: p.passoId, automationId: "A" }, "A", lista, emCorrente(lista))
    ).toEqual({ portao: null, destino: "b_por002" });
  });
});

describe("ligacaoEscolhida", () => {
  const ls = [
    { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_opa002" },
    { de: "b_men001", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_opb003" },
    { de: "b_men001", quando: { tipo: "senao" }, para: "b_sen004" },
  ];

  it("o botão tocado leva ao destino DAQUELE botão", () => {
    expect(ligacaoEscolhida(ls, "b_men001", { tipo: "botao", botao: "op_bbbbbb" })).toBe("b_opb003");
  });

  it("texto cai no senão", () => {
    expect(ligacaoEscolhida(ls, "b_men001", { tipo: "texto" })).toBe("b_sen004");
  });

  it("sem senão, texto não leva a lugar nenhum", () => {
    const semSenao = ls.slice(0, 2);
    expect(ligacaoEscolhida(semSenao, "b_men001", { tipo: "texto" })).toBe(null);
  });

  it("botão que não tem ligação devolve null, e NÃO cai no senão", () => {
    // O senão é para quem DIGITOU. Um botão sem destino é defeito de montagem,
    // e mandá-lo para o senão esconderia isso.
    expect(ligacaoEscolhida(ls, "b_men001", { tipo: "botao", botao: "op_zzzzzz" })).toBe(null);
  });

  it("havendo mais de uma que sirva, ganha a PRIMEIRA gravada", () => {
    // A regra do desempate estava escrita no comentário e no código, e nada a
    // media: trocar o `find` por uma busca de trás para frente não derrubava
    // teste nenhum. Duas ligações para o MESMO botão só chegam de lista
    // gravada fora do editor, e é justamente por isso que a escolha precisa ser
    // afirmada — não há conferência antes dela.
    const duas = [
      { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_pri002" },
      { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_seg003" },
    ];
    expect(ligacaoEscolhida(duas, "b_men001", { tipo: "botao", botao: "op_aaaaaa" })).toBe(
      "b_pri002"
    );

    // E o mesmo vale para o `senao`, que tem o mesmo desempate.
    const doisSenao = [
      { de: "b_men001", quando: { tipo: "senao" }, para: "b_pri002" },
      { de: "b_men001", quando: { tipo: "senao" }, para: "b_seg003" },
    ];
    expect(ligacaoEscolhida(doisSenao, "b_men001", { tipo: "texto" })).toBe("b_pri002");
  });

  it("não estoura com lixo", () => {
    expect(ligacaoEscolhida(null, "b_men001", { tipo: "texto" })).toBe(null);
    expect(ligacaoEscolhida(ls, "", { tipo: "texto" })).toBe(null);
  });
});

describe("lerPayload com o botão", () => {
  it("lê a forma de quatro partes", () => {
    expect(lerPayload("AUTO:auto-1:b_men001:op_aaaaaa")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: "b_men001", botaoId: "op_aaaaaa",
    });
  });

  it("AS TRÊS FORMAS ANTIGAS CONTINUAM VÁLIDAS", () => {
    // Um botão entregue vive na conversa da pessoa indefinidamente. Apagar
    // qualquer um destes ramos quebraria todo botão já enviado, de uma vez.
    expect(lerPayload("AUTO:auto-1")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: null, botaoId: null });
    expect(lerPayload("AUTO:auto-1:b_men001")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: "b_men001", botaoId: null });
    expect(lerPayload("FOLLOW:auto-1:b_por002")).toEqual({
      prefixo: "FOLLOW", automationId: "auto-1", passoId: "b_por002", botaoId: null });
  });

  it("cinco partes continuam sendo recusadas", () => {
    expect(lerPayload("AUTO:a:b:c:d")).toBe(null);
  });

  it("quarta parte em branco é recusada", () => {
    expect(lerPayload("AUTO:auto-1:b_men001:")).toBe(null);
  });

  it("BLOCO em branco é recusado TAMBÉM na forma de quatro partes", () => {
    // A guarda do bloco vazio passou de `=== 3` para `>= 3` justamente para
    // cobrir este caso, e nada media a diferença: voltando para `=== 3` toda a
    // suíte continuava verde. Aceitar poria `passoId: ""` no payload, e ""
    // não é identidade de bloco nenhum — `caminhoDoBotao` procuraria as saídas
    // de um bloco que não existe e o toque morreria como órfão.
    expect(lerPayload("AUTO:auto-1::op_aaaaaa")).toBe(null);
    expect(lerPayload("FOLLOW:auto-1::op_aaaaaa")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// A ESCRITA DO PAYLOAD, e por que ela ganhou testes só na revisão da Tarefa 4.
//
// Ela existia desde aquela tarefa, mas como interpolação solta dentro de
// `enfileirarPasso` (lib/engine.ts) — arquivo `server-only` que NENHUM teste
// desta suíte executa, e que `scripts/varredura-portao.mjs` também não importa
// (a varredura escrevia o payload à mão, com a ideia DELA do formato). A
// revisão mediu o que isso custava: trocando o id do botão pelo id do bloco
// naquela linha, a suíte fechava 485/485, o typecheck saía limpo e a varredura
// saía idêntica. Cada botão do menu levaria a pessoa ao destino de outro botão,
// e nada no projeto tinha como dizer isso.
//
// Agora a regra mora em `payloadDoBotao` (lib/steps.ts), coladinha em
// `lerPayload`, que a lê de volta — e é a MESMA função que a varredura importa.
// ---------------------------------------------------------------------------
describe("payloadDoBotao", () => {
  it("escreve a forma de quatro partes, na ordem em que `lerPayload` a lê", () => {
    expect(payloadDoBotao("auto-1", "b_men001", "op_aaaaaa")).toBe(
      "AUTO:auto-1:b_men001:op_aaaaaa"
    );
  });

  it("IDA E VOLTA: o que ela escreve, `lerPayload` lê de volta campo a campo", () => {
    // É este teste que fixa a ORDEM. Os três argumentos são `string`, então
    // trocar dois deles compila — e o payload continua com quatro partes e
    // continua sendo lido sem erro. O que muda é o SIGNIFICADO de cada parte, e
    // só uma asserção campo a campo o vê.
    expect(lerPayload(payloadDoBotao("auto-1", "b_men001", "op_aaaaaa"))).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: "b_men001",
      botaoId: "op_aaaaaa",
    });
  });

  it("o BLOCO SEM ID entra como índice em texto, e a ida e volta continua valendo", () => {
    // `identidadeDoPasso` devolve o índice quando o bloco não tem id, e é esse
    // valor que o motor passa aqui. Exigir o prefixo `b_` recusaria o botão de
    // toda automação que a migração não alcançou — a mesma razão pela qual
    // `lerPayload` não confere a forma do bloco.
    expect(lerPayload(payloadDoBotao("auto-1", "2", "op_aaaaaa"))).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: "2",
      botaoId: "op_aaaaaa",
    });
  });

  it("CADA BOTÃO DO MENU LEVA AO DESTINO DO SEU PRÓPRIO BOTÃO", () => {
    // A prova de ponta a ponta do lado puro: escrever o payload como o motor o
    // escreve, ler de volta e resolver o caminho. Três botões, três destinos
    // distintos, nenhum vazando para o vizinho.
    //
    // É este teste que pega o defeito que a revisão plantou — o payload
    // carregando o id do BLOCO no lugar do id do botão. Com ele, os três
    // toques procurariam a ligação `{de: op_xxxxxx}`, que não existe, e os três
    // virariam botão órfão de uma vez.
    const menu = {
      id: "b_men001",
      tipo: "dm",
      texto: "Qual?",
      botoes: [
        { id: "op_aaaaaa", rotulo: "A" },
        { id: "op_bbbbbb", rotulo: "B" },
        { id: "op_cccccc", rotulo: "C" },
      ],
    };
    const passos = [
      menu,
      { id: "b_desa01", tipo: "dm", texto: "destino A" },
      { id: "b_desb02", tipo: "dm", texto: "destino B" },
      { id: "b_desc03", tipo: "dm", texto: "destino C" },
    ];
    const ligacoes = [
      { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_desa01" },
      { de: "b_men001", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_desb02" },
      { de: "b_men001", quando: { tipo: "botao", botao: "op_cccccc" }, para: "b_desc03" },
    ];

    const envio = envioDaDm(menu as Parameters<typeof envioDaDm>[0]);
    if (envio.forma !== "botoes") throw new Error(`o menu não saiu como menu: ${envio.forma}`);

    const destinos = envio.botoes.map((b) => {
      const payload = lerPayload(payloadDoBotao("auto-1", menu.id, b.id));
      return caminhoDoBotao(payload!, passos, ligacoes);
    });
    expect(destinos).toEqual([
      { retomada: { portao: null, destino: "b_desa01" } },
      { retomada: { portao: null, destino: "b_desb02" } },
      { retomada: { portao: null, destino: "b_desc03" } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// AS OUTRAS DUAS ESCRITORAS, e elas chegaram uma rodada depois: `payloadDoBotao`
// fechou só a forma de QUATRO partes, e as de três — a resposta rápida de um
// botão só e o portão de seguidor — continuaram como interpolação à mão dentro
// de lib/engine.ts, o mesmo `server-only` que nenhum teste executa e que a
// varredura não importa.
//
// E ELAS SÃO O CAMINHO MAIS COMUM: toda `dm` de um botão só passa pela
// primeira, e todo pedido de follow pela segunda. `lerPayload` tinha teste;
// elas não tinham nenhum.
// ---------------------------------------------------------------------------
describe("payloadDaRespostaRapida e payloadDoPortao", () => {
  it("escrevem a forma de três partes, cada uma com o SEU prefixo", () => {
    expect(payloadDaRespostaRapida("auto-1", "b_bem001")).toBe("AUTO:auto-1:b_bem001");
    expect(payloadDoPortao("auto-1", "b_por002")).toBe("FOLLOW:auto-1:b_por002");
  });

  it("IDA E VOLTA: o que elas escrevem, `lerPayload` lê de volta campo a campo", () => {
    // Campo a campo, e não só "tem três partes": os dois argumentos são
    // `string`, então trocá-los compila e o payload continua legível — o que
    // muda é qual parte é a automação e qual é o bloco.
    expect(lerPayload(payloadDaRespostaRapida("auto-1", "b_bem001"))).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: "b_bem001",
      botaoId: null,
    });
    expect(lerPayload(payloadDoPortao("auto-1", "b_por002"))).toEqual({
      prefixo: "FOLLOW",
      automationId: "auto-1",
      passoId: "b_por002",
      botaoId: null,
    });
  });

  it("O PREFIXO É A PERGUNTA, e as duas não são intercambiáveis", () => {
    // É por isso que são duas funções, e não uma com o prefixo por argumento:
    // `handleMessagingEvent` (lib/engine.ts) ramifica pelo prefixo — `FOLLOW:`
    // reconsulta a Meta, `AUTO:` só retoma. Trocar uma pela outra no chamador
    // compilaria, e o toque no portão viraria retomada comum.
    const daResposta = lerPayload(payloadDaRespostaRapida("auto-1", "b_por002"))!;
    const doPortao = lerPayload(payloadDoPortao("auto-1", "b_por002"))!;
    expect(daResposta.prefixo).toBe("AUTO");
    expect(doPortao.prefixo).toBe("FOLLOW");
    expect(daResposta.prefixo).not.toBe(doPortao.prefixo);
  });

  it("nenhuma das duas escreve o campo do BOTÃO — quem faz isso é `payloadDoBotao`", () => {
    // A separação é a que `lerPayload` já lê: três partes é "de qual bloco
    // continuar", quatro é "qual braço seguir". Uma escritora de três partes
    // que emitisse quatro faria `caminhoDoBotao` procurar ligação de um botão
    // que não existe, e o toque viraria botão órfão.
    expect(lerPayload(payloadDaRespostaRapida("auto-1", "b_bem001"))!.botaoId).toBe(null);
    expect(lerPayload(payloadDoPortao("auto-1", "b_por002"))!.botaoId).toBe(null);
    expect(payloadDaRespostaRapida("auto-1", "b_bem001").split(":")).toHaveLength(3);
    expect(payloadDoPortao("auto-1", "b_por002").split(":")).toHaveLength(3);
  });

  it("o BLOCO SEM ID entra como índice em texto, nas duas", () => {
    // Mesma razão de `payloadDoBotao`: `identidadeDoPasso` devolve o índice
    // para bloco sem id, e é esse valor que o motor passa aqui.
    expect(lerPayload(payloadDaRespostaRapida("auto-1", "2"))).toEqual({
      prefixo: "AUTO",
      automationId: "auto-1",
      passoId: "2",
      botaoId: null,
    });
    expect(lerPayload(payloadDoPortao("auto-1", "0"))).toEqual({
      prefixo: "FOLLOW",
      automationId: "auto-1",
      passoId: "0",
      botaoId: null,
    });
  });

  it("O TOQUE NA RESPOSTA RÁPIDA RETOMA DAQUELE BLOCO, e não do zero", () => {
    // Ponta a ponta do lado puro, como o teste do menu faz para os quatro
    // campos: escrever o payload como o motor o escreve, ler de volta e
    // resolver a retomada. Com o bloco errado no payload, o toque retomaria
    // outro passo — e é a asserção campo a campo que vê isso.
    const passos = [
      { id: "b_bem001", tipo: "dm", texto: "oi", botao_label: "quero" },
      { id: "b_fim003", tipo: "dm", texto: "toma", url: "https://x.y" },
    ];
    const p = lerPayload(payloadDaRespostaRapida("A", "b_bem001"))!;
    expect(
      retomadaDoBotao({ passoId: p.passoId, automationId: "A" }, "A", passos, emCorrente(passos))
    ).toEqual({ portao: null, destino: "b_fim003" });
  });
});

// ---------------------------------------------------------------------------
// O PAREAMENTO E O CORTE, pelo mesmo motivo: eles moravam em `processItem`
// (lib/queue-drain.ts), `server-only` que nenhum teste executa. A revisão
// plantou os rótulos pareados AO CONTRÁRIO dos payloads e mediu 485/485 verdes,
// typecheck limpo, varredura idêntica — cada botão do menu mostrando o rótulo
// de outro e levando ao destino do outro.
// ---------------------------------------------------------------------------
describe("botoesDaMensagem", () => {
  it("PAREIA POR ÍNDICE, na ordem em que o dono desenhou", () => {
    // O rótulo da posição i é o do botão cujo payload está na posição i. É a
    // única correspondência que existe entre as duas listas irmãs, e inverter
    // uma delas troca o destino de cada botão sem mudar nada visível.
    expect(
      botoesDaMensagem(
        ["A", "B", "C"],
        ["AUTO:a:b_men001:op_aaaaaa", "AUTO:a:b_men001:op_bbbbbb", "AUTO:a:b_men001:op_cccccc"]
      )
    ).toEqual({
      botoes: [
        { rotulo: "A", payload: "AUTO:a:b_men001:op_aaaaaa" },
        { rotulo: "B", payload: "AUTO:a:b_men001:op_bbbbbb" },
        { rotulo: "C", payload: "AUTO:a:b_men001:op_cccccc" },
      ],
      pareados: 3,
      descartados: 0,
    });
  });

  it("listas de tamanhos diferentes: a sobra fica de fora", () => {
    // As duas saem sempre do mesmo tamanho de `enfileirarPasso`, mas a coluna é
    // `jsonb` e sobrevive a edição à mão. Nunca lê um índice que a outra lista
    // não tem.
    const r = botoesDaMensagem(["A", "B", "C"], ["p1", "p2"]);
    expect(r.botoes).toEqual([
      { rotulo: "A", payload: "p1" },
      { rotulo: "B", payload: "p2" },
    ]);
    expect(r.descartados).toBe(0);
  });

  it("PAR SEM RÓTULO É DESCARTADO E CONTADO, em vez de virar `title: \"\"`", () => {
    // O dreno mandava `title: rotulos[i] ?? ""`. Título vazio é campo
    // obrigatório malformado, e a Meta recusa a mensagem INTEIRA — os outros
    // botões E o texto. Descartando, sai o que está inteiro; `descartados` vira
    // linha em Atividade para o botão não sumir calado.
    const r = botoesDaMensagem(["A", "", "  ", null, 7, "E"], ["p1", "p2", "p3", "p4", "p5", "p6"]);
    expect(r.botoes).toEqual([
      { rotulo: "A", payload: "p1" },
      { rotulo: "E", payload: "p6" },
    ]);
    expect(r.pareados).toBe(2);
    expect(r.descartados).toBe(4);
  });

  it("payload em branco ou fora de tipo também é descartado", () => {
    const r = botoesDaMensagem(["A", "B", "C"], ["", { x: 1 }, "p3"]);
    expect(r.botoes).toEqual([{ rotulo: "C", payload: "p3" }]);
    expect(r.descartados).toBe(2);
  });

  it("CORTA NO LIMITE DA META e diz quantos havia", () => {
    // Sem o corte, a Meta recusa a mensagem inteira e ninguém recebe nada, nem
    // o texto. `pareados` é o que o dreno registra em Atividade.
    const n = 20;
    const rotulos = Array.from({ length: n }, (_, i) => `r${i}`);
    const payloads = Array.from({ length: n }, (_, i) => `p${i}`);
    const r = botoesDaMensagem(rotulos, payloads);
    expect(LIMITE_DE_BOTOES).toBe(13);
    expect(r.botoes).toHaveLength(LIMITE_DE_BOTOES);
    expect(r.botoes[0]).toEqual({ rotulo: "r0", payload: "p0" });
    expect(r.botoes[12]).toEqual({ rotulo: "r12", payload: "p12" });
    expect(r.pareados).toBe(n);
    expect(r.descartados).toBe(0);
  });

  it("O CORTE VEM DEPOIS DO DESCARTE", () => {
    // Cortar antes deixaria o rótulo em branco ocupar uma das 13 vagas e ainda
    // empurrar um botão bom para fora da mensagem. Aqui há 14 pares, um deles
    // sem rótulo: os 13 bons saem, e nenhum é perdido para o vazio.
    const rotulos = Array.from({ length: 14 }, (_, i) => (i === 3 ? "" : `r${i}`));
    const payloads = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const r = botoesDaMensagem(rotulos, payloads);
    expect(r.botoes).toHaveLength(13);
    expect(r.pareados).toBe(13);
    expect(r.descartados).toBe(1);
    expect(r.botoes.map((b) => b.payload)).not.toContain("p3");
    expect(r.botoes.map((b) => b.payload)).toContain("p13");
  });

  it("MENU INTEIRAMENTE DESCARTADO: a lista sai vazia, e `descartados` não basta para nomear o caso", () => {
    // O caso que o dreno passou a registrar com evento PRÓPRIO
    // (`menu_sem_botoes`, lib/queue-drain.ts): o item pedia menu e NENHUM botão
    // saiu. `esperaResposta` já disse que o bloco para e o motor já gravou o
    // cursor — a mensagem sai como texto puro e todo braço de `botao` daquele
    // bloco deixa de ser alcançável.
    //
    // Ele chega por DOIS caminhos, e é por isso que ele não cabe dentro do
    // evento de "sem rótulo":
    //
    //   TODOS os pares sem rótulo — `descartados` conta.
    const todosSemRotulo = botoesDaMensagem([""], ["p1"]);
    expect(todosSemRotulo.botoes).toEqual([]);
    expect(todosSemRotulo.descartados).toBe(1);
    //   a lista de RÓTULOS mais curta (ou ausente) — a sobra sai de fininho, e
    //   `descartados` fica em ZERO. Dobrado no evento de rótulo, o caso grave
    //   seria invisível exatamente aqui.
    const semRotulos = botoesDaMensagem([], ["p1", "p2"]);
    expect(semRotulos.botoes).toEqual([]);
    expect(semRotulos.descartados).toBe(0);
    expect(semRotulos.pareados).toBe(0);
  });

  it("o que não é lista vira menu vazio", () => {
    // As duas chegam de `jsonb`. `undefined`, texto ou objeto no lugar da lista
    // não podem estourar dentro do dreno — o dreno cai no texto puro, e o texto
    // ainda chega.
    expect(botoesDaMensagem(undefined, ["p1"])).toEqual({
      botoes: [],
      pareados: 0,
      descartados: 0,
    });
    expect(botoesDaMensagem("A", "p1")).toEqual({ botoes: [], pareados: 0, descartados: 0 });
  });
});

describe("caminhoDoBotao", () => {
  const passos = [
    { id: "b_men001", tipo: "dm", texto: "escolha", botao_label: "quero" },
    { id: "b_opa002", tipo: "dm", texto: "opção A" },
    { id: "b_opb003", tipo: "dm", texto: "opção B" },
  ];
  const ligacoes = [
    { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_opa002" },
    { de: "b_men001", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_opb003" },
    { de: "b_men001", quando: { tipo: "senao" }, para: "b_opa002" },
  ];

  it("o bloco de origem vem do PAYLOAD, e o destino é o daquele botão", () => {
    // A `Retomada` vem PRONTA, com a regra do portão já aplicada — aqui não há
    // portão na lista, então não há passagem a marcar. Ela devolvia `{indice}`
    // até a Tarefa 3b, e era esse índice cru que o motor passava a
    // `executarFluxo` pulando a regra por inteiro.
    expect(caminhoDoBotao(lerPayload("AUTO:A:b_men001:op_bbbbbb")!, passos, ligacoes)).toEqual({
      retomada: { portao: null, destino: "b_opb003" },
    });
  });

  it("O CURSOR NÃO É ARGUMENTO — nem o de fora, nem nenhum outro bloco", () => {
    // Esta é a peça que faltava ter teste, e a ausência dela era a mesma classe
    // de risco de `cursorDaRetomada`: enquanto a escolha de "de qual bloco sai a
    // ligação" fosse uma expressão solta dentro de lib/engine.ts, trocar
    // `p.passoId` por um id vindo do cursor não acendia luz em teste nenhum.
    //
    // A função recebe o payload e a automação, e mais nada: não há por onde o
    // bloco de origem chegar que não seja o próprio toque. O que isto fixa é o
    // efeito da troca — pedir o caminho a partir de OUTRO bloco não acha a
    // ligação, porque o id do botão é escopado ao bloco que o emitiu.
    const deOutroBloco = { prefixo: "AUTO" as const, automationId: "A", passoId: "b_opa002", botaoId: "op_bbbbbb" };
    expect(caminhoDoBotao(deOutroBloco, passos, ligacoes)).toEqual({
      motivo: "o botão op_bbbbbb, do bloco b_opa002, não tem ligação de saída",
    });
  });

  it("botão órfão devolve MOTIVO, e não silêncio", () => {
    // O comentário de `ligacaoEscolhida` recusa mandar o órfão para o `senao`
    // dizendo que isso esconderia o defeito de montagem. Não entregar nada e
    // não dizer nada o esconderia igual, só por outra porta: é este `motivo`
    // que vira linha em Atividade (`botao_sem_caminho`, lib/engine.ts).
    const r = caminhoDoBotao(lerPayload("AUTO:A:b_men001:op_zzzzzz")!, passos, ligacoes);
    expect(r?.retomada).toBe(undefined);
    expect(r?.motivo).toContain("não tem ligação de saída");
  });

  it("destino apagado da lista tem motivo PRÓPRIO", () => {
    // Dois motivos e não um porque se arrumam em lugares diferentes: aqui a
    // ligação existe, o que sumiu foi o bloco de destino.
    const sumido = [
      { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_sumiu9" },
    ];
    const r = caminhoDoBotao(lerPayload("AUTO:A:b_men001:op_aaaaaa")!, passos, sumido);
    expect(r?.retomada).toBe(undefined);
    expect(r?.motivo).toContain("não está na lista: b_sumiu9");
  });

  it("payload SEM botão devolve null — a pergunta ali é a antiga", () => {
    // null não é "não há caminho": é "esta função não responde por este toque".
    // As duas formas antigas continuam com `cursorDaRetomada` e o cursor
    // mandando, e é o null que as deixa passar.
    expect(caminhoDoBotao(lerPayload("AUTO:A:b_men001")!, passos, ligacoes)).toBe(null);
    expect(caminhoDoBotao(lerPayload("AUTO:A")!, passos, ligacoes)).toBe(null);
    // O `FOLLOW:` nunca traz botão, mas se um dia trouxer ele não entra aqui:
    // o portão tem regra própria (`retomadaDoFollow`), e ela consulta a Meta.
    const followComBotao = { prefixo: "FOLLOW" as const, automationId: "A", passoId: "b_men001", botaoId: "op_aaaaaa" };
    expect(caminhoDoBotao(followComBotao, passos, ligacoes)).toBe(null);
  });

  it("não estoura com lixo", () => {
    const p = lerPayload("AUTO:A:b_men001:op_aaaaaa")!;
    expect(caminhoDoBotao(p, null, null)?.motivo).toContain("não tem ligação de saída");
    expect(caminhoDoBotao(p, null, ligacoes)?.motivo).toContain("não está na lista");
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
    // A certa devolve o bloco do cursor, com o portão do 1 como PASSAGEM. A
    // invertida devolvia o portão, e reenfileirava tudo entre os dois — a
    // diferença entre atravessar o portão e voltar a ele continua sendo a coisa
    // que este teste mede.
    const real = { passoId: "b_lem006", automationId: "A" };
    const cursor = cursorDaRetomada(real, "A", "b_por002", lista);
    expect(retomadaDoFollow(cursor, "A", lista, emCorrente(lista))).toEqual({
      portao: 1,
      destino: "b_lem006",
    });
  });

  it("quem está no meio da B e toca num botão antigo da A retoma A no lugar certo", () => {
    // A certa devolve o portão (a boas-vindas foi tocada, a seta `sempre` dela
    // cai no portão, e o portão é atravessado por `resolverFollow`, não pulado).
    // Sem o bloco no payload — antes da Fase 1b — dava a ENTRADA: a boas-vindas
    // de novo.
    const real = { passoId: "b_qqq111", automationId: "B" };
    const cursor = cursorDaRetomada(real, "A", "b_bem001", lista);
    expect(retomadaDoBotao(cursor, "A", lista, emCorrente(lista))).toEqual({
      portao: null,
      destino: "b_por002",
    });
  });

  it("cursor apontando para bloco APAGADO cai no bloco do payload, e não na entrada", () => {
    // A certa devolve o portão. Sem a conferência de `indiceDoId` dentro de
    // `cursorDaRetomada`, o cursor morto ganharia e a resposta seria a ENTRADA —
    // a boas-vindas repetida.
    const real = { passoId: "b_sumiu9", automationId: "A" };
    const cursor = cursorDaRetomada(real, "A", "b_bem001", lista);
    expect(retomadaDoBotao(cursor, "A", lista, emCorrente(lista))).toEqual({
      portao: null,
      destino: "b_por002",
    });
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
    const r = interpretar(lista, emCorrente(lista), "b_por033");
    expect(r.pararEm).toBe("b_por033");
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

describe("conferirLigacao", () => {
  it("aceita a forma completa dos três tipos", () => {
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "sempre" }, para: "b_bbb222" }).ligacao)
      .toEqual({ de: "b_aaa111", quando: { tipo: "sempre" }, para: "b_bbb222" });
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "botao", botao: "op_a" }, para: "b_bbb222" }).motivo)
      .toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "senao" }, para: "b_bbb222" }).motivo)
      .toBeUndefined();
  });

  it("recusa ligação sem de, sem para, ou com tipo desconhecido", () => {
    // Ligação quebrada é caminho que não existe. Ignorar em silêncio faria a
    // pessoa parar no meio do fluxo sem nada em Atividade.
    expect(conferirLigacao({ quando: { tipo: "sempre" }, para: "b_bbb222" }).ligacao).toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "sempre" } }).ligacao).toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "voar" }, para: "b_bbb222" }).ligacao).toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "botao" }, para: "b_bbb222" }).ligacao).toBeUndefined();
  });

  it("não estoura com lixo", () => {
    expect(conferirLigacao(null).ligacao).toBeUndefined();
    expect(conferirLigacao("x").ligacao).toBeUndefined();
    expect(conferirLigacao(42).ligacao).toBeUndefined();
  });
});

describe("ligacoesDe", () => {
  const ls = [
    { de: "b_aaa111", quando: { tipo: "botao", botao: "op_a" }, para: "b_bbb222" },
    { de: "b_aaa111", quando: { tipo: "senao" }, para: "b_ccc333" },
    { de: "b_bbb222", quando: { tipo: "sempre" }, para: "b_ccc333" },
    { de: "b_aaa111", quando: { tipo: "voar" }, para: "b_ddd444" },
  ];

  it("devolve as ligações VÁLIDAS que saem daquele bloco, na ordem", () => {
    const r = ligacoesDe(ls, "b_aaa111");
    expect(r).toHaveLength(2);
    expect(r[0].para).toBe("b_bbb222");
    expect(r[1].quando.tipo).toBe("senao");
  });

  it("bloco sem saída devolve lista vazia", () => {
    expect(ligacoesDe(ls, "b_zzz999")).toEqual([]);
  });

  it("não estoura quando não é lista", () => {
    expect(ligacoesDe(null, "b_aaa111")).toEqual([]);
    expect(ligacoesDe({}, "b_aaa111")).toEqual([]);
  });
});

describe("novoIdDeBotao", () => {
  it("sai sempre no formato aceito e com comprimento fixo", () => {
    for (let i = 0; i < 500; i++) expect(novoIdDeBotao()).toMatch(/^op_[0-9a-z]{6}$/);
  });
});

describe("interpretar caminhando o grafo", () => {
  const bem = { id: "b_bem001", tipo: "dm", texto: "Oi!" };
  const meio = { id: "b_mei002", tipo: "dm", texto: "Meio" };
  const fim = { id: "b_fim003", tipo: "dm", texto: "Fim" };
  const corrente = [
    { de: "b_bem001", quando: { tipo: "sempre" }, para: "b_mei002" },
    { de: "b_mei002", quando: { tipo: "sempre" }, para: "b_fim003" },
  ];

  it("segue a corrente até o fim e não para em lugar nenhum", () => {
    const r = interpretar([bem, meio, fim], corrente, "b_bem001");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001", "b_mei002", "b_fim003"]);
    expect(r.pararEm).toBe(null);
  });

  it("A ORDEM DO ARRAY NÃO MANDA MAIS — a seta manda", () => {
    // Mesmos blocos, array embaralhado, mesmas ligações: o resultado é idêntico.
    // É este teste que prova que a ordem deixou de significar o próximo.
    const r = interpretar([fim, bem, meio], corrente, "b_bem001");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001", "b_mei002", "b_fim003"]);
  });

  // ------------------------------------------------------------------------
  // O BLOCO COM `botoes` PASSOU A PARAR NA TAREFA 4, e o comentário abaixo é a
  // medição que decidiu isso — mantida porque ela derrubou dois testes desta
  // suíte, e quem reabrir o buraco vai derrubá-los de novo.
  //
  // `esperaResposta` passou a dizer sim a um `dm` com `botoes` ANTES de
  // `enfileirarPasso` (lib/engine.ts) saber entregar mais de um botão: um
  // bloco com `botoes` e sem `botao_label` saía como TEXTO PURO — o dreno
  // exigia `quick_reply_label && quick_reply_payload` (lib/queue-drain.ts) —
  // e mesmo assim o motor gravava o cursor: parada esperando um toque que
  // ninguém entregou.
  //
  // A TAREFA 4 fechou o buraco pelo lado que faltava: `envioDaDm` aprendeu
  // `botoes`, e `enfileirarPasso` e o dreno aprenderam a entregar a lista
  // inteira no mesmo commit.
  //
  // E `esperaResposta` GANHOU A FORMA NOVA NA CONDIÇÃO, no mesmo commit —
  // `forma === "resposta_rapida"` virou `|| forma === "botoes"`. A versão
  // anterior deste comentário dizia "sem ganhar condição própria", repetindo
  // uma previsão do brief que o próprio commit desmentiu vinte linhas adiante.
  // Criar uma forma NOVA obriga alguém a dizer se ela para: das quatro, duas
  // param e duas não, e isso não se deduz da forma. O que continua não
  // duplicado é a DECISÃO DA FORMA — `esperaResposta` pergunta a `envioDaDm` e
  // não reescreve `Boolean(p.botao_label) && !p.url`. O porquê inteiro está no
  // comentário de `envioDaDm` (lib/steps.ts).
  //
  // Os dois testes abaixo são as duas metades: a forma nova de `envioDaDm` — e
  // o CONTEÚDO que ela entrega, não só a contagem —, e a parada que
  // `esperaResposta` deriva dela.
  // ------------------------------------------------------------------------

  // A LISTA DE FORMAS É DERIVADA DO TIPO, e essa é a correção da rodada final
  // da Tarefa 4. Ela era um literal escrito à mão, e a revisão mediu o que isso
  // deixava passar: uma QUINTA forma plantada em `envioDaDm` (`{forma:
  // "enquete"}`), listada em `esperaResposta`, parava o fluxo sem entregar nada
  // — e a suíte ficava 217/217 VERDE, porque forma sem fixture é forma
  // invisível. O comentário de `envioDaDm` (lib/steps.ts) prometia o contrário,
  // e era essa promessa que justificava não escrever uma segunda guarda.
  //
  // O `Record<EnvioDaDm["forma"], …>` é o que fecha isso: `Record` sobre uma
  // união EXIGE todas as chaves e RECUSA chave que não esteja na união, então
  // acrescentar um membro a `EnvioDaDm` sem trazer fixture para cá não compila.
  //
  // ONDE ELA ACENDE, dito sem inflar: no `tsc` — `npm run typecheck`, que o
  // `npm run verify` roda —, e NÃO no `vitest` sozinho, que apaga os tipos. A
  // metade que o vitest cobre é a de baixo: cada chave precisa ter fixture, e
  // cada fixture precisa de fato SAIR na forma sob a qual foi escrita. Fixture
  // no balde errado (ou balde vazio) é falha de teste, não de tipo.
  const FIXTURES: Record<EnvioDaDm["forma"], unknown[]> = {
    texto: [
      { tipo: "dm", texto: "oi" },
      { tipo: "dm", texto: "oi", botao_label: "" },
      // `botoes` vazio não é menu — nada para tocar, então cai como texto.
      { tipo: "dm", texto: "oi", botoes: [] },
      // Lixo no campo: `conferir` não olha `botoes`, então ele chega assim.
      { tipo: "dm", texto: "oi", botoes: "sim" },
    ],
    resposta_rapida: [{ tipo: "dm", texto: "oi", botao_label: "quero" }],
    link: [
      { tipo: "dm", texto: "oi", url: "https://x.y" },
      { tipo: "dm", texto: "oi", botao_label: "abrir", url: "https://x.y" },
      // Com url, nem `botoes` nem `botao_label` viram parada: é link, e o link
      // não espera toque nenhum.
      { tipo: "dm", texto: "oi", url: "https://x.y", botoes: [{ id: "op_aaaaaa", rotulo: "A" }] },
    ],
    botoes: [
      { tipo: "dm", texto: "oi", botoes: [{ id: "op_aaaaaa", rotulo: "A" }] },
      {
        tipo: "dm",
        texto: "oi",
        botoes: [
          { id: "op_aaaaaa", rotulo: "A" },
          { id: "op_bbbbbb", rotulo: "B" },
        ],
      },
      // Com as duas coisas, `botoes` vence — é a ordem escrita em `envioDaDm`.
      { tipo: "dm", texto: "oi", botao_label: "quero", botoes: [{ id: "op_aaaaaa", rotulo: "A" }] },
    ],
  };

  it("A PARADA E A ENTREGA SÃO A MESMA PERGUNTA: nenhum `dm` para sem entregar algo para tocar", () => {
    // A invariante que substitui a segunda cópia da regra: se algum dia uma das
    // formas parar o fluxo sem sair com resposta rápida OU menu de `botoes`, é
    // este teste que acende.
    for (const [forma, brutos] of Object.entries(FIXTURES)) {
      // BALDE VAZIO É FALHA. Sem esta linha, a chave nova exigida pelo
      // `Record` podia ser satisfeita com `[]` e a forma voltaria a ser
      // invisível — a mesma falha, uma camada adiante.
      expect(brutos.length).toBeGreaterThan(0);
      for (const bruto of brutos) {
        const { passo } = conferir(bruto);
        // Todas as formas acima são `dm` válidas; se alguma deixar de ser, o
        // resto do teste não estaria medindo o que diz medir.
        if (!passo || passo.tipo !== "dm")
          throw new Error(`não é dm válida: ${JSON.stringify(bruto)}`);
        const envio = envioDaDm(passo);
        // A fixture SAI na forma sob a qual foi escrita. É o que impede o balde
        // de virar decoração: `{forma: "enquete"}` com fixture que na verdade
        // sai como `texto` falha aqui, no vitest, sem depender do `tsc`.
        expect(envio.forma).toBe(forma);
        expect(esperaResposta(passo)).toBe(
          envio.forma === "resposta_rapida" || envio.forma === "botoes"
        );
        // E o que a parada promete existe de verdade: um rótulo não vazio, ou
        // uma lista de botões não vazia. É esta linha que o `botoes` sem
        // `botao_label` quebrava antes da Tarefa 4.
        if (envio.forma === "resposta_rapida") expect(envio.rotulo.length).toBeGreaterThan(0);
        if (envio.forma === "botoes") {
          expect(envio.botoes.length).toBeGreaterThan(0);
          // O CONTEÚDO, e não só a contagem. `toBeGreaterThan(0)` sozinho era o
          // que esta linha afirmava, e a revisão da Tarefa 4 mediu o que ele
          // deixa passar: `return { forma: "botoes", botoes: p.botoes.slice(0, 1) }`
          // — "o menu entrega só o primeiro botão", o defeito central da tarefa —
          // ficava VERDE, 485/485. O menu sai inteiro e na ordem em que o dono o
          // desenhou; é essa ordem que o dreno pareia com os payloads.
          expect(envio.botoes).toEqual((passo as { botoes?: unknown }).botoes);
        }
      }
    }
  });

  it("bloco com BOTÕES agora PARA — o motor sabe entregar o menu inteiro (Tarefa 4)", () => {
    // Antes da Tarefa 4 este mesmo menu não parava: sem `botao_label` o motor
    // não sabia entregar nada tocável, e a caminhada seguia adiante. Hoje
    // `envioDaDm` reconhece `botoes` sozinhos como MENU, e `esperaResposta`
    // para por consequência.
    //
    // NENHUMA ligação `botao` é seguida por esta caminhada, e não é o que faz
    // o fluxo parar: `interpretar` só anda pela `sempre` (`seguinteDe`) —
    // `botao` só é percorrida pelo TOQUE (`ligacaoEscolhida`). O motivo de
    // parar aqui é só a mensagem esperar resposta, mesmo sem `sempre` nenhuma
    // saindo do menu.
    const menu = {
      id: "b_men001",
      tipo: "dm",
      texto: "Qual?",
      botoes: [
        { id: "op_aaaaaa", rotulo: "A" },
        { id: "op_bbbbbb", rotulo: "B" },
      ],
    };
    const r = interpretar(
      [menu, fim],
      [{ de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_fim003" }],
      "b_men001"
    );
    // O menu SAI, e a caminhada PARA nele.
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_men001"]);
    expect(r.pararEm).toBe("b_men001");
  });

  it("bloco com botões E rótulo também PARA: `botoes` manda na forma, não na parada", () => {
    // Este bloco tem as duas coisas. Desde a Tarefa 4 a FORMA é menu — não
    // resposta rápida de um botão só, `envioDaDm` olha `botoes` primeiro —,
    // mas a pergunta que interessa aqui é só uma: o fluxo para? Sim, porque
    // `esperaResposta` diz sim às duas formas.
    const menu = {
      id: "b_men001",
      tipo: "dm",
      texto: "Qual?",
      botao_label: "Escolher",
      botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
    };
    const r = interpretar(
      [menu, fim],
      [{ de: "b_men001", quando: { tipo: "sempre" }, para: "b_fim003" }],
      "b_men001"
    );
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_men001"]);
    expect(r.pararEm).toBe("b_men001");
  });

  it("bloco sem saída encerra o fluxo", () => {
    const r = interpretar([bem], [], "b_bem001");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001"]);
    expect(r.pararEm).toBe(null);
  });

  it("LISTA SEM LIGAÇÃO NENHUMA ENTREGA UM BLOCO SÓ, e é por isso que a migração é obrigatória", () => {
    // O caso mais caro desta fase, fixado aqui para ninguém descobri-lo em
    // produção: com `ligacoes: []` — o `default '[]'::jsonb` da coluna — a
    // caminhada não tem seta nenhuma a seguir e para no bloco de entrada. Uma
    // automação de cinco blocos passa a entregar UM.
    //
    // O array continua com os cinco na ordem certa; o que falta é o dado que diz
    // que um vem depois do outro. Quem o escreve é
    // `scripts/ligar-passos-existentes.mjs --aplicar`, e a ordem de implantação
    // não é negociável: a coluna, depois a migração, e só então este motor.
    const lista = [bem, meio, fim];
    expect(interpretar(lista, [], "b_bem001").enfileirar.map((a) => a.passo.id)).toEqual([
      "b_bem001",
    ]);
    // Com a corrente que a migração grava, os três voltam.
    expect(interpretar(lista, corrente, "b_bem001").enfileirar.map((a) => a.passo.id)).toEqual([
      "b_bem001",
      "b_mei002",
      "b_fim003",
    ]);
  });

  it("A JUNÇÃO FUNCIONA: dois braços chegam no mesmo fim, e ele não é repetido", () => {
    // A fila não conseguia representar isto — o fim teria que ser copiado em cada
    // braço. Aqui é UM bloco, e cada caminhada passa nele uma vez só.
    //
    // Os ids são MINÚSCULOS porque `FORMA_DO_ID` (lib/steps.ts) é
    // `/^b_[0-9a-z]{6,}$/`: com uma maiúscula no meio, `identidadeDoPasso`
    // recusa o id e cai no ÍNDICE, e aí as ligações apontam para uma identidade
    // que não existe na lista — a caminhada não sai do lugar. Fica anotado
    // porque o caso não é de teste: é o mesmo mecanismo que `conferirLista`
    // trava com "identidade inválida", e ele é mudo em qualquer outro lugar.
    const a = { id: "b_rama01", tipo: "dm", texto: "A" };
    const b = { id: "b_ramb02", tipo: "dm", texto: "B" };
    const ligs = [
      { de: "b_rama01", quando: { tipo: "sempre" }, para: "b_fim003" },
      { de: "b_ramb02", quando: { tipo: "sempre" }, para: "b_fim003" },
    ];
    const porA = interpretar([a, b, fim], ligs, "b_rama01");
    const porB = interpretar([a, b, fim], ligs, "b_ramb02");
    expect(porA.enfileirar.map((x) => x.passo.id)).toEqual(["b_rama01", "b_fim003"]);
    expect(porB.enfileirar.map((x) => x.passo.id)).toEqual(["b_ramb02", "b_fim003"]);
  });

  // Uma corrente reta de `quantos` blocos: b_c000000 → b_c000001 → …
  // Serve para medir o teto pelo NÚMERO DE PASSOS, e não por um anel — é a única
  // forma de distinguir "contei 100 visitas" de "achei uma repetição".
  function corrida(quantos: number) {
    const passos = Array.from({ length: quantos }, (_, i) => ({
      id: `b_c${String(i).padStart(6, "0")}`,
      tipo: "dm",
      texto: `bloco ${i}`,
    }));
    return { passos, ligacoes: emCorrente(passos) };
  }

  it("O TETO É EXATAMENTE ISSO: 100 blocos passam, 101 é interrompido", () => {
    // A versão anterior deste teste media `enfileirar.length <=
    // TETO_DE_PASSOS`, o que qualquer parada satisfaz, e casava o motivo com
    // /teto|ciclo|volta/ — uma implementação com conjunto de visitados e motivo
    // "volta no caminho" passava nas duas asserções sem ter teto nenhum. Estes
    // dois casos fixam o número: numa CORRENTE RETA não há repetição a achar, e
    // só um contador de passos distingue 100 de 101.
    const cheio = corrida(TETO_DE_PASSOS);
    const r1 = interpretar(cheio.passos, cheio.ligacoes, "b_c000000");
    expect(r1.enfileirar.length).toBe(TETO_DE_PASSOS);
    expect(r1.ignorados).toEqual([]);
    expect(r1.cursorNoFim).toBe("limpar");

    const passando = corrida(TETO_DE_PASSOS + 1);
    const r2 = interpretar(passando.passos, passando.ligacoes, "b_c000000");
    expect(r2.ignorados).toEqual([
      {
        indice: -1,
        motivo: `o fluxo passou de ${TETO_DE_PASSOS} blocos e foi interrompido: há uma volta no caminho`,
      },
    ]);
  });

  it("O TETO SEGURA O CICLO em vez de andar para sempre — e NÃO ENTREGA NADA", () => {
    // Sem o teto, isto nunca retorna e a fila cresce até a memória acabar.
    const x = { id: "b_xxx001", tipo: "dm", texto: "X" };
    const y = { id: "b_yyy002", tipo: "dm", texto: "Y" };
    const anel = [
      { de: "b_xxx001", quando: { tipo: "sempre" }, para: "b_yyy002" },
      { de: "b_yyy002", quando: { tipo: "sempre" }, para: "b_xxx001" },
    ];
    const r = interpretar([x, y], anel, "b_xxx001");
    // A caminhada devolvia as 100 ações que montou até bater no teto, e o motor
    // chamava `enfileirarPasso` 100 vezes dentro do webhook que a Meta reenvia
    // por 36 horas. A `passoKey` colapsava as repetições, então não saía
    // mensagem duplicada — o custo era latência e escrita, por um caminho que a
    // própria função acabou de declarar quebrado.
    expect(r.enfileirar).toEqual([]);
    expect(r.ignorados.some((i) => /teto|ciclo|volta/i.test(i.motivo))).toBe(true);
    // E o cursor não é apagado por causa do anel: arrumado o fluxo, a pessoa
    // continua de onde estava.
    expect(r.cursorNoFim).toBe("manter");
  });

  it("o esperar continua somando ao longo do caminho percorrido", () => {
    const esperar = { id: "b_esp001", tipo: "esperar", minutos: 5 };
    const ligs = [
      { de: "b_bem001", quando: { tipo: "sempre" }, para: "b_esp001" },
      { de: "b_esp001", quando: { tipo: "sempre" }, para: "b_fim003" },
    ];
    const r = interpretar([bem, esperar, fim], ligs, "b_bem001");
    const ultimo = r.enfileirar[r.enfileirar.length - 1];
    expect(ultimo.passo.id).toBe("b_fim003");
    expect(ultimo.atrasoSegundos).toBe(300);
  });

  it("ligação para bloco que sumiu registra o motivo e PARA, em vez de estourar", () => {
    // O `jsonb` é editável por fora do editor, e o dono pode apagar o bloco de
    // destino sem que nada apague a ligação que apontava para ele.
    const r = interpretar(
      [bem],
      [{ de: "b_bem001", quando: { tipo: "sempre" }, para: "b_sumiu9" }],
      "b_bem001"
    );
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001"]);
    expect(r.pararEm).toBe(null);
    expect(r.ignorados).toEqual([
      { indice: -1, motivo: "a ligação aponta para um bloco que não existe: b_sumiu9" },
    ]);
    // O cursor NÃO é apagado: uma seta quebrada não é motivo para perder o
    // único registro de onde a pessoa estava. É a mesma preferência que
    // lib/engine.ts registra para o portão não avaliado.
    expect(r.cursorNoFim).toBe("manter");
  });

  it("na PRIMEIRA volta o motivo não culpa uma ligação que não existe", () => {
    // Aqui `atual` ainda é o bloco de partida, e quem o nomeou foi o CHAMADOR —
    // não há ligação nenhuma no caminho. Culpar a ligação era afirmar uma causa
    // que a função não conhece, o mesmo defeito corrigido em `kindLabel`
    // (app/labels.ts).
    const r = interpretar([bem], [], "b_naoexiste9");
    expect(r.enfileirar).toEqual([]);
    expect(r.ignorados).toEqual([
      { indice: -1, motivo: "o bloco de partida não está na lista: b_naoexiste9" },
    ]);
    expect(r.cursorNoFim).toBe("manter");
  });

  it("`steps` que não é lista MANTÉM o cursor — é o dado mais quebrado que chega", () => {
    // Ele limpava, e limpar contradizia o critério que o próprio tipo declara:
    // dado quebrado mantém, fim normal limpa. A razão escrita para a exceção —
    // "ali não existe bloco nenhum na lista" — não é sabível: com a coluna fora
    // de forma esta função não sabe se a lista está vazia ou ilegível, e coluna
    // corrompida e DEPOIS RESTAURADA é exatamente o cenário que o "manter"
    // existe para atender. Limpando, a pessoa perdia o lugar dela por causa de
    // um `jsonb` que voltaria ao normal na restauração seguinte.
    const r = interpretar(null, [], "0");
    expect(r.enfileirar).toEqual([]);
    expect(r.ignorados).toEqual([
      { indice: -1, motivo: "a automação não tem lista de passos" },
    ]);
    expect(r.cursorNoFim).toBe("manter");
  });

  it("o fim NORMAL do caminho limpa o cursor — só o quebrado o mantém", () => {
    // A contraprova dos testes de "manter" acima: sem ela, `cursorNoFim:
    // "manter"` em toda saída passaria despercebido, e ninguém mais sairia do
    // fluxo.
    expect(interpretar([bem], [], "b_bem001").cursorNoFim).toBe("limpar");
    // LISTA VAZIA continua limpando, e a diferença com o caso acima é real: aqui
    // a coluna está ÍNTEGRA e diz, sem ambiguidade, que não há bloco algum.
    expect(interpretar([], [], "0").cursorNoFim).toBe("limpar");
    // E o `+1` de quem passou o último bloco: fim de fluxo, não dado quebrado.
    expect(interpretar([bem], [], null).cursorNoFim).toBe("limpar");
  });

  it("SÓ a ligação `sempre` é seguida: `botao` e `senao` não movem a caminhada", () => {
    // Sem isto, um bloco sem botão nenhum seguiria por uma seta de escolha e
    // entregaria o braço de uma pergunta que nunca foi feita.
    const r = interpretar(
      [bem, fim],
      [{ de: "b_bem001", quando: { tipo: "senao" }, para: "b_fim003" }],
      "b_bem001"
    );
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001"]);
  });

  it("bloco inválido no meio do caminho é ignorado e a caminhada SEGUE", () => {
    const quebrado = { id: "b_qbr001", tipo: "dm" };
    const r = interpretar(
      [bem, quebrado, fim],
      [
        { de: "b_bem001", quando: { tipo: "sempre" }, para: "b_qbr001" },
        { de: "b_qbr001", quando: { tipo: "sempre" }, para: "b_fim003" },
      ],
      "b_bem001"
    );
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001", "b_fim003"]);
    expect(r.ignorados[0].motivo).toBe("dm sem texto");
  });
});

describe("temCicloDeSempre", () => {
  it("acha o anel de sempre", () => {
    expect(
      temCicloDeSempre(
        [
          { id: "b_xxx001", tipo: "dm", texto: "X" },
          { id: "b_yyy002", tipo: "dm", texto: "Y" },
        ],
        [
          { de: "b_xxx001", quando: { tipo: "sempre" }, para: "b_yyy002" },
          { de: "b_yyy002", quando: { tipo: "sempre" }, para: "b_xxx001" },
        ]
      )
    ).toBe(true);
  });

  it("CICLO QUE PASSA POR UMA PARADA NÃO CONTA — é padrão legítimo", () => {
    // "menu → opção → volta ao menu" é um fluxo bom, e a caminhada para no menu.
    //
    // O menu leva `botao_label` além dos `botoes` para ficar igual ao teste
    // gêmeo logo abaixo ("A GUARDA DA PARADA sozinha"), que PRECISA da parada
    // — sem ela, sobraria só o filtro de condição segurando os dois, e cada
    // teste deixaria de medir a guarda que diz medir. Desde a Tarefa 4,
    // `botoes` sozinhos também bastariam aqui (`envioDaDm` os reconhece como
    // parada), mas a combinação fica porque o par de testes é sobre ISOLAR
    // cada guarda, e trocar a fixture de um sem trocar a do outro quebraria
    // essa simetria.
    const menu = {
      id: "b_men001",
      tipo: "dm",
      texto: "Qual?",
      botao_label: "Escolher",
      botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
    };
    const op = { id: "b_opa002", tipo: "dm", texto: "Opção A" };
    expect(
      temCicloDeSempre(
        [menu, op],
        [
          { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_opa002" },
          { de: "b_opa002", quando: { tipo: "sempre" }, para: "b_men001" },
        ]
      )
    ).toBe(false);
  });

  it("corrente reta não tem ciclo", () => {
    expect(
      temCicloDeSempre(
        [
          { id: "b_aaa111", tipo: "dm", texto: "A" },
          { id: "b_bbb222", tipo: "dm", texto: "B" },
        ],
        [{ de: "b_aaa111", quando: { tipo: "sempre" }, para: "b_bbb222" }]
      )
    ).toBe(false);
  });

  it("acha o anel mesmo quando a entrada do fluxo não faz parte dele", () => {
    // Percorrer a partir de CADA bloco, e não só do primeiro: um anel pendurado
    // no meio do fluxo trava do mesmo jeito quando alguém chega nele.
    expect(
      temCicloDeSempre(
        [
          { id: "b_ent001", tipo: "dm", texto: "entrada" },
          { id: "b_xxx001", tipo: "dm", texto: "X" },
          { id: "b_yyy002", tipo: "dm", texto: "Y" },
        ],
        [
          { de: "b_xxx001", quando: { tipo: "sempre" }, para: "b_yyy002" },
          { de: "b_yyy002", quando: { tipo: "sempre" }, para: "b_xxx001" },
        ]
      )
    ).toBe(true);
  });

  // ------------------------------------------------------------------------
  // AS DUAS GUARDAS, medidas uma a uma.
  //
  // A regra "ciclo que passa por uma parada não conta" é sustentada por DUAS
  // linhas, e o teste do padrão legítimo acima não distingue qual delas está
  // trabalhando: no "menu → opção → volta ao menu", as duas dizem não ao mesmo
  // tempo. Mutar a função para olhar TODAS as ligações em vez de só as `sempre`
  // deixa aquele teste VERDE — foi medido —, porque quem para a caminhada lá é o
  // menu esperando o toque, não o filtro de condição.
  //
  // Os dois testes abaixo separam as guardas: cada um fica vermelho se, e só se,
  // a sua for removida. Sem eles, metade da regra não tem teste.
  // ------------------------------------------------------------------------

  it("O FILTRO DE CONDIÇÃO sozinho: anel de `senao` entre blocos que não esperam", () => {
    // Nenhum dos dois blocos espera resposta, então a guarda da parada não tem
    // onde agir. O que impede o falso positivo é olhar SÓ as `sempre` — e a
    // resposta certa é "não há ciclo", porque a caminhada realmente para: saindo
    // de A não existe `sempre` nenhuma a seguir.
    const passos = [
      { id: "b_aaa111", tipo: "dm", texto: "A" },
      { id: "b_bbb222", tipo: "dm", texto: "B" },
    ];
    const anelDeSenao = [
      { de: "b_aaa111", quando: { tipo: "senao" }, para: "b_bbb222" },
      { de: "b_bbb222", quando: { tipo: "sempre" }, para: "b_aaa111" },
    ];
    expect(temCicloDeSempre(passos, anelDeSenao)).toBe(false);
    // E a medição que sustenta a resposta: a caminhada para em A, sem teto.
    const r = interpretar(passos, anelDeSenao, "b_aaa111");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_aaa111"]);
    expect(r.ignorados).toEqual([]);
  });

  it("A GUARDA DA PARADA sozinha: anel de `sempre` que atravessa uma mensagem com botão", () => {
    // Aqui as duas ligações são `sempre`, então o filtro de condição não tem o
    // que descartar. O que impede o falso positivo é a parada: o menu espera o
    // toque, e cada volta do anel custa uma resposta da pessoa.
    //
    // O menu leva `botao_label` (mensagem com um botão) além de `botoes`, pelo
    // mesmo motivo do teste gêmeo acima: isolar esta guarda da outra. ANTES DA
    // TAREFA 4, um bloco de `botoes` sozinho não parava — a parada morava só
    // em `botao_label` —, e por isso a resposta certa dependia dele estar
    // aqui: sem ele, este anel seria REAL. DESDE A TAREFA 4 isso não é mais
    // verdade — `envioDaDm` reconhece `botoes` sozinhos como parada —, mas a
    // fixture continua com as duas coisas porque o par de testes mede as
    // guardas ISOLADAMENTE, e a mudança de uma fixture sem a outra quebraria a
    // simetria entre eles.
    const menu = {
      id: "b_men001",
      tipo: "dm",
      texto: "Qual?",
      botao_label: "Escolher",
      botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
    };
    const antes = { id: "b_ant002", tipo: "dm", texto: "Antes" };
    const anel = [
      { de: "b_ant002", quando: { tipo: "sempre" }, para: "b_men001" },
      { de: "b_men001", quando: { tipo: "sempre" }, para: "b_ant002" },
    ];
    expect(temCicloDeSempre([menu, antes], anel)).toBe(false);
    // E a medição: a caminhada para no menu, sem chegar perto do teto.
    const r = interpretar([menu, antes], anel, "b_ant002");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_ant002", "b_men001"]);
    expect(r.pararEm).toBe("b_men001");
    expect(r.ignorados).toEqual([]);
  });

  it("não estoura com lixo", () => {
    expect(temCicloDeSempre(null, null)).toBe(false);
    expect(temCicloDeSempre([{ tipo: "dm", texto: "x" }], "não é lista")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A CONFERÊNCIA EM DOIS NÍVEIS.
//
// A linha entre os dois é de PRODUTO, e não de gravidade: ERRO DE SALVAR é dado
// que o motor NÃO CONSEGUE LER — ele cai, ou anda sem parar. ERRO DE ATIVAR é
// fluxo que o motor lê perfeitamente e ENTREGA ERRADO, mas cuja causa é montagem
// pela metade, que é trabalho normal de quem está desenhando.
//
// Cada teste daqui afirma o `quando`, e não só o `nivel`. Sem isso, mover um
// item de um nível para o outro deixaria a suíte inteira verde — e é justamente
// a colocação de cada item que esta tarefa decide.
// ---------------------------------------------------------------------------
describe("conferirLista em dois níveis", () => {
  const bem = { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" };
  const portao = {
    id: "b_por002",
    tipo: "pedir_follow",
    texto: "Me segue",
    botao_label: "Já sigo",
  };
  const link = { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" };

  const sempre = (de: string, para: string) => ({ de, quando: { tipo: "sempre" }, para });
  const porBotao = (de: string, botao: string, para: string) => ({
    de,
    quando: { tipo: "botao", botao },
    para,
  });

  const salvar = (ps: unknown, ls: unknown, g = "dm") =>
    conferirLista(ps, g, ls).filter((p) => p.nivel === "erro" && p.quando === "salvar");
  const ativar = (ps: unknown, ls: unknown, g = "dm") =>
    conferirLista(ps, g, ls).filter((p) => p.nivel === "erro" && p.quando === "ativar");
  const avisos = (ps: unknown, ls: unknown, g = "dm") =>
    conferirLista(ps, g, ls).filter((p) => p.nivel === "aviso");

  // -------------------------------------------------------------------------
  // IMPEDE SALVAR
  // -------------------------------------------------------------------------

  it("SALVAR: o anel de `sempre` — a caminhada não termina nunca", () => {
    const x = { id: "b_xxx001", tipo: "dm", texto: "X" };
    const y = { id: "b_yyy002", tipo: "dm", texto: "Y" };
    const anel = [sempre("b_xxx001", "b_yyy002"), sempre("b_yyy002", "b_xxx001")];
    const r = salvar([x, y], anel);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(null);
  });

  it("SALVAR: o anel com um PORTÃO dentro, que `temCicloDeSempre` deixava passar", () => {
    // A MEDIÇÃO DA TAREFA 3b, refeita: com `[pedir_follow, dm]` e o anel de
    // `sempre` entre os dois, a caminhada de `temCicloDeSempre` quebrava no
    // portão (ele espera resposta) e o anel não fechava. O motor deu 201 voltas.
    //
    // O mecanismo do laço está em lib/engine.ts: quando `resolverFollow` devolve
    // "passou", o ramo `pedir_follow` faz `return executarFluxo(…)` de dentro de
    // uma `async` — não estoura a pilha, simplesmente NUNCA RETORNA, e a Meta
    // reenvia o evento por 36 horas.
    const g = { id: "b_gat001", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" };
    const x = { id: "b_xxx002", tipo: "dm", texto: "X" };
    const anel = [sempre("b_gat001", "b_xxx002"), sempre("b_xxx002", "b_gat001")];

    expect(temCicloDeSempre([g, x], anel)).toBe(true);
    expect(salvar([g, x], anel)).toHaveLength(1);
  });

  it("o anel que atravessa uma PARADA DURA continua legítimo — é o menu que volta", () => {
    // A distinção inteira: o portão a execução reavalia sozinha (reconsulta a
    // Meta, pula o e-mail já conhecido), então o anel roda sem ninguém tocar em
    // nada. A `dm` que espera não — cada volta custa um toque da pessoa.
    const menu = {
      id: "b_men001",
      tipo: "dm",
      texto: "Qual?",
      botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
    };
    const antes = { id: "b_ant002", tipo: "dm", texto: "Antes" };
    const anel = [sempre("b_ant002", "b_men001"), sempre("b_men001", "b_ant002")];
    expect(temCicloDeSempre([menu, antes], anel)).toBe(false);
    expect(salvar([menu, antes], anel)).toHaveLength(0);
  });

  it("SALVAR: dois destinos para o mesmo botão — o segundo nunca é seguido", () => {
    const menu = {
      id: "b_men010",
      tipo: "dm",
      texto: "Escolha",
      botoes: [
        { id: "op_aaaaaa", rotulo: "A" },
        { id: "op_bbbbbb", rotulo: "B" },
      ],
    };
    const opA = { id: "b_opa011", tipo: "dm", texto: "A" };
    const opB = { id: "b_opb012", tipo: "dm", texto: "B" };
    const ls = [
      porBotao("b_men010", "op_aaaaaa", "b_opa011"),
      porBotao("b_men010", "op_aaaaaa", "b_opb012"),
      porBotao("b_men010", "op_bbbbbb", "b_opb012"),
    ];
    const r = salvar([menu, opA, opB], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(0);
  });

  it("SALVAR: `botoes: [null]` — é QUEDA, e ela derruba o lote inteiro", () => {
    // Medido na Tarefa 4: `[null].map(b => b.rotulo)` estoura `TypeError` dentro
    // de `enfileirarPasso`, a caminhada aborta no meio, o cursor não é gravado e
    // o `try/catch` do webhook — que está FORA dos dois laços — derruba junto o
    // resto dos eventos daquela requisição. Não é botão feio: é perda de entrega
    // para todo mundo que chegou naquele POST.
    const quebrado = { id: "b_qbr001", tipo: "dm", texto: "Escolha", botoes: [null] };
    expect(salvar([quebrado], [])).toHaveLength(1);
  });

  it("SALVAR: as outras formas de `botoes` cru", () => {
    const com = (botoes: unknown) => [{ id: "b_qbr002", tipo: "dm", texto: "Escolha", botoes }];
    // não é lista
    expect(salvar(com("op_aaaaaa"), [])).toHaveLength(1);
    // elemento sem id
    expect(salvar(com([{ rotulo: "A" }]), [])).toHaveLength(1);
    // dois botões com o mesmo id: o segundo nunca casa com ligação nenhuma
    expect(
      salvar(
        com([
          { id: "op_aaaaaa", rotulo: "A" },
          { id: "op_aaaaaa", rotulo: "B" },
        ]),
        []
      )
    ).toHaveLength(1);
    // dois-pontos no id: `lerPayload` conta as partes e devolve null — o toque
    // não faz nada, calado
    expect(salvar(com([{ id: "op_a:aaaa", rotulo: "A" }]), [])).toHaveLength(1);
    // e a lista vazia não é defeito nenhum: `envioDaDm` nem a reconhece
    expect(salvar(com([]), [])).toHaveLength(0);
  });

  it("ATIVAR, não salvar: botão sem texto — é o menu que ficou pela metade", () => {
    // O dono clica "adicionar botão", o painel grava `{id:"op_…", rotulo:""}` e
    // ele sai para o almoço. Travar o salvar aí o deixa sem onde guardar o meio
    // do trabalho, e o sintoma é "entrega errado" — `botoesDaMensagem` descarta
    // o par e o botão some da mensagem —, não "o motor não lê".
    const meio = [
      {
        id: "b_qbr003",
        tipo: "dm",
        texto: "Escolha",
        botoes: [
          { id: "op_aaaaaa", rotulo: "A" },
          { id: "op_bbbbbb", rotulo: "" },
        ],
      },
    ];
    expect(salvar(meio, [])).toHaveLength(0);
    const r = ativar(meio, []);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(0);
    expect(r[0].mensagem).toContain("sem texto");
  });

  it("a QUEDA ganha do rótulo em branco mesmo vindo DEPOIS dele na lista", () => {
    // A precedência não é a da ordem da lista, e essa é a parte que a separação
    // custou: com uma frase por bloco e duas portas, varrer por ordem devolveria
    // o rótulo em branco (ativar) e deixaria o `null` — que derruba o lote
    // inteiro de eventos daquele POST — passar no salvar.
    const misto = [
      {
        id: "b_qbr004",
        tipo: "dm",
        texto: "Escolha",
        botoes: [{ id: "op_aaaaaa", rotulo: "" }, null],
      },
    ];
    const r = salvar(misto, []);
    expect(r).toHaveLength(1);
    expect(r[0].mensagem).toContain("corrompido");
    // E uma frase só por bloco: a de ativar não sai junto.
    expect(ativar(misto, [])).toHaveLength(0);
  });

  it("o id inválido ganha do rótulo em branco no MESMO botão", () => {
    // NÃO é ordem dentro do laço: mover o bloco do rótulo em branco para ANTES
    // da conferência de id, dentro do laço, ainda deixa 246/246 verdes. Quem
    // decide é RETORNAR vs ATRIBUIR — o id inválido devolve na hora; o rótulo
    // em branco só grava em `semTexto` e o laço continua, então ele nunca
    // disputa posição com nada. Só fica vermelho quando a mutação posicional
    // (`return` no lugar da atribuição do rótulo) também está plantada — e
    // essa já tem teste próprio, cirúrgico, sozinho.
    const doisDefeitos = [
      { id: "b_qbr005", tipo: "dm", texto: "Escolha", botoes: [{ id: "op_a:aaaa", rotulo: "" }] },
    ];
    const r = salvar(doisDefeitos, []);
    expect(r).toHaveLength(1);
    expect(r[0].mensagem).toContain("identidade inválida");
  });

  // -------------------------------------------------------------------------
  // IMPEDE ATIVAR
  // -------------------------------------------------------------------------

  const menuDeDois = {
    id: "b_men020",
    tipo: "dm",
    texto: "Escolha",
    botoes: [
      { id: "op_aaaaaa", rotulo: "A" },
      { id: "op_bbbbbb", rotulo: "B" },
    ],
  };
  const opA = { id: "b_opa021", tipo: "dm", texto: "A" };

  it("ATIVAR, não salvar: botão sem destino — menu pela metade é trabalho normal", () => {
    // Montar um menu de três opções, ligar duas e voltar amanhã não pode travar
    // o salvar. Publicar um botão que não faz nada é outra história.
    const ls = [porBotao("b_men020", "op_aaaaaa", "b_opa021")];
    expect(salvar([menuDeDois, opA], ls)).toHaveLength(0);
    const r = ativar([menuDeDois, opA], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(0);
  });

  it("ATIVAR: bloco que nenhuma seta alcança a partir da entrada", () => {
    const outro = { id: "b_out031", tipo: "dm", texto: "Outro" };
    const solto = { id: "b_sol032", tipo: "dm", texto: "Solto" };
    const ls = [sempre("b_bem001", "b_out031")];
    expect(salvar([bem, outro, solto], ls)).toHaveLength(0);
    const r = ativar([bem, outro, solto], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(2);
  });

  it("O BLOCO DE PARTIDA NÃO É INALCANÇÁVEL — nada aponta para ele por definição", () => {
    // Sem esta linha, a regra de alcançabilidade acusa a própria entrada do
    // fluxo e NENHUMA automação pode mais ser ativada.
    const outro = { id: "b_out033", tipo: "dm", texto: "Outro" };
    const ls = [sempre("b_bem001", "b_out033")];
    expect(ativar([bem, outro], ls)).toHaveLength(0);
    expect(conferirLista([bem, outro], "dm", ls)).toEqual([]);
  });

  it("ATIVAR: portão de seguidor que é o fim do caminho — segue e não recebe nada", () => {
    const ls = [sempre("b_bem001", "b_por002")];
    const r = ativar([bem, portao], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  it("ATIVAR: resposta rápida que é o fim do caminho — toca o botão e não recebe nada", () => {
    // O beco sem saída no tipo de bloco MAIS COMUM do produto, e ele passava
    // batido: a regra tinha nascido só para o portão. A pessoa toca "Quero",
    // `seguinteDe` devolve null, `interpretar` sai calada e nada chega.
    const abre = { id: "b_abr090", tipo: "dm", texto: "Oi" };
    const ls = [sempre("b_abr090", "b_bem001")];
    expect(salvar([abre, bem], ls)).toHaveLength(0);
    const r = ativar([abre, bem], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
    // A frase nomeia o botão, porque é por ele que o dono acha o bloco.
    expect(r[0].mensagem).toContain("Quero");
  });

  it("ATIVAR: pedido de e-mail que é o fim do caminho — manda o endereço e não recebe nada", () => {
    const email = { id: "b_eml091", tipo: "pedir_email", texto: "Seu e-mail?" };
    const ls = [sempre("b_bem001", "b_eml091")];
    const r = ativar([bem, email], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
    expect(r[0].mensagem).toContain("e-mail");
  });

  it("o MENU de botões inteiramente ligado NÃO é beco sem saída, mesmo sem `sempre`", () => {
    // A linha que impede a generalização de acusar todo menu certo do produto:
    // o toque num menu é resolvido por `ligacaoEscolhida`, uma seta POR BOTÃO, e
    // um menu completo não tem `sempre` nenhuma saindo. Perguntar `seguinteDe` a
    // ele daria erro em cima da montagem correta.
    const destino = { id: "b_dst092", tipo: "dm", texto: "Pronto" };
    const ls = [
      sempre("b_bem001", "b_men020"),
      porBotao("b_men020", "op_aaaaaa", "b_dst092"),
      porBotao("b_men020", "op_bbbbbb", "b_dst092"),
    ];
    expect(conferirLista([bem, menuDeDois, destino], "dm", ls)).toEqual([]);
  });

  it("ATIVAR: mais botões do que cabe numa mensagem", () => {
    const botoes = Array.from({ length: LIMITE_DE_BOTOES + 1 }, (_, i) => ({
      id: `op_x${String(i).padStart(5, "0")}`,
      rotulo: `Opção ${i}`,
    }));
    const menu = { id: "b_men040", tipo: "dm", texto: "Escolha", botoes };
    const destino = { id: "b_dst041", tipo: "dm", texto: "Destino" };
    const ls = botoes.map((b) => porBotao("b_men040", b.id, "b_dst041"));
    expect(salvar([menu, destino], ls)).toHaveLength(0);
    const r = ativar([menu, destino], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(0);
    // Um a menos cabe, e não acusa nada.
    const cabe = { ...menu, botoes: botoes.slice(0, LIMITE_DE_BOTOES) };
    expect(ativar([cabe, destino], ls)).toHaveLength(0);
  });

  it("ATIVAR: o portão existe, mas o link é alcançável sem passar por ele", () => {
    // O caso que a Tarefa 3b não pôde fechar no motor: aplicar a regra na porta
    // da frente faria uma seta de volta pôr o pedido de "me siga" como PRIMEIRA
    // mensagem de todo mundo. Sobra o que só a montagem resolve.
    const menu = {
      id: "b_men050",
      tipo: "dm",
      texto: "Escolha",
      botoes: [
        { id: "op_aaaaaa", rotulo: "Quero" },
        { id: "op_bbbbbb", rotulo: "Direto" },
      ],
    };
    const comFuga = [
      porBotao("b_men050", "op_aaaaaa", "b_por002"),
      sempre("b_por002", "b_lnk003"),
      porBotao("b_men050", "op_bbbbbb", "b_lnk003"),
    ];
    const r = ativar([menu, portao, link], comFuga);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(2);
    expect(salvar([menu, portao, link], comFuga)).toHaveLength(0);

    // Sem a fuga — os dois botões passam pelo portão — não sobra nada a dizer.
    const semFuga = [
      porBotao("b_men050", "op_aaaaaa", "b_por002"),
      porBotao("b_men050", "op_bbbbbb", "b_por002"),
      sempre("b_por002", "b_lnk003"),
    ];
    expect(ativar([menu, portao, link], semFuga)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // AVISO, E O QUE NÃO É PROBLEMA NENHUM
  // -------------------------------------------------------------------------

  it("AVISO: bifurcação com um botão só", () => {
    const menu = {
      id: "b_men060",
      tipo: "dm",
      texto: "Escolha",
      botoes: [{ id: "op_aaaaaa", rotulo: "A" }],
    };
    const ls = [porBotao("b_men060", "op_aaaaaa", "b_opa021")];
    expect(salvar([menu, opA], ls)).toHaveLength(0);
    expect(ativar([menu, opA], ls)).toHaveLength(0);
    const r = avisos([menu, opA], ls);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(0);
  });

  it("AVISO: menu com a seta do `senao` E uma `sempre` sobrando", () => {
    // O estado é produzido POR EDIÇÃO NORMAL: uma `dm` de resposta rápida com
    // `sempre` já desenhada ganha `botoes` e vira menu — `apagarBotao`
    // (app/automacoes/editor/quadro.tsx) só apaga a `senao`, nada apaga a
    // `sempre`. Ela perde a alça e passa a ser desenhada saindo do primeiro
    // botão (`indiceDaAlca`), prometendo um caminho que o toque não percorre.
    //
    // E ela NÃO É SETA MORTA — medido, e é por isso que o nível é aviso e não
    // erro: `retomadaDoBotao` (payload sem botão) e `retomadaDoFallback`
    // (digita sem cursor) continuam saindo por ela. O que a Tarefa 7b tirou
    // dela foi um caminho só: quem digita e TEM cursor, que agora vai pela
    // `senao`.
    const menu = {
      id: "b_men080",
      tipo: "dm",
      texto: "Escolha",
      botoes: [
        { id: "op_aaaaaa", rotulo: "A" },
        { id: "op_bbbbbb", rotulo: "B" },
      ],
    };
    const b = { id: "b_opb082", tipo: "dm", texto: "B" };
    const digitou = { id: "b_dig083", tipo: "dm", texto: "Você digitou" };
    const sobra = { id: "b_sob084", tipo: "dm", texto: "A sobra" };
    const seNao = { de: "b_men080", quando: { tipo: "senao" }, para: "b_dig083" };
    const base = [
      porBotao("b_men080", "op_aaaaaa", "b_opa021"),
      porBotao("b_men080", "op_bbbbbb", "b_opb082"),
    ];
    const passos = [menu, opA, b, digitou, sobra];

    // COM AS DUAS: um aviso, e só. Nada trava.
    const duas = [...base, seNao, sempre("b_men080", "b_sob084")];
    expect(salvar(passos, duas)).toHaveLength(0);
    expect(ativar(passos, duas)).toHaveLength(0);
    const r = avisos(passos, duas);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(0);
    expect(r[0].quando).toBe("ativar");

    // SÓ A `senao`, sem `sempre`: nada a dizer — é o menu certo do produto, e
    // quem digita tem para onde ir. (`b_sob084` fica inalcançável, então ele
    // sai da lista neste caso.)
    const soSenao = [...base, seNao];
    expect(avisos([menu, opA, b, digitou], soSenao)).toHaveLength(0);

    // SÓ A `sempre`, sem `senao`: também nada. Aí ela É o caminho de quem
    // digita (`retomadaDoTexto` cai em `seguinteDe`), e o aviso seria mentira.
    const soSempre = [...base, sempre("b_men080", "b_sob084")];
    expect(avisos([menu, opA, b, sobra], soSempre)).toHaveLength(0);
  });

  it("lista válida com bifurcação E junção não tem problema nenhum", () => {
    const menu = {
      id: "b_men070",
      tipo: "dm",
      texto: "Escolha",
      botoes: [
        { id: "op_aaaaaa", rotulo: "A" },
        { id: "op_bbbbbb", rotulo: "B" },
      ],
    };
    const a = { id: "b_opa071", tipo: "dm", texto: "Braço A" };
    const b = { id: "b_opb072", tipo: "dm", texto: "Braço B" };
    const fim = { id: "b_fim073", tipo: "dm", texto: "Até logo" };
    const ls = [
      porBotao("b_men070", "op_aaaaaa", "b_opa071"),
      porBotao("b_men070", "op_bbbbbb", "b_opb072"),
      sempre("b_opa071", "b_fim073"),
      sempre("b_opb072", "b_fim073"),
    ];
    expect(conferirLista([menu, a, b, fim], "dm", ls)).toEqual([]);
  });

  it("SEM SETA NENHUMA as regras de grafo ficam caladas — é a lista de antes da fase", () => {
    // `ligacoes` tem `default '[]'::jsonb`: toda automação gravada antes desta
    // fase chega sem seta alguma, e quem as escreve é a migração
    // (`scripts/ligar-passos-existentes.mjs --aplicar`), que é DADO. Acusar
    // aqui trancaria o dono fora do painel de toda automação antiga.
    expect(conferirLista([bem, portao, link], "dm", [])).toEqual([]);
    expect(conferirLista([bem, portao, link], "dm")).toEqual([]);
  });

  it("os erros que já existiam continuam sendo de SALVAR", () => {
    // Bloco incompleto é dado que o motor não consegue ler, e ele não mudou de
    // porta nesta tarefa.
    const vazio = { id: "b_vaz080", tipo: "dm", texto: "  " };
    const r = conferirLista([bem, vazio], "dm", [sempre("b_bem001", "b_vaz080")]);
    expect(r.filter((p) => p.nivel === "erro")).toHaveLength(1);
    expect(r.filter((p) => p.nivel === "erro")[0].quando).toBe("salvar");
  });
});

// ---------------------------------------------------------------------------
// A CAIXA "ATIVA" PARA DE DRIBLAR A CONFERÊNCIA DE ATIVAR (Tarefa 6b).
//
// `podeFicarAtiva` é a decisão de uma linha que `salvarAutomacao`
// (app/automacoes/actions.ts) passa a consultar antes de gravar a coluna
// `active` — ela mora aqui, e não naquele Server Action, porque é a única
// forma de testá-la sem banco.
// ---------------------------------------------------------------------------
describe("podeFicarAtiva", () => {
  const erroDeAtivar: Problema = {
    nivel: "erro",
    quando: "ativar",
    indice: 0,
    mensagem: "Um botão deste bloco não leva a lugar nenhum.",
  };
  const erroDeSalvar: Problema = {
    nivel: "erro",
    quando: "salvar",
    indice: 0,
    mensagem: "Um dos botões deste bloco está corrompido.",
  };
  const aviso: Problema = {
    nivel: "aviso",
    quando: "ativar",
    indice: 1,
    mensagem: "O link sai antes do pedido de follow.",
  };

  it("falso quando há um erro de ATIVAR na lista", () => {
    expect(podeFicarAtiva([erroDeAtivar])).toBe(false);
  });

  it("verdadeiro quando não há nenhum erro de ATIVAR — lista vazia, ou só aviso", () => {
    expect(podeFicarAtiva([])).toBe(true);
    expect(podeFicarAtiva([aviso])).toBe(true);
  });

  it("um erro de SALVAR presente não influencia esta resposta — quem barra o salvar já barrou antes", () => {
    // Sem erro de ativar, a lista pode ficar ativa mesmo com um erro de salvar
    // junto — essa combinação nunca chega a `podeFicarAtiva` na prática, porque
    // `salvarAutomacao` já recusou o salvamento antes de consultar esta função,
    // mas a própria função não deve depender dessa ordem para responder certo.
    expect(podeFicarAtiva([erroDeSalvar])).toBe(true);
    // E com os dois juntos, quem decide é só o de ativar.
    expect(podeFicarAtiva([erroDeSalvar, erroDeAtivar])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AS EDIÇÕES DE SETA QUE O QUADRO FAZ (Tarefa 6).
//
// Elas moram em lib/steps.ts, e não dentro do componente, porque são decisões
// sobre o grafo — e é este arquivo que prova o que elas decidem.
// ---------------------------------------------------------------------------
describe("chaveDoQuando / quandoDaChave — o id da alça e a condição", () => {
  it("as três condições viram três chaves distintas", () => {
    expect(chaveDoQuando({ tipo: "sempre" })).toBe("sempre");
    expect(chaveDoQuando({ tipo: "senao" })).toBe("senao");
    expect(chaveDoQuando({ tipo: "botao", botao: "op_abc123" })).toBe("botao:op_abc123");
  });

  it("a volta devolve a mesma condição", () => {
    for (const q of [
      { tipo: "sempre" } as const,
      { tipo: "senao" } as const,
      { tipo: "botao", botao: "op_abc123" } as const,
    ]) {
      expect(quandoDaChave(chaveDoQuando(q))).toEqual(q);
    }
  });

  // O PREFIXO É O QUE SEPARA UM BOTÃO CHAMADO "sempre" DA CONTINUAÇÃO. Sem ele,
  // a seta daquele botão grudaria na alça de continuação — e o dado de `botoes`
  // pode vir de fora do painel.
  it("um botão cujo id é “sempre” não vira a condição de continuação", () => {
    const q = chaveDoQuando({ tipo: "botao", botao: "sempre" });
    expect(q).toBe("botao:sempre");
    expect(quandoDaChave(q)).toEqual({ tipo: "botao", botao: "sempre" });
  });

  it("chave que não é de condição nenhuma devolve null", () => {
    expect(quandoDaChave(null)).toBeNull();
    expect(quandoDaChave(undefined)).toBeNull();
    expect(quandoDaChave("")).toBeNull();
    expect(quandoDaChave("botao:")).toBeNull();
    expect(quandoDaChave("outra")).toBeNull();
    expect(quandoDaChave(7)).toBeNull();
  });
});

describe("ligacoesValidas — a peneira da porta", () => {
  it("descarta o que `conferirLigacao` recusa e mantém a ordem do resto", () => {
    const boa1 = { de: "b_um00001", quando: { tipo: "sempre" }, para: "b_dois0002" };
    const boa2 = { de: "b_um00001", quando: { tipo: "senao" }, para: "b_tres0003" };
    const r = ligacoesValidas([boa1, null, { de: "b_um00001" }, "x", boa2]);
    expect(r).toEqual([boa1, boa2]);
  });

  it("coluna que não é lista vira lista vazia", () => {
    expect(ligacoesValidas(null)).toEqual([]);
    expect(ligacoesValidas({})).toEqual([]);
    expect(ligacoesValidas(undefined)).toEqual([]);
  });

  // A LIGAÇÃO PARA UM BLOCO QUE NÃO EXISTE PASSA: ela é válida na forma, e quem
  // fala sobre o que ela causa é `conferirLista`. Descartá-la aqui mudaria a
  // resposta da conferência no primeiro salvamento, calada.
  it("mantém a ligação que aponta para um bloco que não está na lista", () => {
    const orfa = { de: "b_um00001", quando: { tipo: "sempre" }, para: "b_sumiu999" };
    expect(ligacoesValidas([orfa])).toEqual([orfa]);
  });
});

describe("ligar — a seta nova substitui a que saía daquela alça", () => {
  const a = "b_aaaaaaa1";
  const b = "b_bbbbbbb2";
  const c = "b_ccccccc3";

  it("liga um bloco sem saída nenhuma", () => {
    expect(ligar([], a, { tipo: "sempre" }, b)).toEqual([
      { de: a, quando: { tipo: "sempre" }, para: b },
    ]);
  });

  // É esta regra que impede o gesto normal de produzir "duas setas de
  // continuação para blocos diferentes", que `conferirLista` trata como ERRO DE
  // SALVAR.
  it("redesenhar a continuação troca o destino, e não soma uma segunda", () => {
    const antes: Ligacao[] = [{ de: a, quando: { tipo: "sempre" }, para: b }];
    const depois = ligar(antes, a, { tipo: "sempre" }, c);
    expect(depois).toEqual([{ de: a, quando: { tipo: "sempre" }, para: c }]);
  });

  it("cada botão tem a sua saída, e ligar um não mexe no outro", () => {
    let l: Ligacao[] = [];
    l = ligar(l, a, { tipo: "botao", botao: "op_1" }, b);
    l = ligar(l, a, { tipo: "botao", botao: "op_2" }, c);
    expect(l).toHaveLength(2);
    l = ligar(l, a, { tipo: "botao", botao: "op_1" }, c);
    expect(l).toEqual([
      { de: a, quando: { tipo: "botao", botao: "op_2" }, para: c },
      { de: a, quando: { tipo: "botao", botao: "op_1" }, para: c },
    ]);
  });

  it("a saída de OUTRO bloco com a mesma condição não é tocada", () => {
    const antes: Ligacao[] = [{ de: b, quando: { tipo: "sempre" }, para: c }];
    expect(ligar(antes, a, { tipo: "sempre" }, c)).toHaveLength(2);
  });
});

describe("desligarBloco — apagar um bloco apaga as setas das duas pontas", () => {
  const a = "b_aaaaaaa1";
  const b = "b_bbbbbbb2";
  const c = "b_ccccccc3";
  const ligacoes: Ligacao[] = [
    { de: a, quando: { tipo: "sempre" }, para: b },
    { de: b, quando: { tipo: "sempre" }, para: c },
    { de: a, quando: { tipo: "botao", botao: "op_1" }, para: c },
  ];

  it("tira a que chega e a que sai", () => {
    expect(desligarBloco(ligacoes, b)).toEqual([
      { de: a, quando: { tipo: "botao", botao: "op_1" }, para: c },
    ]);
  });

  it("bloco sem seta nenhuma não muda a lista", () => {
    expect(desligarBloco(ligacoes, "b_zzzzzzz9")).toEqual(ligacoes);
  });
});

describe("desligarBotao — apagar um botão apaga a seta dele", () => {
  const menu = "b_aaaaaaa1";
  const outro = "b_bbbbbbb2";
  const destino = "b_ccccccc3";
  const ligacoes: Ligacao[] = [
    { de: menu, quando: { tipo: "botao", botao: "op_1" }, para: destino },
    { de: menu, quando: { tipo: "botao", botao: "op_2" }, para: outro },
    { de: menu, quando: { tipo: "senao" }, para: outro },
    { de: outro, quando: { tipo: "sempre" }, para: menu },
    // A MESMA condição saindo de OUTRO bloco: o id do botão é escopado ao
    // bloco, e sem o `de` na comparação esta sairia junto.
    { de: outro, quando: { tipo: "botao", botao: "op_1" }, para: destino },
  ];

  it("tira só a do botão apagado, naquele bloco", () => {
    expect(desligarBotao(ligacoes, menu, "op_1")).toEqual([
      { de: menu, quando: { tipo: "botao", botao: "op_2" }, para: outro },
      { de: menu, quando: { tipo: "senao" }, para: outro },
      { de: outro, quando: { tipo: "sempre" }, para: menu },
      { de: outro, quando: { tipo: "botao", botao: "op_1" }, para: destino },
    ]);
  });

  it("a seta que CHEGA no bloco fica: ela não é do botão", () => {
    expect(desligarBotao(ligacoes, menu, "op_2")).toContainEqual({
      de: outro,
      quando: { tipo: "sempre" },
      para: menu,
    });
  });

  it("as DUAS setas do mesmo botão somem juntas", () => {
    // Forma produzível fora do editor, e `conferirLista` a acusa como "duas
    // setas saindo para blocos diferentes". Deixar a segunda faria o gesto
    // consertar o desenho e não o erro.
    const duas: Ligacao[] = [
      { de: menu, quando: { tipo: "botao", botao: "op_1" }, para: destino },
      { de: menu, quando: { tipo: "botao", botao: "op_1" }, para: outro },
    ];
    expect(desligarBotao(duas, menu, "op_1")).toEqual([]);
  });

  it("botão sem seta nenhuma não muda a lista", () => {
    expect(desligarBotao(ligacoes, menu, "op_naoligado")).toEqual(ligacoes);
  });

  // O MOTIVO INTEIRO DE ELA EXISTIR, e ele é o contrário do que o plano da
  // Tarefa 7 dizia. A previsão era "a ligação órfã faria a conferência acusar um
  // botão que não existe mais"; o que ela faz é APAGAR UM ERRO VERDADEIRO —
  // `haCaminho` conta todas as condições, então a seta do botão apagado ainda
  // torna o destino "alcançável".
  it("deixar a órfã ESCONDE o erro de bloco inalcançável", () => {
    const passos = [
      { id: "b_menu0001", tipo: "dm", texto: "Escolha", botoes: [{ id: "op_a", rotulo: "Fica" }] },
      { id: "b_dois0002", tipo: "dm", texto: "dois" },
      { id: "b_tres0003", tipo: "dm", texto: "tres" },
    ];
    const comOrfa: Ligacao[] = [
      { de: "b_menu0001", quando: { tipo: "botao", botao: "op_a" }, para: "b_dois0002" },
      { de: "b_menu0001", quando: { tipo: "botao", botao: "op_b" }, para: "b_tres0003" },
    ];
    const inalcancavel = (ls: Ligacao[]) =>
      conferirLista(passos, "dm", ls).filter((p) => p.mensagem.startsWith("Nenhuma seta chega"));

    expect(inalcancavel(comOrfa)).toHaveLength(0);
    expect(inalcancavel(desligarBotao(comOrfa, "b_menu0001", "op_b"))).toEqual([
      {
        nivel: "erro",
        quando: "ativar",
        indice: 2,
        mensagem:
          "Nenhuma seta chega neste bloco a partir do começo do fluxo, então ele nunca é entregue.",
      },
    ]);
  });
});

describe("desligarSenao — o último botão leva a `senao` junto", () => {
  const menu = "b_aaaaaaa1";
  const outro = "b_bbbbbbb2";
  const ligacoes: Ligacao[] = [
    { de: menu, quando: { tipo: "botao", botao: "op_1" }, para: outro },
    { de: menu, quando: { tipo: "senao" }, para: outro },
    { de: menu, quando: { tipo: "sempre" }, para: outro },
    // A `senao` de OUTRO bloco: sem o `de` na comparação esta sairia junto.
    { de: outro, quando: { tipo: "senao" }, para: menu },
  ];

  it("tira só a `senao` daquele bloco", () => {
    expect(desligarSenao(ligacoes, menu)).toEqual([
      { de: menu, quando: { tipo: "botao", botao: "op_1" }, para: outro },
      { de: menu, quando: { tipo: "sempre" }, para: outro },
      { de: outro, quando: { tipo: "senao" }, para: menu },
    ]);
  });

  it("bloco sem `senao` não muda a lista", () => {
    expect(desligarSenao([ligacoes[0]], menu)).toEqual([ligacoes[0]]);
  });

  it("duas `senao` do mesmo bloco somem juntas", () => {
    // Forma produzível fora do editor, e `conferirLista` a acusa como "duas
    // setas saindo para blocos diferentes" — deixar a segunda consertaria o
    // desenho e não o erro, que é o argumento de `desligarBotao`.
    const duas: Ligacao[] = [
      { de: menu, quando: { tipo: "senao" }, para: outro },
      { de: menu, quando: { tipo: "senao" }, para: "b_ccccccc3" },
    ];
    expect(desligarSenao(duas, menu)).toEqual([]);
  });

  // O MOTIVO INTEIRO DE ELA EXISTIR, e é o mesmo de `desligarBotao`: a órfã
  // ESCONDE um erro verdadeiro. `haCaminho` conta todas as condições, então a
  // `senao` de um menu que não tem mais botão nenhum ainda torna o destino
  // "alcançável" — e o menu sem botões não tem alça de `senao` nenhuma.
  it("deixar a `senao` órfã ESCONDE o erro de bloco inalcançável", () => {
    const passos = [
      { id: "b_umuuuu001", tipo: "dm", texto: "oi" },
      { id: "b_menu0002", tipo: "dm", texto: "Escolha", botoes: [] },
      { id: "b_tres0003", tipo: "dm", texto: "tres" },
    ];
    const comOrfa: Ligacao[] = [
      { de: "b_umuuuu001", quando: { tipo: "sempre" }, para: "b_menu0002" },
      { de: "b_menu0002", quando: { tipo: "senao" }, para: "b_tres0003" },
    ];

    // E ela promete um caminho que o motor não percorre: a retomada de um menu
    // sem botões pergunta a `seguinteDe`, e não há `sempre` saindo dali.
    expect(seguinteDe(comOrfa, "b_menu0002")).toBeNull();

    const inalcancavel = (ls: Ligacao[]) =>
      conferirLista(passos, "dm", ls).filter((p) => p.mensagem.startsWith("Nenhuma seta chega"));

    expect(inalcancavel(comOrfa)).toHaveLength(0);
    expect(inalcancavel(desligarSenao(comOrfa, "b_menu0002"))).toEqual([
      {
        nivel: "erro",
        quando: "ativar",
        indice: 2,
        mensagem:
          "Nenhuma seta chega neste bloco a partir do começo do fluxo, então ele nunca é entregue.",
      },
    ]);
  });
});

describe("desligarERenumerar — apagar um bloco não deixa seta fantasma", () => {
  const comId = [
    { tipo: "dm", texto: "a", id: "b_aaaaaaa1" },
    { tipo: "dm", texto: "b", id: "b_bbbbbbb2" },
    { tipo: "dm", texto: "c", id: "b_ccccccc3" },
  ];
  // A lista anterior à Fase 1b: nenhum bloco tem `id`, e a identidade de cada um
  // é a POSIÇÃO. É a lista em que apagar renomeia os vizinhos.
  const semId = [
    { tipo: "dm", texto: "a" },
    { tipo: "dm", texto: "b" },
    { tipo: "dm", texto: "c" },
  ];
  const emFila = (ids: string[]): Ligacao[] =>
    ids.slice(0, -1).map((de, i) => ({ de, quando: { tipo: "sempre" }, para: ids[i + 1] }));

  it("com id, as setas do bloco somem e as outras ficam intactas", () => {
    const ls = emFila(["b_aaaaaaa1", "b_bbbbbbb2", "b_ccccccc3"]);
    expect(desligarERenumerar(comId, ls, 1)).toEqual([]);
    expect(desligarERenumerar(comId, ls, 2)).toEqual([
      { de: "b_aaaaaaa1", quando: { tipo: "sempre" }, para: "b_bbbbbbb2" },
    ]);
  });

  // A MEDIÇÃO DO DEFEITO, virada do avesso: sem a renumeração isto devolvia
  // `[{de:"1", para:"2"}]` — uma seta saindo do último bloco para um bloco que
  // não existe mais, gravada no banco sem nada acusar.
  it("sem id, a seta que sobra acompanha o bloco que mudou de nome", () => {
    const ls = emFila(["0", "1", "2"]);
    expect(desligarERenumerar(semId, ls, 0)).toEqual([
      { de: "0", quando: { tipo: "sempre" }, para: "1" },
    ]);
  });

  it("sem id, apagar o do meio não deixa nada apontando para fora da lista", () => {
    const ls = emFila(["0", "1", "2"]);
    const depois = desligarERenumerar(semId, ls, 1);
    const restam = new Set(["0", "1"]);
    expect(depois.every((l) => restam.has(l.de) && restam.has(l.para))).toBe(true);
  });

  // Numa lista MISTA a regra não precisa de exceção: quem tem id mantém o nome,
  // quem não tem segue a posição.
  it("lista mista renomeia só quem não tem id", () => {
    const mista = [{ tipo: "dm", texto: "a" }, { tipo: "dm", texto: "b", id: "b_bbbbbbb2" }, { tipo: "dm", texto: "c" }];
    const ls: Ligacao[] = [{ de: "b_bbbbbbb2", quando: { tipo: "sempre" }, para: "2" }];
    expect(desligarERenumerar(mista, ls, 0)).toEqual([
      { de: "b_bbbbbbb2", quando: { tipo: "sempre" }, para: "1" },
    ]);
  });

  it("índice fora da lista devolve as ligações como estavam", () => {
    const ls = emFila(["0", "1", "2"]);
    expect(desligarERenumerar(semId, ls, 9)).toBe(ls);
    expect(desligarERenumerar(semId, ls, -1)).toBe(ls);
  });
});

describe("apagarLigacoes — a saída de um estado que o salvar recusa", () => {
  const a = "b_aaaaaaa1";
  const b = "b_bbbbbbb2";
  const c = "b_ccccccc3";
  const ligacoes: Ligacao[] = [
    { de: a, quando: { tipo: "sempre" }, para: b },
    { de: b, quando: { tipo: "sempre" }, para: c },
    { de: c, quando: { tipo: "sempre" }, para: a },
  ];

  it("apaga a seta pedida e mantém as outras na ordem", () => {
    expect(apagarLigacoes(ligacoes, [2])).toEqual([ligacoes[0], ligacoes[1]]);
  });

  // Os índices são resolvidos todos contra a MESMA lista: apagar um por vez
  // faria o segundo apontar para a seta que tomou o lugar da primeira.
  it("apaga várias de uma vez sem escorregar de índice", () => {
    expect(apagarLigacoes(ligacoes, [0, 2])).toEqual([ligacoes[1]]);
  });

  it("índice que não existe não tira nada", () => {
    expect(apagarLigacoes(ligacoes, [7])).toEqual(ligacoes);
    expect(apagarLigacoes(ligacoes, [])).toEqual(ligacoes);
  });

  // A prova de que este gesto é MESMO a saída: o anel de `sempre` é erro de
  // SALVAR, e apagar a seta que o fecha destrava o salvamento.
  it("apagar a seta que fecha o anel destrava o salvar", () => {
    const passos = [
      { tipo: "dm", texto: "a", id: a },
      { tipo: "dm", texto: "b", id: b },
      { tipo: "dm", texto: "c", id: c },
    ];
    const travado = conferirLista(passos, "dm", ligacoes).filter(
      (p) => p.nivel === "erro" && p.quando === "salvar"
    );
    expect(travado).toHaveLength(1);
    expect(travado[0].mensagem).toContain("volta no fluxo");

    const solto = conferirLista(passos, "dm", apagarLigacoes(ligacoes, [2])).filter(
      (p) => p.nivel === "erro" && p.quando === "salvar"
    );
    expect(solto).toEqual([]);
  });
});

describe("partirLigacao — soltar um bloco em cima de uma seta", () => {
  const a = "b_aaaaaaa1";
  const b = "b_bbbbbbb2";
  const meio = "b_mmmmmmm4";

  it("a condição fica na primeira metade e a segunda é continuação", () => {
    const antes: Ligacao[] = [{ de: a, quando: { tipo: "botao", botao: "op_1" }, para: b }];
    expect(partirLigacao(antes, 0, meio)).toEqual([
      { de: a, quando: { tipo: "botao", botao: "op_1" }, para: meio },
      { de: meio, quando: { tipo: "sempre" }, para: b },
    ]);
  });

  it("as outras setas não são tocadas", () => {
    const outra: Ligacao = { de: b, quando: { tipo: "sempre" }, para: a };
    const antes: Ligacao[] = [{ de: a, quando: { tipo: "sempre" }, para: b }, outra];
    expect(partirLigacao(antes, 0, meio)).toContainEqual(outra);
  });

  // A sutileza que `ligar` resolve: o bloco levado para o meio podia já ter uma
  // continuação. Duas `sempre` saindo dele seriam ERRO DE SALVAR, produzido por
  // um gesto normal.
  it("o bloco do meio não fica com duas continuações", () => {
    const antes: Ligacao[] = [
      { de: a, quando: { tipo: "sempre" }, para: b },
      { de: meio, quando: { tipo: "sempre" }, para: a },
    ];
    const depois = partirLigacao(antes, 0, meio);
    expect(depois.filter((l) => l.de === meio && l.quando.tipo === "sempre")).toEqual([
      { de: meio, quando: { tipo: "sempre" }, para: b },
    ]);
  });

  it("índice que não existe devolve a lista como estava", () => {
    const antes: Ligacao[] = [{ de: a, quando: { tipo: "sempre" }, para: b }];
    expect(partirLigacao(antes, 7, meio)).toBe(antes);
    expect(partirLigacao([], 0, meio)).toEqual([]);
  });

  // A prova de que o gesto não quebra o fluxo: depois de partir, `seguinteDe`
  // leva de A ao bloco novo, e do bloco novo a B.
  it("o caminho continua inteiro, agora passando pelo bloco do meio", () => {
    const antes: Ligacao[] = [{ de: a, quando: { tipo: "sempre" }, para: b }];
    const depois = partirLigacao(antes, 0, meio);
    expect(seguinteDe(depois, a)).toBe(meio);
    expect(seguinteDe(depois, meio)).toBe(b);
    expect(haCaminho(depois, a, b)).toBe(true);
  });
});
