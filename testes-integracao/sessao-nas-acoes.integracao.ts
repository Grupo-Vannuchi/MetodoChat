// AS VINTE AÇÕES DA VARREDURA DE 26/10 NÃO AGEM SEM SESSÃO, dentro do contexto de requisição do Next
// (./semear-requisicao.ts), com a jarra de cookies VAZIA (docs/specs/2026-10-26-sessao-conferida.md).
//
// O caso de cada ação mede duas coisas: ela manda para /entrar, e NENHUMA tabela do schema descartável
// muda de tamanho. A contagem é de todas as tabelas, e não só da que a ação mexeria (condição C4 da
// auditoria), porque uma ação que escrevesse noutro lugar antes de conferir a sessão passaria por uma
// guarda só da tabela-alvo. O banco é semeado com uma conta, uma automação e um contato, para que uma
// ação SEM a conferência tivesse o que apagar, ativar ou duplicar.
//
// O caminho COM sessão é medido nos arquivos de cada ação, por `comoNumaRequisicaoComSessao`. O caso
// do topo confere que essa sessão é a de teste, sem que valor nenhum de cookie apareça.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao, sessaoDeTesteConfere } from "./semear-requisicao";

const banco = bancoDescartavel();

const CONTA = "17841400000000026";
const CONTATO = "17841400000000099";
let automacao = "";

type Modulos = {
  conta: typeof import("@/app/account-actions");
  automacoes: typeof import("@/app/automacoes/actions");
  contatos: typeof import("@/app/contatos/actions");
  conversas: typeof import("@/app/conversas/[id]/actions");
  visto: typeof import("@/app/conversas/[id]/marcar-visto");
  publicar: typeof import("@/app/publicar/actions");
  post: typeof import("@/app/publicar/post/actions");
  setup: typeof import("@/app/setup/actions");
};
let m: Modulos;

beforeAll(async () => {
  m = {
    conta: await import("@/app/account-actions"),
    automacoes: await import("@/app/automacoes/actions"),
    contatos: await import("@/app/contatos/actions"),
    conversas: await import("@/app/conversas/[id]/actions"),
    visto: await import("@/app/conversas/[id]/marcar-visto"),
    publicar: await import("@/app/publicar/actions"),
    post: await import("@/app/publicar/post/actions"),
    setup: await import("@/app/setup/actions"),
  };
  // Valor inventado. Nenhuma credencial de verdade entra em teste.
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_de_teste",
    name: null,
    profile_picture_url: null,
    access_token: "token-de-teste-que-nao-vale-nada",
    token_expires_at: null,
  });
  const [{ id }] = (await banco.db().sql().query(
    `insert into automations (account_id, name, active, triggers, keywords, match_type, steps)
     values ($1, 'automação de teste', false, '{dm}'::text[], '{oi}'::text[], 'contains', '[]'::jsonb)
     returning id`,
    [CONTA]
  )) as { id: string }[];
  automacao = id;
  await banco.db().sql().query(
    `insert into contacts (account_id, ig_id, username, last_reply_at) values ($1, $2, 'pessoa_de_teste', now())`,
    [CONTA, CONTATO]
  );
});

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

/** Quantas linhas tem cada tabela do schema descartável. */
async function tamanhos(): Promise<Record<string, number>> {
  const sql = banco.db().sql();
  const tabelas = (await sql.query(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = current_schema() and c.relkind in ('r', 'p') order by 1`
  )) as { relname: string }[];
  const saida: Record<string, number> = {};
  for (const { relname } of tabelas) {
    const [{ n }] = (await sql.query(`select count(*)::int as n from "${relname}"`)) as { n: number }[];
    saida[relname] = n;
  }
  return saida;
}

/** A URL do redirect que a ação lançou, lida do `digest`, como em bonus-acoes.integracao.ts. */
async function destinoSemSessao(acao: () => Promise<unknown>): Promise<string | null> {
  const { valor } = await comoNumaRequisicao("/", async () => {
    try {
      await acao();
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return null;
  return valor.split(";").slice(2, -2).join(";");
}

const ACOES: [string, () => Promise<unknown>][] = [
  ["selectAccount", () => m.conta.selectAccount(formulario({ account_id: CONTA }))],
  ["salvarAutomacao", () => m.automacoes.salvarAutomacao(automacao, [], [], {})],
  ["criarAutomacao", () => m.automacoes.criarAutomacao(null, formulario({ nome: "outra" }))],
  ["toggleAutomation", () => m.automacoes.toggleAutomation(automacao, true)],
  ["deleteAutomation", () => m.automacoes.deleteAutomation(automacao)],
  ["duplicateAutomation", () => m.automacoes.duplicateAutomation(automacao)],
  ["atualizarPerfis", () => m.contatos.atualizarPerfis(formulario({ categoria: "tudo" }))],
  ["enviarLote", () => m.contatos.enviarLote(formulario({ categoria: "tudo", texto: "oi" }))],
  ["marcarCategoriaEmLote", () => m.contatos.marcarCategoriaEmLote(formulario({ filtro: "tudo" }))],
  ["sendReply", () => m.conversas.sendReply(undefined, formulario({ contato: CONTATO, texto: "oi" }))],
  ["definirCategoria", () => m.conversas.definirCategoria(formulario({ contato: CONTATO, categoria: "lead" }))],
  ["marcarVisto", () => m.visto.marcarVisto(CONTATO)],
  ["publicar", () => m.publicar.publicar(formulario({ legenda: "oi" }))],
  ["cancelarPublicacao", () => m.post.cancelarPublicacao(formulario({ id: "1" }))],
  ["remarcarPublicacao", () => m.post.remarcarPublicacao(formulario({ id: "1" }))],
  ["reassinarWebhooks", () => m.setup.reassinarWebhooks()],
  ["testarWebhook", () => m.setup.testarWebhook()],
  ["configurarWebhookAuto", () => m.setup.configurarWebhookAuto(formulario({}))],
  ["saveMetaCredentials", () => m.setup.saveMetaCredentials(formulario({ instagram_app_id: "1", instagram_app_secret: "x" }))],
  ["salvarPerguntasDeAbertura", () => m.setup.salvarPerguntasDeAbertura(formulario({ conta: CONTA }))],
];

describe("a sessão de teste", () => {
  it("é a que a ação de entrar emitiu, assinada com a senha de teste", async () => {
    expect(await sessaoDeTesteConfere()).toBe(true);
  });
});

describe("sem sessão, nenhuma das vinte ações age", () => {
  it("a lista tem as vinte", () => {
    expect(ACOES).toHaveLength(20);
  });

  it.each(ACOES)("%s vai para /entrar, e nenhuma tabela muda", async (_nome, acao) => {
    const antes = await tamanhos();
    expect(await destinoSemSessao(acao)).toBe("/entrar");
    expect(await tamanhos()).toEqual(antes);
  });
});
