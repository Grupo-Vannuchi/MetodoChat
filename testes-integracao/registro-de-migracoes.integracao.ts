// O APLICADOR DE VERDADE, RODADO DUAS VEZES.
//
// POR QUE ESTE ARQUIVO EXISTE, com a medição que o obrigou.
//
// Em 28/08/2026 dois builds de produção morreram aos 120 segundos, os dois no
// PRIMEIRO arquivo de migração, com `canceling statement due to statement
// timeout` (57014). Nenhuma das seis migrações tinha o que fazer.
//
// A causa: `alter table ... if not exists` pega a trava EXCLUSIVA da tabela
// ANTES de descobrir que não há nada a fazer. Um leitor parado numa transação
// aberta segura a tabela e derruba o deploy — inclusive o deploy que não muda
// uma vírgula do esquema. Foi um `npm run dev` apontando para o mesmo banco.
//
// O conserto é não executar o que já foi executado, e a decisão disso mora em
// `scripts/migracoes.mjs`, com 17 casos puros. MAS A DECISÃO PURA NÃO PROVA O
// QUE INTERESSA: o que interessa é o script, falando com um banco, decidindo
// pular. Essa é a fiação — e esta fase inteira mediu, oito vezes, que é na
// fiação entre camadas que o defeito sobrevive a tudo.
//
// Por isso aqui o script é EXECUTADO, como processo, do jeito que o build o
// executa. Duas vezes contra o mesmo schema. A segunda tem de não aplicar nada.
//
// ISOLAMENTO — por que isto não toca produção:
//   1. a `DATABASE_URL` entregue ao processo leva `search_path=teste_tmp_…`
//      SOZINHO, sem `public` na cauda (a armadilha está escrita em
//      `banco-descartavel.ts`: com `public` atrás, `current_schema()` mente);
//   2. NENHUMA migração cita schema explicitamente — conferido por busca em
//      `migrations/*.sql`: nada de `public.`, nada de `set search_path`;
//   3. a conferência do próprio script usa `to_regclass`, que resolve pelo
//      `search_path` — ela fotografa o schema temporário, não o `public`;
//   4. o schema morre no fim, e `rede-global.ts` derruba a rodada se sobrar.
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
import { migracoesEmOrdem } from "./migracoes";

const rodar = promisify(execFile);
const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const URL_ORIGINAL = urlDoBanco();

let schema: string | null = null;
let urlDoTeste = "";
let leitor: postgres.Sql | null = null;

beforeAll(async () => {
  schema = novoNomeDeSchema();
  await criarSchema(schema);
  urlDoTeste = urlComSchema(URL_ORIGINAL, schema);
  leitor = postgres(urlDoTeste, { prepare: false, ssl: "require", max: 1 });
  // A trava de `banco-descartavel`: confere NO BANCO que o caminho é o schema
  // temporário sozinho. Se esta linha passar, nada abaixo alcança `public`.
  await conferirCaminho((texto) => leitor!.unsafe(texto), schema);
}, 120_000);

afterAll(async () => {
  await leitor?.end();
  if (schema) await destruirSchema(schema);
});

/** Roda `scripts/migrar.mjs` como o build roda, contra o schema descartável. */
async function migrar(...bandeiras: string[]) {
  try {
    const { stdout } = await rodar("node", ["scripts/migrar.mjs", ...bandeiras], {
      cwd: RAIZ,
      // `--a-mao` é o que o script exige fora de um deploy, e ele conferiu que
      // existe `.env.local`. A URL vem do AMBIENTE, e o script prefere o
      // ambiente ao arquivo — é assim que o schema temporário entra.
      env: { ...process.env, DATABASE_URL: urlDoTeste, VERCEL_ENV: "" },
      maxBuffer: 20e6,
    });
    return { saida: stdout, codigo: 0 };
  } catch (erro) {
    const e = erro as { stdout?: string; stderr?: string; code?: number };
    return { saida: `${e.stdout ?? ""}${e.stderr ?? ""}`, codigo: e.code ?? 1 };
  }
}

const QUANTAS = migracoesEmOrdem().length;

it("a PRIMEIRA rodada aplica tudo e anota, e a SEGUNDA não aplica nada", async () => {
  const primeira = await migrar("--aplicar", "--a-mao");
  expect(primeira.codigo, primeira.saida).toBe(0);

  // Todas aplicadas, e o "registrada" é o que separa esta versão da anterior.
  const aplicadas = [...primeira.saida.matchAll(/aplicada e registrada/g)].length;
  expect(aplicadas, primeira.saida).toBe(QUANTAS);

  // O registro existe e tem uma linha por arquivo, com assinatura.
  const anotadas = await leitor!`select name, checksum from schema_migrations order by name`;
  expect(anotadas.map((r) => r.name)).toEqual(migracoesEmOrdem().map((m) => m.nome));
  for (const r of anotadas) expect(r.checksum).toMatch(/^[0-9a-f]{64}$/);

  // ===== A SEGUNDA RODADA — o motivo deste arquivo existir =====
  const segunda = await migrar("--aplicar", "--a-mao");
  expect(segunda.codigo, segunda.saida).toBe(0);

  // NADA aplicado: é isto que faz o deploy parar de pedir trava exclusiva.
  expect(segunda.saida).not.toContain("aplicada e registrada");
  expect(segunda.saida).toContain("Nada a aplicar");
  expect([...segunda.saida.matchAll(/já aplicada, nada a fazer/g)].length).toBe(QUANTAS);

  // E ela continua CONFERINDO o banco: pular o trabalho não é pular o exame.
  expect(segunda.saida).toContain("CONFERIDO no banco");
}, 240_000);

it("migração EDITADA depois de aplicada faz o script PARAR, sem aplicar nada", async () => {
  // O registro já está preenchido pelo caso acima. Estragar a assinatura de uma
  // linha é indistinguível, para o script, de alguém ter editado o arquivo.
  await leitor!`update schema_migrations set checksum = 'assinatura-de-outro-texto'
                 where name = ${migracoesEmOrdem()[0].nome}`;

  const r = await migrar("--aplicar", "--a-mao");

  expect(r.codigo, r.saida).toBe(1);
  expect(r.saida).toContain("PAROU");
  expect(r.saida).toContain(migracoesEmOrdem()[0].nome);
  // E NÃO aplicou nada — nem as que estavam em ordem. A pergunta "este banco
  // está no estado que a pasta descreve?" ficou sem resposta, e aplicar mais
  // coisas por cima só afundaria o descompasso.
  expect(r.saida).not.toContain("aplicada e registrada");

  // Devolve o registro ao lugar, para não contaminar quem rodar depois.
  await leitor!`delete from schema_migrations where name = ${migracoesEmOrdem()[0].nome}`;
}, 120_000);

it("o registro nasce no schema descartável, e NÃO no public", async () => {
  const [r] = await leitor!`
    select n.nspname as schema
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relname = 'schema_migrations' and n.nspname = ${schema!}`;
  expect(r?.schema).toBe(schema);
}, 60_000);
