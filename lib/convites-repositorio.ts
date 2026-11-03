import "server-only";
import { sql, upsertAccount } from "./db";
import { VALIDADE_DO_CONVITE_DIAS, codigoBemFormado, hashDoCodigo, novoCodigoDeConvite } from "./convites";

// OS CONVITES DE CONEXÃO NO BANCO (a 021, docs/specs/2026-11-03-link-de-convite.md). O relógio é o do
// banco, como no resto deste projeto: o prazo nasce de `now()`, e a reivindicação confere `expira_em >
// now()`.

/** O convite como o painel e as rotas o leem. O `codigo_hash` nunca sai daqui. */
export type Convite = {
  id: string;
  para_quem: string;
  criado_em: Date;
  expira_em: Date;
  cancelado_em: Date | null;
  usado_em: Date | null;
  conta_conectada: string | null;
  ultimo_erro: string | null;
  ultimo_erro_em: Date | null;
};

const COLUNAS =
  "id, para_quem, criado_em, expira_em, cancelado_em, usado_em, conta_conectada, ultimo_erro, ultimo_erro_em";
const COLUNAS_DA_LISTA = COLUNAS.split(", ")
  .map((coluna) => `c.${coluna}`)
  .join(", ");

// O id chega da volta do Instagram num cookie, e um valor torto não pode virar erro de banco.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Grava o hash de um código novo e devolve o código, que só existe nesta resposta. */
export async function criarConvite(paraQuem: string): Promise<{ id: string; codigo: string }> {
  const codigo = novoCodigoDeConvite();
  const [linha] = (await sql().query(
    `insert into convites_de_conexao (codigo_hash, para_quem, expira_em)
     values ($1, $2, now() + make_interval(days => $3))
     returning id`,
    [hashDoCodigo(codigo), paraQuem, VALIDADE_DO_CONVITE_DIAS]
  )) as { id: string }[];
  return { id: linha.id, codigo };
}

export async function conviteDoCodigo(codigo: string): Promise<Convite | null> {
  if (!codigoBemFormado(codigo)) return null;
  const [linha] = (await sql().query(`select ${COLUNAS} from convites_de_conexao where codigo_hash = $1`, [
    hashDoCodigo(codigo),
  ])) as Convite[];
  return linha ?? null;
}

export async function conviteDoId(id: string): Promise<Convite | null> {
  if (!UUID.test(id)) return null;
  const [linha] = (await sql().query(`select ${COLUNAS} from convites_de_conexao where id = $1`, [id])) as Convite[];
  return linha ?? null;
}

/** O convite da lista, com o arroba da conta que entrou por ele, quando entrou. */
export type ConviteNaLista = Convite & { conta_username: string | null };

/** Os 20 mais recentes, para a lista da etapa 6. */
export async function listarConvites(): Promise<ConviteNaLista[]> {
  return (await sql().query(
    `select ${COLUNAS_DA_LISTA}, a.username as conta_username
       from convites_de_conexao c
       left join accounts a on a.ig_user_id = c.conta_conectada
      order by c.criado_em desc, c.id desc
      limit 20`
  )) as ConviteNaLista[];
}

/** Só o pendente é cancelado. Devolve se cancelou. */
export async function cancelarConvite(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const linhas = await sql().query(
    `update convites_de_conexao set cancelado_em = now()
      where id = $1 and usado_em is null and cancelado_em is null
      returning id`,
    [id]
  );
  return linhas.length > 0;
}

/**
 * Anota o erro para o painel. "pendente" é a tentativa que falhou antes de reivindicar; "usado" é a
 * assinatura dos webhooks que falhou depois da conexão (achado 158). O texto já chega limpo e cortado
 * (`textoParaOPainel`).
 */
export async function anotarErroDoConvite(id: string, texto: string, estado: "pendente" | "usado"): Promise<void> {
  if (!UUID.test(id)) return;
  const condicao = estado === "pendente" ? "usado_em is null and cancelado_em is null" : "usado_em is not null";
  await sql().query(
    `update convites_de_conexao set ultimo_erro = $2, ultimo_erro_em = now() where id = $1 and ${condicao}`,
    [id, texto]
  );
}

/**
 * O USO DO CONVITE E A CONTA, NA MESMA TRANSAÇÃO. A reivindicação só volta a linha se o convite ainda
 * estiver pendente; sem ela, a conta não é gravada. Se a conta falhar ao gravar, a transação desfaz a
 * reivindicação, e o convite continua valendo. Devolve se conectou.
 */
export async function reivindicarEGravarConta(id: string, conta: Parameters<typeof upsertAccount>[0]): Promise<boolean> {
  if (!UUID.test(id)) return false;
  return sql().begin(async (tx) => {
    const reivindicado = await tx.query(
      `update convites_de_conexao set usado_em = now(), conta_conectada = $2
        where id = $1 and usado_em is null and cancelado_em is null and expira_em > now()
        returning id`,
      [id, conta.ig_user_id]
    );
    if (reivindicado.length === 0) return false;
    await upsertAccount(conta, tx);
    return true;
  });
}
