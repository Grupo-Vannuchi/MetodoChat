import "server-only";
import { sql } from "./db";

// O LINKEDIN DE CADA CONTA DO PAINEL NO BANCO (a 024, docs/specs/2026-11-06-linkedin-no-perfil.md, §2). ESTE É
// O ÚNICO ARQUIVO QUE LÊ A `linkedin_conexoes`.
//
// O TOKEN NUNCA VAI AO NAVEGADOR: só `conexaoDaConta` devolve a linha inteira, e ela é do servidor (a volta do
// convite e, na parte 2, o dreno). As telas recebem só o resumo, o nome e o vencimento. tests/linkedin-token-
// fora-do-cliente.test.ts prende que nenhum componente de cliente importa este arquivo.

/** A conexão inteira, com a autorização. Só para o servidor. */
export type ConexaoDoLinkedin = {
  account_id: string;
  pessoa_id: string;
  nome: string;
  access_token: string;
  expira_em: Date;
  conectado_em: Date;
};

/** O que as telas podem ver: o nome da pessoa no LinkedIn e o vencimento. */
export type ResumoDaConexao = { nome: string; expira_em: Date };

/** O que a volta do convite grava. O `conectado_em` é o relógio do banco. */
export type NovaConexao = Omit<ConexaoDoLinkedin, "conectado_em">;

/** Quem grava: o `sql()` de sempre, ou a transação do convite (lib/convites-repositorio.ts). */
type Executor = Pick<ReturnType<typeof sql>, "query">;

export async function conexaoDaConta(accountId: string): Promise<ConexaoDoLinkedin | null> {
  const [linha] = (await sql().query(
    `select account_id, pessoa_id, nome, access_token, expira_em, conectado_em
       from linkedin_conexoes where account_id = $1`,
    [accountId]
  )) as ConexaoDoLinkedin[];
  return linha ?? null;
}

export async function resumoDaConexao(accountId: string): Promise<ResumoDaConexao | null> {
  const [linha] = (await sql().query(`select nome, expira_em from linkedin_conexoes where account_id = $1`, [
    accountId,
  ])) as ResumoDaConexao[];
  return linha ?? null;
}

/** Os resumos de todas as contas, pela conta. Para a Configuração, que é só do administrador. */
export async function resumosDasConexoes(): Promise<Map<string, ResumoDaConexao>> {
  const linhas = (await sql().query(`select account_id, nome, expira_em from linkedin_conexoes`)) as (ResumoDaConexao & {
    account_id: string;
  })[];
  return new Map(linhas.map(({ account_id, nome, expira_em }) => [account_id, { nome, expira_em }]));
}

/**
 * Grava a conexão da conta. Uma conta tem um LinkedIn só: gravar de novo troca a pessoa, o nome, a
 * autorização e o vencimento (a reconexão, inclusive com outra pessoa).
 */
export async function gravarConexao(c: NovaConexao, executor: Executor = sql()): Promise<void> {
  await executor.query(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, $3, $4, $5)
     on conflict (account_id) do update set
       pessoa_id = excluded.pessoa_id,
       nome = excluded.nome,
       access_token = excluded.access_token,
       expira_em = excluded.expira_em,
       conectado_em = now()`,
    [c.account_id, c.pessoa_id, c.nome, c.access_token, c.expira_em.toISOString()]
  );
}

/** O "Desconectar" da Configuração. Devolve se apagou. */
export async function apagarConexao(accountId: string): Promise<boolean> {
  const linhas = await sql().query(`delete from linkedin_conexoes where account_id = $1 returning account_id`, [accountId]);
  return linhas.length > 0;
}
