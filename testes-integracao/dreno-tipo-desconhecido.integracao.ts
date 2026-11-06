// O DRENO NÃO PEGA UM TIPO QUE NÃO CONHECE (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// O PROBLEMA, medido no 56cd72a: a seleção do dreno (lib/queue-drain.ts, `drainQueue`) pegava QUALQUER
// linha pendente, sem olhar o tipo, e um tipo que o código não conhece caía no caminho das mensagens. E o
// rodapé armava o próximo tique pelo `min(not_before)` de TODAS as pendentes: uma linha de tipo
// desconhecido, vencida e nunca drenada, armaria um tique a cada 20 segundos, sem fim, e esgotaria a cota
// do QStash — que cala os tiques do produto inteiro (o cabeçalho de tique-do-rodape.integracao.ts).
//
// QUANDO ISSO ACONTECE: o banco é um só para a produção e para os previews. Um preview de uma entrega nova
// (o LinkedIn) grava um tipo novo na fila, e o dreno da produção, com o código de hoje, roda a cada
// webhook, a cada tique e no cron. A lista do que o dreno conhece mora em lib/fila-tipos.ts.
//
// O TIPO NOVO DESTE ARQUIVO É INVENTADO (`tipo_do_futuro`), e o `queue_kind_check` do schema descartável é
// alargado só para ele: nada aqui depende do LinkedIn existir.
//
// SEM REDE: a conta das linhas não existe, então a linha de tipo conhecido sai como `skipped` ("conta não
// conectada") antes de qualquer chamada. A Meta falsa conta pedidos, e a conta tem de ser zero.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { TIPOS_QUE_O_DRENO_CONHECE } from "@/lib/fila-tipos";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const CONTA_QUE_NAO_EXISTE = "17800000000006601";
const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-o-teste";
const APP_URL = "https://exemplo.invalid";
const TIPO_NOVO = "tipo_do_futuro";

let publicados: string[] = [];
let pedidosAMeta = 0;
let servidorQstash: Server;
let servidorMeta: Server;
let dreno: ModuloDreno;
let qstash: ModuloQstash;

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
  servidorMeta = createServer((req: IncomingMessage, res: ServerResponse) => {
    pedidosAMeta++;
    req.resume();
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "nenhum caso deste arquivo fala com a Meta" } }));
  });
  await new Promise<void>((pronto) => servidorQstash.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  process.env.QSTASH_URL = `http://127.0.0.1:${(servidorQstash.address() as AddressInfo).port}`;
  process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${(servidorMeta.address() as AddressInfo).port}`;

  dreno = await import("@/lib/queue-drain");
  qstash = await import("@/lib/qstash");

  // A TRAVA DO INSTRUMENTO, a mesma de tique-do-rodape.integracao.ts: um tique de prova tem de chegar ao
  // QStash falso. Sem isso, "nenhum tique" passaria por engano com o QStash desligado.
  if (!qstash.qstashEnabled()) throw new Error("RECUSADO: qstashEnabled() falso com a QSTASH_TOKEN posta.");
  publicados = [];
  await qstash.scheduleTick(APP_URL, 60);
  if (publicados.length !== 1) {
    throw new Error(`RECUSADO: o tique de prova não chegou ao QStash falso (chegaram ${publicados.length}).`);
  }

  await banco.db().updateConfig({ app_url: APP_URL });

  // UMA CONTA QUE EXISTE, e só para o dreno trabalhar: sem nenhuma conta, `drainQueue` volta logo no
  // começo, sem olhar a fila, e todo caso daqui passaria por engano (medido no ensaio, 06/11/2026). As
  // linhas dos casos ficam noutra conta, que não existe, para nada chamar a rede.
  await banco.db().upsertAccount({
    ig_user_id: "17800000000006602",
    username: "conta_do_tipo_novo",
    name: "conta_do_tipo_novo",
    profile_picture_url: null,
    access_token: "token-da-conta-que-nao-vale-nada",
    token_expires_at: null,
  });

  // O schema descartável ganha o tipo inventado, além dos de hoje.
  const tipos = [...TIPOS_QUE_O_DRENO_CONHECE, TIPO_NOVO].map((t) => `'${t}'`).join(",");
  await banco.db().sql().query(`alter table queue drop constraint queue_kind_check`);
  await banco.db().sql().query(`alter table queue add constraint queue_kind_check check (kind in (${tipos}))`);
});

afterAll(async () => {
  delete process.env.QSTASH_URL;
  delete process.env.QSTASH_TOKEN;
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidorQstash.close(() => pronto()));
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  publicados = [];
  pedidosAMeta = 0;
});

/** Uma linha pendente, vencida há um minuto, na conta que não existe. */
async function semear(kind: string, chave: string): Promise<string> {
  const [linha] = (await banco.db().sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
     values ($1, $2, '{}'::jsonb, $3, now() - interval '1 minute')
     returning id`,
    [CONTA_QUE_NAO_EXISTE, kind, chave]
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

describe("o dreno e um tipo que ele não conhece", () => {
  test("a linha de tipo desconhecido fica pending e intocada, e a de tipo conhecido sai", async () => {
    const nova = await semear(TIPO_NOVO, "chave-do-tipo-novo");
    const conhecida = await semear("dm_manual", "chave-do-tipo-conhecido");
    const antes = await linha(nova);

    await dreno.drainQueue();

    const depois = await linha(nova);
    expect(depois.status).toBe("pending");
    expect(depois.attempts).toBe(0);
    expect(depois.claimed_at).toBeNull();
    expect(depois.error).toBeNull();
    expect(depois.not_before.getTime()).toBe(antes.not_before.getTime());

    const outra = await linha(conhecida);
    expect(outra.status).toBe("skipped");
    expect(outra.attempts).toBe(1);
    expect(pedidosAMeta).toBe(0);
  });

  test("o rodapé não arma tique por uma linha de tipo desconhecido", async () => {
    await semear(TIPO_NOVO, "chave-do-tipo-novo-sozinha");

    await dreno.drainQueue();

    expect(publicados).toEqual([]);
    expect(pedidosAMeta).toBe(0);
  });

  test("o rodapé continua armando o tique por uma linha de tipo conhecido para daqui a pouco", async () => {
    await banco.db().sql().query(
      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
       values ($1, 'dm_manual', '{}'::jsonb, 'chave-para-daqui-a-pouco', now() + interval '10 minutes')`,
      [CONTA_QUE_NAO_EXISTE]
    );

    await dreno.drainQueue();

    expect(publicados.length).toBe(1);
  });
});
