import "server-only";
import { sql } from "./db";

// A CONFERÊNCIA DE PARTIDA — ela CONFERE, e nunca CRIA.
//
// Até 26/08 existia aqui ao lado um `ensureSchema()` que criava o que faltasse.
// Ele foi apagado, e este arquivo NÃO é ele com outro nome: a diferença inteira
// é essa palavra. Nenhuma linha deste arquivo emite DDL. Se o banco estiver
// atrás das migrações, ele RECUSA SERVIR, com uma mensagem que diz o que falta.
//
// -----------------------------------------------------------------------------
// POR QUE ELA PRECISA EXISTIR — o número que decidiu
//
// A pergunta foi medida, contra este mesmo Postgres, num schema descartável:
// **o que a aplicação faz se uma coluna não existir?**
//
//   COM `automations.ligacoes`: uma automação de três blocos enfileira TRÊS
//     mensagens, na ordem do grafo.
//   SEM a coluna: enfileira UMA. `ignorados = 0`. Nenhum erro, em lugar nenhum.
//
// A chave nem chega na linha — `select *` devolve o objeto sem ela, e
// `interpretar` (lib/steps.ts) lê `undefined` e decide diferente. É o mesmo
// formato do precedente da `003`, registrado no roteiro de implantação: a coluna
// faltando virava `undefined`, o webhook aceitava normalmente, ninguém recebia
// nada e nada acusava.
//
// Enquanto `ensureSchema` existia, esse caso não existia: a primeira requisição
// criava a coluna. Hoje o buraco é real, e ele tem um caminho novo e concreto —
// **um deploy de PREVIEW roda o código novo contra o banco que a migração não
// tocou** (a trava de produção pula em preview, de propósito). Sem esta
// conferência, alguém testaria a branch, veria "funcionando", e mergiaria.
//
// -----------------------------------------------------------------------------
// O QUE ELA OLHA, E O QUE ELA **NÃO** OLHA — escrito para não ser descoberto tarde
//
// Ela olha PRESENÇA de tabela e de coluna, e só. Não olha tipo, nulidade,
// padrão, regra de chave estrangeira, `check` nem chave primária.
//
// **Isso não é preguiça: é a divisão entre o que falha alto e o que falha
// calado**, e as duas metades foram medidas:
//
//   | o que está errado no banco | como aparece hoje |
//   |---|---|
//   | coluna ausente, lida por `select *` | **CALADO** — `undefined`, decisão diferente, zero erro |
//   | coluna ausente, nomeada num `select` | ALTO — `42703 column does not exist` |
//   | tabela ausente | ALTO — `42P01 relation does not exist` |
//   | `check` com a forma errada (ex.: `queue_kind_check` com 5 tipos) | ALTO — o `insert` é recusado |
//   | chave primária com a forma errada | ALTO — o `on conflict` estoura |
//
// A única linha CALADA da tabela é a primeira, e é exatamente a que esta
// conferência cobre. As outras já falham alto sozinhas, e duplicá-las aqui
// custaria mais consultas para comprar o que o banco já dá de graça.
//
// QUEM OLHA O RESTO é `scripts/migrar.mjs`, DEPOIS de aplicar: ele afere tipo,
// nulidade, padrão, regra de exclusão de chave estrangeira, `check` e chave
// primária, e sai 1 se qualquer um divergir — o que derruba o `next build` e o
// deploy junto. A conferência daqui é a segunda linha de defesa, para o banco
// que muda DEPOIS do build (ou para o preview, que não migra).
//
// -----------------------------------------------------------------------------
// A LISTA NÃO PODE ENVELHECER EM SILÊNCIO, E ISSO É ASSERÇÃO E NÃO PROMESSA
//
// `MARCA_DAGUA` é escrita à mão, e lista à mão envelhece — foi a crítica que
// `scripts/migrar.mjs` fez à própria lista dele, e ela vale aqui igual. A
// diferença é que aqui o envelhecimento é MECANICAMENTE PEGO:
// **toda migração da pasta tem de aparecer nesta estrutura, uma vez.** Ou ela
// criou tabela (e cai em `tabelas`), ou criou coluna (e cai em `colunas`), ou
// não é observável por presença — e aí precisa estar em `naoObservaveis`, COM O
// MOTIVO ESCRITO. `testes-integracao/esquema-de-partida.integracao.ts` lê a
// pasta e exige essa cobertura: acrescentar `006-*.sql` sem passar por aqui
// deixa aquele caso vermelho, nomeando o arquivo.
//
// A ALTERNATIVA ÓBVIA FOI TENTADA E MEDIDA, E ELA NÃO FUNCIONA: comparar um
// schema montado só com `000` contra outro montado com a pasta inteira, e exigir
// que a diferença fosse esta lista. A diferença é **VAZIA** — `000` é a
// transcrição da lista `DDL` inteira, que já continha `ligacoes` e
// `entrega_sem_portao`. Num banco NOVO as migrações posteriores não acrescentam
// nada; elas existem para o banco que já estava lá. A régua tinha de ser a
// PASTA, e não a diferença entre dois bancos novos.
const MARCA_DAGUA = {
  // As oito tabelas do esquema base (`migrations/000-esquema-base.sql`).
  tabelas: [
    "accounts",
    "automations",
    "config",
    "contacts",
    "events",
    "followups",
    "login_attempts",
    "queue",
  ],
  // As colunas que as migrações DEPOIS de `000` instalam. Num banco novo elas já
  // vêm da `000`, que é a transcrição da lista `DDL` inteira; num banco que já
  // existia — que é o caso de produção — são exatamente estas que podem faltar,
  // e são as duas que o motor lê por `select *`.
  colunas: [
    { tabela: "automations", coluna: "ligacoes", de: "001-ligacoes.sql" },
    { tabela: "automations", coluna: "entrega_sem_portao", de: "002-entrega-sem-portao.sql" },
  ],
  // AS MIGRAÇÕES QUE ESTA CONFERÊNCIA NÃO CONSEGUE VER, com o motivo. Elas não
  // criam tabela nem coluna: mudam a DEFINIÇÃO de uma restrição que já existe, e
  // presença não distingue a definição velha da nova. As três estão do lado ALTO
  // da tabela acima — o banco recusa a escrita errada sozinho —, e é por isso que
  // ficar cega para elas é aceitável. **Estar escrito aqui é o que impede que
  // isso seja descoberto tarde**, e é o que faz a próxima migração de definição
  // ter de passar por esta decisão.
  naoObservaveis: [
    {
      de: "003-fila-sobrevive-a-automacao.sql",
      porque: "muda a REGRA DE EXCLUSÃO de uma chave estrangeira que já existe",
    },
    {
      de: "004-fila-tipos-novos.sql",
      porque: "reescreve a definição de um `check` que já existe (5 tipos -> 9)",
    },
    {
      de: "005-contatos-chave-composta.sql",
      porque: "troca as colunas da CHAVE PRIMÁRIA, que já existe",
    },
  ],
  // A migração que cria as oito tabelas de `tabelas`, acima.
  base: "000-esquema-base.sql",
} as const;

export const marcaDagua = MARCA_DAGUA;

/** O que falta no banco, em linguagem de gente. Lista vazia = está tudo lá. */
export function faltando(
  presentes: { table_name: string; column_name: string }[]
): string[] {
  const tabelas = new Set(presentes.map((p) => p.table_name));
  const colunas = new Set(presentes.map((p) => `${p.table_name}.${p.column_name}`));

  const falta: string[] = [];
  for (const t of MARCA_DAGUA.tabelas) {
    if (!tabelas.has(t)) falta.push(`tabela ausente: ${t} (migrations/000-esquema-base.sql)`);
  }
  for (const c of MARCA_DAGUA.colunas) {
    // Tabela que já faltou inteira não gera uma segunda queixa pela coluna: a
    // lista é para ser lida por quem vai consertar, e repetir a mesma causa em
    // duas linhas atrapalha.
    if (!tabelas.has(c.tabela)) continue;
    if (!colunas.has(`${c.tabela}.${c.coluna}`)) {
      falta.push(`coluna ausente: ${c.tabela}.${c.coluna} (migrations/${c.de})`);
    }
  }
  return falta;
}

/**
 * UMA ida ao banco. Medido contra este Postgres: 19 a 23 ms, devolvendo as 99
 * colunas do schema. Para comparar, o `ensureSchema()` que morava aqui ao lado
 * custava 49 idas e 1398 ms a frio, 26 delas pedindo trava exclusiva de tabela.
 *
 * `current_schema()` e não `'public'`: é o que faz esta conferência funcionar
 * dentro do schema descartável dos testes de integração, que é onde ela é
 * provada.
 */
export async function conferirEsquema(): Promise<void> {
  const presentes = (await sql().query(
    `select table_name, column_name from information_schema.columns
      where table_schema = current_schema()`
  )) as { table_name: string; column_name: string }[];

  // ZERO COLUNAS É UM CASO À PARTE, e ele precisa de nome próprio: um schema
  // vazio faria a lista de faltas ter 8 tabelas e nenhuma explicação. Quem cai
  // aqui não esqueceu uma migração — não rodou nenhuma.
  if (presentes.length === 0) {
    throw new Error(
      "ESQUEMA AUSENTE: o banco não tem tabela nenhuma neste schema.\n" +
        "  Rode as migrações antes de subir: `node scripts/migrar.mjs --aplicar --a-mao`.\n" +
        "  Desde 26/08 a aplicação NÃO cria mais o esquema sozinha (o `ensureSchema`\n" +
        "  foi apagado): quem o cria é `migrations/`, e só ela."
    );
  }

  const falta = faltando(presentes);
  if (falta.length) {
    throw new Error(
      "ESQUEMA DESATUALIZADO: o banco está atrás das migrações, e servir assim\n" +
        "seria pior do que não servir — uma coluna que falta é lida como\n" +
        "`undefined` por `select *`, e o motor decide diferente SEM ERRO NENHUM.\n" +
        "  Falta:\n" +
        falta.map((f) => `    - ${f}`).join("\n") +
        "\n  Conserto: `node scripts/migrar.mjs --aplicar --a-mao` (ou um deploy de\n" +
        "  produção, que roda a migração dentro do build)."
    );
  }
}

let conferido: Promise<void> | null = null;

/**
 * A conferência, uma vez por instância.
 *
 * Memoizada como o `ensureSchema` era, e pelo mesmo motivo: em serverless cada
 * instância atende muitas requisições, e pagar a ida ao banco em todas seria
 * desperdício. **E o esquecimento no erro também é o mesmo, de propósito**: uma
 * falha zera a memória, para que a próxima tentativa refaça a pergunta. Banco
 * fora do ar por um instante não pode envenenar a instância inteira; e um
 * esquema de fato desatualizado simplesmente falha de novo, ao custo de uma
 * consulta.
 */
export function exigirEsquema(): Promise<void> {
  if (!conferido) {
    conferido = conferirEsquema().catch((err) => {
      conferido = null;
      throw err;
    });
  }
  return conferido;
}
