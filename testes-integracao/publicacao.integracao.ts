// O SÉTIMO CAMINHO DA FRENTE 2: o motor PUBLICANDO no perfil.
//
// A PROMESSA, escrita como teste: **o post só sai depois de a Meta dizer que a
// mídia está pronta, sai uma vez só, sai pela conta certa, e o arquivo só é
// apagado depois de ele estar no ar.**
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO É A ÚNICA REDE QUE VAI EXISTIR AQUI
//
// `lib/queue-drain.ts` é `server-only` e a suíte pura não o executa — é o achado
// escrito no cabeçalho dele, e ele já custou dois defeitos que passaram com
// TUDO verde: o pareamento de rótulo com payload, e o mapeamento uma linha
// abaixo. A Tarefa 4 tirou daquele arquivo tudo o que era decisão
// (`leituraDoContainer`, `cotaDePublicacao`, `lerPayloadDaPublicacao`,
// `parametrosDoContainer` — todas puras, todas com caso por saída), mas o que
// SOBRA lá é a costura: a ORDEM das chamadas, o que se grava entre elas, e o
// que NÃO se gasta. Ordem não é função pura, e é onde os defeitos desta base
// sempre sobreviveram.
//
// Os cinco plantios da Tarefa 4 são todos de costura, e é este arquivo que os
// acusa. Ele não é formalidade.
//
// -----------------------------------------------------------------------------
// A FORMA É A DE `lote.integracao.ts`, que por sua vez é a de
// `portao-link.integracao.ts` — leia aqueles cabeçalhos primeiro. Mesmo servidor
// HTTP na própria máquina, mesma `IG_GRAPH_BASE` presa ao loopback pelas duas
// travas de `baseDoGraph()` (lib/ig.ts), mesma guarda que falha ANTES de
// qualquer requisição sair.
//
// **NADA É PUBLICADO NO INSTAGRAM DE VERDADE POR ESTE ARQUIVO.** As duas pontas
// do fio são servidores desta máquina, e o `beforeAll` recusa rodar se não
// forem.
//
// -----------------------------------------------------------------------------
// A SEGUNDA PONTA É NOVA, E É O SUPABASE
//
// A publicação é o primeiro caminho do produto que fala com DOIS serviços: a
// Meta e o bucket. `limparOBucket` (lib/queue-drain.ts) apaga o objeto depois
// de o post sair, e a ORDEM entre esse apagamento e o `media_publish` é uma das
// coisas que este arquivo existe para prender — a Meta BAIXA a mídia no momento
// do `media_publish`, então apagar antes quebra a publicação.
//
// Por isso há um segundo servidor falso, e as três variáveis do bucket são
// apontadas para ele. **Nenhuma credencial de verdade entra aqui**: a chave é
// uma string inventada, e o `beforeAll` confere que a `SUPABASE_URL` é loopback
// antes de qualquer coisa — a mesma trava do Graph, escrita à mão porque
// `lib/bucket.ts` não tem uma `baseDoGraph()` para herdar.
//
// AS DUAS PONTAS ESCREVEM NA MESMA LINHA DO TEMPO (`linhaDoTempo`), e é isso que
// permite dizer "o apagamento veio DEPOIS do media_publish" em vez de só "os
// dois aconteceram".
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");
type ModuloDreno = typeof import("@/lib/queue-drain");

const banco = bancoDescartavel();

const CONTA_A = "17800000000000901";
const CONTA_B = "17800000000000902";
// Valores inventados. Nenhuma credencial de verdade entra em teste — e os dois
// servidores falsos conferem que foi ESTE token que chegou neles.
const TOKEN_A = "token-da-conta-a-que-nao-vale-nada";
const TOKEN_B = "token-da-conta-b-que-nao-vale-nada";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";

// ---------------------------------------------------------------------------
// A LINHA DO TEMPO — a coisa mais importante deste arquivo.
//
// Cada requisição que chega em qualquer das duas pontas escreve aqui. Três dos
// cinco plantios da Tarefa 4 são de ORDEM, e ordem não se prova contando
// chamadas: prova-se lendo a sequência.
// ---------------------------------------------------------------------------
let linhaDoTempo: string[] = [];

const meta = {
  /** Os `POST /media` que chegaram, com a conta e o token de cada um. */
  containers: [] as { igUserId: string; token: string; params: Record<string, string> }[],
  /** Os `POST /media_publish`, idem. */
  publicacoes: [] as { igUserId: string; token: string; creationId: string }[],
  /** Os `GET` de estado, pelo id do contêiner. */
  consultas: [] as string[],
  /** As mensagens de DM — só o caso do teto horário as usa. */
  mensagens: [] as string[],
  desconhecidos: [] as string[],
  /** O `status_code` que a próxima consulta de estado vai devolver. */
  proximoStatus: "FINISHED" as string,
  /** A frase que acompanha o estado, quando o caso quer uma. */
  proximoStatusTexto: null as string | null,
  /** A cota que `content_publishing_limit` devolve. */
  cota: { quota_total: 100, quota_duration: 86400, quota_usage: 0 },
};

const bucketFalso = {
  /** Os caminhos que o `DELETE` pediu para apagar. */
  apagados: [] as string[],
  /** Caminhos que o bucket falso recusa com 500 — para o caso do apagamento
   *  que falha sem derrubar o post. */
  recusar: new Set<string>(),
};

let servidorMeta: Server;
let servidorBucket: Server;
let engine: ModuloEngine;
let ig: ModuloIg;
let dreno: ModuloDreno;

function responderJson(res: ServerResponse, corpo: unknown) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(corpo));
}

function corpoDe(req: IncomingMessage): Promise<string> {
  return new Promise((pronto) => {
    const pedacos: Buffer[] = [];
    req.on("data", (d: Buffer) => pedacos.push(d));
    req.on("end", () => pronto(Buffer.concat(pedacos).toString("utf8")));
  });
}

beforeAll(async () => {
  // -------------------------------------------------------------------------
  // A META FALSA
  // -------------------------------------------------------------------------
  servidorMeta = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const token = u.searchParams.get("access_token") ?? "";
    // O caminho é `/v25.0/{alguma coisa}`; o que interessa é o último segmento
    // e o penúltimo (que é a conta, quando existe).
    const partes = u.pathname.split("/").filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? "";
    const penultimo = partes[partes.length - 2] ?? "";

    if (req.method === "POST" && ultimo === "media") {
      const params = Object.fromEntries(new URLSearchParams(await corpoDe(req)));
      meta.containers.push({ igUserId: penultimo, token, params });
      linhaDoTempo.push("criou-container");
      return responderJson(res, { id: `container-${meta.containers.length}` });
    }

    if (req.method === "POST" && ultimo === "media_publish") {
      const params = new URLSearchParams(await corpoDe(req));
      meta.publicacoes.push({
        igUserId: penultimo,
        token,
        creationId: params.get("creation_id") ?? "",
      });
      linhaDoTempo.push("publicou");
      return responderJson(res, { id: `media-${meta.publicacoes.length}` });
    }

    if (req.method === "GET" && ultimo === "content_publishing_limit") {
      linhaDoTempo.push("perguntou-a-cota");
      return responderJson(res, {
        config: { quota_total: meta.cota.quota_total, quota_duration: meta.cota.quota_duration },
        quota_usage: meta.cota.quota_usage,
      });
    }

    if (req.method === "POST" && ultimo === "messages") {
      const corpo = JSON.parse(await corpoDe(req)) as { recipient: { id?: string } };
      meta.mensagens.push(corpo.recipient.id ?? "");
      linhaDoTempo.push("mandou-dm");
      return responderJson(res, { message_id: `mid-${meta.mensagens.length}`, recipient_id: "r-1" });
    }

    // O estado do contêiner: `GET /{container-id}?fields=status_code,status`.
    if (req.method === "GET" && (u.searchParams.get("fields") ?? "").includes("status_code")) {
      meta.consultas.push(ultimo);
      linhaDoTempo.push("perguntou-o-estado");
      return responderJson(res, {
        id: ultimo,
        status_code: meta.proximoStatus,
        ...(meta.proximoStatusTexto ? { status: meta.proximoStatusTexto } : {}),
      });
    }

    meta.desconhecidos.push(`${req.method} ${u.pathname}?${u.searchParams.toString()}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa nao conhece ${u.pathname}` } }));
  });

  // -------------------------------------------------------------------------
  // O BUCKET FALSO — só o `DELETE`, que é a única chamada que o dreno faz.
  // -------------------------------------------------------------------------
  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const prefixo = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(prefixo)) {
      // A CHAVE É CONFERIDA, e não ignorada: `lib/bucket.ts` manda `apikey` e
      // `Authorization`, e faltando uma o Supabase de verdade responde 401 sem
      // dizer qual. Um teste que aceitasse qualquer coisa não acusaria isso.
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET_FALSO) {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "sem apikey" }));
      }
      const caminho = decodeURIComponent(u.pathname.slice(prefixo.length));
      if (bucketFalso.recusar.has(caminho)) {
        linhaDoTempo.push("bucket-recusou");
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "o bucket falso recusou de proposito" }));
      }
      bucketFalso.apagados.push(caminho);
      linhaDoTempo.push("apagou-o-arquivo");
      return responderJson(res, { message: "ok" });
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "o bucket falso nao conhece esse caminho" }));
  });

  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorBucket.listen(0, "127.0.0.1", pronto));
  const portaMeta = (servidorMeta.address() as AddressInfo).port;
  const portaBucket = (servidorBucket.address() as AddressInfo).port;

  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${portaMeta}`;
  process.env.SUPABASE_URL = `http://127.0.0.1:${portaBucket}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET_FALSO;
  process.env.SUPABASE_BUCKET = BUCKET;
  // A SEGUNDA FRONTEIRA, herdada de `gatilho-entrega`: sem token, `scheduleTick`
  // não sai da máquina. Este arquivo deixa item pendente de propósito.
  delete process.env.QSTASH_TOKEN;

  engine = await import("@/lib/engine");
  ig = await import("@/lib/ig");
  dreno = await import("@/lib/queue-drain");

  // AS DUAS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO — e não depois.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph e ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste tentaria ` +
        `PUBLICAR no Instagram de verdade.`
    );
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error(
      "RECUSADO: a SUPABASE_URL desta rodada nao e loopback. Sem isso, este " +
        "teste apagaria arquivos do bucket de verdade."
    );
  }

  for (const [conta, token, nome] of [
    [CONTA_A, TOKEN_A, "conta_a"],
    [CONTA_B, TOKEN_B, "conta_b"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: conta,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: token,
      token_expires_at: null,
    });
  }
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
  await new Promise<void>((pronto) => servidorBucket.close(() => pronto()));
});

// Cada caso começa com a fila vazia e a linha do tempo em branco: o que este
// arquivo mede é SEQUÊNCIA, e sobra de um caso anterior faria a sequência do
// seguinte mentir.
beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  linhaDoTempo = [];
  meta.containers = [];
  meta.publicacoes = [];
  meta.consultas = [];
  meta.mensagens = [];
  meta.desconhecidos = [];
  meta.proximoStatus = "FINISHED";
  meta.proximoStatusTexto = null;
  meta.cota = { quota_total: 100, quota_duration: 86400, quota_usage: 0 };
  bucketFalso.apagados = [];
  bucketFalso.recusar = new Set();
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------

async function drenar() {
  return dreno.drainQueue();
}

/** O relógio anda: o que estava esperando o backoff passa a estar na hora. */
async function passarOTempo() {
  await banco
    .db()
    .sql()
    .query(`update queue set not_before = now() - interval '1 minute' where status = 'pending'`);
}

type LinhaDaFila = {
  status: string;
  error: string | null;
  payload: Record<string, unknown>;
  account_id: string | null;
  contact_ig_id: string | null;
  no_futuro: boolean;
};

async function itemDaFila(): Promise<LinhaDaFila> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select status, error, payload, account_id, contact_ig_id,
              (not_before > now()) as no_futuro
         from queue where kind = 'publicacao'
        order by created_at desc, id desc limit 1`
    )) as LinhaDaFila[];
  return linhas[0];
}

async function semearContato(conta: string, igId: string) {
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, username, last_reply_at)
       values ($1, $2, 'pessoa_de_teste', now() - interval '1 hour')
       on conflict (account_id, ig_id) do update set last_reply_at = excluded.last_reply_at`,
      [conta, igId]
    );
}

/** Linhas `sent` na última hora, para encostar a conta no teto horário. */
async function semearEnviadosNaUltimaHora(conta: string, kind: string, quantas: number) {
  await banco
    .db()
    .sql()
    .query(
      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
       select $1, $2, '{}'::jsonb, $3 || ':' || g, 'sent',
              now() - interval '10 minutes', now() - interval '10 minutes'
         from generate_series(1, $4::int) g`,
      [conta, kind, `teto-${kind}-${Date.now()}`, quantas]
    );
}

// ---------------------------------------------------------------------------

describe("o motor publica no perfil, e na ordem certa", () => {
  test("o caminho inteiro: cria o container, ve FINISHED, publica, e SO ENTAO apaga o arquivo", async () => {
    const caminho = `${CONTA_A}/um.jpg`;
    expect(await engine.enqueuePublicacao(CONTA_A, { forma: "imagem", caminhos: [caminho] }, null)).toBe(true);

    await drenar();

    // A SEQUÊNCIA INTEIRA, e não uma contagem de chamadas. É ela que prende
    // três dos cinco plantios de uma vez: publicar sem esperar o estado,
    // publicar sem perguntar a cota, e apagar o arquivo antes do post existir.
    expect(linhaDoTempo).toEqual([
      "criou-container",
      "perguntou-o-estado",
      "perguntou-a-cota",
      "publicou",
      "apagou-o-arquivo",
    ]);

    const item = await itemDaFila();
    expect(item.status).toBe("sent");
    expect(item.payload.container_id).toBe("container-1");
    expect(item.payload.media_id).toBe("media-1");
    // PUBLICAÇÃO NÃO TEM CONTATO: a coluna fica nula, e é por consequência
    // disso que o despertar do lote, a janela de 24h e as variáveis de texto
    // não alcançam este item.
    expect(item.contact_ig_id).toBeNull();
    expect(bucketFalso.apagados).toEqual([caminho]);
    expect(meta.desconhecidos).toEqual([]);
  });

  test("o container NAO nasce no enfileiramento, mesmo com o post agendado", async () => {
    // O PLANTIO MAIS IMPORTANTE DO PROJETO, medido do lado de fora.
    //
    // O contêiner da Meta vence em 24 HORAS. Criá-lo no `enqueuePublicacao`
    // faria este post — agendado para daqui a três dias — chegar na hora com
    // `EXPIRED`: falha CALADA, e só para quem agenda longe. Quem escreve o
    // recurso testa "publicar agora", que continuaria funcionando.
    const daquiATresDias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "imagem", caminhos: [`${CONTA_A}/agendado.jpg`] },
      daquiATresDias
    );

    // NENHUMA IDA À META. Nem contêiner, nem estado, nem cota.
    expect(linhaDoTempo).toEqual([]);
    expect(meta.containers).toEqual([]);

    const item = await itemDaFila();
    expect(item.status).toBe("pending");
    expect(item.no_futuro).toBe(true);
    expect(item.payload.container_id).toBeUndefined();

    // E QUANDO A HORA CHEGA, o contêiner nasce ali, novo.
    await passarOTempo();
    await drenar();
    expect(meta.containers.length).toBe(1);
    expect((await itemDaFila()).status).toBe("sent");
  });

  test("IN_PROGRESS devolve o item a fila SEM recriar o container", async () => {
    meta.proximoStatus = "IN_PROGRESS";
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "reels", caminhos: [`${CONTA_A}/video.mp4`] },
      null
    );

    const primeira = await drenar();
    expect(primeira.aguardando).toBe(1);
    expect(primeira.sent).toBe(0);
    // NÃO PUBLICOU. É o segundo plantio: publicar sem esperar `FINISHED`.
    expect(meta.publicacoes).toEqual([]);

    const esperando = await itemDaFila();
    expect(esperando.status).toBe("pending");
    // O BACKOFF É DE VERDADE: o item não volta na mesma drenagem.
    expect(esperando.no_futuro).toBe(true);
    expect(esperando.payload.container_id).toBe("container-1");
    expect(esperando.payload.consultas).toBe(1);

    // A SEGUNDA PASSADA REUSA O CONTÊINER. Sem isto, cada passada criaria um
    // contêiner novo, a Meta baixaria o vídeo de novo, e o teto de 400
    // contêineres por dia seria gasto por engano.
    await passarOTempo();
    meta.proximoStatus = "FINISHED";
    await drenar();

    expect(meta.containers.length).toBe(1);
    expect(meta.publicacoes).toEqual([
      { igUserId: CONTA_A, token: TOKEN_A, creationId: "container-1" },
    ]);
    expect((await itemDaFila()).status).toBe("sent");
  });

  test("o teto de cinco passadas termina em failed, e nunca publica", async () => {
    meta.proximoStatus = "IN_PROGRESS";
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "reels", caminhos: [`${CONTA_A}/eterno.mp4`] },
      null
    );

    // Cinco drenagens: a quinta consulta é a que desiste.
    for (let i = 0; i < 5; i++) {
      await passarOTempo();
      await drenar();
    }

    const item = await itemDaFila();
    expect(item.status).toBe("failed");
    expect(item.error).toContain("nao terminou de processar");
    expect(meta.consultas.length).toBe(5);
    expect(meta.containers.length).toBe(1);
    expect(meta.publicacoes).toEqual([]);

    // E ELE NÃO VOLTA. Sem o teto, o item giraria para sempre — uma
    // reivindicação por minuto, uma ida de rede por passada, e nenhum desfecho.
    await passarOTempo();
    await drenar();
    expect(meta.consultas.length).toBe(5);
  });

  test("estado desconhecido termina em failed, e NAO em espera", async () => {
    meta.proximoStatus = "VAI_SABER";
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "imagem", caminhos: [`${CONTA_A}/estranho.jpg`] },
      null
    );

    const r = await drenar();
    expect(r.failed).toBe(1);
    expect(r.aguardando).toBe(0);

    const item = await itemDaFila();
    expect(item.status).toBe("failed");
    expect(meta.publicacoes).toEqual([]);
    // O ARQUIVO FICA. Quem for tentar de novo precisa dele — objeto de item
    // falhado não é órfão.
    expect(bucketFalso.apagados).toEqual([]);
  });

  test("ERROR carrega a frase da Meta para a tela de Envios", async () => {
    meta.proximoStatus = "ERROR";
    meta.proximoStatusTexto = "Error: The video format is not supported";
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "reels", caminhos: [`${CONTA_A}/codec.mp4`] },
      null
    );

    await drenar();
    const item = await itemDaFila();
    expect(item.status).toBe("failed");
    expect(item.error).toContain("The video format is not supported");
  });

  test("o post da conta A nao sai pela conta B", async () => {
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "imagem", caminhos: [`${CONTA_A}/da-conta-a.jpg`] },
      null
    );
    await drenar();

    // O CAMINHO E O TOKEN, os dois. O caminho sozinho não bastaria: um dreno
    // que pegasse a conta certa e o token errado publicaria pela conta de quem
    // fosse dono daquele token.
    expect(meta.containers.map((c) => c.igUserId)).toEqual([CONTA_A]);
    expect(meta.containers.map((c) => c.token)).toEqual([TOKEN_A]);
    expect(meta.publicacoes.map((p) => p.igUserId)).toEqual([CONTA_A]);
    expect(meta.publicacoes.map((p) => p.token)).toEqual([TOKEN_A]);
    expect(JSON.stringify(meta.containers)).not.toContain(CONTA_B);
    expect(JSON.stringify(meta.containers)).not.toContain(TOKEN_B);
  });

  test("a cota estourada ADIA o post, e nao o mata", async () => {
    meta.cota = { quota_total: 100, quota_duration: 86400, quota_usage: 100 };
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "imagem", caminhos: [`${CONTA_A}/na-fila-da-cota.jpg`] },
      null
    );

    const r = await drenar();
    expect(r.failed).toBe(0);
    expect(r.aguardando).toBe(1);
    expect(meta.publicacoes).toEqual([]);

    const item = await itemDaFila();
    // `pending`, E NÃO `failed`: a publicação não deu errado, ela ainda não
    // pode acontecer. E o motivo fica escrito, para a tela poder dizê-lo.
    expect(item.status).toBe("pending");
    expect(item.error).toContain("cota");
    expect(item.no_futuro).toBe(true);

    // A COTA VIRA, E O POST SAI. Nada precisou ser reenfileirado.
    meta.cota = { quota_total: 100, quota_duration: 86400, quota_usage: 3 };
    await passarOTempo();
    await drenar();
    expect((await itemDaFila()).status).toBe("sent");
    expect(meta.publicacoes.length).toBe(1);
  });

  test("payload que nao e de publicacao termina em failed com motivo escrito", async () => {
    await banco
      .db()
      .sql()
      .query(
        `insert into queue (account_id, kind, payload, dedupe_key, status, not_before)
         values ($1, 'publicacao', '{"text":"isto nao e um post"}'::jsonb, $2, 'pending', now())`,
        [CONTA_A, `pub-invalido-${Date.now()}`]
      );

    await drenar();
    const item = await itemDaFila();
    expect(item.status).toBe("failed");
    expect(item.error).toContain("nao e de publicacao");
    expect(meta.containers).toEqual([]);
  });
});

describe("a publicacao nao gasta a cota de MENSAGEM da conta", () => {
  test("o post sai mesmo com a conta no teto horario de DM", async () => {
    // 190 mensagens enviadas na última hora: a conta está bloqueada para DM.
    await semearEnviadosNaUltimaHora(CONTA_A, "dm_lote", 190);
    await engine.enqueuePublicacao(
      CONTA_A,
      { forma: "imagem", caminhos: [`${CONTA_A}/apesar-do-teto.jpg`] },
      null
    );

    await drenar();

    // SEM A EXCEÇÃO NA SELEÇÃO DO DRENO, a conta inteira ficaria de fora do
    // lote e este post não seria sequer reivindicado — um lote grande de DMs
    // leva horas para sair, e todo post agendado ficaria parado atrás dele.
    expect((await itemDaFila()).status).toBe("sent");
    expect(meta.publicacoes.length).toBe(1);
  });

  test("posts publicados NAO comem o teto das mensagens", async () => {
    // 189 mensagens + 5 posts = 194 linhas `sent` na última hora. Se a
    // publicação contasse, a conta estaria bloqueada (194 >= 190) e a DM abaixo
    // não sairia. Com o filtro, são 189 mensagens e ela sai.
    await semearEnviadosNaUltimaHora(CONTA_A, "dm_lote", 189);
    await semearEnviadosNaUltimaHora(CONTA_A, "publicacao", 5);

    const CONTATO = "9000000000000701";
    await semearContato(CONTA_A, CONTATO);
    await engine.enqueueLote(CONTA_A, "L-teto", [CONTATO], {
      text: "a resposta automatica que nao pode engasgar",
      validoAte: null,
    });

    await drenar();

    // A MENSAGEM SAIU. É o quarto plantio medido do lado de fora: se o post
    // gastasse `HOURLY_CAP`, publicar trinta posts numa manhã faria o robô
    // parar de responder, e ninguém procuraria a causa aí.
    expect(meta.mensagens).toEqual([CONTATO]);
  });
});

describe("o arquivo sai do bucket depois do post, e nunca antes", () => {
  test("o apagamento que FALHA nao derruba o post", async () => {
    const caminho = `${CONTA_A}/o-bucket-vai-recusar.jpg`;
    bucketFalso.recusar.add(caminho);
    await engine.enqueuePublicacao(CONTA_A, { forma: "imagem", caminhos: [caminho] }, null);

    await drenar();

    // O post já está no perfil. Deixar uma falha de apagamento virar `failed`
    // faria o dono ler "nao publicou" olhando para um post publicado — e faria
    // o próximo dreno publicar de novo.
    const item = await itemDaFila();
    expect(item.status).toBe("sent");
    expect(linhaDoTempo).toEqual([
      "criou-container",
      "perguntou-o-estado",
      "perguntou-a-cota",
      "publicou",
      "bucket-recusou",
    ]);

    // E A FALHA NÃO É MUDA: ela vira linha em Atividade.
    const eventos = (await banco
      .db()
      .sql()
      .query(`select type from events where type = 'midia_nao_apagada'`)) as { type: string }[];
    expect(eventos.length).toBe(1);
  });
});
