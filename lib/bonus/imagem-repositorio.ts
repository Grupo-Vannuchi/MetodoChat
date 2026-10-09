import "server-only";
import { sql } from "@/lib/db";
import { TETO_IMAGEM_DIARIO, TRAVADA_IMAGEM_MS, type LinhaDaImagem } from "./imagem-regras";

// O SQL DO CRIADOR DE IMAGEM, na tabela `imagens_geradas` (a 018, spec da Etapa 6). Toda escrita depois
// da reserva é um `update` CONDICIONAL: o `where` é a proteção, e
// testes-integracao/bonus-imagem-repositorio.integracao.ts é quem acusa se alguém a tirar.

/**
 * A chave da trava do teto da imagem. Número fixo, PRÓPRIO e diferente da do bônus e da do carrossel: os
 * tetos são independentes. Exportada para o teste segurar a trava e provar que a reserva espera por ela.
 */
export const TRAVA_DO_TETO_DA_IMAGEM = 2026100901;

/**
 * O QUE O TETO CONTA: todo pedido à OpenAI das últimas 24 horas, de qualquer estado, pelo relógio do
 * banco. O que falhou conta, porque a OpenAI pode ter cobrado; o do carrossel apagado também, porque a
 * linha fica com o carrossel nulo.
 */
const CONTAGEM_DO_TETO = `select count(*)::int as n from imagens_geradas where criado_em > now() - interval '24 hours'`;

export async function imagensNasUltimas24h(): Promise<number> {
  const [linha] = (await sql().query(CONTAGEM_DO_TETO)) as { n: number }[];
  return linha?.n ?? 0;
}

export type ReservaDaImagem = { ok: true; id: string; hoje: number } | { ok: false; motivo: "teto" | "gerando"; hoje: number };

/**
 * RESERVAR UM PEDIDO, NA MESMA TRANSAÇÃO E COM TRAVA: contar, conferir o slide e inserir não correm em
 * paralelo, e dois cliques com 9 no dia não fazem 11. O slide que já tem uma linha `gerando` dentro do
 * prazo recusa o segundo pedido: cada slide gera uma imagem de cada vez. `hoje` é a conta do dia, com
 * este pedido quando ele entra.
 */
export async function reservarImagem(p: { carrosselId: string; numero: number; descricao: string }): Promise<ReservaDaImagem> {
  return sql().begin(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DA_IMAGEM]);
    const [contagem] = (await tx.query(CONTAGEM_DO_TETO)) as { n: number }[];
    const hoje = contagem?.n ?? 0;
    if (hoje >= TETO_IMAGEM_DIARIO) return { ok: false as const, motivo: "teto" as const, hoje };
    const gerando = await tx.query(
      `select 1 from imagens_geradas
        where carrossel_id = $1 and numero = $2 and estado = 'gerando'
          and criado_em > now() - $3::int * interval '1 millisecond'
        limit 1`,
      [p.carrosselId, p.numero, TRAVADA_IMAGEM_MS]
    );
    if (gerando.length) return { ok: false as const, motivo: "gerando" as const, hoje };
    const [linha] = (await tx.query(
      `insert into imagens_geradas (carrossel_id, numero, descricao) values ($1, $2, $3) returning id`,
      [p.carrosselId, p.numero, p.descricao]
    )) as { id: string }[];
    return { ok: true as const, id: linha.id, hoje: hoje + 1 };
  });
}

/** A GERAÇÃO TERMINOU COM A IMAGEM GUARDADA. Só sai de `gerando`, e uma vez. */
export async function marcarPronta(id: string, caminho: string): Promise<boolean> {
  const r = await sql().query(
    `update imagens_geradas set estado = 'pronta', caminho = $2, terminado_em = now()
      where id = $1 and estado = 'gerando' returning id`,
    [id, caminho]
  );
  return r.length === 1;
}

/** A GERAÇÃO TERMINOU SEM IMAGEM, com a frase do motivo (sem chave nenhuma: `tirarChave`). Só sai de `gerando`, e uma vez. */
export async function marcarFalhou(id: string, motivo: string): Promise<boolean> {
  const r = await sql().query(
    `update imagens_geradas set estado = 'falhou', motivo = $2, terminado_em = now()
      where id = $1 and estado = 'gerando' returning id`,
    [id, motivo]
  );
  return r.length === 1;
}

/**
 * A ÚLTIMA LINHA DE CADA SLIDE DO CARROSSEL, com a hora do banco, que decide o "travada". A página lê
 * daqui a descrição do "Gerar de novo" e o estado de cada card; a consulta, o estado de um slide.
 */
export async function ultimasDoCarrossel(carrosselId: string): Promise<{ agora: Date; linhas: Record<number, LinhaDaImagem> }> {
  const [relogio] = (await sql().query(`select now() as agora`)) as { agora: Date }[];
  const lidas = (await sql().query(
    `select distinct on (numero) id, numero, descricao, estado, motivo, caminho, criado_em, terminado_em
       from imagens_geradas
      where carrossel_id = $1
      order by numero, criado_em desc`,
    [carrosselId]
  )) as LinhaDaImagem[];
  return { agora: relogio.agora, linhas: Object.fromEntries(lidas.map((l) => [l.numero, l])) };
}
