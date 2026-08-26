// A CONFERÊNCIA DE PARTIDA, PROVADA DOS DOIS LADOS.
//
// `lib/esquema.ts` é o que sobrou no lugar de `ensureSchema()`, e a diferença
// entre os dois é uma palavra: ele CONFERE, e não CRIA. Este arquivo prova as
// duas metades — que ela ACUSA quando o banco está atrás, e que ela **não
// conserta nada** quando acusa. Uma conferência que criasse a coluna de
// passagem seria `ensureSchema` com outro nome, e ninguém notaria pela mensagem.
//
// -----------------------------------------------------------------------------
// O CASO MAIS IMPORTANTE DESTE ARQUIVO NÃO É NENHUM DOS DOIS
//
// É "a marca d'água cobre a pasta inteira". `MARCA_DAGUA` (lib/esquema.ts) é
// escrita à mão, e lista à mão envelhece em silêncio — foi a crítica que
// `scripts/migrar.mjs` fez à lista dele, e vale aqui igual. A diferença é que
// aqui o envelhecimento é pego por máquina: **toda migração de `migrations/` tem
// de aparecer na estrutura, uma vez** — como base, como coluna, ou declarada
// NÃO OBSERVÁVEL com o motivo escrito. Acrescentar `006-*.sql` sem passar por
// `lib/esquema.ts` deixa este caso vermelho, nomeando o arquivo.
//
// A RÉGUA ÓBVIA FOI TENTADA E MEDIDA, E NÃO SERVE: comparar um schema montado só
// com `000` contra outro com a pasta inteira e exigir que a diferença fosse a
// lista. **A diferença é vazia** — `000` é a transcrição da lista `DDL` inteira,
// que já continha as duas colunas. Num banco novo, `001` e `002` não acrescentam
// nada; elas existem para o banco que já estava lá.
//
// Sem ele, a conferência de partida viraria com o tempo uma coisa que roda,
// custa uma consulta e não olha o que passou a importar — que é o formato do
// defeito que esta base já levou duas vezes (a contraprova da varredura que
// ficou muda; a guarda que perguntava `=== 0` onde devia perguntar `> 0`).
import { beforeAll, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { aplicarMigracoes, migracoesEmOrdem } from "./migracoes";

type ModuloEsquema = typeof import("@/lib/esquema");

const banco = bancoDescartavel();

let esquema: ModuloEsquema;

/** As colunas do schema que a conexão enxerga, como "tabela.coluna". */
async function colunasDe(
  consultar: (texto: string) => Promise<unknown[]>
): Promise<Set<string>> {
  const linhas = (await consultar(
    `select table_name || '.' || column_name as c from information_schema.columns
      where table_schema = current_schema()`
  )) as { c: string }[];
  return new Set(linhas.map((l) => l.c));
}

beforeAll(async () => {
  // O módulo é importado DEPOIS do harness, como todos os que tocam o banco: o
  // `sql()` de `lib/db` é singleton e nasce apontado para o que estiver na
  // DATABASE_URL na primeira chamada.
  esquema = (await import("@/lib/esquema")) as ModuloEsquema;
});

it("um banco montado só pelas migrações PASSA na conferência de partida", async () => {
  await expect(esquema.conferirEsquema()).resolves.toBeUndefined();
});

it("a MARCA D'ÁGUA cobre a pasta inteira: nenhuma migração passa sem ser decidida", async () => {
  const naPasta = migracoesEmOrdem().map((m) => m.nome);

  const conhecidas = new Map<string, string>();
  conhecidas.set(esquema.marcaDagua.base, "a base, que cria as tabelas");
  for (const c of esquema.marcaDagua.colunas) {
    conhecidas.set(c.de, `coluna ${c.tabela}.${c.coluna}`);
  }
  for (const n of esquema.marcaDagua.naoObservaveis) {
    conhecidas.set(n.de, `não observável: ${n.porque}`);
  }

  const semDecisao = naPasta.filter((n) => !conhecidas.has(n));
  expect(
    semDecisao,
    `\nmigração(ões) da pasta que a MARCA_DAGUA de lib/esquema.ts não conhece:\n` +
      semDecisao.map((n) => `  - ${n}`).join("\n") +
      "\n\nAcrescente a coluna que ela cria em `colunas`, ou declare-a em " +
      "`naoObservaveis` COM O MOTIVO.\n"
  ).toEqual([]);

  // E o inverso: nada na marca d'água pode apontar para arquivo que não existe
  // mais. Sem esta metade, apagar uma migração deixaria a lista falando de um
  // fantasma.
  const fantasmas = [...conhecidas.keys()].filter((n) => !naPasta.includes(n));
  expect(fantasmas, `a marca d'água cita arquivo que não existe: ${fantasmas.join(", ")}`).toEqual(
    []
  );

  // E as colunas e tabelas citadas EXISTEM de fato num schema montado pela
  // pasta: um erro de digitação na lista faria a conferência procurar por uma
  // coluna que nunca existiu e reprovar todo banco, sempre.
  const presentes = await colunasDe((t) => banco.db().sql().query(t));
  for (const c of esquema.marcaDagua.colunas) {
    expect(presentes.has(`${c.tabela}.${c.coluna}`), `${c.tabela}.${c.coluna}`).toBe(true);
  }
  const tabelas = new Set([...presentes].map((c) => c.split(".")[0]));
  for (const t of esquema.marcaDagua.tabelas) {
    expect(tabelas.has(t), `tabela ${t}`).toBe(true);
  }
});

it("uma COLUNA que falta deixa a conferência vermelha — e ela NÃO cria a coluna de volta", async () => {
  const sql = banco.db().sql();
  await sql.query(`alter table automations drop column ligacoes`);

  await expect(esquema.conferirEsquema()).rejects.toThrow(
    /ESQUEMA DESATUALIZADO[\s\S]*automations\.ligacoes[\s\S]*001-ligacoes\.sql/
  );

  // A METADE QUE SEPARA ISTO DE `ensureSchema`: depois de acusar, a coluna
  // continua ausente. Uma conferência que a criasse de passagem passaria neste
  // arquivo inteiro sem ninguém notar.
  const depois = (await sql.query(
    `select column_name from information_schema.columns
      where table_schema = current_schema() and table_name = 'automations'
        and column_name = 'ligacoes'`
  )) as unknown[];
  expect(depois, "a conferência CRIOU a coluna — ela virou ensureSchema").toHaveLength(0);

  // E a segunda chamada continua vermelha, e não fica presa em memória de erro.
  await expect(esquema.conferirEsquema()).rejects.toThrow(/automations\.ligacoes/);

  // Restaura pela própria pasta, que é idempotente.
  await aplicarMigracoes((texto) => sql.query(texto));
  await expect(esquema.conferirEsquema()).resolves.toBeUndefined();
});

it("uma TABELA que falta deixa a conferência vermelha, e a mensagem nomeia a tabela", async () => {
  const sql = banco.db().sql();
  await sql.query(`drop table login_attempts`);

  await expect(esquema.conferirEsquema()).rejects.toThrow(
    /ESQUEMA DESATUALIZADO[\s\S]*tabela ausente: login_attempts/
  );

  await aplicarMigracoes((texto) => sql.query(texto));
  await expect(esquema.conferirEsquema()).resolves.toBeUndefined();
});

it("um schema VAZIO tem mensagem própria: não é migração esquecida, é nenhuma", async () => {
  const sql = banco.db().sql();
  for (const t of esquema.marcaDagua.tabelas) {
    await sql.query(`drop table if exists ${t} cascade`);
  }

  await expect(esquema.conferirEsquema()).rejects.toThrow(
    /ESQUEMA AUSENTE[\s\S]*não tem tabela nenhuma/
  );

  await aplicarMigracoes((texto) => sql.query(texto));
  await expect(esquema.conferirEsquema()).resolves.toBeUndefined();
});

it("`exigirEsquema` é memoizada: a segunda chamada não vai ao banco", async () => {
  const sql = banco.db().sql();

  // A primeira passa, e é ela que fica guardada.
  await expect(esquema.exigirEsquema()).resolves.toBeUndefined();

  // Quebra o banco POR BAIXO da memória. Se a segunda chamada fosse ao banco,
  // ela veria a coluna faltando e ficaria vermelha.
  await sql.query(`alter table automations drop column ligacoes`);
  await expect(esquema.exigirEsquema()).resolves.toBeUndefined();

  // E a conferência SEM memória vê a mesma quebra — que é o que separa
  // "memoizou" de "não olha nada".
  await expect(esquema.conferirEsquema()).rejects.toThrow(/automations\.ligacoes/);

  await aplicarMigracoes((texto) => sql.query(texto));
});
