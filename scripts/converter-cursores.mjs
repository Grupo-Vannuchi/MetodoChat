// Converte o cursor ANTIGO (`flow_step_index`, posição) para o NOVO
// (`flow_step_id`, identidade do bloco).
//
// Uso:  node scripts/converter-cursores.mjs            ← ENSAIO A SECO, só lê
//       node scripts/converter-cursores.mjs --aplicar  ← grava
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE
//
// A Fase 1b trocou o cursor de POSIÇÃO para BLOCO, e deixou `flow_step_index`
// como reserva: `lerCursor` (lib/engine.ts) a lê quando `flow_step_id` está
// nula, convertendo o inteiro em texto — que é exatamente a forma da identidade
// de um bloco SEM id.
//
// **A reserva é letra morta**, e isto foi medido: `scripts/dar-ids-aos-passos.mjs`
// já deu id a todo bloco de toda automação gravada, e `identidadeDoPasso`
// (lib/steps.ts) só devolve o índice para bloco SEM id. Com todo bloco tendo id,
// a identidade nunca é numérica, `indiceDoId(passos, "0")` não acha nada, e o
// cursor velho resolve para NULL.
//
// Isso falha na direção segura — cursor que não resolve nunca pula passo, e
// nenhuma das três retomadas atravessa o portão de follow —, mas o preço é real:
// quem está parado no meio de um fluxo recomeça do zero em vez de continuar de
// onde estava.
//
// -----------------------------------------------------------------------------
// O QUE ELE NÃO CONSERTA, e isto precisa estar escrito antes de alguém rodar
//
// A conversão traduz o índice pela lista de HOJE:
// `identidadeDoPasso(steps[indice], indice)`. Ela é fiel se — e só se — a ordem
// da lista não mudou desde que o cursor foi gravado. Se um bloco foi INSERIDO ou
// APAGADO antes daquela posição no meio-tempo, o índice já aponta para outro
// bloco, e a conversão grava esse outro bloco com a mesma fidelidade com que
// gravaria o certo. Não há como distinguir os dois casos a partir do dado: é
// justamente a informação que a identidade por posição não guarda, e a razão de
// esta fase existir.
//
// O estrago possível de um índice deslocado é o mesmo de sempre — retomar
// adiante do portão de follow. Antes de aplicar, vale olhar QUAL BLOCO cada
// conversão escolhe: o ensaio a seco imprime o tipo e o texto dele.
// -----------------------------------------------------------------------------
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

// A QUARTA CÓPIA de `FORMA_DO_ID` (lib/steps.ts), e ela é cópia pelo mesmo
// motivo da terceira (`scripts/dar-ids-aos-passos.mjs`): este script é
// JavaScript solto, roda por `node` direto e não importa de `lib/steps.ts`, que
// é TypeScript. Divergindo dela, este script chamaria de "sem id" um bloco que
// `identidadeDoPasso` aceita — e gravaria o ÍNDICE onde devia gravar o id.
const FORMA_DO_ID = /^b_[0-9a-z]{6,}$/;

// `identidadeDoPasso` de lib/steps.ts, byte a byte. É ela que decide o que vai
// para a coluna, e é ela que `indiceDoId` vai usar para achar o bloco de volta.
function identidadeDoPasso(passo, indice) {
  const id = passo?.id;
  return typeof id === "string" && FORMA_DO_ID.test(id) ? id : String(indice);
}

function resumo(p) {
  if (!p || typeof p !== "object") return "(bloco corrompido)";
  const texto = typeof p.texto === "string" ? p.texto.slice(0, 40) : "";
  return `${p.tipo}${texto ? ` — "${texto}"` : ""}`;
}

console.log(aplicar ? "MODO: APLICANDO (grava no banco)\n" : "MODO: ENSAIO A SECO (nada é gravado)\n");

// SÓ QUEM TEM O CURSOR VELHO E NÃO TEM O NOVO. `gravarCursor` (lib/engine.ts)
// zera `flow_step_index` ao escrever `flow_step_id`, então os dois preenchidos
// não deveria acontecer — e se acontecer, quem manda é o novo, que é o que
// `lerCursor` prefere. Mexer nesse caso seria escrever por cima de um cursor
// atual a partir de um resíduo.
const alvos = await sql`
  select c.ig_id, c.account_id, c.flow_step_index, c.last_automation_id,
         a.name as automacao, a.steps
  from contacts c
  left join automations a on a.id = c.last_automation_id
  where c.flow_step_index is not null
    and c.flow_step_id is null
  order by c.ig_id`;

console.log(`${alvos.length} contato(s) com cursor antigo e sem cursor novo.\n`);

let convertidos = 0;
let pulados = 0;

for (const c of alvos) {
  const onde = `ig_id=${c.ig_id} indice=${c.flow_step_index}`;

  if (!c.last_automation_id) {
    console.log(`  pula  ${onde} — sem last_automation_id: não há lista em que traduzir o índice.`);
    pulados++;
    continue;
  }
  if (!Array.isArray(c.steps)) {
    console.log(`  pula  ${onde} — automação ${c.last_automation_id} sumiu ou não tem lista.`);
    pulados++;
    continue;
  }
  const passo = c.steps[c.flow_step_index];
  if (passo === undefined) {
    // Cursor obsoleto: a lista encurtou. Deixar como está é o mesmo que já
    // acontece hoje — não resolve, e não resolver nunca pula passo.
    console.log(
      `  pula  ${onde} — a lista de "${c.automacao}" tem ${c.steps.length} blocos: o índice não existe mais.`
    );
    pulados++;
    continue;
  }

  const identidade = identidadeDoPasso(passo, c.flow_step_index);
  const numerica = identidade === String(c.flow_step_index);
  console.log(
    `  ${aplicar ? "grava" : "faria"} ${onde} → flow_step_id="${identidade}"` +
      `${numerica ? "  (ÍNDICE: o bloco não tem id — a conversão não muda nada na prática)" : ""}`
  );
  console.log(`         automação: ${c.automacao}`);
  console.log(`         bloco ${c.flow_step_index}: ${resumo(passo)}`);

  if (aplicar) {
    // AS DUAS COLUNAS NA MESMA ESCRITA, como `gravarCursor` faz: a velha é
    // zerada junto para as duas nunca discordarem sobre onde a pessoa está.
    await sql`
      update contacts
      set flow_step_id = ${identidade}, flow_step_index = null
      where ig_id = ${c.ig_id} and account_id = ${c.account_id}
        and flow_step_index = ${c.flow_step_index} and flow_step_id is null`;
  }
  convertidos++;
}

console.log(
  `\n${convertidos} ${aplicar ? "convertido(s)" : "seriam convertidos"}, ${pulados} pulado(s).`
);
if (!aplicar && convertidos) console.log("Para gravar: node scripts/converter-cursores.mjs --aplicar");
await sql.end();
