// A TABELA DO GERADOR DE BÔNUS, conferida no banco de verdade (o container).
//
// A `013` é a única fonte de `bonus_gerados`, e nada mais a confere: ela está em
// `naoObservaveis` de lib/esquema.ts de propósito (a partida do painel não depende
// dela), e `scripts/migrar.mjs` não a tem em `ESPERADAS`. Sem este arquivo, uma
// coluna apagada da migração só apareceria quando a tela quebrasse.
import { describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = [
  "id",
  "criado_em",
  "tema",
  "o_que_resolve",
  "palavra_digitada",
  "estado",
  "gerado",
  "revisado",
  "erro",
  "medicao",
  "gerado_em",
  "slug",
  "corpo_enviado",
  "envio_estado",
  "incerto_pendente",
  "conferido_pelo_operador",
  "envio_resposta",
  "tentativas",
  "envio_iniciado_em",
  "enviado_em",
];

describe("a tabela bonus_gerados", () => {
  it("nasce da 013 com as colunas que o código lê", async () => {
    const linhas = (await banco
      .db()
      .sql()
      .query(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'bonus_gerados'
          order by ordinal_position`
      )) as { column_name: string }[];
    expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
  });

  it("uma linha nova nasce pendente, sem envio, sem incerteza e sem tentativa", async () => {
    const [linha] = (await banco
      .db()
      .sql()
      .query(
        `insert into bonus_gerados (tema, o_que_resolve)
         values ('Marketing', 'um pedido de teste com mais de vinte letras')
         returning estado, envio_estado, incerto_pendente, conferido_pelo_operador, tentativas`
      )) as Record<string, unknown>[];
    expect(linha).toEqual({
      estado: "pendente",
      envio_estado: null,
      incerto_pendente: false,
      conferido_pelo_operador: false,
      tentativas: 0,
    });
  });

  it("o banco recusa estado de geração fora da lista", async () => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into bonus_gerados (tema, o_que_resolve, estado) values ('x', 'y', 'inventado')`
        )
    ).rejects.toThrow(/bonus_gerados_estado_check/);
  });

  it("o banco recusa estado de envio fora da lista", async () => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into bonus_gerados (tema, o_que_resolve, envio_estado) values ('x', 'y', 'inventado')`
        )
    ).rejects.toThrow(/bonus_gerados_envio_estado_check/);
  });
});
