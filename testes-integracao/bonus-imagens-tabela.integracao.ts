// A TABELA DAS IMAGENS GERADAS (a 018, spec da Etapa 6), conferida no banco de verdade (o container).
//
// Como a 013 e a 014, a 018 está em `naoObservaveis` de lib/esquema.ts (a partida do painel não depende
// dela), e nada mais a confere: sem este arquivo, uma coluna apagada da migração só apareceria quando o
// teto do criador de imagem parasse de contar.
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { migracoesEmOrdem } from "./migracoes";

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = ["id", "carrossel_id", "numero", "descricao", "estado", "motivo", "caminho", "criado_em", "terminado_em"];

let carrosselId: string;

beforeEach(async () => {
  await banco.db().sql().query(`delete from imagens_geradas`);
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (origem, total_slides, palavra, acao_da_chamada, contexto)
       values ('livre', 3, null, 'salvar', '{}'::jsonb) returning id`
    )) as { id: string }[];
  carrosselId = c.id;
});

const inserir = (colunas: string, valores: string, params: unknown[] = []) =>
  banco.db().sql().query(`insert into imagens_geradas (${colunas}) values (${valores}) returning *`, params);

describe("a tabela imagens_geradas", () => {
  it("nasce da 018 com as colunas que o código lê", async () => {
    const linhas = (await banco
      .db()
      .sql()
      .query(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'imagens_geradas'
          order by ordinal_position`
      )) as { column_name: string }[];
    expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
  });

  it("um pedido novo nasce gerando, sem motivo, sem caminho e sem fim", async () => {
    const [linha] = (await inserir("carrossel_id, numero, descricao", "$1, 2, 'uma pessoa usando o celular numa loja'", [
      carrosselId,
    ])) as Record<string, unknown>[];
    expect(linha).toMatchObject({ estado: "gerando", motivo: null, caminho: null, terminado_em: null, numero: 2 });
    expect(linha.criado_em).toBeInstanceOf(Date);
  });

  it("pronta tem caminho e fim; falhou tem motivo e fim", async () => {
    await inserir("carrossel_id, numero, descricao, estado, caminho, terminado_em", "$1, 1, 'uma cena', 'pronta', 'p/bonus-foto/x.jpg', now()", [
      carrosselId,
    ]);
    await inserir("carrossel_id, numero, descricao, estado, motivo, terminado_em", "$1, 1, 'uma cena', 'falhou', 'a OpenAI recusou', now()", [
      carrosselId,
    ]);
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from imagens_geradas`)) as { n: number }[];
    expect(n).toBe(2);
  });

  it.each([
    ["o estado fora dos três", "carrossel_id, numero, descricao, estado", "$1, 1, 'uma cena', 'pendente'", /imagens_geradas_estado_check/],
    ["o slide fora de 1 a 10", "carrossel_id, numero, descricao", "$1, 11, 'uma cena'", /imagens_geradas_numero_check/],
    ["a descrição vazia", "carrossel_id, numero, descricao", "$1, 1, ''", /imagens_geradas_descricao_check/],
    ["pronta sem caminho", "carrossel_id, numero, descricao, estado, terminado_em", "$1, 1, 'uma cena', 'pronta', now()", /imagens_geradas_caminho_check/],
    ["gerando com caminho", "carrossel_id, numero, descricao, caminho", "$1, 1, 'uma cena', 'p/bonus-foto/x.jpg'", /imagens_geradas_caminho_check/],
    ["falhou sem motivo", "carrossel_id, numero, descricao, estado, terminado_em", "$1, 1, 'uma cena', 'falhou', now()", /imagens_geradas_motivo_check/],
    ["gerando com fim", "carrossel_id, numero, descricao, terminado_em", "$1, 1, 'uma cena', now()", /imagens_geradas_fim_check/],
  ])("o banco recusa %s", async (_nome, colunas, valores, check) => {
    await expect(inserir(colunas, valores, [carrosselId])).rejects.toThrow(check);
  });

  // O TETO CONTA AS LINHAS, e apagar o carrossel não pode zerar a conta do dia: a linha fica, com o
  // carrossel nulo (spec, "O teto e a migração 018").
  it("o carrossel apagado deixa a linha, com o carrossel nulo", async () => {
    await inserir("carrossel_id, numero, descricao", "$1, 1, 'uma cena'", [carrosselId]);
    await banco.db().sql().query(`delete from carrosseis_gerados where id = $1`, [carrosselId]);
    const linhas = (await banco.db().sql().query(`select carrossel_id from imagens_geradas`)) as { carrossel_id: string | null }[];
    expect(linhas).toEqual([{ carrossel_id: null }]);
  });

  it("a 018 roda duas vezes sem mudar nada", async () => {
    const m018 = migracoesEmOrdem().find((m) => m.nome === "018-imagens-geradas.sql");
    expect(m018).toBeDefined();
    await inserir("carrossel_id, numero, descricao", "$1, 1, 'uma cena'", [carrosselId]);
    await banco.db().sql().query(m018!.comandos);
    await banco.db().sql().query(m018!.comandos);
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from imagens_geradas`)) as { n: number }[];
    expect(n).toBe(1);
  });
});
