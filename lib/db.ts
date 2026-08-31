import "server-only";
import postgres from "postgres";

// Banco Postgres. Acesso só no servidor — a única credencial é a DATABASE_URL,
// que nunca chega ao navegador.
//
// O driver fala TCP com um pooler na frente (PgBouncer no Neon, Supavisor no
// Supabase). Os dois rodam em MODO TRANSAÇÃO, que não suporta prepared
// statements — daí o `prepare: false`. Sem ele o app não quebra na primeira
// requisição, e sim sob concorrência, que é o tipo de falha mais caro de achar.

// O que roda DENTRO de uma transação. Tem só `query` de propósito: quem está
// numa transação escreve consultas montadas, e expor o template marcado aqui
// convidaria a passar o `sql` de fora para dentro sem perceber — que é o jeito
// de emitir uma consulta FORA da transação achando que está dentro.
type SqlTx = {
  query: (text: string, params?: unknown[]) => Promise<unknown[]>;
};

// A interface é a mesma de sempre: template marcado para consulta fixa, e
// .query(texto, params) para consulta montada. Os 73 pontos de chamada não
// sabem qual driver está por baixo.
//
// `begin` é a terceira porta, e ela existe por um caso só: duas escritas que
// precisam valer JUNTAS ou não valer (`salvarAutomacao`, app/automacoes/
// actions.ts, grava `steps` e as colunas do gatilho no mesmo salvamento — e o
// par é conferido como par). Tudo o que ela faz é abrir a transação do driver e
// entregar um `query` preso à MESMA conexão; qualquer exceção lá dentro desfaz
// as duas.
//
// Ela funciona com o pooler em MODO TRANSAÇÃO — que é o que está na frente
// deste banco (ver o `prepare: false` acima) — porque `begin` reserva a conexão
// enquanto o bloco roda. É o `prepare` que o modo transação não suporta, não a
// transação em si.
type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  begin: <T>(fn: (tx: SqlTx) => Promise<T>) => Promise<T>;
};

let _sql: Sql | null = null;

// Cada fornecedor inventa o seu parâmetro de URL: o Neon manda channel_binding,
// o Prisma manda pgbouncer. O postgres.js não conhece nenhum dos dois e os
// repassa ao servidor como opção de conexão, que os recusa.
//
// Removidos via URL, e não por regex: tirando o PRIMEIRO parâmetro, o regex
// deixaria um "&" órfão logo depois do "?" e quebraria o resto da string.
const PARAMS_DE_OUTROS = ["channel_binding", "pgbouncer"];

function limparUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const p of PARAMS_DE_OUTROS) u.searchParams.delete(p);
    return u.toString();
  } catch {
    // URL que não parseia é problema do driver reportar, não deste ajuste.
    return url;
  }
}

// Aceita o banco com QUALQUER prefixo de variável (DATABASE_URL, STORAGE_URL,
// POSTGRES_URL...): o comprador não precisa acertar o "Custom Prefix" na Vercel.
function findDatabaseUrl(): string | undefined {
  const direct =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
  if (direct) return direct;
  const candidates = Object.entries(process.env)
    .filter(
      ([k, v]) =>
        typeof v === "string" &&
        /^postgres(ql)?:\/\//.test(v) &&
        !/UNPOOLED|NON_?POOLING|NO_SSL/i.test(k)
    )
    .sort(([a], [b]) => a.localeCompare(b));
  return candidates[0]?.[1];
}

// O QUE ESTE ARQUIVO NÃO FAZ MAIS: CRIAR ESQUEMA.
//
// Até 26/08 vivia aqui um `ensureSchema()` com 42 instruções de DDL, chamado de
// 24 lugares, que montava o banco na primeira requisição de cada instância. Ele
// foi APAGADO, e a estrutura passou a ser responsabilidade exclusiva de
// `migrations/`, aplicada por `scripts/migrar.mjs` dentro do `build`.
//
// O que se ganhou está medido em `scratchpad/frente1-desligar-a-rede.md`:
//
//   - a primeira requisição de cada instância deixou de pagar 49 idas ao banco,
//     26 delas `alter table` (trava exclusiva de tabela). Medido a frio, contra
//     um schema vazio deste mesmo Postgres: **1398 ms → 0 ms**
//   - editar este arquivo com um servidor de dev de pé deixou de aplicar DDL no
//     banco vivo. A coluna `entrega_sem_portao` nasceu em produção assim, sem
//     ninguém ter decidido aplicá-la
//
// O QUE SE PERDEU, e onde a perda foi coberta: `ensureSchema` era a rede que
// criava a coluna que faltasse. Sem ele, uma coluna ausente é LIDA COMO
// `undefined` por `select *`, e o motor decide diferente SEM ERRO NENHUM —
// medido: uma automação de três blocos entregou **um** bloco, com
// `ignorados=0`. Quem fecha esse buraco agora é `exigirEsquema()`
// (`lib/esquema.ts`), chamado uma vez por instância em `instrumentation.ts`:
// ele CONFERE e recusa servir, e nunca cria.

export function sql(): Sql {
  if (!_sql) {
    const url = findDatabaseUrl();
    if (!url) {
      throw new Error(
        "Banco não encontrado. Configure a DATABASE_URL do projeto na Vercel e faça um Redeploy."
      );
    }
    const cliente = postgres(limparUrl(url), {
      prepare: false,
      ssl: "require",
      // Com o DDL fora da aplicação, os dois códigos de ruído que a
      // idempotência produzia (42P07 "relation already exists" e 42701 "column
      // already exists") não têm mais como acontecer daqui. O filtro que os
      // engolia saiu junto: todo aviso do servidor volta a aparecer, que é o
      // que se quer de um log.
      onnotice: (aviso) => console.warn(`[postgres] ${aviso.code}: ${aviso.message}`),
      // Baixo de propósito: em serverless cada instância vive pouco e atende
      // poucas requisições ao mesmo tempo. Pool grande aqui vira conexão ociosa
      // segurando vaga num pooler que é compartilhado.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    // A fronteira onde o tipo do driver se apaga, de propósito e num lugar só.
    // O app monta parâmetros como `unknown[]`, que é o que ele de fato tem; o
    // postgres.js quer os tipos dele. A conversão mora AQUI para que os 73
    // pontos de chamada não precisem conhecer driver nenhum — é o que permite
    // trocar de driver de novo um dia mexendo só neste arquivo.
    _sql = Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) =>
        cliente(strings, ...(values as postgres.ParameterOrFragment<never>[])),
      {
        query: (text: string, params?: unknown[]) =>
          cliente.unsafe(text, (params ?? []) as postgres.ParameterOrJSON<never>[]),
        // O `tx` que chega ao bloco é a conexão reservada da transação, e é por
        // ela que as consultas passam. O molde do retorno é necessário porque o
        // driver tipa `begin` como "desembrulha se for array" — regra que ele
        // não consegue reduzir sobre um genérico, e aqui T nunca é array.
        begin: <T,>(fn: (tx: SqlTx) => Promise<T>): Promise<T> =>
          cliente.begin((tx) =>
            fn({
              query: (text: string, params?: unknown[]) =>
                tx.unsafe(text, (params ?? []) as postgres.ParameterOrJSON<never>[]),
            })
          ) as Promise<T>,
      }
    );
  }
  return _sql;
}

// ---------- Tipos ----------

// config guarda o que é da INSTÂNCIA (app da Meta, verify token, URL pública).
// Os campos de conta (ig_user_id, token…) são legados: hoje cada conta conectada
// vive na tabela `accounts`. Mantidos aqui só para a migração dos bancos antigos.
export type Config = {
  id: number;
  ig_user_id: string | null;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  access_token: string | null;
  token_expires_at: Date | null;
  connected_at: Date | null;
  instagram_app_id: string | null;
  instagram_app_secret: string | null;
  // Credenciais do APP principal (Configurações → Básico), diferentes das do
  // login do Instagram. Usadas para configurar o webhook via API.
  meta_app_id: string | null;
  meta_app_secret: string | null;
  webhook_verify_token: string | null;
  app_url: string | null;
};

// Uma conta de Instagram conectada. Várias podem coexistir na mesma instalação.
export type Account = {
  ig_user_id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  access_token: string;
  token_expires_at: Date | null;
  connected_at: Date | null;
  created_at: Date;
};

export type Automation = {
  id: string;
  account_id: string;
  name: string;
  active: boolean;
  triggers: string[];
  keywords: string[];
  match_type: "contains" | "exact" | "any";
  media_id: string | null;
  media_thumbnail_url: string | null;
  media_caption: string | null;
  story_id: string | null;
  story_thumbnail_url: string | null;
  public_replies: string[];
  welcome_text: string;
  quick_reply_label: string;
  link_text: string;
  link_button_label: string;
  link_url: string;
  reminder_text: string;
  reminder_delay_minutes: number;
  // etapas opcionais
  require_follow: boolean;
  follow_text: string;
  follow_button_label: string;
  ask_email: boolean;
  email_text: string;
  story_reaction: string; // emoji; vazio = não reage
  // O fluxo como lista ordenada. `unknown[]` de propósito: o que vem do banco
  // não tem garantia de forma, e quem valida é o interpretador de lib/steps.ts.
  // Tipar como Passo[] aqui seria afirmar uma garantia que o jsonb não dá.
  steps: unknown[];
  // As ligações entre os blocos, com a mesma garantia de `steps`: `unknown[]`
  // porque o jsonb não confere forma nenhuma, e quem valida é `conferirLigacao`
  // (lib/steps.ts).
  ligacoes: unknown[];
  // A decisão do dono para ESTA automação: publicar mesmo com um caminho que
  // chega ao link sem passar pelo portão. `boolean` e não `unknown` porque, ao
  // contrário de `steps` e `ligacoes`, a coluna é `boolean not null default
  // false` — o banco garante a forma, e não há jsonb no meio.
  //
  // O `| undefined` NÃO É FROUXIDÃO, É A REDE, E ELA FICOU MAIS NECESSÁRIA EM
  // 26/08. Os quatro leitores desta coluna (`app/automacoes/page.tsx`,
  // `app/automacoes/[id]/page.tsx` e as duas consultas de `lib/engine.ts`) são
  // `select *`. Até 26/08 havia um `ensureSchema()` na frente deles garantindo a
  // coluna; ele foi APAGADO, e quem garante agora é a migração `002` mais a
  // conferência de partida (`lib/esquema.ts`). Num banco que ficasse para trás,
  // `select *` traz a linha SEM a chave e o campo chega `undefined` de verdade —
  // medido, e sem erro nenhum no caminho.
  //
  // O tipo dizia só `boolean`, e um tipo que promete mais do que o banco garante
  // convida a próxima pessoa a apagar o `Boolean(...)` dos leitores por parecer
  // redundante — que é exatamente a linha que segura o caso. Com o `| undefined`
  // escrito, apagá-la deixa de compilar.
  //
  // QUEM LÊ passa por `Boolean(...)` de propósito, e o `false` que sai é o lado
  // seguro: a regra do portão contornável continua impedindo publicar.
  entrega_sem_portao: boolean | undefined;
  created_at: Date;
};

export type Followup = {
  id: string;
  automation_id: string;
  position: number;
  kind: "link" | "reminder";
  text: string;
  button_label: string | null;
  url: string | null;
  delay_minutes: number;
};

export type Contact = {
  account_id: string;
  ig_id: string;
  username: string | null;
  name: string | null;
  profile_pic: string | null;
  email: string | null;
  awaiting: string | null;
  follow_attempts: number;
  first_contact_at: Date;
  last_reply_at: Date | null;
  last_automation_id: string | null;
  flow_step_id: string | null;
  categoria: string | null;
};

export type QueueItem = {
  id: string;
  account_id: string | null;
  kind:
    | "private_reply"
    | "comment_reply"
    | "dm_welcome"
    | "dm_link"
    | "dm_reminder"
    | "dm_follow_gate"
    | "dm_email_ask"
    | "story_reaction"
    | "dm_manual";
  contact_ig_id: string | null;
  automation_id: string | null;
  comment_id: string | null;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
  status: string;
  attempts: number;
  not_before: Date;
  claimed_at: Date | null;
  sent_at: Date | null;
  error: string | null;
  message_id: string | null;
  created_at: Date;
};

// ---------- Config ----------

export async function getConfig(): Promise<Config> {
  const rows = (await sql()`select * from config where id = 1`) as Config[];
  return rows[0];
}

const CONFIG_COLUMNS = new Set([
  "ig_user_id",
  "username",
  "name",
  "profile_picture_url",
  "access_token",
  "token_expires_at",
  "connected_at",
  "instagram_app_id",
  "instagram_app_secret",
  "meta_app_id",
  "meta_app_secret",
  "webhook_verify_token",
  "app_url",
]);

export async function updateConfig(fields: Partial<Config>): Promise<void> {
  const entries = Object.entries(fields).filter(([k]) => CONFIG_COLUMNS.has(k));
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`).join(", ");
  await sql().query(
    `update config set ${sets}, updated_at = now() where id = 1`,
    entries.map(([, v]) => v)
  );
}

export function isMetaConfigured(c: Config): boolean {
  return Boolean(c.instagram_app_id && c.instagram_app_secret);
}

// ---------- Contas ----------

export async function listAccounts(): Promise<Account[]> {
  return (await sql()`select * from accounts order by created_at asc`) as Account[];
}

export async function getAccount(igUserId: string): Promise<Account | undefined> {
  const rows = (await sql().query(`select * from accounts where ig_user_id = $1`, [
    igUserId,
  ])) as Account[];
  return rows[0];
}

export async function upsertAccount(a: {
  ig_user_id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  access_token: string;
  token_expires_at: Date | null;
}): Promise<void> {
  await sql().query(
    `insert into accounts (ig_user_id, username, name, profile_picture_url,
                           access_token, token_expires_at, connected_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (ig_user_id) do update set
       username = excluded.username,
       name = excluded.name,
       profile_picture_url = excluded.profile_picture_url,
       access_token = excluded.access_token,
       token_expires_at = excluded.token_expires_at`,
    [
      a.ig_user_id,
      a.username,
      a.name,
      a.profile_picture_url,
      a.access_token,
      a.token_expires_at?.toISOString() ?? null,
    ]
  );
}

export async function updateAccountToken(
  igUserId: string,
  accessToken: string,
  tokenExpiresAt: Date
): Promise<void> {
  await sql().query(
    `update accounts set access_token = $2, token_expires_at = $3 where ig_user_id = $1`,
    [igUserId, accessToken, tokenExpiresAt.toISOString()]
  );
}

// Desconecta uma conta e apaga tudo que era dela (automações em cascata levam
// followups; contatos, fila e eventos são removidos explicitamente).
export async function deleteAccount(igUserId: string): Promise<void> {
  for (const t of ["queue", "events", "contacts", "automations"]) {
    await sql().query(`delete from ${t} where account_id = $1`, [igUserId]);
  }
  await sql().query(`delete from accounts where ig_user_id = $1`, [igUserId]);
}
