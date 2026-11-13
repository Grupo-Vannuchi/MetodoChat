// O POST NAS DUAS REDES (`publicarNasDuasRedes`, app/publicar/actions.ts; docs/specs/2026-11-06-linkedin-no-perfil.md,
// §6 e §7; a parte 2b). Uma linha por rede, cada uma com a sua chave; a linha do LinkedIn leva uma CÓPIA da imagem,
// porque o dreno do Instagram apaga o original depois de publicar; e, quando uma parte falha no meio, a ordem do
// achado 192 com a compensação do 199: a linha do LinkedIn só é desfeita se ainda estiver pendente.
//
// A MAQUINARIA É A DE `linkedin-compor.integracao.ts` e a de `publicar-fala.integracao.ts`: a action de verdade num
// contexto de requisição, com a sessão de teste (administrador) ou a do login COMUM de teste. Um servidor falso no
// loopback faz as três pontas: a Meta (`IG_GRAPH_BASE`), o LinkedIn (`LINKEDIN_API_BASE`) e o bucket
// (`SUPABASE_URL`), com os objetos guardados num mapa; o `fetch` recusa qualquer outro endereço. **NADA AQUI PUBLICA
// NO INSTAGRAM NEM NO LINKEDIN DE VERDADE, E NADA É ESCRITO NO BUCKET DE VERDADE.**
//
// OS GATILHOS DE TESTE (as falhas no meio): cada um nasce e morre DENTRO do caso, num try/finally, e o nome começa
// com "teste_"; o `afterAll` confere que nenhum sobrou no schema.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/publicar/actions");
type ModuloRedes = typeof import("@/lib/redes-do-post");
type ModuloLinkedin = typeof import("@/lib/linkedin-publicacao");
type ModuloPublicacao = typeof import("@/lib/publicacao");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA_A = "17800000000026201";
const CONTA_B = "17800000000026202";
const BUCKET = "midia-das-duas-redes";
const CHAVE_DO_BUCKET = "chave-do-bucket-das-duas-redes-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDasDuasRedesQueNaoValeNada";
const ENVIO = "9f1c2e3d-0000-4000-8000-0000000002b1";
const ORIGINAL = `${CONTA_A}/foto-do-post.jpg`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const COPIA = new RegExp(`^${CONTA_A}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`);

const meta = { containers: 0, publicacoes: 0, desconhecidos: [] as string[] };
const linkedin = { pedidos: [] as string[], atrasoMs: 0 };
const bucket = {
  objetos: new Map<string, Uint8Array>(),
  chamadas: [] as string[],
  recusarSubida: false,
  // A PARTE 3a: só a primeira subida que chegar é recusada; as outras podem esperar antes de terminar; e o download
  // pode ser lento (o "agora" do carrossel com as cópias passando de 3 s).
  recusarUmaSubida: false,
  atrasoDaSubidaMs: 0,
  atrasoDaBaixadaMs: 0,
};

let servidorFalso: Server;
let acoes: ModuloAcoes;
let redes: ModuloRedes;
let regrasDoLinkedin: ModuloLinkedin;
let publicacao: ModuloPublicacao;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

beforeAll(async () => {
  servidorFalso = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const pedacos: Buffer[] = [];
    for await (const parte of req) pedacos.push(parte as Buffer);
    const corpo = Buffer.concat(pedacos);
    const porta = (servidorFalso.address() as AddressInfo).port;
    const depois = (prefixo: string) => decodeURIComponent(u.pathname.slice(prefixo.length));

    // O BUCKET: assinar, subir, baixar pelo endereço público e apagar.
    const assinar = `/storage/v1/object/upload/sign/${BUCKET}/`;
    if (req.method === "POST" && u.pathname.startsWith(assinar)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      bucket.chamadas.push(`assinou ${depois(assinar)}`);
      return responder(res, 200, { url: `/object/upload/sign/${BUCKET}/${depois(assinar)}?token=tk`, token: "tk" });
    }
    if (req.method === "PUT" && u.pathname.startsWith(assinar)) {
      bucket.chamadas.push(`subiu ${depois(assinar)}`);
      if (bucket.recusarSubida) return responder(res, 400, { message: "o bucket falso recusou de propósito" });
      if (bucket.recusarUmaSubida) {
        bucket.recusarUmaSubida = false;
        return responder(res, 400, { message: "o bucket falso recusou esta subida de propósito" });
      }
      if (bucket.atrasoDaSubidaMs) await esperar(bucket.atrasoDaSubidaMs);
      bucket.objetos.set(depois(assinar), new Uint8Array(corpo));
      return responder(res, 200, { Key: depois(assinar) });
    }
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      bucket.chamadas.push(`baixou ${depois(publico)}`);
      if (bucket.atrasoDaBaixadaMs) await esperar(bucket.atrasoDaBaixadaMs);
      const objeto = bucket.objetos.get(depois(publico));
      if (!objeto) return responder(res, 400, { message: "Object not found" });
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(Buffer.from(objeto));
    }
    const objeto = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(objeto)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      bucket.chamadas.push(`apagou ${depois(objeto)}`);
      bucket.objetos.delete(depois(objeto));
      return responder(res, 200, { message: "ok" });
    }

    // O LINKEDIN: reservar a imagem, enviá-la e publicar.
    if (u.pathname.startsWith("/rest/") || u.pathname.startsWith("/envio/")) {
      linkedin.pedidos.push(`${req.method} ${u.pathname}`);
      if (linkedin.atrasoMs) await esperar(linkedin.atrasoMs);
      if (req.method === "POST" && u.pathname === "/rest/images") {
        return responder(res, 200, {
          value: { uploadUrl: `http://127.0.0.1:${porta}/envio/C4E10AQduas`, image: "urn:li:image:DasDuasRedes" },
        });
      }
      if (req.method === "PUT" && u.pathname === "/envio/C4E10AQduas") return responder(res, 201, "");
      // O DOCUMENTO DO CARROSSEL (a parte 3a), para o caso de a passada da mídia caber no "agora".
      if (req.method === "POST" && u.pathname === "/rest/documents") {
        return responder(res, 200, {
          value: { uploadUrl: `http://127.0.0.1:${porta}/envio/D5510duas`, document: "urn:li:document:DasDuasRedes" },
        });
      }
      if (req.method === "PUT" && u.pathname === "/envio/D5510duas") return responder(res, 201, "");
      if (req.method === "POST" && u.pathname === "/rest/posts") {
        return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000000262" });
      }
      return responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
    }

    // A META: o contêiner, a publicação, a cota e o estado do contêiner (sempre pronto).
    const partes = u.pathname.split("/").filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? "";
    if (req.method === "POST" && ultimo === "media") {
      meta.containers++;
      return responder(res, 200, { id: `container-duas-${meta.containers}` });
    }
    if (req.method === "POST" && ultimo === "media_publish") {
      meta.publicacoes++;
      return responder(res, 200, { id: `media-duas-${meta.publicacoes}` });
    }
    if (req.method === "GET" && ultimo === "content_publishing_limit") {
      return responder(res, 200, { config: { quota_total: 100, quota_duration: 86400 }, quota_usage: 0 });
    }
    if (req.method === "GET" && (u.searchParams.get("fields") ?? "").includes("status_code")) {
      return responder(res, 200, { id: ultimo, status_code: "FINISHED" });
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { error: { message: `o falso não conhece ${u.pathname}` } });
  });
  await new Promise<void>((pronto) => servidorFalso.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidorFalso.address() as AddressInfo).port}`;
  process.env.LINKEDIN_API_BASE = base;
  process.env.IG_GRAPH_BASE = base;
  process.env.SUPABASE_URL = base;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  // Sem token, `scheduleTick` não sai da máquina: o agendado fica na fila do banco de teste.
  delete process.env.QSTASH_TOKEN;

  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  // AS TRÊS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO: sem os desvios, este teste falaria com as redes de verdade.
  const li = await import("@/lib/linkedin");
  if (li.basesDoLinkedin().api !== base) throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada.");
  const ig = await import("@/lib/ig");
  if (ig.baseDoGraph() !== base) throw new Error("RECUSADO: a base do Graph não é a desta rodada.");
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) throw new Error("RECUSADO: o bucket não é loopback.");

  acoes = await import("@/app/publicar/actions");
  redes = await import("@/lib/redes-do-post");
  regrasDoLinkedin = await import("@/lib/linkedin-publicacao");
  publicacao = await import("@/lib/publicacao");

  for (const [id, nome] of [
    [CONTA_A, "conta_a_das_duas_redes"],
    [CONTA_B, "conta_b_das_duas_redes"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: `token-de-${nome}-que-nao-vale-nada`,
      token_expires_at: null,
    });
  }
});

afterAll(async () => {
  // NENHUM GATILHO DE TESTE SOBROU: cada um morre no `finally` do próprio caso.
  const gatilhos = await q(`select tgname from pg_trigger where tgname like 'teste\\_%'`);
  const funcoes = await q(
    `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.proname like 'teste\\_%' and n.nspname = current_schema()`
  );
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "IG_GRAPH_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) {
    delete process.env[v];
  }
  await new Promise<void>((pronto) => servidorFalso.close(() => pronto()));
  expect(gatilhos).toEqual([]);
  expect(funcoes).toEqual([]);
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await conectar(CONTA_A);
  meta.containers = 0;
  meta.publicacoes = 0;
  meta.desconhecidos = [];
  linkedin.pedidos = [];
  linkedin.atrasoMs = 0;
  bucket.objetos = new Map([[ORIGINAL, JPEG]]);
  bucket.chamadas = [];
  bucket.recusarSubida = false;
  bucket.recusarUmaSubida = false;
  bucket.atrasoDaSubidaMs = 0;
  bucket.atrasoDaBaixadaMs = 0;
});

async function conectar(conta: string) {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDasDuasRedes', 'Dra. Ana Souza', $2, now() + interval '30 days')
     on conflict (account_id) do update set expira_em = excluded.expira_em`,
    [conta, TOKEN_DO_LINKEDIN]
  );
}

type Linha = { id: string; account_id: string; kind: string; status: string; error: string | null; dedupe_key: string; not_before: Date; payload: Record<string, unknown> };
const linhas = () =>
  q(`select id, account_id, kind, status, error, dedupe_key, not_before, payload from queue order by created_at, kind`) as Promise<Linha[]>;
const daRede = async (kind: string) => (await linhas()).filter((l) => l.kind === kind);

/** Daqui a 2 horas, no minuto cheio, no fuso 0: o agendado que ninguém drena. */
function daquiA2Horas(): Record<string, string> {
  const alvo = new Date(Date.now() + 2 * 3600 * 1000);
  alvo.setUTCSeconds(0, 0);
  return { quando: "depois", data_hora: alvo.toISOString().slice(0, 16), fuso: "0" };
}

/** O formulário como a tela o manda com as duas caixinhas marcadas (app/publicar/enviador.tsx). */
function formulario(campos: Partial<Record<string, string>> = {}): FormData {
  const f = new FormData();
  const tudo: Record<string, string> = {
    forma: "imagem",
    caminhos: ORIGINAL,
    legenda: "A legenda do post #fotografia",
    texto_linkedin: "",
    id_do_envio: ENVIO,
    rede_instagram: "1",
    rede_linkedin: "1",
    quando: "agora",
    data_hora: "",
    fuso: "0",
  };
  for (const [k, v] of Object.entries({ ...tudo, ...campos })) if (v !== undefined) f.set(k, v);
  return f;
}

/** O aviso que viajou na URL do `redirect()`. */
function avisoDoDigest(valor: string | null): { texto: string | null; tom: string | null } {
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return { texto: null, tom: null };
  const sp = new URL(valor.split(";").slice(2, -2).join(";"), "http://127.0.0.1").searchParams;
  return { texto: sp.get("aviso"), tom: sp.get("tom") };
}

async function capturar(acao: () => Promise<void>): Promise<string | null> {
  try {
    await acao();
    return null;
  } catch (e) {
    const digest = (e as { digest?: unknown }).digest;
    if (typeof digest === "string") return digest;
    throw e;
  }
}

async function nasDuasComoAdministrador(form: FormData) {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicarNasDuasRedes(form)));
  return avisoDoDigest(valor);
}

async function nasDuasComoComum(form: FormData, contas: string[], contaDoCookie?: string) {
  const { valor } = await comoNumaRequisicaoComoComum("/publicar/novo", () => capturar(() => acoes.publicarNasDuasRedes(form)), {
    contas,
    contaDoCookie,
  });
  return avisoDoDigest(valor);
}

/** O GATILHO DE TESTE do caso: nasce, o caso roda, e ele morre no `finally`, mesmo que o caso falhe. */
async function comGatilho(nome: string, momento: "before" | "after", corpoDaFuncao: string, caso: () => Promise<void>) {
  if (!/^teste_[a-z_]+$/.test(nome)) throw new Error(`o gatilho de teste tem de começar com teste_: ${nome}`);
  await q(`create function ${nome}() returns trigger language plpgsql as $$ begin ${corpoDaFuncao} end $$`);
  await q(`create trigger ${nome} ${momento} insert on queue for each row execute function ${nome}()`);
  try {
    await caso();
  } finally {
    await q(`drop trigger if exists ${nome} on queue`);
    await q(`drop function if exists ${nome}()`);
  }
}

const RECUSA_DO_INSTAGRAM = `if new.kind = 'publicacao' then raise exception 'o banco de teste recusou a linha do Instagram'; end if; return new;`;

// ---------------------------------------------------------------------------------------------------------------

describe("publicar agora nas duas redes", () => {
  it("as duas linhas entram e saem: o LinkedIn com a cópia, o Instagram com o original, e o aviso diz as duas", async () => {
    const aviso = await nasDuasComoAdministrador(formulario());
    expect(aviso).toEqual(
      redes.avisoDasDuasRedes({
        tipo: "entrou",
        campos: null,
        instagram: { entrou: true, jaVale: true },
        linkedin: { entrou: true, jaVale: true, desfecho: "publicado" },
      })
    );
    const [ig] = await daRede("publicacao");
    const [li] = await daRede("publicacao_linkedin");
    expect(ig).toMatchObject({ account_id: CONTA_A, status: "sent" });
    expect(li).toMatchObject({ account_id: CONTA_A, status: "sent" });
    expect(ig.payload.caminhos).toEqual([ORIGINAL]);
    expect(ig.payload.legenda).toBe("A legenda do post #fotografia");
    // A CÓPIA: outro caminho, na mesma pasta, no formato do /publicar; e a chave é a do caminho ORIGINAL.
    const [copia] = li.payload.caminhos as string[];
    expect(copia).toMatch(COPIA);
    expect(li.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:imagem:${ORIGINAL}`);
    // Sem o texto próprio, o LinkedIn leva a legenda.
    expect(li.payload.texto).toBe("A legenda do post #fotografia");
    expect(linkedin.pedidos).toEqual(["POST /rest/images", "PUT /envio/C4E10AQduas", "POST /rest/posts"]);
    expect(meta).toMatchObject({ containers: 1, publicacoes: 1, desconhecidos: [] });
    // Cada dreno apagou só o arquivo da própria linha, e nada sobrou no bucket.
    expect(bucket.chamadas).toContain(`apagou ${copia}`);
    expect(bucket.chamadas).toContain(`apagou ${ORIGINAL}`);
    expect([...bucket.objetos.keys()]).toEqual([]);
  });

  it("o LinkedIn sai primeiro, só a própria linha (211), e o Instagram sai depois, no dreno de hoje", async () => {
    await nasDuasComoAdministrador(formulario());
    const [li] = await daRede("publicacao_linkedin");
    const [copia] = li.payload.caminhos as string[];
    // Cada dreno apaga o arquivo da própria linha logo depois do `sent`: a ordem dos apagados é a ordem das saídas.
    expect(bucket.chamadas.filter((c) => c.startsWith("apagou"))).toEqual([`apagou ${copia}`, `apagou ${ORIGINAL}`]);
  });

  it("o mesmo envio de novo, depois do agora: as duas redes dizem que já existia, sem cópia nova e sem baixar nada", async () => {
    await nasDuasComoAdministrador(formulario());
    bucket.chamadas = [];
    linkedin.pedidos = [];
    const aviso = await nasDuasComoAdministrador(formulario());
    expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "entrou", campos: null, instagram: { entrou: false }, linkedin: { entrou: false } }));
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toHaveLength(2);
    expect(bucket.chamadas).toEqual([]);
    expect(linkedin.pedidos).toEqual([]);
  });

  it("o tempo do agora das duas, com o LinkedIn falso lento (2 s por chamada): as duas saem, e a action termina longe do prazo", async () => {
    linkedin.atrasoMs = 2_000;
    const inicio = Date.now();
    const aviso = await nasDuasComoAdministrador(formulario());
    const levou = Date.now() - inicio;
    console.log(`O AGORA DAS DUAS REDES, com o LinkedIn falso a 2 s por chamada: ${levou} ms`);
    expect(aviso.tom).toBe("ok");
    expect((await linhas()).map((l) => l.status)).toEqual(["sent", "sent"]);
    expect(levou).toBeLessThan(20_000);
  }, 60_000);
});

describe("agendar nas duas redes", () => {
  it("as duas linhas entram pendentes para a mesma hora, ninguém fala com as redes, e a cópia fica para o LinkedIn", async () => {
    const hora = daquiA2Horas();
    const aviso = await nasDuasComoAdministrador(formulario(hora));
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("Instagram: Publicação agendada para");
    expect(aviso.texto).toContain("LinkedIn: Post do LinkedIn agendado para");
    const [a, b] = await linhas();
    expect([a.status, b.status]).toEqual(["pending", "pending"]);
    expect(a.not_before.getTime()).toBe(b.not_before.getTime());
    const [li] = await daRede("publicacao_linkedin");
    const [copia] = li.payload.caminhos as string[];
    expect(copia).toMatch(COPIA);
    expect([...bucket.objetos.keys()].sort()).toEqual([ORIGINAL, copia].sort());
    expect(linkedin.pedidos).toEqual([]);
    expect(meta.containers).toBe(0);
  });

  it("o texto próprio vai ao LinkedIn, e a legenda ao Instagram", async () => {
    await nasDuasComoAdministrador(formulario({ ...daquiA2Horas(), texto_linkedin: "  O texto do LinkedIn #carreira  " }));
    expect((await daRede("publicacao_linkedin"))[0].payload.texto).toBe("O texto do LinkedIn #carreira");
    expect((await daRede("publicacao"))[0].payload.legenda).toBe("A legenda do post #fotografia");
  });

  it("o mesmo envio agendado de novo: já existia nas duas, e nenhuma cópia nova sobra", async () => {
    const hora = daquiA2Horas();
    await nasDuasComoAdministrador(formulario(hora));
    const antes = [...bucket.objetos.keys()].sort();
    bucket.chamadas = [];
    const aviso = await nasDuasComoAdministrador(formulario(hora));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto?.match(/Nada foi duplicado/g)).toHaveLength(2);
    expect(await linhas()).toHaveLength(2);
    expect([...bucket.objetos.keys()].sort()).toEqual(antes);
    expect(bucket.chamadas).toEqual([]);
  });

  it("a chave repetida só no Instagram: o LinkedIn entra, e a tela diz que o Instagram já existia", async () => {
    const hora = daquiA2Horas();
    const soInstagram = new FormData();
    for (const [k, v] of Object.entries({ forma: "imagem", caminhos: ORIGINAL, legenda: "A legenda do post #fotografia", ...hora })) {
      soInstagram.set(k, v);
    }
    await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicar(soInstagram)));
    const aviso = await nasDuasComoAdministrador(formulario(hora));
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain(`Instagram: ${publicacao.textoDaRecusaDaPublicacao("ja_enfileirado")}`);
    expect(aviso.texto).toContain("LinkedIn: Post do LinkedIn agendado para");
    expect(await daRede("publicacao")).toHaveLength(1);
    expect(await daRede("publicacao_linkedin")).toHaveLength(1);
  });
});

describe("a ordem quando uma parte falha (192 e 199)", () => {
  it("a cópia que falha: nada é gravado, e a tela diz o motivo", async () => {
    bucket.recusarSubida = true;
    const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("Nada foi agendado");
    expect(aviso.texto).toContain("HTTP 400");
    expect(await linhas()).toEqual([]);
    expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
  });

  it("a linha do LinkedIn que o banco recusa: a cópia sai do bucket, e nada foi agendado", async () => {
    await comGatilho(
      "teste_recusa_o_linkedin",
      "before",
      `if new.kind = 'publicacao_linkedin' then raise exception 'o banco de teste recusou a linha do LinkedIn'; end if; return new;`,
      async () => {
        const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
        expect(aviso.tom).toBe("erro");
        expect(aviso.texto).toContain("Nada foi agendado");
        expect(await linhas()).toEqual([]);
        expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
      }
    );
  });

  it("o conflito na chave do LinkedIn depois da conferência (dois cliques juntos): a cópia sai, e o Instagram segue", async () => {
    await comGatilho(
      "teste_conflito_no_linkedin",
      "before",
      `if new.kind = 'publicacao_linkedin' and pg_trigger_depth() = 1 then
         insert into queue (account_id, kind, payload, dedupe_key, status)
         values (new.account_id, 'publicacao_linkedin', new.payload, new.dedupe_key, 'pending');
       end if;
       return new;`,
      async () => {
        const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
        expect(aviso.texto).toContain("LinkedIn: O post do LinkedIn já estava na fila. Nada foi duplicado.");
        expect(aviso.texto).toContain("Instagram: Publicação agendada para");
        expect(await daRede("publicacao")).toHaveLength(1);
        expect(await daRede("publicacao_linkedin")).toHaveLength(1);
        expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
      }
    );
  });

  it("o Instagram que o banco recusa, com o LinkedIn pendente: o LinkedIn é desfeito, a cópia sai, e nada foi agendado", async () => {
    await comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
      const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
      expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" }));
      const [li] = await daRede("publicacao_linkedin");
      expect(li.status).toBe("skipped");
      expect(li.error).toContain("Instagram");
      expect(await daRede("publicacao")).toEqual([]);
      expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
    });
  });

  it("o Instagram recusado com o LinkedIn já pego por um dreno: a linha segue, a cópia fica, e a tela diz que ele segue", async () => {
    await comGatilho(
      "teste_dreno_pegou_o_linkedin",
      "after",
      `if new.kind = 'publicacao_linkedin' then update queue set status = 'sending', claimed_at = now() where id = new.id; end if; return null;`,
      () =>
        comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
          const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
          expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "seguiu" }));
          const [li] = await daRede("publicacao_linkedin");
          expect(li.status).toBe("sending");
          const [copia] = li.payload.caminhos as string[];
          expect([...bucket.objetos.keys()].sort()).toEqual([ORIGINAL, copia].sort());
        })
    );
  });

  it("o Instagram recusado com o LinkedIn que já estava na fila antes: ele não é mexido, e nenhuma cópia é feita", async () => {
    const hora = daquiA2Horas();
    const soLinkedin = new FormData();
    for (const [k, v] of Object.entries({ forma_linkedin: "imagem", caminhos: ORIGINAL, texto: "O post do LinkedIn", id_do_envio: ENVIO, ...hora })) {
      soLinkedin.set(k, v);
    }
    await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicarNoLinkedin(soLinkedin)));
    bucket.chamadas = [];
    await comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
      const aviso = await nasDuasComoAdministrador(formulario(hora));
      expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "ja_existia" }));
      const [li] = await daRede("publicacao_linkedin");
      expect(li.status).toBe("pending");
      expect(li.payload.caminhos).toEqual([ORIGINAL]);
      expect(bucket.chamadas).toEqual([]);
    });
  });
});

describe("as recusas: nenhuma linha entra, e o bucket e as redes não são chamados", () => {
  const casos: [string, Partial<Record<string, string>>, (t: string | null) => void][] = [
    ["a imagem de outra conta (descartada antes de copiar)", { caminhos: `${CONTA_B}/foto-do-post.jpg` }, (t) => expect(t).toBeTruthy()],
    ["sem a imagem", { caminhos: "" }, (t) => expect(t).toBeTruthy()],
    ["o reels, que o LinkedIn ainda não recebe", { forma: "reels" }, (t) => expect(t).toContain("próxima entrega")],
    ["o carrossel com vídeo, que o PDF do LinkedIn não leva", { forma: "carrossel", caminhos: `${ORIGINAL}\n${CONTA_A}/video-do-post.mp4` }, (t) =>
      expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("carrossel_com_video"))],
    ["o story", { forma: "story" }, (t) => expect(t).toContain("não tem story")],
    ["o texto vazio nas duas (a legenda e o texto próprio)", { legenda: "", texto_linkedin: "  " }, (t) =>
      expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("texto_vazio"))],
    ["o texto próprio longo depois das hashtags", { texto_linkedin: `${"a".repeat(2990)} #ab #cd` }, (t) =>
      expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("texto_longo"))],
    ["o envio sem id", { id_do_envio: "" }, (t) => expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("envio_sem_id"))],
    ["a hora no passado", { quando: "depois", data_hora: "2020-01-01T10:00", fuso: "0" }, (t) => expect(t).toBeTruthy()],
  ];
  for (const [nome, campos, conferir] of casos) {
    it(nome, async () => {
      const aviso = await nasDuasComoAdministrador(formulario(campos));
      expect(aviso.tom).toBe("erro");
      conferir(aviso.texto);
      expect(await linhas()).toEqual([]);
      expect(bucket.chamadas).toEqual([]);
      expect(linkedin.pedidos).toEqual([]);
    });
  }

  it("a conta sem LinkedIn conectado", async () => {
    await q(`delete from linkedin_conexoes`);
    const aviso = await nasDuasComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("não tem LinkedIn conectado");
    expect(await linhas()).toEqual([]);
    expect(bucket.chamadas).toEqual([]);
  });
});

describe("a regra das contas: a conta vem da sessão, e nunca do formulário", () => {
  it("o login comum com a conta publica nas duas, nela", async () => {
    const aviso = await nasDuasComoComum(formulario(daquiA2Horas()), [CONTA_A]);
    expect(aviso.tom).toBe("ok");
    expect((await linhas()).map((l) => l.account_id)).toEqual([CONTA_A, CONTA_A]);
  });

  it("o login comum só com outra conta não publica na conta que ele não vê, nem copia a imagem dela", async () => {
    const aviso = await nasDuasComoComum(formulario({ ...daquiA2Horas(), conta: CONTA_A }), [CONTA_B], CONTA_A);
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
    expect(bucket.chamadas).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// O CARROSSEL NAS DUAS REDES (a parte 3a; scratchpad/desenho-li3.md, "As duas redes"): a linha do LinkedIn leva uma
// cópia de cada foto, feitas em paralelo e na ordem das originais; a chave continua pelos caminhos ORIGINAIS, e a
// ordem do 192 e do 199 não muda; quando uma cópia falha, as que deram certo saem do bucket, e nada é gravado.

const FOTOS = [1, 2, 3].map((n) => `${CONTA_A}/foto-${n}-do-carrossel.jpg`);
const bytesDaFoto = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x10 + n, 0xff, 0xd9]);
const comAsFotos = () => FOTOS.forEach((caminho, i) => bucket.objetos.set(caminho, bytesDaFoto(i + 1)));
const carrossel = (campos: Partial<Record<string, string>> = {}) => formulario({ forma: "carrossel", caminhos: FOTOS.join("\n"), ...campos });
const soAsOriginais = () => [ORIGINAL, ...FOTOS].sort();
const apagadas = () => bucket.chamadas.filter((c) => c.startsWith("apagou ")).map((c) => c.slice("apagou ".length));

describe("o carrossel nas duas redes (a parte 3a)", () => {
  it("agendado: o LinkedIn leva uma cópia de cada foto, na ordem, e a chave é a das originais", async () => {
    comAsFotos();
    const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("Instagram: Publicação agendada para");
    expect(aviso.texto).toContain("LinkedIn: Post do LinkedIn agendado para");
    const [ig] = await daRede("publicacao");
    const [li] = await daRede("publicacao_linkedin");
    expect(ig.payload.caminhos).toEqual(FOTOS);
    expect(li.payload.forma).toBe("carrossel");
    const copias = li.payload.caminhos as string[];
    expect(copias).toHaveLength(3);
    for (const [i, copia] of copias.entries()) {
      expect(copia).toMatch(COPIA);
      expect(Array.from(bucket.objetos.get(copia) ?? [])).toEqual(Array.from(bytesDaFoto(i + 1)));
    }
    expect(li.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:carrossel:${FOTOS.join(",")}`);
    expect(linkedin.pedidos).toEqual([]);
    expect(meta.containers).toBe(0);
  });

  it("o mesmo carrossel de novo: já existia nas duas, pela chave das originais, e nenhuma cópia nova é feita", async () => {
    comAsFotos();
    const hora = daquiA2Horas();
    await nasDuasComoAdministrador(carrossel(hora));
    const antes = [...bucket.objetos.keys()].sort();
    bucket.chamadas = [];
    const aviso = await nasDuasComoAdministrador(carrossel(hora));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto?.match(/Nada foi duplicado/g)).toHaveLength(2);
    expect(await linhas()).toHaveLength(2);
    expect([...bucket.objetos.keys()].sort()).toEqual(antes);
    expect(bucket.chamadas).toEqual([]);
  });

  it("agora, com as cópias passando de 3 s: o Instagram sai, e o LinkedIn fica aguardando, adiado sem gastar tentativa", async () => {
    comAsFotos();
    bucket.atrasoDaBaixadaMs = 3_100;
    const inicio = Date.now();
    const aviso = await nasDuasComoAdministrador(carrossel());
    const levou = Date.now() - inicio;
    console.log(`O AGORA DO CARROSSEL NAS DUAS REDES, com o bucket a 3,1 s por download: ${levou} ms`);
    expect(aviso).toEqual(
      redes.avisoDasDuasRedes({
        tipo: "entrou",
        campos: null,
        instagram: { entrou: true, jaVale: true },
        linkedin: { entrou: true, jaVale: true, desfecho: "aguardando", motivo: null },
      })
    );
    expect((await daRede("publicacao"))[0].status).toBe("sent");
    const [li] = await q(
      `select status, attempts, payload, not_before > now() as adiada from queue where kind = 'publicacao_linkedin'`
    );
    expect(li).toMatchObject({ status: "pending", attempts: 0, adiada: true });
    expect(li.payload).toMatchObject({ adiamentos: 1 });
    expect(linkedin.pedidos).toEqual([]);
    // AS CÓPIAS FICAM PARA A PASSADA SEGUINTE; as originais, o dreno do Instagram apagou depois de publicar.
    const copias = (li.payload as { caminhos: string[] }).caminhos;
    expect([...bucket.objetos.keys()].sort()).toEqual([ORIGINAL, ...copias].sort());
  }, 30_000);

  it("a cópia que falha no meio: as que subiram saem do bucket depois de terminar, e nada é gravado", async () => {
    comAsFotos();
    bucket.recusarUmaSubida = true;
    bucket.atrasoDaSubidaMs = 300;
    const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("Nada foi agendado");
    expect(aviso.texto).toContain("HTTP 400");
    expect(await linhas()).toEqual([]);
    const subiram = bucket.chamadas.filter((c) => c.startsWith("subiu ")).map((c) => c.slice("subiu ".length));
    expect(subiram).toHaveLength(3);
    // A PRIMEIRA SUBIDA FOI RECUSADA NA HORA; as outras duas terminaram 300 ms depois, e só então saíram.
    expect(apagadas().sort()).toEqual(subiram.slice(1).sort());
    expect([...bucket.objetos.keys()].sort()).toEqual(soAsOriginais());
  });

  it("a linha do LinkedIn que o banco recusa: as três cópias saem, e nada foi agendado", async () => {
    comAsFotos();
    await comGatilho(
      "teste_recusa_o_linkedin",
      "before",
      `if new.kind = 'publicacao_linkedin' then raise exception 'o banco de teste recusou a linha do LinkedIn'; end if; return new;`,
      async () => {
        const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
        expect(aviso.tom).toBe("erro");
        expect(aviso.texto).toContain("Nada foi agendado");
        expect(await linhas()).toEqual([]);
        expect(apagadas()).toHaveLength(3);
        expect([...bucket.objetos.keys()].sort()).toEqual(soAsOriginais());
      }
    );
  });

  it("o Instagram que o banco recusa, com o carrossel do LinkedIn pendente: o LinkedIn é desfeito, e as três cópias saem", async () => {
    comAsFotos();
    await comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
      const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
      expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" }));
      expect((await daRede("publicacao_linkedin"))[0].status).toBe("skipped");
      expect(apagadas()).toHaveLength(3);
      expect([...bucket.objetos.keys()].sort()).toEqual(soAsOriginais());
    });
  });

  // A CHAVE CONTRA O CLIQUE DUPLO NÃO MUDA PARA O POST SÓ DE IMAGEM (nota da auditoria sobre a F4): a linha que já está
  // na fila, gravada com a chave escrita à mão como a produção de hoje (e2949fb) a escreve, pela original, segura o
  // mesmo envio depois desta entrega.
  it("a imagem que já está na fila, com a chave da produção de hoje: o mesmo envio dá já existia no LinkedIn, sem cópia", async () => {
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
       values ($1, 'publicacao_linkedin', $2, $3, now() + interval '2 hours')`,
      [CONTA_A, { forma: "imagem", caminhos: [ORIGINAL], texto: "O post do LinkedIn" }, `pub-linkedin:${CONTA_A}:imagem:${ORIGINAL}`]
    );
    const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
    expect(aviso.texto).toContain("LinkedIn: O post do LinkedIn já estava na fila. Nada foi duplicado.");
    expect(aviso.texto).toContain("Instagram: Publicação agendada para");
    expect(await daRede("publicacao_linkedin")).toHaveLength(1);
    expect(await daRede("publicacao")).toHaveLength(1);
    expect(bucket.chamadas).toEqual([]);
  });
});
