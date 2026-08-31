import { describe, it, expect } from "vitest";
import {
  comandosDoArquivo,
  somaDoTexto,
  decidirMigracoes,
} from "@/scripts/migracoes.mjs";

// ============================================================
// O QUE ESTE ARQUIVO PROTEGE é a decisão de QUAIS migrações rodar.
//
// Ela existe por um defeito medido em 28/08/2026: dois builds de produção
// morreram em `canceling statement due to statement timeout` (57014) depois de
// 120 segundos parados no PRIMEIRO arquivo de migração. Nenhuma delas tinha
// nada a fazer — todas já estavam aplicadas.
//
// A causa é do Postgres, não nossa: `alter table ... if not exists` pega a
// trava EXCLUSIVA antes de descobrir que não há o que fazer. Um leitor parado
// numa tabela — no caso, um servidor de desenvolvimento apontando para o mesmo
// banco — bloqueia o deploy inteiro.
//
// O conserto é não rodar o que já rodou. E a decisão de o que já rodou mora
// AQUI, numa função pura com caso para cada saída, e não no meio do script que
// fala com o banco.
//
// POR QUE NÃO USAR A CONFERÊNCIA DE CATÁLOGO QUE O SCRIPT JÁ TEM: as listas
// `ESPERADAS*` de `scripts/migrar.mjs` são escritas à mão, e o comentário delas
// registra que já ficaram velhas uma vez — com `002` na pasta, o script conferia
// só a coluna de `001`. Hoje elas são uma SEGUNDA OPINIÃO depois de aplicar, e
// uma entrada esquecida custa conferir de menos. Se virassem a porta que decide
// aplicar, uma entrada esquecida faria uma migração NUNCA RODAR, em silêncio.
// ============================================================

describe("comandosDoArquivo", () => {
  it("deixa só o que roda: comentário e linha vazia saem", () => {
    const conteudo = [
      "-- O ESQUEMA BASE",
      "-- explicação comprida",
      "",
      "create table if not exists x (id int);",
      "",
      "-- outro comentário",
      "alter table x add column if not exists y text;",
      "",
    ].join("\n");
    expect(comandosDoArquivo(conteudo)).toBe(
      "create table if not exists x (id int);\nalter table x add column if not exists y text;"
    );
  });

  // ESTE É O CASO QUE OBRIGOU A NORMALIZAÇÃO, e ele foi medido antes de existir:
  // o repositório tem `* text=auto` e `core.autocrlf=true`, então o MESMO arquivo
  // tem `\r\n` no Windows e `\n` no Linux da Vercel. Assinar os bytes crus faria
  // a soma gravada por uma máquina discordar da soma lida pela outra, e o script
  // acusaria "migração editada" em todo deploy — um alarme falso que ensina a
  // ignorar o alarme.
  it("o mesmo arquivo com \\r\\n e com \\n produz EXATAMENTE o mesmo texto", () => {
    const linhas = ["-- nota", "create table if not exists x (id int);", "", "select 1;"];
    const unix = linhas.join("\n");
    const windows = linhas.join("\r\n");
    expect(comandosDoArquivo(windows)).toBe(comandosDoArquivo(unix));
    expect(comandosDoArquivo(windows)).not.toContain("\r");
  });

  it("e a soma dos dois também é a mesma", () => {
    const linhas = ["-- nota", "create table if not exists x (id int);"];
    expect(somaDoTexto(comandosDoArquivo(linhas.join("\r\n")))).toBe(
      somaDoTexto(comandosDoArquivo(linhas.join("\n")))
    );
  });

  it("arquivo só de comentário não tem comando nenhum", () => {
    expect(comandosDoArquivo("-- só isto\n\n-- e isto\n")).toBe("");
    expect(comandosDoArquivo("")).toBe("");
  });

  // `--` NO MEIO da linha não é linha de comentário: a linha inteira roda.
  it("comentário no fim de uma linha de comando não apaga a linha", () => {
    expect(comandosDoArquivo("create table x (id int); -- cria")).toBe(
      "create table x (id int); -- cria"
    );
  });

  it("indentação antes do -- ainda é comentário", () => {
    expect(comandosDoArquivo("   -- indentado\nselect 1;")).toBe("select 1;");
  });
});

describe("somaDoTexto", () => {
  it("mesmo texto, mesma soma; texto diferente, soma diferente", () => {
    expect(somaDoTexto("abc")).toBe(somaDoTexto("abc"));
    expect(somaDoTexto("abc")).not.toBe(somaDoTexto("abd"));
  });

  it("é hexadecimal de 64 caracteres, para caber numa coluna de texto", () => {
    expect(somaDoTexto("qualquer coisa")).toMatch(/^[0-9a-f]{64}$/);
  });

  // ESTE CASO EXISTE PORQUE OS OUTROS NÃO BASTAVAM, e isso foi medido: trocando
  // `somaDoTexto` para apagar as quebras de linha antes de assinar, os 17 casos
  // seguiam verdes. A comparação "abc" contra "abd" prova pouco — ela nem
  // encosta na estrutura do texto.
  //
  // E a estrutura importa: o que esta assinatura promete não mudar é O SQL QUE O
  // BANCO RECEBEU, e onde as linhas quebram faz parte dele. Uma assinatura cega
  // para isso aceitaria calada um arquivo remontado.
  it("a quebra de linha faz parte da assinatura", () => {
    expect(somaDoTexto("select 1;\nselect 2;")).not.toBe(somaDoTexto("select 1;select 2;"));
    expect(somaDoTexto("a\nb")).not.toBe(somaDoTexto("ab"));
  });

  it("texto vazio tem soma, e ela é estável", () => {
    expect(somaDoTexto("")).toBe(somaDoTexto(""));
    expect(somaDoTexto("")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("decidirMigracoes", () => {
  const a = { nome: "000-base.sql", soma: "aaa" };
  const b = { nome: "001-ligacoes.sql", soma: "bbb" };
  const c = { nome: "002-nova.sql", soma: "ccc" };

  // O CASO QUE ESTE TRABALHO EXISTE PARA CRIAR: banco em dia, nada a fazer,
  // nenhuma DDL, nenhuma trava pedida.
  it("banco em dia não aplica NADA", () => {
    const d = decidirMigracoes(
      [a, b],
      [
        { name: "000-base.sql", checksum: "aaa" },
        { name: "001-ligacoes.sql", checksum: "bbb" },
      ]
    );
    expect(d.aplicar).toEqual([]);
    expect(d.jaAplicadas).toEqual(["000-base.sql", "001-ligacoes.sql"]);
    expect(d.conflitos).toEqual([]);
    expect(d.orfas).toEqual([]);
  });

  // A PRIMEIRA RODADA depois desta mudança: o registro está vazio porque a
  // tabela acabou de nascer, e as seis migrações já foram aplicadas à mão e por
  // deploys anteriores. Elas rodam de novo uma vez — são idempotentes — e ficam
  // anotadas. É o único deploy que ainda pede trava.
  it("registro vazio aplica tudo, na ordem", () => {
    const d = decidirMigracoes([a, b, c], []);
    expect(d.aplicar).toEqual(["000-base.sql", "001-ligacoes.sql", "002-nova.sql"]);
    expect(d.jaAplicadas).toEqual([]);
  });

  it("arquivo novo no meio de arquivos já aplicados: só ele roda", () => {
    const d = decidirMigracoes(
      [a, b, c],
      [
        { name: "000-base.sql", checksum: "aaa" },
        { name: "001-ligacoes.sql", checksum: "bbb" },
      ]
    );
    expect(d.aplicar).toEqual(["002-nova.sql"]);
    expect(d.jaAplicadas).toEqual(["000-base.sql", "001-ligacoes.sql"]);
  });

  // MIGRAÇÃO EDITADA DEPOIS DE APLICADA. O SQL que rodou naquele banco não é
  // mais o que está no arquivo, e ninguém consegue dizer qual dos dois vale.
  // Não é caso de reaplicar — reaplicar rodaria a versão nova por cima de um
  // banco que recebeu a antiga. É caso de PARAR.
  it("arquivo editado depois de aplicado vira conflito, e NÃO entra em aplicar", () => {
    const d = decidirMigracoes(
      [{ nome: "000-base.sql", soma: "NOVA" }],
      [{ name: "000-base.sql", checksum: "aaa" }]
    );
    expect(d.conflitos).toEqual([
      { nome: "000-base.sql", registrada: "aaa", atual: "NOVA" },
    ]);
    expect(d.aplicar).toEqual([]);
    expect(d.jaAplicadas).toEqual([]);
  });

  // Um conflito não pode esconder o trabalho legítimo do resto — quem lê o
  // relatório precisa ver as duas coisas de uma vez.
  it("conflito num arquivo não impede o relatório dos outros", () => {
    const d = decidirMigracoes(
      [{ nome: "000-base.sql", soma: "NOVA" }, c],
      [{ name: "000-base.sql", checksum: "aaa" }]
    );
    expect(d.conflitos.map((x) => x.nome)).toEqual(["000-base.sql"]);
    expect(d.aplicar).toEqual(["002-nova.sql"]);
  });

  // Registro aponta para arquivo que não existe mais: alguém apagou a migração
  // da pasta. O SQL dela JÁ RODOU naquele banco, então não há o que refazer —
  // mas o descompasso é notícia, e some se ninguém contar.
  it("registro sem arquivo correspondente aparece como órfão", () => {
    const d = decidirMigracoes([a], [
      { name: "000-base.sql", checksum: "aaa" },
      { name: "999-sumida.sql", checksum: "zzz" },
    ]);
    expect(d.orfas).toEqual(["999-sumida.sql"]);
    expect(d.aplicar).toEqual([]);
  });

  it("pasta vazia não decide nada e não estoura", () => {
    const d = decidirMigracoes([], []);
    expect(d).toEqual({ aplicar: [], jaAplicadas: [], conflitos: [], orfas: [] });
  });

  // A ORDEM DA PASTA É A ORDEM DE APLICAÇÃO, e o registro não pode mudá-la: o
  // banco só chega ao estado certo se `000` rodar antes de `001`. Um registro
  // devolvido em qualquer ordem pelo banco não move nada.
  it("a ordem de aplicar é a dos arquivos, não a do registro", () => {
    const d = decidirMigracoes([a, b, c], [{ name: "001-ligacoes.sql", checksum: "bbb" }]);
    expect(d.aplicar).toEqual(["000-base.sql", "002-nova.sql"]);
  });
});
