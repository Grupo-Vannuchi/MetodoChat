# A preparação na `main` para o LinkedIn — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** antes da entrega do LinkedIn, deixar a `main` pronta para um tipo de fila que ela não conhece. O dreno passa a pegar só os tipos que este código sabe drenar, e o rodapé do tique também. A conferência do build passa a aceitar o `queue_kind_check` na forma de hoje (a 010) e na forma da 024 (com `publicacao_linkedin`), e nenhuma outra.

**Arquitetura:**
- a lista dos tipos que o dreno conhece mora num arquivo só e puro, `lib/fila-tipos.ts`. O tipo `QueueItem["kind"]` (`lib/db.ts`) sai dela, e um teste a prende ao `queue_kind_check` da última migração que o escreve;
- a seleção do `drainQueue` e a consulta do rodapé que arma o próximo tique (`lib/queue-drain.ts`) ganham `kind = any(<a lista>)`. Uma linha de tipo desconhecido fica `pending`, intocada, e não arma tique;
- a linha do `queue_kind_check` em `scripts/migrar.mjs` ganha `tambemAceitas` com a forma da 024. O laço da conferência compara o texto achado com cada forma aceita, e uma terceira forma continua derrubando o script.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (puros e integração) e o Postgres no container para a integração.

**Spec:** `docs/specs/2026-11-06-linkedin-no-perfil.md`, §0 (commits `8c2be0e`, `7ef13ea` e `9e42566`, na branch local `linkedin-no-perfil`; auditada pela `metodochat-f9`, com os achados 188 a 199, e lida pelo Eduardo em 06/11/2026: "Li, pode seguir"). Leia o §0 antes de começar: este plano não repete o porquê, só como construir.

**Por que a preparação vem antes, em uma frase:** o preview do LinkedIn usa o banco de produção, e o dreno da produção, com o código de hoje, pegaria uma linha `publicacao_linkedin`, a mandaria para o caminho das mensagens e armaria um tique a cada 20 s por ela. E a 024, aplicada à mão, quebraria o build de todo deploy da `main` até o merge.

**Ensaio do plano (06/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-preparacao`, saída de `56cd72a`, com `npm ci` próprio e `.env.local` vazio), e todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio são:
- FASE 1, `97e5194` (patch-id `1cc18e14dbd9`);
- FASE 2, `d545f20` (patch-id `4a13d4071180`);
- FASE 3, `54aca93` (patch-id `0021100894e8`).
As mensagens são as deste plano. Os números de RED e de GREEN de cada passo são os do ensaio.

Os números do fim, no `54aca93` (entre parênteses, os da base `56cd72a`):
- lint e `tsc` limpos em cada fase;
- testes puros: 147 arquivos e 3 631 casos (146 e 3 628); testes de tela: 34 arquivos e 308 casos (34 e 308);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: 68 arquivos, 791 passaram e 8 pularam (66, 784 e 8);
- as 7 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado: "7 mutações, 0 ruins; árvore no fim: limpa";
- a guarda do diff (FASE 4) mostra só os 7 arquivos do mapa, com 415 linhas a mais e 25 a menos.

## Restrições globais

- **Branch:** `preparacao-tipos-da-fila`, saída da `main` em `56cd72a`, sem upstream. Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel. Conferir `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados atrás de caractere de controle e de fim de linha misturado.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** os diffs deste plano estão em LF. Aplique com `git apply --ignore-whitespace`, ou numa cópia feita com `git -c core.autocrlf=false`.
- **Os arquivos desta entrega são os 7 do mapa abaixo, e mais nenhum.** É código do motor (`lib/queue-drain.ts`) e da conferência do build (`scripts/migrar.mjs`): o cuidado do motor vale (auditoria, DEV e agentes).
- **Nenhuma migração e nenhuma escrita em produção** nesta entrega, fora o merge do Eduardo e o deploy que ele dispara.
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**. Se o container estiver parado (a máquina reiniciou): `docker start metodochat-banco-de-teste`.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `lib/fila-tipos.ts` (novo) | a lista dos tipos que o dreno conhece e o tipo `TipoDaFila` | 1 |
| `tests/fila-tipos.test.ts` (novo) | prende a lista ao `queue_kind_check` da última migração e ao `QueueItem` | 1 |
| `lib/db.ts` | o `QueueItem["kind"]` passa a ser o `TipoDaFila` | 1 |
| `lib/queue-drain.ts` | a seleção e o rodapé do tique filtram pela lista | 2 |
| `testes-integracao/dreno-tipo-desconhecido.integracao.ts` (novo) | o dreno não pega nem arma tique por um tipo desconhecido | 2 |
| `scripts/migrar.mjs` | o `queue_kind_check` aceita a forma da 010 e a da 024 | 3 |
| `testes-integracao/conferencia-do-kind.integracao.ts` (novo) | o script de verdade, as duas formas aceitas e as outras recusadas | 3 |

O que fica de fora, e por quê:
- **a cota de DM** (`lib/queue-drain.ts`, a contagem dos `sent` da última hora com `kind <> 'publicacao'`): ela conta linhas já enviadas, e este código nunca envia um tipo que não conhece. Na prova do LinkedIn, um punhado de posts enviados pelo preview contaria na cota de 190 por hora da conta, e isso não muda nada;
- **as consultas do motor com tipo escrito** (`lib/engine.ts`, `shouldFallbackFollowup`) e as do `dm_lote`: elas já nomeiam os tipos;
- **as telas e os outros pontos do `kind = 'publicacao'`**: são da entrega do LinkedIn (a lista completa está no §6 da spec).

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch, saída da `main` remota**

```bash
git fetch origin
git rev-parse --short origin/main   # tem de dar 56cd72a
git worktree add -b preparacao-tipos-da-fila <pasta-da-copia> origin/main
cd <pasta-da-copia>
git branch --unset-upstream          # sem upstream: nada sobe sem querer
git branch --show-current            # preparacao-tipos-da-fila
npm ci
```

Se `origin/main` não estiver em `56cd72a`, pare: a base mudou, e o plano precisa ser conferido de novo.

---

### FASE 1 — A lista dos tipos num lugar só

**Arquivos:** `lib/fila-tipos.ts` (novo), `tests/fila-tipos.test.ts` (novo), `lib/db.ts`.

- [ ] **Passo 1: o teste**

Crie `tests/fila-tipos.test.ts`:

```ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
import type { QueueItem } from "@/lib/db";

// A LISTA DOS TIPOS QUE O DRENO CONHECE É A DO BANCO (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// O `queue_kind_check` do banco e a lista do código são duas listas da mesma coisa, e o comentário do
// `QueueItem` (lib/db.ts) já registrou uma vez que elas se separaram. Este teste lê a ÚLTIMA migração da
// pasta que escreve o `queue_kind_check` e exige que os tipos dela sejam exatamente os da lista. Quem
// acrescentar um tipo numa migração nova e esquecer o código (ou o contrário) cai aqui.
function tiposDaUltimaMigracaoDoCheck(): { arquivo: string; tipos: string[] } {
  const pasta = join(process.cwd(), "migrations");
  const arquivos = readdirSync(pasta)
    .filter((a) => a.endsWith(".sql"))
    .sort();
  let achado: { arquivo: string; tipos: string[] } | null = null;
  for (const arquivo of arquivos) {
    const texto = readFileSync(join(pasta, arquivo), "utf8");
    const m = /add constraint queue_kind_check check \(kind in \(([\s\S]*?)\)\)/i.exec(texto);
    if (!m) continue;
    const tipos = [...m[1].matchAll(/'([a-z_]+)'/g)].map((t) => t[1]);
    achado = { arquivo, tipos };
  }
  if (!achado) throw new Error("nenhuma migração escreve o queue_kind_check");
  return achado;
}

describe("os tipos que o dreno conhece", () => {
  it("são exatamente os do queue_kind_check da última migração que o escreve", () => {
    const { arquivo, tipos } = tiposDaUltimaMigracaoDoCheck();
    expect(arquivo).toBe("010-fila-publicacao.sql");
    expect([...TIPOS_QUE_O_DRENO_CONHECE].sort()).toEqual([...tipos].sort());
  });

  it("não têm repetição", () => {
    expect(new Set(TIPOS_QUE_O_DRENO_CONHECE).size).toBe(TIPOS_QUE_O_DRENO_CONHECE.length);
  });

  it("são o tipo do kind da linha da fila (QueueItem), e não uma segunda lista", () => {
    expectTypeOf<QueueItem["kind"]>().toEqualTypeOf<TipoDaFila>();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/fila-tipos.test.ts
```

Esperado: o arquivo falha antes dos casos, com `Cannot find package '@/lib/fila-tipos'` ("Test Files 1 failed (1)", "Tests no tests").

- [ ] **Passo 3: o código**

Crie `lib/fila-tipos.ts`:

```ts
// OS TIPOS DE LINHA QUE ESTE CÓDIGO SABE DRENAR (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// É A MESMA LISTA DO `queue_kind_check` do banco, e um teste prende as duas (tests/fila-tipos.test.ts): ele
// lê a última migração que escreve a restrição e exige os mesmos tipos daqui. O tipo da linha da fila
// (`QueueItem["kind"]`, lib/db.ts) sai daqui também, para não haver uma segunda lista que o compilador
// confira e o banco não.
//
// O DRENO SÓ PEGA ESTES TIPOS. A seleção e o rodapé do tique (lib/queue-drain.ts) filtram por esta lista:
// uma linha de tipo que este código não conhece — escrita por um código mais novo, com o banco já
// alargado — fica `pending`, intocada, até o código que a conhece chegar. Sem o filtro, o dreno de hoje a
// mandaria para o caminho das mensagens, e o rodapé armaria um tique a cada 20 segundos por ela.
//
// SEM IMPORT NENHUM: o arquivo é puro, e o teste o lê sem banco.
export const TIPOS_QUE_O_DRENO_CONHECE = [
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
] as const;

export type TipoDaFila = (typeof TIPOS_QUE_O_DRENO_CONHECE)[number];
```

Em `lib/db.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/db.ts b/lib/db.ts
index b68a713..ac249b9 100644
--- a/lib/db.ts
+++ b/lib/db.ts
@@ -1,6 +1,7 @@
 import "server-only";
 import postgres from "postgres";
 import { sslDaUrl } from "./conexao";
+import type { TipoDaFila } from "./fila-tipos";
 
 // Banco Postgres. Acesso só no servidor — a única credencial é a DATABASE_URL,
 // que nunca chega ao navegador.
@@ -340,25 +341,11 @@ export type Contact = {
 export type QueueItem = {
   id: string;
   account_id: string | null;
-  kind:
-    | "private_reply"
-    | "comment_reply"
-    | "dm_welcome"
-    | "dm_link"
-    | "dm_reminder"
-    | "dm_follow_gate"
-    | "dm_email_ask"
-    | "story_reaction"
-    | "dm_manual"
-    | "dm_lote"
-    // A PUBLICACAO NO INSTAGRAM (migrations/010-fila-publicacao.sql). Ela
-    // faltava aqui depois da 010, e quem a achou foi o `tsc`: o dicionario de
-    // `app/labels.ts` passou a ser digitado por esta uniao em 03/09, e o
-    // rotulo novo virou erro de compilacao ate esta linha existir.
-    //
-    // A licao vale para o proximo: o `check` do banco e esta uniao sao DUAS
-    // listas da mesma coisa, e so uma delas o compilador enxerga.
-    | "publicacao";
+  // OS TIPOS SAEM DE UMA LISTA SÓ (lib/fila-tipos.ts), presa ao `queue_kind_check` por teste
+  // (tests/fila-tipos.test.ts). Até 06/11/2026 esta união era uma segunda cópia da lista do banco, e o
+  // comentário dela registrava que a `publicacao` faltou aqui depois da 010: o `check` e a união eram
+  // DUAS listas da mesma coisa, e só uma delas o compilador enxergava.
+  kind: TipoDaFila;
   contact_ig_id: string | null;
   automation_id: string | null;
   comment_id: string | null;
```

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/fila-tipos.test.ts
npx tsc --noEmit
npx eslint lib/fila-tipos.ts lib/db.ts tests/fila-tipos.test.ts
```

Esperado: "Tests 3 passed (3)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-prep-f1.txt`:

```text
Os tipos da fila moram numa lista só, presa ao queue_kind_check da última migração
```

```bash
git add -- lib/fila-tipos.ts lib/db.ts tests/fila-tipos.test.ts
git commit -F "$SCRATCH/msg-prep-f1.txt"
```

---

### FASE 2 — O dreno só pega, e só arma tique, pelos tipos que conhece

**Arquivos:** `lib/queue-drain.ts`, `testes-integracao/dreno-tipo-desconhecido.integracao.ts` (novo).

- [ ] **Passo 1: o teste**

Crie `testes-integracao/dreno-tipo-desconhecido.integracao.ts`:

```ts
// O DRENO NÃO PEGA UM TIPO QUE NÃO CONHECE (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// O PROBLEMA, medido no 56cd72a: a seleção do dreno (lib/queue-drain.ts, `drainQueue`) pegava QUALQUER
// linha pendente, sem olhar o tipo, e um tipo que o código não conhece caía no caminho das mensagens. E o
// rodapé armava o próximo tique pelo `min(not_before)` de TODAS as pendentes: uma linha de tipo
// desconhecido, vencida e nunca drenada, armaria um tique a cada 20 segundos, sem fim, e esgotaria a cota
// do QStash — que cala os tiques do produto inteiro (o cabeçalho de tique-do-rodape.integracao.ts).
//
// QUANDO ISSO ACONTECE: o banco é um só para a produção e para os previews. Um preview de uma entrega nova
// (o LinkedIn) grava um tipo novo na fila, e o dreno da produção, com o código de hoje, roda a cada
// webhook, a cada tique e no cron. A lista do que o dreno conhece mora em lib/fila-tipos.ts.
//
// O TIPO NOVO DESTE ARQUIVO É INVENTADO (`tipo_do_futuro`), e o `queue_kind_check` do schema descartável é
// alargado só para ele: nada aqui depende do LinkedIn existir.
//
// SEM REDE: a conta das linhas não existe, então a linha de tipo conhecido sai como `skipped` ("conta não
// conectada") antes de qualquer chamada. A Meta falsa conta pedidos, e a conta tem de ser zero.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { TIPOS_QUE_O_DRENO_CONHECE } from "@/lib/fila-tipos";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const CONTA_QUE_NAO_EXISTE = "17800000000006601";
const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-o-teste";
const APP_URL = "https://exemplo.invalid";
const TIPO_NOVO = "tipo_do_futuro";

let publicados: string[] = [];
let pedidosAMeta = 0;
let servidorQstash: Server;
let servidorMeta: Server;
let dreno: ModuloDreno;
let qstash: ModuloQstash;

beforeAll(async () => {
  servidorQstash = createServer((req: IncomingMessage, res: ServerResponse) => {
    const caminho = req.url ?? "/";
    req.resume();
    if (req.method === "POST" && caminho.startsWith("/v2/publish/")) {
      publicados.push(caminho);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ messageId: `msg-${publicados.length}` }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "o qstash falso nao conhece esse caminho" }));
  });
  servidorMeta = createServer((req: IncomingMessage, res: ServerResponse) => {
    pedidosAMeta++;
    req.resume();
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "nenhum caso deste arquivo fala com a Meta" } }));
  });
  await new Promise<void>((pronto) => servidorQstash.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  process.env.QSTASH_URL = `http://127.0.0.1:${(servidorQstash.address() as AddressInfo).port}`;
  process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${(servidorMeta.address() as AddressInfo).port}`;

  dreno = await import("@/lib/queue-drain");
  qstash = await import("@/lib/qstash");

  // A TRAVA DO INSTRUMENTO, a mesma de tique-do-rodape.integracao.ts: um tique de prova tem de chegar ao
  // QStash falso. Sem isso, "nenhum tique" passaria por engano com o QStash desligado.
  if (!qstash.qstashEnabled()) throw new Error("RECUSADO: qstashEnabled() falso com a QSTASH_TOKEN posta.");
  publicados = [];
  await qstash.scheduleTick(APP_URL, 60);
  if (publicados.length !== 1) {
    throw new Error(`RECUSADO: o tique de prova não chegou ao QStash falso (chegaram ${publicados.length}).`);
  }

  await banco.db().updateConfig({ app_url: APP_URL });

  // UMA CONTA QUE EXISTE, e só para o dreno trabalhar: sem nenhuma conta, `drainQueue` volta logo no
  // começo, sem olhar a fila, e todo caso daqui passaria por engano (medido no ensaio, 06/11/2026). As
  // linhas dos casos ficam noutra conta, que não existe, para nada chamar a rede.
  await banco.db().upsertAccount({
    ig_user_id: "17800000000006602",
    username: "conta_do_tipo_novo",
    name: "conta_do_tipo_novo",
    profile_picture_url: null,
    access_token: "token-da-conta-que-nao-vale-nada",
    token_expires_at: null,
  });

  // O schema descartável ganha o tipo inventado, além dos de hoje.
  const tipos = [...TIPOS_QUE_O_DRENO_CONHECE, TIPO_NOVO].map((t) => `'${t}'`).join(",");
  await banco.db().sql().query(`alter table queue drop constraint queue_kind_check`);
  await banco.db().sql().query(`alter table queue add constraint queue_kind_check check (kind in (${tipos}))`);
});

afterAll(async () => {
  delete process.env.QSTASH_URL;
  delete process.env.QSTASH_TOKEN;
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidorQstash.close(() => pronto()));
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  publicados = [];
  pedidosAMeta = 0;
});

/** Uma linha pendente, vencida há um minuto, na conta que não existe. */
async function semear(kind: string, chave: string): Promise<string> {
  const [linha] = (await banco.db().sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
     values ($1, $2, '{}'::jsonb, $3, now() - interval '1 minute')
     returning id`,
    [CONTA_QUE_NAO_EXISTE, kind, chave]
  )) as { id: string }[];
  return linha.id;
}

async function linha(id: string) {
  const [l] = (await banco.db().sql().query(
    `select status, attempts, claimed_at, error, not_before from queue where id = $1`,
    [id]
  )) as { status: string; attempts: number; claimed_at: Date | null; error: string | null; not_before: Date }[];
  return l;
}

describe("o dreno e um tipo que ele não conhece", () => {
  test("a linha de tipo desconhecido fica pending e intocada, e a de tipo conhecido sai", async () => {
    const nova = await semear(TIPO_NOVO, "chave-do-tipo-novo");
    const conhecida = await semear("dm_manual", "chave-do-tipo-conhecido");
    const antes = await linha(nova);

    await dreno.drainQueue();

    const depois = await linha(nova);
    expect(depois.status).toBe("pending");
    expect(depois.attempts).toBe(0);
    expect(depois.claimed_at).toBeNull();
    expect(depois.error).toBeNull();
    expect(depois.not_before.getTime()).toBe(antes.not_before.getTime());

    const outra = await linha(conhecida);
    expect(outra.status).toBe("skipped");
    expect(outra.attempts).toBe(1);
    expect(pedidosAMeta).toBe(0);
  });

  test("o rodapé não arma tique por uma linha de tipo desconhecido", async () => {
    await semear(TIPO_NOVO, "chave-do-tipo-novo-sozinha");

    await dreno.drainQueue();

    expect(publicados).toEqual([]);
    expect(pedidosAMeta).toBe(0);
  });

  test("o rodapé continua armando o tique por uma linha de tipo conhecido para daqui a pouco", async () => {
    await banco.db().sql().query(
      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
       values ($1, 'dm_manual', '{}'::jsonb, 'chave-para-daqui-a-pouco', now() + interval '10 minutes')`,
      [CONTA_QUE_NAO_EXISTE]
    );

    await dreno.drainQueue();

    expect(publicados.length).toBe(1);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts testes-integracao/dreno-tipo-desconhecido.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, e "Tests 1 failed | 2 passed (3)":
- cai "a linha de tipo desconhecido fica pending e intocada, e a de tipo conhecido sai", com `expected 'skipped' to be 'pending'`: o dreno de hoje pegou a linha do tipo novo;
- "o rodapé não arma tique por uma linha de tipo desconhecido" PASSA no código de hoje, e por outro motivo: o dreno consome a linha, e o rodapé não acha nada pendente. Quem prova esse caso é a mutação D2 do Apêndice A (a seleção filtrada e o rodapé sem filtro);
- "o rodapé continua armando o tique por uma linha de tipo conhecido para daqui a pouco" passa: é a regressão.

O ensaio achou uma armadilha deste teste: sem nenhuma conta conectada, o `drainQueue` volta logo no começo, e todo caso passaria por engano. O teste cria uma conta que existe, e as linhas ficam noutra, que não existe (o comentário do `beforeAll` diz isso).

- [ ] **Passo 3: o código**

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index e789dc4..d73e708 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -22,6 +22,7 @@ import { renderVariables, type VariableContext } from "./variables";
 // coluna é `variableContext`, aqui embaixo; quem entende o `jsonb` é ele.
 import { lerCampos } from "./campos";
 import { lerPayloadDoLote, loteExpirou } from "./lote";
+import { TIPOS_QUE_O_DRENO_CONHECE } from "./fila-tipos";
 import {
   leituraDoContainer,
   lerPayloadDaPublicacao,
@@ -1041,6 +1042,13 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
          select id from queue
          where ((status = 'pending' and not_before <= now())
             or (status = 'sending' and claimed_at < now() - interval '3 minutes'))
+           -- SO OS TIPOS QUE ESTE CODIGO SABE DRENAR (lib/fila-tipos.ts). O banco e
+           -- um so para a producao e os previews, e um tipo escrito por um codigo
+           -- mais novo cairia, aqui, no caminho das mensagens. Ele fica pending,
+           -- intocado, ate o codigo que o conhece chegar
+           -- (testes-integracao/dreno-tipo-desconhecido.integracao.ts). Sem crase
+           -- neste comentario: ele mora DENTRO do template do SQL.
+           and kind = any($3::text[])
            -- A PUBLICACAO NAO E BLOQUEADA PELO TETO DE MENSAGEM. A conta que
            -- estourou as 190 DMs da hora sai INTEIRA do lote, e sem esta
            -- excecao um lote grande de mensagens -- que leva horas para sair --
@@ -1057,7 +1065,7 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
        returning q.*
      )
      select *, now() as agora_do_banco from lote order by created_at, id`,
-    [BATCH_SIZE, blocked]
+    [BATCH_SIZE, blocked, Array.from(TIPOS_QUE_O_DRENO_CONHECE)]
   )) as (QueueItem & { agora_do_banco: Date })[];
 
   // O RELOGIO QUE JULGA A VALIDADE É O DO BANCO, E NÃO O DA APLICAÇÃO.
@@ -1286,9 +1294,15 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
   // E O DANO QUE ISTO EVITA NÃO É NA PUBLICAÇÃO: `scheduleTick` engole todo erro
   // (lib/qstash.ts), então estourada a cota do QStash param CALADOS os tiques de
   // todo o produto — os lembretes com atraso à frente dos posts.
+  //
+  // SÓ OS TIPOS QUE ESTE CÓDIGO DRENA (lib/fila-tipos.ts), como a seleção lá em cima. Uma linha de tipo
+  // que ele não conhece fica `pending` para sempre, e sem este filtro o `min(not_before)` dela, vencido,
+  // armaria um tique a cada 20 s, sem fim — a cota do QStash acabaria, e com ela os tiques do produto
+  // inteiro (testes-integracao/dreno-tipo-desconhecido.integracao.ts).
   const nextRows = (await sql()`
     select extract(epoch from (min(not_before) - now()))::float8 as secs
     from queue where status = 'pending'
+      and kind = any(${Array.from(TIPOS_QUE_O_DRENO_CONHECE)}::text[])
       and not_before <= now() + make_interval(secs => ${HORIZONTE_DO_TIQUE_EM_SEGUNDOS}::int)
   `) as { secs: number | null }[];
   const secs = nextRows[0]?.secs;
```

O comentário que entra DENTRO do SQL da seleção não pode ter crase: ele mora dentro de um template literal, e a crase o fecharia (o ensaio tropeçou nisso).

- [ ] **Passo 4: rodar e ver passar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/dreno-tipo-desconhecido.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
npx tsc --noEmit
npx eslint lib/queue-drain.ts testes-integracao/dreno-tipo-desconhecido.integracao.ts
```

Esperado: "Test Files 2 passed (2)", "Tests 19 passed (19)" (os 3 novos e os 16 do rodapé de hoje), e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-prep-f2.txt`:

```text
O dreno só pega e só arma tique pelos tipos que conhece
```

```bash
git add -- lib/queue-drain.ts testes-integracao/dreno-tipo-desconhecido.integracao.ts
git commit -F "$SCRATCH/msg-prep-f2.txt"
```

---

### FASE 3 — A conferência do build aceita as duas formas, e só elas

**Arquivos:** `scripts/migrar.mjs`, `testes-integracao/conferencia-do-kind.integracao.ts` (novo).

- [ ] **Passo 1: o teste**

Crie `testes-integracao/conferencia-do-kind.integracao.ts`:

```ts
// A CONFERÊNCIA DO `queue_kind_check` ACEITA DUAS FORMAS, E SÓ ELAS (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// O `scripts/migrar.mjs` roda em todo deploy de produção e exige o texto EXATO de cada restrição conferida;
// uma divergência derruba o build (saída 1). A entrega do LinkedIn alarga o `queue_kind_check` com o tipo
// `publicacao_linkedin` (a migração 024), aplicada à mão antes do merge, como a 022 e a 023. Sem esta
// preparação, todo deploy da `main` entre a 024 e o merge morreria no build.
//
// As duas formas aceitas são a da 010 (a de hoje) e a da 024. Qualquer terceira continua sendo divergência:
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

it("a forma da 024, com o publicacao_linkedin, também confere", async () => {
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
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts testes-integracao/conferencia-do-kind.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, e "Tests 1 failed | 3 passed (4)". Cai "a forma da 024, com o publicacao_linkedin, também confere": o script de hoje sai com 1 e diz "MAS DIVERGE".

- [ ] **Passo 3: o código**

Em `scripts/migrar.mjs`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/scripts/migrar.mjs b/scripts/migrar.mjs
index b1f0341..5842b9f 100644
--- a/scripts/migrar.mjs
+++ b/scripts/migrar.mjs
@@ -828,6 +828,16 @@ const ESPERADAS_RESTRICOES = [
     // acusar divergência para sempre, e a acusação seria mentira. Foi assim que
     // a `008` substituiu a `004` aqui, e é assim que a `010` substitui a `008`:
     // o `de` aponta para quem escreveu o texto que está no banco AGORA.
+    //
+    // E ELA ACEITA UMA SEGUNDA FORMA, a da entrega do LinkedIn
+    // (docs/specs/2026-11-06-linkedin-no-perfil.md, §0). A `024` alarga a
+    // restrição com `publicacao_linkedin` e é aplicada à mão ANTES do merge
+    // daquela entrega, como a `022` e a `023`; sem `tambemAceitas`, todo deploy da
+    // `main` nessa janela morreria aqui. No merge do LinkedIn, a forma da `024`
+    // vira a `definicao` desta linha, e a da `010` sai. Uma terceira forma
+    // continua sendo divergência (testes-integracao/conferencia-do-kind.integracao.ts).
+    // Os dois textos são os do `pg_get_constraintdef`, o segundo medido no banco
+    // de teste em 06/11/2026.
     tabela: "queue",
     nome: "queue_kind_check",
     de: "010-fila-publicacao.sql",
@@ -836,6 +846,17 @@ const ESPERADAS_RESTRICOES = [
       "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
       "'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, " +
       "'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text])))",
+    tambemAceitas: [
+      {
+        de: "024 (a entrega do LinkedIn, aplicada à mão antes do merge dela)",
+        definicao:
+          "CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, " +
+          "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
+          "'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, " +
+          "'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text, " +
+          "'publicacao_linkedin'::text])))",
+      },
+    ],
   },
   {
     // A GÊMEA DA LINHA ACIMA, na coluna vizinha da mesma tabela. Ela está aqui
@@ -1023,7 +1044,7 @@ for (const { tabela, coluna, aponta, aoExcluir, de } of ESPERADAS_CHAVES) {
   }
 }
 
-for (const { tabela, nome, definicao, de } of ESPERADAS_RESTRICOES) {
+for (const { tabela, nome, definicao, de, tambemAceitas = [] } of ESPERADAS_RESTRICOES) {
   const achadas = await sql`
     select pg_get_constraintdef(c.oid) as definicao
     from pg_constraint c
@@ -1040,14 +1061,20 @@ for (const { tabela, nome, definicao, de } of ESPERADAS_RESTRICOES) {
     continue;
   }
 
-  if (achadas[0].definicao !== definicao) {
+  // AS FORMAS ACEITAS: a da `definicao` e, só na linha que as tiver, as de
+  // `tambemAceitas` (a do `queue_kind_check`, acima). A comparação é sempre do
+  // texto inteiro, como antes.
+  const formas = [{ de, definicao }, ...tambemAceitas];
+  const casada = formas.find((f) => f.definicao === achadas[0].definicao);
+
+  if (!casada) {
     // DIVERGÊNCIA DE DEFINIÇÃO É FALHA NOS DOIS MODOS, pelo mesmo motivo da forma
     // de coluna e da regra de exclusão: a restrição já está no banco com o
     // conteúdo errado, e o par "derruba se houver, cria em seguida" só a conserta
     // se ELE for quem rodar — se alguém a tiver reescrito por fora, não.
     console.log(
-      `CONFERIDO no banco: ${tabela}.${nome} existe, MAS DIVERGE de ${de}\n` +
-        `  esperado: ${definicao}\n` +
+      `CONFERIDO no banco: ${tabela}.${nome} existe, MAS DIVERGE de ${formas.map((f) => f.de).join(" e de ")}\n` +
+        formas.map((f) => `  esperado: ${f.definicao}\n`).join("") +
         `  achado:   ${achadas[0].definicao}\n` +
         "  Pare e investigue."
     );
@@ -1055,7 +1082,7 @@ for (const { tabela, nome, definicao, de } of ESPERADAS_RESTRICOES) {
     continue;
   }
 
-  console.log(`CONFERIDO no banco: ${tabela}.${nome} existe e confere (${de})`);
+  console.log(`CONFERIDO no banco: ${tabela}.${nome} existe e confere (${casada.de})`);
 }
 
 // ============================================================
```

O texto da forma da 024 é o do `pg_get_constraintdef`, medido no banco de teste em 06/11/2026 com uma tabela temporária desfeita em seguida:

```bash
docker exec metodochat-banco-de-teste psql -U postgres -d metodochat_testes -At -c "begin; create temp table medir_check (kind text, constraint medir_check_c check (kind in ('private_reply','comment_reply','dm_welcome','dm_link','dm_reminder','dm_follow_gate','dm_email_ask','story_reaction','dm_manual','dm_lote','publicacao','publicacao_linkedin'))); select pg_get_constraintdef(oid) from pg_constraint where conname = 'medir_check_c'; rollback;"
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node --check scripts/migrar.mjs
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/conferencia-do-kind.integracao.ts testes-integracao/registro-de-migracoes.integracao.ts
npx eslint testes-integracao/conferencia-do-kind.integracao.ts
```

Esperado: "Test Files 2 passed (2)", "Tests 11 passed (11)" (os 4 novos e os 7 do registro de hoje).

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-prep-f3.txt`:

```text
A conferência do build aceita o queue_kind_check da 010 e o da 024, e nenhum outro
```

```bash
git add -- scripts/migrar.mjs testes-integracao/conferencia-do-kind.integracao.ts
git commit -F "$SCRATCH/msg-prep-f3.txt"
```

---

### FASE 4 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --name-only AGENTS.md   # vazio
git status --porcelain            # vazio
```

Esperado: saída 0; 147 arquivos e 3 631 casos puros; 34 e 308 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA"; o build do Next 16.4.3.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: saída 0; `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; 68 arquivos, 791 passaram e 8 pularam.

- [ ] **Passo 3: as mutações (Apêndice A)**

```bash
node <pasta>/mutar-preparacao.mjs --conferir   # 7 "ÚNICO"
node <pasta>/mutar-preparacao.mjs
```

Esperado: as 7 como "MORTA", e "7 mutações, 0 ruins; árvore no fim: limpa".

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat 56cd72a HEAD
```

Esperado: os 7 arquivos do mapa, e mais nenhum: "7 files changed, 415 insertions(+), 25 deletions(-)". O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio: `1cc18e14dbd9`, `4a13d4071180` e `0021100894e8`.

---

### FASE 5 — O push, o preview, o PR e o deploy

Cada passo que sai da máquina tem o OK do Eduardo pela caixa, e a auditoria acompanha.

- [ ] **Passo 1: o push da branch, com o OK do Eduardo**

```bash
git ls-remote origin refs/heads/preparacao-tipos-da-fila   # vazio; se não estiver, pare
git push -u origin refs/heads/preparacao-tipos-da-fila:refs/heads/preparacao-tipos-da-fila
```

No log do build do preview, confira: o commit, nenhum aviso do Node 26, "Detected Next.js version: 16.4.3", "MIGRAÇÃO PULADA" e as rotas de sempre.

Não há prova no navegador: nada muda na tela. O preview usa o banco de produção, e o dreno dele, com este código, drena as linhas da produção como o da `main` drena hoje (os tipos de hoje são os mesmos).

- [ ] **Passo 2: o PR, com o OK do Eduardo.** O corpo leva o que muda, os números deste plano, a armadilha do teste (a conta que precisa existir) e nenhuma arroba solta. A mensagem do merge vai à parte, e a auditoria lê os dois antes de o PR abrir. O merge é do Eduardo.

- [ ] **Passo 3: o deploy do merge.**
  - No log: "Nada a aplicar: as 24 migrações já constam no registro.", e "CONFERIDO no banco: queue.queue_kind_check existe e confere (010-fila-publicacao.sql)", sem o aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.
  - A auditoria lê a fila antes e depois: as linhas dos tipos de hoje continuam saindo (posts e mensagens enviados depois do deploy), e nada fica preso em `pending` vencido.
  - Os registros da produção da primeira hora, sem erro novo.

Com a preparação em produção, a entrega do LinkedIn pode aplicar a 024 à mão.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa.

```js
// AS MUTAÇÕES DA PREPARAÇÃO NA MAIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §0), no molde de
// mutar-contas.mjs. Cada uma desfaz UMA trava, trocando um trecho exato de um arquivo (que tem de aparecer uma
// vez só), roda só o arquivo de teste que a cobre e confere que o caso NOMEADO cai, pelo nome inteiro. As de
// integração rodam contra o banco de TESTE, uma de cada vez. A árvore tem de estar commitada e limpa antes, e
// volta limpa no fim.
//
// Uso, da raiz da cópia: node ../mutar-preparacao.mjs [prefixo-do-nome]
//                        node ../mutar-preparacao.mjs --conferir   (só confere que cada trecho aparece uma vez)
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { config: null };
const INTEG = { config: "vitest.integracao.config.ts" };

const T_LISTA = { ...PURO, arquivo: "tests/fila-tipos.test.ts" };
const T_DRENO = { ...INTEG, arquivo: "testes-integracao/dreno-tipo-desconhecido.integracao.ts" };
const T_CONFERENCIA = { ...INTEG, arquivo: "testes-integracao/conferencia-do-kind.integracao.ts" };

const CASO_DO_DRENO = "a linha de tipo desconhecido fica pending e intocada, e a de tipo conhecido sai";
const CASO_DA_LISTA = "são exatamente os do queue_kind_check da última migração que o escreve";

const MUTACOES = [
  {
    nome: "D1: a seleção do dreno sem o filtro de tipos",
    arq: "lib/queue-drain.ts",
    de: "           and kind = any($3::text[])\n",
    para: "",
    teste: T_DRENO,
    cai: CASO_DO_DRENO,
  },
  {
    nome: "D2: o rodapé do tique sem o filtro de tipos",
    arq: "lib/queue-drain.ts",
    de: "      and kind = any(${Array.from(TIPOS_QUE_O_DRENO_CONHECE)}::text[])\n",
    para: "",
    teste: T_DRENO,
    cai: "o rodapé não arma tique por uma linha de tipo desconhecido",
  },
  {
    nome: "D3: a seleção só com a publicação (os tipos de hoje deixam de sair)",
    arq: "lib/queue-drain.ts",
    de: "[BATCH_SIZE, blocked, Array.from(TIPOS_QUE_O_DRENO_CONHECE)]",
    para: '[BATCH_SIZE, blocked, ["publicacao"]]',
    teste: T_DRENO,
    cai: CASO_DO_DRENO,
  },
  {
    nome: "L1: a lista sem um tipo do banco",
    arq: "lib/fila-tipos.ts",
    de: '  "dm_lote",\n',
    para: "",
    teste: T_LISTA,
    cai: CASO_DA_LISTA,
  },
  {
    nome: "L2: a lista com um tipo que o banco não tem",
    arq: "lib/fila-tipos.ts",
    de: '  "publicacao",\n] as const;',
    para: '  "publicacao",\n  "publicacao_linkedin",\n] as const;',
    teste: T_LISTA,
    cai: CASO_DA_LISTA,
  },
  {
    nome: "C1: a conferência sem a forma da 024",
    arq: "scripts/migrar.mjs",
    de: "  const formas = [{ de, definicao }, ...tambemAceitas];",
    para: "  const formas = [{ de, definicao }];",
    teste: T_CONFERENCIA,
    cai: "a forma da 024, com o publicacao_linkedin, também confere",
  },
  {
    nome: "C2: a conferência aceitando qualquer texto",
    arq: "scripts/migrar.mjs",
    de: "  const casada = formas.find((f) => f.definicao === achadas[0].definicao);",
    para: "  const casada = formas[0];",
    teste: T_CONFERENCIA,
    cai: "uma terceira forma continua divergindo, e derruba o script",
  },
];

const semCor = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
/** Os nomes dos casos que caíram: as linhas do `×`, sem o sinal e sem a duração do fim. */
const casosQueCairam = (saida) =>
  saida
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("×"))
    .map((l) => l.replace(/^×\s*/, "").replace(/\s+\d+(\.\d+)?\s*m?s$/, "").trim());

const conferir = process.argv[2] === "--conferir";
const filtro = conferir ? undefined : process.argv[2];
const inicio = Date.now();
let ruins = 0;
let rodadas = 0;
for (const m of MUTACOES) {
  if (filtro && !m.nome.startsWith(filtro)) continue;
  rodadas++;
  const original = readFileSync(m.arq, "utf8");
  // A PASTA PODE ESTAR EM CRLF (autocrlf=true; o blob é LF). O trecho segue o fim de linha do arquivo.
  const crlf = original.includes("\r\n");
  const ajusta = (s) => (crlf ? s.replace(/\r?\n/g, "\r\n") : s);
  const de = ajusta(m.de);
  const vezes = original.split(de).length - 1;
  if (vezes !== 1) {
    console.log(`RUIM  ${m.nome}: o trecho aparece ${vezes} vez(es) em ${m.arq}`);
    ruins++;
    continue;
  }
  if (conferir) {
    console.log(`ÚNICO ${m.nome}`);
    continue;
  }
  const t0 = Date.now();
  let r;
  try {
    writeFileSync(m.arq, original.replace(de, () => ajusta(m.para)));
    const args = ["vitest", "run", ...(m.teste.config ? ["--config", m.teste.config] : []), m.teste.arquivo];
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.AI_AGENT;
    if (m.teste.config === INTEG.config) env.DATABASE_URL_TESTES = TESTES_URL;
    r = spawnSync("npx", args, { encoding: "utf8", shell: true, env, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  } finally {
    writeFileSync(m.arq, original);
  }
  const saida = semCor(`${r.stdout}\n${r.stderr}`);
  const alvoOk = m.teste.config !== INTEG.config || saida.includes("ALVO: banco de TESTE");
  const cairam = casosQueCairam(saida);
  const caiu = cairam.includes(m.cai);
  const outros = cairam.filter((c) => c !== m.cai).length;
  const ok = alvoOk && r.status !== 0 && caiu;
  if (!ok) ruins++;
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(
    `${ok ? "MORTA" : "RUIM "} ${m.nome}  (saída ${r.status}, alvo ok: ${alvoOk}, caiu o caso: ${caiu}, outros que caíram: ${outros}, ${s}s)`
  );
  if (!ok) console.log(`      casos que caíram: ${cairam.length ? cairam.join(" | ") : "nenhum"}`);
}
const total = Math.round((Date.now() - inicio) / 1000);
console.log(
  `${rodadas} mutações, ${ruins} ruins; árvore no fim: ${status() === "" ? "limpa" : "SUJA"}${conferir ? " (só a conferência dos trechos)" : `; ${Math.floor(total / 60)} min ${total % 60} s`}`
);
```
