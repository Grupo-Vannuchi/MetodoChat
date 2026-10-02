// A TABELA DOS CARROSSÉIS, conferida no banco de verdade (o container).
//
// A `014` é a única fonte de `carrosseis_gerados`, e nada mais a confere: como a `013`, ela
// está em `naoObservaveis` de lib/esquema.ts (a partida do painel não depende dela). Sem este
// arquivo, uma coluna apagada da migração só apareceria quando a tela quebrasse.
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = [
  "id",
  "bonus_id",
  "criado_em",
  "total_slides",
  "palavra",
  "contexto",
  "estado",
  "gerado",
  "revisado",
  "erro",
  "medicao",
  "gerado_em",
  "revisado_em",
  // A 015 (Etapa 3): as escolhas da arte.
  "arte",
];

let bonusId: string;

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  await banco.db().sql().query(`delete from bonus_gerados`);
  const [b] = (await banco
    .db()
    .sql()
    .query(
      `insert into bonus_gerados (tema, o_que_resolve) values ('Vendas', 'um pedido de teste com mais de vinte letras') returning id`
    )) as { id: string }[];
  bonusId = b.id;
});

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as { n: number }[];
  return n;
}

describe("a tabela carrosseis_gerados", () => {
  it("nasce da 014 com as colunas que o código lê", async () => {
    const linhas = (await banco
      .db()
      .sql()
      .query(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'carrosseis_gerados'
          order by ordinal_position`
      )) as { column_name: string }[];
    expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
  });

  it("uma linha nova nasce pendente, sem texto, sem revisão e sem escolha de arte", async () => {
    const [linha] = (await banco
      .db()
      .sql()
      .query(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
         values ($1, 10, 'SUMIDO', $2::jsonb)
         returning estado, gerado, revisado, revisado_em, contexto, arte`,
        [bonusId, { tema: "Vendas" }]
      )) as Record<string, unknown>[];
    expect(linha).toEqual({
      estado: "pendente",
      gerado: null,
      revisado: null,
      revisado_em: null,
      contexto: { tema: "Vendas" },
      arte: {},
    });
  });

  it("a arte não aceita null: a linha antiga ganha {} da 015", async () => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, arte) values ($1, 5, 'SUMIDO', '{}'::jsonb, null)`,
          [bonusId]
        )
    ).rejects.toThrow(/null value in column "arte"/);
  });

  it.each([0, 11])("o banco recusa total de %i slides", async (total) => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ($1, $2, 'SUMIDO', '{}'::jsonb)`,
          [bonusId, total]
        )
    ).rejects.toThrow(/carrosseis_gerados_total_check/);
  });

  it("o banco recusa estado fora da lista", async () => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado) values ($1, 5, 'SUMIDO', '{}'::jsonb, 'inventado')`,
          [bonusId]
        )
    ).rejects.toThrow(/carrosseis_gerados_estado_check/);
  });

  it("carrossel de um bônus que não existe não entra", async () => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ('0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f', 5, 'SUMIDO', '{}'::jsonb)`
        )
    ).rejects.toThrow(/carrosseis_gerados_bonus_id_fkey/);
  });

  it("apagar o bônus apaga os carrosséis dele", async () => {
    await banco
      .db()
      .sql()
      .query(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ($1, 5, 'SUMIDO', '{}'::jsonb)`,
        [bonusId]
      );
    expect(await contar()).toBe(1);
    await banco.db().sql().query(`delete from bonus_gerados where id = $1`, [bonusId]);
    expect(await contar()).toBe(0);
  });
});
