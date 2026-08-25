// O PRIMEIRO CAMINHO DA FRENTE 2: o portão e o link.
//
// A PROMESSA CENTRAL DO PRODUTO, escrita como teste: **a recompensa nunca sai
// para quem não segue o perfil.**
//
// Ela é provada com o motor de verdade (`lib/engine.ts`) contra um banco de
// verdade (o schema descartável de `harness.ts`), e a prova é feita OLHANDO A
// FILA — o que foi enfileirado para a pessoa —, e não o que uma função devolveu.
// O motivo é o achado que criou esta frente: as funções que decidem são puras e
// testadas uma a uma, e o defeito nasce na COMPOSIÇÃO delas dentro de um arquivo
// `server-only` que nenhum teste importava.
//
// -----------------------------------------------------------------------------
// O NÓ, E COMO ELE FOI DESATADO
//
// O portão pergunta à Meta se a pessoa segue (`checkFollowsAccount`, lib/ig.ts),
// e um teste não pode perguntar à Meta de verdade. Deixar a chamada FALHAR é a
// saída que parece inofensiva e é a pior: `checkFollowsAccount` engole o erro e
// devolve `null`, `resolverFollow` trata `null` como PASSOU, e o teste
// exercitaria justamente o ramo que NÃO prova a promessa — depois de ter
// disparado uma requisição real contra a Meta com um token inventado.
//
// A saída é um SERVIDOR HTTP NA PRÓPRIA MÁQUINA, que este arquivo sobe e
// derruba, com a base do Graph apontada para ele por `IG_GRAPH_BASE`
// (`baseDoGraph`, lib/ig.ts, onde estão as duas travas e o porquê de cada uma).
//
// ISSO NÃO É MOCK, e a distinção não é retórica: não há `vi.mock`, não há
// `vi.stubGlobal`, não há banco de mentira. O `fetch` é o `fetch` do Node, a
// resposta é HTTP de verdade, o JSON é parseado pelo `graphFetch` de verdade, e
// quem decide o que fazer com o booleano é o `resolverFollow` de verdade. O que
// foi substituído é a OUTRA PONTA DO FIO — a fronteira de rede —, e só ela.
//
// E ele paga uma segunda dívida: com a base desviada, NENHUMA requisição deste
// teste sai da máquina. O caminho do portão chama a Meta duas vezes por pessoa
// nova (o perfil do contato e o `is_user_follow_business`), e sem o desvio as
// duas iriam para `graph.instagram.com`.
//
// -----------------------------------------------------------------------------
// O GRAFO DAS AUTOMAÇÕES, E POR QUE ELE TEM UMA JUNÇÃO
//
// Os três casos usam a MESMA forma, que é o grafo mais banal do quadro e o que
// produziu os vazamentos reais desta branch — uma JUNÇÃO no bloco do link:
//
//     boas-vindas --sempre--> LINK <--sempre-- portão
//
// Ela importa porque é ela que faz a REGRA DO PORTÃO ser alcançável. Se o
// destino da retomada fosse o próprio portão, `atravessandoOPortao` devolveria
// `portao: null` e quem avaliaria o portão seria o laço de dentro de
// `executarFluxo` — outro ramo, outra prova. Com a junção, a retomada nasce com
// `portao` NÃO-NULO, e é o bloco do topo de `executarFluxo` que precisa
// atravessá-lo antes de entregar o destino.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");

const banco = bancoDescartavel();

const CONTA = "17800000000000123";
// Valor inventado. Nenhuma credencial de verdade entra em teste — e o servidor
// falso confere que foi ESTE token que chegou nele.
const TOKEN = "token-de-teste-que-nao-vale-nada";

const LINK_A = "https://exemplo-do-teste.invalid/recompensa-a";
const LINK_B = "https://exemplo-do-teste.invalid/recompensa-b";
const LINK_C = "https://exemplo-do-teste.invalid/recompensa-c";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
//
// Ela responde só o que a API de verdade responde nestes dois campos, e devolve
// 404 para qualquer outro caminho: se o motor passar a perguntar outra coisa, o
// teste vê o pedido na lista em vez de receber uma resposta inventada.
// ---------------------------------------------------------------------------

type Segue = boolean | null;

const meta = {
  // O que a Meta responde sobre "essa pessoa segue?".
  //   false -> não segue     true -> segue     null -> a Meta não informou
  segue: false as Segue,
  pedidos: [] as { caminho: string; campos: string; token: string | null }[],
};

let servidor: Server;
let engine: ModuloEngine;
let ig: ModuloIg;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const campos = u.searchParams.get("fields") ?? "";
    meta.pedidos.push({
      caminho: u.pathname,
      campos,
      token: u.searchParams.get("access_token"),
    });
    const responder = (corpo: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(corpo));
    };
    // O campo do portão. Corpo VAZIO é a forma real de "não informou": a Meta
    // responde 200 sem o campo quando a permissão não está concedida, e é isso
    // que faz `checkFollowsAccount` devolver null.
    if (campos.includes("is_user_follow_business")) {
      return responder(meta.segue === null ? {} : { is_user_follow_business: meta.segue });
    }
    // O perfil de quem mandou a DM (`getUserProfile`), chamado na primeira
    // mensagem de cada pessoa.
    if (campos.includes("username")) {
      return responder({ username: "pessoa_de_teste", name: "Pessoa de teste" });
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: { message: `a Meta falsa não conhece ${u.pathname}?fields=${campos}` },
      })
    );
  });

  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;

  // Importados DEPOIS de o harness ter preparado a DATABASE_URL, pelo mesmo
  // motivo que o harness importa `lib/db` lá dentro: o cliente do banco é
  // singleton de módulo e só lê o ambiente na primeira chamada.
  engine = await import("@/lib/engine");
  ig = await import("@/lib/ig");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois. Se o desvio não pegasse,
  // o `fetch` iria para `graph.instagram.com` de verdade, com um token
  // inventado — e o teste até acusaria o estrago (a Meta recusaria o token,
  // `checkFollowsAccount` devolveria null, `resolverFollow` trataria como
  // "passou" e o link sairia), só que DEPOIS de a requisição ter saído desta
  // máquina. Esta linha é o que garante que ela não sai.
  //
  // Provado quebrando o desvio de propósito: `beforeAll` lançou o RECUSADO
  // abaixo, os 4 casos ficaram como `skipped`, e ZERO pedidos chegaram ao
  // servidor local — ou seja, nenhum saiu para lugar nenhum.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste falaria ` +
        `com a Meta de verdade.`
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_portao",
    name: "Conta do portão",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada: as decisões são todas do motor.
// ---------------------------------------------------------------------------

// `$n::text::jsonb`, e nunca `$n::jsonb` sobre string: a segunda forma grava um
// ESCALAR JSON, e aí o motor registra `step_ignorado` dizendo que a automação
// não tem lista de passos.
async function semear(
  nome: string,
  palavra: string,
  steps: unknown[],
  ligacoes: unknown[]
): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type, steps, ligacoes)
       values ($1, $2, true, '{dm}'::text[], string_to_array($3, ','), 'contains',
               $4::text::jsonb, $5::text::jsonb)
       returning id`,
      [CONTA, nome, palavra, JSON.stringify(steps), JSON.stringify(ligacoes)]
    )) as { id: string }[];
  return linhas[0].id;
}

async function fila(contatoIgId: string) {
  return (await banco
    .db()
    .sql()
    .query(
      `select kind, payload from queue
        where account_id = $1 and contact_ig_id = $2
        order by created_at asc, id asc`,
      [CONTA, contatoIgId]
    )) as { kind: string; payload: Record<string, unknown> }[];
}

// A pergunta é literal: a url da recompensa aparece em ALGUMA coisa que foi
// enfileirada para esta pessoa? Não "o kind é dm_link", que deixaria passar a
// url viajando por outro tipo de item.
function urlNaFila(linhas: { kind: string; payload: unknown }[], url: string): boolean {
  return linhas.some((l) => JSON.stringify(l.payload).includes(url));
}

async function contato(igId: string) {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select flow_step_id, follow_attempts, email from contacts
        where account_id = $1 and ig_id = $2`,
      [CONTA, igId]
    )) as { flow_step_id: string | null; follow_attempts: number; email: string | null }[];
  return linhas[0];
}

async function eventos(tipo: string, igId: string) {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select count(*)::int as n from events
        where account_id = $1 and type = $2 and payload->>'contact_ig_id' = $3`,
      [CONTA, tipo, igId]
    )) as { n: number }[];
  return linhas[0].n;
}

// Uma mensagem de texto chegando pelo webhook, como a Meta a entrega.
async function mensagem(igId: string, texto: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, {
    sender: { id: igId },
    message: { mid, text: texto },
  });
}

// Um toque em botão de resposta rápida, como a Meta o entrega.
async function toque(igId: string, payload: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, {
    sender: { id: igId },
    message: { mid, text: "", quick_reply: { payload } },
  });
}

// ---------------------------------------------------------------------------

const BOAS_VINDAS = {
  id: "b_boasvindas",
  tipo: "dm",
  texto: "Oi! Quer o material?",
  botao_label: "Quero!",
};
const PORTAO = {
  id: "b_portao",
  tipo: "pedir_follow",
  texto: "Segue lá primeiro que eu te mando 🙏",
  botao_label: "Já sigo!",
};

describe("portão → link", () => {
  test("a base do Graph só se move sob as DUAS travas", () => {
    const daRodada = process.env.IG_GRAPH_BASE!;
    const salvo = process.env.VITEST;
    try {
      // Aqui dentro as duas cedem: estamos sob o vitest, e a base é loopback.
      expect(ig.baseDoGraph()).toBe(daRodada);

      // TRAVA 1 — sem o vitest, a variável não vale nada. É esta linha que diz
      // que `next dev`, `next build` e a Vercel não caem no desvio.
      delete process.env.VITEST;
      expect(ig.baseDoGraph()).toBe(ig.GRAPH);
      process.env.VITEST = salvo;

      // TRAVA 2 — fora do loopback, a variável não vale nada. O `access_token`
      // viaja na query destas chamadas: sem esta trava, a variável seria um
      // caminho de exfiltração de credencial por painel de deploy.
      for (const fora of [
        "https://graph.exemplo-malicioso.invalid",
        "http://127.0.0.1.exemplo-malicioso.invalid:8080",
        "http://127.0.0.1:8080/prefixo",
        "https://127.0.0.1:8080",
      ]) {
        process.env.IG_GRAPH_BASE = fora;
        expect(ig.baseDoGraph(), fora).toBe(ig.GRAPH);
      }
    } finally {
      process.env.VITEST = salvo;
      process.env.IG_GRAPH_BASE = daRodada;
    }
    expect(ig.baseDoGraph()).toBe(daRodada);
    expect(ig.GRAPH).toBe("https://graph.instagram.com");
  });

  test("QUEM NÃO SEGUE encontra o portão e o link NÃO sai", async () => {
    await semear(
      "A · junção no link",
      "quero-a",
      [BOAS_VINDAS, PORTAO, { id: "b_linkaaa", tipo: "dm", texto: "Aqui está:", url: LINK_A }],
      [
        { de: "b_boasvindas", quando: { tipo: "sempre" }, para: "b_linkaaa" },
        { de: "b_portao", quando: { tipo: "sempre" }, para: "b_linkaaa" },
      ]
    );
    const EU = "9000000000000001";
    meta.segue = false;

    // 1) a palavra-chave: o fluxo entra pela boas-vindas e para nela.
    await mensagem(EU, "quero-a", "m-a-1");
    expect((await fila(EU)).map((l) => l.kind)).toEqual(["dm_welcome"]);
    expect((await contato(EU)).flow_step_id).toBe("b_boasvindas");

    // 2) a pessoa responde com TEXTO em vez de tocar no botão. `retomadaDoTexto`
    //    manda ir para o LINK — e a regra do portão intercepta, porque o portão
    //    alcança o link pelo outro braço da junção.
    await mensagem(EU, "manda aí", "m-a-2");

    const linhas = await fila(EU);
    // O QUE ESTE TESTE EXISTE PARA DIZER:
    expect(urlNaFila(linhas, LINK_A)).toBe(false);
    // e o que ela recebeu no lugar foi o pedido de follow
    expect(linhas.map((l) => l.kind)).toEqual(["dm_welcome", "dm_follow_gate"]);
    // ela ficou PARADA no portão, e o pedido foi contado
    const c = await contato(EU);
    expect(c.flow_step_id).toBe("b_portao");
    expect(c.follow_attempts).toBe(1);

    // e a Meta foi mesmo perguntada, pelo fio, com o token da conta
    const perguntas = meta.pedidos.filter((p) => p.campos.includes("is_user_follow_business"));
    expect(perguntas.length).toBeGreaterThan(0);
    expect(perguntas.every((p) => p.token === TOKEN)).toBe(true);
    expect(perguntas.some((p) => p.caminho.endsWith(`/${EU}`))).toBe(true);

    // 3) O VIZINHO QUE IMPEDE A PROVA DE SER VAZIA: outra pessoa, MESMA
    //    automação, MESMO caminho — e a Meta diz que ela segue. O link sai.
    const SEGUIDORA = "9000000000000002";
    meta.segue = true;
    await mensagem(SEGUIDORA, "quero-a", "m-a-3");
    await mensagem(SEGUIDORA, "manda aí", "m-a-4");
    const dela = await fila(SEGUIDORA);
    expect(urlNaFila(dela, LINK_A)).toBe(true);
    expect(dela.map((l) => l.kind)).toEqual(["dm_welcome", "dm_link"]);
    // atravessou: o contador está zerado e ela não ficou presa no portão
    const cs = await contato(SEGUIDORA);
    expect(cs.follow_attempts).toBe(0);
    expect(cs.flow_step_id).not.toBe("b_portao");

    // 4) O OUTRO VIZINHO: a Meta NÃO INFORMA. É decisão declarada do produto
    //    liberar — barrar prenderia a base inteira se o campo ficasse
    //    indisponível —, e ela registra o evento para o dono ver em Atividade.
    const SEM_RESPOSTA = "9000000000000003";
    meta.segue = null;
    await mensagem(SEM_RESPOSTA, "quero-a", "m-a-5");
    await mensagem(SEM_RESPOSTA, "manda aí", "m-a-6");
    expect(urlNaFila(await fila(SEM_RESPOSTA), LINK_A)).toBe(true);
    expect(await eventos("follow_check_unavailable", SEM_RESPOSTA)).toBe(1);

    // NADA saiu desta máquina: todo pedido do caminho chegou na Meta falsa, e
    // nenhum deles caiu no 404 de caminho desconhecido.
    expect(meta.pedidos.every((p) => p.campos !== "")).toBe(true);
  });

  test("E-MAIL JÁ CONHECIDO não pula o portão", async () => {
    // O grafo que vazou de verdade, e está escrito em `retomadaDoEmailConhecido`
    // (lib/steps.ts): quem já tem e-mail gravado resolve o passo SEM PERGUNTAR, e
    // o seguinte dele é o link — que o portão também alcança.
    await semear(
      "B · e-mail já conhecido",
      "quero-b",
      [
        { id: "b_emailll", tipo: "pedir_email", texto: "Qual é o seu e-mail?" },
        { id: "b_linkbbb", tipo: "dm", texto: "Aqui está:", url: LINK_B },
        PORTAO,
      ],
      [
        { de: "b_emailll", quando: { tipo: "sempre" }, para: "b_linkbbb" },
        { de: "b_portao", quando: { tipo: "sempre" }, para: "b_linkbbb" },
      ]
    );
    const EU = "9000000000000004";
    meta.segue = false;

    // O e-mail já está gravado ANTES da primeira mensagem — é o caso que o
    // passo resolve sem perguntar.
    await banco
      .db()
      .sql()
      .query(`insert into contacts (account_id, ig_id, email) values ($1, $2, $3)`, [
        CONTA,
        EU,
        "pessoa@exemplo-do-teste.invalid",
      ]);

    await mensagem(EU, "quero-b", "m-b-1");

    const linhas = await fila(EU);
    expect(urlNaFila(linhas, LINK_B)).toBe(false);
    // não houve nem pedido de e-mail: ele foi resolvido pelo que já se sabia
    expect(linhas.map((l) => l.kind)).toEqual(["dm_follow_gate"]);
    expect((await contato(EU)).flow_step_id).toBe("b_portao");
  });

  test("TOQUE EM BOTÃO não pula o portão", async () => {
    const AUTO = await semear(
      "C · menu de botões",
      "quero-c",
      [
        {
          id: "b_menuuuu",
          tipo: "dm",
          texto: "Escolhe aí:",
          botoes: [{ id: "op_quero1", rotulo: "Quero o material" }],
        },
        PORTAO,
        { id: "b_linkccc", tipo: "dm", texto: "Aqui está:", url: LINK_C },
      ],
      [
        { de: "b_menuuuu", quando: { tipo: "botao", botao: "op_quero1" }, para: "b_linkccc" },
        { de: "b_portao", quando: { tipo: "sempre" }, para: "b_linkccc" },
      ]
    );
    const EU = "9000000000000005";
    meta.segue = false;

    await mensagem(EU, "quero-c", "m-c-1");
    const menu = (await fila(EU))[0];
    expect(menu.kind).toBe("dm_welcome");

    // O payload do toque é LIDO DA FILA, e não montado aqui: assim o teste
    // percorre a ida e a volta inteira — o motor escreveu, e o motor lê.
    const payloads = menu.payload.quick_reply_payloads as string[];
    expect(payloads).toEqual([`AUTO:${AUTO}:b_menuuuu:op_quero1`]);

    await toque(EU, payloads[0], "m-c-2");

    const linhas = await fila(EU);
    expect(urlNaFila(linhas, LINK_C)).toBe(false);
    expect(linhas.map((l) => l.kind)).toEqual(["dm_welcome", "dm_follow_gate"]);
    expect((await contato(EU)).flow_step_id).toBe("b_portao");
  });
});
