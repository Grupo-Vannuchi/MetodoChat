import "server-only";
import { sql } from "@/lib/db";
import type { ContaDoCabecalho, ContaGuardada } from "./arte-conta";
import type { ContextoDoCarrossel } from "./carrossel-ia-parametros";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { TETO_CARROSSEL_DIARIO } from "./carrossel-pedido";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
import { juntarParte, type ParteDoCarrossel, type ProblemaDoCampo, type TextoDoCarrossel } from "./carrossel-texto";
import type { Medicao } from "./ia-parametros";
import { ehIdDeBonus } from "./pedido";
import { publicacaoLivre, type EstadoDaPublicacao } from "./publicar-estado";
import { estadoDaPublicacaoNa } from "./publicar-repositorio";

// O SQL DO CARROSSEL. Toda escrita é um `update` CONDICIONAL: o `where` é a proteção, e
// testes-integracao/bonus-carrossel-processo.integracao.ts é quem acusa se alguém a tirar.
// Objeto vai CRU para coluna `jsonb`, nunca `JSON.stringify` (a lição da FASE 1.7).

/**
 * A chave da trava do teto do carrossel. Número fixo, PRÓPRIO e diferente da do bônus
 * (`TRAVA_DO_TETO`, repositorio.ts): os dois tetos são independentes. Exportada para o teste
 * segurar a trava e provar que o pedido espera por ela.
 */
export const TRAVA_DO_TETO_DO_CARROSSEL = 2026093001;

/**
 * O QUE O TETO CONTA: os pedidos das últimas 24 horas que chamaram a IA. O escrito à mão (Etapa 7)
 * não gasta IA, e fica fora. A tela e o pedido contam pela mesma consulta.
 */
const CONTAGEM_DO_TETO = `select count(*)::int as n from carrosseis_gerados
  where criado_em > now() - interval '24 hours' and not texto_a_mao`;

export async function carrosseisNasUltimas24h(): Promise<number> {
  const [linha] = (await sql().query(CONTAGEM_DO_TETO)) as { n: number }[];
  return linha?.n ?? 0;
}

/** A transação: só `query`, como lib/db.ts a entrega. */
type Transacao = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };

/** A conta como a coluna `arte` a guarda: sem as chaves vazias. */
function chavesDaConta(c: Partial<ContaGuardada> | null): Record<string, string> {
  return Object.fromEntries(Object.entries(c ?? {}).filter(([, v]) => typeof v === "string" && v !== "")) as Record<
    string,
    string
  >;
}

/**
 * CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11. Serve ao
 * pedido de bônus e ao avulso pela IA; `inserir` grava a linha e devolve o id.
 */
async function comTeto(inserir: (tx: Transacao) => Promise<string>): Promise<{ ok: true; id: string } | { ok: false }> {
  return sql().begin(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);
    const [contagem] = (await tx.query(CONTAGEM_DO_TETO)) as { n: number }[];
    if ((contagem?.n ?? 0) >= TETO_CARROSSEL_DIARIO) return { ok: false as const };
    return { ok: true as const, id: await inserir(tx) };
  });
}

/**
 * O PEDIDO DE CARROSSEL DE UM BÔNUS DO CHAT, dentro do teto. `conta` é a conta do carrossel, com o
 * nome e o @, gravada no pedido (spec da Etapa 4): o carrossel é dela, e nunca vira de outra. Sem
 * conta, a arte nasce `{}`.
 */
export async function criarPedidoDeCarrossel(p: {
  bonusId: string;
  total: number;
  palavra: string;
  contexto: ContextoDoCarrossel;
  conta: ContaGuardada | null;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  return comTeto(async (tx) => {
    const [criada] = (await tx.query(
      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, arte)
       values ($1, $2, $3, $4::jsonb, $5::jsonb) returning id`,
      [p.bonusId, p.total, p.palavra, p.contexto, p.conta?.conta ? chavesDaConta(p.conta) : {}]
    )) as { id: string }[];
    return criada.id;
  });
}

/**
 * O CARROSSEL AVULSO (spec da Etapa 7): de um bônus do Labs (`labsCodigo`) ou de um texto livre, sem
 * bônus do Chat. Pela IA, ele nasce pendente, dentro do teto e com a mesma trava do pedido de bônus.
 * Escrito à mão (`texto`, já conferido por quem chama), ele nasce pronto, marcado à mão, e fica fora
 * do teto e da trava: não gasta IA. A conta é gravada como no pedido de bônus. O banco recusa a
 * origem que não combina com o código (migrations/016-carrossel-avulso.sql).
 */
export async function criarCarrosselAvulso(p: {
  origem: "labs" | "livre";
  labsCodigo: string | null;
  total: number;
  palavra: string;
  contexto: ContextoDoCarrossel;
  conta: ContaGuardada | null;
  texto: TextoDoCarrossel | null;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  const arte = p.conta?.conta ? chavesDaConta(p.conta) : {};
  if (p.texto) {
    const [criada] = (await sql().query(
      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, contexto, arte, estado, gerado, gerado_em, texto_a_mao)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'pronto', $7::jsonb, now(), true) returning id`,
      [p.origem, p.labsCodigo, p.total, p.palavra, p.contexto, arte, p.texto]
    )) as { id: string }[];
    return { ok: true, id: criada.id };
  }
  return comTeto(async (tx) => {
    const [criada] = (await tx.query(
      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, contexto, arte)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb) returning id`,
      [p.origem, p.labsCodigo, p.total, p.palavra, p.contexto, arte]
    )) as { id: string }[];
    return criada.id;
  });
}

/** Só quem muda a linha de `pendente` para `gerando` chama a IA. */
export async function reivindicarCarrossel(id: string): Promise<LinhaDoCarrossel | null> {
  const linhas = (await sql().query(
    `update carrosseis_gerados set estado = 'gerando' where id = $1 and estado = 'pendente' returning *`,
    [id]
  )) as LinhaDoCarrossel[];
  return linhas[0] ?? null;
}

export async function gravarCarrosselPronto(id: string, texto: TextoDoCarrossel, medicao: Medicao): Promise<void> {
  await sql().query(
    `update carrosseis_gerados
        set estado = 'pronto', gerado = $2::jsonb, medicao = $3::jsonb, erro = null, gerado_em = now()
      where id = $1 and estado = 'gerando'`,
    [id, texto, medicao]
  );
}

export async function gravarFalhaDoCarrossel(id: string, erro: string, medicao: Medicao | null): Promise<void> {
  await sql().query(
    `update carrosseis_gerados
        set estado = 'falhou', erro = $2, medicao = $3::jsonb, gerado_em = now()
      where id = $1 and estado in ('pendente', 'gerando')`,
    [id, erro.slice(0, 1000), medicao]
  );
}

export async function lerCarrossel(id: string): Promise<LinhaDoCarrossel | null> {
  if (!ehIdDeBonus(id)) return null;
  const linhas = (await sql().query(`select * from carrosseis_gerados where id = $1`, [id])) as LinhaDoCarrossel[];
  return linhas[0] ?? null;
}

export async function listarCarrosseisDoBonus(bonusId: string): Promise<LinhaDoCarrossel[]> {
  if (!ehIdDeBonus(bonusId)) return [];
  return (await sql().query(
    `select * from carrosseis_gerados where bonus_id = $1 order by criado_em desc limit 50`,
    [bonusId]
  )) as LinhaDoCarrossel[];
}

/** Todos os carrosséis, os de bônus e os avulsos, do mais novo para o mais velho (o menu "Carrosséis"). */
export async function listarCarrosseis(limite = 50): Promise<LinhaDoCarrossel[]> {
  return (await sql().query(`select * from carrosseis_gerados order by criado_em desc limit $1`, [limite])) as LinhaDoCarrossel[];
}

/**
 * SALVAR UMA PARTE (um slide, ou a legenda) NUMA TRANSAÇÃO, COM A LINHA TRAVADA (spec da Etapa 4):
 * lê o texto salvo (o revisado, ou o gerado) DEPOIS de travar a linha, junta a parte
 * (`juntarParte`, puro) e grava. Dois salvamentos ao mesmo tempo, de partes diferentes, não apagam um
 * ao outro: o segundo espera o primeiro e junta sobre o texto dele. Só carrossel pronto.
 * `nomeQueFalta` completa o nome e o @ da conta gravada na Etapa 3 sem eles, na mesma gravação.
 * Com o carrossel na fila de publicação, ou publicado, recusa (spec da Etapa 5, "A trava no
 * servidor"): o que está na tela é sempre o que vai sair.
 */
export async function salvarParteDoCarrossel(
  id: string,
  parte: ParteDoCarrossel,
  bruto: Record<string, unknown>,
  nomeQueFalta: { nome: string | null; arroba: string | null } | null
): Promise<
  | { ok: true; texto: TextoDoCarrossel; avisos: ProblemaDoCampo[] }
  | { ok: false; motivo: "nao_pronto" }
  | { ok: false; motivo: "travado"; estado: EstadoDaPublicacao }
  | { ok: false; motivo: "problemas"; problemas: ProblemaDoCampo[] }
> {
  if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_pronto" };
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    const atual = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
    if (!linha || !atual) return { ok: false as const, motivo: "nao_pronto" as const };
    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
    if (!publicacaoLivre(estado)) return { ok: false as const, motivo: "travado" as const, estado };
    const r = juntarParte(linha.total_slides, linha.palavra, atual, parte, bruto);
    if (!r.ok) return { ok: false as const, motivo: "problemas" as const, problemas: r.problemas };
    await tx.query(
      `update carrosseis_gerados set revisado = $2::jsonb, revisado_em = now(), arte = arte || $3::jsonb where id = $1`,
      [id, r.texto, chavesDaConta(nomeQueFalta)]
    );
    return { ok: true as const, texto: r.texto, avisos: r.avisos };
  });
}

/**
 * O "SÓ TEXTO" DA ARTE, só em carrossel pronto. Grava SÓ a chave `soTexto` (`arte || …` junta as
 * chaves), e nunca o objeto inteiro: até a Etapa 3 a escrita trocava a coluna toda, e gravar o "só
 * texto" sem a conta a apagaria (spec da Etapa 4). `nomeQueFalta` completa o nome e o @ da conta
 * gravada na Etapa 3 sem eles (arte-conta.ts).
 *
 * NUMA TRANSAÇÃO COM A LINHA TRAVADA (spec da Etapa 5): com o carrossel na fila de publicação, ou
 * publicado, recusa, pela mesma função pura da trava que o salvar do slide usa.
 */
export async function salvarSoTextoDaArte(
  id: string,
  soTexto: number[],
  nomeQueFalta: { nome: string | null; arroba: string | null } | null
): Promise<{ ok: true } | { ok: false; motivo: "nao_pronto" } | { ok: false; motivo: "travado"; estado: EstadoDaPublicacao }> {
  if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_pronto" };
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    if (!linha || linha.estado !== "pronto") return { ok: false as const, motivo: "nao_pronto" as const };
    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
    if (!publicacaoLivre(estado)) return { ok: false as const, motivo: "travado" as const, estado };
    await tx.query(`update carrosseis_gerados set arte = arte || $2::jsonb where id = $1`, [id, { ...chavesDaConta(nomeQueFalta), soTexto }]);
    return { ok: true as const };
  });
}

/**
 * "FIXAR NESTA CONTA": grava a conta, com o nome e o @, no carrossel que ainda não tem conta (o de
 * antes da 015). Uma vez só: o `where` recusa o carrossel que já tem conta, e a conta de um
 * carrossel não muda. Só em carrossel pronto. Devolve falso quando não gravou.
 */
export async function fixarContaDoCarrossel(id: string, conta: ContaGuardada): Promise<boolean> {
  const linhas = (await sql().query(
    `update carrosseis_gerados set arte = arte || $2::jsonb
      where id = $1 and estado = 'pronto' and not (arte ? 'conta')
      returning id`,
    [id, chavesDaConta(conta)]
  )) as { id: string }[];
  return linhas.length > 0;
}

/**
 * AS CONTAS PARA O CABEÇALHO DA ARTE, NA ORDEM DO PAINEL (lib/account.ts cai na primeira por
 * `created_at`). SÓ AS QUATRO COLUNAS, de propósito (achado 60): `accounts` guarda o token de
 * acesso de cada conta, e `listAccounts` (lib/db.ts) lê `*`. tests/bonus-arte-paginas.test.ts
 * cobra que a arte não lê a tabela por outro caminho.
 */
export async function contasParaArte(): Promise<ContaDoCabecalho[]> {
  return (await sql().query(
    `select ig_user_id, username, name, profile_picture_url from accounts order by created_at asc`
  )) as ContaDoCabecalho[];
}
