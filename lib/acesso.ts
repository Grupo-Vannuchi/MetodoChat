import "server-only";
import { listAccounts, sql, type Account } from "./db";
import { escolherConta } from "./acesso-escolha";
import { idsDasContasDoLogin, type LoginDaSessao } from "./logins-repositorio";

// QUEM VÊ QUAL CONTA (docs/specs/2026-11-05-contas-por-login.md, seção 2). ESTE É O ÚNICO LUGAR QUE SABE.
// O resto do código pergunta a ele: a conta escolhida (lib/account.ts), o seletor do layout, o
// `selectAccount` e, com eles, todo ponto que já liga o id que vem do navegador à conta escolhida.
//
// A REGRA DE HOJE: o administrador vê todas as contas; o login comum, só as ligadas a ele na
// `logins_contas` (a 023). O administrador não precisa de linha nenhuma.
//
// VIRAR MULTIEMPRESA É TROCAR A REGRA DAQUI (o "ManyChat com CRM" que o Eduardo deixou para depois, em
// 05/11): as contas de um login passam a ser as da empresa dele, e nenhum ponto que pergunta muda. Por isso
// nada fora deste arquivo pode ler a `logins_contas` ou decidir pelo `administrador` qual conta alguém vê.
//
// NADA FICA GUARDADO ENTRE PEDIDOS: tirar uma conta de um login vale no próximo clique.

/** As contas que o login vê, na ordem de `listAccounts` (`created_at`). */
export async function contasDoLogin(login: LoginDaSessao): Promise<Account[]> {
  if (login.administrador) return listAccounts();
  return (await sql().query(
    `select a.* from accounts a
       join logins_contas lc on lc.account_id = a.ig_user_id
      where lc.login_id = $1
      order by a.created_at asc`,
    [login.id]
  )) as Account[];
}

/** Se o login vê a conta: o administrador, se ela existe; o comum, se ela foi dada a ele. */
export async function podeVerConta(login: LoginDaSessao, contaId: string): Promise<boolean> {
  if (!contaId) return false;
  if (login.administrador) {
    const linhas = (await sql().query(`select 1 from accounts where ig_user_id = $1`, [contaId])) as unknown[];
    return linhas.length > 0;
  }
  // A ligação já garante que a conta existe: a chave estrangeira da 023 apaga a linha junto com a conta.
  return (await idsDasContasDoLogin(login.id)).includes(contaId);
}

/** De uma lista qualquer de contas (o carrossel usa a dos cabeçalhos), as que o login vê, na mesma ordem. */
export async function soAsDoLogin<T extends { ig_user_id: string }>(login: LoginDaSessao, contas: T[]): Promise<T[]> {
  if (login.administrador) return contas;
  const dele = new Set(await idsDasContasDoLogin(login.id));
  return contas.filter((c) => dele.has(c.ig_user_id));
}

/**
 * A conta escolhida do login: a do cookie, se ele a vê; senão, a primeira que ele vê; senão, nenhuma. A
 * escolha em si é pura (`escolherConta`, lib/acesso-escolha.ts); aqui só entra a lista do login.
 */
export async function contaEscolhida(login: LoginDaSessao, doCookie: string | undefined): Promise<Account | null> {
  return escolherConta(await contasDoLogin(login), doCookie);
}
