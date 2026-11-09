// A CONFERÊNCIA DO `queue_kind_check` ACEITA DUAS FORMAS, E SÓ ELAS (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// O `scripts/migrar.mjs` roda em todo deploy de produção e exige o texto EXATO de cada restrição conferida;
// uma divergência derruba o build (saída 1). A entrega do LinkedIn alarga o `queue_kind_check` com o tipo
// `publicacao_linkedin` (a migração 025, na parte 2 da entrega; a 024 da parte 1 não toca a fila), aplicada à
// mão antes do merge, como a 022 e a 023. Sem esta preparação, todo deploy da `main` entre a 025 e o merge
// morreria no build.
//
// As duas formas aceitas são a da 010 (a de hoje) e a da 025. Qualquer terceira continua sendo divergência:
// é o que este arquivo prova, rodando o script de verdade, como o build roda, contra um schema descartável.
//
// OS TEXTOS SÃO OS DO `pg_get_constraintdef`, medidos no banco de teste em 06/11/2026.
import { afterAll, beforeAll, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  conferirCaminho,
  criarSchema,
  destruirSchema,
  novoNomeDeSchema,
  urlComSchema,
  urlDoBanco,
} from "./banco-descartavel";
import { sslDaUrl } from "@/lib/conexao";

const rodar = promisify(execFile);
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const TIPOS_DA_010 = [
  "private_reply",
  "comment_reply",
  "dm_welcome",
  "dm_link",
  "dm_reminder",
  "dm_follow_gate",
  "dm_email_ask",
  "story_reaction",
  "dm_manual",
  "dm_lote",
  "publicacao",
];

let schema: string | null = null;
let urlDoTeste = "";
let leitor: postgres.Sql | null = null;

beforeAll(async () => {
  schema = novoNomeDeSchema();
  await criarSchema(schema);
  urlDoTeste = urlComSchema(urlDoBanco(), schema);
  leitor = postgres(urlDoTeste, { prepare: false, ssl: sslDaUrl(urlDoTeste), max: 1 });
  // A trava de `banco-descartavel`: confere NO BANCO que o caminho é o schema temporário sozinho.
  await conferirCaminho((texto) => leitor!.unsafe(texto), schema);
  // A pasta inteira, pelo próprio script: o `queue_kind_check` nasce na forma da 010.
  const r = await migrar("--aplicar", "--a-mao");
  if (r.codigo !== 0) throw new Error(`a pasta não aplicou no schema descartável:\n${r.saida}`);
}, 240_000);

afterAll(async () => {
  await leitor?.end();
  if (schema) await destruirSchema(schema);
});

/** Roda `scripts/migrar.mjs` como o build roda, contra o schema descartável deste arquivo. */
async function migrar(...bandeiras: string[]) {
  try {
    const { stdout } = await rodar("node", ["scripts/migrar.mjs", ...bandeiras], {
      cwd: RAIZ,
      env: { ...process.env, DATABASE_URL: urlDoTeste, VERCEL_ENV: "" },
      maxBuffer: 20e6,
    });
    return { saida: stdout, codigo: 0 };
  } catch (erro) {
    const e = erro as { stdout?: string; stderr?: string; code?: number };
    return { saida: `${e.stdout ?? ""}${e.stderr ?? ""}`, codigo: e.code ?? 1 };
  }
}

/** Troca o `queue_kind_check` do schema descartável por um com estes tipos. */
async function checkCom(tipos: string[]) {
  const lista = tipos.map((t) => `'${t}'`).join(",");
  await leitor!.unsafe(`alter table queue drop constraint queue_kind_check`);
  await leitor!.unsafe(`alter table queue add constraint queue_kind_check check (kind in (${lista}))`);
}

const CONFERE = "CONFERIDO no banco: queue.queue_kind_check existe e confere";

it("a forma da 010 confere", async () => {
  await checkCom(TIPOS_DA_010);
  const r = await migrar("--a-mao");
  expect(r.codigo, r.saida).toBe(0);
  expect(r.saida).toContain(CONFERE);
}, 120_000);

it("a forma da 025, com o publicacao_linkedin, também confere", async () => {
  await checkCom([...TIPOS_DA_010, "publicacao_linkedin"]);
  const r = await migrar("--a-mao");
  expect(r.codigo, r.saida).toBe(0);
  expect(r.saida).toContain(CONFERE);
  expect(r.saida).not.toContain("queue_kind_check existe, MAS DIVERGE");
}, 120_000);

it("uma terceira forma continua divergindo, e derruba o script", async () => {
  await checkCom([...TIPOS_DA_010, "publicacao_linkedin", "tipo_que_ninguem_escreveu"]);
  const r = await migrar("--a-mao");
  expect(r.codigo, r.saida).toBe(1);
  expect(r.saida).toContain("queue.queue_kind_check existe, MAS DIVERGE");
}, 120_000);

it("a forma da 010 sem um tipo também diverge", async () => {
  await checkCom(TIPOS_DA_010.filter((t) => t !== "dm_lote"));
  const r = await migrar("--a-mao");
  expect(r.codigo, r.saida).toBe(1);
  expect(r.saida).toContain("queue.queue_kind_check existe, MAS DIVERGE");
  await checkCom(TIPOS_DA_010);
}, 120_000);
