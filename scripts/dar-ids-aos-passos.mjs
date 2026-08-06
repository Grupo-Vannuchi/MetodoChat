// Dá id a todo bloco de toda automação que ainda não tem.
//
// Roda UMA vez, antes do deploy da Fase 1b. Sem ele, as automações existentes
// continuam identificadas por índice: funcionam, mas reordenar no quadro novo
// reenviaria mensagem — exatamente o defeito que esta fase existe para matar.
//
// Preserva a ordem e todo o resto do objeto: só acrescenta o campo `id` onde
// falta. Idempotente — rodar duas vezes não muda nada na segunda.
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { prepare: false, ssl: "require", onnotice: () => {} });

const novoId = () => "b_" + Math.random().toString(36).slice(2, 10);
const temId = (p) => p && typeof p === "object" && /^b_[0-9a-z]{6,}$/.test(p.id ?? "");

const linhas = await sql`select id, name, steps from automations`;
let mexidas = 0;

for (const a of linhas) {
  const passos = Array.isArray(a.steps) ? a.steps : [];
  const faltando = passos.filter((p) => !temId(p)).length;
  if (!faltando) {
    console.log(`  ok   ${a.name} — ${passos.length} blocos, todos com id`);
    continue;
  }
  const novos = passos.map((p) => (temId(p) ? p : { ...p, id: novoId() }));
  await sql`update automations set steps = ${sql.json(novos)} where id = ${a.id}`;
  console.log(`  ►    ${a.name} — ${faltando} de ${passos.length} blocos ganharam id`);
  mexidas++;
}

console.log(`\n${mexidas} automação(ões) alterada(s) de ${linhas.length}.`);
await sql.end();
