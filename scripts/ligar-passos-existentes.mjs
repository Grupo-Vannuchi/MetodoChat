// Dá a toda automação já gravada a corrente de ligações que ela sempre teve na
// prática: bloco 0 → bloco 1 → bloco 2 → …, cada uma `{tipo:"sempre"}`.
//
// Uso:  node scripts/ligar-passos-existentes.mjs            ← ENSAIO A SECO, só lê
//       node scripts/ligar-passos-existentes.mjs --aplicar  ← grava
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE
//
// A Tarefa 1 desta fase acrescenta a coluna `ligacoes` (lib/db.ts) e o
// interpretador (lib/steps.ts, `interpretar`) continua andando pelo array de
// `steps` — a Tarefa 2 é quem passa a segui-la. Uma automação gravada ANTES
// desta migração tem `ligacoes: []` (o default da coluna), e nada nela descreve
// o caminho que o array já expressava pela ordem. Sem esta migração, no dia em
// que o motor passar a seguir a ligação em vez do índice, toda automação antiga
// pararia no primeiro bloco — a corrente que a ordem do array garantia hoje
// deixaria de existir no dado.
//
// Este script torna essa corrente EXPLÍCITA, reproduzindo exatamente a mesma
// ordem que `interpretar` já percorre: `{de: identidadeDoPasso(steps[i], i),
// quando: {tipo:"sempre"}, para: identidadeDoPasso(steps[i+1], i+1)}` para cada
// par consecutivo. Nada muda de comportamento — a corrente só passa a estar
// escrita onde a Tarefa 2 vai procurá-la.
//
// -----------------------------------------------------------------------------
// IDEMPOTENTE, e por um critério simples: automação que JÁ TEM alguma ligação
// gravada não é tocada. Não há tentativa de casar a corrente existente com a
// que este script geraria — se o dono já editou o fluxo no editor de ligações
// (fases seguintes), a corrente pode legitimamente ter deixado de ser uma fila
// reta, e sobrescrevê-la apagaria uma decisão do dono.
//
// -----------------------------------------------------------------------------
// UMA ÚNICA ESCRITA POR AUTOMAÇÃO, e por isso sem transação própria — diferente
// de `scripts/dar-ids-aos-passos.mjs`, que precisa de uma porque grava DUAS
// coisas relacionadas (os ids em `steps` e as chaves em `queue`) que têm que
// concordar ou nenhuma. Aqui há um único `update … set ligacoes = …`, e um
// único `update` já é atômico por conta do próprio Postgres.
import postgres from "postgres";
import { readFileSync } from "node:fs";

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

// CÓPIA de `FORMA_DO_ID` e `identidadeDoPasso` (lib/steps.ts), pelo mesmo motivo
// de `scripts/dar-ids-aos-passos.mjs` e `scripts/converter-cursores.mjs`: este
// script é JavaScript solto, roda por `node` direto e não importa de
// `lib/steps.ts`, que é TypeScript. Divergindo dela, este script encadearia os
// blocos por uma identidade diferente da que `indiceDoId` usa para achá-los de
// volta, e a corrente gerada não bateria com o resto do sistema.
const FORMA_DO_ID = /^b_[0-9a-z]{6,}$/;
function identidadeDoPasso(passo, indice) {
  const id = passo?.id;
  return typeof id === "string" && FORMA_DO_ID.test(id) ? id : String(indice);
}

console.log(aplicar ? "MODO: APLICANDO (grava no banco)\n" : "MODO: ENSAIO A SECO (nada é gravado)\n");

// A COLUNA PODE AINDA NÃO EXISTIR no banco contra o qual este script roda: quem
// a cria é `migrations/001-ligacoes.sql`, aplicada por `scripts/migrar.mjs` — e
// este script não grava DDL nenhuma, para não fazer esquema ser coisa de script
// de dado. (Até 26/08 havia uma segunda porta, o `ensureSchema` do app na
// primeira requisição depois do deploy; ela foi apagada, e a ordem "migrar
// antes" deixou de ter rede.) Sem a coluna, toda automação
// está, na prática, no estado que o `default '[]'::jsonb` promete: sem ligação
// nenhuma. É a mesma leitura, só que sem a coluna para confirmar.
const [{ existe }] = await sql`
  select exists (
    select 1 from information_schema.columns
    where table_name = 'automations' and column_name = 'ligacoes'
  ) as existe`;

if (!existe) {
  console.log("A coluna `ligacoes` ainda não existe neste banco — tratando toda automação como sem ligação.\n");
}

const linhas = existe
  ? await sql`select id, name, steps, ligacoes from automations order by name`
  : await sql`select id, name, steps from automations order by name`;

let mexidas = 0;
let totalLigacoes = 0;

for (const a of linhas) {
  const passos = Array.isArray(a.steps) ? a.steps : [];
  const ligacoesAtuais = existe && Array.isArray(a.ligacoes) ? a.ligacoes : [];

  // IDEMPOTENTE: automação que já tem ligações não é tocada.
  if (ligacoesAtuais.length > 0) {
    console.log(`  ok   ${a.name} — já tem ${ligacoesAtuais.length} ligação(ões), não mexida`);
    continue;
  }

  // Menos de dois blocos não tem par consecutivo nenhum para encadear — a
  // corrente é vazia, e isso não é falha, é o fim do fluxo já no primeiro bloco.
  if (passos.length < 2) {
    console.log(`  ok   ${a.name} — ${passos.length} bloco(s), nenhuma ligação a gerar`);
    continue;
  }

  // SÓ A CORRENTE: bloco i → bloco i+1, sempre `{tipo:"sempre"}`. O último bloco
  // não ganha saída — é o fim do fluxo, e `interpretar` também para nele hoje.
  const novasLigacoes = [];
  for (let i = 0; i < passos.length - 1; i++) {
    novasLigacoes.push({
      de: identidadeDoPasso(passos[i], i),
      quando: { tipo: "sempre" },
      para: identidadeDoPasso(passos[i + 1], i + 1),
    });
  }

  console.log(
    `  ►    ${a.name} — ${passos.length} blocos, ${novasLigacoes.length} ligação(ões) ${aplicar ? "gravada(s)" : "prevista(s)"}`
  );
  for (const l of novasLigacoes) console.log(`         ${l.de} → ${l.para}`);

  if (aplicar) {
    await sql`update automations set ligacoes = ${sql.json(novasLigacoes)} where id = ${a.id}`;
  }

  mexidas++;
  totalLigacoes += novasLigacoes.length;
}

console.log(`\n${mexidas} automação(ões) ${aplicar ? "alterada(s)" : "seriam alteradas"} de ${linhas.length}.`);
console.log(`${totalLigacoes} ligação(ões) ${aplicar ? "gravada(s)" : "prevista(s)"}.`);
if (!aplicar && mexidas) console.log("Para gravar: node scripts/ligar-passos-existentes.mjs --aplicar");
await sql.end();
