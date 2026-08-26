// UM BANCO NASCIDO SÓ DAS MIGRAÇÕES É O MESMO QUE UM NASCIDO DE `ensureSchema()`?
//
// Esta base tem, hoje, DUAS FONTES DE VERDADE para a estrutura do banco:
//
//   A — `ensureSchema()` (lib/db.ts): 42 instruções na lista `DDL`, mais dois
//       `alter` soltos, mais a semente de `config`, mais `migrateAccounts`
//   B — `migrations/`: `000-esquema-base.sql` e as que vieram depois
//
// Enquanto as duas coexistem — e elas coexistem de propósito, porque **a rede
// não pode sumir antes da hora** —, nada as compara. É exatamente o formato de
// divergência silenciosa que esta base passou a semana fechando: duas cópias da
// mesma regra, cada uma envelhecendo sozinha, e o dia em que alguém acrescentar
// DDL só num dos lados ninguém fica sabendo.
//
// Este arquivo monta **um schema descartável por lado** e compara os dois campo
// a campo: tabela, coluna (com posição, tipo, nulidade e padrão), índice, chave
// primária, chave estrangeira com regra de exclusão, e `check`.
//
// -----------------------------------------------------------------------------
// A COMPARAÇÃO VAZIA É O PIOR RESULTADO POSSÍVEL, E POR ISSO ELA É PROVADA AQUI
//
// Uma comparação que passa porque não olha nada imprime verde e ensina a
// confiar. Esta base já foi mordida por isso duas vezes (a contraprova da
// varredura ficou muda por três pontos de chamada; a guarda de um instrumento
// perguntava `=== 0` onde devia perguntar `> 0`). São duas defesas, e as duas
// são ASSERÇÃO EXECUTADA, e não comentário:
//
//   1. o caso "o retrato de cada lado tem substância" exige um piso de tabelas,
//      colunas, índices e restrições — um retrato vazio não passa
//   2. o caso "a comparação DISCRIMINA" QUEBRA o lado B de três jeitos (uma
//      coluna, um índice, uma restrição), um por vez, dentro de uma transação
//      que é desfeita em seguida, e exige VERMELHO em cada um — e exige verde de
//      novo depois de desfazer
//
// -----------------------------------------------------------------------------
// SE ELES DIVERGIREM, A LISTA É A RESPOSTA
//
// A divergência não é para ser contornada: ela É a lista do que ainda falta
// migrar. Cada linha diz a categoria, o nome e os dois valores.
import { afterAll, beforeAll, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import postgres from "postgres";
import {
  conferirCaminho,
  criarSchema,
  destruirSchema,
  novoNomeDeSchema,
  urlComSchema,
  urlDoBanco,
} from "./banco-descartavel";
import { bancoDescartavel } from "./harness";
import {
  compararEstruturas,
  consultarPor,
  retratoEstrutural,
  tamanhoDoRetrato,
  type RetratoEstrutural,
} from "./retrato-estrutural";

// A URL é lida na avaliação do módulo, ANTES de o `beforeAll` do harness
// reescrever `process.env.DATABASE_URL` com o `search_path` do schema A. Sem
// isto, o lado B nasceria a partir de uma URL já apontada para o lado A.
const URL_ORIGINAL = urlDoBanco();

const PASTA = fileURLToPath(new URL("../migrations", import.meta.url));

// ESPELHA `scripts/migrar.mjs`, e o espelho é declarado como o de `limparUrl`
// naquele mesmo arquivo: a ordem é por NOME (é por isso que os arquivos são
// numerados), e as linhas que são só comentário saem antes de o arquivo ser
// executado. Duas formas diferentes para a mesma leitura é como nasce a
// divergência que ninguém vê — e aqui a divergência seria pior que em qualquer
// outro lugar, porque este arquivo existe justamente para provar que o que
// `migrar.mjs` aplica produz o banco certo.
function migracoesEmOrdem(): { nome: string; comandos: string }[] {
  return readdirSync(PASTA)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((nome) => ({
      nome,
      comandos: readFileSync(join(PASTA, nome), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("--") && l.trim())
        .join("\n")
        .trim(),
    }));
}

const banco = bancoDescartavel();

let soMigracoes: string | null = null;
let escritor: postgres.Sql | null = null;
let leitor: postgres.Sql | null = null;

/** Aplica a pasta inteira, na ordem, no schema B. */
async function aplicarMigracoes(s: postgres.Sql): Promise<string[]> {
  const aplicadas: string[] = [];
  for (const { nome, comandos } of migracoesEmOrdem()) {
    if (!comandos) continue;
    await s.unsafe(comandos);
    aplicadas.push(nome);
  }
  return aplicadas;
}

beforeAll(async () => {
  // O leitor vive em `public` e só faz `select` sobre o catálogo: é ele que tira
  // os dois retratos, para que nenhum dos lados seja fotografado por uma conexão
  // com privilégio ou caminho diferente do outro.
  const semCaminho = new URL(URL_ORIGINAL);
  semCaminho.searchParams.delete("search_path");
  leitor = postgres(semCaminho.toString(), {
    prepare: false,
    ssl: "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  });

  const nome = novoNomeDeSchema();
  await criarSchema(nome);
  soMigracoes = nome;

  try {
    escritor = postgres(urlComSchema(URL_ORIGINAL, nome), {
      prepare: false,
      ssl: "require",
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      onnotice: () => {},
    });

    // A MESMA trava do harness, e ela é obrigatória aqui pelo mesmo motivo: com
    // `public` na cauda do caminho, o que faltar nas migrações seria lido da
    // PRODUÇÃO e a comparação ficaria verde sobre o schema errado.
    await conferirCaminho((texto) => escritor!.unsafe(texto) as unknown as Promise<unknown[]>, nome);

    const aplicadas = await aplicarMigracoes(escritor);
    if (aplicadas.length < 4) {
      throw new Error(
        `Só ${aplicadas.length} migrações rodaram (${aplicadas.join(", ")}). ` +
          `A pasta tem de ter, no mínimo, o esquema base e as três de antes dele.`
      );
    }
  } catch (erro) {
    if (escritor) await escritor.end({ timeout: 5 });
    escritor = null;
    await destruirSchema(nome);
    soMigracoes = null;
    throw erro;
  }
});

afterAll(async () => {
  try {
    if (escritor) await escritor.end({ timeout: 5 });
  } finally {
    try {
      if (soMigracoes) await destruirSchema(soMigracoes);
    } finally {
      if (leitor) await leitor.end({ timeout: 5 });
    }
  }
});

async function retratoA(): Promise<RetratoEstrutural> {
  return retratoEstrutural(consultarPor(leitor!), banco.nome());
}
async function retratoB(): Promise<RetratoEstrutural> {
  return retratoEstrutural(consultarPor(leitor!), soMigracoes!);
}

it("o retrato de cada lado tem substância — comparação vazia não passa por aqui", async () => {
  const a = tamanhoDoRetrato(await retratoA());
  const b = tamanhoDoRetrato(await retratoB());

  // Os pisos são medidos, e não redondos: o esquema de hoje tem 8 tabelas, 99
  // colunas, 16 índices e 16 restrições de cada lado. O piso fica um pouco
  // abaixo para que acrescentar estrutura não quebre o teste de graça — e bem
  // acima de zero, que é o número que a comparação vazia produziria.
  for (const [lado, t] of [
    ["A (ensureSchema)", a],
    ["B (só migrações)", b],
  ] as const) {
    expect(t.tabelas, `${lado}: tabelas`).toBeGreaterThanOrEqual(8);
    expect(t.colunas, `${lado}: colunas`).toBeGreaterThanOrEqual(90);
    expect(t.indices, `${lado}: índices`).toBeGreaterThanOrEqual(14);
    expect(t.restricoes, `${lado}: restrições`).toBeGreaterThanOrEqual(14);
  }
});

it("um banco nascido SÓ das migrações é idêntico ao nascido de ensureSchema()", async () => {
  const a = await retratoA();
  const b = await retratoB();
  const divergencias = compararEstruturas(a, b, "A (ensureSchema)", "B (só migrações)");

  // A mensagem carrega a lista inteira de propósito: se este teste ficar
  // vermelho, a lista É o que ainda falta migrar, e ela precisa estar na tela de
  // quem leu o vermelho — não num passo seguinte que alguém tem de rodar.
  expect(
    divergencias,
    `\n${divergencias.length} divergência(s) entre os dois lados:\n` +
      divergencias.map((d) => "  - " + d).join("\n") +
      "\n"
  ).toEqual([]);
});

it("a semente de config nasce das migrações, e rodar de novo NÃO troca o token", async () => {
  const antes = (await escritor!.unsafe(
    `select webhook_verify_token as t from config where id = 1`
  )) as unknown as { t: string | null }[];

  // Um banco que "nasce só das migrações" e não funciona não nasceu: sem esta
  // linha, `getConfig()` devolve `undefined` e o painel não sobe.
  expect(antes).toHaveLength(1);
  expect(antes[0].t).toMatch(/^[0-9a-f]{32}$/);

  // O QUE O `on conflict (id) do nothing` GARANTE, medido e não suposto: a
  // segunda passada não escreve nada. O token vive no painel de webhooks da
  // Meta, e trocá-lo derrubaria a entrega de todo webhook até alguém
  // reconfigurar a Meta à mão.
  await aplicarMigracoes(escritor!);

  const depois = (await escritor!.unsafe(
    `select webhook_verify_token as t from config where id = 1`
  )) as unknown as { t: string | null }[];
  expect(depois).toHaveLength(1);
  expect(depois[0].t).toBe(antes[0].t);

  // E a segunda passada também não mexe na estrutura — que é o contrato desta
  // pasta enquanto não houver tabela de controle.
  const divergencias = compararEstruturas(
    await retratoA(),
    await retratoB(),
    "A (ensureSchema)",
    "B (só migrações, rodadas duas vezes)"
  );
  expect(divergencias, divergencias.join("\n")).toEqual([]);
});

it("a comparação DISCRIMINA: quebrar o lado B de três jeitos fica vermelho, e desfazer fica verde", async () => {
  const a = await retratoA();
  const b = soMigracoes!;

  // Cada quebra roda DENTRO de uma transação que é desfeita por uma exceção. DDL
  // no Postgres é transacional, então o `rollback` devolve o schema ao estado
  // anterior — inclusive a POSIÇÃO da coluna, que um `drop` seguido de `add`
  // não devolveria.
  async function quebrando(comando: string): Promise<string[]> {
    let divergencias: string[] = [];
    await expect(
      escritor!.begin(async (tx) => {
        await tx.unsafe(comando);
        const quebrado = await retratoEstrutural(consultarPor(tx as unknown as postgres.Sql), b);
        divergencias = compararEstruturas(a, quebrado, "A (ensureSchema)", "B QUEBRADO");
        throw new Error("desfaz de propósito");
      })
    ).rejects.toThrow("desfaz de propósito");
    return divergencias;
  }

  const semColuna = await quebrando(`alter table "${b}".contacts drop column last_seen_at`);
  expect(semColuna.join("\n")).toContain("contacts.last_seen_at");
  expect(semColuna.length).toBeGreaterThan(0);

  const semIndice = await quebrando(`drop index "${b}".queue_pending_idx`);
  expect(semIndice.join("\n")).toContain("queue_pending_idx");

  // A terceira é a que importa mais, porque é a categoria em que
  // `migrateAccounts` escondia as mudanças de forma: devolver a `queue` os cinco
  // tipos do `create table` no lugar dos nove que o motor usa.
  const cheque = await quebrando(
    `alter table "${b}".queue drop constraint queue_kind_check;
     alter table "${b}".queue add constraint queue_kind_check check (kind in (
       'private_reply','comment_reply','dm_welcome','dm_link','dm_reminder'))`
  );
  expect(cheque.join("\n")).toContain("queue_kind_check");

  // E a volta: desfeitas as três, os dois lados voltam a ser idênticos. Sem esta
  // linha, "ficou vermelho" não distingue uma comparação que discrimina de uma
  // que reprova tudo.
  const depois = compararEstruturas(a, await retratoB(), "A (ensureSchema)", "B (só migrações)");
  expect(depois, depois.join("\n")).toEqual([]);
});
