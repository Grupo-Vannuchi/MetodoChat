// A ACTION DE PUBLICAR NO LINKEDIN (`publicarNoLinkedin`, app/publicar/actions.ts; docs/specs/2026-11-06-linkedin-
// no-perfil.md, §2 e §7; a parte 2a). A conta vem da regra das contas (`getSelectedAccount`), nunca do formulário;
// a conexão é conferida de novo no servidor; o pedido passa pela mesma função de recusas da tela; e o "agora"
// publica só a própria linha (achado 211) e diz o desfecho.
//
// A MAQUINARIA É A DE `linkedin-telas.integracao.ts`: a action de verdade num contexto de requisição, com a sessão
// de teste (administrador) ou a do login COMUM de teste, ligado só às contas de cada caso. O LinkedIn e o bucket são
// falsos, no loopback, e o `fetch` recusa qualquer outro endereço. **NADA AQUI PUBLICA NO LINKEDIN DE VERDADE.**
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/publicar/actions");
type ModuloLinkedin = typeof import("@/lib/linkedin-publicacao");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA_A = "17800000000025201";
const CONTA_B = "17800000000025202";
const BUCKET = "midia-do-compor";
const CHAVE_DO_BUCKET = "chave-do-bucket-do-compor-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoComporQueNaoValeNada";
const ENVIO = "9f1c2e3d-0000-4000-8000-0000000002a1";

const linkedin = { pedidos: [] as string[], statusDoPost: 201 };

let servidorFalso: Server;
let acoes: ModuloAcoes;
let regras: ModuloLinkedin;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

beforeAll(async () => {
  servidorFalso = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.resume();
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const porta = (servidorFalso.address() as AddressInfo).port;
    if (req.method === "GET" && u.pathname.startsWith(`/storage/v1/object/public/${BUCKET}/`)) {
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    }
    if (req.method === "DELETE" && u.pathname.startsWith(`/storage/v1/object/${BUCKET}/`)) {
      return responder(res, 200, { message: "ok" });
    }
    linkedin.pedidos.push(`${req.method} ${u.pathname}`);
    if (req.method === "POST" && u.pathname === "/rest/images") {
      return responder(res, 200, {
        value: { uploadUrl: `http://127.0.0.1:${porta}/envio/C4E10AQ`, image: "urn:li:image:DoCompor" },
      });
    }
    if (req.method === "PUT" && u.pathname === "/envio/C4E10AQ") return responder(res, 201, "");
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      if (linkedin.statusDoPost !== 201) return responder(res, linkedin.statusDoPost, { message: "o post falhou de propósito" });
      return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000000201" });
    }
    responder(res, 404, { message: "o falso não conhece esse caminho" });
  });
  await new Promise<void>((pronto) => servidorFalso.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidorFalso.address() as AddressInfo).port}`;
  process.env.LINKEDIN_API_BASE = base;
  process.env.SUPABASE_URL = base;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;

  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  const li = await import("@/lib/linkedin");
  if (li.basesDoLinkedin().api !== base) throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada.");
  acoes = await import("@/app/publicar/actions");
  regras = await import("@/lib/linkedin-publicacao");

  for (const [id, nome] of [
    [CONTA_A, "conta_a_do_compor"],
    [CONTA_B, "conta_b_do_compor"],
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
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) delete process.env[v];
  await new Promise<void>((pronto) => servidorFalso.close(() => pronto()));
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await conectar(CONTA_A);
  linkedin.pedidos = [];
  linkedin.statusDoPost = 201;
});

async function conectar(conta: string, expiraEm = "now() + interval '30 days'") {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDoCompor', 'Dra. Ana Souza', $2, ${expiraEm})
     on conflict (account_id) do update set expira_em = excluded.expira_em`,
    [conta, TOKEN_DO_LINKEDIN]
  );
}

const linhas = () => q(`select account_id, kind, status, error, payload from queue order by created_at`);

/** O formulário como a tela o manda (app/publicar/enviador.tsx, na rede LinkedIn). */
function formulario(campos: Partial<Record<string, string>> = {}): FormData {
  const f = new FormData();
  const tudo: Record<string, string> = {
    forma_linkedin: "texto",
    caminhos: "",
    texto: "Olá #mundo",
    id_do_envio: ENVIO,
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

async function publicarComoAdministrador(form: FormData) {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicarNoLinkedin(form)));
  return avisoDoDigest(valor);
}

async function publicarComoComum(form: FormData, contas: string[], contaDoCookie?: string) {
  const { valor } = await comoNumaRequisicaoComoComum("/publicar/novo", () => capturar(() => acoes.publicarNoLinkedin(form)), {
    contas,
    contaDoCookie,
  });
  return avisoDoDigest(valor);
}

// ---------------------------------------------------------------------------------------------------------------

describe("publicar agora no LinkedIn", () => {
  it("só texto: a linha entra, o post sai na mesma ida, e o aviso diz publicado", async () => {
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso).toEqual({ tom: "ok", texto: "Post publicado no LinkedIn." });
    const [linha] = await linhas();
    expect(linha).toMatchObject({ account_id: CONTA_A, kind: "publicacao_linkedin", status: "sent" });
    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
  });

  it("imagem: o caminho da pasta da conta vai à linha, e a imagem sobe antes do post", async () => {
    const aviso = await publicarComoAdministrador(formulario({ forma_linkedin: "imagem", caminhos: `${CONTA_A}/foto.jpg` }));
    expect(aviso.tom).toBe("ok");
    const [linha] = await linhas();
    expect((linha.payload as Record<string, unknown>).caminhos).toEqual([`${CONTA_A}/foto.jpg`]);
    expect(linkedin.pedidos).toEqual(["POST /rest/images", "PUT /envio/C4E10AQ", "POST /rest/posts"]);
  });

  it("o LinkedIn recusa o post: o aviso diz que não saiu, com o motivo", async () => {
    linkedin.statusDoPost = 403;
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("403");
    expect((await linhas())[0].status).toBe("failed");
  });

  it("o mesmo envio mandado de novo não entra outra vez", async () => {
    await publicarComoAdministrador(formulario());
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toHaveLength(1);
    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
  });
});

describe("agendar no LinkedIn", () => {
  it("a linha entra pendente para a hora escolhida, e ninguém fala com o LinkedIn", async () => {
    const alvo = new Date(Date.now() + 2 * 3600 * 1000);
    alvo.setUTCSeconds(0, 0);
    const aviso = await publicarComoAdministrador(
      formulario({ quando: "depois", data_hora: alvo.toISOString().slice(0, 16), fuso: "0" })
    );
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("agendado para");
    const [linha] = await linhas();
    expect(linha.status).toBe("pending");
    expect(linkedin.pedidos).toEqual([]);
  });
});

// O CARROSSEL SÓ NO LINKEDIN (a parte 3a): a forma já é aceita pela lista única (`FORMAS_NO_LINKEDIN`, desde a F3), e a
// linha leva os caminhos da pasta da conta, na ordem, com a chave por eles.
describe("o carrossel só no LinkedIn", () => {
  it("agendado: as fotos da pasta da conta vão à linha na ordem, a chave é por elas, e ninguém fala com o LinkedIn", async () => {
    const fotos = [3, 1, 2].map((n) => `${CONTA_A}/foto-${n}.jpg`);
    const alvo = new Date(Date.now() + 2 * 3600 * 1000);
    alvo.setUTCSeconds(0, 0);
    const aviso = await publicarComoAdministrador(
      formulario({
        forma_linkedin: "carrossel",
        caminhos: fotos.join("\n"),
        quando: "depois",
        data_hora: alvo.toISOString().slice(0, 16),
        fuso: "0",
      })
    );
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("agendado para");
    const [linha] = await q(`select status, dedupe_key, payload from queue`);
    expect(linha.status).toBe("pending");
    expect(linha.payload).toMatchObject({ forma: "carrossel", caminhos: fotos });
    expect(linha.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:carrossel:${fotos.join(",")}`);
    expect(linkedin.pedidos).toEqual([]);
  });
});

describe("as recusas: nenhuma linha entra", () => {
  const casos: [string, Partial<Record<string, string>>, string][] = [
    ["a forma desconhecida", { forma_linkedin: "reels" }, "forma_desconhecida"],
    ["o só texto com arquivo", { caminhos: `${CONTA_A}/foto.jpg` }, "quantidade"],
    ["a imagem sem arquivo", { forma_linkedin: "imagem", caminhos: "" }, "quantidade"],
    ["a imagem com o caminho de outra conta (descartado)", { forma_linkedin: "imagem", caminhos: `${CONTA_B}/foto.jpg` }, "quantidade"],
    ["o texto vazio", { texto: "   " }, "texto_vazio"],
    // 2.998 caracteres digitados, e mais de 3.000 no LinkedIn: o servidor conta como o contador.
    ["o texto longo depois das hashtags", { texto: `${"a".repeat(2990)} #ab #cd` }, "texto_longo"],
    ["o envio sem id", { id_do_envio: "" }, "envio_sem_id"],
    // O CARROSSEL (a parte 3a): de 2 a 10 fotos, todas da pasta da conta, e nenhum vídeo, que o PDF não leva.
    ["o carrossel com uma foto só", { forma_linkedin: "carrossel", caminhos: `${CONTA_A}/a.jpg` }, "quantidade"],
    [
      "o carrossel com a foto de outra conta (descartada, e sobra uma)",
      { forma_linkedin: "carrossel", caminhos: `${CONTA_A}/a.jpg\n${CONTA_B}/b.jpg` },
      "quantidade",
    ],
    ["o carrossel com vídeo", { forma_linkedin: "carrossel", caminhos: `${CONTA_A}/a.jpg\n${CONTA_A}/b.mp4` }, "carrossel_com_video"],
  ];
  for (const [nome, campos, recusa] of casos) {
    it(nome, async () => {
      const aviso = await publicarComoAdministrador(formulario(campos));
      expect(aviso).toEqual({
        tom: "erro",
        texto: regras.textoDaRecusaNoLinkedin(recusa as Parameters<typeof regras.textoDaRecusaNoLinkedin>[0]),
      });
      expect(await linhas()).toEqual([]);
      expect(linkedin.pedidos).toEqual([]);
    });
  }

  it("a hora no passado", async () => {
    const aviso = await publicarComoAdministrador(formulario({ quando: "depois", data_hora: "2020-01-01T10:00", fuso: "0" }));
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
  });

  it("a conta sem LinkedIn conectado", async () => {
    await q(`delete from linkedin_conexoes`);
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("não tem LinkedIn conectado");
    expect(await linhas()).toEqual([]);
  });

  it("o LinkedIn da conta vencido", async () => {
    await conectar(CONTA_A, "now() - interval '1 minute'");
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("venceu");
    expect(await linhas()).toEqual([]);
  });
});

describe("a regra das contas: a conta vem da sessão, e nunca do formulário", () => {
  it("o login comum com a conta publica nela", async () => {
    const aviso = await publicarComoComum(formulario(), [CONTA_A]);
    expect(aviso.tom).toBe("ok");
    expect((await linhas())[0]).toMatchObject({ account_id: CONTA_A, status: "sent" });
  });

  // O CAMPO "conta" NO FORMULÁRIO é o que mandaria quem tentasse escolher a conta por fora: a action não o lê.
  it("o login comum sem conta nenhuma não publica, nem com o cookie nem com um campo de uma conta com LinkedIn", async () => {
    const aviso = await publicarComoComum(formulario({ conta: CONTA_A }), [], CONTA_A);
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
    expect(linkedin.pedidos).toEqual([]);
  });

  it("o login comum só com outra conta não publica no LinkedIn da conta que ele não vê", async () => {
    const aviso = await publicarComoComum(formulario({ conta: CONTA_A }), [CONTA_B], CONTA_A);
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
    expect(linkedin.pedidos).toEqual([]);
  });
});
