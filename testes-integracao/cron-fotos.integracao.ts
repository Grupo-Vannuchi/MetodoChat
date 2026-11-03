// AS FOTOS DOS CONTATOS NA ROTINA DIÁRIA — `app/api/cron/daily/route.ts` com `lib/fotos-dos-contatos.ts`
// (achado 135, decidido pelo Eduardo em 03/11/2026).
//
// A URL da foto que a Meta dá vence em ~4,5 dias, e a rotina renovava todo dia as MESMAS 20 mais recentes
// de cada conta: as outras venciam e viravam a inicial do nome. Agora as 20 vagas vão para as mais
// recentes que já venceram ou que venceriam antes da próxima passagem, e a foto vencida que a Meta recusa
// de verdade é anulada, para não tomar uma vaga por dia para sempre.
//
// O QUE SÓ ESTE ARQUIVO MEDE é a rota inteira contra o banco: a consulta, quem é chamado na Meta e o que
// fica gravado. As regras sozinhas estão em tests/fotos-dos-contatos.test.ts.
//
// A META FALSA é um servidor HTTP na própria máquina, com `IG_GRAPH_BASE` preso ao loopback por uma guarda
// que falha ANTES de qualquer requisição sair (o mesmo jeito de `agendados.integracao.ts`). Sem
// `QSTASH_TOKEN`, `scheduleTick` não sai da máquina. **NADA AQUI CHAMA A META DE VERDADE.**
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloCron = typeof import("@/app/api/cron/daily/route");
type ModuloIg = typeof import("@/lib/ig");

const banco = bancoDescartavel();

const CONTA = "17800000000013501";
// Valores inventados. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-da-conta-das-fotos-que-nao-vale-nada";
const SEGREDO_DO_CRON = "segredo-de-cron-das-fotos-que-nao-vale-nada";
const H = 3_600_000;

type Resposta = { status: number; corpo: Record<string, unknown> };

const meta = {
  /** O status da leitura do perfil da PRÓPRIA conta (`getProfile`, o `/me`). */
  me: 200,
  /** A resposta de cada contato, pelo IGSID. Contato sem resposta aqui recebe 404, e entra em `desconhecidos`. */
  perfis: new Map<string, Resposta>(),
  /** Os IGSIDs que a rotina pediu, na ordem. */
  chamados: [] as string[],
  desconhecidos: [] as string[],
};

let servidorMeta: Server;
let cron: ModuloCron;
let ig: ModuloIg;
let Pedido: typeof import("next/server").NextRequest;

function responderJson(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(corpo));
}

/** Uma URL do CDN com o vencimento em `oe` (hex de segundos unix), como a da Meta. O host é inventado. */
function fotoQueVence(ms: number, marca = "x"): string {
  return `https://cdn-de-teste.invalid/v/${marca}.jpg?oh=00_abc&oe=${Math.floor(ms / 1000).toString(16)}`;
}

beforeAll(async () => {
  servidorMeta = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const ultimo = u.pathname.split("/").pop() ?? "";
    if (req.method === "GET" && ultimo === "me") {
      if (meta.me !== 200) return responderJson(res, meta.me, { error: { message: "token inválido", code: 190 } });
      return responderJson(res, 200, { user_id: CONTA, username: "conta_das_fotos", name: "Conta das fotos" });
    }
    if (req.method === "GET" && (u.searchParams.get("fields") ?? "").includes("profile_pic")) {
      meta.chamados.push(ultimo);
      const r = meta.perfis.get(ultimo);
      if (r) return responderJson(res, r.status, r.corpo);
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    responderJson(res, 404, { error: { message: `a Meta falsa não conhece ${u.pathname}` } });
  });
  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));

  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${(servidorMeta.address() as AddressInfo).port}`;
  delete process.env.QSTASH_TOKEN;
  process.env.CRON_SECRET = SEGREDO_DO_CRON;

  ig = await import("@/lib/ig");
  cron = await import("@/app/api/cron/daily/route");
  Pedido = (await import("next/server")).NextRequest;

  // A GUARDA, ANTES DE QUALQUER REQUISIÇÃO. Se ela falhar, nenhum caso roda.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta rodada ` +
        `(${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste chamaria a Meta de verdade.`
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_das_fotos",
    name: "Conta das fotos",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  delete process.env.CRON_SECRET;
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
});

beforeEach(async () => {
  meta.me = 200;
  meta.perfis.clear();
  meta.chamados.length = 0;
  meta.desconhecidos.length = 0;
  await banco.db().sql().query(`delete from contacts where account_id = $1`, [CONTA]);
});

/** Um contato com a foto dada. `minutosAtras` é a recência: quanto menor, mais recente. */
async function semearContato(igId: string, foto: string | null, minutosAtras: number) {
  await banco.db().sql().query(
    `insert into contacts (account_id, ig_id, username, profile_pic, last_reply_at)
     values ($1, $2, $3, $4, now() - make_interval(mins => $5))`,
    [CONTA, igId, `arroba_${igId}`, foto, minutosAtras]
  );
}

async function fotoDe(igId: string): Promise<string | null> {
  const [{ profile_pic }] = (await banco.db().sql().query(
    `select profile_pic from contacts where account_id = $1 and ig_id = $2`,
    [CONTA, igId]
  )) as { profile_pic: string | null }[];
  return profile_pic;
}

async function rodarCron(): Promise<number> {
  const { valor } = await comoNumaRequisicao("/api/cron/daily", async () => {
    const resposta = await cron.GET(
      new Pedido("https://exemplo.invalid/api/cron/daily", {
        method: "GET",
        headers: { authorization: `Bearer ${SEGREDO_DO_CRON}` },
      })
    );
    return resposta.status;
  });
  return valor;
}

describe("as fotos dos contatos na rotina diária", () => {
  it("renova só as devidas, anula a vencida que a Meta recusa e não toca na foto que ainda vale", async () => {
    const agora = Date.now();
    const vencida = (marca: string) => fotoQueVence(agora - 2 * H, marca);
    const naMargem = fotoQueVence(agora + 12 * H, "margem");
    const valida = fotoQueVence(agora + 3 * 24 * H, "valida");
    const nova = fotoQueVence(agora + 4 * 24 * H, "nova");

    await semearContato("100", valida, 1);
    await semearContato("101", vencida("renova"), 2);
    await semearContato("102", vencida("recusada"), 3);
    await semearContato("103", naMargem, 4);
    await semearContato("104", vencida("erro-da-meta"), 5);
    await semearContato("105", vencida("sem-foto"), 6);
    await semearContato("106", null, 7);

    meta.perfis.set("101", { status: 200, corpo: { username: "arroba_101", profile_pic: nova } });
    meta.perfis.set("102", { status: 400, corpo: { error: { message: "Unsupported get request", code: 100 } } });
    meta.perfis.set("103", { status: 400, corpo: { error: { message: "Unsupported get request", code: 100 } } });
    meta.perfis.set("104", { status: 500, corpo: { error: { message: "erro interno" } } });
    meta.perfis.set("105", { status: 200, corpo: { username: "arroba_105" } });

    expect(await rodarCron()).toBe(200);

    // A válida e a nula não são chamadas; as devidas, na ordem da recência.
    expect(meta.chamados).toEqual(["101", "102", "103", "104", "105"]);
    expect(meta.desconhecidos).toEqual([]);
    expect(await fotoDe("100")).toBe(valida);
    expect(await fotoDe("101")).toBe(nova);
    expect(await fotoDe("102")).toBeNull();
    expect(await fotoDe("103")).toBe(naMargem);
    expect(await fotoDe("104")).toBe(vencida("erro-da-meta"));
    expect(await fotoDe("105")).toBeNull();
    expect(await fotoDe("106")).toBeNull();
  });

  it("com a leitura da própria conta recusada, não anula ninguém: o token pode ser o problema", async () => {
    const agora = Date.now();
    const vencida = fotoQueVence(agora - 2 * H, "recusada");
    await semearContato("200", vencida, 1);
    meta.me = 400;
    meta.perfis.set("200", { status: 400, corpo: { error: { message: "token inválido", code: 190 } } });

    expect(await rodarCron()).toBe(200);

    expect(meta.chamados).toEqual(["200"]);
    expect(await fotoDe("200")).toBe(vencida);
  });

  it("chama no máximo 20 por conta, as mais recentes entre as devidas", async () => {
    const agora = Date.now();
    const nova = fotoQueVence(agora + 4 * 24 * H, "nova");
    for (let i = 0; i < 25; i++) {
      const igId = String(300 + i);
      await semearContato(igId, fotoQueVence(agora - 2 * H, `c${i}`), i + 1);
      meta.perfis.set(igId, { status: 200, corpo: { username: `arroba_${igId}`, profile_pic: nova } });
    }
    // Uma válida entre as mais recentes, que não pode tomar vaga.
    await semearContato("399", fotoQueVence(agora + 3 * 24 * H, "valida"), 0);

    expect(await rodarCron()).toBe(200);

    expect(meta.chamados).toEqual(Array.from({ length: 20 }, (_, i) => String(300 + i)));
    expect(await fotoDe("319")).toBe(nova);
    expect(await fotoDe("320")).toBe(fotoQueVence(agora - 2 * H, "c20"));
  });
});
