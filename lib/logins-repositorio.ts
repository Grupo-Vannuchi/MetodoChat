import "server-only";
import { sql } from "./db";
import { codigoDeSessaoBemFormado, hashDoCodigoDeSessao, novoCodigoDeSessao } from "./logins";

// OS LOGINS E AS SESSÕES NO BANCO (a 022, docs/specs/2026-11-04-logins.md). O relógio é o do banco, como no
// resto deste projeto: o prazo da sessão nasce de `now()`, e a conferência pede `expira_em > now()`.

/** A sessão vale 30 dias, como o cookie assinado de antes. */
export const VALIDADE_DA_SESSAO_DIAS = 30;

/** O login como a página Logins o lê. O `senha_hash` nunca sai daqui. */
export type Login = {
  id: string;
  email: string;
  nome: string;
  administrador: boolean;
  criado_em: Date;
  desativado_em: Date | null;
};

/** Quem está numa sessão válida, e qual é a sessão. */
export type LoginDaSessao = {
  id: string;
  email: string;
  nome: string;
  administrador: boolean;
  sessao_id: string;
};

// O id chega de um formulário, e um valor torto não pode virar erro de banco.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cria um login. O e-mail e o nome chegam já conferidos por lib/logins.ts. */
export async function criarLogin(dados: {
  email: string;
  nome: string;
  senhaHash: string | null;
}): Promise<{ id: string } | { erro: "email_repetido" }> {
  try {
    const [linha] = (await sql().query(
      `insert into logins (email, nome, senha_hash) values ($1, $2, $3) returning id`,
      [dados.email, dados.nome, dados.senhaHash]
    )) as { id: string }[];
    return { id: linha.id };
  } catch (e) {
    const erro = e as { code?: string; constraint_name?: string };
    if (erro.code === "23505" && erro.constraint_name === "logins_email_key") return { erro: "email_repetido" };
    throw e;
  }
}

/** O que a entrada precisa para conferir: o id, o hash (nulo na passagem) e se o login está desativado. */
export async function loginParaEntrar(
  email: string
): Promise<{ id: string; senha_hash: string | null; desativado: boolean } | null> {
  const [linha] = (await sql().query(
    `select id, senha_hash, desativado_em is not null as desativado from logins where email = $1`,
    [email]
  )) as { id: string; senha_hash: string | null; desativado: boolean }[];
  return linha ?? null;
}

/**
 * A PASSAGEM DA SENHA ÚNICA (seção 6 da spec): grava o hash só num login ativo que ainda está sem senha. A
 * segunda entrada já não passa por aqui, e duas entradas ao mesmo tempo gravam uma vez só.
 */
export async function gravarSenhaDaPassagem(id: string, senhaHash: string): Promise<boolean> {
  const linhas = (await sql().query(
    `update logins set senha_hash = $2
      where id = $1 and senha_hash is null and desativado_em is null
      returning id`,
    [id, senhaHash]
  )) as { id: string }[];
  return linhas.length === 1;
}

export async function listarLogins(): Promise<Login[]> {
  return (await sql().query(
    `select id, email, nome, administrador, criado_em, desativado_em from logins order by criado_em asc, email asc`
  )) as Login[];
}

/** O hash da senha de um login ativo, para a Minha conta conferir a senha atual. */
export async function senhaHashDoLogin(id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const [linha] = (await sql().query(
    `select senha_hash from logins where id = $1 and desativado_em is null`,
    [id]
  )) as { senha_hash: string | null }[];
  return linha?.senha_hash ?? null;
}

/** A senha nova dada pelo administrador: grava e derruba TODAS as sessões daquele login. */
export async function definirSenha(id: string, senhaHash: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  return sql().begin(async (tx) => {
    const linhas = (await tx.query(`update logins set senha_hash = $2 where id = $1 returning id`, [
      id,
      senhaHash,
    ])) as { id: string }[];
    if (linhas.length !== 1) return false;
    await tx.query(`delete from sessoes where login_id = $1`, [id]);
    return true;
  });
}

/** A troca da própria senha: grava e derruba as OUTRAS sessões, mantendo a de quem trocou. */
export async function trocarPropriaSenha(id: string, senhaHash: string, sessaoQueFica: string): Promise<boolean> {
  if (!UUID.test(id) || !UUID.test(sessaoQueFica)) return false;
  return sql().begin(async (tx) => {
    const linhas = (await tx.query(
      `update logins set senha_hash = $2 where id = $1 and desativado_em is null returning id`,
      [id, senhaHash]
    )) as { id: string }[];
    if (linhas.length !== 1) return false;
    await tx.query(`delete from sessoes where login_id = $1 and id <> $2`, [id, sessaoQueFica]);
    return true;
  });
}

export type ResultadoDaDesativacao = "desativado" | "proprio" | "ultimo_administrador" | "nao_encontrado";

/**
 * DESATIVA UM LOGIN E DERRUBA AS SESSÕES DELE, com as duas travas da spec: ninguém desativa o próprio
 * login, e o último administrador ativo fica.
 *
 * A SEGUNDA TRAVA PRECISA DO `for update` (achado 168). Numa transação comum, em READ COMMITTED, dois
 * administradores que desativam um ao outro ao mesmo tempo contariam 2 ativos cada um, e o painel ficaria
 * com 0. Com as linhas dos administradores ativos travadas ANTES de contar, a segunda transação espera a
 * primeira e, ao seguir, relê o `where`, que já não pega a linha desativada.
 */
export async function desativarLogin(alvo: string, quemPede: string): Promise<ResultadoDaDesativacao> {
  if (!UUID.test(alvo)) return "nao_encontrado";
  if (alvo === quemPede) return "proprio";
  return sql().begin(async (tx) => {
    const ativos = (await tx.query(
      `select id from logins where administrador and desativado_em is null for update`
    )) as { id: string }[];
    const [linha] = (await tx.query(
      `select administrador, desativado_em is not null as desativado from logins where id = $1 for update`,
      [alvo]
    )) as { administrador: boolean; desativado: boolean }[];
    if (!linha || linha.desativado) return "nao_encontrado";
    if (linha.administrador && ativos.length <= 1) return "ultimo_administrador";
    await tx.query(`update logins set desativado_em = now() where id = $1`, [alvo]);
    await tx.query(`delete from sessoes where login_id = $1`, [alvo]);
    return "desativado";
  });
}

export async function reativarLogin(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const linhas = (await sql().query(
    `update logins set desativado_em = null where id = $1 and desativado_em is not null returning id`,
    [id]
  )) as { id: string }[];
  return linhas.length === 1;
}

/** Abre uma sessão e devolve o código do cookie, que só existe nesta resposta. Limpa as vencidas. */
export async function criarSessao(loginId: string): Promise<string> {
  const codigo = novoCodigoDeSessao();
  await sql().query(
    `insert into sessoes (token_hash, login_id, expira_em) values ($1, $2, now() + make_interval(days => $3))`,
    [hashDoCodigoDeSessao(codigo), loginId, VALIDADE_DA_SESSAO_DIAS]
  );
  // Limpeza oportunista, como a do login_attempts: sem ela a tabela cresceria para sempre.
  await sql().query(`delete from sessoes where expira_em <= now()`);
  return codigo;
}

/** O login de uma sessão válida: não vencida, de login ativo. Código torto ou desconhecido dá null. */
export async function sessaoPorCodigo(codigo: string | undefined): Promise<LoginDaSessao | null> {
  if (!codigoDeSessaoBemFormado(codigo)) return null;
  const [linha] = (await sql().query(
    `select l.id, l.email, l.nome, l.administrador, s.id as sessao_id
       from sessoes s join logins l on l.id = s.login_id
      where s.token_hash = $1 and s.expira_em > now() and l.desativado_em is null`,
    [hashDoCodigoDeSessao(codigo)]
  )) as LoginDaSessao[];
  return linha ?? null;
}

/** O Sair: apaga a sessão no banco. */
export async function apagarSessao(codigo: string | undefined): Promise<void> {
  if (!codigoDeSessaoBemFormado(codigo)) return;
  await sql().query(`delete from sessoes where token_hash = $1`, [hashDoCodigoDeSessao(codigo)]);
}
