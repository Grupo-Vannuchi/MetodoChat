# Envio em lote por categoria — plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`).

**Objetivo:** o dono manda uma mensagem para uma categoria; quem está na janela
de 24h recebe na hora, e para quem não está a mensagem **espera** a pessoa voltar
a falar, até uma validade.

**Arquitetura:** nenhuma tabela nova. Um lote é N itens de `queue` do tipo novo
`dm_lote`, com o texto, o link e a validade no `payload`. As mudanças no motor
são duas: item de lote fora da janela fica `pending` e DORME um dia em vez de ser
descartado, e `upsertContact` o ACORDA quando a pessoa fala. As decisões são
funções puras em `lib/lote.ts`, com teste.

**Ferramentas:** Next.js 16.2.10 (App Router, Server Actions), Postgres via
`postgres.js`, Tailwind, Vitest.

**Especificação:** `docs/specs/2026-09-01-envio-em-lote.md`

## Restrições globais

- **A suíte NÃO testa componente.** Toda decisão sai do JSX e vira função pura
  com caso em `tests/`.
- **A janela de 24h tem UMA fonte: `windowState`** (`lib/inbox-window.ts`) — a
  mesma que `lib/queue-drain.ts` usa para recusar. Nenhum SQL de 24h cravado.
- **A espera é SÓ para `dm_lote`.** Todo outro tipo continua sendo descartado ao
  perder a janela. Mudar isso alteraria comportamento que ninguém pediu.
- **Nada de disparo real em cliente.** Teste com envio de verdade usa as contas
  conectadas entre si. A suíte de integração não manda nada para fora.
- **Migração é imutável depois de aplicada** — mudança é arquivo NOVO.
- **`lib/steps.ts` não tem NENHUM import.**
- **Em produção, não mexer em automação existente.**
- **A `DATABASE_URL` pode ser usada, nunca impressa.** Não ler `ADMIN_PASSWORD`.
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`.
- Comentários em português. Commits em português **sem acentos**, sem trailer.

## Estrutura de arquivos

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `lib/lote.ts` (novo) | quem recebe agora, quem espera, validade, o payload | 1 |
| `tests/lote.test.ts` (novo) | os casos das decisões | 1 |
| `migrations/008-fila-tipo-lote.sql` (novo) | o tipo `dm_lote` na restrição | 2 |
| `scripts/migrar.mjs` | a definição nova de `queue_kind_check` | 2 |
| `lib/esquema.ts` | a `008` na marca d'água | 2 |
| `lib/engine.ts` | `enqueueLote`, ao lado de `enqueueManualReply` | 2 |
| `lib/queue-drain.ts` | item de lote dorme em vez de ser descartado; validade cancela | 3 |
| `lib/engine.ts` | `upsertContact` acorda o item quando a pessoa fala | 3 |
| `testes-integracao/lote.integracao.ts` (novo) | o motor esperando e soltando | 3 |
| `app/contatos/page.tsx` | o formulário, os números, a confirmação | 4 |
| `app/contatos/actions.ts` | a ação que enfileira | 4 |

---

### Tarefa 1: Quem recebe agora, quem espera, e até quando

**Arquivos:**
- Criar: `lib/lote.ts`
- Criar: `tests/lote.test.ts`

**Interfaces:**
- Consome: `windowState` de `@/lib/inbox-window`.
- Produz: `PayloadDoLote`, `payloadDoLote`, `lerPayloadDoLote`,
  `DestinoDoLote`, `destinoDoLote`, `loteExpirou`.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `tests/lote.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  destinoDoLote,
  lerPayloadDoLote,
  loteExpirou,
  payloadDoLote,
} from "@/lib/lote";

// ============================================================
// QUEM RECEBE AGORA E QUEM ESPERA — a decisão mais perigosa deste projeto.
//
// Este é o primeiro recurso do produto que manda mensagem para muita gente de
// uma vez. Um erro aqui não é uma mensagem errada, são quarenta, saindo do
// perfil de verdade para clientes de verdade.
//
// Medido em produção (01/09/2026): 126 contatos, 9 alcançáveis — 7,1%.
// ============================================================
const AGORA = new Date("2026-09-01T12:00:00Z").getTime();
const HORAS = (h: number) => new Date(AGORA - h * 3_600_000);

describe("destinoDoLote", () => {
  it("separa quem está na janela de quem vai esperar", () => {
    const d = destinoDoLote(
      [
        { ig_id: "a", last_reply_at: HORAS(1), recebidas: 5 },
        { ig_id: "b", last_reply_at: HORAS(30), recebidas: 5 },
        { ig_id: "c", last_reply_at: null, recebidas: 0 },
      ],
      AGORA
    );
    expect(d.agora).toEqual(["a"]);
    expect(d.esperam).toEqual(["b", "c"]);
  });

  // A MESMA MARGEM DO MOTOR. `windowState` fecha 5 minutos antes das 24h, e
  // `lib/queue-drain.ts` usa exatamente essa função para RECUSAR um envio. Uma
  // regra própria aqui faria a tela prometer alcance que o motor recusa.
  it("quem está nos últimos 5 minutos da janela ESPERA, não recebe agora", () => {
    const d = destinoDoLote(
      [{ ig_id: "a", last_reply_at: new Date(AGORA - (24 * 60 - 2) * 60_000), recebidas: 3 }],
      AGORA
    );
    expect(d.agora).toEqual([]);
    expect(d.esperam).toEqual(["a"]);
  });

  // O TERCEIRO NÚMERO É PALPITE, E A FUNÇÃO NÃO PODE FINGIR O CONTRÁRIO.
  // Medido: 48 de 120 pessoas falaram uma única vez na vida. Elas contam como
  // "provavelmente nunca" — mas continuam DENTRO de `esperam`, porque podem
  // voltar amanhã. O número é informativo, e não um terceiro balde.
  it("os improváveis são um subconjunto de quem espera, e não um balde à parte", () => {
    const d = destinoDoLote(
      [
        { ig_id: "a", last_reply_at: HORAS(30), recebidas: 1 },
        { ig_id: "b", last_reply_at: HORAS(30), recebidas: 9 },
      ],
      AGORA
    );
    expect(d.esperam).toEqual(["a", "b"]);
    expect(d.improvaveis).toBe(1);
    expect(d.agora.length + d.esperam.length).toBe(2);
  });

  it("quem recebe agora nunca conta como improvável, mesmo tendo falado uma vez", () => {
    const d = destinoDoLote([{ ig_id: "a", last_reply_at: HORAS(1), recebidas: 1 }], AGORA);
    expect(d.agora).toEqual(["a"]);
    expect(d.improvaveis).toBe(0);
  });

  it("lista vazia não estoura e não inventa ninguém", () => {
    expect(destinoDoLote([], AGORA)).toEqual({ agora: [], esperam: [], improvaveis: 0 });
  });
});

describe("loteExpirou", () => {
  it("sem prazo nunca expira", () => {
    expect(loteExpirou(null, AGORA)).toBe(false);
  });

  it("antes da data, vale; depois, não", () => {
    expect(loteExpirou("2026-09-02T12:00:00.000Z", AGORA)).toBe(false);
    expect(loteExpirou("2026-08-31T12:00:00.000Z", AGORA)).toBe(true);
  });

  // O CASO DA BORDA, e ele importa: a validade é o último instante em que a
  // mensagem ainda faz sentido. Expirar exatamente nela cancelaria um envio que
  // o dono considera válido.
  it("no instante exato da validade, ainda vale", () => {
    expect(loteExpirou(new Date(AGORA).toISOString(), AGORA)).toBe(false);
  });

  it("data inválida NÃO expira o lote, e isso é escolha", () => {
    // Tratar lixo como "expirado" cancelaria envios em silêncio. Tratar como
    // "sem prazo" mantém a mensagem viva, e o dono vê que ela não venceu.
    expect(loteExpirou("nao e uma data", AGORA)).toBe(false);
    expect(loteExpirou("", AGORA)).toBe(false);
  });
});

// ============================================================
// A COSTURA DO PAYLOAD, e ela mora aqui pelo mesmo motivo das portas de entrada:
// quem escreve e quem lê estão em arquivos diferentes, ligados por STRING. Um
// `s` a mais de um lado não é erro de tipo nem de lint — é um campo que volta
// vazio, e neste caso seria uma mensagem em branco para quarenta pessoas.
// ============================================================
describe("payloadDoLote e lerPayloadDoLote", () => {
  it("o que escreve, lê de volta igual", () => {
    const p = payloadDoLote({
      loteId: "L1",
      text: "A turma abre segunda",
      url: "https://exemplo.invalid/turma",
      buttonLabel: "Quero entrar",
      validoAte: "2026-09-10T00:00:00.000Z",
    });
    expect(lerPayloadDoLote(p)).toEqual({
      loteId: "L1",
      text: "A turma abre segunda",
      url: "https://exemplo.invalid/turma",
      buttonLabel: "Quero entrar",
      validoAte: "2026-09-10T00:00:00.000Z",
    });
  });

  it("sem link e sem prazo também volta igual", () => {
    const p = payloadDoLote({ loteId: "L2", text: "Segue o material", validoAte: null });
    const lido = lerPayloadDoLote(p);
    expect(lido?.text).toBe("Segue o material");
    expect(lido?.url).toBeUndefined();
    expect(lido?.validoAte).toBe(null);
  });

  // O DRENO LÊ `p.url` PARA DECIDIR O FORMATO DA MENSAGEM (lib/queue-drain.ts):
  // com url ele monta mensagem com botão; sem url, texto puro. Gravar a chave
  // com url vazia faria toda mensagem de lote virar botão para lugar nenhum.
  it("url em branco não vira chave `url` no payload", () => {
    const p = payloadDoLote({ loteId: "L3", text: "oi", url: "   ", validoAte: null });
    expect("url" in p).toBe(false);
  });

  it("payload que não é do lote devolve null em vez de meia informação", () => {
    expect(lerPayloadDoLote(null)).toBe(null);
    expect(lerPayloadDoLote({})).toBe(null);
    expect(lerPayloadDoLote({ text: "sem lote_id" })).toBe(null);
    expect(lerPayloadDoLote("texto")).toBe(null);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npx vitest run tests/lote.test.ts`
Esperado: FALHA na importação — `lib/lote.ts` não existe.

- [ ] **Passo 3: Escrever o módulo**

Criar `lib/lote.ts`:

```ts
import { windowState } from "./inbox-window";

// O ENVIO EM LOTE, e as decisões dele fora do JSX e fora do motor.
//
// ESTE É O PRIMEIRO RECURSO DO PRODUTO QUE MANDA MENSAGEM PARA MUITA GENTE DE
// UMA VEZ. Tudo até aqui responde a quem falou primeiro. Isso muda o que um
// defeito custa: um erro aqui não é uma mensagem errada, são quarenta — saindo
// do perfil de verdade, para clientes de verdade. Por isso as três decisões
// (quem recebe, quem espera, até quando vale) moram aqui, com caso para cada
// saída, e não espalhadas pela tela e pelo dreno.

/** O que vai no `payload` de cada item de fila do lote. */
export type PayloadDoLote = {
  lote_id: string;
  text: string;
  url?: string;
  button_label?: string;
  valido_ate: string | null;
};

/**
 * Monta o payload. É a ÚNICA função que escreve estas chaves.
 *
 * `url` em branco NÃO vira chave: `lib/queue-drain.ts` decide o formato da
 * mensagem por `p.url` — com url monta botão, sem url manda texto puro. Uma
 * url vazia faria toda mensagem de lote virar um botão para lugar nenhum.
 */
export function payloadDoLote(dados: {
  loteId: string;
  text: string;
  url?: string;
  buttonLabel?: string;
  validoAte: string | null;
}): PayloadDoLote {
  const url = (dados.url ?? "").trim();
  const rotulo = (dados.buttonLabel ?? "").trim();
  return {
    lote_id: dados.loteId,
    text: dados.text,
    ...(url ? { url } : {}),
    ...(url && rotulo ? { button_label: rotulo } : {}),
    valido_ate: dados.validoAte,
  };
}

/** Lê o payload de volta. `null` quando não é um item de lote. */
export function lerPayloadDoLote(bruto: unknown): {
  loteId: string;
  text: string;
  url?: string;
  buttonLabel?: string;
  validoAte: string | null;
} | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const p = bruto as Record<string, unknown>;
  if (typeof p.lote_id !== "string" || !p.lote_id) return null;
  if (typeof p.text !== "string") return null;
  return {
    loteId: p.lote_id,
    text: p.text,
    ...(typeof p.url === "string" && p.url ? { url: p.url } : {}),
    ...(typeof p.button_label === "string" && p.button_label
      ? { buttonLabel: p.button_label }
      : {}),
    validoAte: typeof p.valido_ate === "string" ? p.valido_ate : null,
  };
}

export type DestinoDoLote = {
  /** ig_ids que recebem agora — a janela está aberta. */
  agora: string[];
  /** ig_ids cuja mensagem fica guardada até eles voltarem a falar. */
  esperam: string[];
  /**
   * Quantos dos que ESPERAM provavelmente nunca receberão.
   *
   * É PALPITE, e a tela tem de dizer isso. Conta quem tem uma única mensagem
   * recebida em todo o histórico — medido em 01/09/2026: 48 de 120 pessoas.
   * Eles continuam dentro de `esperam`, porque podem voltar amanhã; este número
   * é informação, não um terceiro balde, e não se subtrai dos outros dois.
   */
  improvaveis: number;
};

/**
 * Quem recebe agora e quem espera.
 *
 * A JANELA VEM DE `windowState`, a MESMA função que `lib/queue-drain.ts` usa
 * para RECUSAR um envio — ela fecha 5 minutos antes das 24h. Uma regra própria
 * aqui faria a tela prometer alcance que o motor recusa, no exato caso em que
 * ninguém conseguiria reproduzir: a faixa dura cinco minutos e some sozinha.
 */
export function destinoDoLote(
  contatos: { ig_id: string; last_reply_at: Date | string | null; recebidas: number }[],
  agora: number = Date.now()
): DestinoDoLote {
  const destino: DestinoDoLote = { agora: [], esperam: [], improvaveis: 0 };
  for (const c of contatos) {
    if (windowState(c.last_reply_at, agora).open) {
      destino.agora.push(c.ig_id);
      continue;
    }
    destino.esperam.push(c.ig_id);
    if (c.recebidas <= 1) destino.improvaveis += 1;
  }
  return destino;
}

/**
 * O lote já venceu?
 *
 * `null` é "sem prazo", e nunca vence — é o valor que atende o conteúdo que não
 * envelhece ("segue o material"), sem exigir um segundo mecanismo.
 *
 * DATA INVÁLIDA NÃO EXPIRA, e isso é escolha: tratar lixo como "vencido"
 * cancelaria envios em silêncio, que é a falha muda que este produto passou
 * semanas fechando. Tratar como "sem prazo" mantém a mensagem viva e visível.
 */
export function loteExpirou(validoAte: string | null, agora: number = Date.now()): boolean {
  if (!validoAte) return false;
  const t = new Date(validoAte).getTime();
  if (!Number.isFinite(t)) return false;
  return agora > t;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npx vitest run tests/lote.test.ts`
Esperado: PASSA, com 13 casos.

- [ ] **Passo 5: Commitar**

```bash
git add lib/lote.ts tests/lote.test.ts
git commit -m "As decisoes do envio em lote nascem puras, com caso para cada saida"
```

---

### Tarefa 2: O tipo novo na fila, e o enfileirador

**Arquivos:**
- Criar: `migrations/008-fila-tipo-lote.sql`
- Modificar: `scripts/migrar.mjs` (a definição de `queue_kind_check` em `ESPERADAS_RESTRICOES`)
- Modificar: `lib/esquema.ts` (a `008` em `naoObservaveis`)
- Modificar: `lib/db.ts` (o tipo `QueueItem["kind"]`)
- Modificar: `lib/engine.ts` (`enqueueLote`, ao lado de `enqueueManualReply`)

**Interfaces:**
- Consome: `payloadDoLote` de `@/lib/lote`.
- Produz: `enqueueLote(accountId: string, loteId: string, contatos: string[], payloadBase: {...}) => Promise<number>`, exportada de `lib/engine.ts`.

- [ ] **Passo 1: Escrever a migração**

Criar `migrations/008-fila-tipo-lote.sql`:

```sql
-- O TIPO `dm_lote` ENTRA NA FILA.
--
-- A `004` é o precedente exato: ela já reescreveu esta mesma restrição uma vez,
-- de cinco tipos para nove, e o comentário dela explica que `add constraint`
-- VALIDA as linhas existentes — num banco com `kind` fora da lista, isto falha
-- alto em vez de passar calado.
--
-- ALARGAR É SEGURO EM UM DEPLOY SÓ, e o motivo é a direção: o código ANTIGO
-- nunca escreve `dm_lote`, então ele continua funcionando contra a restrição
-- nova. Estreitar seria o caso perigoso — e foi por isso que a remoção das
-- colunas mortas (006) precisou de dois deploys.

alter table queue drop constraint if exists queue_kind_check;

alter table queue add constraint queue_kind_check check (kind in (
  'private_reply','comment_reply','dm_welcome','dm_link','dm_reminder',
  'dm_follow_gate','dm_email_ask','story_reaction','dm_manual','dm_lote'
));
```

- [ ] **Passo 2: Declarar nas duas conferências**

Em `scripts/migrar.mjs`, na entrada de `queue_kind_check` dentro de
`ESPERADAS_RESTRICOES`, trocar `de` para `"008-fila-tipo-lote.sql"` e
acrescentar `'dm_lote'::text` ao fim da lista da `definicao`:

```js
    definicao:
      "CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, " +
      "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
      "'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, " +
      "'dm_manual'::text, 'dm_lote'::text])))",
```

Em `lib/esquema.ts`, acrescentar ao fim da lista `naoObservaveis`:

```ts
    {
      de: "008-fila-tipo-lote.sql",
      porque: "reescreve a definição de um `check` que já existe (9 tipos -> 10)",
    },
```

**Ela vai para `naoObservaveis` e NÃO para `colunas`:** não cria coluna nem
tabela, e presença não distingue a definição velha da nova — exatamente como a
`004`, que está duas entradas acima com o mesmo texto.

- [ ] **Passo 3: Acrescentar o tipo ao `QueueItem`**

Em `lib/db.ts`, no tipo `QueueItem`, acrescentar `| "dm_lote"` ao fim da união
de `kind`.

- [ ] **Passo 4: Conferir com o ensaio a seco**

Rodar: `node scripts/migrar.mjs`
Esperado: `►    008-fila-tipo-lote.sql` na lista do que rodaria, e a linha
`CONFERIDO no banco: queue.queue_kind_check existe, MAS DIVERGE` — que é o
esperado no ensaio, porque o banco ainda tem a definição de nove tipos.

- [ ] **Passo 5: Escrever o enfileirador**

Em `lib/engine.ts`, logo depois de `enqueueManualReply`, acrescentar:

```ts
// O ENVIO EM LOTE.
//
// Entra na MESMA fila do resto, pelo mesmo motivo escrito em
// `enqueueManualReply`: herda a trava atômica, o teto de ~190 envios/hora por
// conta, as novas tentativas e a checagem de janela. Um caminho paralelo teria
// de reimplementar tudo isso, e erraria em algum ponto.
//
// SÓ O MAIS RECENTE ESPERA. Antes de enfileirar, os itens de lote que estavam
// GUARDADOS para cada um destes contatos são cancelados. Sem isso, a pessoa que
// some por uma semana e volta recebe três mensagens seguidas de uma conta que
// ficou muda — o comportamento que faz gente bloquear perfil.
//
// O cancelamento é `skipped` e não `failed`: não houve erro, houve decisão.
export async function enqueueLote(
  accountId: string,
  loteId: string,
  contatos: string[],
  base: { text: string; url?: string; buttonLabel?: string; validoAte: string | null }
): Promise<number> {
  if (!contatos.length) return 0;

  await sql().query(
    `update queue set status = 'skipped', error = 'substituido por um lote mais novo'
      where account_id = $1 and kind = 'dm_lote' and status = 'pending'
        and contact_ig_id = any($2::text[])`,
    [accountId, contatos]
  );

  let enfileirados = 0;
  for (const contato of contatos) {
    const entrou = await enqueue({
      account_id: accountId,
      kind: "dm_lote",
      contact_ig_id: contato,
      payload: payloadDoLote({ loteId, ...base }),
      // O identificador do lote entra na chave: dois lotes diferentes para a
      // mesma pessoa são dois itens, e o mesmo lote duas vezes (clique duplo em
      // confirmar) é um só.
      dedupe_key: `lote:${loteId}:${contato}`,
    });
    if (entrou) enfileirados++;
  }
  return enfileirados;
}
```

E acrescentar ao import de `./lote` no topo de `lib/engine.ts`:

```ts
import { payloadDoLote } from "./lote";
```

- [ ] **Passo 6: Rodar os portões**

```bash
npm run lint && npm run typecheck && npx vitest run
```
Esperado: os três limpos, e a contagem de testes puros sem mudança (esta tarefa
não acrescenta decisão pura).

- [ ] **Passo 7: Commitar**

```bash
git add migrations/008-fila-tipo-lote.sql scripts/migrar.mjs lib/esquema.ts lib/db.ts lib/engine.ts
git commit -m "A fila aprende o tipo de lote, e so o mais recente fica guardado"
```

---

### Tarefa 3: O dreno espera em vez de descartar

**Arquivos:**
- Modificar: `lib/queue-drain.ts`
- Criar: `testes-integracao/lote.integracao.ts`

**Interfaces:**
- Consome: `lerPayloadDoLote` e `loteExpirou` de `@/lib/lote`.

- [ ] **Passo 1: Mudar a decisão do dreno**

Em `lib/queue-drain.ts`, no laço de `drainQueue`, o trecho de hoje é:

```ts
      } else {
        await finish(item.id, { status: "skipped", error: "janela de 24h fechada" });
        result.skipped++;
      }
```

Trocar por:

```ts
      } else if (item.kind === "dm_lote") {
        // O ITEM DE LOTE ESPERA, e é só isto que este projeto muda no motor.
        //
        // Todo outro tipo continua sendo DESCARTADO ao perder a janela, e isso
        // é deliberado: medido em 01/09/2026, a janela descartou 6 itens na
        // vida inteira do produto, quase sempre porque a automação disparou
        // para alguém cuja conversa já tinha esfriado. Fazer esses esperarem
        // entregaria uma boas-vindas dias depois, fora de contexto.
        //
        // A MÁQUINA DE ESPERAR JÁ EXISTE: é o mesmo `pending` que o `catch`
        // logo abaixo usa para tentar de novo. E quem acorda o item não é
        // relógio nenhum — `drainQueue` roda DENTRO do webhook
        // (`app/api/webhook/route.ts`, no `after()`), e o `last_reply_at` do
        // contato é gravado ANTES disso. Quando a pessoa escreve, a janela dela
        // abre e o dreno roda em seguida: o item guardado encontra a janela
        // aberta sem precisar de tarefa agendada.
        const doLote = lerPayloadDoLote(item.payload);
        if (loteExpirou(doLote?.validoAte ?? null)) {
          await finish(item.id, { status: "skipped", error: "o lote venceu antes de a pessoa voltar" });
          result.skipped++;
        } else {
          // O ITEM DORME UM DIA, E NAO ate ja — e este numero e o conserto de um
          // defeito que a primeira versao deste plano tinha.
          //
          // A selecao do dreno e `status = 'pending' and not_before <= now()`,
          // `order by created_at`, `limit 15`. Um item guardado com `not_before`
          // no passado e SEMPRE elegivel e e o MAIS ANTIGO: com quarenta
          // esperando, todo dreno pegaria os quinze mais velhos, veria a janela
          // fechada, os devolveria para a fila — e NUNCA chegaria nas mensagens
          // de verdade. Fome de fila, e o produto inteiro pararia de responder.
          //
          // Dormir um dia tira o item da disputa. Quem o acorda no instante
          // certo nao e este numero: e `upsertContact` (lib/engine.ts), que
          // adianta o `not_before` dos itens de lote da pessoa quando ela fala.
          // O dia e so a rede de seguranca, para o caso de o despertar falhar.
          await finish(item.id, {
            status: "pending",
            retryInSeconds: 86400,
            error: "guardado ate a pessoa voltar a falar",
          });
        }
      } else {
        await finish(item.id, { status: "skipped", error: "janela de 24h fechada" });
        result.skipped++;
      }
```

E acrescentar ao topo do arquivo:

```ts
import { lerPayloadDoLote, loteExpirou } from "./lote";
```

- [ ] **Passo 2: Acordar o item quando a pessoa fala**

Em `lib/engine.ts`, dentro de `upsertContact` (linha 307), depois do
`insert ... on conflict` que já existe, acrescentar:

```ts
  // O DESPERTAR DO LOTE, e ele mora aqui porque este é o ÚNICO ponto do produto
  // por onde uma janela abre: os dois caminhos de mensagem recebida chamam esta
  // função com `last_reply_at`, e nenhum outro chamador o faz.
  //
  // Um item de lote guardado dorme um dia (lib/queue-drain.ts) para não sufocar
  // a fila. Esta linha o adianta no instante em que a pessoa fala — e o dreno
  // roda logo depois, no mesmo webhook (`after()` de app/api/webhook/route.ts),
  // já com a janela aberta.
  //
  // A CONDIÇÃO É `last_reply_at`, e não "sempre": `upsertContact` também é
  // chamada para gravar nome, foto e última automação, e nesses casos nenhuma
  // janela abriu. Acordar ali gastaria uma escrita e devolveria o item à
  // disputa por nada.
  if (fields.last_reply_at) {
    await sql().query(
      `update queue set not_before = now()
        where account_id = $1 and contact_ig_id = $2
          and kind = 'dm_lote' and status = 'pending'`,
      [accountId, igId]
    );
  }
```

- [ ] **Passo 3: Conferir que compila**

```bash
npm run lint && npm run typecheck
```
Esperado: os dois limpos.

- [ ] **Passo 4: Escrever o teste de integração**

Criar `testes-integracao/lote.integracao.ts`. Ele segue o padrão de
`testes-integracao/portao-link.integracao.ts` — leia aquele arquivo primeiro:
ele monta um servidor local que faz o papel da Meta, prende `IG_GRAPH_BASE` ao
loopback com duas travas, e usa `bancoDescartavel()` do harness.

O caso central:

```ts
it("item de lote com a janela FECHADA fica guardado, e sai quando ela abre", async () => {
  const CONTATO = "9000000000000101";
  await semearContato(CONTATO, { horasDesdeAResposta: 48 });

  await engine.enqueueLote(CONTA, "L1", [CONTATO], {
    text: "A turma abre segunda",
    validoAte: null,
  });

  // Primeiro dreno: a janela está fechada.
  await drenar();
  expect(await estadoDoItem(CONTATO)).toBe("pending");
  expect(await enviadasPara(CONTATO)).toBe(0);

  // A pessoa volta a falar — é isto que o webhook faz antes de drenar.
  await abrirJanela(CONTATO);

  // Segundo dreno: agora sai.
  await drenar();
  expect(await estadoDoItem(CONTATO)).toBe("sent");
  expect(await enviadasPara(CONTATO)).toBe(1);
});

// O CONTROLE QUE IMPEDE A PROVA DE SER VAZIA: o mesmo cenário com um tipo que
// NÃO é lote continua sendo descartado. Sem este caso, "o item ficou pending"
// não distingue "o lote espera" de "o dreno parou de descartar tudo".
it("item que NÃO é lote continua sendo descartado na mesma situação", async () => {
  const CONTATO = "9000000000000102";
  await semearContato(CONTATO, { horasDesdeAResposta: 48 });
  await engine.enqueueManualReply(CONTA, CONTATO, "resposta escrita a mao");

  await drenar();
  expect(await estadoDoItem(CONTATO)).toBe("skipped");
});

it("lote vencido é cancelado em vez de sair atrasado", async () => {
  const CONTATO = "9000000000000103";
  await semearContato(CONTATO, { horasDesdeAResposta: 48 });
  await engine.enqueueLote(CONTA, "L2", [CONTATO], {
    text: "promocao que ja acabou",
    validoAte: new Date(Date.now() - 3_600_000).toISOString(),
  });

  await drenar();
  const item = await lerItem(CONTATO);
  expect(item.status).toBe("skipped");
  expect(item.error).toContain("venceu");
  expect(await enviadasPara(CONTATO)).toBe(0);
});

// O CASO QUE A PRIMEIRA VERSÃO DESTE PLANO NÃO TINHA, e ele existe porque o
// defeito era meu: itens guardados NÃO PODEM sufocar a fila. Sem o
// `retryInSeconds` de um dia, vinte itens de lote esperando ocupariam os quinze
// lugares de todo dreno, e a resposta de verdade nunca sairia.
it("vinte itens guardados nao impedem uma mensagem de verdade de sair", async () => {
  const ESPERANDO = Array.from({ length: 20 }, (_, i) => `90000000000002${String(i).padStart(2, "0")}`);
  for (const c of ESPERANDO) await semearContato(c, { horasDesdeAResposta: 48 });
  await engine.enqueueLote(CONTA, "L5", ESPERANDO, { text: "guardado", validoAte: null });
  await drenar(); // todos ficam pending e dormem

  const VIVO = "9000000000000299";
  await semearContato(VIVO, { horasDesdeAResposta: 0 });
  await engine.enqueueManualReply(CONTA, VIVO, "esta tem de sair agora");

  await drenar();
  expect(await estadoDoItem(VIVO)).toBe("sent");
});

it("um lote novo cancela o que estava guardado para a mesma pessoa", async () => {
  const CONTATO = "9000000000000104";
  await semearContato(CONTATO, { horasDesdeAResposta: 48 });

  await engine.enqueueLote(CONTA, "L3", [CONTATO], { text: "primeiro", validoAte: null });
  await drenar();
  expect(await estadoDoItem(CONTATO)).toBe("pending");

  await engine.enqueueLote(CONTA, "L4", [CONTATO], { text: "segundo", validoAte: null });

  const itens = await todosOsItens(CONTATO);
  expect(itens.filter((i) => i.status === "pending")).toHaveLength(1);
  const guardado = itens.find((i) => i.status === "pending")!;
  expect((guardado.payload as { text: string }).text).toBe("segundo");
  const cancelado = itens.find((i) => i.status === "skipped")!;
  expect(cancelado.error).toContain("substituido");
});
```

Os auxiliares (`semearContato`, `abrirJanela`, `drenar`, `estadoDoItem`,
`lerItem`, `todosOsItens`, `enviadasPara`) são escritos neste mesmo arquivo,
sobre `banco.db().sql()` e o servidor local — `portao-link.integracao.ts` tem os
equivalentes (`semear`, `fila`, `contato`, `mensagem`) para copiar a forma.
`abrirJanela` é um `update contacts set last_reply_at = now()`, que é exatamente
o que `upsertContact` faz quando a pessoa escreve.

- [ ] **Passo 5: Rodar a integração**

Rodar: `npm run test:integracao`
Esperado: os 4 casos novos passam, e os 61 de antes continuam passando.

- [ ] **Passo 6: Plantar os defeitos e medir**

Antes de commitar, **commite o que está pronto**, depois planta:

```bash
git add lib/queue-drain.ts testes-integracao/lote.integracao.ts
git commit -m "O item de lote espera a janela em vez de ser descartado"
```

**Plantio 1 — o lote volta a ser descartado.** Trocar `item.kind === "dm_lote"`
por `false`. Esperado: VERMELHO nos casos de lote.

**Plantio 2 — o item guardado não dorme.** Tirar o `retryInSeconds: 86400`.
Esperado: VERMELHO no caso da fome de fila. Se ficar VERDE, **diga**: significa
que aquele caso não mede o que promete, e o defeito que ele existe para pegar
continua solto.

**Plantio 3 — o despertar some.** Apagar o `update queue set not_before` de
`upsertContact`. Esperado: VERMELHO no caso "sai quando ela abre".

Reverter cada um na mesma chamada, com `git status --porcelain` vazio conferido
depois de cada um.

---

### Tarefa 4: A tela — compor, ver os números, confirmar

**Arquivos:**
- Modificar: `app/contatos/actions.ts`
- Modificar: `app/contatos/page.tsx`

**Interfaces:**
- Consome: `destinoDoLote` de `@/lib/lote`; `enqueueLote` de `@/lib/engine`;
  `filtroDaUrl` e `contatosDoFiltro` de `@/lib/categorias`.

- [ ] **Passo 1: A ação que enfileira**

Em `app/contatos/actions.ts`, acrescentar (o arquivo já tem `"use server"`,
`revalidatePath`, `sql` e `getSelectedAccount`):

```ts
/**
 * Enfileira um lote para os contatos do filtro atual.
 *
 * A CONFIRMAÇÃO É A ÚLTIMA COISA entre um engano e quarenta pessoas, e por isso
 * ela é um campo do formulário e não um `confirm()` do navegador: sem o campo
 * marcado, esta função não faz nada.
 *
 * O `account_id` no `where` vem do cookie, nunca do formulário — o mesmo
 * cuidado de `definirCategoria`.
 */
export async function enviarLote(formData: FormData): Promise<void> {
  const account = await getSelectedAccount();
  if (!account) return;
  if (formData.get("confirmado") !== "1") return;

  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return;

  const url = String(formData.get("url") ?? "").trim();
  const rotulo = String(formData.get("rotulo") ?? "").trim();
  const prazo = String(formData.get("valido_ate") ?? "").trim();
  const filtro = filtroDaUrl(String(formData.get("categoria") ?? "") || undefined);

  const linhas = (await sql().query(
    `select c.ig_id, c.categoria, c.last_reply_at,
            (select count(*)::int from events e
              where e.account_id = c.account_id
                and e.payload->'sender'->>'id' = c.ig_id
                and e.type in ('message','story_reply','abertura','quick_reply')) as recebidas
       from contacts c where c.account_id = $1`,
    [account.ig_user_id]
  )) as { ig_id: string; categoria: string | null; last_reply_at: Date | null; recebidas: number }[];

  const alvo = contatosDoFiltro(linhas, filtro);
  if (!alvo.length) return;

  await enqueueLote(account.ig_user_id, crypto.randomUUID(), alvo.map((c) => c.ig_id), {
    text: texto,
    url: url || undefined,
    buttonLabel: rotulo || undefined,
    // Data vazia é "sem prazo", e não data inválida.
    validoAte: prazo ? new Date(prazo).toISOString() : null,
  });

  revalidatePath("/contatos");
  revalidatePath("/eventos");
}
```

E os imports novos no topo do arquivo:

```ts
import { enqueueLote } from "@/lib/engine";
import { contatosDoFiltro, filtroDaUrl } from "@/lib/categorias";
```

- [ ] **Passo 2: Os números e o formulário**

Em `app/contatos/page.tsx`, dentro do bloco que só existe quando há filtro
ativo, acrescentar — usando `destinoDoLote` sobre as linhas visíveis:

```tsx
        {/* MANDAR PARA ESTE RECORTE.
            Os dois primeiros números são fato; o terceiro é palpite, e a
            palavra "provavelmente" fica na tela por isso. Ele NÃO é subtraído
            dos outros dois: quem é improvável continua dentro de "esperam". */}
        <form action={enviarLote} className={`space-y-3 p-4 ${subtle}`}>
          <input type="hidden" name="categoria" value={sp.categoria ?? ""} />
          <p className="text-sm font-medium">
            Mandar mensagem para {visiveis.length}{" "}
            {visiveis.length === 1 ? "pessoa" : "pessoas"}
          </p>
          <ul className={`text-xs ${muted}`}>
            <li>{destino.agora.length} recebem agora</li>
            <li>{destino.esperam.length} quando voltarem a falar</li>
            <li>{destino.improvaveis} provavelmente nunca — falaram uma única vez</li>
          </ul>
          <textarea name="texto" required rows={3} className={`w-full ${input}`}
            placeholder="O que você quer dizer" />
          <input name="url" className={`w-full ${input}`} placeholder="Link (opcional)" />
          <input name="rotulo" className={`w-full ${input}`}
            placeholder="Texto do botão (só com link)" />
          <label className={`block text-xs ${muted}`}>
            Vale até (vazio = sem prazo)
            <input type="date" name="valido_ate" className={`mt-1 w-full ${input}`} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="confirmado" value="1" required />
            Confirmo que quero mandar para estas {visiveis.length} pessoas
          </label>
          <button type="submit" className={btnPrimary}>Enviar</button>
        </form>
```

**Os imports, conferidos:** `app/contatos/page.tsx` importa hoje `card`,
`btnGhost`, `muted`, `tableWrap`, `thead`, `rowDivide`, `badgeOk`,
`badgeNeutral` e `emptyWrap` de `../ui` — e **não** importa `subtle`, `input`
nem `btnPrimary`, que o formulário acima usa. Acrescentar os três a esse import.

E `enviarLote` de `./actions`, mais `destinoDoLote` de `@/lib/lote`.

**ATENCAO A ARMADILHA JA MEDIDA NESTA BASE:** compor `className` com `${input}`
empilhando a MESMA familia de classe (`w-*`, `px-*`, `rounded-*`) **nao
funciona** — quem decide o desempate e a ordem da folha gerada pelo Tailwind, e
nao a ordem no `className`. Se precisar de tamanho proprio, use o modificador
`!` (e o que `app/conversas/[id]/page.tsx` faz, e o porque esta escrito ao lado
de `input` em `app/ui.ts`).

E, junto de onde `fichas` é calculado:

```tsx
  const destino = destinoDoLote(
    visiveis.map((c) => ({
      ig_id: c.ig_id,
      last_reply_at: c.last_reply_at,
      recebidas: c.recebidas ?? 0,
    }))
  );
```

**A consulta da página precisa trazer `recebidas`.** Acrescentar à consulta que
já existe em `app/contatos/page.tsx` a mesma subconsulta usada na ação do
Passo 1, e o campo ao tipo `Row`.

- [ ] **Passo 3: Rodar os portões**

```bash
npm run lint && npm run typecheck && npx vitest run && npm run test:integracao
```
Esperado: os quatro limpos.

- [ ] **Passo 4: Commitar**

```bash
git add app/contatos/actions.ts app/contatos/page.tsx
git commit -m "A tela monta o lote, mostra os tres numeros e exige confirmacao"
```

---

## Como isto é provado na tela

**Nenhum disparo de teste vai para contato de cliente** — instrução do dono. O
teste usa as contas conectadas mandando mensagem entre si. Em 01/09 o dono abriu
as doze janelas de propósito; elas fecham sozinhas em 24 horas, o que dá as duas
metades do teste em momentos diferentes.

- [ ] Marcar as outras contas conectadas com uma categoria de teste.
- [ ] Com a janela ABERTA: mandar o lote e ver a mensagem chegar.
- [ ] Conferir na tela de envios que o item ficou `sent`.
- [ ] Com a janela FECHADA (24h depois, ou noutra conta): mandar e conferir que
      o item ficou `pending`, com "guardado ate a pessoa voltar a falar".
- [ ] Pedir ao dono que mande uma mensagem daquela conta pelo aplicativo, e
      conferir que o item guardado sai sozinho.
- [ ] Mandar um segundo lote para a mesma pessoa e conferir que o primeiro
      guardado foi cancelado com "substituido por um lote mais novo".
- [ ] Desmarcar as categorias de teste no fim.
