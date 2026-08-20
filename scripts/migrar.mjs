// Aplica as migrações de esquema de `migrations/`, em ordem de nome.
//
// Uso:  node scripts/migrar.mjs            ← ENSAIO A SECO, só mostra o que faria
//       node scripts/migrar.mjs --aplicar  ← grava
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE
//
// Hoje o esquema nasce dentro da aplicação: `ensureSchema` (lib/db.ts) roda 54
// comandos de DDL na primeira requisição de cada instância. Isso funciona, mas
// deixa o esquema AMARRADO AO DEPLOY — a estrutura só existe depois que o código
// novo sobe.
//
// A Fase 2a esbarrou nisso de frente. O motor novo precisa da coluna `ligacoes`
// PREENCHIDA para funcionar, e preencher exige que ela exista, e ela só existia
// depois do deploy — que é justamente o que não podia acontecer antes. Impasse.
//
// Este script quebra o impasse pela raiz: o esquema passa a poder ser preparado
// ANTES, por um passo próprio. É também a primeira parcela da mudança maior
// descrita em `docs/plans/2026-08-17-esquema-e-harness.md`.
//
// -----------------------------------------------------------------------------
// POR QUE NÃO NO SCRIPT DE DADO
//
// `scripts/ligar-passos-existentes.mjs` diz, no próprio comentário, que não
// grava DDL "para não fazer esquema ser coisa de script de dado". O princípio
// está certo e continua valendo: aquele script preenche, este cria. Misturar os
// dois faria um script de migração de dado precisar de permissão de DDL, e
// tornaria impossível rodar só um dos dois.
//
// -----------------------------------------------------------------------------
// O CONTRATO: TODA MIGRAÇÃO DESTA PASTA É IDEMPOTENTE
//
// Não há tabela de controle registrando o que já foi aplicado — de propósito,
// por ora. Com `if not exists` em toda DDL, rodar duas vezes é inofensivo, e uma
// tabela de controle seria maquinário para um problema que ainda não existe.
//
// O PREÇO, escrito para não ser descoberto tarde: isto não serve para migração
// que MOVE DADO (renomear coluna preservando conteúdo, quebrar uma tabela em
// duas). Essas não são idempotentes por natureza e precisam de registro do que
// já rodou. **No dia em que aparecer a primeira, a tabela de controle vira
// obrigatória** — e este parágrafo é o aviso de que ela não existe.
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Espelha `limparUrl` de lib/db.ts: cada fornecedor inventa o seu parâmetro de
// URL (channel_binding no Neon, pgbouncer no Prisma), o postgres.js não conhece
// nenhum e os repassa ao servidor, que os recusa.
function limparUrl(url) {
  const u = new URL(url);
  for (const p of ["channel_binding", "pgbouncer"]) u.searchParams.delete(p);
  return u.toString();
}

const aplicar = process.argv.includes("--aplicar");
const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = postgres(limparUrl(url), { prepare: false, ssl: "require", max: 1, onnotice: () => {} });

console.log(aplicar ? "MODO: APLICANDO (grava no banco)\n" : "MODO: ENSAIO A SECO (nada é gravado)\n");

// Ordem por nome, e é por isso que os arquivos são numerados. Ordem alfabética
// de `001-`, `002-` … coincide com a ordem cronológica até 999 arquivos, o que
// é folga suficiente para este projeto.
const arquivos = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();

if (!arquivos.length) {
  console.log("Nenhuma migração em `migrations/`.");
  await sql.end();
  process.exit(0);
}

for (const nome of arquivos) {
  const conteudo = readFileSync(join("migrations", nome), "utf8");

  // Só as linhas de comando, para o ensaio mostrar o que roda em vez de despejar
  // o comentário inteiro — que nestes arquivos costuma ser a maior parte.
  const comandos = conteudo
    .split("\n")
    .filter((l) => !l.trim().startsWith("--") && l.trim())
    .join("\n")
    .trim();

  if (!comandos) {
    console.log(`  ok   ${nome} — só comentário, nada a rodar`);
    continue;
  }

  if (!aplicar) {
    console.log(`  ►    ${nome}`);
    for (const l of comandos.split("\n")) console.log(`         ${l}`);
    continue;
  }

  await sql.unsafe(comandos);
  console.log(`  ✓    ${nome} — aplicada`);
}

// A CONFERÊNCIA VALE MAIS QUE O "aplicada" ACIMA, porque `if not exists` tem
// sucesso mesmo quando não faz nada — inclusive quando o arquivo está errado.
// Perguntar ao banco o que existe de verdade é a única leitura que não mente.
//
// A LISTA É ESCRITA À MÃO, E QUEM ACRESCENTAR MIGRAÇÃO ACRESCENTA AQUI. Ela
// nasceu com uma linha só (`ligacoes`), e a Tarefa 9 a encontrou VELHA no
// primeiro dia em que houve uma segunda migração: com `002` na pasta, o script
// imprimia "aplicada" para as duas e depois conferia SÓ a coluna de `001`. Ou
// seja, `002` podia não fazer efeito nenhum e a única leitura que não mente
// diria "CONFERIDO" sobre outra coisa — que é a mesma classe de defeito que o
// parágrafo acima existe para fechar, por outra porta.
//
// POR QUE NÃO EXTRAIR OS NOMES DO PRÓPRIO `.sql`: daria uma expressão regular
// casando `add column if not exists <nome>`, e ela passaria a ser a definição do
// que esta pasta pode conter. O contrato escrito lá em cima é `if not exists` em
// TODA DDL — `create index`, `create table`, `add constraint` —, e um extrator
// que só entende `add column` ficaria calado justamente na migração de forma
// nova. Uma lista à mão que alguém esquece de atualizar falha em silêncio uma
// vez; um extrator que não entende a DDL falha em silêncio sempre.
const ESPERADAS = [
  { tabela: "automations", coluna: "ligacoes", de: "001-ligacoes.sql" },
  { tabela: "automations", coluna: "entrega_sem_portao", de: "002-entrega-sem-portao.sql" },
];

console.log("");
for (const { tabela, coluna, de } of ESPERADAS) {
  const colunas = await sql`
    select data_type, column_default
    from information_schema.columns
    where table_name = ${tabela} and column_name = ${coluna}`;

  console.log(
    colunas.length
      ? `CONFERIDO no banco: ${tabela}.${coluna} existe (${colunas[0].data_type}, default ${colunas[0].column_default})`
      : `CONFERIDO no banco: ${tabela}.${coluna} NÃO existe (${de})` +
        (aplicar
          ? " — A MIGRAÇÃO NÃO FEZ EFEITO, pare e investigue."
          : " (esperado no ensaio a seco)")
  );
}

if (!aplicar) console.log("\nNada foi gravado. Rode com --aplicar para valer.");
await sql.end();
