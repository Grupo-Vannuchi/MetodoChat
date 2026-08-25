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

// ---------- O inventário de `public`, e por que ele tem um corte ----------

// SÓ LEITURA. Não existe aqui nenhum insert, update ou delete sobre `public`.
//
// A "digital" é `sum(hashtext(linha::text))` da tabela: ela muda se QUALQUER
// linha for inserida, apagada ou alterada — e muda até se uma coluna nova
// aparecer, porque a representação textual da linha inteira entra na conta.
//
// POR QUE EXISTE UM CORTE, e ele não afrouxa nada: o banco está VIVO. A produção
// grava webhooks do Instagram em `public.events` enquanto o teste roda (medido
// em 24/08: ~6 linhas por minuto). Comparar a contagem crua acusaria divergência
// que não é do teste. O corte compara só as linhas que JÁ EXISTIAM quando o
// teste começou: elas têm de estar idênticas no fim, mesma quantidade e mesma
// digital. Se o teste tivesse escrito, apagado ou alterado qualquer linha antiga,
// a digital mudaria.
//
// A coluna do corte é descoberta por tabela, e não fixada numa lista: tabela nova
// em `public` entra no inventário sozinha — e uma tabela que o teste criasse em
// `public` por engano apareceria como diferença.
const COLUNAS_DE_CORTE = ["created_at", "first_contact_at", "attempted_at"];

export type RetratoDeTabela = {
  n: number;
  digital: string;
  total: number;
  colunas: Record<string, string>;
};

export type InventarioPublic = {
  momento: string;
  corte: string;
  tabelas: string[];
  colunas: string[];
  linhas: Record<string, RetratoDeTabela>;
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

export async function inventarioDoPublic(corte: string): Promise<InventarioPublic> {
  const s = admin();

  const tabelas = (
    (await s.unsafe(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`
    )) as unknown as { table_name: string }[]
  ).map((r) => r.table_name);

  const colunasCruas = (await s.unsafe(
    `select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'public' order by table_name, column_name`
  )) as unknown as { table_name: string; column_name: string; data_type: string }[];

  const colunas = colunasCruas.map(
    (r) => `${r.table_name}.${r.column_name}:${r.data_type}`
  );

  const linhas: Record<string, RetratoDeTabela> = {};
  for (const t of tabelas) {
    const daTabela = colunasCruas.filter((c) => c.table_name === t).map((c) => c.column_name);
    const colunaDoCorte = COLUNAS_DE_CORTE.find((c) => daTabela.includes(c));
    const onde = colunaDoCorte ? `where x."${colunaDoCorte}" <= $1::timestamptz` : "";

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
                coalesce(sum(hashtext(x::text)::bigint),0)::text as digital
                ${porColuna ? ", " + porColuna : ""}
           from public."${t}" x ${onde}`,
        colunaDoCorte ? [corte] : []
      )) as unknown as Record<string, unknown>[]
    )[0];

    const total = (
      (await s.unsafe(`select count(*)::int as n from public."${t}"`)) as unknown as {
        n: number;
      }[]
    )[0].n;

    const digitaisPorColuna: Record<string, string> = {};
    for (const c of daTabela) digitaisPorColuna[c] = String(r[`c_${c}`]);

    linhas[t] = {
      n: Number(r.n),
      digital: String(r.digital),
      total,
      colunas: digitaisPorColuna,
    };
  }

  return { momento: new Date().toISOString(), corte, tabelas, colunas, linhas };
}

// Devolve a lista de divergências. Vazia = `public` intacto.
export function compararInventarios(
  antes: InventarioPublic,
  depois: InventarioPublic
): string[] {
  const achados: string[] = [];

  const faltando = antes.tabelas.filter((t) => !depois.tabelas.includes(t));
  const sobrando = depois.tabelas.filter((t) => !antes.tabelas.includes(t));
  if (faltando.length) achados.push(`tabelas que sumiram de public: ${faltando.join(", ")}`);
  if (sobrando.length) achados.push(`tabelas que NASCERAM em public: ${sobrando.join(", ")}`);

  const colFaltando = antes.colunas.filter((c) => !depois.colunas.includes(c));
  const colSobrando = depois.colunas.filter((c) => !antes.colunas.includes(c));
  if (colFaltando.length) achados.push(`colunas que sumiram de public: ${colFaltando.join(", ")}`);
  if (colSobrando.length) achados.push(`colunas que NASCERAM em public: ${colSobrando.join(", ")}`);

  for (const t of antes.tabelas) {
    const a = antes.linhas[t];
    const d = depois.linhas[t];
    if (!d) continue;
    if (a.n !== d.n) {
      achados.push(`public.${t}: linhas até o corte mudaram de ${a.n} para ${d.n}`);
    }
    if (a.digital !== d.digital) {
      const mexidas = Object.keys(a.colunas).filter((c) => a.colunas[c] !== d.colunas[c]);
      achados.push(
        `public.${t}: a digital das linhas até o corte mudou ` +
          `(${a.digital} -> ${d.digital}); colunas que se mexeram: ` +
          (mexidas.length ? mexidas.join(", ") : "nenhuma isolada — a linha inteira mudou")
      );
    }
  }

  return achados;
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
