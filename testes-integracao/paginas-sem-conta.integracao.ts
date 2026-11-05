// AS PÁGINAS SEM CONTA, PELO PAPEL (docs/specs/2026-11-05-contas-por-login.md, seção 3): "O comum sem contas
// vê, nas páginas de conta, a frase 'Você ainda não tem contas. Peça ao administrador.' no lugar do convite para
// conectar." O administrador continua vendo o de hoje, com o link para a Configuração. A frase aparece UMA VEZ
// por seção da tela: o subtítulo do cabeçalho do comum fica vazio, e a frase mora no corpo.
//
// E O "RECONECTAR" DO INÍCIO, o link para /api/oauth/login, é só do administrador: conectar conta é dele (F3).
//
// AS PÁGINAS SÃO CHAMADAS COMO COMPONENTE, no contexto de requisição semeado (./semear-requisicao.ts), e lidas
// pela árvore que devolvem (`textoDaArvore`): o texto e os `props` simples, como `href=/setup`.
//
// A ORDEM DOS DOIS BLOCOS É PARTE DA MEDIDA, no molde de acoes-que-falam.integracao.ts. O primeiro roda com o
// schema SEM conta nenhuma: é o único jeito de o administrador, que vê todas, não ter conta. O segundo conecta
// uma conta: o comum que não a recebeu é o caso de verdade do comum sem contas, e o comum que a recebeu é o do
// "Reconectar". Cada bloco confere a própria condição antes de medir.
//
// NADA SAI DA MÁQUINA: a cerca da F3 deixa passar só o 127.0.0.1, e o último caso exige zero pedidos para fora.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

const banco = bancoDescartavel();

const CONTA = "17800000000051001";
let FRASE_SEM_CONTAS = "";
const pedidosParaFora: string[] = [];
let fetchDeVerdade: typeof fetch;

beforeAll(async () => {
  FRASE_SEM_CONTAS = (await import("@/lib/logins-textos")).FRASE_SEM_CONTAS;
  fetchDeVerdade = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.hostname !== "127.0.0.1") {
      pedidosParaFora.push(url.origin);
      throw new Error(`A CERCA DE paginas-sem-conta.integracao.ts recusou um pedido para ${url.origin}`);
    }
    return fetchDeVerdade(entrada, init);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = fetchDeVerdade;
});

/** Uma página, o convite de hoje dela e quantas vezes o comum sem contas lê a frase nela (uma por seção). */
type Pagina = { nome: string; rota: string; abrir: () => Promise<unknown>; deHoje: string[]; vezes: number };

// As páginas e o convite de hoje de cada uma, pelo texto que o administrador sem conta lê nelas.
const PAGINAS: Pagina[] = [
  {
    nome: "o Início",
    rota: "/",
    abrir: async () => (await import("@/app/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Nenhuma conta conectada ainda. Vá em", "Comece conectando sua conta do Instagram", "href=/setup"],
    vezes: 1,
  },
  {
    nome: "os Contatos",
    rota: "/contatos",
    abrir: async () => (await import("@/app/contatos/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Conecte uma conta do Instagram primeiro."],
    vezes: 1,
  },
  {
    // DUAS SEÇÕES, os Envios e as Interações, e cada uma diz por que está vazia.
    nome: "a Atividade",
    rota: "/eventos",
    abrir: async () => (await import("@/app/eventos/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Conecte uma conta do Instagram primeiro."],
    vezes: 2,
  },
  {
    nome: "as Automações",
    rota: "/automacoes",
    abrir: async () => (await import("@/app/automacoes/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Conecte uma conta para começar", "Conecte uma conta do Instagram em", "href=/setup"],
    vezes: 1,
  },
  {
    nome: "o Desempenho",
    rota: "/desempenho",
    abrir: async () => (await import("@/app/desempenho/page")).default(),
    deHoje: ["Conecte uma conta do Instagram para ver os números", "Nenhuma conta conectada ainda. Vá em", "href=/setup"],
    vezes: 1,
  },
  {
    nome: "as Publicações",
    rota: "/publicar",
    abrir: async () => (await import("@/app/publicar/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Nenhuma conta selecionada.", "Conecte uma conta do Instagram em Configuração para ver o que está agendado."],
    vezes: 1,
  },
  {
    // O teto do bucket é perguntado aqui, e falha sem a SUPABASE_URL, antes de qualquer pedido: a página já
    // segura essa falha (app/publicar/novo/page.tsx).
    nome: "o Novo post",
    rota: "/publicar/novo",
    abrir: async () => (await import("@/app/publicar/novo/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Nenhuma conta selecionada.", "Conecte uma conta do Instagram em Configuração para publicar pelo painel."],
    vezes: 1,
  },
];

const linhasDe = (texto: string) => texto.split("\n").map((l) => l.trim());
const quantasVezes = (texto: string, frase: string) => linhasDe(texto).filter((l) => l === frase).length;

/** O texto da página no contexto do comum, com as contas dadas. */
async function doComum(p: Pick<Pagina, "rota" | "abrir">, contas: string[] = []): Promise<string> {
  return textoDaArvore((await comoNumaRequisicaoComoComum(p.rota, p.abrir, { contas })).valor);
}

/** O texto da página no contexto do administrador (o login de teste). */
async function doAdministrador(p: Pick<Pagina, "rota" | "abrir">): Promise<string> {
  return textoDaArvore((await comoNumaRequisicaoComSessao(p.rota, p.abrir)).valor);
}

// ===========================================================================
// PRIMEIRO BLOCO: O SCHEMA AINDA NÃO TEM CONTA NENHUMA.
// ===========================================================================
describe("sem conta nenhuma no painel", () => {
  it("a condição deste bloco é o schema sem conta, e ele confere isso antes de medir", async () => {
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from accounts`)) as { n: number }[];
    expect(n).toBe(0);
  });

  it.each(PAGINAS)("$nome do administrador mostra o convite de hoje, e não a frase do comum", async (p) => {
    const texto = await doAdministrador(p);
    for (const t of p.deHoje) expect(texto, t).toContain(t);
    expect(quantasVezes(texto, FRASE_SEM_CONTAS)).toBe(0);
  });

  it.each(PAGINAS)("$nome do comum mostra a frase uma vez por seção, sem o convite de hoje nem o link para a Configuração", async (p) => {
    const texto = await doComum(p);
    expect(quantasVezes(texto, FRASE_SEM_CONTAS)).toBe(p.vezes);
    for (const t of p.deHoje) expect(texto, t).not.toContain(t);
    expect(texto).not.toContain("href=/setup");
  });
});

// ===========================================================================
// SEGUNDO BLOCO: O PAINEL TEM UMA CONTA.
// ===========================================================================
describe("com uma conta no painel", () => {
  beforeAll(async () => {
    // Valor inventado. Nenhuma credencial de verdade entra em teste.
    await banco.db().upsertAccount({
      ig_user_id: CONTA,
      username: "conta_das_paginas_sem_conta",
      name: null,
      profile_picture_url: null,
      access_token: "token-de-teste-que-nao-vale-nada",
      token_expires_at: null,
    });
  });

  it("a condição deste bloco é a conta conectada, o comum sem ela e o comum com ela", async () => {
    const { getSelectedAccountId } = await import("@/lib/account");
    expect((await comoNumaRequisicaoComSessao("/", () => getSelectedAccountId())).valor).toBe(CONTA);
    expect((await comoNumaRequisicaoComoComum("/", () => getSelectedAccountId(), { contas: [] })).valor).toBe(null);
    expect((await comoNumaRequisicaoComoComum("/", () => getSelectedAccountId(), { contas: [CONTA] })).valor).toBe(CONTA);
  });

  it.each(PAGINAS)("$nome do comum que não recebeu a conta continua com a frase, uma vez por seção", async (p) => {
    const texto = await doComum(p);
    expect(quantasVezes(texto, FRASE_SEM_CONTAS)).toBe(p.vezes);
    for (const t of p.deHoje) expect(texto, t).not.toContain(t);
    expect(texto).not.toContain("href=/setup");
  });

  // O "RECONECTAR" do Início começa a conexão de uma conta (/api/oauth/login), e a rota manda o comum para o
  // início (F3). O caso de comparação é o próprio cabeçalho com a conta: ele está ali, com o @ dela.
  it("o Início do comum com a conta não tem o Reconectar, e o do administrador tem", async () => {
    const inicio = PAGINAS[0];
    const comum = await doComum(inicio, [CONTA]);
    expect(linhasDe(comum)).toContain("conta_das_paginas_sem_conta");
    expect(comum).not.toContain("href=/api/oauth/login");
    expect(comum).not.toContain("Reconectar");
    const administrador = await doAdministrador(inicio);
    expect(administrador).toContain("href=/api/oauth/login");
    expect(administrador).toContain("Reconectar");
  });
});

describe("a cerca da rede", () => {
  it("nenhum pedido deste arquivo saiu da máquina", () => {
    expect(pedidosParaFora).toEqual([]);
  });
});
