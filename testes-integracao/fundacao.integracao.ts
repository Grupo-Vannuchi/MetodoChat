// O TESTE MÍNIMO QUE PROVA A FUNDAÇÃO. Um só, e ele existe para provar três
// coisas — nenhuma delas é sobre o produto:
//
//   1. a estrutura nasce DENTRO do schema temporário, e o caminho não tem cauda
//   2. `public` não foi tocado — por PRESENÇA e IDENTIDADE das linhas que já
//      existiam, ancoradas num corte, porque o banco não só cresce sozinho
//      enquanto o teste roda: ele REESCREVE linha velha sozinho. O que essa
//      verificação deixou de pegar em troca está escrito no cabeçalho de
//      `banco-descartavel.ts`, e provado em `digital.integracao.ts`
//   3. o schema temporário some no fim, mesmo quando o teste falha
//
// A prova do item 3 não cabe aqui dentro: o `afterAll` roda depois do último
// caso. Quem a dá é a `rede-global.ts`, que confere o banco no fim da RODADA e
// falha alto se sobrou schema. Ela foi exercitada de propósito, com um caso
// quebrado a mão, e o schema foi derrubado assim mesmo.
//
// Os quatro caminhos da Frente 2 (portão -> link, dreno -> mensagem, toque em
// botão, gatilho -> entrega) entram como arquivos irmãos deste. Este aqui não
// testa produto nenhum: ele testa a fundação.
import { describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import {
  compararInventarios,
  exigirPrefixo,
  inventarioDoPublic,
  urlComSchema,
} from "./banco-descartavel";

const banco = bancoDescartavel();

const TABELAS_ESPERADAS = [
  "accounts",
  "automations",
  "config",
  "contacts",
  "events",
  "followups",
  "login_attempts",
  "queue",
];

describe("a fundação do banco descartável", () => {
  test("recusa todo nome de schema que não seja teste_tmp_*", () => {
    const proibidos = [
      "public",
      "",
      "teste_tmp",
      "TESTE_TMP_x",
      "x_teste_tmp_y",
      "teste_tmp_a; drop schema public",
      // A cauda do search_path é um NOME para esta trava, e por isso morre aqui:
      // é assim que `<tmp>,public` deixa de ser escrevível.
      "teste_tmp_a,public",
    ];
    for (const nome of proibidos) {
      expect(() => exigirPrefixo(nome, "teste"), nome).toThrow(/RECUSADO/);
    }
    expect(exigirPrefixo("teste_tmp_ab12cd34", "teste")).toBe("teste_tmp_ab12cd34");

    // E a mesma trava fecha a porta pela qual a cauda entraria de verdade.
    expect(() =>
      urlComSchema("postgresql://u:s@h:6543/postgres", "teste_tmp_ab12cd34,public")
    ).toThrow(/RECUSADO/);
  });

  test("a estrutura nasce dentro do schema temporário", async () => {
    const nome = banco.nome();
    const sql = banco.db().sql();

    // O caminho de busca resolvido tem UM schema, e é o nosso. Se tivesse
    // `public` na cauda, `current_schema()` diria este mesmo nome enquanto lesse
    // a produção — por isso a conferência é sobre a LISTA, e não sobre o topo.
    const caminho = (await sql.query("select current_schemas(false) as caminho")) as {
      caminho: string[];
    }[];
    expect(caminho[0].caminho).toEqual([nome]);

    const tabelas = (await sql.query(
      `select table_name from information_schema.tables
        where table_schema = $1 and table_type = 'BASE TABLE' order by table_name`,
      [nome]
    )) as { table_name: string }[];
    expect(tabelas.map((r) => r.table_name)).toEqual(TABELAS_ESPERADAS);

    const indices = (await sql.query(
      `select count(*)::int as n from pg_indexes where schemaname = $1`,
      [nome]
    )) as { n: number }[];
    expect(indices[0].n).toBeGreaterThanOrEqual(16);

    // A CONTRAPROVA DA ARMADILHA, e é ela que dá sentido ao resto: com `public`
    // na cauda, esta consulta devolveria os contatos REAIS. Aqui devolve zero —
    // e a comparação só vale porque a produção tem contato de verdade, o que a
    // linha seguinte confere em vez de supor.
    expect(banco.inventarioAntes().linhas.contacts.total).toBeGreaterThan(0);
    const contatos = (await sql.query("select count(*)::int as n from contacts")) as {
      n: number;
    }[];
    expect(contatos[0].n).toBe(0);
  });

  test("o que o lib/db escreve cai no schema temporário", async () => {
    const db = banco.db();
    await db.upsertAccount({
      ig_user_id: "17800000000000009",
      username: "conta_da_fundacao",
      name: "Conta da fundação",
      profile_picture_url: null,
      // Valor inventado. Nenhuma credencial de verdade entra em teste.
      access_token: "token-de-teste-que-nao-vale-nada",
      token_expires_at: null,
    });

    const contas = await db.listAccounts();
    expect(contas.map((c) => c.ig_user_id)).toEqual(["17800000000000009"]);

    // A produção tem outras contas, e elas continuam sendo outras: o inventário
    // de antes viu 4, e o schema temporário vê 1. Se a escrita tivesse caído em
    // `public`, esta lista teria as reais dentro.
    expect(banco.inventarioAntes().linhas.accounts.total).toBeGreaterThan(0);
  });

  test("public ficou intacto, por presença e identidade ancoradas no corte", async () => {
    const depois = await inventarioDoPublic(banco.corte());
    const { perdas, vida } = compararInventarios(banco.inventarioAntes(), depois);

    // A produção mexendo no que é dela é IMPRESSA, e não reprovada. Sem esta
    // linha o afrouxamento seria mudo, e um instrumento mudo é pior do que um
    // instrumento que pisca: ninguém descobre que ele parou de olhar.
    if (vida.length) {
      console.log(`[public vivo, e isto não reprova] ${vida.join(" | ")}`);
    }

    expect(perdas).toEqual([]);

    // O QUE ESTE TESTE NÃO AFIRMA, dito para não ser lido como mais do que é, e
    // são TRÊS coisas:
    //
    //   1. as linhas nascidas DEPOIS do corte ficam de fora da conta — a
    //      produção grava webhooks o tempo todo, e elas não são nossas
    //   2. o CONTEÚDO de uma linha anterior ao corte pode ter mudado sem que
    //      isto reprove, desde que a chave primária e o carimbo de nascimento
    //      continuem os mesmos. É o preço medido de parar de piscar, e está
    //      escrito por extenso no cabeçalho de `banco-descartavel.ts`
    //   3. logo, este caso NÃO prova que nada em `public` foi reescrito
    //
    // O que ele afirma é que nenhuma linha anterior ao corte foi APAGADA nem
    // virou OUTRA linha, que nenhuma tabela ou coluna nasceu ou sumiu de
    // `public`, e que isso vale para as oito tabelas — não só para as que este
    // teste tocou. Quem prova que a verificação ainda acusa cada uma dessas
    // perdas é `digital.integracao.ts`, dentro de um schema descartável.
    expect(depois.tabelas).toEqual(TABELAS_ESPERADAS);
  });
});
