// O POST DO LINKEDIN PELA FILA (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a parte 2a: só texto e imagem,
// uma rede por post), contra o banco descartável: o enfileirar, o ramo novo do dreno, o "agora" que drena só a
// própria linha (achado 211) e a regra de nunca publicar duas vezes (achado 210).
//
// O LINKEDIN FALSO E O BUCKET FALSO: dois servidores HTTP na própria máquina. As bases do LinkedIn
// (lib/linkedin.ts) e a SUPABASE_URL vão para eles, e as guardas conferem isso ANTES de qualquer requisição. O
// `fetch` é interceptado só neste arquivo e RECUSA qualquer endereço que não seja o loopback. **NADA AQUI CHAMA
// O LINKEDIN NEM O BUCKET DE VERDADE.** Valores inventados: nenhuma credencial de verdade entra em teste.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloFila = typeof import("@/lib/linkedin-fila");
type ModuloLinkedin = typeof import("@/lib/linkedin");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA = "17800000000025001";
const PESSOA = "pessoaDoLinkedinA1";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoLinkedinDaFilaQueNaoValeNada";
const BUCKET = "midia-de-teste";
const CHAVE_DO_BUCKET = "chave-do-bucket-falso-que-nao-vale-nada";
const BYTES_DA_IMAGEM = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 0xff, 0xd9]);

type Pedido = { metodo: string; caminho: string; cabecalhos: IncomingMessage["headers"]; corpo: string };

const linkedin = {
  pedidos: [] as Pedido[],
  posts: [] as Record<string, unknown>[],
  envios: [] as Buffer[],
  /** O status do próximo POST /rest/posts; 201 é o sucesso. */
  statusDoPost: 201,
  /** Cria o post e derruba a conexão antes de responder (achado 210). */
  derrubarDepoisDoPost: false,
  /** Segura o POST até liberar: é como dois drenos ao mesmo tempo entram. */
  segurarOPost: null as null | Promise<void>,
  statusDaReserva: 200,
  desconhecidos: [] as string[],
  /** Para cada POST do post: a linha já tinha a marca `post_tentado_em` quando ele chegou? (achado 210) */
  marcadaNoPost: [] as (boolean | null)[],
  /** Chamado quando o PUT da imagem chega: é como o caso faz o relógio andar durante o envio. */
  aoEnviar: null as null | (() => void),
};
const bucket = { apagados: [] as string[], baixados: [] as string[] };

let servidorLinkedin: Server;
let servidorBucket: Server;
let dreno: ModuloDreno;
let fila: ModuloFila;
let li: ModuloLinkedin;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((pronto) => {
    const partes: Buffer[] = [];
    req.on("data", (p) => partes.push(p));
    req.on("end", () => pronto(Buffer.concat(partes)));
  });
}

beforeAll(async () => {
  servidorLinkedin = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const corpo = await lerCorpo(req);
    linkedin.pedidos.push({ metodo: req.method ?? "", caminho: u.pathname + u.search, cabecalhos: req.headers, corpo: corpo.toString() });
    const porta = (servidorLinkedin.address() as AddressInfo).port;
    if (req.method === "POST" && u.pathname === "/rest/images" && u.searchParams.get("action") === "initializeUpload") {
      if (linkedin.statusDaReserva !== 200) return responder(res, linkedin.statusDaReserva, { message: "a reserva falhou de propósito" });
      return responder(res, 200, {
        value: {
          uploadUrl: `http://127.0.0.1:${porta}/envio/C4E10AQ`,
          uploadUrlExpiresAt: 1999999999999,
          image: "urn:li:image:C4E10AQFalsa",
        },
      });
    }
    if (req.method === "PUT" && u.pathname === "/envio/C4E10AQ") {
      linkedin.envios.push(corpo);
      linkedin.aoEnviar?.();
      return responder(res, 201, "");
    }
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      // A MARCA ANTES DO POST, medida no banco no instante em que o POST chega.
      const [l] = await q(
        `select payload ? 'post_tentado_em' as marcada from queue where kind = 'publicacao_linkedin' and status = 'sending' limit 1`
      );
      linkedin.marcadaNoPost.push(l ? Boolean(l.marcada) : null);
      if (linkedin.segurarOPost) await linkedin.segurarOPost;
      if (linkedin.statusDoPost !== 201) return responder(res, linkedin.statusDoPost, { message: "o post falhou de propósito" });
      linkedin.posts.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      if (linkedin.derrubarDepoisDoPost) return void req.socket.destroy();
      // O id em texto: 7000000000000000000 + n passa do inteiro exato do JavaScript, e daria sempre o mesmo número.
      const id = `70000000000000000${String(linkedin.posts.length).padStart(2, "0")}`;
      return responder(res, 201, "", { "x-restli-id": `urn:li:share:${id}` });
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });

  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    const privado = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      bucket.baixados.push(decodeURIComponent(u.pathname.slice(publico.length)));
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(BYTES_DA_IMAGEM);
    }
    if (req.method === "DELETE" && u.pathname.startsWith(privado)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      bucket.apagados.push(decodeURIComponent(u.pathname.slice(privado.length)));
      return responder(res, 200, { message: "ok" });
    }
    responder(res, 404, { message: "o bucket falso não conhece esse caminho" });
  });

  await new Promise<void>((pronto) => servidorLinkedin.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorBucket.listen(0, "127.0.0.1", pronto));
  process.env.LINKEDIN_API_BASE = `http://127.0.0.1:${(servidorLinkedin.address() as AddressInfo).port}`;
  process.env.SUPABASE_URL = `http://127.0.0.1:${(servidorBucket.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;

  // O INTERCEPTADOR: só o loopback passa.
  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  li = await import("@/lib/linkedin");
  dreno = await import("@/lib/queue-drain");
  fila = await import("@/lib/linkedin-fila");

  // AS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO.
  if (li.basesDoLinkedin().api !== process.env.LINKEDIN_API_BASE) {
    throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada. Sem o desvio, este teste publicaria de verdade.");
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada não é loopback.");
  }
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_ana",
    name: "Ana",
    profile_picture_url: null,
    access_token: "ig-token-de-teste",
    token_expires_at: null,
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) delete process.env[v];
  await new Promise<void>((pronto) => servidorLinkedin.close(() => pronto()));
  await new Promise<void>((pronto) => servidorBucket.close(() => pronto()));
});

beforeEach(async () => {
  Object.assign(linkedin, {
    pedidos: [],
    posts: [],
    envios: [],
    statusDoPost: 201,
    derrubarDepoisDoPost: false,
    segurarOPost: null,
    statusDaReserva: 200,
    desconhecidos: [],
    marcadaNoPost: [],
    aoEnviar: null,
  });
  bucket.apagados = [];
  bucket.baixados = [];
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await conectar();
});

async function conectar(expiraEm = "now() + interval '60 days'") {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, 'Dra. Ana Souza', $3, ${expiraEm})
     on conflict (account_id) do update set expira_em = excluded.expira_em`,
    [CONTA, PESSOA, TOKEN_DO_LINKEDIN]
  );
}

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000001";
const enfileirarTexto = (texto = "Olá #mundo", quando: Date | null = null, idDoEnvio = ENVIO) =>
  fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "texto", caminhos: [], texto, idDoEnvio }, quando);
const enfileirarImagem = (caminho = `${CONTA}/foto.jpg`) =>
  fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "imagem", caminhos: [caminho], texto: "Com foto", idDoEnvio: ENVIO }, null);

const linhaDoLinkedin = async () =>
  (await q(`select * from queue where kind = 'publicacao_linkedin' order by created_at desc, id desc limit 1`))[0];

// ---------------------------------------------------------------------------------------------------------------

describe("enfileirar um post do LinkedIn", () => {
  it("grava a linha publicacao_linkedin com o payload, a chave própria e a hora", async () => {
    const r = await enfileirarTexto();
    const linha = await linhaDoLinkedin();
    // O ID DA LINHA VOLTA JUNTO: é com ele que o "agora" da tela publica só esta linha (achado 211).
    expect(r).toEqual({ entrou: true, jaVale: true, falta: 0, id: linha.id });
    expect(linha).toMatchObject({
      account_id: CONTA,
      status: "pending",
      dedupe_key: `pub-linkedin:${CONTA}:texto:${ENVIO}`,
      payload: { forma: "texto", caminhos: [], texto: "Olá #mundo" },
    });
  });

  it("o mesmo envio não entra duas vezes; outro envio do mesmo texto entra", async () => {
    await enfileirarTexto();
    expect(await enfileirarTexto()).toEqual({ entrou: false });
    expect((await enfileirarTexto("Olá #mundo", null, "9f1c2e3d-0000-4000-8000-000000000002")).entrou).toBe(true);
  });

  it("o agendado nasce no futuro, e não vale ainda", async () => {
    const r = await enfileirarTexto("depois", new Date(Date.now() + 2 * 3_600_000));
    expect(r.entrou && r.jaVale).toBe(false);
  });

  it("não entra o texto vazio, o longo demais, a imagem sem arquivo nem o envio sem id", async () => {
    expect(await enfileirarTexto("   ")).toEqual({ entrou: false });
    expect(await enfileirarTexto("a".repeat(3001))).toEqual({ entrou: false });
    expect(
      await fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "imagem", caminhos: [], texto: "sem foto", idDoEnvio: ENVIO }, null)
    ).toEqual({ entrou: false });
    expect(await enfileirarTexto("Olá", null, "não-é-um-id")).toEqual({ entrou: false });
    expect(await q(`select id from queue`)).toEqual([]);
  });
});

describe("o dreno publica no LinkedIn", () => {
  it("só texto: o post sai com o autor pessoa e o texto já transformado, e a linha fica sent com o URN", async () => {
    await enfileirarTexto();
    const resumo = await dreno.drainQueue();
    expect(resumo.sent).toBe(1);
    expect(linkedin.posts).toEqual([
      {
        author: `urn:li:person:${PESSOA}`,
        commentary: "Olá {hashtag|\\#|mundo}",
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
    ]);
    const post = linkedin.pedidos.find((p) => p.caminho === "/rest/posts");
    expect(post?.cabecalhos["authorization"]).toBe(`Bearer ${TOKEN_DO_LINKEDIN}`);
    expect(post?.cabecalhos["linkedin-version"]).toBe("202610");
    expect(post?.cabecalhos["x-restli-protocol-version"]).toBe("2.0.0");
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("sent");
    expect(linha.sent_at).toBeInstanceOf(Date);
    expect(linha.error).toBeNull();
    expect((linha.payload as Record<string, unknown>).post_urn).toBe("urn:li:share:7000000000000000001");
    expect(typeof (linha.payload as Record<string, unknown>).post_tentado_em).toBe("string");
    // A MARCA JÁ ESTAVA NO BANCO QUANDO O POST CHEGOU (achado 210), e não foi gravada depois dele.
    expect(linkedin.marcadaNoPost).toEqual([true]);
  });

  it("imagem: reserva com a pessoa dona, envia os bytes do bucket, publica com a imagem e só então apaga o arquivo", async () => {
    await enfileirarImagem();
    await dreno.drainQueue();
    const reserva = linkedin.pedidos.find((p) => p.caminho.startsWith("/rest/images"));
    expect(JSON.parse(reserva?.corpo ?? "{}")).toEqual({ initializeUploadRequest: { owner: `urn:li:person:${PESSOA}` } });
    expect(linkedin.envios).toEqual([BYTES_DA_IMAGEM]);
    const envio = linkedin.pedidos.find((p) => p.metodo === "PUT");
    expect(envio?.cabecalhos["authorization"]).toBe(`Bearer ${TOKEN_DO_LINKEDIN}`);
    expect(linkedin.posts[0]).toMatchObject({ commentary: "Com foto", content: { media: { id: "urn:li:image:C4E10AQFalsa" } } });
    expect(bucket.apagados).toEqual([`${CONTA}/foto.jpg`]);
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("sent");
    expect((linha.payload as Record<string, unknown>).imagem_urn).toBe("urn:li:image:C4E10AQFalsa");
  });

  it("o post sai mesmo com a conta no teto horário de DM", async () => {
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
       select $1, 'dm_lote', '{}'::jsonb, 'teto-' || g, 'sent', now() - interval '10 minutes', now() - interval '10 minutes'
         from generate_series(1, 190) g`,
      [CONTA]
    );
    await enfileirarTexto();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("sent");
    expect(linkedin.posts).toHaveLength(1);
  });

  it("o post do LinkedIn que saiu não conta na cota horária de DM", async () => {
    // 189 DMs e 1 post do LinkedIn saíram na última hora: são 189 mensagens, abaixo do teto de 190, e a conta não
    // é bloqueada. Contando o post, seriam 190, e a DM pendente nem seria pega.
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
       select $1, 'dm_lote', '{}'::jsonb, 'cota-' || g, 'sent', now() - interval '10 minutes', now() - interval '10 minutes'
         from generate_series(1, 189) g`,
      [CONTA]
    );
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
       values ($1, 'publicacao_linkedin', '{"forma":"texto","caminhos":[],"texto":"x"}'::jsonb, 'cota-li', 'sent',
               now() - interval '5 minutes', now() - interval '5 minutes')`,
      [CONTA]
    );
    await q(
      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key)
       values ($1, 'dm_manual', '99000000000000025', '{"text":"oi"}'::jsonb, 'cota-dm')`,
      [CONTA]
    );
    await dreno.drainQueue();
    // PEGA é o que importa: a reivindicação conta a tentativa. Sem Meta nesta rodada, o envio não sai, e não
    // precisa: o que se mede é que a conta não ficou fora do lote.
    const [dm] = await q(`select attempts from queue where dedupe_key = 'cota-dm'`);
    expect(dm.attempts).toBe(1);
  });
});

describe("o post do LinkedIn nunca sai duas vezes (achado 210)", () => {
  it("com o post_urn marcado, a passada seguinte fecha a linha sem publicar de novo", async () => {
    await enfileirarTexto();
    await q(`update queue set payload = payload || '{"post_urn":"urn:li:share:1"}'::jsonb where kind = 'publicacao_linkedin'`);
    await dreno.drainQueue();
    expect(linkedin.posts).toHaveLength(0);
    expect((await linhaDoLinkedin()).status).toBe("sent");
  });

  it("com o post tentado e sem o URN, a linha vai a failed dizendo para conferir, e não publica", async () => {
    await enfileirarTexto();
    await q(
      `update queue set payload = payload || '{"post_tentado_em":"2026-11-09T19:00:00Z"}'::jsonb where kind = 'publicacao_linkedin'`
    );
    await dreno.drainQueue();
    expect(linkedin.pedidos.filter((p) => p.caminho === "/rest/posts")).toHaveLength(0);
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(String(linha.error)).toContain("pode ter saído");
  });

  it("o LinkedIn cria o post e a conexão cai antes da resposta: failed, e um post só", async () => {
    linkedin.derrubarDepoisDoPost = true;
    await enfileirarTexto();
    await dreno.drainQueue();
    expect(linkedin.posts).toHaveLength(1);
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(String(linha.error)).toContain("pode ter saído");
    // A passada seguinte não pega a linha de novo.
    await q(`update queue set not_before = now() - interval '1 minute'`);
    await dreno.drainQueue();
    expect(linkedin.posts).toHaveLength(1);
  });

  it("o 429 no post não criou nada: a marca sai, e a linha volta à fila para tentar de novo", async () => {
    linkedin.statusDoPost = 429;
    await enfileirarTexto();
    await dreno.drainQueue();
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("pending");
    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
    linkedin.statusDoPost = 201;
    await q(`update queue set not_before = now() - interval '1 minute'`);
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("sent");
    expect(linkedin.posts).toHaveLength(1);
  });
});

describe("os erros do LinkedIn no dreno", () => {
  it("o 401 vai a failed dizendo que a autorização não vale mais", async () => {
    linkedin.statusDoPost = 401;
    await enfileirarTexto();
    await dreno.drainQueue();
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(linha.error).toBe(
      "o LinkedIn de Dra. Ana Souza não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo"
    );
  });

  it("o 403 no post é permanente, com o texto do LinkedIn e sem o token", async () => {
    linkedin.statusDoPost = 403;
    await enfileirarTexto();
    await dreno.drainQueue();
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(String(linha.error)).toContain("403");
    expect(String(linha.error)).not.toContain(TOKEN_DO_LINKEDIN);
  });

  it("o 5xx na reserva da imagem volta à fila, e a passada seguinte publica", async () => {
    linkedin.statusDaReserva = 503;
    await enfileirarImagem();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("pending");
    expect(linkedin.posts).toHaveLength(0);
    linkedin.statusDaReserva = 200;
    await q(`update queue set not_before = now() - interval '1 minute'`);
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("sent");
  });

  it("sem LinkedIn conectado, ou com ele vencido, vai a failed com o motivo, sem chamar o LinkedIn", async () => {
    await q(`delete from linkedin_conexoes`);
    await enfileirarTexto();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).error).toBe("esta conta não tem LinkedIn conectado");

    await q(`delete from queue`);
    await conectar("now() - interval '1 minute'");
    await enfileirarTexto();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).error).toBe(
      "o LinkedIn de Dra. Ana Souza não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo"
    );
    expect(linkedin.pedidos).toHaveLength(0);
  });

  // A FORMA É DA LISTA, E O RESTO É TORTO (a imagem sem o caminho). Uma forma que não é da lista ("reels", que este
  // caso usava antes) é de um código mais novo e fica intocada, pela preparação da parte 3
  // (testes-integracao/dreno-forma-desconhecida.integracao.ts).
  it("o payload que não é do LinkedIn vai a failed com o motivo escrito", async () => {
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao_linkedin', '{"forma":"imagem","caminhos":[],"texto":"sem a imagem"}'::jsonb, 'pub-linkedin:torta')`,
      [CONTA]
    );
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).error).toBe("o payload deste item não é de um post do LinkedIn");
  });
});

// O ORÇAMENTO DE TEMPO DA FUNÇÃO (nota da auditoria sobre a F2): as funções que drenam têm 60 s, e um passo que não
// cabe no que resta não começa. Morta no meio, a linha ficaria em 'sending'; depois da marca, viraria "pode ter
// saído". O começo da função entra pelo `inicioDaFuncaoMs`, aqui posto no passado para sobrar pouco.
describe("o post do LinkedIn não começa o que a função não tem tempo de terminar", () => {
  const restando = (ms: number) => Date.now() - (dreno.ORCAMENTO_DA_FUNCAO_MS - ms);
  const linhaCompleta = async () =>
    (await q(`select status, attempts, error, payload, not_before > now() as adiado from queue where kind = 'publicacao_linkedin'`))[0];

  // COM 5 s RESTANDO, O DRENO DO LOTE NEM REIVINDICA (a hora de parar da 3a-0; lib/fila-tipos.ts): a linha fica como
  // estava, e o LinkedIn não é chamado. A regra do próprio post do LinkedIn, que adia com o motivo, continua provada no
  // dreno de uma linha só, no caso do "agora" com 5 s restando, logo abaixo.
  it("só texto, com 5 s restando: o dreno nem pega a linha, não chama o LinkedIn, e a linha fica pending, com a tentativa de antes", async () => {
    await enfileirarTexto();
    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: restando(5_000) });
    expect(resumo).toMatchObject({ aguardando: 0, devolvidos: 0 });
    expect(linkedin.pedidos).toEqual([]);
    const linha = await linhaCompleta();
    expect(linha).toMatchObject({ status: "pending", attempts: 0, adiado: false, error: null });
    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
  });

  it("imagem, com 25 s restando: não baixa, não reserva e volta pending", async () => {
    await enfileirarImagem();
    await dreno.drainQueue({ inicioDaFuncaoMs: restando(25_000) });
    expect(bucket.baixados).toEqual([]);
    expect(linkedin.pedidos).toEqual([]);
    expect(await linhaCompleta()).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("imagem já enviada, com 25 s restando: só o post falta, e ele sai", async () => {
    await enfileirarImagem();
    await q(`update queue set payload = payload || '{"imagem_urn":"urn:li:image:JaEnviada"}'::jsonb where kind = 'publicacao_linkedin'`);
    await dreno.drainQueue({ inicioDaFuncaoMs: restando(25_000) });
    expect(bucket.baixados).toEqual([]);
    expect(linkedin.pedidos.map((p) => p.caminho)).toEqual(["/rest/posts"]);
    expect(linkedin.posts[0]).toMatchObject({ content: { media: { id: "urn:li:image:JaEnviada" } } });
    expect((await linhaCompleta()).status).toBe("sent");
  });

  it("a imagem que termina perto do fim para antes da marca; a passada seguinte só publica", async () => {
    // O RELÓGIO ANDA 27 S DURANTE O ENVIO: começa com 41 s restando (passa a conferência da imagem, de 40 s) e
    // termina com ~14 s (não passa a do post, de 15 s). Só o `Date.now` deste processo anda; o banco não.
    const real = Date.now.bind(Date);
    let deslocamento = 0;
    const espiao = vi.spyOn(Date, "now").mockImplementation(() => real() + deslocamento);
    linkedin.aoEnviar = () => {
      deslocamento += 27_000;
    };
    try {
      await enfileirarImagem();
      await dreno.drainQueue({ inicioDaFuncaoMs: restando(41_000) });
    } finally {
      espiao.mockRestore();
    }
    expect(linkedin.envios).toHaveLength(1);
    expect(linkedin.pedidos.some((p) => p.caminho === "/rest/posts")).toBe(false);
    const linha = await linhaCompleta();
    expect(linha).toMatchObject({ status: "pending", attempts: 0 });
    expect((linha.payload as Record<string, unknown>).imagem_urn).toBe("urn:li:image:C4E10AQFalsa");
    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();

    await q(`update queue set not_before = now() - interval '1 minute'`);
    await dreno.drainQueue({ inicioDaFuncaoMs: restando(45_000) });
    expect(linkedin.envios).toHaveLength(1);
    expect(bucket.baixados).toHaveLength(1);
    expect(linkedin.posts).toHaveLength(1);
    expect((await linhaCompleta()).status).toBe("sent");
  });

  it("com tempo de sobra, a imagem sai inteira numa passada só", async () => {
    await enfileirarImagem();
    await dreno.drainQueue({ inicioDaFuncaoMs: restando(45_000) });
    expect(bucket.baixados).toEqual([`${CONTA}/foto.jpg`]);
    expect((await linhaCompleta()).status).toBe("sent");
  });

  it("o \"agora\" com 5 s restando devolve aguardando, sem chamar o LinkedIn", async () => {
    await enfileirarTexto();
    const id = String((await linhaDoLinkedin()).id);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, restando(5_000))).toBe("aguardando");
    expect(linkedin.pedidos).toEqual([]);
    const linha = await linhaCompleta();
    expect(linha).toMatchObject({ status: "pending", attempts: 0, adiado: true });
    expect(String(linha.error)).toContain("não bastava");
    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
  });
});

describe("o \"agora\" drena só a própria linha (achado 211)", () => {
  it("publica a linha pedida e não toca nas outras vencidas, de mensagem e de post do Instagram", async () => {
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key) values
         ($1, 'dm_lote', '{"lote_id":"L","text":"oi"}'::jsonb, 'outra-dm'),
         ($1, 'publicacao', '{"forma":"imagem","caminhos":["${CONTA}/ig.jpg"]}'::jsonb, 'outro-post')`,
      [CONTA]
    );
    await enfileirarTexto();
    const id = String((await linhaDoLinkedin()).id);
    const desfecho = await dreno.drenarUmaPublicacaoDoLinkedin(id);
    expect(desfecho).toBe("publicado");
    expect(linkedin.posts).toHaveLength(1);
    const outras = await q(`select status, attempts from queue where kind <> 'publicacao_linkedin' order by kind`);
    expect(outras).toEqual([
      { status: "pending", attempts: 0 },
      { status: "pending", attempts: 0 },
    ]);
  });

  it("não pega a linha de outro tipo, a agendada nem a que já saiu", async () => {
    await enfileirarTexto("depois", new Date(Date.now() + 3_600_000));
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(String((await linhaDoLinkedin()).id))).toBeNull();
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao', '{"forma":"imagem","caminhos":["${CONTA}/x.jpg"]}'::jsonb, 'post-ig')`,
      [CONTA]
    );
    const ig = String((await q(`select id from queue where kind = 'publicacao'`))[0].id);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(ig)).toBeNull();
    // A QUE JÁ SAIU: uma linha do LinkedIn `sent`, com a hora no passado e sem o URN, que um "agora" sem o
    // `status = 'pending'` publicaria de novo.
    const [saiu] = await q(
      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
       values ($1, 'publicacao_linkedin', '{"forma":"texto","caminhos":[],"texto":"já saiu"}'::jsonb, 'pub-linkedin:ja-saiu',
               'sent', now() - interval '1 minute', now() - interval '2 minutes')
       returning id`,
      [CONTA]
    );
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(String(saiu.id))).toBeNull();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin("não é uuid")).toBeNull();
    expect(linkedin.pedidos).toHaveLength(0);
  });

  it("o dreno geral e o \"agora\" ao mesmo tempo publicam um post só", async () => {
    let liberar!: () => void;
    linkedin.segurarOPost = new Promise<void>((pronto) => (liberar = pronto));
    await enfileirarTexto();
    const id = String((await linhaDoLinkedin()).id);
    const ambos = Promise.all([dreno.drainQueue(), dreno.drenarUmaPublicacaoDoLinkedin(id)]);
    await new Promise((pronto) => setTimeout(pronto, 300));
    liberar();
    await ambos;
    expect(linkedin.posts).toHaveLength(1);
    expect((await linhaDoLinkedin()).status).toBe("sent");
  });
});
