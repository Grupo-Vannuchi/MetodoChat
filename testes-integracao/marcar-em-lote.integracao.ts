// A MARCAÇÃO EM LOTE ESCREVE SÓ NA CONTA SELECIONADA, E CONTA CERTO.
//
// A PROMESSA, escrita como teste: **um `ig_id` de outra conta colado no POST
// não muda nada, e a frase do desfecho conta o que o banco mexeu — não o que o
// formulário pediu.**
//
// POR QUE DE INTEGRAÇÃO, E NÃO PURO: a pergunta é sobre o `where` da consulta.
// `idsSelecionados` já tem os casos dela em `tests/categorias.test.ts` e
// continua verde com o `account_id` removido — ela filtra certo a lista certa,
// e a conta que sobra é assunto do SQL. O que só se mede pelo EFEITO é em quais
// LINHAS a escrita pousou.
//
// A AÇÃO É CHAMADA DE VERDADE, e não uma cópia da consulta dela escrita à mão
// aqui do lado. As duas primeiras versões deste arquivo tentaram o atalho —
// reescrever o mesmo SQL dentro do teste — e o Passo 5 (plantar a remoção do
// `account_id` DENTRO da ação e conferir que o teste morde) denunciou o atalho
// na hora: a ação ficou sem `account_id` nenhum e os três casos continuaram
// verdes, porque nenhum deles chamava a ação — só repetiam a consulta boa ao
// lado da consulta estragada. Um teste que prova uma cópia não prova o
// original. Por isso `marcarCategoriaEmLote` (`@/app/contatos/actions`) é
// chamada dentro do mesmo par de armazenamentos que o Next monta para uma
// requisição de verdade — a mesma maquinaria de
// `testes-integracao/acoes-que-falam.integracao.ts`, e o mesmo motivo: sob o
// vitest o `"use server"` é inerte, mas `getSelectedAccount` (lib/account.ts)
// chama `cookies()` de `next/headers`, que estoura fora de uma requisição.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/contatos/actions");
type ModuloConta = typeof import("@/lib/account");

const banco = bancoDescartavel();

const CONTA = "17800000000000777";
const VIZINHA = "17800000000000888";

let acoes: ModuloAcoes;
let conta: ModuloConta;

// `banco.db()` JÁ devolve o `lib/db` de verdade, carregado depois de a
// DATABASE_URL apontar para o schema descartável. Não precisa de cast.
async function semearContato(contaId: string, igId: string, categoria: string | null) {
  await banco.db().sql().query(
    `insert into contacts (account_id, ig_id, username, last_reply_at, categoria)
     values ($1, $2, 'pessoa_de_teste', now(), $3)
     on conflict (account_id, ig_id) do update set categoria = excluded.categoria`,
    [contaId, igId, categoria]
  );
}

async function categoriaDe(contaId: string, igId: string): Promise<string | null> {
  // `sql().query` devolve as LINHAS direto (postgres.js), nunca `{ rows }` — o
  // mesmo padrão de `app/conversas/[id]/actions.ts`. O `as` abaixo tipa o que
  // o driver não tipa sozinho.
  const r = (await banco.db().sql().query(
    `select categoria from contacts where account_id = $1 and ig_id = $2`,
    [contaId, igId]
  )) as { categoria: string | null }[];
  return r[0]?.categoria ?? null;
}

/**
 * O formulário que a barra de lote manda — os mesmos nomes que a ação lê.
 *
 * `q` e `linhas` são OPCIONAIS: a maioria dos casos não mede o lugar, só a
 * marcação — e um formulário que sempre mandasse os dois escondia, por
 * omissão, que a ação lê `formData.get("linhas")` como string OU AUSENTE.
 */
function formularioDeLote(campos: {
  categoria: string;
  ids: string[];
  q?: string;
  linhas?: string;
}): FormData {
  const form = new FormData();
  form.set("filtro", "tudo");
  form.set("categoria", campos.categoria);
  for (const id of campos.ids) form.append("ig_id", id);
  if (campos.q !== undefined) form.set("q", campos.q);
  if (campos.linhas !== undefined) form.set("linhas", campos.linhas);
  return form;
}

// --- O mesmo par "digest / url" de `acoes-que-falam.integracao.ts` ---------
//
// `redirect()` do Next lança, e o formato do `digest` da exceção de controle
// de fluxo é `NEXT_REDIRECT;<tipo>;<url>;<código>;`. Afirmar o PREFIXO é de
// propósito: o dia em que essa marca mudar, este caso fica VERMELHO em vez de
// passar a não medir nada.
type Desfecho = { digest: string | null; url: string | null };

function urlDoDigest(digest: string | null): string | null {
  if (digest === null || !digest.startsWith("NEXT_REDIRECT;")) return null;
  return digest.split(";").slice(2, -2).join(";");
}

async function marcar(form: FormData): Promise<Desfecho> {
  const { valor } = await comoNumaRequisicao("/contatos", async () => {
    try {
      await acoes.marcarCategoriaEmLote(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      // Erro de verdade: relançar. Engoli-lo aqui esconderia uma falha da ação
      // atrás de um "não fez redirect nenhum" sem nome.
      throw e;
    }
  });
  return { digest: valor, url: urlDoDigest(valor) };
}

/** O aviso que viajou na URL de volta, já decodificado — texto e tom. */
function avisoDaUrlDeVolta(url: string | null): { texto: string | null; tom: string | null } {
  if (url === null) return { texto: null, tom: null };
  const sp = new URL(url, "http://127.0.0.1").searchParams;
  return { texto: sp.get("aviso"), tom: sp.get("tom") };
}

/**
 * O LUGAR que viajou na URL de volta — busca e contagem de linhas, já
 * decodificados pelo `URL`. É a razão de `urlDoAvisoNaTabela` (lib/avisos.ts)
 * existir por cima de `urlDoAviso`: sem isto, nenhum caso deste arquivo
 * distingue a função que preserva `q`/`linhas` de uma que os descarta.
 */
function lugarDaUrlDeVolta(url: string | null): { q: string | null; linhas: string | null } {
  if (url === null) return { q: null, linhas: null };
  const sp = new URL(url, "http://127.0.0.1").searchParams;
  return { q: sp.get("q"), linhas: sp.get("linhas") };
}

beforeAll(async () => {
  // O import vem DEPOIS de o harness ter apontado a DATABASE_URL para o schema
  // temporário: `app/contatos/actions.ts` puxa `lib/db`, e o `_sql` de lá é
  // singleton de módulo que lê o ambiente na primeira chamada.
  acoes = (await import("@/app/contatos/actions")) as ModuloAcoes;
  conta = (await import("@/lib/account")) as ModuloConta;

  // CONTA nasce ANTES de VIZINHA, e é essa ordem — não um cookie forjado — que
  // decide quem `getSelectedAccount` escolhe. Nenhum cookie de conta é
  // plantado aqui: a mesma disciplina de `semear-requisicao.ts` ("nenhuma
  // sessão é forjada aqui"), aplicada à conta. `listAccounts` (lib/db.ts) pede
  // `order by created_at asc`, e as duas linhas nascem de dois `INSERT`
  // sequenciais — dois retornos de rede, não a mesma instrução — então os dois
  // `now()` do Postgres não empatam.
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_prova",
    name: null,
    profile_picture_url: null,
    access_token: "t",
    token_expires_at: null,
  });
  await banco.db().upsertAccount({
    ig_user_id: VIZINHA,
    username: "conta_vizinha",
    name: null,
    profile_picture_url: null,
    access_token: "t",
    token_expires_at: null,
  });

  // A PRECONDIÇÃO É CONFERIDA ANTES DE MEDIR, e não presumida: se a ordem de
  // criação um dia deixar de bastar (ou algo plantar um cookie sem querer), o
  // teste tem de morrer aqui, com nome, e não silenciosamente medir a conta
  // errada.
  const { valor } = await comoNumaRequisicao("/contatos", () => conta.getSelectedAccountId());
  if (valor !== CONTA) {
    throw new Error(
      `PRECONDIÇÃO QUEBRADA: sem cookie, \`getSelectedAccount\` devolveu ` +
        `\`${String(valor)}\`, e este arquivo espera \`${CONTA}\` (a primeira conta ` +
        "criada). Sem isso, os casos abaixo mediriam a conta errada — ou nenhuma."
    );
  }
});

describe("marcar categoria em lote", () => {
  test("marca só quem é da conta, e o id da vizinha não se move", async () => {
    await semearContato(CONTA, "9001", null);
    await semearContato(CONTA, "9002", null);
    await semearContato(VIZINHA, "9003", null);

    // O POST manda TRÊS ids; um deles é de outra conta.
    const d = await marcar(formularioDeLote({ categoria: "alunos", ids: ["9001", "9002", "9003"] }));

    expect(await categoriaDe(CONTA, "9001")).toBe("alunos");
    expect(await categoriaDe(CONTA, "9002")).toBe("alunos");
    // A PROVA CENTRAL: a vizinha não foi tocada.
    expect(await categoriaDe(VIZINHA, "9003")).toBeNull();

    // A FRASE CONTA O QUE O BANCO MEXEU (2), NÃO O QUE O FORMULÁRIO PEDIU (3).
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toBe("2 contatos marcados como alunos.");
  });

  test("conta quantos TROCARAM, e quem já estava na categoria não conta", async () => {
    await semearContato(CONTA, "9101", "clientes");
    await semearContato(CONTA, "9102", "alunos");
    await semearContato(CONTA, "9103", null);

    const d = await marcar(formularioDeLote({ categoria: "alunos", ids: ["9101", "9102", "9103"] }));

    // 9101 trocou (clientes -> alunos). 9102 já era alunos. 9103 não tinha.
    expect(await categoriaDe(CONTA, "9101")).toBe("alunos");
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toBe("3 contatos marcados como alunos · 1 trocou de categoria.");
  });

  test("id que não existe não inventa linha, e o aviso diz que nada foi marcado", async () => {
    const d = await marcar(formularioDeLote({ categoria: "amigos", ids: ["9999999999"] }));

    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe(
      "Nenhum contato foi marcado — os selecionados não pertencem a esta conta."
    );
  });

  test("nenhum id marcado no formulário recusa antes de tocar o banco", async () => {
    await semearContato(CONTA, "9401", null);

    // `formularioDeLote` sem `ids` — nenhum campo `ig_id` no POST.
    const d = await marcar(formularioDeLote({ categoria: "amigos", ids: [] }));

    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("Nenhum contato selecionado.");
    expect(await categoriaDe(CONTA, "9401")).toBeNull();
  });

  // ACHADO 1 (auditoria de 14/09): a restrição mais citada da spec — "um
  // `value` forjado no POST não pode inventar categoria nova em 25 contatos
  // de uma vez" — não tinha caso nenhum. Trocar o `||` da ação por `&&`, ou
  // apagar a checagem contra `CATEGORIAS_SUGERIDAS`, passava pela suíte
  // inteira sem acusar nada.
  test("categoria fora da lista recusa, e o contato semeado não é tocado", async () => {
    await semearContato(CONTA, "9501", null);

    // "interessado" não é uma das quatro (`clientes`, `equipe`, `amigos`,
    // `alunos`) — é o `value` forjado que a checagem tem de barrar.
    const d = await marcar(formularioDeLote({ categoria: "interessado", ids: ["9501"] }));

    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("Categoria desconhecida.");

    // A METADE QUE PROVA A ORDEM: a recusa aconteceu ANTES da escrita, e não
    // depois. Sem esta linha o caso mede só a frase — um `redirect` colocado
    // DEPOIS do `UPDATE` teria passado por ele do mesmo jeito.
    expect(await categoriaDe(CONTA, "9501")).toBeNull();
  });

  // ACHADO 2 (auditoria de 14/09): `volta()` existe para preservar o filtro,
  // a busca (`q`) e `linhas` no redirect — e nenhum caso tocava `q`/`linhas`.
  // Esquecer `formData.get("linhas")` na ação não derrubava nada.
  test("q e linhas voltam na URL de sucesso, decodificados", async () => {
    await semearContato(CONTA, "9601", null);

    // "maria & joão" carrega um `&` de propósito: se `urlDoAvisoNaTabela`
    // colasse `q` cru na query, o `&` quebraria o parâmetro ao meio, e
    // `URLSearchParams` devolveria só "maria ". Provado num caminho de
    // SUCESSO — não numa recusa — para garantir que o lugar sobrevive à
    // operação que interessa, e não só ao atalho de sair cedo.
    const d = await marcar(
      formularioDeLote({ categoria: "amigos", ids: ["9601"], q: "maria & joão", linhas: "75" })
    );

    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");

    const lugar = lugarDaUrlDeVolta(d.url);
    expect(lugar.q).toBe("maria & joão");
    expect(lugar.linhas).toBe("75");
  });
});
