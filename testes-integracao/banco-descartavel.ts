// A FUNDAÇÃO DA FRENTE 2, parte de baixo: o banco descartável em si.
//
// Este arquivo NÃO importa o vitest — de propósito. É o que permite que a
// rede-global.ts, que roda no processo principal e não dentro de um teste,
// reuse a MESMA trava de prefixo e a MESMA conexão em vez de copiá-las. Os
// ganchos de teste vivem no harness.ts, ao lado.
//
// O que ela faz, em uma frase: cria um schema temporário no MESMO Postgres de
// produção, monta a estrutura inteira dentro dele com o `ensureSchema()` de
// verdade, entrega o `lib/db` já apontado para lá, e derruba o schema no fim —
// inclusive quando o teste explode.
//
// -----------------------------------------------------------------------------
// COMO O SCHEMA TEMPORÁRIO É ALCANÇADO — e por que não muda uma linha de lib/db
//
// O `search_path` viaja como PARÂMETRO DE QUERY da própria DATABASE_URL:
//
//     postgresql://…/postgres?search_path=teste_tmp_ab12cd34
//
// Quatro peças sustentam isso, e as quatro foram medidas contra este banco:
//
//   1. `limparUrl` (lib/db.ts:53) remove só `channel_binding` e `pgbouncer` — o
//      parâmetro novo sobrevive à ida e volta pelo `new URL(...).toString()`
//   2. o `parseOptions` do postgres.js joga todo parâmetro desconhecido em
//      `connection`, o que o torna PARÂMETRO DE STARTUP, e não um `set`
//   3. o Supavisor, em modo transação, deixa passar
//   4. o pool `max: 3` não é armadilha: parâmetro de startup vale para TODAS as
//      conexões do pool, não para uma. Medido: 6 consultas simultâneas, 3 PIDs
//      distintos, as 6 no schema temporário
//
// -----------------------------------------------------------------------------
// A ARMADILHA QUE ESTA FUNDAÇÃO EXISTE PARA IMPEDIR
//
// O reflexo de quem escreve isto é pôr `public` de reserva no caminho:
//
//     search_path=<temporário>,public      <- VENENO
//
// Medido, num schema temporário vazio:
//
//     [só o temporário]     select count(*) from contacts  ->  ERRO 42P01
//     [temporário + public] select count(*) from contacts  ->  93, DA PRODUÇÃO
//
// E o detalhe que torna isso venenoso: com `public` na cauda, `current_schema()`
// MENTE — devolve o nome do schema temporário enquanto a consulta lê os contatos
// reais. Um teste escrito assim PASSA, lendo produção, e ninguém desconfia.
//
// Por isso o caminho é o schema temporário SOZINHO, e por isso há duas travas em
// vez de uma linha de código: `exigirPrefixo` recusa qualquer nome com vírgula
// (não dá para escrever a cauda), e `conferirCaminho` pergunta ao próprio banco
// quantos schemas o caminho tem, ANTES de a estrutura nascer.
//
// -----------------------------------------------------------------------------
// AS TRAVAS
//
//   1. só nasce e só morre schema cujo nome case `teste_tmp_[a-z0-9_]{1,40}`
//   2. o `search_path` é o schema temporário sozinho, conferido no banco
//   3. o `drop` roda em `afterAll`, que o vitest executa mesmo com teste falho —
//      e a `rede-global.ts` recolhe o que sobrar, com a mesma trava de prefixo
//   4. nada aqui escreve fora do schema temporário: a conexão administrativa (a
//      que cria e derruba o schema, e a que tira o inventário) só faz `select`
//      sobre `public`. Não existe função de escrita nesta fundação
//   5. do `.env.local` é lida SÓ a linha da DATABASE_URL, por regex. Nenhuma
//      outra chave entra neste processo
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

// ---------- Trava 1: o nome ----------

export const PREFIXO_OBRIGATORIO = "teste_tmp_";

// Sem vírgula, sem espaço, sem aspas, sem maiúscula. É esta expressão que torna
// `teste_tmp_x,public` impossível de escrever — a cauda do caminho teria de
// passar pelo mesmo portão por onde passa o nome, e não passa.
const NOME_ACEITO = /^teste_tmp_[a-z0-9_]{1,40}$/;

export function exigirPrefixo(nome: string, ondeEstou: string): string {
  if (typeof nome !== "string" || !NOME_ACEITO.test(nome)) {
    throw new Error(
      `RECUSADO em ${ondeEstou}: "${nome}" não casa com ${NOME_ACEITO}. ` +
        `Os testes de integração só operam em schema com prefixo ${PREFIXO_OBRIGATORIO}.`
    );
  }
  return nome;
}

export function novoNomeDeSchema(): string {
  return exigirPrefixo(
    PREFIXO_OBRIGATORIO + randomBytes(4).toString("hex"),
    "novoNomeDeSchema"
  );
}

// ---------- A URL ----------

// Do `.env.local` sai UMA linha e nada mais. A ADMIN_PASSWORD nunca é lida,
// impressa nem usada — e não é lida porque não é procurada.
export function urlDoBanco(): string {
  const doAmbiente = process.env.DATABASE_URL;
  if (doAmbiente) return doAmbiente;
  const texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const achado = texto.match(/^DATABASE_URL=(.+)$/m);
  if (!achado) {
    throw new Error("DATABASE_URL não encontrada: nem no ambiente, nem no .env.local.");
  }
  return achado[1].trim().replace(/^["']|["']$/g, "");
}

// A conexão administrativa NÃO leva `search_path`: ela vive no `public` para
// poder criar e derrubar o schema temporário e tirar o inventário. É por isso
// que ela é interna, e por isso que o único verbo que ela oferece é `select`.
function urlSemSchema(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("search_path");
  return u.toString();
}

export function urlComSchema(url: string, schema: string): string {
  const u = new URL(url);
  // Passa pelo portão do nome: uma cauda `,public` morre aqui.
  u.searchParams.set("search_path", exigirPrefixo(schema, "urlComSchema"));
  return u.toString();
}

// ---------- A conexão administrativa ----------

let _admin: postgres.Sql | null = null;

function admin(): postgres.Sql {
  if (!_admin) {
    _admin = postgres(urlSemSchema(urlDoBanco()), {
      prepare: false,
      ssl: "require",
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      onnotice: () => {},
    });
  }
  return _admin;
}

export async function fecharAdmin(): Promise<void> {
  if (_admin) {
    const c = _admin;
    _admin = null;
    await c.end({ timeout: 5 });
  }
}

// ---------- Trava 2: o caminho tem UM schema só ----------

// Pergunta ao banco, e não ao que escrevemos: `current_schemas(false)` devolve o
// caminho de busca já resolvido, sem os schemas implícitos. Se ele tiver mais de
// um nome, ou um nome diferente, a fundação para ANTES de montar coisa alguma.
export async function conferirCaminho(
  consultar: (texto: string) => Promise<unknown[]>,
  esperado: string
): Promise<void> {
  const linhas = (await consultar("select current_schemas(false) as caminho")) as {
    caminho: string[];
  }[];
  const caminho = linhas[0]?.caminho ?? [];
  if (caminho.length !== 1 || caminho[0] !== esperado) {
    throw new Error(
      `RECUSADO: o search_path resolvido é [${caminho.join(", ")}], e tinha de ser ` +
        `[${esperado}] sozinho. Com "public" na cauda, o que faltar no schema ` +
        `temporário é lido da PRODUÇÃO em silêncio.`
    );
  }
}

// ---------- O inventário de um schema, e por que ele julga a IDENTIDADE ----------

// SÓ LEITURA. Não existe aqui nenhum insert, update ou delete sobre `public`.
//
// -----------------------------------------------------------------------------
// O QUE MEDIMOS, E POR QUE A REGRA ANTIGA PISCAVA
//
// A regra antiga comparava `sum(hashtext(linha::text))` da linha INTEIRA das
// linhas anteriores ao corte, e reprovava a qualquer diferença. O corte tolera
// linha NOVA; não tolera ESCRITA em linha velha. E produção escreve em linha
// velha o tempo todo — medido em `pg_stat_user_tables` neste banco, em 32 dias
// (estatísticas desde 2026-07-24):
//
//     tabela          inserções   ATUALIZAÇÕES   deleções
//     contacts             134         1432          33
//     queue                144          278          49
//     automations           21          120          11
//     accounts               5           59           1
//     config                 2            9           1
//     followups             15            4          15
//     events              6395            1         572
//     login_attempts         2            0           2
//
// `contacts` é atualizada DEZ VEZES para cada linha que nasce: todo webhook de
// DM passa pelo `upsertContact` (lib/engine.ts:296), que reescreve `username`,
// `name`, `profile_pic`, `last_reply_at` e `last_automation_id` de um contato
// que já existia. O dreno faz o mesmo com `queue` (lib/queue-drain.ts:82:
// `status`, `sent_at`, `not_before`, `error`, `message_id`, `payload`). Nenhuma
// dessas escritas é do teste, e todas mudavam a digital da linha inteira.
//
// -----------------------------------------------------------------------------
// A FORMA ESCOLHIDA: PRESENÇA E IDENTIDADE, NÃO CONTEÚDO
//
// O que a comparação julga agora, por tabela e ancorado no mesmo corte:
//
//   1. a ESTRUTURA — tabelas e colunas do schema, em força total
//   2. a CONTAGEM das linhas anteriores ao corte — se caiu, uma linha velha foi
//      apagada; se subiu, apareceu linha com carimbo velho
//   3. a IDENTIDADE dessas linhas — `sum(hashtext(row(<chave>)::text))`, onde
//      <chave> é a CHAVE PRIMÁRIA perguntada ao banco (`pg_index`) mais a coluna
//      do corte. Se uma linha velha virou outra linha, isto muda
//
// A identidade é perguntada ao catálogo, e não escrita numa lista à mão. É de
// propósito: uma lista de "colunas que a produção não reescreve" envelheceria em
// silêncio, e o dia em que uma funcionalidade nova passasse a escrever numa
// delas o teste voltaria a piscar — que é exatamente o defeito que estamos
// consertando. Chave primária e carimbo de nascimento não são reescritos por
// definição: são o NOME da linha, e não o conteúdo dela.
//
// Tabela SEM chave primária (hoje: `login_attempts`) cai no caso mais estrito, e
// não no mais frouxo: a identidade dela é a LINHA INTEIRA.
//
// -----------------------------------------------------------------------------
// O PREÇO — o que esta verificação DEIXA DE PEGAR
//
// Ela deixa de pegar UMA COISA, e é grande: **escrita que muda só o conteúdo de
// uma linha que já existia, sem mexer na chave nem no carimbo.** Se um teste
// escapasse para `public` e virasse `automations.active`, sobrescrevesse
// `accounts.access_token` ou trocasse `contacts.email` de uma linha real, esta
// comparação ficaria VERDE.
//
// Não é descuido: é que a produção faz exatamente isso, milhares de vezes, e
// nenhuma leitura de fora consegue separar a escrita do teste da escrita do
// mundo. Um instrumento que reprovasse as duas seria ignorado em duas semanas, e
// aí não sobraria instrumento nenhum.
//
// O que continua fechando aquela porta não é esta comparação, são as travas de
// cima, que agem ANTES de a escrita acontecer: `exigirPrefixo` recusa a cauda
// `,public` no nome; `conferirCaminho` pergunta ao banco quantos schemas o
// caminho tem antes de a estrutura nascer; e `fundacao.integracao.ts` confere
// que `contacts` do schema temporário tem ZERO linhas enquanto a produção tem
// mais de zero. Para uma escrita do teste cair em `public`, as três teriam de
// falhar juntas.
//
// O que este preço NÃO inclui, e está provado em `digital.integracao.ts` dentro
// de um schema descartável: linha apagada, linha cuja chave mudou, tabela que
// sumiu e coluna que sumiu continuam ficando VERMELHAS.
//
// A coluna do corte é descoberta por tabela, e não fixada numa lista: tabela nova
// entra no inventário sozinha — e uma tabela que o teste criasse em `public` por
// engano apareceria como diferença.
const COLUNAS_DE_CORTE = ["created_at", "first_contact_at", "attempted_at"];

// O inventário LÊ, e só lê. Ainda assim o nome do schema passa por um portão:
// `public` (o alvo da conferência) ou um `teste_tmp_*` (onde as simulações de
// perda acontecem). Nome montado de outro jeito não chega ao `unsafe`.
const SCHEMA_LEGIVEL = /^(public|teste_tmp_[a-z0-9_]{1,40})$/;

function exigirSchemaLegivel(nome: string): string {
  if (typeof nome !== "string" || !SCHEMA_LEGIVEL.test(nome)) {
    throw new Error(
      `RECUSADO em inventarioDoSchema: "${nome}" não é "public" nem casa com ` +
        `${PREFIXO_OBRIGATORIO}[a-z0-9_]{1,40}.`
    );
  }
  return nome;
}

export type RetratoDeTabela = {
  /** Linhas anteriores ao corte. */
  n: number;
  /** Digital da LINHA INTEIRA, das linhas até o corte. Diagnóstico, não juiz. */
  digital: string;
  /** Digital só das colunas de identidade. É esta que reprova. */
  identidade: string;
  /** Quais colunas formam a identidade desta tabela. */
  chave: string[];
  /** Contagem crua, sem corte. Diagnóstico. */
  total: number;
  colunas: Record<string, string>;
};

export type InventarioPublic = {
  momento: string;
  corte: string;
  schema: string;
  tabelas: string[];
  colunas: string[];
  linhas: Record<string, RetratoDeTabela>;
};

/**
 * O veredito da comparação, em duas listas que NÃO valem o mesmo:
 *
 * - `perdas` reprova o teste: dado que sumiu, ou linha velha que virou outra
 * - `vida` só é impressa: é a produção mexendo no que é dela
 *
 * A separação existe para que o vermelho volte a significar uma coisa só.
 */
export type Veredito = {
  perdas: string[];
  vida: string[];
};

export async function corteDoBanco(): Promise<string> {
  // O relógio do BANCO, e não o do processo: as linhas são carimbadas com
  // `now()` do servidor, e um corte tirado deste lado poderia cair do lado
  // errado de uma linha que a produção acabou de gravar.
  const linhas = (await admin().unsafe("select now() as agora")) as unknown as {
    agora: Date;
  }[];
  return linhas[0].agora.toISOString();
}

// A chave primária vem do catálogo, na ORDEM em que foi declarada. Tabela sem
// chave primária simplesmente não aparece aqui, e o inventário trata esse caso
// pelo lado estrito.
async function chavesPrimarias(schema: string): Promise<Record<string, string[]>> {
  const linhas = (await admin().unsafe(
    `select c.relname as tabela, a.attname as coluna
       from pg_index i
       join pg_class c on c.oid = i.indrelid
       join pg_namespace ns on ns.oid = c.relnamespace
       cross join lateral unnest(i.indkey) with ordinality as k(attnum, ord)
       join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where i.indisprimary and ns.nspname = $1
      order by c.relname, k.ord`,
    [schema]
  )) as unknown as { tabela: string; coluna: string }[];
  const porTabela: Record<string, string[]> = {};
  for (const r of linhas) (porTabela[r.tabela] ??= []).push(r.coluna);
  return porTabela;
}

export async function inventarioDoSchema(
  schema: string,
  corte: string
): Promise<InventarioPublic> {
  const alvo = exigirSchemaLegivel(schema);
  const s = admin();

  const tabelas = (
    (await s.unsafe(
      `select table_name from information_schema.tables
        where table_schema = $1 and table_type = 'BASE TABLE'
        order by table_name`,
      [alvo]
    )) as unknown as { table_name: string }[]
  ).map((r) => r.table_name);

  const colunasCruas = (await s.unsafe(
    `select table_name, column_name, data_type from information_schema.columns
      where table_schema = $1 order by table_name, column_name`,
    [alvo]
  )) as unknown as { table_name: string; column_name: string; data_type: string }[];

  const colunas = colunasCruas.map(
    (r) => `${r.table_name}.${r.column_name}:${r.data_type}`
  );

  const pks = await chavesPrimarias(alvo);

  const linhas: Record<string, RetratoDeTabela> = {};
  for (const t of tabelas) {
    const daTabela = colunasCruas.filter((c) => c.table_name === t).map((c) => c.column_name);
    const colunaDoCorte = COLUNAS_DE_CORTE.find((c) => daTabela.includes(c));
    const onde = colunaDoCorte ? `where x."${colunaDoCorte}" <= $1::timestamptz` : "";

    // A identidade: chave primária + carimbo de nascimento. Sem chave primária,
    // a identidade é a linha inteira — o lado estrito, e não o frouxo.
    const daChave = (pks[t] ?? []).filter((c) => daTabela.includes(c));
    const chave = daChave.length
      ? [
          ...daChave,
          ...(colunaDoCorte && !daChave.includes(colunaDoCorte) ? [colunaDoCorte] : []),
        ]
      : [];
    const alvoDaIdentidade = chave.length
      ? `row(${chave.map((c) => `x."${c}"`).join(", ")})::text`
      : `x::text`;

    // Uma digital por coluna, além da digital da linha. Ela não julga nada:
    // serve para que uma divergência diga QUAL coluna se mexeu, que é a
    // diferença entre "o teste estragou produção" e "a produção está viva".
    const porColuna = daTabela
      .map(
        (c) =>
          `coalesce(sum(hashtext(coalesce(x."${c}"::text,'<nulo>'))::bigint),0)::text as "c_${c}"`
      )
      .join(", ");

    const r = (
      (await s.unsafe(
        `select count(*)::int as n,
                coalesce(sum(hashtext(x::text)::bigint),0)::text as digital,
                coalesce(sum(hashtext(${alvoDaIdentidade})::bigint),0)::text as identidade
                ${porColuna ? ", " + porColuna : ""}
           from "${alvo}"."${t}" x ${onde}`,
        colunaDoCorte ? [corte] : []
      )) as unknown as Record<string, unknown>[]
    )[0];

    const total = (
      (await s.unsafe(`select count(*)::int as n from "${alvo}"."${t}"`)) as unknown as {
        n: number;
      }[]
    )[0].n;

    const digitaisPorColuna: Record<string, string> = {};
    for (const c of daTabela) digitaisPorColuna[c] = String(r[`c_${c}`]);

    linhas[t] = {
      n: Number(r.n),
      digital: String(r.digital),
      identidade: String(r.identidade),
      chave: chave.length ? chave : ["<linha inteira: tabela sem chave primária>"],
      total,
      colunas: digitaisPorColuna,
    };
  }

  return {
    momento: new Date().toISOString(),
    corte,
    schema: alvo,
    tabelas,
    colunas,
    linhas,
  };
}

export async function inventarioDoPublic(corte: string): Promise<InventarioPublic> {
  return inventarioDoSchema("public", corte);
}

/**
 * Compara dois retratos do MESMO schema, tirados com o MESMO corte.
 *
 * `perdas` vazio = nenhum dado anterior ao corte sumiu nem virou outro, e a
 * estrutura é a mesma. Leia o PREÇO no cabeçalho antes de ler isso como mais do
 * que é: conteúdo de linha velha não entra na conta.
 */
export function compararInventarios(
  antes: InventarioPublic,
  depois: InventarioPublic
): Veredito {
  const perdas: string[] = [];
  const vida: string[] = [];

  const faltando = antes.tabelas.filter((t) => !depois.tabelas.includes(t));
  const sobrando = depois.tabelas.filter((t) => !antes.tabelas.includes(t));
  if (faltando.length) {
    perdas.push(`tabelas que sumiram de ${antes.schema}: ${faltando.join(", ")}`);
  }
  if (sobrando.length) {
    perdas.push(`tabelas que NASCERAM em ${antes.schema}: ${sobrando.join(", ")}`);
  }

  const colFaltando = antes.colunas.filter((c) => !depois.colunas.includes(c));
  const colSobrando = depois.colunas.filter((c) => !antes.colunas.includes(c));
  if (colFaltando.length) {
    perdas.push(`colunas que sumiram de ${antes.schema}: ${colFaltando.join(", ")}`);
  }
  if (colSobrando.length) {
    perdas.push(`colunas que NASCERAM em ${antes.schema}: ${colSobrando.join(", ")}`);
  }

  for (const t of antes.tabelas) {
    const a = antes.linhas[t];
    const d = depois.linhas[t];
    if (!d) continue;

    if (d.n < a.n) {
      perdas.push(
        `${antes.schema}.${t}: linhas até o corte CAÍRAM de ${a.n} para ${d.n} — ` +
          `linha anterior ao corte foi apagada`
      );
    } else if (d.n > a.n) {
      // Sobe se uma linha com carimbo anterior ao corte aparecer só depois — a
      // corrida entre o `now()` do corte e o commit de quem inseriu. Fica como
      // PERDA, e não como vida, porque acusar demais é o lado certo de errar.
      perdas.push(
        `${antes.schema}.${t}: linhas até o corte SUBIRAM de ${a.n} para ${d.n} — ` +
          `apareceu linha com carimbo anterior ao corte`
      );
    }

    if (a.identidade !== d.identidade) {
      perdas.push(
        `${antes.schema}.${t}: a IDENTIDADE das linhas até o corte mudou ` +
          `(${a.identidade} -> ${d.identidade}); a identidade desta tabela é ` +
          `[${a.chave.join(", ")}] — uma linha velha virou outra linha`
      );
    } else if (a.digital !== d.digital) {
      const mexidas = Object.keys(a.colunas).filter((c) => a.colunas[c] !== d.colunas[c]);
      vida.push(
        `${antes.schema}.${t}: conteúdo de linha anterior ao corte mudou, com a ` +
          `identidade [${a.chave.join(", ")}] intacta; colunas: ` +
          (mexidas.length ? mexidas.join(", ") : "nenhuma isolada — a linha inteira mudou")
      );
    }

    if (d.total !== a.total) {
      vida.push(`${antes.schema}.${t}: total de linhas ${a.total} -> ${d.total} (linha nova)`);
    }
  }

  return { perdas, vida };
}

export async function schemasTemporariosRestantes(): Promise<string[]> {
  const linhas = (await admin().unsafe(
    `select nspname from pg_namespace where nspname like '${PREFIXO_OBRIGATORIO}%' order by 1`
  )) as unknown as { nspname: string }[];
  return linhas.map((r) => r.nspname);
}

// ---------- Criar e destruir ----------

export async function criarSchema(nome: string): Promise<void> {
  exigirPrefixo(nome, "criarSchema");
  await admin().unsafe(`create schema "${nome}"`);
}

// Trava 1 de novo, na linha IMEDIATAMENTE anterior ao drop. A repetição é de
// propósito: quem lê o `drop` vê a guarda sem precisar procurá-la.
export async function destruirSchema(nome: string): Promise<void> {
  exigirPrefixo(nome, "destruirSchema");
  await admin().unsafe(`drop schema if exists "${nome}" cascade`);
}
