import "server-only";
import { sql } from "@/lib/db";
import type { Revisado } from "./contrato";
import type { Desfecho } from "./desfecho";
import type { Medicao } from "./ia-parametros";
import type { LinhaDoBonus } from "./linha";
import { ehIdDeBonus, TETO_DIARIO, type Pedido } from "./pedido";
import type { BonusGerado } from "./schema";
import { ENVIO_PARADO_MS } from "./tempos";

// O SQL DO GERADOR DE BÔNUS. Toda escrita aqui é um `update` CONDICIONAL: o
// `where` é a proteção, e testes-integracao/bonus-processo.integracao.ts é quem
// acusa se alguém a tirar.
//
// OBJETO VAI CRU PARA COLUNA `jsonb`, E NUNCA `JSON.stringify`: o driver já
// serializa, e a string pronta seria serializada DE NOVO e gravada como um texto
// JSON escalar, e não como objeto. É o aviso do dono em lib/queue-drain.ts
// (`guardarNoPayload`), e este arquivo o desobedeceu na primeira versão do plano:
// quem acusou foi o caso de integração, com `gerado` voltando como texto.

/**
 * A chave da trava do teto. Número fixo, e não `hashtext`, para não depender de
 * função interna do Postgres. Exportada para o teste de integração segurar a trava
 * e provar que o pedido espera por ela.
 */
export const TRAVA_DO_TETO = 2026092901;

export async function usadasNasUltimas24h(): Promise<number> {
  const [linha] = (await sql().query(
    `select count(*)::int as n from bonus_gerados where criado_em > now() - interval '24 hours'`
  )) as { n: number }[];
  return linha?.n ?? 0;
}

/**
 * CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA. Sem ela, dois cliques
 * simultâneos com 4 linhas no dia passariam os dois pela contagem e fariam 6. O
 * relógio é o do banco, como no resto deste projeto.
 */
export async function criarPedido(p: Pedido): Promise<{ ok: true; id: string } | { ok: false }> {
  return sql().begin(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO]);
    const [contagem] = (await tx.query(
      `select count(*)::int as n from bonus_gerados where criado_em > now() - interval '24 hours'`
    )) as { n: number }[];
    if ((contagem?.n ?? 0) >= TETO_DIARIO) return { ok: false as const };
    const [criada] = (await tx.query(
      `insert into bonus_gerados (tema, o_que_resolve, palavra_digitada) values ($1, $2, $3) returning id`,
      [p.tema, p.oQueResolve, p.palavraDigitada]
    )) as { id: string }[];
    return { ok: true as const, id: criada.id };
  });
}

/** Só quem muda a linha de `pendente` para `gerando` chama a IA. */
export async function reivindicarGeracao(id: string): Promise<LinhaDoBonus | null> {
  const linhas = (await sql().query(
    `update bonus_gerados set estado = 'gerando' where id = $1 and estado = 'pendente' returning *`,
    [id]
  )) as LinhaDoBonus[];
  return linhas[0] ?? null;
}

export async function gravarGerado(id: string, dados: BonusGerado, medicao: Medicao): Promise<void> {
  await sql().query(
    `update bonus_gerados
        set estado = 'pronto', gerado = $2::jsonb, medicao = $3::jsonb, erro = null, gerado_em = now()
      where id = $1 and estado = 'gerando'`,
    [id, dados, medicao]
  );
}

export async function gravarFalha(id: string, erro: string, medicao: Medicao | null): Promise<void> {
  await sql().query(
    `update bonus_gerados
        set estado = 'falhou', erro = $2, medicao = $3::jsonb, gerado_em = now()
      where id = $1 and estado in ('pendente', 'gerando')`,
    [id, erro.slice(0, 1000), medicao]
  );
}

export async function lerLinha(id: string): Promise<LinhaDoBonus | null> {
  if (!ehIdDeBonus(id)) return null;
  const linhas = (await sql().query(`select * from bonus_gerados where id = $1`, [id])) as LinhaDoBonus[];
  return linhas[0] ?? null;
}

export async function listarRecentes(limite: number): Promise<LinhaDoBonus[]> {
  return (await sql().query(`select * from bonus_gerados order by criado_em desc limit $1`, [
    limite,
  ])) as LinhaDoBonus[];
}

/**
 * RESERVA O ENVIO. Um `enviando` mais velho que ENVIO_PARADO_MS morreu no meio, e é
 * GRAVADO como incerto NESTA instrução, e não só lido assim na tela: se o processo
 * morreu entre o POST e a gravação do desfecho, ou se a gravação falhou, sobraria
 * `incerto_pendente` falso e o corpo solto. No `set`, `envio_estado` e
 * `incerto_pendente` são os valores ANTIGOS da linha (regra do Postgres), e é
 * isso que as expressões perguntam.
 *
 * O CORPO LIBERADO É APAGADO AQUI: sem incerteza e sem envio em andamento, nenhuma
 * tentativa pode ter criado o bônus, e o corpo antigo é só o que o operador
 * abandonou. Apagá-lo é o que torna verdade o "sem corpo, nada saiu" de
 * `prepararEnvio` (achado do auditor): o corpo novo é gravado antes do POST.
 *
 * `tentativas` é a FICHA: a linha devolvida traz o valor novo, e toda escrita
 * seguinte deste envio a exige. `criado` e `conferir` não são reservados: um
 * terminou, o outro espera uma pessoa.
 */
export async function reivindicarEnvio(id: string): Promise<LinhaDoBonus | null> {
  const linhas = (await sql().query(
    `update bonus_gerados
        set envio_estado = 'enviando',
            envio_iniciado_em = now(),
            tentativas = tentativas + 1,
            incerto_pendente = incerto_pendente or coalesce(envio_estado = 'enviando', false),
            corpo_enviado = case
              when incerto_pendente or coalesce(envio_estado = 'enviando', false) then corpo_enviado
              else null
            end
      where id = $1 and estado = 'pronto'
        and (envio_estado is null
             or envio_estado in ('colisao', 'recusado', 'esperar', 'incerto', 'porta_desligada')
             or (envio_estado = 'enviando'
                 and envio_iniciado_em < now() - make_interval(secs => $2::int)))
      returning *`,
    [id, ENVIO_PARADO_MS / 1000]
  )) as LinhaDoBonus[];
  return linhas[0] ?? null;
}

// AS TRÊS ESCRITAS DEPOIS DA RESERVA EXIGEM A FICHA (`tentativas = $2`), e não só
// `envio_estado = 'enviando'`: o `enviando` pode ser de OUTRA reserva, que assumiu
// esta depois de ela envelhecer. Sem a ficha, o desfecho de quem perdeu a reserva
// era gravado por cima do de quem a assumiu (achado do auditor). As duas que
// importam devolvem se acharam a linha; quem chama trata o falso como `superado`.

/** Desfaz uma reserva que não chegou a enviar nada. */
export async function devolverEnvio(
  id: string,
  ficha: number,
  anterior: LinhaDoBonus["envio_estado"]
): Promise<void> {
  await sql().query(
    `update bonus_gerados set envio_estado = $3, tentativas = tentativas - 1
      where id = $1 and tentativas = $2 and envio_estado = 'enviando'`,
    [id, ficha, anterior]
  );
}

/** Grava a string exata ANTES do POST: um processo que morra depois disso deixa o corpo para o reenvio. */
export async function gravarCorpo(
  id: string,
  ficha: number,
  slug: string,
  corpo: string,
  revisado: Revisado
): Promise<boolean> {
  const linhas = (await sql().query(
    `update bonus_gerados set slug = $3, corpo_enviado = $4, revisado = $5::jsonb
      where id = $1 and tentativas = $2 and envio_estado = 'enviando'
      returning id`,
    [id, ficha, slug, corpo, revisado]
  )) as { id: string }[];
  return linhas.length > 0;
}

export async function gravarDesfecho(id: string, ficha: number, d: Desfecho): Promise<boolean> {
  const linhas = (await sql().query(
    `update bonus_gerados
        set envio_estado = $3,
            incerto_pendente = $4,
            envio_resposta = $5::jsonb,
            enviado_em = case when $3 = 'criado' then now() else enviado_em end
      where id = $1 and tentativas = $2 and envio_estado = 'enviando'
      returning id`,
    [id, ficha, d.estado, d.incertoPendente, { motivo: d.motivo, ...d.detalhe }]
  )) as { id: string }[];
  return linhas.length > 0;
}

/**
 * A RESPOSTA DA PESSOA QUE OLHOU O /admin DO LABS. "Existe" encerra como criado,
 * marcado como conferido; "não existe" libera o corpo para editar e reenviar.
 * Devolve falso quando a linha já não estava esperando conferência.
 */
export async function gravarConferencia(id: string, existe: boolean): Promise<boolean> {
  const linhas = (await sql().query(
    `update bonus_gerados
        set envio_estado = case when $2::boolean then 'criado' else 'recusado' end,
            conferido_pelo_operador = $2::boolean,
            incerto_pendente = false,
            envio_resposta = jsonb_build_object(
              'motivo', case when $2::boolean then 'conferido_existe' else 'conferido_nao_existe' end),
            enviado_em = case when $2::boolean then now() else enviado_em end
      where id = $1 and envio_estado = 'conferir'
      returning id`,
    [id, existe]
  )) as { id: string }[];
  return linhas.length > 0;
}
