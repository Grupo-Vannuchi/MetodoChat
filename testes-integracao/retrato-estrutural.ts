// O RETRATO ESTRUTURAL DE UM SCHEMA, e a comparação entre dois.
//
// Ele existe para uma pergunta só: **um banco nascido apenas das migrações de
// `migrations/` é o MESMO que um banco nascido de `ensureSchema()`?** Enquanto a
// resposta for sim, as duas fontes de verdade que esta base tem hoje não
// divergiram. No dia em que alguém acrescentar DDL só num dos dois lados, é este
// arquivo que acusa.
//
// -----------------------------------------------------------------------------
// O QUE ELE OLHA — e a lista é a resposta a "comparação que não olha nada"
//
// Uma comparação que passa porque não compara é o pior resultado possível: ela
// imprime verde e ensina a confiar. Por isso o retrato é EXPLÍCITO, campo a
// campo, e cada campo entra na chave da divergência:
//
//   1. TABELAS      — quais existem
//   2. COLUNAS      — nome, POSIÇÃO, tipo, nulidade e padrão de cada uma
//   3. ÍNDICES      — nome e definição completa (`pg_get_indexdef`)
//   4. RESTRIÇÕES   — nome, letra do tipo e definição completa
//                     (`pg_get_constraintdef`), o que cobre de uma vez chave
//                     primária (com a ORDEM das colunas), chave estrangeira (com
//                     a REGRA DE EXCLUSÃO), unicidade e `check`
//
// A definição vem do catálogo já renderizada pelo Postgres, e não de uma lista
// escrita à mão: é a mesma escolha do inventário de `banco-descartavel.ts`, e
// pelo mesmo motivo — lista à mão envelhece em silêncio, e o dia em que alguém
// criasse uma forma que ela não sabe perguntar, ela imprimiria "idêntico" sobre
// outra coisa. `pg_get_constraintdef` não tem esse ponto cego: uma restrição de
// tipo que ninguém previu ainda aparece, com a definição inteira dentro.
//
// -----------------------------------------------------------------------------
// A NORMALIZAÇÃO, E POR QUE ELA É OBRIGATÓRIA AQUI
//
// A conexão que tira o retrato vive em `public`, então `pg_get_constraintdef` e
// `pg_get_indexdef` QUALIFICAM o nome do schema no texto que devolvem:
//
//     FOREIGN KEY (automation_id) REFERENCES teste_tmp_ab12cd34.automations(id)
//
// Dois schemas descartáveis têm nomes diferentes por construção, então sem
// normalizar TODA chave estrangeira e TODO índice divergiriam — e a comparação
// gritaria por um motivo que não é o dela. O nome do schema vira `<schema>`, e
// só ele: nada mais é reescrito, para que uma diferença de verdade continue
// visível.
import type postgres from "postgres";

export type RetratoEstrutural = {
  schema: string;
  tabelas: string[];
  /** "tabela.coluna" -> "pos=… tipo=… nao_nulo=… padrao=…" */
  colunas: Record<string, string>;
  /** "tabela.indice" -> definição normalizada */
  indices: Record<string, string>;
  /** "tabela.restricao" -> "tipo=… def=…" */
  restricoes: Record<string, string>;
};

// O mesmo portão de nome das outras peças da fundação. O nome do schema entra
// nas consultas como PARÂMETRO (não é interpolado), mas ele também monta a
// substituição da normalização, e um nome estranho ali não tem por que existir.
const SCHEMA_LEGIVEL = /^(public|teste_tmp_[a-z0-9_]{1,40})$/;

export type Consultar = (texto: string, params?: unknown[]) => Promise<unknown[]>;

export function consultarPor(conexao: postgres.Sql): Consultar {
  return (texto, params) =>
    conexao.unsafe(texto, (params ?? []) as never[]) as unknown as Promise<unknown[]>;
}

function normalizar(texto: string, schema: string): string {
  // Com e sem aspas, sempre seguido do ponto que qualifica: só o prefixo de
  // schema é trocado, nunca um nome de coluna que por acaso contivesse o texto.
  return texto.split('"' + schema + '".').join("<schema>.").split(schema + ".").join("<schema>.");
}

export async function retratoEstrutural(
  consultar: Consultar,
  schema: string
): Promise<RetratoEstrutural> {
  if (!SCHEMA_LEGIVEL.test(schema)) {
    throw new Error(
      `RECUSADO em retratoEstrutural: "${schema}" não é "public" nem casa com ` +
        `teste_tmp_[a-z0-9_]{1,40}.`
    );
  }

  const tabelas = (
    (await consultar(
      `select c.relname as nome
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and c.relkind = 'r'
        order by 1`,
      [schema]
    )) as { nome: string }[]
  ).map((r) => r.nome);

  const colunasCruas = (await consultar(
    `select c.relname as tabela,
            a.attname  as coluna,
            a.attnum   as pos,
            format_type(a.atttypid, a.atttypmod) as tipo,
            a.attnotnull as nao_nulo,
            pg_get_expr(d.adbin, d.adrelid) as padrao
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a on a.attrelid = c.oid
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where n.nspname = $1
        and c.relkind = 'r'
        and a.attnum > 0
        and not a.attisdropped
      order by c.relname, a.attnum`,
    [schema]
  )) as {
    tabela: string;
    coluna: string;
    pos: number;
    tipo: string;
    nao_nulo: boolean;
    padrao: string | null;
  }[];

  const colunas: Record<string, string> = {};
  for (const r of colunasCruas) {
    colunas[`${r.tabela}.${r.coluna}`] =
      `pos=${r.pos} tipo=${r.tipo} nao_nulo=${r.nao_nulo} ` +
      `padrao=${r.padrao === null ? "<nenhum>" : normalizar(r.padrao, schema)}`;
  }

  const indicesCrus = (await consultar(
    `select c.relname as tabela, i.relname as indice, pg_get_indexdef(i.oid) as def
       from pg_index x
       join pg_class i on i.oid = x.indexrelid
       join pg_class c on c.oid = x.indrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1
      order by c.relname, i.relname`,
    [schema]
  )) as { tabela: string; indice: string; def: string }[];

  const indices: Record<string, string> = {};
  for (const r of indicesCrus) {
    indices[`${r.tabela}.${r.indice}`] = normalizar(r.def, schema);
  }

  const restricoesCruas = (await consultar(
    `select c.relname as tabela, k.conname as nome, k.contype as tipo,
            pg_get_constraintdef(k.oid) as def
       from pg_constraint k
       join pg_class c on c.oid = k.conrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1
      order by c.relname, k.conname`,
    [schema]
  )) as { tabela: string; nome: string; tipo: string; def: string }[];

  const restricoes: Record<string, string> = {};
  for (const r of restricoesCruas) {
    restricoes[`${r.tabela}.${r.nome}`] = `tipo=${r.tipo} def=${normalizar(r.def, schema)}`;
  }

  return { schema, tabelas, colunas, indices, restricoes };
}

/**
 * Quantos campos o retrato contém. Existe por um motivo só: um retrato vazio
 * torna qualquer comparação verde, e quem lê o verde precisa poder exigir que
 * havia alguma coisa para comparar.
 */
export function tamanhoDoRetrato(r: RetratoEstrutural): {
  tabelas: number;
  colunas: number;
  indices: number;
  restricoes: number;
} {
  return {
    tabelas: r.tabelas.length,
    colunas: Object.keys(r.colunas).length,
    indices: Object.keys(r.indices).length,
    restricoes: Object.keys(r.restricoes).length,
  };
}

function compararMapas(
  categoria: string,
  a: Record<string, string>,
  b: Record<string, string>,
  ladoA: string,
  ladoB: string
): string[] {
  const divergencias: string[] = [];
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const c of chaves) {
    if (!(c in b)) divergencias.push(`${categoria} só em ${ladoA}: ${c} (${a[c]})`);
    else if (!(c in a)) divergencias.push(`${categoria} só em ${ladoB}: ${c} (${b[c]})`);
    else if (a[c] !== b[c]) {
      divergencias.push(
        `${categoria} DIVERGE em ${c}:\n    ${ladoA}: ${a[c]}\n    ${ladoB}: ${b[c]}`
      );
    }
  }
  return divergencias;
}

/**
 * Todas as divergências entre dois retratos, campo a campo. Lista vazia = os
 * dois schemas têm a mesma estrutura em tudo que o retrato olha.
 */
export function compararEstruturas(
  a: RetratoEstrutural,
  b: RetratoEstrutural,
  ladoA = "A",
  ladoB = "B"
): string[] {
  const divergencias: string[] = [];

  for (const t of a.tabelas) {
    if (!b.tabelas.includes(t)) divergencias.push(`tabela só em ${ladoA}: ${t}`);
  }
  for (const t of b.tabelas) {
    if (!a.tabelas.includes(t)) divergencias.push(`tabela só em ${ladoB}: ${t}`);
  }

  divergencias.push(...compararMapas("coluna", a.colunas, b.colunas, ladoA, ladoB));
  divergencias.push(...compararMapas("índice", a.indices, b.indices, ladoA, ladoB));
  divergencias.push(...compararMapas("restrição", a.restricoes, b.restricoes, ladoA, ladoB));

  return divergencias;
}
