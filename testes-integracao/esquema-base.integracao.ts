// A PASTA `migrations/` É A ÚNICA FONTE DA ESTRUTURA. ELA BASTA?
//
// Até 26/08 esta base tinha DUAS fontes de verdade para a estrutura do banco —
// `ensureSchema()` (lib/db.ts) e `migrations/` — e este arquivo existia para
// provar que as duas não tinham divergido. Ele montava um schema descartável por
// lado e os comparava campo a campo. **A última medição fechou em ZERO
// divergências, com 8 tabelas, 99 colunas, 16 índices e 16 restrições de cada
// lado**, e foi com ela na mão que `ensureSchema` foi apagado.
//
// COM UMA FONTE SÓ, A COMPARAÇÃO A×B DEIXOU DE TER LADO A, e ela saiu daqui: um
// teste que compara duas coisas iguais por construção imprime verde e não mede
// nada, que é o pior defeito possível num instrumento. No lugar dela ficaram as
// três perguntas que continuam tendo resposta, mais uma que só passou a existir
// depois que a rede caiu.
//
//   1. O ESQUEMA QUE NASCE DA PASTA TEM SUBSTÂNCIA — piso de tabelas, colunas,
//      índices e restrições. Uma pasta que encolhesse não passaria por aqui.
//   2. A SEMENTE DE `config` NASCE, e rodar a pasta de novo NÃO troca o token —
//      o contrato de idempotência, como asserção executada.
//   3. O RETRATO DISCRIMINA — quebrar o schema de três jeitos (uma coluna, um
//      índice, uma restrição), um por vez, dentro de uma transação desfeita em
//      seguida, tem de ficar VERMELHO em cada um, e verde de novo depois.
//   4. **O `public` DE PRODUÇÃO NÃO FICOU PARA TRÁS DA PASTA.** Esta é a nova, e
//      ela é a pergunta do dia em que `ensureSchema` morreu: enquanto ele
//      existia, o banco vivo se consertava sozinho na primeira requisição. Hoje
//      não. Se `public` não tiver tudo o que a pasta produz, a aplicação lê
//      `undefined` de `select *` e decide diferente SEM ERRO NENHUM — medido: uma
//      automação de três blocos entregou UM, com `ignorados=0`.
//
// A DIREÇÃO DA 4 É UMA SÓ, e é deliberado: exige-se que `public` CONTENHA o que
// a pasta produz, e não que seja igual a ela. Produção tem coisas a mais que
// nenhuma migração cria (colunas órfãs de fases antigas, por exemplo), e
// reprovar por elas transformaria este caso num alarme que se aprende a ignorar.
// O que importa é o lado que quebra o produto: FALTAR.
import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import {
  conferirCaminho,
  criarSchema,
  destruirSchema,
  novoNomeDeSchema,
  urlComSchema,
  urlDoBanco,
} from "./banco-descartavel";
import { aplicarMigracoes, exigirPastaInteira } from "./migracoes";
import {
  compararEstruturas,
  consultarPor,
  retratoEstrutural,
  tamanhoDoRetrato,
  type RetratoEstrutural,
} from "./retrato-estrutural";

// A URL é lida na avaliação do módulo, e sem `search_path`: este arquivo NÃO usa
// a fundação do harness — ele cria e conduz o próprio schema, porque o que ele
// mede é a pasta de migrações, e não o motor rodando sobre ela.
const URL_ORIGINAL = urlDoBanco();

let soMigracoes: string | null = null;
let escritor: postgres.Sql | null = null;
let leitor: postgres.Sql | null = null;

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

    exigirPastaInteira(await aplicarMigracoes((texto) => escritor!.unsafe(texto)));
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

// O leitor vive em `public` e só faz `select` sobre o catálogo: os dois retratos
// saem da MESMA conexão, para que nenhum dos lados seja fotografado por um
// privilégio ou um caminho diferente do outro.
async function retratoDaPasta(): Promise<RetratoEstrutural> {
  return retratoEstrutural(consultarPor(leitor!), soMigracoes!);
}
async function retratoDoPublic(): Promise<RetratoEstrutural> {
  return retratoEstrutural(consultarPor(leitor!), "public");
}

it("o esquema que nasce da pasta tem substância — retrato vazio não passa por aqui", async () => {
  const t = tamanhoDoRetrato(await retratoDaPasta());

  // Os pisos são medidos, e não redondos: o esquema de hoje tem 8 tabelas, 99
  // colunas, 16 índices e 16 restrições. O piso fica um pouco abaixo para que
  // acrescentar estrutura não quebre o teste de graça — e bem acima de zero, que
  // é o número que uma pasta esvaziada produziria.
  expect(t.tabelas, "tabelas").toBeGreaterThanOrEqual(8);
  expect(t.colunas, "colunas").toBeGreaterThanOrEqual(90);
  expect(t.indices, "índices").toBeGreaterThanOrEqual(14);
  expect(t.restricoes, "restrições").toBeGreaterThanOrEqual(14);
});

it("o `public` de PRODUÇÃO não ficou para trás da pasta de migrações", async () => {
  const daPasta = await retratoDaPasta();
  const doPublic = await retratoDoPublic();

  // A DIREÇÃO É UMA SÓ: o que a pasta produz tem de existir em `public`. O
  // contrário — `public` ter coisa a mais — é tolerado e IMPRESSO, nunca
  // reprovado (ver o cabeçalho).
  const faltando: string[] = [];
  for (const t of daPasta.tabelas) {
    if (!doPublic.tabelas.includes(t)) faltando.push(`tabela AUSENTE em public: ${t}`);
  }
  for (const c of Object.keys(daPasta.colunas)) {
    if (!(c in doPublic.colunas)) faltando.push(`coluna AUSENTE em public: ${c}`);
  }
  for (const r of Object.keys(daPasta.restricoes)) {
    if (!(r in doPublic.restricoes)) faltando.push(`restrição AUSENTE em public: ${r}`);
  }

  // O QUE `public` TEM A MAIS sai em voz alta, e não reprova. Sem a impressão, o
  // afrouxamento seria mudo — é a mesma regra do balde `vida` da digital.
  const aMais = [
    ...doPublic.tabelas.filter((t) => !daPasta.tabelas.includes(t)).map((t) => `tabela ${t}`),
    ...Object.keys(doPublic.colunas)
      .filter((c) => !(c in daPasta.colunas))
      .map((c) => `coluna ${c}`),
  ];
  console.log(
    `[public a mais, tolerado] ${aMais.length} item(ns)` +
      (aMais.length ? ":\n  " + aMais.join("\n  ") : "")
  );

  expect(
    faltando,
    `\n${faltando.length} coisa(s) que a pasta produz e o banco vivo NÃO tem:\n` +
      faltando.map((d) => "  - " + d).join("\n") +
      "\n"
  ).toEqual([]);
});

it("a semente de config nasce das migrações, e rodar de novo NÃO troca o token", async () => {
  const antesDaSegunda = await retratoDaPasta();
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
  await aplicarMigracoes((texto) => escritor!.unsafe(texto));

  const depois = (await escritor!.unsafe(
    `select webhook_verify_token as t from config where id = 1`
  )) as unknown as { t: string | null }[];
  expect(depois).toHaveLength(1);
  expect(depois[0].t).toBe(antes[0].t);

  // E a segunda passada também não mexe na estrutura — que é o contrato desta
  // pasta enquanto não houver tabela de controle.
  const divergencias = compararEstruturas(
    antesDaSegunda,
    await retratoDaPasta(),
    "a pasta, uma vez",
    "a pasta, duas vezes"
  );
  expect(divergencias, divergencias.join("\n")).toEqual([]);
});

it("o retrato DISCRIMINA: quebrar o schema de três jeitos fica vermelho, e desfazer fica verde", async () => {
  const bom = await retratoDaPasta();
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
        divergencias = compararEstruturas(bom, quebrado, "a pasta", "QUEBRADO");
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
  // `migrateAccounts` escondia as mudanças de forma antes de `004` e `005`
  // as trazerem para a pasta: devolver a `queue` os cinco tipos do
  // `create table` no lugar dos nove que o motor usa.
  const cheque = await quebrando(
    `alter table "${b}".queue drop constraint queue_kind_check;
     alter table "${b}".queue add constraint queue_kind_check check (kind in (
       'private_reply','comment_reply','dm_welcome','dm_link','dm_reminder'))`
  );
  expect(cheque.join("\n")).toContain("queue_kind_check");

  // E a volta: desfeitas as três, os dois lados voltam a ser idênticos. Sem esta
  // linha, "ficou vermelho" não distingue uma comparação que discrimina de uma
  // que reprova tudo.
  const depois = compararEstruturas(
    bom,
    await retratoDaPasta(),
    "a pasta",
    "a pasta, desfeitas as quebras"
  );
  expect(depois, depois.join("\n")).toEqual([]);
});
