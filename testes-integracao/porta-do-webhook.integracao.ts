// O SÉTIMO CAMINHO DA FRENTE 2: A ROTA DO WEBHOOK, INTEIRA.
//
// A PROMESSA, escrita como teste: **um POST assinado da Meta atravessa
// `app/api/webhook/route.ts` de ponta a ponta — corpo cru, assinatura, parse,
// despacho — e a pessoa que tocou na pergunta de abertura vira contato com a
// automação rodando e a DM saindo no fio.**
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE, com a medição que o obrigou
//
// A decisão de ramo saiu da rota e virou função pura (`destinoDoMessaging`,
// lib/webhook-messaging.ts), com caso para cada saída. Isso fechou o CONHECIMENTO
// — mas não a FIAÇÃO. A linha que sobrou,
//
//   if (destino === "motor") { await handleMessagingEvent(entry.id, messaging); }
//
// continua sendo um literal mutável em silêncio. Medido: trocar `"motor"` por
// `"registrar"` deixa `tsc` limpo, `eslint` limpo, os 709 puros verdes, a
// varredura imprimindo SEM VAZAMENTO e os 49 de integração TODOS VERDES — e
// `message` e `postback` passam a cair em `webhook_messaging_nao_tratado`. Não
// morre só a porta de entrada: morre TODO o tratamento de mensagens do produto.
// (A outra troca possível, `"ignorar"`, o `tsc` já pega sozinho com TS2367,
// porque `DestinoDoMessaging` é união nomeada de três saídas e o segundo `if`
// estreita o tipo. Metade das mutações já tinha dono; esta não tinha.)
//
// -----------------------------------------------------------------------------
// O LIMITE NÃO ERA ESTRUTURAL — ERA UM CAMPO
//
// Ficou escrito por aí que "nenhum arquivo de teste do projeto importa
// `app/api/webhook/route.ts`", como se fosse fato da natureza. Não é: um `POST`
// de route handler é uma função exportada que recebe um `Request`, e não há
// fronteira de serialização nenhuma no caminho. O que faltava era o FIM do
// handler — `after()` (next/server) exige `waitUntil` e `onClose` no
// `renderOpts`, e os dois estavam `undefined` na fundação de
// `semear-requisicao.ts`, então a última linha da rota estourava com
// "after() will not work correctly, because waitUntil is not available in the
// current environment".
//
// Os dois campos entraram lá, com o que uma plataforma serverless promete e nada
// além. O cabeçalho daquele arquivo já trazia este mesmo argumento escrito, para
// os Server Actions: enquanto o nó não se desatou, `app/automacoes/actions.ts`
// não tinha NENHUM teste que o importasse — e dois dos oito defeitos que
// sobreviviam a tudo moravam exatamente lá.
//
// -----------------------------------------------------------------------------
// NENHUM COOKIE É FORJADO, E AQUI NEM FARIA SENTIDO
//
// O webhook não autentica por sessão: ele autentica por HMAC-SHA256 do CORPO CRU
// (`x-hub-signature-256`, lib/webhook-signature.ts). A jarra de cookies desta
// montagem sai VAZIA — é promessa de `semear-requisicao.ts`, conferida por ela
// mesma na primeira chamada.
//
// O SEGREDO É INVENTADO e vive só nesta rodada, em `process.env.META_APP_SECRET`
// — que é a terceira das três chaves que a rota confere. Nenhuma credencial de
// verdade entra em teste, e a `DATABASE_URL` não é lida nem impressa por este
// arquivo: quem cuida dela é o schema descartável de `harness.ts`.
//
// E a assinatura é conferida DE VERDADE: o terceiro caso manda um corpo com
// assinatura errada e afirma o 401. Sem ele, este arquivo poderia estar
// atravessando a fronteira em vez de exercitá-la.
//
// -----------------------------------------------------------------------------
// NADA DE MOCK, E NADA SAI DA MÁQUINA
//
// Não há `vi.mock`, não há `vi.stubGlobal`, não há banco de mentira. A rota é a
// de produção, o motor é o de produção, o banco é o schema descartável. O único
// desvio é o da outra ponta do fio: `IG_GRAPH_BASE` + `baseDoGraph()`
// (lib/ig.ts), com a guarda que falha ANTES de qualquer requisição sair.
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";
// `lib/steps.ts` não tem import nenhum e não fala com o banco: pode ser
// importado no topo. Tudo que toca banco ou rede — a ROTA inclusive — é
// importado dentro do `beforeAll`, depois de a DATABASE_URL estar pronta.
import { payloadDaPergunta } from "@/lib/steps";

type ModuloRota = typeof import("@/app/api/webhook/route");
type ModuloIg = typeof import("@/lib/ig");

const banco = bancoDescartavel();

const CONTA = "17800000000000333";
// Valores inventados. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-de-teste-que-nao-vale-nada";
const SEGREDO = "segredo-de-teste-que-nao-vale-nada";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
//
// Ela responde duas coisas, e é o caminho inteiro que a rota provoca:
//   o PERFIL de quem aparece pela primeira vez (`getUserProfile`), e
//   o ENVIO da DM (`POST /{conta}/messages`), que quem provoca é o `drainQueue`
//     do `after()` no fim da rota — ou seja, é a prova de que aquela última
//     linha rodou, e não morreu calada.
// Qualquer outro caminho volta 404 e entra na lista de desconhecidos, para que
// um pedido novo apareça em vez de receber resposta inventada.
// ---------------------------------------------------------------------------

const meta = {
  enviadas: [] as { destinatario: string | undefined; texto: string | undefined }[],
  desconhecidos: [] as string[],
};

let servidor: Server;
let rota: ModuloRota;
let ig: ModuloIg;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "POST" && u.pathname.endsWith("/messages")) {
      const pedacos: Buffer[] = [];
      req.on("data", (d: Buffer) => pedacos.push(d));
      req.on("end", () => {
        const corpo = JSON.parse(Buffer.concat(pedacos).toString("utf8")) as {
          recipient?: { id?: string };
          message?: { text?: string };
        };
        meta.enviadas.push({
          destinatario: corpo.recipient?.id,
          texto: corpo.message?.text,
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ message_id: `mid-enviado-${meta.enviadas.length}` }));
      });
      return;
    }

    if ((u.searchParams.get("fields") ?? "").includes("username")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ username: "quem_tocou", name: "Quem tocou na pergunta" }));
      return;
    }

    meta.desconhecidos.push(`${req.method} ${u.pathname}?${u.searchParams.toString()}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa não conhece ${u.pathname}` } }));
  });

  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;
  process.env.META_APP_SECRET = SEGREDO;

  rota = await import("@/app/api/webhook/route");
  ig = await import("@/lib/ig");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois — a mesma guarda dos outros
  // caminhos, pela mesma razão. Sem o desvio, o envio deste teste sairia para
  // `graph.instagram.com` com um token inventado.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste falaria ` +
        `com a Meta de verdade.`
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_webhook",
    name: "Conta do webhook",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  delete process.env.META_APP_SECRET;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada: as decisões são todas da rota e do motor.
// ---------------------------------------------------------------------------

async function semearAbertura(nome: string, texto: string): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type, steps, ligacoes)
       values ($1, $2, true, '{abertura}'::text[], '{}'::text[], 'any',
               $3::text::jsonb, '[]'::jsonb)
       returning id`,
      [CONTA, nome, JSON.stringify([{ id: "b_webhk01", tipo: "dm", texto }])]
    )) as { id: string }[];
  return linhas[0].id;
}

async function contatosDe(igId: string) {
  return (await banco
    .db()
    .sql()
    .query(
      `select account_id, last_automation_id, username from contacts where ig_id = $1`,
      [igId]
    )) as { account_id: string; last_automation_id: string | null; username: string | null }[];
}

async function eventos(tipo: string): Promise<Record<string, unknown>[]> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select payload from events where account_id = $1 and type = $2 order by created_at asc`,
      [CONTA, tipo]
    )) as { payload: Record<string, unknown> }[];
  return linhas.map((l) => l.payload);
}

/**
 * O POST da Meta, do jeito que ele chega: corpo CRU, assinado com HMAC-SHA256
 * sobre esse mesmo texto — nunca sobre o objeto reserializado, que muda espaços
 * e ordem de chaves e faz a assinatura não bater nunca.
 *
 * `assinarCom` é parâmetro por causa de um caso só, e é o caso que prova que
 * esta fronteira é de verdade.
 */
async function postarNoWebhook(
  messaging: unknown[],
  assinarCom: string = SEGREDO
): Promise<{ status: number; corpo: string; depois: number }> {
  const corpoCru = JSON.stringify({
    object: "instagram",
    entry: [{ id: CONTA, time: Date.now(), messaging }],
  });
  const assinatura =
    "sha256=" + createHmac("sha256", assinarCom).update(corpoCru, "utf8").digest("hex");

  const { valor, depois } = await comoNumaRequisicao("/api/webhook", async () => {
    const { NextRequest } = await import("next/server");
    const requisicao = new NextRequest("https://exemplo.invalid/api/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": assinatura,
      },
      body: corpoCru,
    });
    const resposta = await rota.POST(requisicao);
    return { status: resposta.status, corpo: await resposta.text() };
  });

  return { ...valor, depois };
}

// ---------------------------------------------------------------------------

describe("a rota do webhook, do corpo assinado até a DM no fio", () => {
  const BOAS_VINDAS = "Que bom te ver por aqui! 👋";
  let AUTOMACAO = "";

  beforeAll(async () => {
    AUTOMACAO = await semearAbertura("A porta pela rota", BOAS_VINDAS);
  });

  test("um POST assinado com postback atravessa a rota e abre a porta de entrada", async () => {
    const QUEM_TOCOU = "9400000000000001";
    expect(await contatosDe(QUEM_TOCOU)).toEqual([]);

    const { status, corpo, depois } = await postarNoWebhook([
      {
        sender: { id: QUEM_TOCOU },
        recipient: { id: CONTA },
        timestamp: Date.now(),
        postback: {
          mid: "mid-pela-rota-1",
          title: "Quero saber mais",
          payload: payloadDaPergunta(AUTOMACAO),
        },
      },
    ]);

    // 1) A ROTA RESPONDEU O QUE A META ESPERA. Qualquer outra coisa e a Meta
    //    reenvia o evento em laço.
    expect(status).toBe(200);
    expect(corpo).toBe("ok");

    // 2) O DESPACHO FOI PARA O MOTOR — é esta a linha que não tinha rede. Se
    //    alguém trocar o literal `"motor"` por `"registrar"`, o contato não
    //    nasce e o evento vira `webhook_messaging_nao_tratado`.
    const contatos = await contatosDe(QUEM_TOCOU);
    expect(contatos.length, "o postback não chegou ao motor").toBe(1);
    expect(contatos[0].account_id).toBe(CONTA);
    expect(contatos[0].last_automation_id).toBe(AUTOMACAO);
    expect(contatos[0].username).toBe("quem_tocou");

    // 3) E NÃO CAIU NO REGISTRO DE "NÃO ENTENDI". As duas metades, porque só a
    //    de cima não distingue "foi ao motor" de "foi aos dois".
    expect(await eventos("webhook_messaging_nao_tratado")).toEqual([]);
    expect((await eventos("abertura")).length).toBe(1);

    // 4) O `after()` DO FIM DA ROTA RODOU, e a DM saiu no fio. Esta é a última
    //    linha do handler — a que estourava com "waitUntil is not available" e
    //    que fazia parecer que a rota não era alcançável por teste nenhum.
    expect(depois, "o after() da rota não entregou trabalho nenhum").toBeGreaterThan(0);
    expect(meta.enviadas.map((e) => e.texto)).toEqual([BOAS_VINDAS]);
    expect(meta.enviadas[0].destinatario).toBe(QUEM_TOCOU);

    expect(meta.desconhecidos).toEqual([]);
  });

  test("forma desconhecida atravessa a mesma rota e vira linha em Atividade", async () => {
    // O outro lado do despacho, e ele é a contra-prova do caso acima: sem este,
    // trocar o literal do primeiro `if` para `"registrar"` mataria o motor e
    // NADA afirmaria que o ramo de registro continua sendo o ramo de registro.
    const { status } = await postarNoWebhook([
      {
        sender: { id: "9400000000000002" },
        recipient: { id: CONTA },
        timestamp: Date.now(),
        // `referral` é a forma que o experimento de primeiro contato espera e
        // que ainda não tem tratamento — o padrão é registrar.
        referral: { ref: "uma-forma-que-ainda-nao-tem-nome", source: "IGME" },
      },
    ]);

    expect(status).toBe(200);
    const registrados = await eventos("webhook_messaging_nao_tratado");
    expect(registrados.length).toBe(1);
    expect((registrados[0].referral as { ref?: string })?.ref).toBe(
      "uma-forma-que-ainda-nao-tem-nome"
    );

    expect(meta.desconhecidos).toEqual([]);
  });

  test("confirmação de leitura atravessa a rota e NÃO vira linha", async () => {
    // O terceiro ramo do despacho. Ele já tem caso puro em
    // `tests/webhook-messaging.test.ts`; o que este mede é a FIAÇÃO — que o
    // `continue` do ramo `"ignorar"` continua sendo um `continue`, e não uma
    // queda para o registro logo abaixo.
    const antes = (await eventos("webhook_messaging_nao_tratado")).length;

    const { status } = await postarNoWebhook([
      {
        sender: { id: "9400000000000003" },
        recipient: { id: CONTA },
        timestamp: Date.now(),
        read: { mid: "mid-lido-1" },
      },
    ]);

    expect(status).toBe(200);
    expect((await eventos("webhook_messaging_nao_tratado")).length).toBe(antes);

    expect(meta.desconhecidos).toEqual([]);
  });

  test("assinatura que não confere é 401, e nada do corpo acontece", async () => {
    // A FRONTEIRA É DE VERDADE, e este caso é o que dá aos outros três o direito
    // de dizer que a atravessaram. Sem ele, uma conferência que tivesse parado
    // de conferir deixaria todos os três verdes.
    const NINGUEM = "9400000000000004";

    const { status } = await postarNoWebhook(
      [
        {
          sender: { id: NINGUEM },
          recipient: { id: CONTA },
          timestamp: Date.now(),
          postback: {
            mid: "mid-sem-assinatura-1",
            title: "Quero saber mais",
            payload: payloadDaPergunta(AUTOMACAO),
          },
        },
      ],
      "esta-nao-e-a-chave-deste-install"
    );

    expect(status).toBe(401);
    // O corpo NÃO foi processado: sem contato, sem automação, sem linha nenhuma
    // sob a conta. O único rastro é `signature_mismatch`, que a rota grava com
    // janela e sem conta — é isso que o dono lê para descobrir que a chave está
    // errada, em vez de "não chega nada".
    expect(await contatosDe(NINGUEM)).toEqual([]);
    const recusas = (await banco
      .db()
      .sql()
      .query(`select count(*)::int as n from events where type = 'signature_mismatch'`)) as {
      n: number;
    }[];
    expect(recusas[0].n).toBeGreaterThan(0);

    expect(meta.desconhecidos).toEqual([]);
  });
});
