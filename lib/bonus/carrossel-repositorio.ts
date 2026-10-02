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

// O SQL DO CARROSSEL. Toda escrita é um `update` CONDICIONAL: o `where` é a proteção, e
// testes-integracao/bonus-carrossel-processo.integracao.ts é quem acusa se alguém a tirar.
// Objeto vai CRU para coluna `jsonb`, nunca `JSON.stringify` (a lição da FASE 1.7).

/**
 * A chave da trava do teto do carrossel. Número fixo, PRÓPRIO e diferente da do bônus
 * (`TRAVA_DO_TETO`, repositorio.ts): os dois tetos são independentes. Exportada para o teste
 * segurar a trava e provar que o pedido espera por ela.
 */
export const TRAVA_DO_TETO_DO_CARROSSEL = 2026093001;

export async function carrosseisNasUltimas24h(): Promise<number> {
  const [linha] = (await sql().query(
    `select count(*)::int as n from carrosseis_gerados where criado_em > now() - interval '24 hours'`
  )) as { n: number }[];
  return linha?.n ?? 0;
}

/** A conta como a coluna `arte` a guarda: sem as chaves vazias. */
function chavesDaConta(c: Partial<ContaGuardada> | null): Record<string, string> {
  return Object.fromEntries(Object.entries(c ?? {}).filter(([, v]) => typeof v === "string" && v !== "")) as Record<
    string,
    string
  >;
}

/**
 * CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11.
 * `conta` é a conta do carrossel, com o nome e o @, gravada no pedido (spec da Etapa 4): o
 * carrossel é dela, e nunca vira de outra. Sem conta, a arte nasce `{}`.
 */
export async function criarPedidoDeCarrossel(p: {
  bonusId: string;
  total: number;
  palavra: string;
  contexto: ContextoDoCarrossel;
  conta: ContaGuardada | null;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  return sql().begin(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);
    const [contagem] = (await tx.query(
      `select count(*)::int as n from carrosseis_gerados where criado_em > now() - interval '24 hours'`
    )) as { n: number }[];
    if ((contagem?.n ?? 0) >= TETO_CARROSSEL_DIARIO) return { ok: false as const };
    const [criada] = (await tx.query(
      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, arte)
       values ($1, $2, $3, $4::jsonb, $5::jsonb) returning id`,
      [p.bonusId, p.total, p.palavra, p.contexto, p.conta?.conta ? chavesDaConta(p.conta) : {}]
    )) as { id: string }[];
    return { ok: true as const, id: criada.id };
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

/**
 * SALVAR UMA PARTE (um slide, ou a legenda) NUMA TRANSAÇÃO, COM A LINHA TRAVADA (spec da Etapa 4):
 * lê o texto salvo (o revisado, ou o gerado) DEPOIS de travar a linha, junta a parte
 * (`juntarParte`, puro) e grava. Dois salvamentos ao mesmo tempo, de partes diferentes, não apagam um
 * ao outro: o segundo espera o primeiro e junta sobre o texto dele. Só carrossel pronto.
 * `nomeQueFalta` completa o nome e o @ da conta gravada na Etapa 3 sem eles, na mesma gravação.
 */
export async function salvarParteDoCarrossel(
  id: string,
  parte: ParteDoCarrossel,
  bruto: Record<string, unknown>,
  nomeQueFalta: { nome: string | null; arroba: string | null } | null
): Promise<
  | { ok: true; texto: TextoDoCarrossel; avisos: ProblemaDoCampo[] }
  | { ok: false; motivo: "nao_pronto" }
  | { ok: false; motivo: "problemas"; problemas: ProblemaDoCampo[] }
> {
  if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_pronto" };
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    const atual = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
    if (!linha || !atual) return { ok: false as const, motivo: "nao_pronto" as const };
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
 * gravada na Etapa 3 sem eles (arte-conta.ts). Devolve falso quando a linha não estava pronta.
 */
export async function salvarSoTextoDaArte(
  id: string,
  soTexto: number[],
  nomeQueFalta: { nome: string | null; arroba: string | null } | null
): Promise<boolean> {
  const linhas = (await sql().query(
    `update carrosseis_gerados set arte = arte || $2::jsonb where id = $1 and estado = 'pronto' returning id`,
    [id, { ...chavesDaConta(nomeQueFalta), soTexto }]
  )) as { id: string }[];
  return linhas.length > 0;
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
