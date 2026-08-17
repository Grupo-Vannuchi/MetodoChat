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
const colunas = await sql`
  select column_name, data_type, column_default
  from information_schema.columns
  where table_name = 'automations' and column_name = 'ligacoes'`;

console.log(
  colunas.length
    ? `\nCONFERIDO no banco: automations.ligacoes existe (${colunas[0].data_type}, default ${colunas[0].column_default})`
    : "\nCONFERIDO no banco: automations.ligacoes NÃO existe" +
      (aplicar ? " — A MIGRAÇÃO NÃO FEZ EFEITO, pare e investigue." : " (esperado no ensaio a seco)")
);

if (!aplicar) console.log("\nNada foi gravado. Rode com --aplicar para valer.");
await sql.end();
