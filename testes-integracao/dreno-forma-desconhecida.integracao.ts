// O DRENO NÃO PEGA UM POST DO LINKEDIN DE FORMA QUE NÃO CONHECE (a preparação da parte 3 do LinkedIn;
// docs/plans/2026-11-11-linkedin-forma-conhecida.md).
//
// O PROBLEMA, medido no b9258ab: a seleção do dreno (lib/queue-drain.ts, `drainQueue`) pega toda linha
// `publicacao_linkedin` vencida, e o ramo dela (lib/linkedin-fila.ts, `publicarNoLinkedinDaFila`) manda a `failed`,
// por payload torto, a linha cuja forma ele não lê. O banco é um só para a produção e os previews: a parte 3 grava,
// pelo preview, posts de forma nova (o carrossel em PDF, o vídeo), e o dreno da produção, com o código de antes, os
// estragaria. Com o predicado `soAFormaConhecidaDoLinkedin` (lib/linkedin-publicacao.ts) nos quatro pontos — a
// seleção, o tique do rodapé, os tiques do dia e o "agora" —, a linha de forma nova fica `pending`, intocada, e não
// arma tique, até o código que a conhece chegar.
//
// SÓ A FORMA PRESENTE E DESCONHECIDA FICA DE FORA: a linha sem forma, ou com forma que não é texto, continua indo a
// `failed` como antes.
//
// SEM REDE: a conta existe (sem ela, o dreno volta logo no começo, e todo caso daqui passaria por engano), mas não
// tem LinkedIn conectado. A linha de forma conhecida é pega e vai a `failed` com "esta conta não tem LinkedIn
// conectado", antes de qualquer chamada. O LinkedIn e a Meta falsos contam pedidos, e a conta tem de ser zero.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");
type ModuloFila = typeof import("@/lib/linkedin-fila");

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const CONTA = "17800000000030001";
const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-o-teste-da-forma";
const APP_URL = "https://exemplo.invalid";

let publicados: string[] = [];
let pedidosDeFora = 0;
let servidorQstash: Server;
let servidorDeFora: Server;
let dreno: ModuloDreno;
let qstash: ModuloQstash;
let fila: ModuloFila;

beforeAll(async () => {
  servidorQstash = createServer((req: IncomingMessage, res: ServerResponse) => {
    const caminho = req.url ?? "/";
    req.resume();
    if (req.method === "POST" && caminho.startsWith("/v2/publish/")) {
      publicados.push(caminho);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ messageId: `msg-${publicados.length}` }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "o qstash falso nao conhece esse caminho" }));
  });
  // O LINKEDIN E A META FALSOS SÃO UM SÓ: nenhum caso deste arquivo fala com nenhum dos dois.
  servidorDeFora = createServer((req: IncomingMessage, res: ServerResponse) => {
    pedidosDeFora++;
    req.resume();
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "nenhum caso deste arquivo fala com o LinkedIn nem com a Meta" }));
  });
  await new Promise<void>((pronto) => servidorQstash.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorDeFora.listen(0, "127.0.0.1", pronto));
  const deFora = `http://127.0.0.1:${(servidorDeFora.address() as AddressInfo).port}`;
  process.env.QSTASH_URL = `http://127.0.0.1:${(servidorQstash.address() as AddressInfo).port}`;
  process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
  process.env.IG_GRAPH_BASE = deFora;
  process.env.LINKEDIN_API_BASE = deFora;

  dreno = await import("@/lib/queue-drain");
  qstash = await import("@/lib/qstash");
  fila = await import("@/lib/linkedin-fila");

  // A TRAVA DO INSTRUMENTO, a mesma de dreno-tipo-desconhecido.integracao.ts: um tique de prova tem de chegar ao
  // QStash falso. Sem isso, "nenhum tique" passaria por engano com o QStash desligado.
  if (!qstash.qstashEnabled()) throw new Error("RECUSADO: qstashEnabled() falso com a QSTASH_TOKEN posta.");
  publicados = [];
  await qstash.scheduleTick(APP_URL, 60);
  if (publicados.length !== 1) {
    throw new Error(`RECUSADO: o tique de prova não chegou ao QStash falso (chegaram ${publicados.length}).`);
  }

  await banco.db().updateConfig({ app_url: APP_URL });
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_forma_nova",
    name: "conta_da_forma_nova",
    profile_picture_url: null,
    access_token: "token-da-conta-da-forma-que-nao-vale-nada",
    token_expires_at: null,
  });
});

afterAll(async () => {
  for (const v of ["QSTASH_URL", "QSTASH_TOKEN", "IG_GRAPH_BASE", "LINKEDIN_API_BASE"]) delete process.env[v];
  await new Promise<void>((pronto) => servidorQstash.close(() => pronto()));
  await new Promise<void>((pronto) => servidorDeFora.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  await banco.db().sql().query(`delete from linkedin_conexoes`);
  publicados = [];
  pedidosDeFora = 0;
});

let semente = 0;

/** Um post do LinkedIn na conta que existe, sem conexão, com o payload como veio. */
async function semear(
  payload: unknown,
  p: { emSegundos?: number; status?: "pending" | "sending"; reivindicadoHaSegundos?: number } = {}
): Promise<string> {
  semente++;
  const [linha] = (await banco.db().sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, status, not_before, claimed_at)
     values ($1, 'publicacao_linkedin', $2, $3, $4, now() + make_interval(secs => $5::int),
             case when $6::int is null then null else now() - make_interval(secs => $6::int) end)
     returning id`,
    [CONTA, payload, `forma-${semente}`, p.status ?? "pending", p.emSegundos ?? -60, p.reivindicadoHaSegundos ?? null]
  )) as { id: string }[];
  return linha.id;
}

async function linha(id: string) {
  const [l] = (await banco.db().sql().query(
    `select status, attempts, claimed_at, error, not_before from queue where id = $1`,
    [id]
  )) as { status: string; attempts: number; claimed_at: Date | null; error: string | null; not_before: Date }[];
  return l;
}

const CARROSSEL = { forma: "carrossel", caminhos: [`${CONTA}/a.jpg`, `${CONTA}/b.jpg`], texto: "um carrossel do futuro" };
const TEXTO = { forma: "texto", caminhos: [], texto: "um post só de texto" };
const IMAGEM = { forma: "imagem", caminhos: [`${CONTA}/c.jpg`], texto: "um post com imagem" };

describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
  test("a linha de forma nova fica pending e intocada, e as de forma conhecida são pegas", async () => {
    const nova = await semear(CARROSSEL);
    const texto = await semear(TEXTO);
    const imagem = await semear(IMAGEM);
    const antes = await linha(nova);

    await dreno.drainQueue();

    const depois = await linha(nova);
    expect(depois.status).toBe("pending");
    expect(depois.attempts).toBe(0);
    expect(depois.claimed_at).toBeNull();
    expect(depois.error).toBeNull();
    expect(depois.not_before.getTime()).toBe(antes.not_before.getTime());

    for (const id of [texto, imagem]) {
      expect(await linha(id)).toMatchObject({ status: "failed", attempts: 1, error: fila.MOTIVO_SEM_CONEXAO });
    }
    expect(pedidosDeFora).toBe(0);
  });

  test("a linha sem forma, e a de forma que não é texto, continuam indo a failed por payload torto", async () => {
    const semForma = await semear({ caminhos: [], texto: "sem forma" });
    const formaNumero = await semear({ forma: 7, caminhos: [], texto: "forma número" });

    await dreno.drainQueue();

    for (const id of [semForma, formaNumero]) {
      expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_DO_PAYLOAD_TORTO });
    }
    expect(pedidosDeFora).toBe(0);
  });

  test("a linha de forma nova presa em sending há mais de 3 minutos não é retomada", async () => {
    const presa = await semear(CARROSSEL, { status: "sending", reivindicadoHaSegundos: 600 });
    const antes = await linha(presa);

    await dreno.drainQueue();

    expect(await linha(presa)).toEqual(antes);
    expect(pedidosDeFora).toBe(0);
  });

  test("o rodapé não arma tique por uma linha de forma nova vencida, que fica pending (sem isso, um tique a cada 20 s)", async () => {
    await semear(CARROSSEL);

    await dreno.drainQueue();

    expect(publicados).toEqual([]);
  });

  test("o rodapé não arma tique por uma linha de forma nova para daqui a pouco", async () => {
    await semear(CARROSSEL, { emSegundos: 600 });

    await dreno.drainQueue();

    expect(publicados).toEqual([]);
  });

  test("o rodapé continua armando o tique por uma linha de forma conhecida para daqui a pouco", async () => {
    await semear(TEXTO, { emSegundos: 600 });

    await dreno.drainQueue();

    expect(publicados.length).toBe(1);
  });

  test("os tiques do dia não contam a linha de forma nova, e contam a de forma conhecida", async () => {
    await semear(CARROSSEL, { emSegundos: 7200 });
    expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 0 });
    expect(publicados).toEqual([]);

    await semear(TEXTO, { emSegundos: 10800 });
    expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 1 });
    expect(publicados.length).toBe(1);
  });

  test("o agora não pega a linha de forma nova, e pega a de forma conhecida", async () => {
    const nova = await semear(CARROSSEL);
    const texto = await semear(TEXTO);
    const antes = await linha(nova);

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(nova)).toBeNull();
    expect(await linha(nova)).toEqual(antes);

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(texto)).toBe("falhou");
    expect(await linha(texto)).toMatchObject({ status: "failed", error: fila.MOTIVO_SEM_CONEXAO });
    expect(pedidosDeFora).toBe(0);
  });
});
