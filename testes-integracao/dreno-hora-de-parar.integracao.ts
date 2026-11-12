// A HORA DE PARAR DO DRENO (a 3a-0; os achados 223 e 224; scratchpad/desenho-223.md, P1).
//
// O PROBLEMA, medido na e2949fb: o laço do dreno (lib/queue-drain.ts, `drainQueue`) percorre até 15 linhas já
// reivindicadas, e só o post do LinkedIn olha o relógio. Depois de uma passada longa dele, o resto do lote começava sem
// olhar o tempo que sobrava, e a função de 60 s podia ser cortada no meio de uma mensagem, que então sairia em dobro.
//
// A REGRA: nada começa depois da hora de parar (o começo da função + 55 s − 15 s = 40 s; `jaPassouDaHoraDeParar`,
// lib/fila-tipos.ts). O dreno que começa depois dela não reivindica nada e só arma o tique. No laço, o item da vez e
// todos os que faltam voltam à fila num `update` só: `pending`, sem gastar a tentativa, com o `error` de antes, e o
// rodapé arma o tique. Uma linha vai ao registro, só com a contagem e os tipos.
//
// A MAQUINARIA: o QStash, a Meta e o LinkedIn são falsos, no loopback. O relógio é o da função: os casos passam ao
// dreno um começo no passado (`inicioDaFuncaoMs`), e o LinkedIn falso demora o bastante para a hora de parar chegar
// durante o post dele. **NADA AQUI FALA COM A META NEM COM O LINKEDIN DE VERDADE.**
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { textoDaDevolucao } from "@/lib/fila-tipos";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const CONTA = "17800000000022301";
const CONTATO = "17800000000022399";
const TOKEN_DA_CONTA = "token-da-conta-da-hora-de-parar-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDaHoraDePararQueNaoValeNada";
const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-a-hora-de-parar";
const APP_URL = "https://exemplo.invalid";

const qstash = { publicados: [] as string[] };
const meta = { textos: [] as string[], desconhecidos: [] as string[] };
const linkedin = { pedidos: [] as string[], atrasoMs: 0, durante: null as null | (() => Promise<void>) };

let servidorQstash: Server;
let servidorMeta: Server;
let servidorLinkedin: Server;
let dreno: ModuloDreno;
let moduloQstash: ModuloQstash;

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

async function corpoDe(req: IncomingMessage): Promise<string> {
  const pedacos: Buffer[] = [];
  for await (const parte of req) pedacos.push(parte as Buffer);
  return Buffer.concat(pedacos).toString("utf8");
}

beforeAll(async () => {
  servidorQstash = createServer(async (req, res) => {
    await corpoDe(req);
    if (req.method === "POST" && (req.url ?? "").startsWith("/v2/publish/")) {
      qstash.publicados.push(req.url ?? "");
      return responder(res, 200, { messageId: `msg-${qstash.publicados.length}` });
    }
    responder(res, 404, { error: "o qstash falso nao conhece esse caminho" });
  });
  servidorMeta = createServer(async (req, res) => {
    const corpo = await corpoDe(req);
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "POST" && u.pathname.endsWith("/messages")) {
      const lido = JSON.parse(corpo || "{}") as { message?: { text?: string } };
      meta.textos.push(lido.message?.text ?? "");
      return responder(res, 200, { message_id: `mid-${meta.textos.length}`, recipient_id: CONTATO });
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { error: { message: `o falso não conhece ${u.pathname}` } });
  });
  servidorLinkedin = createServer(async (req, res) => {
    await corpoDe(req);
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    linkedin.pedidos.push(`${req.method} ${u.pathname}`);
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      if (linkedin.durante) await linkedin.durante();
      if (linkedin.atrasoMs) await esperar(linkedin.atrasoMs);
      return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000022301" });
    }
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });
  for (const s of [servidorQstash, servidorMeta, servidorLinkedin]) {
    await new Promise<void>((pronto) => s.listen(0, "127.0.0.1", pronto));
  }
  const base = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  process.env.QSTASH_URL = base(servidorQstash);
  process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
  process.env.IG_GRAPH_BASE = base(servidorMeta);
  process.env.LINKEDIN_API_BASE = base(servidorLinkedin);

  // AS GUARDAS, ANTES DE QUALQUER DRENO: sem os desvios, este teste falaria com as redes de verdade.
  const ig = await import("@/lib/ig");
  if (ig.baseDoGraph() !== base(servidorMeta)) throw new Error("RECUSADO: a base do Graph não é a desta rodada.");
  const li = await import("@/lib/linkedin");
  if (li.basesDoLinkedin().api !== base(servidorLinkedin)) throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada.");
  moduloQstash = await import("@/lib/qstash");
  if (!moduloQstash.qstashEnabled()) throw new Error("RECUSADO: qstashEnabled() falso com a QSTASH_TOKEN posta.");
  dreno = await import("@/lib/queue-drain");

  await banco.db().updateConfig({ app_url: APP_URL });
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_hora_de_parar",
    name: "conta_da_hora_de_parar",
    profile_picture_url: null,
    access_token: TOKEN_DA_CONTA,
    token_expires_at: null,
  });
});

afterAll(async () => {
  for (const v of ["QSTASH_URL", "QSTASH_TOKEN", "IG_GRAPH_BASE", "LINKEDIN_API_BASE"]) delete process.env[v];
  for (const s of [servidorQstash, servidorMeta, servidorLinkedin]) await new Promise<void>((pronto) => s.close(() => pronto()));
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from contacts`);
  await q(`delete from linkedin_conexoes`);
  // A JANELA DE 24 H ABERTA: o contato escreveu agora há pouco.
  await q(`insert into contacts (account_id, ig_id, last_reply_at) values ($1, $2, now())`, [CONTA, CONTATO]);
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDaHoraDeParar', 'Dra. Ana Souza', $2, now() + interval '30 days')`,
    [CONTA, TOKEN_DO_LINKEDIN]
  );
  qstash.publicados = [];
  meta.textos = [];
  meta.desconhecidos = [];
  linkedin.pedidos = [];
  linkedin.atrasoMs = 0;
  linkedin.durante = null;
});

/** Uma mensagem manual vencida, para o contato da conta, com o texto dado. Cada uma nasce depois da anterior. */
async function mensagem(texto: string, extra: { attempts?: number; error?: string | null } = {}): Promise<string> {
  const [linha] = (await q(
    `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, not_before, attempts, error)
     values ($1, 'dm_manual', $2, $3, $4, now() - interval '1 minute', $5, $6)
     returning id`,
    [CONTA, CONTATO, { text: texto }, `hora-de-parar:${texto}`, extra.attempts ?? 0, extra.error ?? null]
  )) as { id: string }[];
  await esperar(5);
  return linha.id;
}

/**
 * O POST DO LINKEDIN SÓ TEXTO JÁ ADIADO UMA VEZ, que a ordem do lote põe primeiro. O `adiamentos` é semeado à mão: a
 * e2949fb não o grava (quem o grava é a 3a).
 */
async function postDoLinkedinAdiado(): Promise<string> {
  const [linha] = (await q(
    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
     values ($1, 'publicacao_linkedin', $2, 'hora-de-parar:linkedin', now() - interval '1 minute')
     returning id`,
    [CONTA, { forma: "texto", caminhos: [], texto: "O post do LinkedIn que vai primeiro", adiamentos: 1 }]
  )) as { id: string }[];
  await esperar(5);
  return linha.id;
}

type Linha = { status: string; attempts: number; error: string | null; claimed_at: Date | null; vencida: boolean };
const linha = async (id: string) =>
  (
    (await q(`select status, attempts, error, claimed_at, not_before <= now() as vencida from queue where id = $1`, [
      id,
    ])) as Linha[]
  )[0];

/** O COMEÇO DA FUNÇÃO de 39 s atrás: o LinkedIn ainda tem os 15 s do post, e a hora de parar chega durante ele. */
const haTrintaENoveSegundos = () => Date.now() - 39_000;

/** As linhas que o dreno mandou ao registro com o prefixo dele, durante a chamada. */
async function comORegistro<T>(fazer: () => Promise<T>): Promise<{ valor: T; linhas: string[] }> {
  const espiao = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const valor = await fazer();
    const linhas = espiao.mock.calls.map((c) => c.map(String).join(" ")).filter((l) => l.startsWith("[dreno]"));
    return { valor, linhas };
  } finally {
    espiao.mockRestore();
  }
}

describe("a hora de parar, antes de reivindicar", () => {
  it("o dreno que começa depois da hora de parar não pega nada: as linhas ficam como estavam, nada volta, e o tique é armado", async () => {
    const a = await mensagem("primeira");
    const b = await mensagem("segunda");
    const { valor: resumo, linhas } = await comORegistro(() => dreno.drainQueue({ inicioDaFuncaoMs: Date.now() - 41_000 }));
    for (const id of [a, b]) expect(await linha(id)).toMatchObject({ status: "pending", attempts: 0, claimed_at: null });
    expect(resumo).toMatchObject({ sent: 0, skipped: 0, failed: 0, devolvidos: 0 });
    expect(linhas).toEqual([]);
    expect(meta.textos).toEqual([]);
    expect(qstash.publicados).toHaveLength(1);
  });
});

describe("a hora de parar, no laço", () => {
  it("depois do post do LinkedIn que leva o relógio além dos 40 s, as mensagens voltam à fila sem gastar tentativa e sem tocar no error", async () => {
    const li = await postDoLinkedinAdiado();
    const a = await mensagem("a primeira mensagem");
    const b = await mensagem("a segunda mensagem", { attempts: 1, error: "a Meta não respondeu da última vez" });
    const c = await mensagem("a terceira mensagem");
    linkedin.atrasoMs = 2_000;
    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect((await linha(li)).status).toBe("sent");
    expect(await linha(a)).toMatchObject({ status: "pending", attempts: 0, error: null, vencida: true });
    expect(await linha(b)).toMatchObject({ status: "pending", attempts: 1, error: "a Meta não respondeu da última vez", vencida: true });
    expect(await linha(c)).toMatchObject({ status: "pending", attempts: 0, error: null, vencida: true });
    expect(resumo).toMatchObject({ sent: 1, devolvidos: 3 });
    expect(meta.textos).toEqual([]);
    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
    // O RODAPÉ ARMOU O TIQUE: as mensagens vencidas saem na passada seguinte.
    expect(qstash.publicados).toHaveLength(1);
  });

  it("a linha do registro diz só a contagem e os tipos: nenhum id da fila, nenhuma conta, nenhum contato e nenhum texto das mensagens", async () => {
    const ids = [await postDoLinkedinAdiado()];
    const textos = ["o texto secreto da primeira", "o texto secreto da segunda", "o texto secreto da terceira"];
    for (const t of textos) ids.push(await mensagem(t));
    linkedin.atrasoMs = 2_000;
    const { linhas } = await comORegistro(() => dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() }));
    expect(linhas).toEqual([textoDaDevolucao(["dm_manual", "dm_manual", "dm_manual"])]);
    for (const proibido of [...ids, CONTA, CONTATO, ...textos, "secreto"]) expect(linhas[0]).not.toContain(proibido);
  });

  it("a linha resgatada de sending, presa havia mais de 3 minutos, volta a pending com a tentativa de antes", async () => {
    await postDoLinkedinAdiado();
    const presa = await mensagem("a mensagem presa");
    await q(`update queue set status = 'sending', claimed_at = now() - interval '4 minutes', attempts = 2 where id = $1`, [presa]);
    linkedin.atrasoMs = 2_000;
    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect(await linha(presa)).toMatchObject({ status: "pending", attempts: 2, vencida: true });
    expect(resumo.devolvidos).toBe(1);
  });

  it("as mensagens devolvidas saem na passada seguinte, na ordem em que entraram na fila", async () => {
    await postDoLinkedinAdiado();
    await mensagem("um");
    await mensagem("dois");
    await mensagem("três");
    linkedin.atrasoMs = 2_000;
    await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect(meta.textos).toEqual([]);
    const resumo = await dreno.drainQueue();
    expect(resumo).toMatchObject({ sent: 3, devolvidos: 0 });
    expect(meta.textos).toEqual(["um", "dois", "três"]);
  }, 30_000);

  it("a devolução não ressuscita a linha que outro encerrou no meio do caminho: só volta o que ainda está em sending", async () => {
    await postDoLinkedinAdiado();
    const a = await mensagem("a primeira");
    const encerrada = await mensagem("a que outro encerrou");
    linkedin.atrasoMs = 2_000;
    // DURANTE O POST DO LINKEDIN, outro processo encerra uma das mensagens já reivindicadas.
    linkedin.durante = async () => {
      await q(`update queue set status = 'skipped', error = 'encerrada por outro' where id = $1`, [encerrada]);
    };
    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect(await linha(a)).toMatchObject({ status: "pending" });
    expect(await linha(encerrada)).toMatchObject({ status: "skipped", error: "encerrada por outro" });
    expect(resumo.devolvidos).toBe(1);
  });
});

describe("sem passar da hora de parar, o dreno é o de hoje", () => {
  it("as mensagens saem, nada volta, e não há linha de registro", async () => {
    await mensagem("um");
    await mensagem("dois");
    const { valor: resumo, linhas } = await comORegistro(() => dreno.drainQueue());
    expect(resumo).toMatchObject({ sent: 2, devolvidos: 0 });
    expect(meta.textos).toEqual(["um", "dois"]);
    expect(linhas).toEqual([]);
  }, 30_000);
});
