import "server-only";
import { sql } from "./db";
import type { Oportunidade } from "./precisa-de-voce";

/** A janela que define "está recebendo comentário agora". */
export const DIAS_DA_OPORTUNIDADE = 7;

/**
 * OS POSTS QUE ESTÃO RECEBENDO COMENTÁRIO E NÃO TÊM AUTOMAÇÃO QUE OS ALCANCE.
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
 * "ALCANÇAR" TEM DE BATER COM `findMatch` (lib/engine.ts:251-256), que é quem
 * decide de verdade se uma automação responde um comentário. Dois pontos da
 * consulta existem só para não divergir dele:
 *
 *   1. `media_id` NULO é GLOBAL, não "não bate com nada". `findMatch` só
 *      recusa quando `a.media_id && a.media_id !== mediaId` — ou seja, uma
 *      automação sem post escolhido vale para QUALQUER post (é o que
 *      `app/automacoes/editor/painel.tsx` já diz na tela: "Sem post
 *      escolhido, vale para todos os posts"). `NULL = x` nunca é verdadeiro em
 *      SQL, então sem o `or a.media_id is null` toda automação global vira
 *      invisível para esta consulta, e todo post da conta apareceria como
 *      órfão por baixo de uma automação que na verdade os cobre. Medido em
 *      produção em 15/09/2026: nenhuma automação global está ativa hoje (as
 *      25 ativas estão presas a um post), então o defeito era latente — mas
 *      arma sozinho no dia em que alguém criar uma.
 *
 *   2. `triggers` PRECISA conter `'comment'`. `findMatch` exige
 *      `a.triggers.includes(trigger)` antes de qualquer outra checagem — uma
 *      automação ativa presa a este post mas que só dispara por DM não
 *      responde comentário nenhum, e sem este filtro ela "protegeria" o post
 *      do mesmo jeito.
 *
 * O QUE ESTA CONSULTA DELIBERADAMENTE NÃO OLHA: PALAVRA-CHAVE. `findMatch`
 * também roda `matches(text, a.keywords, a.match_type)`, e esta consulta não
 * reproduz essa checagem — de propósito. A pergunta desta tela é "alguém
 * configurou alguma coisa para escutar este post?", não "este comentário
 * específico bateu com as palavras?". Um post com automação cujas palavras não
 * casaram com um comentário específico não é um post órfão: é um post
 * configurado, cujas palavras podem bater no próximo comentário. Tratar
 * "palavra não bateu" como "órfão" faria a tela piscar consoante o texto de
 * cada comentário, e não consoante o que a conta configurou. NÃO "conserte"
 * essa divergência — ela é o contrato desta função, não um descuido.
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
             and (a.media_id is null or a.media_id = e.payload->'media'->>'id')
             and 'comment' = any(a.triggers)
             and a.active
        )
      group by 1
      order by comentarios desc
      -- TETO TÉCNICO, E NÃO DECISÃO DE PRODUTO: é só um limite de LINHAS
      -- trazidas do banco, para a consulta nunca devolver uma lista sem fim.
      -- O order by comentarios desc garante que os 3 do recorte
      -- (recorteDasOportunidades, MAX_OPORTUNIDADES) sempre cabem dentro
      -- destes 20 — ele não contradiz o "SEM PISO E SEM TETO AQUI" do
      -- docblock acima, porque aquele teto é o de PRODUTO.
      -- (sem crases neste comentario: ele mora DENTRO de um template
      --  literal, e uma crase o fecharia no meio.)
      limit 20`,
    [accountId, DIAS_DA_OPORTUNIDADE]
  )) as Oportunidade[];
  return linhas;
}
