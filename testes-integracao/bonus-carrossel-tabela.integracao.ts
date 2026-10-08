// A TABELA DOS CARROSSÉIS, conferida no banco de verdade (o container).
//
// A `014` é a única fonte de `carrosseis_gerados`, e nada mais a confere: como a `013`, ela
// está em `naoObservaveis` de lib/esquema.ts (a partida do painel não depende dela). Sem este
// arquivo, uma coluna apagada da migração só apareceria quando a tela quebrasse.
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { migracoesEmOrdem } from "./migracoes";

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
  // A 016 (Etapa 7): o carrossel avulso.
  "origem",
  "labs_codigo",
  "texto_a_mao",
  // A 017 (Etapa 8): o carrossel sem palavra-chave.
  "acao_da_chamada",
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

  it("uma linha nova nasce pendente, sem texto, sem revisão, sem escolha de arte, de bônus e sem ação", async () => {
    const [linha] = (await banco
      .db()
      .sql()
      .query(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
         values ($1, 10, 'SUMIDO', $2::jsonb)
         returning estado, gerado, revisado, revisado_em, contexto, arte, origem, labs_codigo, texto_a_mao, acao_da_chamada`,
        [bonusId, { tema: "Vendas" }]
      )) as Record<string, unknown>[];
    expect(linha).toEqual({
      estado: "pendente",
      gerado: null,
      revisado: null,
      revisado_em: null,
      contexto: { tema: "Vendas" },
      arte: {},
      origem: "bonus",
      labs_codigo: null,
      texto_a_mao: false,
      acao_da_chamada: null,
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

// O CARROSSEL AVULSO (a 016, spec da Etapa 7): sem bônus do Chat, de um bônus do Labs ou de um texto
// livre. A origem amarra as colunas, e é o banco que recusa a combinação errada.
describe("a 016: o carrossel avulso", () => {
  const inserir = (colunas: string, valores: string, params: unknown[] = []) =>
    banco
      .db()
      .sql()
      .query(
        `insert into carrosseis_gerados (total_slides, palavra, contexto, ${colunas}) values (5, 'BRUTAL', '{}'::jsonb, ${valores}) returning id`,
        params
      );

  it("o avulso do Labs entra sem bônus e com o código, e o do texto livre sem nenhum dos dois", async () => {
    await inserir("origem, labs_codigo", "'labs', 'conselheiro-brutalmente-honesto'");
    await inserir("origem", "'livre'");
    await inserir("origem, texto_a_mao", "'livre', true");
    expect(await contar()).toBe(3);
  });

  it("o banco recusa origem fora da lista", async () => {
    await expect(inserir("origem", "'notion'")).rejects.toThrow(/carrosseis_gerados_origem_check/);
  });

  it.each([
    ["a origem 'bonus' sem bônus", "origem", "'bonus'", false],
    ["o texto livre com bônus", "origem, bonus_id", "'livre', $1", true],
    ["o avulso do Labs com bônus", "origem, labs_codigo, bonus_id", "'labs', 'x', $1", true],
  ])("o banco recusa %s", async (_nome, colunas, valores, comBonus) => {
    await expect(inserir(colunas, valores, comBonus ? [bonusId] : [])).rejects.toThrow(/carrosseis_gerados_origem_bonus_check/);
  });

  it.each([
    ["o avulso do Labs sem código", "origem", "'labs'", false],
    ["o texto livre com código", "origem, labs_codigo", "'livre', 'x'", false],
    ["o carrossel de bônus com código", "bonus_id, labs_codigo", "$1, 'x'", true],
  ])("o banco recusa %s", async (_nome, colunas, valores, comBonus) => {
    await expect(inserir(colunas, valores, comBonus ? [bonusId] : [])).rejects.toThrow(/carrosseis_gerados_origem_labs_check/);
  });

  // AS LINHAS QUE JÁ EXISTIAM: o banco descartável nasce da pasta inteira, então o caso desfaz a 016,
  // grava uma linha como as de produção hoje, e aplica a 016 de novo, duas vezes (ela é idempotente,
  // como toda migração da pasta). A linha velha fica de bônus, sem código e fora do "à mão".
  it("aplicada sobre as linhas que já existiam, todas ficam 'bonus', e ela roda duas vezes", async () => {
    const m016 = migracoesEmOrdem().find((m) => m.nome === "016-carrossel-avulso.sql");
    expect(m016).toBeDefined();
    const sql = banco.db().sql();
    try {
      await sql.query(
        `alter table carrosseis_gerados
           drop constraint carrosseis_gerados_origem_labs_check,
           drop constraint carrosseis_gerados_origem_bonus_check,
           drop constraint carrosseis_gerados_origem_check,
           drop column texto_a_mao,
           drop column labs_codigo,
           drop column origem,
           alter column bonus_id set not null`
      );
      const [velha] = (await sql.query(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado) values ($1, 4, 'SUMIDO', '{}'::jsonb, 'pronto') returning id`,
        [bonusId]
      )) as { id: string }[];
      await sql.query(m016!.comandos);
      await sql.query(m016!.comandos);
      const [lida] = (await sql.query(`select origem, labs_codigo, texto_a_mao, estado from carrosseis_gerados where id = $1`, [
        velha.id,
      ])) as Record<string, unknown>[];
      expect(lida).toEqual({ origem: "bonus", labs_codigo: null, texto_a_mao: false, estado: "pronto" });
    } finally {
      // Se algo cair no meio, a tabela volta à forma da pasta para o arquivo seguinte. As migrações
      // depois da 016 também rodam de novo: apagar a coluna `origem` apaga junto todo `check` que a
      // usa, e a 017 tem um (`carrosseis_gerados_bonus_palavra_check`).
      await sql.query(m016!.comandos);
      for (const m of migracoesEmOrdem().filter((m) => m.nome > "016-carrossel-avulso.sql")) await sql.query(m.comandos);
    }
  });
});

// O CARROSSEL SEM PALAVRA-CHAVE (a 017, spec da Etapa 8): a palavra pode faltar, e então a chamada pede
// uma ação. O banco amarra as duas: ou palavra, ou ação; o carrossel de bônus do Chat sempre tem
// palavra; a ação é uma das quatro; e a palavra vazia não é um terceiro jeito de dizer "sem palavra".
describe("a 017: o carrossel sem palavra-chave", () => {
  const inserir = (colunas: string, valores: string, params: unknown[] = []) =>
    banco
      .db()
      .sql()
      .query(`insert into carrosseis_gerados (total_slides, contexto, ${colunas}) values (5, '{}'::jsonb, ${valores}) returning id`, params);

  it("o texto livre e o avulso do Labs entram sem palavra e com a ação", async () => {
    await inserir("origem, palavra, acao_da_chamada", "'livre', null, 'salvar'");
    await inserir("origem, labs_codigo, palavra, acao_da_chamada", "'labs', 'sem-palavra', null, 'comentar'");
    await inserir("origem, palavra, acao_da_chamada, texto_a_mao", "'livre', null, 'seguir', true");
    await inserir("origem, palavra, acao_da_chamada", "'livre', null, 'compartilhar'");
    expect(await contar()).toBe(4);
  });

  it.each([
    ["a palavra e a ação juntas", "origem, palavra, acao_da_chamada", "'livre', 'BRUTAL', 'salvar'"],
    ["nem palavra nem ação", "origem, palavra", "'livre', null"],
  ])("o banco recusa %s", async (_nome, colunas, valores) => {
    await expect(inserir(colunas, valores)).rejects.toThrow(/carrosseis_gerados_palavra_ou_acao_check/);
  });

  it("o banco recusa o carrossel de bônus do Chat sem palavra, mesmo com a ação", async () => {
    await expect(inserir("bonus_id, palavra, acao_da_chamada", "$1, null, 'salvar'", [bonusId])).rejects.toThrow(
      /carrosseis_gerados_bonus_palavra_check/
    );
  });

  it("o banco recusa a ação fora das quatro", async () => {
    await expect(inserir("origem, palavra, acao_da_chamada", "'livre', null, 'curtir'")).rejects.toThrow(
      /carrosseis_gerados_acao_check/
    );
  });

  it("o banco recusa a palavra vazia", async () => {
    await expect(inserir("origem, palavra", "'livre', ''")).rejects.toThrow(/carrosseis_gerados_palavra_vazia_check/);
  });

  // AS LINHAS QUE JÁ EXISTIAM: como na 016, o caso desfaz a 017, grava uma linha como as de produção
  // hoje (com palavra), e aplica a 017 de novo, duas vezes. A linha velha fica com a palavra e sem ação.
  it("aplicada sobre as linhas que já existiam, todas ficam com a palavra e sem ação, e ela roda duas vezes", async () => {
    const m017 = migracoesEmOrdem().find((m) => m.nome === "017-carrossel-sem-palavra.sql");
    expect(m017).toBeDefined();
    const sql = banco.db().sql();
    try {
      await sql.query(
        `alter table carrosseis_gerados
           drop constraint carrosseis_gerados_palavra_vazia_check,
           drop constraint carrosseis_gerados_bonus_palavra_check,
           drop constraint carrosseis_gerados_palavra_ou_acao_check,
           drop constraint carrosseis_gerados_acao_check,
           drop column acao_da_chamada,
           alter column palavra set not null`
      );
      const [velha] = (await sql.query(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado) values ($1, 4, 'SUMIDO', '{}'::jsonb, 'pronto') returning id`,
        [bonusId]
      )) as { id: string }[];
      await sql.query(m017!.comandos);
      await sql.query(m017!.comandos);
      const [lida] = (await sql.query(`select palavra, acao_da_chamada, origem, estado from carrosseis_gerados where id = $1`, [
        velha.id,
      ])) as Record<string, unknown>[];
      expect(lida).toEqual({ palavra: "SUMIDO", acao_da_chamada: null, origem: "bonus", estado: "pronto" });
    } finally {
      await sql.query(m017!.comandos);
    }
  });
});
