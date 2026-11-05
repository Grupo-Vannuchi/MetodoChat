// AS CONTAS POR LOGIN, PELO LADO DO LOGIN COMUM (docs/specs/2026-11-05-contas-por-login.md, seções 2 e 3),
// contra o banco descartável, no contexto de requisição semeado (./semear-requisicao.ts).
//
// O CENÁRIO: duas contas no schema, A e B, e o login comum de teste ligado só à A. O login de teste de
// sempre é administrador e vê as duas. A regra mora em lib/acesso.ts, e quem a pergunta é a conta
// escolhida (lib/account.ts), o layout, o `selectAccount`, a Configuração, o `/api/oauth/login` e a
// Atividade.
//
// NENHUM COOKIE É ESCRITO À MÃO. A sessão de cada login sai da ação de entrar de verdade, e o "cookie da B"
// é o que `selectAccount` emitiu para o administrador (`comoNumaRequisicaoComoComum`, com `contaDoCookie`):
// é o navegador em que um administrador escolheu a B e, depois, o comum entrou.
//
// A ORDEM DOS CASOS NÃO IMPORTA: cada chamada do comum diz as contas dele (`definirContasDoLogin`, por
// dentro de ./semear-requisicao.ts), e os casos que mudam o banco semeiam o que mudam.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import {
  cabecalhoDaSessaoDeTeste,
  cabecalhoDoComumDeTeste,
  comoNumaRequisicaoComoComum,
  comoNumaRequisicaoComSessao,
} from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

// Os ids deste arquivo. Valores inventados: nenhuma credencial de verdade entra em teste.
const CONTA_A = "17800000000031001";
const CONTA_B = "17800000000031002";
const APP_URL_FALSO = "https://painel.exemplo.invalid";

let servidor: Server;
let PORTA = 0;
const meta = { pedidos: [] as string[] };

// A CERCA DA REDE. As actions da Configuração falam com a Meta (`reassinarWebhooks`, as perguntas de
// abertura) e com a própria URL do app (`testarWebhook`), e `configurarWebhookAuto` chama o Graph do
// Facebook por um endereço fixo (`FB_GRAPH`, lib/ig.ts), que nenhuma variável desvia. Sem a conferência do
// papel, que é o que o RED deste arquivo mede, elas chegariam lá. A cerca deixa passar só o que vai para
// esta máquina (a Meta falsa, abaixo) e recusa o resto, anotando a origem; o último caso exige zero.
const pedidosParaFora: string[] = [];
let fetchDeVerdade: typeof fetch;

type ModuloConta = typeof import("@/lib/account");
type ModuloAcoesDaConta = typeof import("@/app/account-actions");
type ModuloSetup = typeof import("@/app/setup/actions");
type ModuloConvites = typeof import("@/lib/convites-repositorio");
type ModuloAutomacoes = typeof import("@/app/automacoes/actions");
type ModuloConversas = typeof import("@/app/conversas/[id]/actions");
type ModuloPost = typeof import("@/app/publicar/post/actions");
type ModuloSessao = typeof import("@/lib/sessao");
let conta: ModuloConta;
let acoesDaConta: ModuloAcoesDaConta;
let setup: ModuloSetup;
let convites: ModuloConvites;
let automacoes: ModuloAutomacoes;
let conversas: ModuloConversas;
let post: ModuloPost;
let sessao: ModuloSessao;
let Pedido: typeof import("next/server").NextRequest;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    meta.pedidos.push(`${req.method} ${req.url}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "a Meta falsa deste arquivo não responde nada" } }));
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  PORTA = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${PORTA}`;
  delete process.env.QSTASH_TOKEN;
  // A URL do app vem do ambiente antes do banco (`envAppUrl`, lib/app-url.ts). Sem estas três, ela é a
  // gravada na `config`, que aponta para a Meta falsa.
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  fetchDeVerdade = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.hostname !== "127.0.0.1") {
      pedidosParaFora.push(url.origin);
      throw new Error(`A CERCA DE contas-por-login.integracao.ts recusou um pedido para ${url.origin}`);
    }
    return fetchDeVerdade(entrada, init);
  }) as typeof fetch;

  conta = await import("@/lib/account");
  acoesDaConta = await import("@/app/account-actions");
  setup = await import("@/app/setup/actions");
  convites = await import("@/lib/convites-repositorio");
  automacoes = await import("@/app/automacoes/actions");
  conversas = await import("@/app/conversas/[id]/actions");
  post = await import("@/app/publicar/post/actions");
  sessao = await import("@/lib/sessao");
  Pedido = (await import("next/server")).NextRequest;

  const ig = await import("@/lib/ig");
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta rodada ` +
        `(${process.env.IG_GRAPH_BASE}). Sem o desvio, este arquivo falaria com a Meta de verdade.`
    );
  }

  // AS DUAS CONTAS, A ANTES DA B. A ordem é a do `created_at` (a de `listAccounts`), e ela vai explícita:
  // a primeira conta é o tombo de quem não tem cookie.
  for (const [id, nome] of [
    [CONTA_A, "conta_a_das_contas_por_login"],
    [CONTA_B, "conta_b_das_contas_por_login"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: `token-da-${nome}-que-nao-vale-nada`,
      token_expires_at: null,
    });
  }
  await q(`update accounts set created_at = now() - interval '2 hours' where ig_user_id = $1`, [CONTA_A]);
  await q(`update accounts set created_at = now() - interval '1 hour' where ig_user_id = $1`, [CONTA_B]);
  await q(`insert into config (id) values (1) on conflict do nothing`);
});

afterAll(async () => {
  globalThis.fetch = fetchDeVerdade;
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

type Desfecho<T> = {
  /** O `digest` da exceção de controle de fluxo (redirect, notFound), ou `null` se o corpo voltou. */
  digest: string | null;
  /** O destino do redirect, lido do `digest`, ou `null`. */
  destino: string | null;
  valor: T | undefined;
  /** As tags que `revalidatePath` empilhou. */
  tags: unknown[];
};

/** O corpo, com o redirect e o 404 (que viajam no `digest`) virando valor. O erro de verdade sobe. */
function capturando<T>(corpo: () => Promise<T>) {
  return async (): Promise<{ digest: string | null; valor: T | undefined }> => {
    try {
      return { digest: null, valor: await corpo() };
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      // Erro de verdade sobe: engoli-lo aqui viraria um desfecho mudo.
      if (typeof d !== "string") throw e;
      return { digest: d, valor: undefined };
    }
  };
}

const destinoDe = (digest: string | null) =>
  digest?.startsWith("NEXT_REDIRECT;") ? digest.split(";").slice(2, -2).join(";") : null;

/** O corpo com o login COMUM, e o que ele publicou: o valor, ou o redirect e o 404, que viajam no `digest`. */
async function comoComum<T>(
  rota: string,
  corpo: () => Promise<T>,
  opcoes: { contas: string[]; contaDoCookie?: string } = { contas: [CONTA_A] }
): Promise<Desfecho<T>> {
  const { valor, tags } = await comoNumaRequisicaoComoComum(rota, capturando(corpo), opcoes);
  return { ...valor, destino: destinoDe(valor.digest), tags };
}

/** O mesmo, com o login de teste, que é administrador (e sem cookie de conta: a primeira, a A). */
async function comoAdministrador<T>(rota: string, corpo: () => Promise<T>): Promise<Desfecho<T>> {
  const { valor, tags } = await comoNumaRequisicaoComSessao(rota, capturando(corpo));
  return { ...valor, destino: destinoDe(valor.digest), tags };
}

/**
 * Os `props` de todo elemento da árvore que casam com `casa`: a mesma leitura de
 * acoes-que-falam.integracao.ts (`propsDaArvore`), copiada e não importada, como as outras cópias desta
 * pasta. Anda só pelos FILHOS, e guarda o que já viu: a árvore do React tem referências circulares
 * (`_owner`), e um caminhar ingênuo entra em laço. Nenhum componente filho é chamado.
 */
function propsDaArvore(raiz: unknown, casa: (props: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  const achados: Record<string, unknown>[] = [];
  const visto = new Set<unknown>();
  const andar = (no: unknown): void => {
    if (Array.isArray(no)) {
      no.forEach(andar);
      return;
    }
    if (typeof no !== "object" || no === null || visto.has(no)) return;
    visto.add(no);
    const props = (no as { props?: Record<string, unknown> }).props;
    if (!props) return;
    if (casa(props)) achados.push(props);
    andar(props.children);
  };
  andar(raiz);
  return achados;
}

const NAO_ACHOU = "NEXT_HTTP_ERROR_FALLBACK;404";

// ---------------------------------------------------------------------------------------------------
// 1 a 3. A CONTA ESCOLHIDA E O SELETOR
// ---------------------------------------------------------------------------------------------------

describe("a conta escolhida do login comum", () => {
  it("com o cookie da B, a conta escolhida do comum é a A", async () => {
    const d = await comoComum("/", () => conta.getSelectedAccountId(), { contas: [CONTA_A], contaDoCookie: CONTA_B });
    expect(d.digest).toBe(null);
    expect(d.valor).toBe(CONTA_A);
  });

  it("as contas do comum são só a A", async () => {
    const acesso = await import("@/lib/acesso");
    const d = await comoComum(
      "/",
      async () => {
        const login = await sessao.sessaoAtual();
        if (!login) throw new Error("o comum de teste ficou sem sessão");
        return (await acesso.contasDoLogin(login)).map((c) => c.ig_user_id);
      },
      { contas: [CONTA_A], contaDoCookie: CONTA_B }
    );
    expect(d.valor).toEqual([CONTA_A]);
  });

  it("o comum sem contas não tem conta escolhida, nem com o cookie da B", async () => {
    const d = await comoComum("/", () => conta.getSelectedAccountId(), { contas: [], contaDoCookie: CONTA_B });
    expect(d.valor).toBe(null);
  });
});

describe("o selectAccount do login comum", () => {
  // NUMA REQUISIÇÃO SEM COOKIE DE CONTA: o que se lê depois da chamada é só o que ela gravou.
  it("o da B não grava o cookie, nem revalida", async () => {
    const { ACCOUNT_COOKIE } = conta;
    const { cookies } = await import("next/headers");
    const d = await comoComum("/", async () => {
      await acoesDaConta.selectAccount(form({ account_id: CONTA_B }));
      return (await cookies()).get(ACCOUNT_COOKIE)?.value ?? null;
    });
    expect(d.digest).toBe(null);
    expect(d.valor).toBe(null);
    expect(d.tags).toEqual([]);
  });

  it("o da A grava o cookie, e revalida", async () => {
    const { ACCOUNT_COOKIE } = conta;
    const { cookies } = await import("next/headers");
    const d = await comoComum("/", async () => {
      await acoesDaConta.selectAccount(form({ account_id: CONTA_A }));
      return (await cookies()).get(ACCOUNT_COOKIE)?.value ?? null;
    });
    expect(d.valor).toBe(CONTA_A);
    expect(d.tags.length).toBeGreaterThan(0);
  });
});

describe("o administrador continua vendo tudo", () => {
  it("as contas do administrador são a A e a B, na ordem de criação", async () => {
    const acesso = await import("@/lib/acesso");
    const { valor } = await comoNumaRequisicaoComSessao("/", async () => {
      const login = await sessao.sessaoAtual();
      if (!login?.administrador) throw new Error("o login de teste devia ser administrador");
      return (await acesso.contasDoLogin(login)).map((c) => c.ig_user_id);
    });
    expect(valor).toEqual([CONTA_A, CONTA_B]);
  });

  it("com o cookie da B, a conta escolhida do administrador é a B", async () => {
    const { valor } = await comoNumaRequisicaoComSessao("/", () => conta.getSelectedAccountId(), {
      contaDoCookie: CONTA_B,
    });
    expect(valor).toBe(CONTA_B);
  });
});

// ---------------------------------------------------------------------------------------------------
// 4 e 5. A CONFIGURAÇÃO E O CONECTAR SÃO DO ADMINISTRADOR
// ---------------------------------------------------------------------------------------------------

/** Quantas linhas tem cada tabela do schema descartável (o molde de sessao-nas-acoes.integracao.ts). */
async function tamanhos(): Promise<Record<string, number>> {
  const tabelas = (await q(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = current_schema() and c.relkind in ('r', 'p') order by 1`
  )) as { relname: string }[];
  const saida: Record<string, number> = {};
  for (const { relname } of tabelas) {
    const [{ n }] = (await q(`select count(*)::int as n from "${relname}"`)) as { n: number }[];
    saida[relname] = n;
  }
  return saida;
}

/** O que as actions da Configuração mexeriam: a `config`, os convites e o tamanho de cada tabela. */
async function estadoDaConfiguracao() {
  return {
    config: await q(`select * from config where id = 1`),
    convites: await q(`select * from convites_de_conexao order by criado_em, id`),
    tamanhos: await tamanhos(),
  };
}

describe("a Configuração manda o login comum para o início, sem mudar nada", () => {
  let conviteId = "";

  beforeAll(async () => {
    conviteId = (await convites.criarConvite("convite do administrador")).id;
  });

  // A `config` VOLTA AO MESMO PONTO antes de cada caso: com o App ID e a URL do app (a Meta falsa), e sem
  // chave nenhuma. Assim um caso que mudasse a `config` (o RED) não muda o ponto de partida do seguinte.
  beforeEach(async () => {
    await q(
      `update config set instagram_app_id = $1, instagram_app_secret = null, meta_app_id = null,
              meta_app_secret = null, app_url = $2 where id = 1`,
      ["1234567890123456", `http://127.0.0.1:${PORTA}`]
    );
  });

  const ACOES: [string, () => Promise<unknown>][] = [
    ["reassinarWebhooks", () => setup.reassinarWebhooks()],
    ["testarWebhook", () => setup.testarWebhook()],
    [
      "configurarWebhookAuto",
      () => setup.configurarWebhookAuto(form({ meta_app_id: "999", meta_app_secret: "chave-inventada-do-comum" })),
    ],
    [
      "saveMetaCredentials",
      () => setup.saveMetaCredentials(form({ instagram_app_id: "888", instagram_app_secret: "outra-chave-inventada" })),
    ],
    ["salvarPerguntasDeAbertura", () => setup.salvarPerguntasDeAbertura(form({ conta: CONTA_A }))],
    ["gerarConvite", () => setup.gerarConvite(null, form({ para_quem: "Dr. Comum" }))],
    ["cancelarConvite", () => setup.cancelarConvite(form({ id: conviteId }))],
  ];

  it("a lista tem as 5 actions da Configuração e os 2 convites", () => {
    expect(ACOES).toHaveLength(7);
  });

  it.each(ACOES)("%s vai para /, e nada muda", async (_nome, acao) => {
    // A SESSÃO DO COMUM ANTES DA FOTO: a primeira entrada dele grava uma sessão, e ela não é da action.
    await cabecalhoDoComumDeTeste([CONTA_A]);
    const antes = await estadoDaConfiguracao();
    const d = await comoComum("/setup", acao);
    expect(d.destino).toBe("/");
    expect(await estadoDaConfiguracao()).toEqual(antes);
  });
});

describe("o /api/oauth/login é do administrador", () => {
  beforeAll(async () => {
    await q(`update config set instagram_app_id = $1, app_url = $2 where id = 1`, ["1234567890123456", APP_URL_FALSO]);
  });

  const comecar = (cookie: string) =>
    import("@/app/api/oauth/login/route").then((rota) =>
      rota.GET(new Pedido(`${APP_URL_FALSO}/api/oauth/login`, { method: "GET", headers: { cookie } }))
    );
  const setCookies = (r: Response) => (r.headers as Headers & { getSetCookie(): string[] }).getSetCookie();

  it("com a sessão do comum, volta para a raiz, sem state", async () => {
    const resposta = await comecar(await cabecalhoDoComumDeTeste([CONTA_A]));
    const para = new URL(resposta.headers.get("location") ?? "");
    expect(para.origin).toBe(APP_URL_FALSO);
    expect(para.pathname).toBe("/");
    expect(setCookies(resposta)).toEqual([]);
  });

  it("com a do administrador, segue para o Instagram, como hoje", async () => {
    const resposta = await comecar(await cabecalhoDaSessaoDeTeste());
    expect(new URL(resposta.headers.get("location") ?? "").origin).toBe("https://www.instagram.com");
  });
});

// A PÁGINA, chamada como componente no contexto de cada login: ela confere o papel no servidor, antes de
// ler a `config` e todas as contas (app/setup/page.tsx).
describe("a página da Configuração é do administrador", () => {
  const abrir = async () => {
    const tela = await import("@/app/setup/page");
    return tela.default({ searchParams: Promise.resolve({}) });
  };

  it("o comum vai para /", async () => {
    const d = await comoComum("/setup", abrir);
    expect(d.destino).toBe("/");
  });

  it("o administrador, para comparar, recebe a página", async () => {
    const d = await comoAdministrador("/setup", abrir);
    expect(d.digest).toBe(null);
    expect(d.valor).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------
// 6. UMA ROTA DE CONTA: O CSV DE E-MAILS
// ---------------------------------------------------------------------------------------------------

describe("a lista de e-mails do comum é a da conta dele", () => {
  const EMAIL_DA_A = "pessoa.da.a@exemplo.invalid";
  const EMAIL_DA_B = "pessoa.da.b@exemplo.invalid";

  beforeAll(async () => {
    // O `campos` montado por `jsonb_build_object`, como o motor grava (ver exportacao-completa.integracao.ts).
    for (const [contaId, igId, email] of [
      [CONTA_A, "9310000000000001", EMAIL_DA_A],
      [CONTA_B, "9310000000000002", EMAIL_DA_B],
    ] as const) {
      await q(
        `insert into contacts (account_id, ig_id, username, campos, last_reply_at)
         values ($1, $2, $3, jsonb_build_object('email', jsonb_build_object('valor', $4::text, 'em', $5::text)), now())`,
        [contaId, igId, `csv_${igId}`, email, "2026-11-05T12:00:00.000Z"]
      );
    }
  });

  it("com o cookie da B, o CSV traz o contato da A e nenhum da B", async () => {
    const rota = await import("@/app/api/contatos/csv/route");
    const cookie = await cabecalhoDoComumDeTeste([CONTA_A], CONTA_B);
    const d = await comoComum(
      "/api/contatos/csv",
      async () => {
        const r = await rota.GET(new Pedido(`${APP_URL_FALSO}/api/contatos/csv`, { method: "GET", headers: { cookie } }));
        return { status: r.status, texto: await r.text() };
      },
      { contas: [CONTA_A], contaDoCookie: CONTA_B }
    );
    expect(d.valor?.status).toBe(200);
    expect(d.valor?.texto).toContain(EMAIL_DA_A);
    expect(d.valor?.texto).not.toContain(EMAIL_DA_B);
  });
});

// ---------------------------------------------------------------------------------------------------
// 7. A ATIVIDADE E OS EVENTOS SEM CONTA
// ---------------------------------------------------------------------------------------------------

describe("a Atividade e os eventos sem conta", () => {
  beforeAll(async () => {
    for (const [contaId, texto] of [
      [CONTA_A, "atividade-da-a"],
      [CONTA_B, "atividade-da-b"],
      [null, "atividade-sem-conta"],
    ] as const) {
      await q(`insert into events (account_id, type, payload) values ($1, 'comment', jsonb_build_object('text', $2::text))`, [
        contaId,
        texto,
      ]);
    }
  });

  /** Os textos dos eventos deste bloco que a consulta da Atividade traz. */
  async function daAtividade(comEventosSemConta?: boolean): Promise<string[]> {
    const { EVENTS_FROM, buildWhere } = await import("@/lib/event-query");
    const { NO_FILTERS } = await import("@/lib/event-filters");
    const w =
      comEventosSemConta === undefined
        ? buildWhere(CONTA_A, NO_FILTERS)
        : buildWhere(CONTA_A, NO_FILTERS, comEventosSemConta);
    const linhas = (await q(`select e.payload->>'text' as texto ${EVENTS_FROM} where ${w.sql}`, w.params)) as {
      texto: string | null;
    }[];
    return linhas
      .map((l) => l.texto ?? "")
      .filter((t) => t.startsWith("atividade-"))
      .sort();
  }

  it("com false (o comum), traz só os da A", async () => {
    expect(await daAtividade(false)).toEqual(["atividade-da-a"]);
  });

  it("com o padrão (o administrador), traz os da A e os sem conta", async () => {
    expect(await daAtividade()).toEqual(["atividade-da-a", "atividade-sem-conta"]);
  });
});

// A TELA DA ATIVIDADE, chamada como componente: é ela que passa o papel à consulta dos eventos e à do
// seletor de posts (app/eventos/page.tsx). Os dois logins estão na A (o comum só tem a A; o administrador,
// sem cookie de conta, cai na primeira), então a única diferença entre eles é o papel.
describe("a tela da Atividade e um evento sem conta", () => {
  const MARCADOR = "evento-sem-conta-na-tela-da-atividade";
  const MIDIA_DO_EVENTO_SEM_CONTA = "17999000000031009";

  beforeAll(async () => {
    await q(
      `insert into events (account_id, type, payload)
       values (null, 'comment', jsonb_build_object('text', $1::text, 'media', jsonb_build_object('id', $2::text)))`,
      [MARCADOR, MIDIA_DO_EVENTO_SEM_CONTA]
    );
  });

  const abrir = async () => {
    const tela = await import("@/app/eventos/page");
    return tela.default({ searchParams: Promise.resolve({}) });
  };
  // O texto do evento chega à árvore em dois lugares: o `texto` do `<Realce>` e o JSON do `<pre>` dos
  // detalhes técnicos. Qualquer `prop` de texto com o marcador conta.
  const temOMarcador = (arvore: unknown) =>
    propsDaArvore(arvore, (p) => Object.values(p).some((v) => typeof v === "string" && v.includes(MARCADOR))).length > 0;
  const postsDoSeletor = (arvore: unknown) =>
    propsDaArvore(arvore, (p) => Array.isArray(p.posts)).flatMap((p) => (p.posts as { id: string }[]).map((o) => o.id));

  it("o comum não vê o evento sem conta, e o administrador vê", async () => {
    const comum = await comoComum("/eventos", abrir);
    const administrador = await comoAdministrador("/eventos", abrir);
    expect(comum.digest).toBe(null);
    expect(administrador.digest).toBe(null);
    expect(temOMarcador(comum.valor)).toBe(false);
    expect(temOMarcador(administrador.valor)).toBe(true);
  });

  it("o seletor de posts do comum não oferece o post do evento sem conta, e o do administrador oferece", async () => {
    const comum = await comoComum("/eventos", abrir);
    const administrador = await comoAdministrador("/eventos", abrir);
    expect(postsDoSeletor(comum.valor)).not.toContain(MIDIA_DO_EVENTO_SEM_CONTA);
    expect(postsDoSeletor(administrador.valor)).toContain(MIDIA_DO_EVENTO_SEM_CONTA);
  });
});

// ---------------------------------------------------------------------------------------------------
// 8. A LIGAÇÃO DO ID À CONTA (achado 181)
//
// Os pontos que recebem um id do navegador e o ligam à conta escolhida (`... and account_id = $n`) ficam
// presos às contas do login sem mudar uma linha deles: a conta escolhida do comum já é uma das dele. Aqui o
// comum, ligado só à A, manda um id que é da B. A recusa tem de vir sem mudar nada no banco; e, para a
// recusa não ser de qualquer pedido, o mesmo pedido com o id da A funciona.
// ---------------------------------------------------------------------------------------------------

describe("a ligação do id à conta: o comum com um id da B (181)", () => {
  const CONTATO_A = "9320000000000001";
  const CONTATO_B = "9320000000000002";
  let automacaoA = "";
  let automacaoB = "";
  let itemA = "";
  let itemB = "";

  async function novaAutomacao(contaId: string, nome: string): Promise<string> {
    const [linha] = (await q(
      `insert into automations (account_id, name, active, triggers, keywords, match_type, steps)
       values ($1, $2, false, '{dm}'::text[], '{oi}'::text[], 'contains', '[]'::jsonb)
       returning id`,
      [contaId, nome]
    )) as { id: string }[];
    return linha.id;
  }

  async function novoItemDaFila(contaId: string): Promise<string> {
    const [linha] = (await q(
      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status, not_before)
       values ($1, 'publicacao', null, $2, $3, 'pending', now() + interval '1 hour')
       returning id`,
      [contaId, { forma: "imagem", caminhos: [`${contaId}/agendado.jpg`] }, `contas-por-login-${contaId}`]
    )) as { id: string }[];
    return linha.id;
  }

  const automacao = (id: string) => q(`select * from automations where id = $1`, [id]);
  const contato = (contaId: string, igId: string) =>
    q(`select * from contacts where account_id = $1 and ig_id = $2`, [contaId, igId]);
  const item = (id: string) => q(`select * from queue where id = $1`, [id]);
  const tamanhoDaFila = async () => Number((await q(`select count(*)::int as n from queue`))[0].n);

  beforeAll(async () => {
    automacaoA = await novaAutomacao(CONTA_A, "automação da A");
    automacaoB = await novaAutomacao(CONTA_B, "automação da B");
    for (const [contaId, igId] of [
      [CONTA_A, CONTATO_A],
      [CONTA_B, CONTATO_B],
    ] as const) {
      // A JANELA DE 24H ABERTA nos dois: a recusa do `sendReply` não pode ser a da janela do próprio contato.
      await q(
        `insert into contacts (account_id, ig_id, username, last_reply_at, categoria)
         values ($1, $2, $3, now(), 'categoria de antes')`,
        [contaId, igId, `pessoa_${igId}`]
      );
    }
    itemA = await novoItemDaFila(CONTA_A);
    itemB = await novoItemDaFila(CONTA_B);
  });

  it("deleteAutomation: o id da B é recusado e a automação da B fica igual", async () => {
    const antes = await automacao(automacaoB);
    const d = await comoComum("/automacoes", () => automacoes.deleteAutomation(automacaoB));
    expect(d.valor).toEqual({ ok: false, erro: "Automação não encontrada." });
    expect(await automacao(automacaoB)).toEqual(antes);
  });

  it("deleteAutomation: o id da A, para comparar, apaga", async () => {
    const id = await novaAutomacao(CONTA_A, "automação da A para apagar");
    const d = await comoComum("/automacoes", () => automacoes.deleteAutomation(id));
    expect(d.valor).toEqual({ ok: true, ativoGravado: false });
    expect(await automacao(id)).toEqual([]);
  });

  it("salvarAutomacao: o id da B é recusado e a automação da B fica igual", async () => {
    const antes = await automacao(automacaoB);
    const d = await comoComum("/automacoes", () =>
      automacoes.salvarAutomacao(automacaoB, [{ id: "b_comum001", tipo: "dm", texto: "Oi!" }], [], {
        nome: "o comum tentou",
        ativo: false,
        gatilho: "dm",
        correspondencia: "any",
        palavras: [],
        entregaSemPortao: false,
      })
    );
    expect(d.valor).toEqual({ ok: false, erro: "Automação não encontrada." });
    expect(await automacao(automacaoB)).toEqual(antes);
  });

  // A RECUSA VEM ANTES DE QUALQUER CHAMADA À META, e é pela conta escolhida: a janela é lida em
  // `app/conversas/[id]/actions.ts:30-33`, com `where account_id = $1 and ig_id = $2` (:31) e a conta
  // escolhida (a A) no `$1`. O contato da B não tem linha na A, `windowState(null)` dá `open: false`
  // (lib/inbox-window.ts:20), e o `if` de `app/conversas/[id]/actions.ts:34` devolve a recusa antes do
  // `enqueueManualReply` (:38) e do `drainQueue` (:62). Nada vai à fila, e a Meta falsa não recebe nada.
  it("sendReply: o contato da B é recusado antes da Meta, e nada vai à fila", async () => {
    const pedidosAntes = meta.pedidos.length;
    const filaAntes = await tamanhoDaFila();
    const antes = await contato(CONTA_B, CONTATO_B);
    const d = await comoComum(`/conversas/${CONTATO_B}`, () =>
      conversas.sendReply(undefined, form({ contact: CONTATO_B, text: "mensagem que não pode sair" }))
    );
    expect(d.valor).toEqual({ error: "A janela de 24h fechou. Só é possível responder quem falou há menos de 24h." });
    expect(await tamanhoDaFila()).toBe(filaAntes);
    expect(meta.pedidos.length).toBe(pedidosAntes);
    expect(await contato(CONTA_B, CONTATO_B)).toEqual(antes);
  });

  // ESTA ACTION NÃO DIZ "RECUSADO": o `update` da conta escolhida pega zero linhas e ela volta com o aviso
  // de categoria salva, como para um contato que não existe (app/conversas/[id]/actions.ts:150-158). O que
  // prende a ligação é o banco: a categoria da B não muda. E a da A, pelo mesmo pedido, muda.
  it("definirCategoria: a categoria do contato da B não muda", async () => {
    const antes = await contato(CONTA_B, CONTATO_B);
    const d = await comoComum(`/conversas/${CONTATO_B}`, () =>
      conversas.definirCategoria(form({ contato: CONTATO_B, categoria: "mudada pelo comum" }))
    );
    expect(d.destino ?? "").toMatch(new RegExp(`^/conversas/${CONTATO_B}\\?`));
    expect(await contato(CONTA_B, CONTATO_B)).toEqual(antes);
  });

  it("definirCategoria: a do contato da A, para comparar, muda", async () => {
    await comoComum(`/conversas/${CONTATO_A}`, () =>
      conversas.definirCategoria(form({ contato: CONTATO_A, categoria: "mudada pelo comum" }))
    );
    expect((await contato(CONTA_A, CONTATO_A))[0].categoria).toBe("mudada pelo comum");
  });

  it("remarcarPublicacao: o item da B não é achado, e a hora dele fica igual", async () => {
    const antes = await item(itemB);
    const daquiADoisDias = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 16);
    const d = await comoComum("/publicar", () =>
      post.remarcarPublicacao(form({ id: itemB, data_hora: daquiADoisDias, fuso: "0" }))
    );
    expect(new URL(d.destino ?? "/", "http://127.0.0.1").searchParams.get("aviso")).toContain(
      "Não achei este post agendado nesta conta"
    );
    expect(await item(itemB)).toEqual(antes);
  });

  it("/automacoes/[id]: o id da B dá 404, e o da A abre", async () => {
    const tela = await import("@/app/automacoes/[id]/page");
    const abrir = (id: string) => comoComum(`/automacoes/${id}`, () => tela.default({ params: Promise.resolve({ id }) }));
    expect((await abrir(automacaoB)).digest).toBe(NAO_ACHOU);
    expect((await abrir(automacaoA)).digest).toBe(null);
  });

  it("/publicar/post/[id]: o item da B dá 404, e o da A abre", async () => {
    const tela = await import("@/app/publicar/post/[id]/page");
    const abrir = (id: string) =>
      comoComum(`/publicar/post/${id}`, () =>
        tela.default({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })
      );
    expect((await abrir(itemB)).digest).toBe(NAO_ACHOU);
    expect((await abrir(itemA)).digest).toBe(null);
  });

  it("/conversas/[id]: o contato da B não aparece, e o da A aparece", async () => {
    const tela = await import("@/app/conversas/[id]/page");
    const abrir = async (id: string) => {
      const d = await comoComum(`/conversas/${id}`, async () =>
        textoDaArvore(await tela.default({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }))
      );
      expect(d.digest).toBe(null);
      return d.valor ?? "";
    };
    expect(await abrir(CONTATO_B)).not.toContain(`pessoa_${CONTATO_B}`);
    expect(await abrir(CONTATO_A)).toContain(`pessoa_${CONTATO_A}`);
  });
});

describe("a cerca da rede", () => {
  it("nenhum pedido deste arquivo saiu da máquina", () => {
    expect(pedidosParaFora).toEqual([]);
  });
});
