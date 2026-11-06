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

/**
 * Cria um login. O e-mail e o nome chegam já conferidos por lib/logins.ts. O PAPEL VAI SEMPRE EXPLÍCITO
 * (docs/specs/2026-11-05-contas-por-login.md, seção 4): o padrão da 023 é comum, e é só a rede de baixo.
 */
export async function criarLogin(dados: {
  email: string;
  nome: string;
  senhaHash: string | null;
  administrador: boolean;
}): Promise<{ id: string } | { erro: "email_repetido" }> {
  try {
    const [linha] = (await sql().query(
      `insert into logins (email, nome, senha_hash, administrador) values ($1, $2, $3, $4) returning id`,
      [dados.email, dados.nome, dados.senhaHash, dados.administrador]
    )) as { id: string }[];
    return { id: linha.id };
  } catch (e) {
    const erro = e as { code?: string; constraint_name?: string };
    if (erro.code === "23505" && erro.constraint_name === "logins_email_key") return { erro: "email_repetido" };
    throw e;
  }
}

/**
 * O que a entrada precisa para conferir: o id, o hash e se o login está desativado. O hash nulo é o de um
 * login sem senha própria, que não entra (docs/specs/2026-11-05-contas-por-login.md, seção 5).
 */
export async function loginParaEntrar(
  email: string
): Promise<{ id: string; senha_hash: string | null; desativado: boolean } | null> {
  const [linha] = (await sql().query(
    `select id, senha_hash, desativado_em is not null as desativado from logins where email = $1`,
    [email]
  )) as { id: string; senha_hash: string | null; desativado: boolean }[];
  return linha ?? null;
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

export type ResultadoDoPapel = "ok" | "proprio" | "ultimo_administrador" | "nao_encontrado";

/**
 * TROCA O PAPEL DE UM LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4), com as mesmas travas do
 * desativar: ninguém muda o próprio papel, e o último administrador ativo não vira comum.
 *
 * O `for update` é o mesmo do `desativarLogin` (achado 168): dois administradores que rebaixam um ao outro ao
 * mesmo tempo contariam 2 cada um sem a trava, e o painel ficaria sem nenhum. As ligações com contas ficam como
 * estão nas duas direções: para o administrador elas não importam, e voltam a valer se ele virar comum.
 */
export async function definirPapelDoLogin(id: string, administrador: boolean, quemPede: string): Promise<ResultadoDoPapel> {
  if (!UUID.test(id)) return "nao_encontrado";
  if (id === quemPede) return "proprio";
  return sql().begin(async (tx) => {
    const ativos = (await tx.query(
      `select id from logins where administrador and desativado_em is null for update`
    )) as { id: string }[];
    const [linha] = (await tx.query(
      `select administrador, desativado_em is not null as desativado from logins where id = $1 for update`,
      [id]
    )) as { administrador: boolean; desativado: boolean }[];
    if (!linha) return "nao_encontrado";
    if (!administrador && linha.administrador && !linha.desativado && ativos.length <= 1) return "ultimo_administrador";
    await tx.query(`update logins set administrador = $2 where id = $1`, [id, administrador]);
    return "ok";
  });
}

/** As contas que um login comum recebeu, na ordem do id. Para o administrador, a lista é a dele, e não importa. */
export async function idsDasContasDoLogin(loginId: string): Promise<string[]> {
  if (!UUID.test(loginId)) return [];
  const linhas = (await sql().query(
    `select account_id from logins_contas where login_id = $1 order by account_id`,
    [loginId]
  )) as { account_id: string }[];
  return linhas.map((l) => l.account_id);
}

export type ResultadoDasContas = "ok" | "nao_encontrado" | "administrador" | "conta_inexistente";

/**
 * TROCA DE UMA VEZ AS CONTAS DE UM LOGIN COMUM (docs/specs/2026-11-05-contas-por-login.md, seção 4), numa
 * transação: a linha do login fica travada enquanto o conjunto troca, para um "tornar administrador" ao mesmo
 * tempo não se cruzar com isto. Recusa o login que não existe ou está desativado, o administrador, que vê todas,
 * e a conta que não existe, sem mudar nada.
 */
export async function definirContasDoLogin(loginId: string, contas: string[]): Promise<ResultadoDasContas> {
  if (!UUID.test(loginId)) return "nao_encontrado";
  const unicas = [...new Set(contas)];
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(
      `select administrador, desativado_em is not null as desativado from logins where id = $1 for update`,
      [loginId]
    )) as { administrador: boolean; desativado: boolean }[];
    if (!linha || linha.desativado) return "nao_encontrado";
    if (linha.administrador) return "administrador";
    if (unicas.length) {
      const [{ n }] = (await tx.query(`select count(*)::int as n from accounts where ig_user_id = any($1::text[])`, [
        unicas,
      ])) as { n: number }[];
      if (n !== unicas.length) return "conta_inexistente";
    }
    await tx.query(`delete from logins_contas where login_id = $1`, [loginId]);
    if (unicas.length) {
      await tx.query(
        `insert into logins_contas (login_id, account_id) select $1, unnest($2::text[])`,
        [loginId, unicas]
      );
    }
    return "ok";
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
