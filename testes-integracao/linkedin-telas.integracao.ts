// AS TELAS DE PUBLICAÇÕES LEEM O POST DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte
// 2a). Todos os pontos que diziam `kind = 'publicacao'` passam a ler os dois tipos de post: o calendário, "Não
// saíram", a contagem do que está fora do período, a página do post, o cancelar e o remarcar, o aviso do Início
// e o `caminhosNaFila` do gerador.
//
// A MAQUINARIA É A DE `agendados.integracao.ts` e de `nao-saiu.integracao.ts`: as páginas e as ações de verdade,
// chamadas num contexto de requisição com a sessão de teste, e a árvore lida por `textoDaArvore`. CONTA_A nasce
// primeiro e é a conta selecionada pelo tombo declarado de `getSelectedAccount`.
//
// O LINKEDIN, A META E O BUCKET SÃO FALSOS: servidores HTTP na própria máquina, e o `fetch` é interceptado para
// RECUSAR qualquer endereço que não seja o loopback. **NADA AQUI FALA COM O LINKEDIN, COM A META NEM COM O BUCKET
// DE VERDADE.** Valores inventados: nenhuma credencial de verdade entra em teste.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

type ModuloAcoes = typeof import("@/app/publicar/post/actions");
type ModuloTelaDosAgendados = typeof import("@/app/publicar/page");
type ModuloTelaDoDetalhe = typeof import("@/app/publicar/post/[id]/page");
type ModuloTelaDoPainel = typeof import("@/app/page");
type ModuloRepositorio = typeof import("@/lib/bonus/publicar-repositorio");
type ModuloPublicacao = typeof import("@/lib/publicacao");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA_A = "17800000000025101";
const CONTA_B = "17800000000025102";
const BUCKET = "midia-das-telas";
const CHAVE_DO_BUCKET = "chave-do-bucket-das-telas-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDasTelasQueNaoValeNada";

const pedidos = { linkedin: [] as string[], meta: [] as string[], apagados: [] as string[] };

let servidorFalso: Server;
let acoes: ModuloAcoes;
let telaDosAgendados: ModuloTelaDosAgendados;
let telaDoDetalhe: ModuloTelaDoDetalhe;
let telaDoPainel: ModuloTelaDoPainel;
let repositorio: ModuloRepositorio;
let publicacao: ModuloPublicacao;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

beforeAll(async () => {
  // UM SERVIDOR SÓ PARA AS TRÊS PONTAS: o caminho diz quem é quem.
  servidorFalso = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.resume();
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const privado = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(privado)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      pedidos.apagados.push(decodeURIComponent(u.pathname.slice(privado.length)));
      return responder(res, 200, { message: "ok" });
    }
    if (u.pathname.startsWith("/rest/") || u.pathname.startsWith("/v2/")) {
      pedidos.linkedin.push(`${req.method} ${u.pathname}`);
      if (req.method === "POST" && u.pathname === "/rest/posts") {
        return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000000101" });
      }
      return responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
    }
    pedidos.meta.push(`${req.method} ${u.pathname}`);
    responder(res, 500, { error: { message: "nenhum caso deste arquivo fala com a Meta" } });
  });
  await new Promise<void>((pronto) => servidorFalso.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidorFalso.address() as AddressInfo).port}`;
  process.env.LINKEDIN_API_BASE = base;
  process.env.IG_GRAPH_BASE = base;
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
  const ig = await import("@/lib/ig");
  if (li.basesDoLinkedin().api !== base || ig.baseDoGraph() !== base) {
    throw new Error("RECUSADO: as bases do LinkedIn e da Graph não são as desta rodada.");
  }

  acoes = await import("@/app/publicar/post/actions");
  telaDosAgendados = await import("@/app/publicar/page");
  telaDoDetalhe = await import("@/app/publicar/post/[id]/page");
  telaDoPainel = await import("@/app/page");
  repositorio = await import("@/lib/bonus/publicar-repositorio");
  publicacao = await import("@/lib/publicacao");

  // AS CONTAS NASCEM EM ORDEM: CONTA_A é a selecionada.
  for (const [id, nome] of [
    [CONTA_A, "conta_a_das_telas"],
    [CONTA_B, "conta_b_das_telas"],
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
  for (const v of ["LINKEDIN_API_BASE", "IG_GRAPH_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) {
    delete process.env[v];
  }
  await new Promise<void>((pronto) => servidorFalso.close(() => pronto()));
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  pedidos.linkedin = [];
  pedidos.meta = [];
  pedidos.apagados = [];
});

// ---------------------------------------------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------------------------------------------

let semente = 0;

/** Um post da fila, gravado direto, com as datas pelo relógio do banco. */
async function semear(item: {
  conta?: string;
  kind?: "publicacao" | "publicacao_linkedin" | "dm_manual";
  forma?: "texto" | "imagem";
  texto?: string;
  status?: string;
  emSegundos?: number;
  reivindicadoEm?: number | null;
  error?: string | null;
  postUrn?: string;
}): Promise<{ id: string; caminho: string }> {
  semente++;
  const conta = item.conta ?? CONTA_A;
  const kind = item.kind ?? "publicacao_linkedin";
  const caminho = `${conta}/tela-${semente}.jpg`;
  const forma = item.forma ?? "texto";
  const payload =
    kind === "publicacao_linkedin"
      ? {
          forma,
          caminhos: forma === "imagem" ? [caminho] : [],
          texto: item.texto ?? `O post ${semente} do LinkedIn`,
          ...(item.postUrn ? { post_urn: item.postUrn } : {}),
        }
      : kind === "publicacao"
        ? { forma: "imagem", caminhos: [caminho], legenda: `A legenda ${semente}` }
        : { text: "uma mensagem qualquer" };
  const status = item.status ?? "pending";
  const [linha] = (await q(
    `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status, not_before, claimed_at, sent_at, error)
     values ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7::int),
             case when $8::int is null then null else now() + make_interval(secs => $8::int) end,
             case when $6 = 'sent' then now() + make_interval(secs => $7::int) end, $9)
     returning id`,
    [
      conta,
      kind,
      kind === "dm_manual" ? "99000000000025" : null,
      payload,
      `telas-${semente}`,
      status,
      item.emSegundos ?? 3600,
      item.reivindicadoEm === undefined ? null : item.reivindicadoEm,
      item.error ?? null,
    ]
  )) as { id: string }[];
  return { id: linha.id, caminho };
}

async function conectar() {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDasTelas', 'Dra. Ana Souza', $2, now() + interval '30 days')`,
    [CONTA_A, TOKEN_DO_LINKEDIN]
  );
}

const lerItem = async (id: string) =>
  (await q(`select status, error, attempts, not_before, payload from queue where id = $1`, [id]))[0];

async function arvoreDosAgendados(): Promise<string> {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar", async () =>
    textoDaArvore(await telaDosAgendados.default({ searchParams: Promise.resolve({}) }))
  );
  return valor;
}

async function arvoreDoDetalhe(id: string): Promise<string> {
  const { valor } = await comoNumaRequisicaoComSessao(`/publicar/post/${id}`, async () =>
    textoDaArvore(await telaDoDetalhe.default({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }))
  );
  return valor;
}

async function arvoreDoPainel(): Promise<string> {
  const { valor } = await comoNumaRequisicaoComSessao("/", async () =>
    textoDaArvore(await telaDoPainel.default({ searchParams: Promise.resolve({}) }))
  );
  return valor;
}

/** O desfecho de uma action: o `redirect()` lança, e o aviso viaja na URL. */
async function avisoDe(acao: (form: FormData) => Promise<void>, form: FormData): Promise<{ texto: string | null; tom: string | null }> {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar", async () => {
    try {
      await acao(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return { texto: null, tom: null };
  const sp = new URL(valor.split(";").slice(2, -2).join(";"), "http://127.0.0.1").searchParams;
  return { texto: sp.get("aviso"), tom: sp.get("tom") };
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

/** Um instante em UTC, como o `<input type="datetime-local">` o manda com o fuso "0". */
const campoDeDataHora = (instante: number) => new Date(instante).toISOString().slice(0, 16);

// ---------------------------------------------------------------------------------------------------------------

describe("o calendário e \"Não saíram\" leem o post do LinkedIn", () => {
  it("o calendário mostra o post do LinkedIn com a rede no nome e o link para a página dele", async () => {
    const texto = await semear({ forma: "texto", emSegundos: 3600 });
    const imagem = await semear({ forma: "imagem", emSegundos: 7200 });
    await semear({ kind: "publicacao", emSegundos: 5400 });
    const arvore = await arvoreDosAgendados();
    expect(arvore).toContain("LinkedIn · Só texto");
    expect(arvore).toContain("LinkedIn · Imagem");
    expect(arvore).toContain("Imagem no feed");
    expect(arvore).toContain(`/publicar/post/${texto.id}?`);
    // A capa do post do LinkedIn com imagem é o arquivo dele no bucket, enquanto não saiu.
    expect(arvore).toContain(`/storage/v1/object/public/${BUCKET}/${imagem.caminho}`);
  });

  it("o post do LinkedIn agendado fora do período entra na contagem do que está fora", async () => {
    await semear({ forma: "texto", emSegundos: 90 * 24 * 3600 });
    const arvore = await arvoreDosAgendados();
    expect(arvore).toContain("post agendado");
    expect(arvore).toContain("fora deste período");
  });

  it("o post do LinkedIn que falhou aparece em \"Não saíram\", com a rede, o texto e o motivo", async () => {
    await semear({
      forma: "texto",
      texto: "O texto que não saiu",
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      error: "esta conta não tem LinkedIn conectado",
    });
    const arvore = await arvoreDosAgendados();
    expect(arvore).toContain("Não saíram");
    expect(arvore).toContain(publicacao.FRASE_DA_FALHA);
    expect(arvore).toContain("LinkedIn · Só texto");
    expect(arvore).toContain("O texto que não saiu");
    expect(arvore).toContain("esta conta não tem LinkedIn conectado");
  });

  it("o post do LinkedIn de outra conta não aparece", async () => {
    await semear({ conta: CONTA_B, forma: "texto", texto: "O post da outra conta" });
    expect(await arvoreDosAgendados()).not.toContain("O post da outra conta");
  });
});

describe("a página do post do LinkedIn", () => {
  it("agendado: o texto inteiro, os formulários e a nota de apagar pelo LinkedIn, sem falar com a Meta", async () => {
    const { id } = await semear({ forma: "texto", texto: "O texto inteiro do post\ncom duas linhas" });
    const arvore = await arvoreDoDetalhe(id);
    expect(arvore).toContain("LinkedIn · Só texto");
    expect(arvore).toContain("O texto inteiro do post\ncom duas linhas");
    expect(arvore).toContain("Remarcar");
    expect(arvore).toContain("Cancelar este post");
    expect(arvore).toContain("apague pelo próprio LinkedIn");
    expect(arvore).not.toContain("aplicativo do Instagram");
    expect(pedidos.meta).toEqual([]);
  });

  it("com imagem, agendado: a imagem do bucket aparece", async () => {
    const { id, caminho } = await semear({ forma: "imagem" });
    expect(await arvoreDoDetalhe(id)).toContain(`/storage/v1/object/public/${BUCKET}/${caminho}`);
  });

  it("publicado: o link \"Ver no LinkedIn\" leva ao post, sem falar com ninguém", async () => {
    const { id } = await semear({
      forma: "texto",
      status: "sent",
      emSegundos: -3600,
      postUrn: "urn:li:share:7000000000000000555",
    });
    const arvore = await arvoreDoDetalhe(id);
    expect(arvore).toContain("Ver no LinkedIn");
    expect(arvore).toContain("https://www.linkedin.com/feed/update/urn:li:share:7000000000000000555/");
    expect(arvore).not.toContain("Ver no Instagram");
    expect(pedidos.meta).toEqual([]);
    expect(pedidos.linkedin).toEqual([]);
  });
});

describe("cancelar e remarcar valem para o post do LinkedIn", () => {
  it("cancelar o agendado: a linha fica skipped com o motivo do dono, e a imagem sai do bucket", async () => {
    const { id, caminho } = await semear({ forma: "imagem" });
    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
    expect(aviso.tom).toBe("ok");
    const linha = await lerItem(id);
    expect(linha).toMatchObject({ status: "skipped", error: publicacao.MOTIVO_CANCELADO_PELO_DONO });
    expect(pedidos.apagados).toEqual([caminho]);
  });

  it("cancelar o que já está saindo: o aviso manda apagar pelo LinkedIn, e a linha não muda", async () => {
    const { id } = await semear({ forma: "texto", status: "sending", emSegundos: -60, reivindicadoEm: -5 });
    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("apague por lá");
    expect(aviso.texto).not.toContain("Instagram");
    expect((await lerItem(id)).status).toBe("sending");
  });

  it("cancelar uma MENSAGEM pelo id continua recusado", async () => {
    const { id } = await semear({ kind: "dm_manual" });
    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
    expect(aviso.tom).toBe("erro");
    expect((await lerItem(id)).status).toBe("pending");
  });

  it("remarcar o agendado para daqui a três horas grava a hora nova", async () => {
    const { id } = await semear({ forma: "texto", emSegundos: 3600 });
    const alvo = Math.floor((Date.now() + 3 * 3600 * 1000) / 60000) * 60000;
    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(alvo), fuso: "0" }));
    expect(aviso.tom).toBe("ok");
    expect(new Date((await lerItem(id)).not_before as Date).getTime()).toBe(alvo);
  });

  it("remarcar para o minuto corrente publica só esta linha, e não drena o resto da fila", async () => {
    await conectar();
    const outra = await semear({ kind: "publicacao", emSegundos: -120 });
    const { id } = await semear({ forma: "texto", emSegundos: 3600 });
    const minuto = Math.floor(Date.now() / 60000) * 60000;
    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(minuto), fuso: "0" }));
    expect(aviso.tom).toBe("ok");
    expect((await lerItem(id)).status).toBe("sent");
    expect(pedidos.linkedin).toEqual(["POST /rest/posts"]);
    // O post do Instagram vencido continua na fila: o "agora" do LinkedIn não é o dreno inteiro.
    expect(await lerItem(outra.id)).toMatchObject({ status: "pending", attempts: 0 });
    expect(pedidos.meta).toEqual([]);
  });
});

// O POST DO LINKEDIN DE FORMA NOVA (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md).
// Este código não publica a forma: o remarcar não grava a hora nova nem drena, e diz por quê, em vez de "feito"
// (a linha ficaria parada) ou de "não encontrado" (o post está ali). O cancelar continua valendo: é a ação do dono.
describe("o remarcar e o cancelar de um post do LinkedIn de forma nova", () => {
  async function semearFormaNova(emSegundos: number): Promise<{ id: string; notBefore: number }> {
    semente++;
    const [linha] = (await q(
      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
       values ($1, 'publicacao_linkedin', $2, $3, now() + make_interval(secs => $4::int))
       returning id, not_before`,
      [
        CONTA_A,
        // A FORMA NOVA DE EXEMPLO É O VÍDEO (a parte 3b), que este código ainda não publica. Até a 3a, era o carrossel.
        { forma: "video", caminhos: [`${CONTA_A}/novo-${semente}.mp4`], texto: "um vídeo do futuro" },
        `telas-forma-nova-${semente}`,
        emSegundos,
      ]
    )) as { id: string; not_before: Date }[];
    return { id: linha.id, notBefore: new Date(linha.not_before).getTime() };
  }

  it("remarcar para o minuto corrente: nada muda, nada drena, e o aviso diz que esta versão não publica o formato", async () => {
    await conectar();
    const { id, notBefore } = await semearFormaNova(3600);
    const minuto = Math.floor(Date.now() / 60000) * 60000;
    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(minuto), fuso: "0" }));
    expect(aviso).toEqual({
      tom: "erro",
      texto: "Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.",
    });
    const depois = await lerItem(id);
    expect(depois).toMatchObject({ status: "pending", attempts: 0, error: null });
    expect(new Date(depois.not_before as Date).getTime()).toBe(notBefore);
    expect(pedidos.linkedin).toEqual([]);
    expect(pedidos.meta).toEqual([]);
  });

  it("remarcar para daqui a três horas: a hora não muda, e o aviso é o mesmo", async () => {
    const { id, notBefore } = await semearFormaNova(3600);
    const alvo = Math.floor((Date.now() + 3 * 3600 * 1000) / 60000) * 60000;
    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(alvo), fuso: "0" }));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.");
    expect(new Date((await lerItem(id)).not_before as Date).getTime()).toBe(notBefore);
  });

  it("cancelar continua valendo: a linha fica skipped com o motivo do dono", async () => {
    const { id } = await semearFormaNova(3600);
    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
    expect(aviso.tom).toBe("ok");
    expect(await lerItem(id)).toMatchObject({ status: "skipped", error: publicacao.MOTIVO_CANCELADO_PELO_DONO });
  });
});

describe("o Início e o gerador conhecem o post do LinkedIn", () => {
  it("o post do LinkedIn que falhou é aviso de publicação, e não de mensagem", async () => {
    await semear({ forma: "texto", status: "failed", emSegundos: -3600, reivindicadoEm: -3600, error: "falhou" });
    const painel = await arvoreDoPainel();
    expect(painel).toContain("publicação não saiu");
    expect(painel).not.toContain("mensagem não saiu");
  });

  it("o caminhosNaFila acha o arquivo que está numa linha do LinkedIn", async () => {
    const { caminho } = await semear({ forma: "imagem" });
    expect(await repositorio.caminhosNaFila([caminho, `${CONTA_A}/nao-esta-na-fila.jpg`])).toEqual([caminho]);
  });
});
