// O CARROSSEL EM PDF NO LINKEDIN PELA FILA (a parte 3a; scratchpad/desenho-li3.md, §6), contra o banco descartável:
// o ramo do carrossel no dreno do LinkedIn (lib/linkedin-fila.ts). As fotos baixadas do bucket, o PDF montado no
// painel (lib/pdf-de-fotos.ts), a reserva e o envio do documento, o post com o documento e o título, as marcas de
// cada passo, a espera do documento que o LinkedIn ainda processa, o teto de tempo da passada e o teto dos adiamentos.
//
// O LINKEDIN FALSO E O BUCKET FALSO: dois servidores HTTP na própria máquina, no molde de
// linkedin-publicacao.integracao.ts. As bases do LinkedIn (lib/linkedin.ts) e a SUPABASE_URL vão para eles, e as
// guardas conferem isso ANTES de qualquer requisição. O `fetch` é interceptado só neste arquivo e RECUSA qualquer
// endereço que não seja o loopback. **NADA AQUI CHAMA O LINKEDIN NEM O BUCKET DE VERDADE.** Valores inventados:
// nenhuma credencial de verdade entra em teste.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { tituloDoDocumento } from "@/lib/linkedin-publicacao";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloFila = typeof import("@/lib/linkedin-fila");
type ModuloLinkedin = typeof import("@/lib/linkedin");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA = "17800000000031001";
const PESSOA = "pessoaDoCarrosselA1";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoCarrosselQueNaoValeNada";
const BUCKET = "midia-do-carrossel";
const CHAVE_DO_BUCKET = "chave-do-bucket-do-carrossel-que-nao-vale-nada";

// DOIS JPEGS DE VERDADE, feitos pelo ffmpeg (testsrc, 16×20 e testsrc2, 20×16, yuvj420p): os mesmos de
// tests/linkedin-carrossel-regras.test.ts.
const FOTO_A = Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACAoKCwoLDQ0NDQ0NEA8QEBAQEBAQEBAQEBISEhUVFRISEhAQEhIUFBUVFxcXFRUVFRcXGRkZHh4cHCMjJCsrM//EAHUAAQEBAQAAAAAAAAAAAAAAAAUGAgMBAQEBAAAAAAAAAAAAAAAAAAECAxAAAgECBAQFBQEAAAAAAAAAAgEDBBESBgAhMQUyQjPDgkEHIyKRYVFSEQABAgUFAQEBAAAAAAAAAAABAgMSEQQTIiEUAAUjMYEy/8AAEQgAFAAQAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AFdHzLKPLo/qqKstiNCo5BixMWg+4SEiQyNG1cb9Ldruoq66lybXRnBTt0ou0kQkRHhJAsQFKTbIXIRIWSRdLa2a1ngSrQZ0oupErYShTlEvC4MLp8Hw/mp7PZDUnIEBKYla4xtGS8Lihu/Z/jR2AtDqNlpe3e9sa3IbEG4gnOGNyCP8AmJUuLKjUuUiHZKcUK0OokApW3FeKe4gAElFimgKhObbZ+gc7ZSnq+bU0VPNVSgI3wuMIEQ2cn+oSXalunpPLFPS8/qnU1dPGikRIwjKYQfXvvKRJrB7Fbd/rRHx72erztO/HvZ6vO1PXeCXw15BRdiCMQrVX2GU/3mvYC3XJqEYPFFD7J0dybYizGWUzPXWZ5//Z", "base64");
const FOTO_B = Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACBAQExATFhYWFhYWGhgaGxsbGhoaGhsbGx0dHSIiIh0dHRsbHR0gICIiJSYlIyMiIyYmKCgoMDAuLjg4OkVFU//EAHQAAQEBAQEAAAAAAAAAAAAAAAUEAQcGAQEBAQAAAAAAAAAAAAAAAAAFAwYQAAEDAwIDCQEBAAAAAAAAAAECAxEEEiEAURMiU6LSQTJhFDEVIzNSEQACAQIGAwEAAAAAAAAAAAABAhEDIQASIjEEBXFhI2L/wAARCAAQABQDASIAAhEAAxEA/9oADAMBAAIRAxEAPwDlxL63VIb8BcfKAABJJUrAHqTqp9Va9XKWrLhSFlUICbAgC6cItjE/E+ukWCD7tuL1K4Kg3MFYQZUAd42ztppbjZpzTWy7/T28m6ziX2T/AKs8PPGY1Gr2ld+RnUEWKjUSUSpkZjMjQIAIsDFzjSPRArFS5+bEg/oMQFG8NaRefWCBXV9OEoLluJHK2QQcyCEkEHcHW/a1vV7Dfd16GmqWaVlDbn5K5lcPmUUBSyUgkA5gj5zvq37Gl6nZX3dGt2PIDH5O1zqBaG9iJ38nzgOp1XEquzvUpZnYs2ZULSTJkkyTO84//9k=", "base64");
const FOTOS = [`${CONTA}/a.jpg`, `${CONTA}/b.jpg`];
const TEXTO = "Cinco dicas para o seu perfil no LinkedIn, uma por foto, do jeito que a gente usa no dia a dia #perfil";

type Pedido = { metodo: string; caminho: string; cabecalhos: IncomingMessage["headers"]; corpo: Buffer };

const linkedin = {
  pedidos: [] as Pedido[],
  posts: [] as Record<string, unknown>[],
  documentos: [] as Buffer[],
  /** A próxima resposta do POST /rest/posts, quando não é o sucesso. */
  respostaDoPost: null as null | { status: number; corpo: string },
  desconhecidos: [] as string[],
};
/** O que o bucket falso serve em cada caminho; sem entrada, 404. */
const bucket = { arquivos: new Map<string, Buffer>(), apagados: [] as string[], baixados: [] as string[] };

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
    linkedin.pedidos.push({ metodo: req.method ?? "", caminho: u.pathname + u.search, cabecalhos: req.headers, corpo });
    const porta = (servidorLinkedin.address() as AddressInfo).port;
    if (req.method === "POST" && u.pathname === "/rest/documents" && u.searchParams.get("action") === "initializeUpload") {
      return responder(res, 200, {
        value: { uploadUrl: `http://127.0.0.1:${porta}/envio/D5510`, uploadUrlExpiresAt: 1999999999999, document: "urn:li:document:D5510Falso" },
      });
    }
    if (req.method === "PUT" && u.pathname === "/envio/D5510") {
      linkedin.documentos.push(corpo);
      return responder(res, 201, "");
    }
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      const r = linkedin.respostaDoPost;
      if (r) {
        linkedin.respostaDoPost = null;
        return responder(res, r.status, r.corpo);
      }
      linkedin.posts.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      return responder(res, 201, "", { "x-restli-id": `urn:li:share:70000000000000003${linkedin.posts.length}` });
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });

  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    const privado = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      const caminho = decodeURIComponent(u.pathname.slice(publico.length));
      bucket.baixados.push(caminho);
      const bytes = bucket.arquivos.get(caminho);
      if (!bytes) return responder(res, 404, { message: "não existe" });
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(bytes);
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
    username: "conta_do_carrossel",
    name: "Carrossel",
    profile_picture_url: null,
    access_token: "ig-token-do-carrossel",
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
  Object.assign(linkedin, { pedidos: [], posts: [], documentos: [], respostaDoPost: null, desconhecidos: [] });
  bucket.arquivos = new Map([
    [FOTOS[0], FOTO_A],
    [FOTOS[1], FOTO_B],
  ]);
  bucket.apagados = [];
  bucket.baixados = [];
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, 'Dra. Ana Souza', $3, now() + interval '60 days')`,
    [CONTA, PESSOA, TOKEN_DO_LINKEDIN]
  );
});

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000031";

/** Enfileira o carrossel para agora e devolve o id da linha. */
async function enfileirarOCarrossel(caminhos = FOTOS): Promise<string> {
  const r = await fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "carrossel", caminhos, texto: TEXTO, idDoEnvio: ENVIO }, null);
  if (!r.entrou) throw new Error("o carrossel não entrou na fila");
  return r.id;
}

const linha = async (id: string) =>
  (await q(`select status, attempts, error, payload, not_before > now() + interval '50 seconds' as espera_um_minuto from queue where id = $1`, [id]))[0] as {
    status: string;
    attempts: number;
    error: string | null;
    payload: Record<string, unknown>;
    espera_um_minuto: boolean;
  };

const caminhosDoLinkedin = () => linkedin.pedidos.map((p) => `${p.metodo} ${p.caminho.split("?")[0]}`);
const restando = (ms: number) => Date.now() - (dreno.ORCAMENTO_DA_FUNCAO_MS - ms);

describe("o carrossel em PDF no LinkedIn", () => {
  it("agora: as fotos baixadas, o PDF com as duas, o envio com a autorização, o post com o documento e o título, e as fotos fora do bucket", async () => {
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");

    expect(caminhosDoLinkedin()).toEqual(["POST /rest/documents", "PUT /envio/D5510", "POST /rest/posts"]);
    const envio = linkedin.pedidos[1];
    expect(envio.cabecalhos.authorization).toBe(`Bearer ${TOKEN_DO_LINKEDIN}`);
    const pdf = linkedin.documentos[0];
    expect(pdf.subarray(0, 9).toString("latin1")).toBe("%PDF-1.4\n");
    expect(pdf.indexOf(FOTO_A)).toBeGreaterThan(0);
    expect(pdf.indexOf(FOTO_B)).toBeGreaterThan(pdf.indexOf(FOTO_A));
    expect(linkedin.posts[0]).toMatchObject({
      author: `urn:li:person:${PESSOA}`,
      content: { media: { id: "urn:li:document:D5510Falso", title: tituloDoDocumento(TEXTO) } },
    });
    const l = await linha(id);
    expect(l.status).toBe("sent");
    expect(l.payload).toMatchObject({ documento_urn: "urn:li:document:D5510Falso", post_urn: "urn:li:share:700000000000000031" });
    expect(bucket.apagados.sort()).toEqual([...FOTOS].sort());
  });

  it("a passada seguinte não monta nem envia o PDF de novo: com o documento marcado, só publica", async () => {
    const id = await enfileirarOCarrossel();
    await q(`update queue set payload = payload || '{"documento_urn":"urn:li:document:JaEnviado"}'::jsonb where id = $1`, [id]);

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");

    expect(caminhosDoLinkedin()).toEqual(["POST /rest/posts"]);
    expect(bucket.baixados).toEqual([]);
    expect(linkedin.posts[0]).toMatchObject({ content: { media: { id: "urn:li:document:JaEnviado" } } });
  });

  it("o documento que o LinkedIn ainda processa: a marca sai, a linha volta em um minuto sem gastar tentativa, e a consulta conta", async () => {
    const id = await enfileirarOCarrossel();
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD","message":"Media asset is waiting upload"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0, espera_um_minuto: true });
    expect(l.payload).toMatchObject({ documento_urn: "urn:li:document:D5510Falso", consultas_da_midia: 1 });
    expect(l.payload.post_tentado_em).toBeUndefined();
    expect(l.error).toBe(fila.MOTIVO_MIDIA_PROCESSANDO);
  });

  it("na sexta consulta, a linha vai a failed com o motivo", async () => {
    const id = await enfileirarOCarrossel();
    await q(
      `update queue set payload = payload || '{"documento_urn":"urn:li:document:D","consultas_da_midia":5}'::jsonb where id = $1`,
      [id]
    );
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_MIDIA_NAO_FICOU_PRONTA });
  });

  it("o 400 que não é de processamento encerra a linha, como hoje", async () => {
    const id = await enfileirarOCarrossel();
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"INVALID_URN_TYPE"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("400");
  });

  it("sem os 52 s da mídia, a passada não começa: volta sem gastar tentativa, e o adiamento conta", async () => {
    const id = await enfileirarOCarrossel();

    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: restando(40_000) });

    expect(resumo.aguardando).toBe(1);
    expect(linkedin.pedidos).toEqual([]);
    expect(bucket.baixados).toEqual([]);
    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0 });
    expect(l.payload).toMatchObject({ adiamentos: 1 });
  });

  it("o sétimo adiamento encerra a linha, sem chamar o LinkedIn", async () => {
    const id = await enfileirarOCarrossel();
    await q(`update queue set payload = payload || '{"adiamentos":6}'::jsonb where id = $1`, [id]);

    await dreno.drainQueue({ inicioDaFuncaoMs: restando(40_000) });

    expect(linkedin.pedidos).toEqual([]);
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL });
    expect(fila.MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL).toContain("menos fotos");
  });

  it("a foto que não é JPEG encerra a linha antes de qualquer chamada ao LinkedIn, dizendo qual foto", async () => {
    bucket.arquivos.set(FOTOS[1], Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    expect(linkedin.pedidos).toEqual([]);
    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("foto 2");
  });

  it("as fotos que passam de 15 MB juntas encerram a linha antes de qualquer chamada ao LinkedIn", async () => {
    const grande = Buffer.alloc(8 * 1024 * 1024, 0x55);
    bucket.arquivos.set(FOTOS[0], grande);
    bucket.arquivos.set(FOTOS[1], grande);
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    expect(linkedin.pedidos).toEqual([]);
    expect(await linha(id)).toMatchObject({
      status: "failed",
      error: "As fotos do carrossel passam de 15 MB juntas, o limite do LinkedIn neste painel. Tire fotos ou use fotos menores.",
    });
  });

  it("a foto que sumiu do bucket não publica: a linha volta à fila pelo erro passageiro, sem chamar o LinkedIn", async () => {
    bucket.arquivos.delete(FOTOS[1]);
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    expect(linkedin.pedidos).toEqual([]);
    expect((await linha(id)).status).toBe("pending");
  });
});
