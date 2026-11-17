// O VÍDEO EM PARTES NO LINKEDIN PELA FILA (a parte 3b; scratchpad/desenho-li3b.md, v3), contra o banco descartável:
// o ramo do vídeo no dreno do LinkedIn (lib/linkedin-fila.ts). Uma etapa por passada (a reserva, cada parte, o fim e
// o post), o progresso lido do que ficou gravado, as tentativas zeradas na passada que avança, os dois tetos, a
// classificação dos erros de cada etapa, o fim perdido, a mídia que o LinkedIn ainda processa, e o arquivo que só sai
// do bucket com o post publicado (conferido pela lista do bucket falso, e não pelo endereço público: o 239).
//
// O LINKEDIN FALSO E O BUCKET FALSO: dois servidores HTTP na própria máquina, no molde de
// linkedin-carrossel.integracao.ts. O bucket falso responde ao HEAD (o tamanho) e ao GET com Range (a faixa, com 206).
// O `fetch` é interceptado só neste arquivo e RECUSA qualquer endereço que não seja o loopback. **NADA AQUI CHAMA O
// LINKEDIN NEM O BUCKET DE VERDADE.** Valores inventados: nenhuma credencial de verdade entra em teste.
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

const CONTA = "17800000000031002";
const PESSOA = "pessoaDoVideoB2";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoVideoQueNaoValeNada";
const BUCKET = "midia-do-video";
const CHAVE_DO_BUCKET = "chave-do-bucket-do-video-que-nao-vale-nada";

// UM "VÍDEO" DE 10 BYTES, EM PARTES DE 4: o LinkedIn falso devolve 0-3, 4-7 e 8-9. O tamanho de verdade das partes
// (4 MiB nos exemplos da Videos API) não muda a lógica, e a prova mede o de verdade.
const VIDEO = `${CONTA}/v.mp4`;
const BYTES_DO_VIDEO = Buffer.from([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
const TAMANHO_DA_PARTE = 4;
const TEXTO = "Um vídeo curto sobre o que muda no perfil, para quem está começando agora no LinkedIn #perfil";
const URN = "urn:li:video:V3bFalso";

type Pedido = { metodo: string; caminho: string; cabecalhos: IncomingMessage["headers"]; corpo: Buffer };

const linkedin = {
  pedidos: [] as Pedido[],
  partes: new Map<number, Buffer>(),
  fins: [] as Record<string, unknown>[],
  posts: [] as Record<string, unknown>[],
  /** As próximas respostas do PUT das partes, quando não são o sucesso; o resto responde 200 com o ETag. */
  respostasDasPartes: [] as { status: number; semEtag?: boolean }[],
  respostaDoFim: null as null | { status: number; corpo: string },
  estadoDoVideo: { status: 200, corpo: '{"status":"AVAILABLE"}' } as { status: number; corpo: string },
  respostaDoPost: null as null | { status: number; corpo: string },
  /** O endereço das partes na reserva; o padrão é o do próprio servidor falso. */
  enderecoDasPartes: null as null | string,
  desconhecidos: [] as string[],
};
const bucket = { arquivos: new Map<string, Buffer>(), apagados: [] as string[], faixas: [] as string[], respostaDaFaixa: null as null | number };

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
    if (req.method === "POST" && u.pathname === "/rest/videos" && u.searchParams.get("action") === "initializeUpload") {
      const pedido = JSON.parse(corpo.toString()) as { initializeUploadRequest: { fileSizeBytes: number } };
      const tamanho = pedido.initializeUploadRequest.fileSizeBytes;
      const instrucoes = [];
      for (let inicio = 0, n = 0; inicio < tamanho; inicio += TAMANHO_DA_PARTE, n++) {
        instrucoes.push({
          uploadUrl: linkedin.enderecoDasPartes ?? `http://127.0.0.1:${porta}/parte/${n}`,
          firstByte: inicio,
          lastByte: Math.min(inicio + TAMANHO_DA_PARTE, tamanho) - 1,
        });
      }
      return responder(res, 200, { value: { uploadInstructions: instrucoes, video: URN, uploadToken: "token-do-envio-falso" } });
    }
    if (req.method === "PUT" && u.pathname.startsWith("/parte/")) {
      const n = Number(u.pathname.slice("/parte/".length));
      const r = linkedin.respostasDasPartes.shift();
      if (r && r.status !== 200) return responder(res, r.status, "um texto do LinkedIn que não vai para a tela");
      linkedin.partes.set(n, corpo);
      return responder(res, 200, "", r?.semEtag ? {} : { etag: `"etag-${n}"` });
    }
    if (req.method === "POST" && u.pathname === "/rest/videos" && u.searchParams.get("action") === "finalizeUpload") {
      const r = linkedin.respostaDoFim;
      if (r) {
        linkedin.respostaDoFim = null;
        return responder(res, r.status, r.corpo);
      }
      linkedin.fins.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      return responder(res, 200, "");
    }
    if (req.method === "GET" && u.pathname === `/rest/videos/${encodeURIComponent(URN)}`) {
      return responder(res, linkedin.estadoDoVideo.status, linkedin.estadoDoVideo.corpo);
    }
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      const r = linkedin.respostaDoPost;
      if (r) {
        linkedin.respostaDoPost = null;
        return responder(res, r.status, r.corpo);
      }
      linkedin.posts.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      return responder(res, 201, "", { "x-restli-id": `urn:li:share:70000000000000005${linkedin.posts.length}` });
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });

  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    const privado = `/storage/v1/object/${BUCKET}/`;
    if ((req.method === "GET" || req.method === "HEAD") && u.pathname.startsWith(publico)) {
      const caminho = decodeURIComponent(u.pathname.slice(publico.length));
      const bytes = bucket.arquivos.get(caminho);
      if (!bytes) return responder(res, 404, { message: "não existe" });
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-length": String(bytes.length), "content-type": "video/mp4" });
        return res.end();
      }
      const faixa = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ""));
      if (!faixa || bucket.respostaDaFaixa === 200) {
        bucket.respostaDaFaixa = null;
        res.writeHead(200, { "content-type": "video/mp4" });
        return res.end(bytes);
      }
      const [inicio, fim] = [Number(faixa[1]), Number(faixa[2])];
      bucket.faixas.push(`${inicio}-${fim}`);
      res.writeHead(206, { "content-type": "video/mp4", "content-range": `bytes ${inicio}-${fim}/${bytes.length}` });
      return res.end(bytes.subarray(inicio, fim + 1));
    }
    if (req.method === "DELETE" && u.pathname.startsWith(privado)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      const caminho = decodeURIComponent(u.pathname.slice(privado.length));
      bucket.apagados.push(caminho);
      bucket.arquivos.delete(caminho);
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
    username: "conta_do_video",
    name: "Vídeo",
    profile_picture_url: null,
    access_token: "ig-token-do-video",
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
    partes: new Map(),
    fins: [],
    posts: [],
    respostasDasPartes: [],
    respostaDoFim: null,
    estadoDoVideo: { status: 200, corpo: '{"status":"AVAILABLE"}' },
    respostaDoPost: null,
    enderecoDasPartes: null,
    desconhecidos: [],
  });
  bucket.arquivos = new Map([[VIDEO, BYTES_DO_VIDEO]]);
  bucket.apagados = [];
  bucket.faixas = [];
  bucket.respostaDaFaixa = null;
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, 'Dra. Ana Souza', $3, now() + interval '60 days')`,
    [CONTA, PESSOA, TOKEN_DO_LINKEDIN]
  );
});

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000032";

/** Enfileira o vídeo para agora e devolve o id da linha. */
async function enfileirarOVideo(): Promise<string> {
  const r = await fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "video", caminhos: [VIDEO], texto: TEXTO, idDoEnvio: ENVIO }, null);
  if (!r.entrou) throw new Error("o vídeo não entrou na fila");
  return r.id;
}

const linha = async (id: string) =>
  (await q(
    `select status, attempts, error, payload, not_before > now() + interval '15 seconds' as espera, not_before > now() + interval '50 seconds' as espera_um_minuto
       from queue where id = $1`,
    [id]
  ))[0] as { status: string; attempts: number; error: string | null; payload: Record<string, unknown>; espera: boolean; espera_um_minuto: boolean };

/** A linha volta a valer já, como o tique seguinte a encontraria. */
const valerJa = (id: string) => q(`update queue set not_before = now() where id = $1`, [id]);

const caminhosDoLinkedin = () => linkedin.pedidos.map((p) => `${p.metodo} ${p.caminho.split("?")[0]}`);

/** Uma passada de cada vez, até a linha fechar; devolve os desfechos. */
async function passadasAteFechar(id: string, maximo = 12): Promise<string[]> {
  const desfechos: string[] = [];
  for (let i = 0; i < maximo; i++) {
    const d = await dreno.drenarUmaPublicacaoDoLinkedin(id);
    desfechos.push(String(d));
    if (d === "publicado" || d === "falhou") return desfechos;
    await valerJa(id);
  }
  return desfechos;
}

describe("o vídeo em partes no LinkedIn", () => {
  it("sai em passadas, uma etapa por vez: a reserva, cada parte, o fim e o post; o arquivo só sai do bucket no fim", async () => {
    const id = await enfileirarOVideo();

    expect(await passadasAteFechar(id)).toEqual(["aguardando", "aguardando", "aguardando", "aguardando", "aguardando", "publicado"]);

    expect(caminhosDoLinkedin()).toEqual([
      "POST /rest/videos",
      "PUT /parte/0",
      "PUT /parte/1",
      "PUT /parte/2",
      "POST /rest/videos",
      "POST /rest/posts",
    ]);
    // A reserva pediu o tamanho do arquivo; as partes levaram as faixas certas, SEM o token (o 234).
    expect(JSON.parse(linkedin.pedidos[0].corpo.toString())).toMatchObject({ initializeUploadRequest: { fileSizeBytes: 10 } });
    expect(bucket.faixas).toEqual(["0-3", "4-7", "8-9"]);
    expect([0, 1, 2].map((n) => Array.from(linkedin.partes.get(n) ?? []))).toEqual([
      [10, 11, 12, 13],
      [14, 15, 16, 17],
      [18, 19],
    ]);
    for (const p of linkedin.pedidos.filter((p) => p.metodo === "PUT")) expect(p.cabecalhos.authorization).toBeUndefined();
    // O fim levou os ETags na ordem; o post, o vídeo e o título pela regra do carrossel.
    expect(linkedin.fins[0]).toEqual({
      finalizeUploadRequest: { video: URN, uploadToken: "token-do-envio-falso", uploadedPartIds: ['"etag-0"', '"etag-1"', '"etag-2"'] },
    });
    expect(linkedin.posts[0]).toMatchObject({ author: `urn:li:person:${PESSOA}`, content: { media: { id: URN, title: tituloDoDocumento(TEXTO) } } });

    const l = await linha(id);
    expect(l.status).toBe("sent");
    expect(l.payload).toMatchObject({ video_urn: URN, video_finalizado: true, passadas_do_video: 5, etags: ['"etag-0"', '"etag-1"', '"etag-2"'] });
    expect(bucket.apagados).toEqual([VIDEO]);
  });

  it("entre as passadas, a linha volta já, com as tentativas zeradas, o motivo do vídeo subindo, e o arquivo ainda no bucket", async () => {
    const id = await enfileirarOVideo();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0, espera: false, error: fila.MOTIVO_VIDEO_SUBINDO });
    expect(l.payload).toMatchObject({ video_urn: URN, upload_token: "token-do-envio-falso", etags: [], passadas_do_video: 1 });
    expect((l.payload.partes as unknown[]).length).toBe(3);
    expect(typeof l.payload.primeira_passada_em).toBe("string");
    expect(bucket.apagados).toEqual([]);
  });

  it("dois erros passageiros, um avanço e mais dois: as tentativas zeram no avanço, e a linha segue até sair", async () => {
    const id = await enfileirarOVideo();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // a reserva
    await valerJa(id);
    linkedin.respostasDasPartes = [{ status: 503 }, { status: 503 }, { status: 200 }, { status: 503 }, { status: 503 }];

    for (let i = 0; i < 2; i++) {
      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
      await valerJa(id);
    }
    expect((await linha(id)).attempts).toBe(2);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // a parte 0 sai
    expect((await linha(id)).attempts).toBe(0);
    await valerJa(id);
    for (let i = 0; i < 2; i++) {
      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
      await valerJa(id);
    }
    expect(await linha(id)).toMatchObject({ status: "pending", attempts: 2 });

    expect(await passadasAteFechar(id)).toEqual(["aguardando", "aguardando", "aguardando", "publicado"]);
    expect((await linha(id)).status).toBe("sent");
  });

  it("sem tempo para a etapa (o 231): a linha volta sem gastar a tentativa, sem contar adiamento nem passada, com o payload igual", async () => {
    const id = await enfileirarOVideo();
    // O começo da função há 30 s: a hora de parar é daqui a 10 s, e a reserva pede 20.
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, Date.now() - 30_000)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0, espera: true, error: fila.MOTIVO_SEM_TEMPO });
    expect(l.payload.adiamentos).toBeUndefined();
    expect(l.payload.passadas_do_video).toBeUndefined();
    expect(l.payload.video_urn).toBeUndefined();
    expect(linkedin.pedidos).toEqual([]);
  });

  it("o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231), com a folga de 2 s (o 242) e o fim de duas chamadas (o 240)", () => {
    const prazo = 1_000_000 + 55_000;
    const aos = (s: number) => 1_000_000 + s * 1000;
    expect(fila.aEtapaDoVideoCabe("reserva", aos(17.999), prazo)).toBe(true);
    expect(fila.aEtapaDoVideoCabe("reserva", aos(18), prazo)).toBe(false);
    expect(fila.aEtapaDoVideoCabe("parte", aos(12.999), prazo)).toBe(true);
    expect(fila.aEtapaDoVideoCabe("parte", aos(13), prazo)).toBe(false);
    expect(fila.aEtapaDoVideoCabe("fim", aos(17.999), prazo)).toBe(true);
    expect(fila.aEtapaDoVideoCabe("fim", aos(18), prazo)).toBe(false);
    expect(fila.aEtapaDoVideoCabe("post", aos(27.999), prazo)).toBe(true);
    expect(fila.aEtapaDoVideoCabe("post", aos(28), prazo)).toBe(false);
  });
});

describe("os erros de cada etapa do vídeo (o 238)", () => {
  async function reservado(): Promise<string> {
    const id = await enfileirarOVideo();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    await valerJa(id);
    linkedin.pedidos = [];
    return id;
  }

  it("a parte recusada com 403 encerra a linha com o motivo próprio, sem pedir o convite de novo", async () => {
    const id = await reservado();
    linkedin.respostasDasPartes = [{ status: 403 }];
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_PARTE_RECUSADA });
    expect(bucket.apagados).toEqual([]);
  });

  it("a parte aceita sem o ETag encerra a linha", async () => {
    const id = await reservado();
    linkedin.respostasDasPartes = [{ status: 200, semEtag: true }];
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("sem o ETag");
  });

  it("o endereço de uma parte fora do LinkedIn (um payload torto) encerra a linha, e a parte não sai", async () => {
    const id = await reservado();
    await q(`update queue set payload = jsonb_set(payload, '{partes,0,url}', '"https://www.exemplo.com/parte"') where id = $1`, [id]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("não é do LinkedIn");
    expect(caminhosDoLinkedin()).toEqual([]);
  });

  it("a faixa que volta com 200 é erro passageiro: a linha volta, e nada vai ao LinkedIn", async () => {
    const id = await reservado();
    bucket.respostaDaFaixa = 200;
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 1 });
    expect(l.error).toContain("faixa");
    expect(caminhosDoLinkedin()).toEqual([]);
  });

  it("a conexão vencida encerra antes de chamar o LinkedIn, pedindo o convite de novo, como hoje", async () => {
    const id = await enfileirarOVideo();
    await q(`update linkedin_conexoes set expira_em = now() - interval '1 day' where account_id = $1`, [CONTA]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect((await linha(id)).error).toContain("mande o convite de novo");
    expect(linkedin.pedidos).toEqual([]);
  });
  it("três erros passageiros SEGUIDOS, sem avanço entre eles, encerram a linha (o 247)", async () => {
    const id = await reservado();
    linkedin.respostasDasPartes = [{ status: 503 }, { status: 503 }, { status: 503 }];
    for (let i = 0; i < 2; i++) {
      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
      await valerJa(id);
    }
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect((await linha(id)).status).toBe("failed");
    expect(bucket.apagados).toEqual([]);
  });

  it("o erro de rede de uma parte vai para a linha com um texto fixo, sem o endereço do envio (o 243)", async () => {
    const id = await reservado();
    linkedin.enderecoDasPartes = null;
    await q(`update queue set payload = jsonb_set(payload, '{partes,0,url}', '"http://127.0.0.1:10/parte-que-ninguem-ouve"') where id = $1`, [id]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    const l = await linha(id);
    expect(l.error).toContain("o envio da parte do vídeo falhou na rede");
    expect(l.error).not.toContain("127.0.0.1");
    expect(l.error).not.toContain("parte-que-ninguem-ouve");
  });
});

describe("os tetos do vídeo (o 230 e o 237)", () => {
  it("a linha que passou do teto das passadas encerra com o motivo", async () => {
    const id = await enfileirarOVideo();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    await q(`update queue set not_before = now(), payload = payload || '{"passadas_do_video": 13}'::jsonb where id = $1`, [id]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_PASSADAS_DEMAIS });
  });

  it("o vídeo de mais de 2 horas desde a primeira passada encerra com o motivo", async () => {
    const id = await enfileirarOVideo();
    await q(
      `update queue set payload = payload || jsonb_build_object('primeira_passada_em', to_json(now() - interval '3 hours') #>> '{}') where id = $1`,
      [id]
    );
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_VELHO });
  });
});

describe("o fim e o post do vídeo", () => {
  async function comTodasAsPartes(): Promise<string> {
    const id = await enfileirarOVideo();
    for (let i = 0; i < 4; i++) {
      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
      await valerJa(id);
    }
    linkedin.pedidos = [];
    return id;
  }

  it("o fim perdido (o 233): com a marca e sem o fim, o 4xx consulta o estado, e AVAILABLE conta como fim", async () => {
    const id = await comTodasAsPartes();
    await q(`update queue set payload = payload || jsonb_build_object('fim_tentado_em', now()::text) where id = $1`, [id]);
    linkedin.respostaDoFim = { status: 400, corpo: '{"message":"o envio já foi finalizado"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    expect(caminhosDoLinkedin()).toEqual(["POST /rest/videos", "GET /rest/videos/" + encodeURIComponent(URN)]);
    expect((await linha(id)).payload).toMatchObject({ video_finalizado: true });
    await valerJa(id);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");
  });

  it("o fim perdido com o estado que não se lê encerra dizendo que o vídeo pode ter subido", async () => {
    const id = await comTodasAsPartes();
    await q(`update queue set payload = payload || jsonb_build_object('fim_tentado_em', now()::text) where id = $1`, [id]);
    linkedin.respostaDoFim = { status: 400, corpo: "{}" };
    linkedin.estadoDoVideo = { status: 403, corpo: "{}" };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_PODE_TER_SUBIDO });
  });

  it("o fim recusado na primeira vez encerra com o erro do LinkedIn, sem consultar o estado", async () => {
    const id = await comTodasAsPartes();
    linkedin.respostaDoFim = { status: 400, corpo: '{"message":"partes erradas"}' };
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(caminhosDoLinkedin()).toEqual(["POST /rest/videos"]);
    expect((await linha(id)).status).toBe("failed");
  });

  it("o vídeo que o LinkedIn ainda processa: a linha espera um minuto, a consulta conta, e a passada não conta (o 237)", async () => {
    const id = await comTodasAsPartes();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
    await valerJa(id);
    const passadas = (await linha(id)).payload.passadas_do_video;
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", espera_um_minuto: true, error: fila.MOTIVO_VIDEO_PROCESSANDO });
    expect(l.payload).toMatchObject({ consultas_da_midia: 1, passadas_do_video: passadas });
    expect(l.payload.post_tentado_em).toBeUndefined();
  });

  it("o fim conta as duas chamadas (o 240): aos 25 s ele não começa mais, e a linha volta sem chamar o LinkedIn", async () => {
    const id = await comTodasAsPartes();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, Date.now() - 25_000)).toBe("aguardando");
    expect(linkedin.pedidos).toEqual([]);
    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", error: fila.MOTIVO_SEM_TEMPO });
    expect(l.payload.video_finalizado).toBeUndefined();
    expect(l.payload.fim_tentado_em).toBeUndefined();
  });

  it("o post não cai no teto das passadas (o 241): o fim foi a última passada permitida, e o post publica", async () => {
    const id = await comTodasAsPartes();
    // As 3 partes dão o teto de 12 passadas, que só encerra quando PASSA dele: com 12 contadas, o fim ainda começa e
    // vira a 13ª. Sem a correção, a passada do post, com 13, encerraria o vídeo já finalizado.
    await q(`update queue set payload = payload || '{"passadas_do_video": 12}'::jsonb where id = $1`, [id]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim, a 13ª
    expect((await linha(id)).payload).toMatchObject({ video_finalizado: true, passadas_do_video: 13 });
    await valerJa(id);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");
    expect((await linha(id)).status).toBe("sent");
  });

  it("a consulta do estado que falha de passagem (429) não encerra o fim perdido (o 244): a linha volta à fila", async () => {
    const id = await comTodasAsPartes();
    await q(`update queue set payload = payload || jsonb_build_object('fim_tentado_em', now()::text) where id = $1`, [id]);
    linkedin.respostaDoFim = { status: 400, corpo: "{}" };
    linkedin.estadoDoVideo = { status: 429, corpo: "{}" };
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 1 });
    expect(l.payload.video_finalizado).toBeUndefined();
  });

  it("na décima primeira consulta, a linha encerra com o motivo do vídeo", async () => {
    const id = await comTodasAsPartes();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
    await q(`update queue set not_before = now(), payload = payload || '{"consultas_da_midia": 10}'::jsonb where id = $1`, [id]);
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_NAO_FICOU_PRONTO });
  });

  it("o vídeo que o LinkedIn não conseguiu processar encerra com o motivo que diz o que conferir", async () => {
    const id = await comTodasAsPartes();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
    await valerJa(id);
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_PROCESSING_FAILED"}' };
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_PROCESSAMENTO_FALHOU });
    expect(bucket.apagados).toEqual([]);
  });
});
