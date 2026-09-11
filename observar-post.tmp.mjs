// SOMENTE LEITURA. Nao dispara dreno, nao escreve nada.
import postgres from "postgres";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { prepare: false, ssl: "require" });
const ID = "d888f1f7-096f-4763-9673-d2de35a50b13";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let anterior = null;
for (let i = 0; i < 40; i++) {
  const [l] = await sql`select status, attempts, claimed_at, sent_at,
                               left(coalesce(error,''),300) as erro
                          from queue where id = ${ID}::uuid`;
  if (!l) { console.log("linha sumiu do banco"); break; }
  const foto = l.status + "/" + l.attempts + "/" + (l.erro || "");
  if (foto !== anterior) {
    console.log(new Date().toISOString(), "->", l.status, "tent:", l.attempts,
      "saiu:", l.sent_at?.toISOString() ?? "-", l.erro ? "| ERRO: " + l.erro : "");
    anterior = foto;
  }
  if (["sent", "failed", "skipped"].includes(l.status)) {
    console.log("DESFECHO:", l.status);
    break;
  }
  await espera(30000);
}
await sql.end();
