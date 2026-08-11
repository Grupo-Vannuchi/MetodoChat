import "server-only";
import { PERIODS } from "./event-filters";
import type { Where } from "./event-query";
import { KINDS_MANUAIS, type EnvioFilters } from "./envio-filters";

// COMO o filtro de ENVIOS vira SQL. Mesma divisão de lib/event-query.ts: fica
// separado de lib/envio-filters.ts porque a barra é componente de cliente — as
// listas de valores válidos ela precisa, o esquema do banco não.
//
// Nada vindo do navegador é concatenado — todo valor entra como $n. O que chega
// aqui já passou pela lista branca de parseEnvioFilters().

// A listagem mostra quem é a pessoa, não o número dela, então junta com
// contatos. A chave primária de `contacts` é (account_id, ig_id), então o join
// não multiplica linha — a contagem pode usar o MESMO from sem inflar. Se a
// listagem e a contagem divergirem no from, o número na tela discorda da lista e
// ninguém confia no filtro.
export const ENVIOS_FROM = `
  from queue q
  left join contacts c
    on c.account_id = q.account_id and c.ig_id = q.contact_ig_id`;

// A data que a tela mostra é a do envio, caindo para a de criação quando o item
// ainda não saiu. Filtro de período e ordenação usam a MESMA expressão: sem
// isso, "os 12 mais recentes" seriam recentes por um critério e listados por
// outro — e com a lista cortada em 12 isso apareceria como sumiço.
export const ENVIOS_QUANDO = "coalesce(q.sent_at, q.created_at)";

export function buildEnviosWhere(accountId: string, f: EnvioFilters): Where {
  const partes = ["q.account_id = $1"];
  const params: unknown[] = [accountId];
  const ref = () => `$${params.length}`;

  // Origem não é coluna: é uma leitura do `kind`. A lista de kinds manuais vem
  // de envio-filters.ts, a mesma que origemDoKind() usa na tela — assim o que o
  // filtro estreita e o que o rótulo diz nunca discordam. Os kinds entram como
  // $n mesmo sendo constante do código: um só caminho de valor para o banco.
  if (f.origem) {
    const marcadores = KINDS_MANUAIS.map((k) => {
      params.push(k);
      return ref();
    });
    const operador = f.origem === "voce" ? "in" : "not in";
    partes.push(`q.kind ${operador} (${marcadores.join(", ")})`);
  }

  if (f.situacao) {
    params.push(f.situacao);
    partes.push(`q.status = ${ref()}`);
  }

  const days = PERIODS.find((p) => p.key === f.period)?.days ?? null;
  if (days !== null) {
    params.push(days);
    partes.push(`${ENVIOS_QUANDO} >= now() - make_interval(days => ${ref()}::int)`);
  }

  return { sql: partes.join("\n    and "), params };
}

// Quantos envios existem em cada situação, dentro do MESMO recorte da listagem.
// Uma consulta só serve às duas coisas que a linha de contagem precisa dizer: o
// total (soma) e o detalhe por situação — que é o que sustenta ter tirado a
// coluna "Situação" da tabela.
export function contagemPorSituacao(where: Where): Where {
  return {
    sql: `select q.status as situacao, count(*)::int as total
          ${ENVIOS_FROM}
          where ${where.sql}
          group by q.status`,
    params: where.params,
  };
}
