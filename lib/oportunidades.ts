import "server-only";
import { sql } from "./db";
import type { Oportunidade } from "./precisa-de-voce";

/** A janela que define "está recebendo comentário agora". */
export const DIAS_DA_OPORTUNIDADE = 7;

/**
 * OS POSTS QUE ESTÃO RECEBENDO COMENTÁRIO E NÃO TÊM AUTOMAÇÃO ATIVA.
 *
 * O `media_id` VEM ANINHADO no payload do webhook (`payload->'media'->>'id'`), e
 * não como `payload->>'media_id'` — descoberto medindo em 14/09/2026, depois de
 * uma primeira consulta devolver 332 comentários todos com post nulo.
 *
 * O `not exists` OLHA `active`, E NÃO SÓ A EXISTÊNCIA: automação pausada não
 * responde ninguém, então o post continua órfão. Uma automação desligada que
 * "protegesse" o post esconderia exatamente o caso que esta tela existe para
 * mostrar.
 *
 * SEM PISO E SEM TETO AQUI, de propósito: os dois são decisão de PRODUTO e moram
 * em `recorteDasOportunidades` (lib/precisa-de-voce.ts), com casos puros. A
 * consulta traz o material; quem corta é a regra testável.
 */
export async function oportunidadesDaConta(accountId: string): Promise<Oportunidade[]> {
  const linhas = (await sql().query(
    `select e.payload->'media'->>'id' as "mediaId",
            count(*)::int as comentarios,
            max(e.created_at) as ultimo
       from events e
      where e.account_id = $1
        and e.type = 'comment'
        and e.created_at > now() - make_interval(days => $2::int)
        and e.payload->'media'->>'id' is not null
        and not exists (
          select 1 from automations a
           where a.account_id = e.account_id
             and a.media_id = e.payload->'media'->>'id'
             and a.active
        )
      group by 1
      order by comentarios desc
      limit 20`,
    [accountId, DIAS_DA_OPORTUNIDADE]
  )) as Oportunidade[];
  return linhas;
}
