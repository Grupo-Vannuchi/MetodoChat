# Gerador de bônus — Plano de implementação da Etapa 2: o texto do carrossel

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** na página de um bônus publicado no Labs, o operador pede um carrossel de 1 a 10
slides; a IA escreve o texto, a chamada pede a palavra do bônus lida do Labs, e o operador revisa,
edita e copia cada peça.

**Arquitetura:** o molde da Etapa 1. Uma tabela da feature (`carrosseis_gerados`, ligada a
`bonus_gerados`) guarda o carrossel do pedido à revisão. A Server Action lê a situação do bônus no
Labs (a lista pública), cria o pedido sob uma trava própria de teto e agenda `after()`, que chama
a IA com as instruções do Labs trazidas como estão. Funções puras decidem a mensagem, as
conferências (número de slides, a palavra e nenhuma outra) e a revisão.

**Stack:** a mesma da Etapa 1: Next.js 16 (App Router, Server Actions, `after()`), React 19,
Postgres (postgres.js via `lib/db.ts`), `@anthropic-ai/sdk` com `betaZodOutputFormat`, `zod` 4,
Vitest (três suítes), Tailwind v4 com os tokens de `app/ui.ts`.

**Spec:** `docs/specs/2026-09-30-gerador-de-carrossel.md` (commits `2220779`, `85bbb99`, `92b5db5` e
o que registra o achado 51). Leia antes
de começar: este plano não repete o porquê das regras, só como construí-las.

**Ensaio do plano (30/09):** o código deste plano foi extraído bloco a bloco numa worktree à parte,
com as edições dos arquivos da Etapa 1 aplicadas. Typecheck e lint limpos; 80 arquivos e 2 207
casos puros; 11 arquivos e 71 casos de tela; 36 arquivos de integração no container; e as 17
provas de mutação deste plano derrubaram o caso esperado. O ensaio achou e corrigiu um defeito: o
teste da trava do teto deixava a transação aberta quando caía, e a rodada ficava parada por minutos
em vez de falhar.

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `gerador-de-carrossel`, saída da `main` em `689f93b`. Nunca commitar nem empurrar na
  `main`: ela não tem proteção e um push dispara deploy de produção. Conferir
  `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Conventional Commits, em português.** Sem `Co-Authored-By` e sem rodapé de IA. Autor:
  Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Se o
  scratchpad não existir mais, recrie o script a partir do apêndice A do plano da Etapa 1
  (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem
  está em CRLF, e o índice em LF (`git ls-files --eol` mostra `i/lf w/crlf`). Editar um deles pode
  deixar linhas LF no meio de linhas CRLF, e a varredura acusa fim de linha misturado. Nesse caso,
  converta a cópia inteira para LF com `node "$SCRATCH/para-lf.mjs" <arquivo>` e varra de novo: o
  índice guarda LF de qualquer jeito, e o template literal normaliza o CRLF em tempo de execução.
- **Pasta própria:** `app/bonus/` e `lib/bonus/`. Fora delas, só: `migrations/014-carrosseis-gerados.sql`,
  `lib/esquema.ts` (1 entrada em `naoObservaveis`), testes novos e `docs/`. Os arquivos da
  Etapa 1 que mudam: `lib/bonus/labs.ts` (1 palavra: `export` no `lerAteOTeto`),
  `lib/bonus/textos.ts` e `lib/bonus/tela.ts` (as frases do achado 43), `tests/bonus-tela.test.ts`
  (1 expectativa), `app/bonus/[id]/page.tsx` (o bloco do envio criado) e
  `testes-integracao/bonus-processo.integracao.ts` (o `finally` do achado 50, num commit próprio
  feito antes da FASE 2.1).
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`). Linha de base em 30/09, sobre `689f93b`: 70 arquivos / 2 077 casos
  puros; 10 arquivos / 69 casos de tela; 33 arquivos de integração.
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir
  `[rede-global] ALVO: banco de TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **Telas:** só os tokens de `app/ui.ts` e os degraus de `app/escala.ts`; nada de `indigo`,
  `violet` nem `purple`. `tests/escala.test.ts` e `tests/paleta.test.ts` varrem todo `app/`.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Modelo e relógios:** os da Etapa 1, importados de `lib/bonus/ia-parametros.ts` e
  `lib/bonus/tempos.ts`, nunca repetidos. `maxDuration = 300` na página nova.
- **Teto:** 10 pedidos de carrossel em 24 h, somando o painel inteiro, contados no relógio do
  banco, com `pg_advisory_xact_lock` numa chave **própria** (`2026093001`), diferente da do bônus.
- **A palavra é a do Labs.** Ela vem da lista pública (`lib/bonus/publicado.ts`), nunca do que o
  Chat guardou em `bonus_gerados`.
- **Jsonb recebe objeto cru**, nunca `JSON.stringify` (a lição da FASE 1.7).
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-cb`; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `migrations/014-carrosseis-gerados.sql` | a tabela | 2.1 |
| `lib/esquema.ts` (1 entrada) | a 014 declarada como não observável | 2.1 |
| `lib/bonus/carrossel-pedido.ts` | o pedido, o teto, o total de slides | 2.2 |
| `lib/bonus/publicado.ts` | a situação do bônus na lista pública do Labs | 2.3 |
| `lib/bonus/labs.ts` (1 palavra) | `lerAteOTeto` exportado | 2.3 |
| `lib/bonus/instrucao-carrossel.ts`, `lib/bonus/instrucao-post.ts` | as instruções (do Labs) | 2.4 |
| `lib/bonus/carrossel-schema.ts` | o formato da saída da IA | 2.4 |
| `lib/bonus/carrossel-ia-parametros.ts` | a mensagem e os parâmetros da chamada | 2.5 |
| `lib/bonus/carrossel-texto.ts` | o texto do carrossel: forma, conferências, campos e revisão | 2.5 |
| `lib/bonus/carrossel-ia.ts` | a chamada à IA (`server-only`) | 2.5 |
| `lib/bonus/carrossel-linha.ts` | o tipo da linha | 2.6 |
| `lib/bonus/carrossel-textos.ts` | toda frase do carrossel | 2.6 |
| `lib/bonus/carrossel-tela.ts` | o que a tela mostra para cada carrossel | 2.6 |
| `lib/bonus/textos.ts`, `lib/bonus/tela.ts` | as frases do achado 43 | 2.6 |
| `lib/bonus/carrossel-repositorio.ts` | o SQL (`server-only`) | 2.7 |
| `lib/bonus/carrossel-processo.ts` | gerar de ponta a ponta (`server-only`) | 2.7 |
| `app/bonus/carrossel-actions.ts` | as três actions | 2.8 |
| `app/bonus/[id]/no-labs.tsx` | o bônus criado: situação, link e carrosséis | 2.8 |
| `app/bonus/[id]/page.tsx` (1 bloco) | usa `no-labs.tsx` | 2.8 |
| `app/bonus/[id]/carrossel/[cid]/page.tsx`, `.../campo.tsx` | a página do carrossel e o campo com copiar | 2.8 |

---

## ETAPA 2 — o texto do carrossel

### FASE 2.1 — A tabela e a declaração

**Arquivos:**
- Criar: `migrations/014-carrosseis-gerados.sql`
- Modificar: `lib/esquema.ts` (1 entrada em `naoObservaveis`)
- Testar: `testes-integracao/bonus-carrossel-tabela.integracao.ts`

**Interfaces:**
- Produz: a tabela `carrosseis_gerados`, com as colunas `id`, `bonus_id`, `criado_em`,
  `total_slides`, `palavra`, `contexto`, `estado`, `gerado`, `revisado`, `erro`, `medicao`,
  `gerado_em`, `revisado_em`, nesta ordem.

- [ ] **Passo 1: escrever o teste da tabela**

Crie `testes-integracao/bonus-carrossel-tabela.integracao.ts`:

```ts
// A TABELA DOS CARROSSÉIS, conferida no banco de verdade (o container).
//
// A `014` é a única fonte de `carrosseis_gerados`, e nada mais a confere: como a `013`, ela
// está em `naoObservaveis` de lib/esquema.ts (a partida do painel não depende dela). Sem este
// arquivo, uma coluna apagada da migração só apareceria quando a tela quebrasse.
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = [
  "id",
  "bonus_id",
  "criado_em",
  "total_slides",
  "palavra",
  "contexto",
  "estado",
  "gerado",
  "revisado",
  "erro",
  "medicao",
  "gerado_em",
  "revisado_em",
];

let bonusId: string;

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  await banco.db().sql().query(`delete from bonus_gerados`);
  const [b] = (await banco
    .db()
    .sql()
    .query(
      `insert into bonus_gerados (tema, o_que_resolve) values ('Vendas', 'um pedido de teste com mais de vinte letras') returning id`
    )) as { id: string }[];
  bonusId = b.id;
});

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as { n: number }[];
  return n;
}

describe("a tabela carrosseis_gerados", () => {
  it("nasce da 014 com as colunas que o código lê", async () => {
    const linhas = (await banco
      .db()
      .sql()
      .query(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'carrosseis_gerados'
          order by ordinal_position`
      )) as { column_name: string }[];
    expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
  });

  it("uma linha nova nasce pendente, sem texto e sem revisão", async () => {
    const [linha] = (await banco
      .db()
      .sql()
      .query(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
         values ($1, 10, 'SUMIDO', $2::jsonb)
         returning estado, gerado, revisado, revisado_em, contexto`,
        [bonusId, { tema: "Vendas" }]
      )) as Record<string, unknown>[];
    expect(linha).toEqual({
      estado: "pendente",
      gerado: null,
      revisado: null,
      revisado_em: null,
      contexto: { tema: "Vendas" },
    });
  });

  it.each([0, 11])("o banco recusa total de %i slides", async (total) => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ($1, $2, 'SUMIDO', '{}'::jsonb)`,
          [bonusId, total]
        )
    ).rejects.toThrow(/carrosseis_gerados_total_check/);
  });

  it("o banco recusa estado fora da lista", async () => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado) values ($1, 5, 'SUMIDO', '{}'::jsonb, 'inventado')`,
          [bonusId]
        )
    ).rejects.toThrow(/carrosseis_gerados_estado_check/);
  });

  it("carrossel de um bônus que não existe não entra", async () => {
    await expect(
      banco
        .db()
        .sql()
        .query(
          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ('0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f', 5, 'SUMIDO', '{}'::jsonb)`
        )
    ).rejects.toThrow(/carrosseis_gerados_bonus_id_fkey/);
  });

  it("apagar o bônus apaga os carrosséis dele", async () => {
    await banco
      .db()
      .sql()
      .query(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ($1, 5, 'SUMIDO', '{}'::jsonb)`,
        [bonusId]
      );
    expect(await contar()).toBe(1);
    await banco.db().sql().query(`delete from bonus_gerados where id = $1`, [bonusId]);
    expect(await contar()).toBe(0);
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
npm run banco:teste
npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, e FAIL em todos os casos com
`relation "carrosseis_gerados" does not exist`.

- [ ] **Passo 3: escrever a migração**

Crie `migrations/014-carrosseis-gerados.sql`:

```sql
-- OS CARROSSÉIS DO GERADOR DE BÔNUS (Etapa 2: o texto).
--
-- Uma linha é um carrossel pedido a partir de um bônus já publicado no Método Labs, do
-- pedido ao texto revisado. O desenho inteiro está em
-- docs/specs/2026-09-30-gerador-de-carrossel.md.
--
-- TABELA DE FEATURE, como a 013: entra em `naoObservaveis` de lib/esquema.ts, e quem confere
-- as colunas é testes-integracao/bonus-carrossel-tabela.integracao.ts.
--
-- `palavra` e `contexto` são o que o Labs dizia NO MOMENTO DO PEDIDO. A palavra pode ser
-- trocada depois no /admin de lá, e o carrossel pede a que valia quando foi escrito. A
-- geração roda no `after()` e não lê o Labs de novo: tudo o que ela precisa está aqui.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e nos índices.
create table if not exists carrosseis_gerados (
  id uuid primary key default gen_random_uuid(),
  bonus_id uuid not null references bonus_gerados (id) on delete cascade,
  criado_em timestamptz not null default now(),
  total_slides integer not null
    constraint carrosseis_gerados_total_check
      check (total_slides between 1 and 10),
  palavra text not null,
  contexto jsonb not null,
  estado text not null default 'pendente'
    constraint carrosseis_gerados_estado_check
      check (estado in ('pendente', 'gerando', 'pronto', 'falhou')),
  gerado jsonb,
  revisado jsonb,
  erro text,
  medicao jsonb,
  gerado_em timestamptz,
  revisado_em timestamptz
);

-- A lista na página do bônus.
create index if not exists carrosseis_gerados_bonus_idx
  on carrosseis_gerados (bonus_id, criado_em desc);

-- O teto diário lê por `criado_em`, do mais novo para trás.
create index if not exists carrosseis_gerados_criado_em_idx
  on carrosseis_gerados (criado_em desc);
```

- [ ] **Passo 4: rodar a tabela e o teste de partida**

```bash
npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/esquema-de-partida.integracao.ts
```

Esperado: os 7 casos da tabela **passam**; `esquema-de-partida` **falha** no caso "a MARCA D'ÁGUA
cobre a pasta inteira", nomeando `014-carrosseis-gerados.sql`. A falha é a prova de que o teste do
dono enxerga a migração nova. (Nenhum teste da suíte pura confere isso: a guarda é só essa.)

- [ ] **Passo 5: declarar a 014 na conferência de partida**

Em `lib/esquema.ts`, logo depois da entrada da `013-bonus-gerados.sql` em `naoObservaveis`
(o bloco que termina com `"tabela de FEATURE (bonus_gerados): a partida do painel não depende
dela, de propósito",` e `},`), acrescente:

```ts
    {
      de: "014-carrosseis-gerados.sql",
      // A SEGUNDA TABELA DE FEATURE, pelo mesmo motivo da 013: `carrosseis_gerados` é do
      // gerador de carrossel (app/bonus/), e uma tabela que só ele lê não pode impedir o
      // painel inteiro de subir. Quem confere as colunas é
      // testes-integracao/bonus-carrossel-tabela.integracao.ts. Decidido pelo Eduardo em
      // 30/09/2026 (docs/specs/2026-09-30-gerador-de-carrossel.md).
      porque:
        "tabela de FEATURE (carrosseis_gerados): a partida do painel não depende dela, de propósito",
    },
```

- [ ] **Passo 6: rodar de novo e ver tudo verde**

```bash
npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/esquema-de-partida.integracao.ts
npm test
```

Esperado: `[rede-global] ALVO: banco de TESTE`, os dois arquivos passam, e o `npm test` continua
com 70 arquivos e 2 077 casos.

- [ ] **Passo 7: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" migrations/014-carrosseis-gerados.sql lib/esquema.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add migrations/014-carrosseis-gerados.sql lib/esquema.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
git commit -m "feat(bonus): a tabela dos carrosséis, ligada ao bônus e fora da partida do painel"
```

---

### FASE 2.2 — O pedido e o teto

**Arquivos:**
- Criar: `lib/bonus/carrossel-pedido.ts`
- Testar: `tests/bonus-carrossel-pedido.test.ts`

**Interfaces:**
- Consome: `ehIdDeBonus(v: unknown): v is string` de `lib/bonus/pedido.ts`.
- Produz: `TETO_CARROSSEL_DIARIO = 10`, `SLIDES_MIN = 1`, `SLIDES_MAX = 10`, `SLIDES_PADRAO = 10`;
  `type PedidoDeCarrossel = { bonusId: string; total: number }`;
  `type RecusaDoPedidoDeCarrossel = "bonus_invalido" | "total_invalido"`;
  `lerPedidoDeCarrossel(bruto: { bonusId: unknown; total: unknown }): { ok: true; pedido: PedidoDeCarrossel } | { ok: false; motivo: RecusaDoPedidoDeCarrossel }`;
  `restamCarrosseisHoje(usadas: number): number`; `slidesDeConteudo(total: number): number`.

- [ ] **Passo 1: escrever o teste**

Crie `tests/bonus-carrossel-pedido.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SLIDES_MAX,
  SLIDES_MIN,
  SLIDES_PADRAO,
  TETO_CARROSSEL_DIARIO,
  lerPedidoDeCarrossel,
  restamCarrosseisHoje,
  slidesDeConteudo,
} from "@/lib/bonus/carrossel-pedido";
import { CARROSSEL_ITENS_MAX } from "@/lib/publicacao";

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";

describe("o pedido de carrossel", () => {
  it("o teto de slides é o da Meta, o mesmo do /publicar", () => {
    expect(SLIDES_MAX).toBe(CARROSSEL_ITENS_MAX);
  });

  it("o padrão cabe na faixa", () => {
    expect(SLIDES_PADRAO).toBeGreaterThanOrEqual(SLIDES_MIN);
    expect(SLIDES_PADRAO).toBeLessThanOrEqual(SLIDES_MAX);
  });

  it.each(["1", "2", "7", "10", " 10 "])("aceita o total %j", (total) => {
    expect(lerPedidoDeCarrossel({ bonusId: BONUS, total })).toEqual({
      ok: true,
      pedido: { bonusId: BONUS, total: Number(total.trim()) },
    });
  });

  it.each(["0", "11", "", "abc", "5.5", "-3", "100", null])("recusa o total %j", (total) => {
    expect(lerPedidoDeCarrossel({ bonusId: BONUS, total })).toEqual({ ok: false, motivo: "total_invalido" });
  });

  it.each(["", "abc", "0f8e2a8c", null])("recusa o bônus %j antes de olhar o total", (bonusId) => {
    expect(lerPedidoDeCarrossel({ bonusId, total: "10" })).toEqual({ ok: false, motivo: "bonus_invalido" });
  });
});

describe("as contas do carrossel", () => {
  it("o teto é 10 por dia, decidido pelo Eduardo em 30/09", () => {
    expect(TETO_CARROSSEL_DIARIO).toBe(10);
  });

  it("restamCarrosseisHoje nunca fica negativo", () => {
    expect(restamCarrosseisHoje(0)).toBe(10);
    expect(restamCarrosseisHoje(12)).toBe(0);
  });

  it.each([
    [1, 0],
    [2, 0],
    [3, 1],
    [10, 8],
  ])("com %i no total, há %i de conteúdo", (total, conteudo) => {
    expect(slidesDeConteudo(total)).toBe(conteudo);
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
npx vitest run tests/bonus-carrossel-pedido.test.ts
```

Esperado: FAIL por import que não resolve (`lib/bonus/carrossel-pedido`).

- [ ] **Passo 3: escrever o pedido**

Crie `lib/bonus/carrossel-pedido.ts`:

```ts
// O PEDIDO DE UM CARROSSEL: de qual bônus e com quantos slides.
//
// PURO, como lib/bonus/pedido.ts: quem decide o que é pedido válido é esta função, e não o
// corpo da action.
import { ehIdDeBonus } from "./pedido";

/** Gerações de carrossel em 24 horas, somando o painel inteiro. Decidido pelo Eduardo em 30/09. */
export const TETO_CARROSSEL_DIARIO = 10;

/** O total de slides do post, contando o gancho e a chamada. 1 é um post de imagem única. */
export const SLIDES_MIN = 1;
/** O teto da Meta para um carrossel, o mesmo `CARROSSEL_ITENS_MAX` de lib/publicacao.ts. */
export const SLIDES_MAX = 10;
/** Sugestão do chefe do Eduardo, em 30/09: o máximo que a Meta aceita. */
export const SLIDES_PADRAO = 10;

export type PedidoDeCarrossel = { bonusId: string; total: number };
export type RecusaDoPedidoDeCarrossel = "bonus_invalido" | "total_invalido";

export function lerPedidoDeCarrossel(bruto: { bonusId: unknown; total: unknown }):
  | { ok: true; pedido: PedidoDeCarrossel }
  | { ok: false; motivo: RecusaDoPedidoDeCarrossel } {
  if (!ehIdDeBonus(bruto.bonusId)) return { ok: false, motivo: "bonus_invalido" };
  const texto = typeof bruto.total === "string" ? bruto.total.trim() : "";
  if (!/^\d{1,2}$/.test(texto)) return { ok: false, motivo: "total_invalido" };
  const total = Number(texto);
  if (total < SLIDES_MIN || total > SLIDES_MAX) return { ok: false, motivo: "total_invalido" };
  return { ok: true, pedido: { bonusId: bruto.bonusId, total } };
}

export function restamCarrosseisHoje(usadas: number): number {
  return Math.max(0, TETO_CARROSSEL_DIARIO - usadas);
}

/** Os slides de conteúdo entre o gancho e a chamada. 0 no post único e no carrossel de 2. */
export function slidesDeConteudo(total: number): number {
  return Math.max(0, total - 2);
}
```

- [ ] **Passo 4: ver o teste passar**

```bash
npx vitest run tests/bonus-carrossel-pedido.test.ts
```

Esperado: PASS em todos.

- [ ] **Passo 5: provar que o teste do teto de slides mede**

Troque temporariamente `total > SLIDES_MAX` por `total > 11` e rode o arquivo. Esperado: FAIL em
`recusa o total "11"`. Desfaça e rode de novo: PASS.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-pedido.ts tests/bonus-carrossel-pedido.test.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add lib/bonus/carrossel-pedido.ts tests/bonus-carrossel-pedido.test.ts
git commit -m "feat(bonus): o pedido de carrossel, de 1 a 10 slides, com teto de 10 por dia"
```

---

### FASE 2.3 — A situação do bônus no Labs

**Arquivos:**
- Criar: `lib/bonus/publicado.ts`
- Modificar: `lib/bonus/labs.ts` (a palavra `export` antes de `async function lerAteOTeto`)
- Testar: `tests/bonus-publicado.test.ts`

**Interfaces:**
- Consome: `urlDaPorta(base: string | undefined): string | null` e
  `lerAteOTeto(res: Response, teto: number): Promise<string | null>` de `lib/bonus/labs.ts`;
  `palavraValida(palavra: string): boolean` e `TEMA_MAX` de `lib/bonus/pedido.ts`.
- Produz: `LISTA_MAX_BYTES = 512 * 1024`;
  `type BonusPublicado = { palavra: string; titulo: string; descricao: string; tema: string }`;
  `type SituacaoNoLabs = { tipo: "publicado"; bonus: BonusPublicado } | { tipo: "nao_publicado" } | { tipo: "sem_resposta" } | { tipo: "formato_estranho" } | { tipo: "sem_config" }`;
  `situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs`;
  `situacaoNoLabs(base: string | undefined, slug: string, fetchImpl?: typeof fetch): Promise<SituacaoNoLabs>`.

- [ ] **Passo 1: escrever o teste**

Crie `tests/bonus-publicado.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { LISTA_MAX_BYTES, situacaoNaLista, situacaoNoLabs } from "@/lib/bonus/publicado";

// O item como a lista pública do Labs o devolve (medido ao vivo em 30/09).
const ITEM = {
  codigo: "reativar-clientes-whatsapp",
  skillId: null,
  palavraChave: "SUMIDO",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  tema: "Vendas",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
};
const LISTA = { items: [{ ...ITEM, codigo: "outro-bonus", palavraChave: "OUTRO" }, ITEM] };
const LABS = "https://metodolabs.metodotia.com";

describe("a situação de um bônus na lista pública do Labs", () => {
  it("publicado: a palavra, o título, o tema e a descrição vêm do Labs", () => {
    expect(situacaoNaLista(LISTA, ITEM.codigo)).toEqual({
      tipo: "publicado",
      bonus: { palavra: "SUMIDO", titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
    });
  });

  it("não achar o slug é não publicado: oculto ou inexistente", () => {
    expect(situacaoNaLista(LISTA, "zz-teste-chat-3009")).toEqual({ tipo: "nao_publicado" });
  });

  it.each([null, {}, { items: "x" }, [], "texto"])("resposta sem lista de itens é formato estranho: %j", (corpo) => {
    expect(situacaoNaLista(corpo, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
  });

  it.each([
    ["palavra minúscula", { palavraChave: "sumido" }],
    ["palavra com espaço", { palavraChave: "SUMI DO" }],
    ["palavra longa demais", { palavraChave: "X".repeat(31) }],
    ["sem palavra", { palavraChave: undefined }],
    ["sem título", { titulo: "" }],
    ["tema longo demais", { tema: "x".repeat(81) }],
    ["descrição que não é texto", { descricao: 7 }],
  ])("%s é formato estranho, e nunca publicado", (_nome, troca) => {
    expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
  });
});

describe("a leitura da lista pelo Chat", () => {
  const resposta = (status: number, corpo: unknown) =>
    new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
  const buscador = (f: () => Promise<Response>) => vi.fn(f) as unknown as typeof fetch;

  it("lê {LABS_URL}/api/bonus sem seguir redirect e sem cache", async () => {
    const f = vi.fn(async () => resposta(200, LISTA));
    const s = await situacaoNoLabs(LABS, ITEM.codigo, f as unknown as typeof fetch);
    expect(s.tipo).toBe("publicado");
    expect(f).toHaveBeenCalledWith(
      `${LABS}/api/bonus`,
      expect.objectContaining({ method: "GET", redirect: "manual", cache: "no-store" })
    );
  });

  it("sem LABS_URL válida, nem tenta: sem configuração", async () => {
    const f = vi.fn();
    expect(await situacaoNoLabs(undefined, ITEM.codigo, f as unknown as typeof fetch)).toEqual({ tipo: "sem_config" });
    expect(await situacaoNoLabs("http://exemplo.com", ITEM.codigo, f as unknown as typeof fetch)).toEqual({
      tipo: "sem_config",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it.each([301, 404, 500, 503])("status %i é sem resposta", async (status) => {
    const f = buscador(async () => resposta(status, { ok: false }));
    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "sem_resposta" });
  });

  it("erro de rede ou tempo esgotado é sem resposta", async () => {
    const f = buscador(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "sem_resposta" });
  });

  it("corpo que não é JSON é formato estranho", async () => {
    const f = buscador(async () => resposta(200, "<html>fora do ar</html>"));
    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "formato_estranho" });
  });

  it("uma lista maior que a de hoje passa inteira: o teto de 16 KiB do envio a cortaria (achado 44)", async () => {
    // A de produção tinha 20 158 bytes em 30/09. Esta passa de 30 KB, e o bônus procurado é o
    // último item: um teto menor que a lista corta o JSON antes dele.
    const outros = Array.from({ length: 80 }, (_, i) => ({ ...ITEM, codigo: `bonus-${i}`, descricao: "d".repeat(300) }));
    const corpo = JSON.stringify({ items: [...outros, ITEM] });
    expect(corpo.length).toBeGreaterThan(30_000);
    const f = buscador(async () => resposta(200, corpo));
    expect((await situacaoNoLabs(LABS, ITEM.codigo, f)).tipo).toBe("publicado");
  });

  it("passar do teto próprio é formato estranho", async () => {
    const gorda = buscador(async () => resposta(200, "x".repeat(LISTA_MAX_BYTES + 1)));
    expect(await situacaoNoLabs(LABS, ITEM.codigo, gorda)).toEqual({ tipo: "formato_estranho" });
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
npx vitest run tests/bonus-publicado.test.ts
```

Esperado: FAIL por import que não resolve (`lib/bonus/publicado`).

- [ ] **Passo 3: exportar o leitor com teto**

Em `lib/bonus/labs.ts`, troque `async function lerAteOTeto(` por `export async function lerAteOTeto(`.
Nada mais muda nesse arquivo.

- [ ] **Passo 4: escrever a situação no Labs**

Crie `lib/bonus/publicado.ts`:

```ts
// A SITUAÇÃO DE UM BÔNUS NO LABS, lida da lista pública (`GET /api/bonus`).
//
// ⚠️ ESTA LEITURA NÃO ESTÁ NO CONTRATO (é a mesma de lib/bonus/temas.ts), e por isso FALHA
// FECHADA: só "publicado" libera o carrossel. A lista traz só bônus ATIVOS, com `codigo` (o
// slug), `palavraChave`, `titulo`, `tema` e `descricao` (medido em 30/09). Do lado do Labs ela
// tem cache de 30 minutos, invalidado por toda ação do /admin e pelo POST (medido pelo auditor).
//
// A PALAVRA É A DO LABS, e nunca a que o Chat guardou: ela pode ter sido trocada no /admin de
// lá depois do envio (o primeiro bônus de 30/09 foi enviado com ZZTESTECHAT e publicado com
// SUMIDO).
import { lerAteOTeto, urlDaPorta } from "./labs";
import { palavraValida, TEMA_MAX } from "./pedido";

/**
 * O TETO DA LISTA, próprio. A lista de produção tinha 20 158 bytes em 30/09 (58 bônus, uns 337
 * bytes cada), e o teto de 16 KiB da resposta do envio já não a comportaria (achado 44 do
 * auditor). 512 KiB cobre perto de 1 500 bônus.
 */
export const LISTA_MAX_BYTES = 512 * 1024;

/** Os tetos do contrato do Labs para título e descrição (lib/bonus/contrato.ts, `LIMITES`). */
const TITULO_MAX = 220;
const DESCRICAO_MAX = 1200;

export type BonusPublicado = { palavra: string; titulo: string; descricao: string; tema: string };

export type SituacaoNoLabs =
  | { tipo: "publicado"; bonus: BonusPublicado }
  | { tipo: "nao_publicado" }
  | { tipo: "sem_resposta" }
  | { tipo: "formato_estranho" }
  | { tipo: "sem_config" };

function textoAte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
  const itens =
    corpo !== null && typeof corpo === "object" && !Array.isArray(corpo)
      ? (corpo as { items?: unknown }).items
      : undefined;
  if (!Array.isArray(itens)) return { tipo: "formato_estranho" };

  const item = itens.find(
    (i): i is Record<string, unknown> =>
      i !== null && typeof i === "object" && (i as { codigo?: unknown }).codigo === slug
  );
  if (!item) return { tipo: "nao_publicado" };

  // A palavra entra EXATAMENTE como o Labs a tem: a chamada tem de pedir essa grafia.
  const palavra = typeof item.palavraChave === "string" ? item.palavraChave : "";
  const titulo = textoAte(item.titulo, TITULO_MAX);
  const descricao = textoAte(item.descricao, DESCRICAO_MAX);
  const tema = textoAte(item.tema, TEMA_MAX);
  if (!palavraValida(palavra) || !titulo || !descricao || !tema) return { tipo: "formato_estranho" };
  return { tipo: "publicado", bonus: { palavra, titulo, descricao, tema } };
}

export async function situacaoNoLabs(
  base: string | undefined,
  slug: string,
  fetchImpl: typeof fetch = fetch
): Promise<SituacaoNoLabs> {
  const porta = urlDaPorta(base);
  if (porta === null) return { tipo: "sem_config" };
  let res: Response;
  try {
    res = await fetchImpl(porta, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return { tipo: "sem_resposta" };
  }
  if (res.status !== 200) return { tipo: "sem_resposta" };

  let texto: string | null;
  try {
    texto = await lerAteOTeto(res, LISTA_MAX_BYTES);
  } catch {
    return { tipo: "sem_resposta" };
  }
  if (texto === null) return { tipo: "formato_estranho" };
  try {
    return situacaoNaLista(JSON.parse(texto), slug);
  } catch {
    return { tipo: "formato_estranho" };
  }
}
```

- [ ] **Passo 5: ver o teste passar, e o do cliente do Labs**

```bash
npx vitest run tests/bonus-publicado.test.ts tests/bonus-labs.test.ts
```

Esperado: PASS nos dois.

- [ ] **Passo 6: provar que os testes medem**

Um de cada vez, rodando `npx vitest run tests/bonus-publicado.test.ts` e desfazendo em seguida:
1. Tire `!palavraValida(palavra) ||` da condição. Esperado: FAIL em "palavra minúscula", "palavra
   com espaço", "palavra longa demais" e "sem palavra".
2. Na chamada de `lerAteOTeto`, troque `LISTA_MAX_BYTES` por `RESPOSTA_MAX_BYTES` (o teto de
   16 KiB do envio, importado de `./labs`). Esperado: FAIL em "uma lista maior que a de hoje passa
   inteira", com `formato_estranho` no lugar de `publicado`.

- [ ] **Passo 7: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicado.ts lib/bonus/labs.ts tests/bonus-publicado.test.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add lib/bonus/publicado.ts lib/bonus/labs.ts tests/bonus-publicado.test.ts
git commit -m "feat(bonus): a situação do bônus lida da lista do Labs, com falha fechada"
```

---

### FASE 2.4 — As instruções e o formato

**Arquivos:**
- Criar: `lib/bonus/instrucao-carrossel.ts`, `lib/bonus/instrucao-post.ts` (copiados do Labs),
  `lib/bonus/carrossel-schema.ts`
- Testar: `tests/bonus-carrossel-instrucao.test.ts`, `tests/bonus-carrossel-schema.test.ts`

**Interfaces:**
- Consome: `REGRA_DE_PORTUGUES` de `lib/bonus/regra-de-portugues.ts` (já no Chat, idêntica à do
  Labs).
- Produz: `INSTRUCAO_CARROSSEL: string`, `INSTRUCAO_POST: string`; `SlideSchema`,
  `CarrosselDoChatSchema`, `PostDoChatSchema` (zod); `type CarrosselDoChat`, `type PostDoChat`.

- [ ] **Passo 1: escrever os dois testes**

Crie `tests/bonus-carrossel-instrucao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { INSTRUCAO_CARROSSEL } from "@/lib/bonus/instrucao-carrossel";
import { INSTRUCAO_POST } from "@/lib/bonus/instrucao-post";
import { REGRA_DE_PORTUGUES } from "@/lib/bonus/regra-de-portugues";

// A instrução é TEXTO, e texto nenhum passa por tsc ou lint: trocar uma pela outra, ou perder
// a regra de português, passaria calado por todo o resto.
describe("as instruções do carrossel trazidas do Labs", () => {
  it("a do carrossel é a do carrossel", () => {
    expect(
      INSTRUCAO_CARROSSEL.startsWith(
        "Você escreve os carrosséis de Instagram de um estrategista de vendas e marketing."
      )
    ).toBe(true);
  });

  it("a do post é a do post de imagem única", () => {
    expect(
      INSTRUCAO_POST.startsWith(
        "Você escreve os posts de imagem única do Instagram de um estrategista de vendas e marketing."
      )
    ).toBe(true);
  });

  it("as duas levam a regra de português junto", () => {
    expect(INSTRUCAO_CARROSSEL).toContain(REGRA_DE_PORTUGUES);
    expect(INSTRUCAO_POST).toContain(REGRA_DE_PORTUGUES);
  });

  it("a do carrossel pede os campos do formato", () => {
    for (const campo of ["titulo", "gancho", "slides", "chamadaParaAcao", "legenda"]) {
      expect(INSTRUCAO_CARROSSEL, campo).toContain(`**${campo}**`);
    }
  });

  it("a do post pede os campos do formato", () => {
    for (const campo of ["titulo", "texto", "chamadaParaAcao", "legenda"]) {
      expect(INSTRUCAO_POST, campo).toContain(`**${campo}**`);
    }
  });
});
```

Crie `tests/bonus-carrossel-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CarrosselDoChatSchema, PostDoChatSchema } from "@/lib/bonus/carrossel-schema";

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const CARROSSEL = {
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: Array.from({ length: 8 }, (_, i) => slide(i)),
  chamadaParaAcao: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "L".repeat(100),
};
const POST = {
  titulo: "Mensagens para reativar clientes",
  texto: "T".repeat(80),
  chamadaParaAcao: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "L".repeat(100),
};

describe("o formato do carrossel no Chat", () => {
  it.each([0, 1, 8])("aceita %i slides de conteúdo (total de 2 a 10)", (n) => {
    expect(CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: CARROSSEL.slides.slice(0, n) }).success).toBe(true);
  });

  it("recusa 9 slides de conteúdo: passaria de 10 no total", () => {
    expect(CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: [...CARROSSEL.slides, slide(9)] }).success).toBe(
      false
    );
  });

  it("mantém os tetos do Labs, que vêm da arte", () => {
    expect(CarrosselDoChatSchema.safeParse({ ...CARROSSEL, gancho: "g".repeat(121) }).success).toBe(false);
    expect(
      CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: [{ titulo: "t".repeat(71), texto: slide(0).texto }] })
        .success
    ).toBe(false);
    expect(
      CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: [{ titulo: slide(0).titulo, texto: "x".repeat(301) }] })
        .success
    ).toBe(false);
  });
});

describe("o formato do post de imagem única no Chat", () => {
  it("aceita o post com a chamada", () => {
    expect(PostDoChatSchema.safeParse(POST).success).toBe(true);
  });

  it("recusa o post sem chamada: aqui todo post leva a um bônus", () => {
    const semChamada = { titulo: POST.titulo, texto: POST.texto, legenda: POST.legenda };
    expect(PostDoChatSchema.safeParse(semChamada).success).toBe(false);
  });

  it("o texto da imagem tem o teto de 300 do Labs", () => {
    expect(PostDoChatSchema.safeParse({ ...POST, texto: "T".repeat(301) }).success).toBe(false);
  });
});
```

- [ ] **Passo 2: ver os dois falharem**

```bash
npx vitest run tests/bonus-carrossel-instrucao.test.ts tests/bonus-carrossel-schema.test.ts
```

Esperado: FAIL por import que não resolve nos dois.

- [ ] **Passo 3: trazer as duas instruções do Labs, como estão**

```bash
git -C ../site-ia show 01e609f:src/lib/ia/instrucao-carrossel.ts > lib/bonus/instrucao-carrossel.ts
git -C ../site-ia show 01e609f:src/lib/ia/instrucao-post.ts > lib/bonus/instrucao-post.ts
```

Nos dois arquivos, troque a linha
`import { REGRA_DE_PORTUGUES } from "@/lib/ia/regra-de-portugues";` por
`import { REGRA_DE_PORTUGUES } from "./regra-de-portugues";`. No topo **dos dois**, antes da
primeira linha, acrescente:

```ts
// TRAZIDO COMO ESTÁ do Método Labs (site-ia, src/lib/ia/, commit 01e609f), quando a geração do
// carrossel passou a morar no Chat (Etapa 2, 30/09). A cópia do Labs continua no repositório dele
// enquanto o gerador de carrossel de lá existir: mudança aqui se avisa lá, e vice-versa. Não
// edite o texto sem reconferir numa geração real (spec da Etapa 2, "A prova real").
```

Confira que a única diferença para o original é essa (o cabeçalho e o import):

```bash
git -C ../site-ia show 01e609f:src/lib/ia/instrucao-carrossel.ts | diff - lib/bonus/instrucao-carrossel.ts
git -C ../site-ia show 01e609f:src/lib/ia/instrucao-post.ts | diff - lib/bonus/instrucao-post.ts
```

Esperado: nos dois, só as 4 linhas de cabeçalho acrescentadas e a linha do import trocada.

- [ ] **Passo 4: escrever o formato**

Crie `lib/bonus/carrossel-schema.ts`:

```ts
import { z } from "zod";

// O FORMATO DA SAÍDA DA IA PARA O CARROSSEL, a partir do do Método Labs (site-ia,
// src/lib/ia/schemas.ts, `CarrosselGeradoSchema`, `SlideSchema` e `PostUnicoSchema`, commit
// 01e609f). Os tetos de cada campo são os de lá, e vêm da geometria da arte: passar deles
// cortaria o texto na imagem, em silêncio. Os nomes são os que as instruções pedem.
//
// DUAS MUDANÇAS, decididas na spec da Etapa 2:
// - `slides` aceita de 0 a 8 (lá, de 6 a 9): aqui o total vai de 2 a 10, contando o gancho e a
//   chamada. Quem confere o número EXATO pedido é `conferirGerado` (carrossel-texto.ts);
// - no post único, a `chamadaParaAcao` é obrigatória (lá, opcional): aqui todo post existe
//   para levar a um bônus.

export const SlideSchema = z.object({
  titulo: z.string().min(8).max(70),
  texto: z.string().min(30).max(300),
});

export const CarrosselDoChatSchema = z.object({
  // Nome interno, para reconhecer na lista. Não vai para o post.
  titulo: z.string().min(10).max(90),
  // Slide 1.
  gancho: z.string().min(15).max(120),
  slides: z.array(SlideSchema).max(8),
  // Slide final.
  chamadaParaAcao: z.string().min(20).max(200),
  legenda: z.string().min(80).max(900),
});

export const PostDoChatSchema = z.object({
  titulo: z.string().min(10).max(90),
  texto: z.string().min(60).max(300),
  chamadaParaAcao: z.string().min(20).max(200),
  legenda: z.string().min(80).max(900),
});

export type CarrosselDoChat = z.infer<typeof CarrosselDoChatSchema>;
export type PostDoChat = z.infer<typeof PostDoChatSchema>;
```

- [ ] **Passo 5: ver os dois passarem**

```bash
npx vitest run tests/bonus-carrossel-instrucao.test.ts tests/bonus-carrossel-schema.test.ts
```

Esperado: PASS em todos.

- [ ] **Passo 6: provar que o teste da instrução mede**

Troque temporariamente, em `lib/bonus/instrucao-post.ts`, `${REGRA_DE_PORTUGUES}` por nada, e rode
`npx vitest run tests/bonus-carrossel-instrucao.test.ts`. Esperado: FAIL em "as duas levam a
regra de português junto". O arquivo ainda não está commitado: desfaça a troca à mão e rode de
novo o `diff` do passo 3, que tem de mostrar só o cabeçalho e o import.

- [ ] **Passo 7: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/instrucao-carrossel.ts lib/bonus/instrucao-post.ts lib/bonus/carrossel-schema.ts tests/bonus-carrossel-instrucao.test.ts tests/bonus-carrossel-schema.test.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add lib/bonus/instrucao-carrossel.ts lib/bonus/instrucao-post.ts lib/bonus/carrossel-schema.ts tests/bonus-carrossel-instrucao.test.ts tests/bonus-carrossel-schema.test.ts
git commit -m "feat(bonus): as instruções do carrossel e do post trazidas do Labs, e o formato do Chat"
```

---

### FASE 2.5 — A mensagem, as conferências e a chamada à IA

**Arquivos:**
- Criar: `lib/bonus/carrossel-texto.ts`, `lib/bonus/carrossel-ia-parametros.ts`,
  `lib/bonus/carrossel-ia.ts`
- Testar: `tests/bonus-carrossel-texto.test.ts`, `tests/bonus-carrossel-ia-parametros.test.ts`

**Interfaces:**
- Consome: `slidesDeConteudo` (2.2); `CarrosselDoChatSchema`, `PostDoChatSchema`,
  `CarrosselDoChat`, `PostDoChat` (2.4); `INSTRUCAO_CARROSSEL`, `INSTRUCAO_POST` (2.4); `MODELO`,
  `BETA_DO_FALLBACK`, `medicaoDe`, `Medicao` de `ia-parametros.ts`; `TEXTO_SEM_CHAVE` de `ia.ts`;
  `mensagemDeErro` de `erros.ts`; `TIMEOUT_IA_MS` de `tempos.ts`.
- Produz, em `carrossel-texto.ts`: `type Slide = { titulo: string; texto: string }`;
  `type TextoDeCarrossel = { tipo: "carrossel"; titulo: string; gancho: string; slides: Slide[]; chamada: string; legenda: string }`;
  `type TextoDePost = { tipo: "post"; titulo: string; texto: string; chamada: string; legenda: string }`;
  `type TextoDoCarrossel = TextoDeCarrossel | TextoDePost`;
  `deCarrossel(d: CarrosselDoChat): TextoDeCarrossel`; `dePost(d: PostDoChat): TextoDePost`;
  `textoGravado(v: unknown): TextoDoCarrossel | null`;
  `temPalavra(texto: string, palavra: string): boolean`;
  `GRITADAS_PERMITIDAS: ReadonlySet<string>`;
  `outrasGritadas(texto: string, palavra: string): string[]`;
  `type FalhaDaConferencia = { motivo: "tipo_errado" } | { motivo: "slides"; vieram: number; esperados: number } | { motivo: "palavra"; onde: "chamada" | "legenda" } | { motivo: "outra_palavra"; palavras: string[] }`;
  `conferirGerado(total: number, palavra: string, t: TextoDoCarrossel): FalhaDaConferencia | null`;
  `type CampoDoCarrossel = { nome: string; rotulo: string; min: number; max: number; linhas: number }`;
  `camposDoFormulario(total: number): CampoDoCarrossel[]`;
  `valoresPorCampo(t: TextoDoCarrossel): Record<string, string>`;
  `lerRevisaoDoCarrossel(total: number, palavra: string, titulo: string, bruto: Record<string, unknown>): { ok: true; texto: TextoDoCarrossel } | { ok: false; problemas: { campo: string; erro: string }[] }`.
- Produz, em `carrossel-ia-parametros.ts`:
  `type ContextoDoCarrossel = { tema: string; titulo: string; descricao: string; oQueResolve: string }`;
  `type PedidoParaIA = { total: number; palavra: string; contexto: ContextoDoCarrossel }`;
  `contextoGravado(v: unknown): ContextoDoCarrossel | null`;
  `pedidoExtra(total: number, palavra: string): string`;
  `mensagemDoCarrossel(p: PedidoParaIA): string`;
  `parametrosDoCarrossel(p: PedidoParaIA)`; `parametrosDoPost(p: PedidoParaIA)`.
- Produz, em `carrossel-ia.ts` (`server-only`):
  `type ResultadoDoCarrossel = { ok: true; texto: TextoDoCarrossel; medicao: Medicao } | { ok: false; erro: string; medicao: Medicao | null }`;
  `gerarTextoDoCarrossel(p: PedidoParaIA): Promise<ResultadoDoCarrossel>`.

- [ ] **Passo 1: escrever os dois testes**

Crie `tests/bonus-carrossel-texto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  camposDoFormulario,
  conferirGerado,
  deCarrossel,
  dePost,
  lerRevisaoDoCarrossel,
  outrasGritadas,
  temPalavra,
  textoGravado,
  valoresPorCampo,
  type TextoDeCarrossel,
  type TextoDePost,
  type TextoDoCarrossel,
} from "@/lib/bonus/carrossel-texto";

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const CARROSSEL: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda:
    "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: "Mensagens para reativar clientes",
  texto: "T".repeat(80),
  chamada: CARROSSEL.chamada,
  legenda: CARROSSEL.legenda,
};

describe("a palavra na chamada", () => {
  it("acha a palavra inteira, em maiúsculas", () => {
    expect(temPalavra("Comente SUMIDO aqui", "SUMIDO")).toBe(true);
    expect(temPalavra("SUMIDO!", "SUMIDO")).toBe(true);
  });

  it("não aceita a palavra dentro de outra, nem em minúscula", () => {
    expect(temPalavra("Comente SUMIDOS", "SUMIDO")).toBe(false);
    expect(temPalavra("Comente RESUMIDO", "SUMIDO")).toBe(false);
    expect(temPalavra("Comente sumido", "SUMIDO")).toBe(false);
  });

  it("letra acentuada colada também conta como parte da palavra (achado 46 do auditor)", () => {
    // Um `\b` do JavaScript acharia PROMO dentro de PROMOÇÃO.
    expect(temPalavra("Comente PROMOÇÃO", "PROMO")).toBe(false);
  });
});

describe("outra palavra gritada na chamada", () => {
  it("acha a palavra a mais", () => {
    expect(outrasGritadas("Comente SUMIDO ou GUIA", "SUMIDO")).toEqual(["GUIA"]);
  });

  it("deixa passar as exceções do Labs e o bordão", () => {
    expect(outrasGritadas("Comente SUMIDO e receba o PDF GRÁTIS AGORA. Quem vende, VENCE.", "SUMIDO")).toEqual([]);
  });

  it("número não é palavra-chave", () => {
    expect(outrasGritadas("Comente SUMIDO e receba 100 mensagens em 2026", "SUMIDO")).toEqual([]);
  });

  it("sigla de duas letras não conta, como no Labs", () => {
    expect(outrasGritadas("Comente SUMIDO para usar com IA", "SUMIDO")).toEqual([]);
  });

  it("palavra com acento é uma palavra inteira", () => {
    expect(outrasGritadas("Comente SUMIDO na PROMOÇÃO", "SUMIDO")).toEqual(["PROMOÇÃO"]);
  });
});

describe("a conferência do que a IA devolveu", () => {
  it("passa quando está tudo certo", () => {
    expect(conferirGerado(5, "SUMIDO", CARROSSEL)).toBeNull();
    expect(conferirGerado(1, "SUMIDO", POST)).toBeNull();
  });

  it("acusa o número de slides", () => {
    expect(conferirGerado(6, "SUMIDO", CARROSSEL)).toEqual({ motivo: "slides", vieram: 3, esperados: 4 });
  });

  it("acusa a palavra que faltou, e onde", () => {
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, chamada: "Comente PROMPT e receba as mensagens." })).toEqual({
      motivo: "palavra",
      onde: "chamada",
    });
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, legenda: "L".repeat(100) })).toEqual({
      motivo: "palavra",
      onde: "legenda",
    });
  });

  it("acusa a chamada que pede outra palavra além da do bônus", () => {
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, chamada: "Comente SUMIDO ou GUIA e receba as mensagens." })).toEqual({
      motivo: "outra_palavra",
      palavras: ["GUIA"],
    });
  });

  it("acusa o tipo trocado", () => {
    expect(conferirGerado(1, "SUMIDO", CARROSSEL)).toEqual({ motivo: "tipo_errado" });
    expect(conferirGerado(5, "SUMIDO", POST)).toEqual({ motivo: "tipo_errado" });
  });

  it("na legenda, só a presença da palavra é conferida (achado 49, decisão do Eduardo)", () => {
    const legenda = `${CARROSSEL.legenda} Vale a LEITURA até o fim.`;
    expect(conferirGerado(5, "SUMIDO", { ...CARROSSEL, legenda })).toBeNull();
  });
});

describe("o texto gravado", () => {
  it("o gerado e o revisado voltam do banco com a mesma forma", () => {
    expect(textoGravado(JSON.parse(JSON.stringify(CARROSSEL)))).toEqual(CARROSSEL);
    expect(textoGravado(JSON.parse(JSON.stringify(POST)))).toEqual(POST);
  });

  it.each([null, {}, { tipo: "carrossel" }, { ...POST, tipo: "outro" }])("forma errada é null: %j", (v) => {
    expect(textoGravado(v)).toBeNull();
  });

  it("a saída da IA vira o texto do Chat", () => {
    expect(
      deCarrossel({
        titulo: CARROSSEL.titulo,
        gancho: CARROSSEL.gancho,
        slides: CARROSSEL.slides,
        chamadaParaAcao: CARROSSEL.chamada,
        legenda: CARROSSEL.legenda,
      })
    ).toEqual(CARROSSEL);
    expect(dePost({ titulo: POST.titulo, texto: POST.texto, chamadaParaAcao: POST.chamada, legenda: POST.legenda })).toEqual(
      POST
    );
  });
});

describe("os campos do formulário", () => {
  it("carrossel de 5: gancho, 3 slides com título e texto, chamada e legenda", () => {
    expect(camposDoFormulario(5).map((c) => c.nome)).toEqual([
      "gancho",
      "slide_1_titulo",
      "slide_1_texto",
      "slide_2_titulo",
      "slide_2_texto",
      "slide_3_titulo",
      "slide_3_texto",
      "chamada",
      "legenda",
    ]);
  });

  it("post de 1: texto, chamada e legenda", () => {
    expect(camposDoFormulario(1).map((c) => c.nome)).toEqual(["texto", "chamada", "legenda"]);
  });

  it("carrossel de 2: só gancho, chamada e legenda", () => {
    expect(camposDoFormulario(2).map((c) => c.nome)).toEqual(["gancho", "chamada", "legenda"]);
  });

  it("o rótulo diz em que slide o texto vai", () => {
    const campos = camposDoFormulario(5);
    expect(campos.find((c) => c.nome === "slide_1_texto")?.rotulo).toBe("Slide 2: texto");
    expect(campos.find((c) => c.nome === "chamada")?.rotulo).toBe("Chamada (slide 5)");
  });

  it("cada campo abre com o texto certo", () => {
    expect(valoresPorCampo(CARROSSEL)).toEqual({
      gancho: CARROSSEL.gancho,
      slide_1_titulo: "Título do slide 1",
      slide_1_texto: "Texto do slide 1, com mais de trinta caracteres.",
      slide_2_titulo: "Título do slide 2",
      slide_2_texto: "Texto do slide 2, com mais de trinta caracteres.",
      slide_3_titulo: "Título do slide 3",
      slide_3_texto: "Texto do slide 3, com mais de trinta caracteres.",
      chamada: CARROSSEL.chamada,
      legenda: CARROSSEL.legenda,
    });
  });
});

describe("a revisão do operador", () => {
  const bruto = (t: TextoDoCarrossel): Record<string, unknown> => ({ ...valoresPorCampo(t) });

  it("devolve o texto revisado, com o título interno de antes", () => {
    const editado = { ...bruto(CARROSSEL), gancho: "Seu cliente sumiu? Traga ele de volta." };
    expect(lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, editado)).toEqual({
      ok: true,
      texto: { ...CARROSSEL, gancho: "Seu cliente sumiu? Traga ele de volta." },
    });
  });

  it("o \\r\\n do formulário volta a ser \\n antes de contar", () => {
    const comCr = { ...bruto(CARROSSEL), legenda: CARROSSEL.legenda.replace(" Comente", "\r\nComente") };
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, comCr);
    expect(r.ok && r.texto.legenda).toBe(CARROSSEL.legenda.replace(" Comente", "\nComente"));
  });

  it("tirar a palavra da chamada é recusado, com o motivo", () => {
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, {
      ...bruto(CARROSSEL),
      chamada: "Comente PROMPT e receba as mensagens.",
    });
    expect(r).toEqual({ ok: false, problemas: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }] });
  });

  it("pôr outra palavra gritada na chamada é recusado", () => {
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, {
      ...bruto(CARROSSEL),
      chamada: "Comente SUMIDO ou GUIA e receba as mensagens.",
    });
    expect(r).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "pede também GUIA; deixe só a palavra SUMIDO" }],
    });
  });

  it("campo curto ou longo demais é recusado, na ordem da tela", () => {
    const r = lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, {
      ...bruto(CARROSSEL),
      gancho: "curto",
      slide_2_texto: "x".repeat(301),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.campo)).toEqual(["gancho", "slide_2_texto"]);
  });

  it("campo que falta no formulário conta como vazio", () => {
    const semGancho = bruto(CARROSSEL);
    delete semGancho.gancho;
    expect(lerRevisaoDoCarrossel(5, "SUMIDO", CARROSSEL.titulo, semGancho).ok).toBe(false);
  });

  it("o post de 1 volta como post", () => {
    expect(lerRevisaoDoCarrossel(1, "SUMIDO", POST.titulo, bruto(POST))).toEqual({ ok: true, texto: POST });
  });
});
```

Crie `tests/bonus-carrossel-ia-parametros.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  contextoGravado,
  mensagemDoCarrossel,
  parametrosDoCarrossel,
  parametrosDoPost,
  pedidoExtra,
  type PedidoParaIA,
} from "@/lib/bonus/carrossel-ia-parametros";
import { BETA_DO_FALLBACK, MODELO, parametrosDaGeracao } from "@/lib/bonus/ia-parametros";
import { INSTRUCAO_CARROSSEL } from "@/lib/bonus/instrucao-carrossel";
import { INSTRUCAO_POST } from "@/lib/bonus/instrucao-post";

const CONTEXTO = {
  tema: "Vendas",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
  oQueResolve: "Reativar clientes que pararam de comprar pelo WhatsApp.",
};
const PEDIDO: PedidoParaIA = { total: 10, palavra: "SUMIDO", contexto: CONTEXTO };

describe("a mensagem do carrossel", () => {
  it("segue o formato do Labs e leva o contexto do bônus", () => {
    const m = mensagemDoCarrossel(PEDIDO);
    expect(m.startsWith("Tema: Vendas\n\nO que deve resolver:\nReativar clientes")).toBe(true);
    expect(m).toContain(`O bônus que este post divulga: "${CONTEXTO.titulo}". ${CONTEXTO.descricao}`);
    expect(m.endsWith(pedidoExtra(10, "SUMIDO"))).toBe(true);
  });

  it("o total vira slides de conteúdo e substitui a faixa da instrução", () => {
    const e = pedidoExtra(10, "SUMIDO");
    expect(e).toContain("10 slides no total");
    expect(e).toContain("8 slides de conteúdo");
    expect(e).toContain("substitui a faixa de 6 a 9");
  });

  it("com 2 slides, nenhum de conteúdo", () => {
    expect(pedidoExtra(2, "SUMIDO")).toContain("nenhum slide de conteúdo");
  });

  it("a palavra vai exatamente como no Labs, e só ela", () => {
    for (const total of [1, 2, 10]) {
      const e = pedidoExtra(total, "SUMIDO");
      expect(e, String(total)).toContain("palavra SUMIDO");
      expect(e, String(total)).toContain("nenhuma outra palavra vai toda em maiúsculas");
    }
  });

  it("o post de 1 imagem pede a chamada, diz o teto do texto e não fala em slides", () => {
    // A instrução do post fala em "~350" caracteres, e o formato corta em 300 (achado 47 do auditor).
    const e = pedidoExtra(1, "SUMIDO");
    expect(e).toContain("chamadaParaAcao");
    expect(e).toContain("no máximo 300 caracteres");
    expect(e).not.toContain("slides");
  });
});

describe("os parâmetros da chamada", () => {
  it("de 2 a 10: a instrução do carrossel, intacta, com a política do bônus", () => {
    const p = parametrosDoCarrossel(PEDIDO);
    const b = parametrosDaGeracao({ tema: "x", oQueResolve: "y", palavraDigitada: null });
    expect(p.system).toBe(INSTRUCAO_CARROSSEL);
    expect([p.model, p.max_tokens, p.betas, p.fallbacks, p.output_config.effort]).toEqual([
      b.model,
      b.max_tokens,
      b.betas,
      b.fallbacks,
      b.output_config.effort,
    ]);
    expect(p.messages).toEqual([{ role: "user", content: mensagemDoCarrossel(PEDIDO) }]);
  });

  it("1: a instrução do post", () => {
    expect(parametrosDoPost({ ...PEDIDO, total: 1 }).system).toBe(INSTRUCAO_POST);
  });

  it("a palavra não entra na instrução: o que muda a cada pedido vai na mensagem", () => {
    expect(parametrosDoCarrossel(PEDIDO).system).not.toContain("SUMIDO");
    expect(JSON.stringify(parametrosDoCarrossel(PEDIDO).messages)).toContain("SUMIDO");
  });

  it("sem cache_control, e o modelo do bônus", () => {
    const p = parametrosDoCarrossel(PEDIDO);
    expect(JSON.stringify(p)).not.toContain("cache_control");
    expect(p.model).toBe(MODELO);
    expect(p.betas).toEqual([BETA_DO_FALLBACK]);
  });
});

describe("o contexto gravado na linha", () => {
  it("aceita o que a action grava", () => {
    expect(contextoGravado(CONTEXTO)).toEqual(CONTEXTO);
  });

  it.each([null, {}, { ...CONTEXTO, tema: 1 }, "x"])("recusa o que não tem a forma: %j", (v) => {
    expect(contextoGravado(v)).toBeNull();
  });
});
```

- [ ] **Passo 2: ver os dois falharem**

```bash
npx vitest run tests/bonus-carrossel-texto.test.ts tests/bonus-carrossel-ia-parametros.test.ts
```

Esperado: FAIL por import que não resolve nos dois.

- [ ] **Passo 3: escrever o texto do carrossel**

Crie `lib/bonus/carrossel-texto.ts`:

```ts
// O TEXTO DE UM CARROSSEL: a forma que o Chat guarda, as conferências e a revisão.
//
// PURO. A forma é uma só para o que a IA gerou e para o que o operador revisou, e é ela que vai
// para `carrosseis_gerados.gerado` e `.revisado` (objeto cru, nunca `JSON.stringify`).
//
// A CHAMADA PEDE A PALAVRA DO BÔNUS E NENHUMA OUTRA, na hora de gerar e na de salvar. É a falha
// que o Labs registrou em `src/lib/ia/funil.ts`: um carrossel pedindo "Comente EXCEL", palavra
// que não existia, deixaria quem comentou sem resposta, e nada no sistema acusaria.
import { z } from "zod";
import { slidesDeConteudo } from "./carrossel-pedido";
import type { CarrosselDoChat, PostDoChat } from "./carrossel-schema";

export type Slide = { titulo: string; texto: string };

export type TextoDeCarrossel = {
  tipo: "carrossel";
  titulo: string;
  gancho: string;
  slides: Slide[];
  chamada: string;
  legenda: string;
};

export type TextoDePost = { tipo: "post"; titulo: string; texto: string; chamada: string; legenda: string };

export type TextoDoCarrossel = TextoDeCarrossel | TextoDePost;

export function deCarrossel(d: CarrosselDoChat): TextoDeCarrossel {
  return {
    tipo: "carrossel",
    titulo: d.titulo,
    gancho: d.gancho,
    slides: d.slides.map((s) => ({ titulo: s.titulo, texto: s.texto })),
    chamada: d.chamadaParaAcao,
    legenda: d.legenda,
  };
}

export function dePost(d: PostDoChat): TextoDePost {
  return { tipo: "post", titulo: d.titulo, texto: d.texto, chamada: d.chamadaParaAcao, legenda: d.legenda };
}

const TextoGravadoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("carrossel"),
    titulo: z.string(),
    gancho: z.string(),
    slides: z.array(z.object({ titulo: z.string(), texto: z.string() })),
    chamada: z.string(),
    legenda: z.string(),
  }),
  z.object({
    tipo: z.literal("post"),
    titulo: z.string(),
    texto: z.string(),
    chamada: z.string(),
    legenda: z.string(),
  }),
]);

/** O `gerado` ou o `revisado` lidos do banco. Forma errada → null, e a tela diz isso. */
export function textoGravado(v: unknown): TextoDoCarrossel | null {
  const r = TextoGravadoSchema.safeParse(v);
  return r.success ? r.data : null;
}

/**
 * A palavra INTEIRA, em maiúsculas: sem letra nem número colado antes ou depois. Com a bandeira
 * `u`, `\p{L}` inclui as letras acentuadas; um `\b` acharia PROMO dentro de PROMOÇÃO (achado 46
 * do auditor).
 */
export function temPalavra(texto: string, palavra: string): boolean {
  if (!/^[A-Z0-9]+$/.test(palavra)) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${palavra}(?![\\p{L}\\p{N}])`, "u").test(texto);
}

/**
 * Palavras que costumam aparecer gritadas numa chamada sem serem palavra-chave. A LISTA É A DO
 * LABS (site-ia, src/lib/ia/funil.ts, `RARAMENTE_E_PALAVRA_CHAVE`), com VENCE do bordão
 * "Quem vende, VENCE." que as duas instruções ensinam.
 */
export const GRITADAS_PERMITIDAS: ReadonlySet<string> = new Set([
  "PDF",
  "LINK",
  "BIO",
  "GRATIS",
  "GRÁTIS",
  "AQUI",
  "AGORA",
  "VENCE",
]);

/**
 * As OUTRAS palavras gritadas: todas em maiúsculas, de 3 caracteres ou mais, com pelo menos uma
 * letra (número não é palavra-chave), fora a palavra do bônus e as permitidas. Decisão do
 * Eduardo em 30/09: "Comente SUMIDO ou GUIA" é recusada.
 */
export function outrasGritadas(texto: string, palavra: string): string[] {
  const achadas = texto.match(/(?<![\p{L}\p{N}])[\p{Lu}\p{N}]{3,}(?![\p{L}\p{N}])/gu) ?? [];
  return [...new Set(achadas)].filter((w) => /\p{Lu}/u.test(w) && w !== palavra && !GRITADAS_PERMITIDAS.has(w));
}

export type FalhaDaConferencia =
  | { motivo: "tipo_errado" }
  | { motivo: "slides"; vieram: number; esperados: number }
  | { motivo: "palavra"; onde: "chamada" | "legenda" }
  | { motivo: "outra_palavra"; palavras: string[] };

/**
 * O que a IA devolveu serve? `null` é que serve.
 *
 * "Nenhuma outra palavra" vale SÓ NA CHAMADA; na legenda, só se confere que a palavra está lá.
 * Decisão do Eduardo em 30/09 (achado 49 do auditor): o Labs também só confere a chamada, e uma
 * legenda de até 900 caracteres tem ênfases em maiúsculas que recusariam gerações boas. O
 * operador revisa a legenda antes de usar.
 */
export function conferirGerado(total: number, palavra: string, t: TextoDoCarrossel): FalhaDaConferencia | null {
  if ((total === 1) !== (t.tipo === "post")) return { motivo: "tipo_errado" };
  if (t.tipo === "carrossel" && t.slides.length !== slidesDeConteudo(total)) {
    return { motivo: "slides", vieram: t.slides.length, esperados: slidesDeConteudo(total) };
  }
  if (!temPalavra(t.chamada, palavra)) return { motivo: "palavra", onde: "chamada" };
  if (!temPalavra(t.legenda, palavra)) return { motivo: "palavra", onde: "legenda" };
  const outras = outrasGritadas(t.chamada, palavra);
  if (outras.length) return { motivo: "outra_palavra", palavras: outras };
  return null;
}

export type CampoDoCarrossel = { nome: string; rotulo: string; min: number; max: number; linhas: number };

/**
 * Os campos da tela, na ordem do post, com os tetos do formato (carrossel-schema.ts). É a fonte
 * única dos nomes do formulário: a tela desenha a partir daqui, e a revisão lê a partir daqui.
 */
export function camposDoFormulario(total: number): CampoDoCarrossel[] {
  if (total === 1) {
    return [
      { nome: "texto", rotulo: "Texto da imagem", min: 60, max: 300, linhas: 5 },
      { nome: "chamada", rotulo: "Chamada", min: 20, max: 200, linhas: 3 },
      { nome: "legenda", rotulo: "Legenda do post", min: 80, max: 900, linhas: 8 },
    ];
  }
  const slides = Array.from({ length: slidesDeConteudo(total) }, (_, i) => [
    { nome: `slide_${i + 1}_titulo`, rotulo: `Slide ${i + 2}: título`, min: 8, max: 70, linhas: 1 },
    { nome: `slide_${i + 1}_texto`, rotulo: `Slide ${i + 2}: texto`, min: 30, max: 300, linhas: 4 },
  ]).flat();
  return [
    { nome: "gancho", rotulo: "Gancho (slide 1)", min: 15, max: 120, linhas: 2 },
    ...slides,
    { nome: "chamada", rotulo: `Chamada (slide ${total})`, min: 20, max: 200, linhas: 3 },
    { nome: "legenda", rotulo: "Legenda do post", min: 80, max: 900, linhas: 8 },
  ];
}

export function valoresPorCampo(t: TextoDoCarrossel): Record<string, string> {
  if (t.tipo === "post") return { texto: t.texto, chamada: t.chamada, legenda: t.legenda };
  const valores: Record<string, string> = { gancho: t.gancho };
  t.slides.forEach((s, i) => {
    valores[`slide_${i + 1}_titulo`] = s.titulo;
    valores[`slide_${i + 1}_texto`] = s.texto;
  });
  valores.chamada = t.chamada;
  valores.legenda = t.legenda;
  return valores;
}

/** O \r\n do textarea volta a ser \n antes de contar (a lição da FASE 1.11-bis). */
function texto(v: unknown): string {
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
}

/**
 * A revisão do operador. O número de slides não muda (vem do pedido), o título interno não se
 * edita, e a palavra vem da linha, nunca do formulário.
 */
export function lerRevisaoDoCarrossel(
  total: number,
  palavra: string,
  titulo: string,
  bruto: Record<string, unknown>
): { ok: true; texto: TextoDoCarrossel } | { ok: false; problemas: { campo: string; erro: string }[] } {
  const v: Record<string, string> = {};
  const problemas: { campo: string; erro: string }[] = [];
  for (const c of camposDoFormulario(total)) {
    const t = texto(bruto[c.nome]);
    v[c.nome] = t;
    if (t.length < c.min) problemas.push({ campo: c.nome, erro: `precisa de pelo menos ${c.min} caracteres` });
    else if (t.length > c.max) problemas.push({ campo: c.nome, erro: `passa de ${c.max} caracteres` });
  }
  // As mesmas regras de `conferirGerado`, e na mesma ordem: sem a palavra, é isso que se diz da
  // chamada; com ela, as outras gritadas. Na legenda, só a presença (achado 49).
  if (v.chamada && !temPalavra(v.chamada, palavra)) {
    problemas.push({ campo: "chamada", erro: `precisa pedir a palavra ${palavra}` });
  } else if (v.chamada) {
    const outras = outrasGritadas(v.chamada, palavra);
    if (outras.length) {
      problemas.push({ campo: "chamada", erro: `pede também ${outras.join(", ")}; deixe só a palavra ${palavra}` });
    }
  }
  if (v.legenda && !temPalavra(v.legenda, palavra)) {
    problemas.push({ campo: "legenda", erro: `precisa pedir a palavra ${palavra}` });
  }
  if (problemas.length) return { ok: false, problemas };

  if (total === 1) {
    return { ok: true, texto: { tipo: "post", titulo, texto: v.texto, chamada: v.chamada, legenda: v.legenda } };
  }
  const slides = Array.from({ length: slidesDeConteudo(total) }, (_, i) => ({
    titulo: v[`slide_${i + 1}_titulo`],
    texto: v[`slide_${i + 1}_texto`],
  }));
  return {
    ok: true,
    texto: { tipo: "carrossel", titulo, gancho: v.gancho, slides, chamada: v.chamada, legenda: v.legenda },
  };
}
```

- [ ] **Passo 4: escrever a mensagem e os parâmetros**

Crie `lib/bonus/carrossel-ia-parametros.ts`:

```ts
// OS PARÂMETROS DA CHAMADA À IA PARA O CARROSSEL, PUROS, para o teste ver o que sai sem gastar
// nada. A política (modelo, esforço, fallback, sem cache) é a do bônus (ia-parametros.ts), e o
// formato da mensagem é o do `gerar` do Labs (site-ia, src/lib/ia/gerar.ts): "Tema", "O que
// deve resolver" e o pedido extra no fim.
//
// O QUE MUDA A CADA PEDIDO VAI NA MENSAGEM, E NUNCA NA INSTRUÇÃO: a instrução é a do Labs,
// intacta. O total, a palavra e o bônus mudam; ela não.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { slidesDeConteudo } from "./carrossel-pedido";
import { CarrosselDoChatSchema, PostDoChatSchema } from "./carrossel-schema";
import { BETA_DO_FALLBACK, MODELO } from "./ia-parametros";
import { INSTRUCAO_CARROSSEL } from "./instrucao-carrossel";
import { INSTRUCAO_POST } from "./instrucao-post";

/** O que o Labs dizia do bônus no momento do pedido, mais o que o operador pediu na Etapa 1. */
export type ContextoDoCarrossel = { tema: string; titulo: string; descricao: string; oQueResolve: string };

export type PedidoParaIA = { total: number; palavra: string; contexto: ContextoDoCarrossel };

/** O contexto como a action o gravou em `carrosseis_gerados.contexto`. Forma errada → null. */
export function contextoGravado(v: unknown): ContextoDoCarrossel | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { tema, titulo, descricao, oQueResolve } = o;
  if (
    typeof tema !== "string" ||
    typeof titulo !== "string" ||
    typeof descricao !== "string" ||
    typeof oQueResolve !== "string"
  ) {
    return null;
  }
  return { tema, titulo, descricao, oQueResolve };
}

/**
 * O PEDIDO É MAIS ESTREITO QUE A CONFERÊNCIA: a mensagem proíbe na chamada toda outra palavra em
 * maiúsculas, menos VENCE, e `outrasGritadas` (carrossel-texto.ts) ainda deixa passar as exceções
 * do Labs. Pedir mais do que se confere poupa gerações recusadas.
 */
function pedirPalavra(palavra: string): string {
  return (
    `Na chamada para ação, peça para comentar a palavra ${palavra}, escrita exatamente assim, em maiúsculas, e termine a legenda no mesmo pedido. ` +
    "Na chamada, nenhuma outra palavra vai toda em maiúsculas, fora VENCE do bordão."
  );
}

/**
 * O pedido que muda a cada geração. O TOTAL SUBSTITUI a faixa de 6 a 9 que a instrução do
 * carrossel escreve (no parágrafo dos slides do meio e no campo `slides`), porque aqui o total vai
 * de 2 a 10; e o post único leva o teto de 300 que o formato impõe (a instrução do post fala em
 * "~350" no campo `texto`). Achado 47 do auditor.
 */
export function pedidoExtra(total: number, palavra: string): string {
  if (total === 1) {
    return (
      "Este post PEDE uma ação: preencha `chamadaParaAcao`. " +
      pedirPalavra(palavra) +
      " O texto da imagem tem no máximo 300 caracteres."
    );
  }
  const conteudo = slidesDeConteudo(total);
  const meio =
    conteudo === 0
      ? "Ou seja, nenhum slide de conteúdo: o campo `slides` vem vazio."
      : `Ou seja, ${conteudo} slides de conteúdo entre os dois.`;
  return (
    `Este post precisa ter ${total} slides no total, contando o gancho e a chamada para ação. ${meio} ` +
    `Esse número substitui a faixa de 6 a 9 da instrução. ${pedirPalavra(palavra)}`
  );
}

export function mensagemDoCarrossel(p: PedidoParaIA): string {
  const c = p.contexto;
  return (
    `Tema: ${c.tema}\n\nO que deve resolver:\n${c.oQueResolve}\n\n` +
    `O bônus que este post divulga: "${c.titulo}". ${c.descricao}\n\n` +
    pedidoExtra(p.total, p.palavra)
  );
}

/** De 2 a 10 slides. */
export function parametrosDoCarrossel(p: PedidoParaIA) {
  return {
    model: MODELO,
    max_tokens: 16_000,
    betas: [BETA_DO_FALLBACK],
    fallbacks: "default" as const,
    system: INSTRUCAO_CARROSSEL,
    messages: [{ role: "user" as const, content: mensagemDoCarrossel(p) }],
    output_config: { effort: "high" as const, format: betaZodOutputFormat(CarrosselDoChatSchema) },
  };
}

/** 1 slide: o post de imagem única, com instrução própria (ver o topo de instrucao-post.ts). */
export function parametrosDoPost(p: PedidoParaIA) {
  return {
    model: MODELO,
    max_tokens: 16_000,
    betas: [BETA_DO_FALLBACK],
    fallbacks: "default" as const,
    system: INSTRUCAO_POST,
    messages: [{ role: "user" as const, content: mensagemDoCarrossel(p) }],
    output_config: { effort: "high" as const, format: betaZodOutputFormat(PostDoChatSchema) },
  };
}
```

- [ ] **Passo 5: ver os dois passarem**

```bash
npx vitest run tests/bonus-carrossel-texto.test.ts tests/bonus-carrossel-ia-parametros.test.ts
```

Esperado: PASS em todos.

- [ ] **Passo 6: escrever a chamada à IA**

Crie `lib/bonus/carrossel-ia.ts`:

```ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { parametrosDoCarrossel, parametrosDoPost, type PedidoParaIA } from "./carrossel-ia-parametros";
import { deCarrossel, dePost, type TextoDoCarrossel } from "./carrossel-texto";
import { mensagemDeErro } from "./erros";
import { TEXTO_SEM_CHAVE } from "./ia";
import { medicaoDe, type Medicao } from "./ia-parametros";
import { TIMEOUT_IA_MS } from "./tempos";

// A CHAMADA À IA PARA O CARROSSEL. O resto da feature não conhece a SDK; a política mora em
// carrossel-ia-parametros.ts, que é puro e testado. Molde: lib/bonus/ia.ts.

export type ResultadoDoCarrossel =
  | { ok: true; texto: TextoDoCarrossel; medicao: Medicao }
  | { ok: false; erro: string; medicao: Medicao | null };

type RespostaParseada<T> = {
  model: string;
  usage: Parameters<typeof medicaoDe>[1];
  stop_reason: string | null;
  parsed_output?: T | null;
};

function resultadoDe<T>(r: RespostaParseada<T>, converter: (d: T) => TextoDoCarrossel): ResultadoDoCarrossel {
  const medicao = medicaoDe(r.model, r.usage);
  if (r.stop_reason === "refusal") {
    return { ok: false, erro: "O modelo recusou o pedido. Gere de novo.", medicao };
  }
  if (r.stop_reason === "max_tokens") {
    return { ok: false, erro: "A resposta da IA passou do tamanho máximo e veio cortada. Gere de novo.", medicao };
  }
  if (!r.parsed_output) {
    return { ok: false, erro: "A IA respondeu fora do formato esperado. Gere de novo.", medicao };
  }
  return { ok: true, texto: converter(r.parsed_output), medicao };
}

/**
 * `maxRetries: 0` DE PROPÓSITO, como no bônus: com o padrão da SDK (2), o pior caso passaria do
 * teto da página. A repetição que resta é o botão "Gerar de novo", que conta no teto diário.
 */
export async function gerarTextoDoCarrossel(p: PedidoParaIA): Promise<ResultadoDoCarrossel> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, erro: TEXTO_SEM_CHAVE, medicao: null };

  const cliente = new Anthropic({ timeout: TIMEOUT_IA_MS, maxRetries: 0 });
  try {
    if (p.total === 1) return resultadoDe(await cliente.beta.messages.parse(parametrosDoPost(p)), dePost);
    return resultadoDe(await cliente.beta.messages.parse(parametrosDoCarrossel(p)), deCarrossel);
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e), medicao: null };
  }
}
```

Rode `npm run typecheck`. Esperado: sem erro. `carrossel-ia.ts` não tem teste próprio, como
`ia.ts`: ele é exercitado pelo processo (FASE 2.7) com o gerador trocado por um falso, e de
verdade na prova real.

- [ ] **Passo 7: provar que os testes medem**

Um de cada vez, rodando `npx vitest run tests/bonus-carrossel-texto.test.ts tests/bonus-carrossel-ia-parametros.test.ts`
e desfazendo em seguida:
1. Em `temPalavra`, troque os dois lookarounds por `\\b` (`new RegExp(\`\\b${palavra}\\b\`, "u")`).
   Esperado: FAIL em "letra acentuada colada também conta como parte da palavra".
2. Em `conferirGerado`, apague as duas linhas de `outrasGritadas`. Esperado: FAIL em "acusa a
   chamada que pede outra palavra além da do bônus".
3. Em `outrasGritadas`, tire `/\p{Lu}/u.test(w) &&`. Esperado: FAIL em "número não é
   palavra-chave".
4. Em `parametrosDoCarrossel`, troque `system: INSTRUCAO_CARROSSEL` por
   `system: \`${INSTRUCAO_CARROSSEL}\n\n${pedidoExtra(p.total, p.palavra)}\``. Esperado: FAIL em
   "a instrução do carrossel, intacta" e em "a palavra não entra na instrução".

- [ ] **Passo 8: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-texto.ts lib/bonus/carrossel-ia-parametros.ts lib/bonus/carrossel-ia.ts tests/bonus-carrossel-texto.test.ts tests/bonus-carrossel-ia-parametros.test.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add lib/bonus/carrossel-texto.ts lib/bonus/carrossel-ia-parametros.ts lib/bonus/carrossel-ia.ts tests/bonus-carrossel-texto.test.ts tests/bonus-carrossel-ia-parametros.test.ts
git commit -m "feat(bonus): a mensagem do carrossel e as conferências da palavra, do tamanho e da revisão"
```

---

### FASE 2.6 — As frases, a tela e o achado 43

**Arquivos:**
- Criar: `lib/bonus/carrossel-linha.ts`, `lib/bonus/carrossel-textos.ts`, `lib/bonus/carrossel-tela.ts`
- Modificar: `lib/bonus/textos.ts` (3 títulos), `lib/bonus/tela.ts` (1 rótulo),
  `tests/bonus-tela.test.ts` (1 expectativa)
- Testar: `tests/bonus-carrossel-textos.test.ts`, `tests/bonus-carrossel-tela.test.ts`,
  `tests/bonus-achado-43.test.ts`

**Interfaces:**
- Consome: `EstadoDaGeracao`, `geracaoNaTela`, `TRAVADA_MS` de `tempos.ts`; `TipoDoRotulo` de
  `tela.ts`; `TomDoQuadro` de `textos.ts`; `Aviso` de `@/lib/avisos`; `SituacaoNoLabs` (2.3);
  `camposDoFormulario`, `textoGravado`, `FalhaDaConferencia`, `TextoDoCarrossel` (2.5);
  `SLIDES_MIN`, `SLIDES_MAX`, `TETO_CARROSSEL_DIARIO`, `RecusaDoPedidoDeCarrossel` (2.2).
- Produz, em `carrossel-linha.ts`: `type LinhaDoCarrossel` (as colunas da 014).
- Produz, em `carrossel-textos.ts`: `urlDoCarrosselComAviso(bonusId: string, carrosselId: string, aviso: Aviso): string`;
  `textoDaRecusaDoPedidoDeCarrossel(motivo: RecusaDoPedidoDeCarrossel): string`;
  `textoDoTetoDoCarrossel(): string`; `quadroDaSituacao(s: SituacaoNoLabs): { tom: TomDoQuadro; texto: string }`;
  `textoDaConferencia(f: FalhaDaConferencia, palavra: string): string`;
  `textoDosProblemasDoCarrossel(total: number, problemas: { campo: string; erro: string }[]): string`;
  `avisoDePalavraTrocada(noLabs: string, noCarrossel: string): string`; e as constantes
  `TEXTO_SO_BONUS_CRIADO`, `TEXTO_CARROSSEL_NAO_ENCONTRADO`, `TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO`,
  `TEXTO_CARROSSEL_NAO_REVISAVEL`, `TEXTO_REVISAO_SALVA`, `TEXTO_TABELA_CARROSSEL_AUSENTE`,
  `TEXTO_CARROSSEL_SEM_TEXTO`.
- Produz, em `carrossel-tela.ts`: `textoDaLinhaDoCarrossel(l: LinhaDoCarrossel): TextoDoCarrossel | null`;
  `descricaoDoCarrossel(l: Pick<LinhaDoCarrossel, "total_slides">): string`;
  `rotuloDoCarrossel(l: LinhaDoCarrossel, agoraMs: number): { texto: string; tipo: TipoDoRotulo }`.

- [ ] **Passo 1: escrever os testes, e mudar a expectativa antiga**

Em `tests/bonus-tela.test.ts`, troque
`expect(rotuloDaLinha(linha({ envio_estado: "criado" }), T0)).toEqual({ texto: "No Labs, oculto", tipo: "ok" });`
por
`expect(rotuloDaLinha(linha({ envio_estado: "criado" }), T0)).toEqual({ texto: "Criado no Labs", tipo: "ok" });`.

Crie `tests/bonus-achado-43.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detalheDe } from "@/lib/bonus/desfecho";
import { quadroDoEnvio } from "@/lib/bonus/textos";

// ACHADO 43 DO AUDITOR (30/09): a tela afirmava "ainda oculto" de um bônus que o operador já
// tinha publicado no /admin do Labs. O que era verdade na criação continua podendo ser dito; o
// estado ATUAL só se afirma lendo o Labs (lib/bonus/publicado.ts).
describe("as frases de um bônus criado não afirmam o estado atual no Labs", () => {
  it.each(["criado", "criado_pelo_titulo", "criado_pela_duplicata", "conferido_existe"] as const)("%s", (motivo) => {
    const q = quadroDoEnvio(motivo, detalheDe(null), "kit");
    expect(`${q.titulo} ${q.texto}`).not.toMatch(/ainda oculto/i);
  });
});
```

Crie `tests/bonus-carrossel-textos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  avisoDePalavraTrocada,
  quadroDaSituacao,
  textoDaConferencia,
  textoDaRecusaDoPedidoDeCarrossel,
  textoDosProblemasDoCarrossel,
  textoDoTetoDoCarrossel,
  urlDoCarrosselComAviso,
} from "@/lib/bonus/carrossel-textos";
import type { SituacaoNoLabs } from "@/lib/bonus/publicado";

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("as frases do carrossel", () => {
  it("a URL de volta leva texto E tom", () => {
    expect(urlDoCarrosselComAviso(BONUS, CARROSSEL, { tom: "ok", texto: "salvo & pronto" })).toBe(
      `/bonus/${BONUS}/carrossel/${CARROSSEL}?aviso=salvo%20%26%20pronto&tom=ok`
    );
  });

  it("cada situação no Labs tem frase, e só a publicada é verde e diz a palavra", () => {
    const situacoes: SituacaoNoLabs[] = [
      { tipo: "publicado", bonus: { palavra: "SUMIDO", titulo: "t", descricao: "d", tema: "Vendas" } },
      { tipo: "nao_publicado" },
      { tipo: "sem_resposta" },
      { tipo: "formato_estranho" },
      { tipo: "sem_config" },
    ];
    for (const s of situacoes) {
      const q = quadroDaSituacao(s);
      expect(q.texto.length, s.tipo).toBeGreaterThan(10);
      expect(q.tom === "ok", s.tipo).toBe(s.tipo === "publicado");
    }
    expect(quadroDaSituacao(situacoes[0]).texto).toContain("SUMIDO");
  });

  it("cada falha da conferência diz o que fazer", () => {
    expect(textoDaConferencia({ motivo: "slides", vieram: 7, esperados: 8 }, "SUMIDO")).toContain(
      "Vieram 7 slides de conteúdo, e o pedido era 8"
    );
    expect(textoDaConferencia({ motivo: "palavra", onde: "legenda" }, "SUMIDO")).toContain("palavra SUMIDO na legenda");
    expect(textoDaConferencia({ motivo: "outra_palavra", palavras: ["GUIA"] }, "SUMIDO")).toContain("GUIA");
    expect(textoDaConferencia({ motivo: "tipo_errado" }, "SUMIDO")).toContain("Gere de novo");
  });

  it("recusas e teto têm frase", () => {
    expect(textoDaRecusaDoPedidoDeCarrossel("total_invalido")).toContain("de 1 a 10");
    expect(textoDaRecusaDoPedidoDeCarrossel("bonus_invalido").length).toBeGreaterThan(10);
    expect(textoDoTetoDoCarrossel()).toContain("10 carrosséis");
  });

  it("os problemas da revisão usam o rótulo da tela", () => {
    expect(textoDosProblemasDoCarrossel(5, [{ campo: "slide_2_texto", erro: "passa de 300 caracteres" }])).toBe(
      "Slide 3: texto: passa de 300 caracteres."
    );
  });

  it("a palavra trocada no Labs diz as duas", () => {
    const t = avisoDePalavraTrocada("SUMIDO", "ZZTESTECHAT");
    expect(t).toContain("SUMIDO");
    expect(t).toContain("ZZTESTECHAT");
  });
});
```

Crie `tests/bonus-carrossel-tela.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import type { TextoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import { TRAVADA_MS } from "@/lib/bonus/tempos";

const T0 = Date.parse("2026-09-30T12:00:00Z");
const GERADO: TextoDoCarrossel = {
  tipo: "post",
  titulo: "Gerado pela IA",
  texto: "T".repeat(80),
  chamada: "Comente SUMIDO e receba.",
  legenda: "L".repeat(100),
};

function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
  return {
    id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
    bonus_id: "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f",
    criado_em: new Date(T0),
    total_slides: 1,
    palavra: "SUMIDO",
    contexto: {},
    estado: "pronto",
    gerado: GERADO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(T0),
    revisado_em: null,
    ...troca,
  };
}

describe("o que a tela mostra de um carrossel", () => {
  it("o revisado vence o gerado", () => {
    const revisado = { ...GERADO, titulo: "Revisado pelo operador" };
    expect(textoDaLinhaDoCarrossel(linha({ revisado }))?.titulo).toBe("Revisado pelo operador");
    expect(textoDaLinhaDoCarrossel(linha({}))?.titulo).toBe("Gerado pela IA");
  });

  it("sem texto de forma válida, nada", () => {
    expect(textoDaLinhaDoCarrossel(linha({ gerado: { lixo: true } }))).toBeNull();
  });

  it("a descrição diz o tamanho", () => {
    expect(descricaoDoCarrossel({ total_slides: 1 })).toBe("Post de 1 imagem");
    expect(descricaoDoCarrossel({ total_slides: 10 })).toBe("Carrossel de 10 slides");
  });

  it.each([
    [{ estado: "pendente" as const }, T0 + 1000, { texto: "Gerando", tipo: "neutro" }],
    [{ estado: "gerando" as const }, T0 + TRAVADA_MS + 1, { texto: "Travou", tipo: "erro" }],
    [{ estado: "falhou" as const }, T0, { texto: "Falhou", tipo: "erro" }],
    [{}, T0, { texto: "Pronto para revisar", tipo: "neutro" }],
    [{ revisado_em: new Date(T0) }, T0, { texto: "Revisado", tipo: "ok" }],
  ])("rótulo de %j", (troca, agora, esperado) => {
    expect(rotuloDoCarrossel(linha(troca), agora)).toEqual(esperado);
  });
});
```

- [ ] **Passo 2: ver os testes falharem**

```bash
npx vitest run tests/bonus-achado-43.test.ts tests/bonus-tela.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts
```

Esperado: FAIL em `bonus-achado-43` (os três títulos "Criado no Labs, ainda oculto"), FAIL em
`bonus-tela` (o rótulo "No Labs, oculto"), e FAIL por import que não resolve nos dois arquivos
novos do carrossel.

- [ ] **Passo 3: corrigir as frases do achado 43**

Em `lib/bonus/textos.ts`, troque as três ocorrências de `titulo: "Criado no Labs, ainda oculto",`
por `titulo: "Criado no Labs como oculto",` (em `criado`, `criado_pelo_titulo` e
`criado_pela_duplicata`). Em `lib/bonus/tela.ts`, troque
`return { texto: "No Labs, oculto", tipo: "ok" };` por `return { texto: "Criado no Labs", tipo: "ok" };`.

- [ ] **Passo 4: escrever o tipo da linha, as frases e a tela**

Crie `lib/bonus/carrossel-linha.ts`:

```ts
// A LINHA DE `carrosseis_gerados` como o driver a devolve (migrations/014-carrosseis-gerados.sql).
// Só tipos: é o que carrossel-repositorio.ts (server-only) e carrossel-tela.ts (puro) compartilham.
import type { EstadoDaGeracao } from "./tempos";

export type LinhaDoCarrossel = {
  id: string;
  bonus_id: string;
  criado_em: Date;
  total_slides: number;
  palavra: string;
  contexto: unknown;
  estado: EstadoDaGeracao;
  gerado: unknown;
  revisado: unknown;
  erro: string | null;
  medicao: unknown;
  gerado_em: Date | null;
  revisado_em: Date | null;
};
```

Crie `lib/bonus/carrossel-textos.ts`:

```ts
// AS FRASES DO CARROSSEL, fora do JSX (mesmo princípio de lib/bonus/textos.ts): uma saída muda
// é indistinguível de sucesso, e o texto de cada saída vem de função pura, com teste.
import type { Aviso } from "@/lib/avisos";
import { SLIDES_MAX, SLIDES_MIN, TETO_CARROSSEL_DIARIO, type RecusaDoPedidoDeCarrossel } from "./carrossel-pedido";
import { camposDoFormulario, type FalhaDaConferencia } from "./carrossel-texto";
import type { SituacaoNoLabs } from "./publicado";
import type { TomDoQuadro } from "./textos";

/** O aviso vai pela URL com texto E tom: `avisoDaUrl` lê os dois, e sem tom tudo vira erro. */
export function urlDoCarrosselComAviso(bonusId: string, carrosselId: string, aviso: Aviso): string {
  return `/bonus/${bonusId}/carrossel/${carrosselId}?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
}

export function textoDaRecusaDoPedidoDeCarrossel(motivo: RecusaDoPedidoDeCarrossel): string {
  switch (motivo) {
    case "bonus_invalido":
      return "Esse bônus não existe, ou o endereço está errado.";
    case "total_invalido":
      return `Escolha de ${SLIDES_MIN} a ${SLIDES_MAX} slides.`;
  }
}

export function textoDoTetoDoCarrossel(): string {
  return `Você já gerou ${TETO_CARROSSEL_DIARIO} carrosséis nas últimas 24 horas, que é o limite. Ele volta a abrir quando o pedido mais antigo completar um dia.`;
}

export const TEXTO_SO_BONUS_CRIADO =
  "Só dá para gerar carrossel de um bônus que já foi criado no Labs e está publicado lá.";
export const TEXTO_CARROSSEL_NAO_ENCONTRADO = "Esse carrossel não existe, ou o endereço está errado.";
export const TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO =
  "Só dá para gerar de novo um carrossel cuja geração falhou ou travou.";
export const TEXTO_CARROSSEL_NAO_REVISAVEL = "Esse carrossel não está pronto para revisar.";
export const TEXTO_REVISAO_SALVA = "Revisão salva.";
export const TEXTO_TABELA_CARROSSEL_AUSENTE =
  "Falta a tabela dos carrosséis neste banco. Aplique a migração 014 (migrations/014-carrosseis-gerados.sql) e recarregue.";
export const TEXTO_CARROSSEL_SEM_TEXTO = "O texto deste carrossel não passou na conferência de formato. Gere de novo.";

/** A situação do bônus no Labs, lida agora. Só "publicado" é verde. */
export function quadroDaSituacao(s: SituacaoNoLabs): { tom: TomDoQuadro; texto: string } {
  switch (s.tipo) {
    case "publicado":
      return { tom: "ok", texto: `Publicado no Labs · palavra ${s.bonus.palavra}` };
    case "nao_publicado":
      return {
        tom: "atencao",
        texto: "Criado no Labs como oculto. Publique no /admin do Labs para gerar e usar carrossel.",
      };
    case "sem_resposta":
      return { tom: "atencao", texto: "Não consegui consultar o Labs agora. Recarregue a página em instantes." };
    case "formato_estranho":
      return {
        tom: "erro",
        texto: "O Labs respondeu num formato que o Chat não reconhece. Avise quem cuida do Labs.",
      };
    case "sem_config":
      return {
        tom: "erro",
        texto: "A LABS_URL deste servidor está ausente ou inválida, então o Chat não consegue consultar o Labs.",
      };
  }
}

export function textoDaConferencia(f: FalhaDaConferencia, palavra: string): string {
  switch (f.motivo) {
    case "tipo_errado":
      return "A IA devolveu um formato diferente do pedido. Gere de novo.";
    case "slides":
      return `Vieram ${f.vieram} slides de conteúdo, e o pedido era ${f.esperados}. Gere de novo.`;
    case "palavra":
      return `A IA não pôs a palavra ${palavra} na ${f.onde}. Gere de novo.`;
    case "outra_palavra":
      return `A chamada pede também ${f.palavras.join(", ")}, além de ${palavra}. Gere de novo.`;
  }
}

export function textoDosProblemasDoCarrossel(total: number, problemas: { campo: string; erro: string }[]): string {
  const rotulos = new Map(camposDoFormulario(total).map((c) => [c.nome, c.rotulo]));
  return `${problemas.map((p) => `${rotulos.get(p.campo) ?? p.campo}: ${p.erro}`).join(". ")}.`;
}

export function avisoDePalavraTrocada(noLabs: string, noCarrossel: string): string {
  return `No Labs, a palavra deste bônus agora é ${noLabs}, e este carrossel pede ${noCarrossel}. Gere outro carrossel para usar a palavra nova.`;
}
```

Crie `lib/bonus/carrossel-tela.ts`:

```ts
// O QUE A TELA MOSTRA PARA CADA CARROSSEL, decidido fora do JSX, com teste.
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { textoGravado, type TextoDoCarrossel } from "./carrossel-texto";
import type { TipoDoRotulo } from "./tela";
import { geracaoNaTela } from "./tempos";

/** O que abre no formulário e no título: o último revisado, ou o gerado. */
export function textoDaLinhaDoCarrossel(l: LinhaDoCarrossel): TextoDoCarrossel | null {
  return textoGravado(l.revisado) ?? textoGravado(l.gerado);
}

export function descricaoDoCarrossel(l: Pick<LinhaDoCarrossel, "total_slides">): string {
  return l.total_slides === 1 ? "Post de 1 imagem" : `Carrossel de ${l.total_slides} slides`;
}

export function rotuloDoCarrossel(l: LinhaDoCarrossel, agoraMs: number): { texto: string; tipo: TipoDoRotulo } {
  switch (geracaoNaTela(l.estado, l.criado_em, agoraMs)) {
    case "gerando":
      return { texto: "Gerando", tipo: "neutro" };
    case "travou":
      return { texto: "Travou", tipo: "erro" };
    case "falhou":
      return { texto: "Falhou", tipo: "erro" };
    case "pronto":
      return l.revisado_em ? { texto: "Revisado", tipo: "ok" } : { texto: "Pronto para revisar", tipo: "neutro" };
  }
}
```

- [ ] **Passo 5: ver os testes passarem, e os antigos do bônus**

```bash
npx vitest run tests/bonus-achado-43.test.ts tests/bonus-tela.test.ts tests/bonus-textos.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts
```

Esperado: PASS em todos.

- [ ] **Passo 6: provar que o teste do achado 43 mede**

Devolva temporariamente um dos três títulos a `"Criado no Labs, ainda oculto"` e rode
`npx vitest run tests/bonus-achado-43.test.ts`. Esperado: FAIL no motivo correspondente. Desfaça.

- [ ] **Passo 7: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-linha.ts lib/bonus/carrossel-textos.ts lib/bonus/carrossel-tela.ts lib/bonus/textos.ts lib/bonus/tela.ts tests/bonus-tela.test.ts tests/bonus-achado-43.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add lib/bonus/carrossel-linha.ts lib/bonus/carrossel-textos.ts lib/bonus/carrossel-tela.ts lib/bonus/textos.ts lib/bonus/tela.ts tests/bonus-tela.test.ts tests/bonus-achado-43.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts
git commit -m "feat(bonus): as frases e a tela do carrossel, e a tela para de dizer oculto de bônus publicado"
```

---

### FASE 2.7 — O banco e o processo

**Arquivos:**
- Criar: `lib/bonus/carrossel-repositorio.ts`, `lib/bonus/carrossel-processo.ts`
- Testar: `testes-integracao/bonus-carrossel-processo.integracao.ts`

**Interfaces:**
- Consome: `sql()` de `@/lib/db`; `LinhaDoCarrossel` (2.6); `TETO_CARROSSEL_DIARIO` (2.2);
  `ContextoDoCarrossel`, `PedidoParaIA`, `contextoGravado` (2.5); `TextoDoCarrossel`,
  `conferirGerado` (2.5); `gerarTextoDoCarrossel`, `ResultadoDoCarrossel` (2.5);
  `textoDaConferencia` (2.6); `Medicao` de `ia-parametros.ts`; `ehIdDeBonus` de `pedido.ts`;
  `mensagemDeFalhaInesperada` de `erros.ts`.
- Produz, em `carrossel-repositorio.ts` (`server-only`): `TRAVA_DO_TETO_DO_CARROSSEL = 2026093001`;
  `carrosseisNasUltimas24h(): Promise<number>`;
  `criarPedidoDeCarrossel(p: { bonusId: string; total: number; palavra: string; contexto: ContextoDoCarrossel }): Promise<{ ok: true; id: string } | { ok: false }>`;
  `reivindicarCarrossel(id: string): Promise<LinhaDoCarrossel | null>`;
  `gravarCarrosselPronto(id: string, texto: TextoDoCarrossel, medicao: Medicao): Promise<void>`;
  `gravarFalhaDoCarrossel(id: string, erro: string, medicao: Medicao | null): Promise<void>`;
  `lerCarrossel(id: string): Promise<LinhaDoCarrossel | null>`;
  `listarCarrosseisDoBonus(bonusId: string): Promise<LinhaDoCarrossel[]>`;
  `salvarRevisaoDoCarrossel(id: string, texto: TextoDoCarrossel): Promise<boolean>`.
- Produz, em `carrossel-processo.ts` (`server-only`):
  `type GeradorDeCarrossel = (p: PedidoParaIA) => Promise<ResultadoDoCarrossel>`;
  `processarCarrossel(id: string, gerar?: GeradorDeCarrossel): Promise<void>` (nunca lança).

- [ ] **Passo 1: escrever o teste de integração**

Crie `testes-integracao/bonus-carrossel-processo.integracao.ts`:

```ts
// O CARROSSEL CONTRA O BANCO DE VERDADE (o container).
//
// As proteções desta fase são uma trava de transação e `update`s condicionais, e nenhuma delas é
// visível para tsc, lint ou a suíte pura: apagar qualquer uma passa por todos. Só um caminho que
// fale com o Postgres acusa. A IA é sempre um gerador falso: nada sai para a Anthropic.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloProcesso = typeof import("@/lib/bonus/carrossel-processo");

const banco = bancoDescartavel();

const CONTEXTO = {
  tema: "Vendas",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
  oQueResolve: "Reativar clientes que pararam de comprar pelo WhatsApp.",
};
const MEDICAO = { modelo: "claude-opus-5-5", tokensEntrada: 1, tokensSaida: 1, cacheCriado: 0, cacheLido: 0 };
const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda:
    "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};

let repo: ModuloRepo;
let processo: ModuloProcesso;
let bonusId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  processo = await import("@/lib/bonus/carrossel-processo");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  await banco.db().sql().query(`delete from bonus_gerados`);
  const [b] = (await banco
    .db()
    .sql()
    .query(
      `insert into bonus_gerados (tema, o_que_resolve, estado, slug, envio_estado)
       values ('Vendas', 'Reativar clientes que pararam de comprar pelo WhatsApp.', 'pronto', 'reativar-clientes-whatsapp', 'criado')
       returning id`
    )) as { id: string }[];
  bonusId = b.id;
});

const pedido = (total: number) => ({ bonusId, total, palavra: "SUMIDO", contexto: CONTEXTO });

async function criado(total: number): Promise<string> {
  const r = await repo.criarPedidoDeCarrossel(pedido(total));
  if (!r.ok) throw new Error("teto no meio do teste: o beforeEach devia ter limpado a tabela");
  return r.id;
}

const devolve = (texto: TextoDeCarrossel) => async () => ({ ok: true as const, texto, medicao: MEDICAO });

describe("o teto de carrosséis", () => {
  // A trava é segurada por uma transação do próprio teste, com DEZ linhas invisíveis até o
  // commit: quem conta depois de pegar a trava vê 10 e recusa; quem conta antes vê 0 e insere.
  // Assim o caso pega a trava ausente e a trava no lugar errado (o reforço do auditor na 1.7).
  it("o pedido espera a trava do teto: contar e inserir não correm em paralelo", async () => {
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [repo.TRAVA_DO_TETO_DO_CARROSSEL]);
        for (let i = 0; i < 10; i++) {
          await tx.query(
            `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ($1, 5, 'SUMIDO', '{}'::jsonb)`,
            [bonusId]
          );
        }
        travou();
        await segurando;
      });
    await travado;

    const tentativa = repo.criarPedidoDeCarrossel(pedido(5));
    let venceu: unknown;
    try {
      venceu = await Promise.race([
        tentativa.then(() => "pedido"),
        new Promise((f) => setTimeout(() => f("relogio"), 300)),
      ]);
    } finally {
      // SOLTA A TRAVA ANTES DE QUALQUER `expect`. Medido no ensaio do plano, em 30/09: com o
      // caso caindo e a trava presa, a transação ficava aberta, e o `delete` de cada caso
      // seguinte esperava por ela até o limite de 120 s, um depois do outro. A rodada ficou
      // parada mais de 11 minutos, até ser interrompida.
      soltar();
      await transacao;
    }
    expect(venceu).toBe("relogio");
    expect((await tentativa).ok).toBe(false);
  });

  it("com 10 no dia, o décimo primeiro é recusado", async () => {
    for (let i = 0; i < 10; i++) await criado(5);
    expect((await repo.criarPedidoDeCarrossel(pedido(5))).ok).toBe(false);
    expect(await repo.carrosseisNasUltimas24h()).toBe(10);
  });

  it("pedido de mais de 24 h, pelo relógio do banco, não conta", async () => {
    const id = await criado(5);
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set criado_em = now() - interval '25 hours' where id = $1`, [id]);
    expect(await repo.carrosseisNasUltimas24h()).toBe(0);
  });

  it("a trava do carrossel não é a do bônus", async () => {
    const bonus = await import("@/lib/bonus/repositorio");
    expect(repo.TRAVA_DO_TETO_DO_CARROSSEL).not.toBe(bonus.TRAVA_DO_TETO);
  });
});

describe("processarCarrossel", () => {
  it("pronto: o gerador recebe o que a linha guardou, e o texto vai como objeto", async () => {
    const id = await criado(5);
    let recebido: unknown = null;
    await processo.processarCarrossel(id, async (p) => {
      recebido = p;
      return { ok: true as const, texto: TEXTO, medicao: MEDICAO };
    });
    expect(recebido).toEqual({ total: 5, palavra: "SUMIDO", contexto: CONTEXTO });
    const l = await repo.lerCarrossel(id);
    expect([l?.estado, l?.gerado, l?.medicao, l?.erro]).toEqual(["pronto", TEXTO, MEDICAO, null]);
  });

  it("a conferência barra o número errado de slides, com a frase", async () => {
    const id = await criado(6);
    await processo.processarCarrossel(id, devolve(TEXTO));
    const l = await repo.lerCarrossel(id);
    expect(l?.estado).toBe("falhou");
    expect(l?.erro).toContain("Vieram 3 slides de conteúdo, e o pedido era 4");
  });

  it("a conferência barra a chamada que pede outra palavra", async () => {
    const id = await criado(5);
    await processo.processarCarrossel(id, devolve({ ...TEXTO, chamada: "Comente SUMIDO ou GUIA e receba as mensagens." }));
    const l = await repo.lerCarrossel(id);
    expect([l?.estado, l?.erro]).toEqual(["falhou", "A chamada pede também GUIA, além de SUMIDO. Gere de novo."]);
  });

  it("a falha da IA fica escrita na linha", async () => {
    const id = await criado(5);
    await processo.processarCarrossel(id, async () => ({ ok: false as const, erro: "A API recusou.", medicao: null }));
    const l = await repo.lerCarrossel(id);
    expect([l?.estado, l?.erro]).toEqual(["falhou", "A API recusou."]);
  });

  it("dois disparos da mesma linha chamam a IA uma vez só", async () => {
    const id = await criado(5);
    let chamadas = 0;
    const lento = async () => {
      chamadas++;
      await new Promise((f) => setTimeout(f, 200));
      return { ok: true as const, texto: TEXTO, medicao: MEDICAO };
    };
    await Promise.all([processo.processarCarrossel(id, lento), processo.processarCarrossel(id, lento)]);
    expect(chamadas).toBe(1);
  });

  it("uma exceção nossa também vira falha escrita, e não linha girando até travar", async () => {
    const id = await criado(5);
    await processo.processarCarrossel(id, async () => {
      throw new Error("defeito plantado");
    });
    const l = await repo.lerCarrossel(id);
    expect(l?.estado).toBe("falhou");
    expect(l?.erro).toContain("defeito plantado");
  });
});

describe("a revisão e a lista", () => {
  it("só salva carrossel pronto, e grava quando", async () => {
    const pronto = await criado(5);
    await processo.processarCarrossel(pronto, devolve(TEXTO));
    const revisado = { ...TEXTO, gancho: "Seu cliente sumiu? Traga ele de volta." };
    expect(await repo.salvarRevisaoDoCarrossel(pronto, revisado)).toBe(true);
    const l = await repo.lerCarrossel(pronto);
    expect(l?.revisado).toEqual(revisado);
    expect(l?.revisado_em).toBeInstanceOf(Date);

    const falho = await criado(6);
    await processo.processarCarrossel(falho, devolve(TEXTO));
    expect(await repo.salvarRevisaoDoCarrossel(falho, revisado)).toBe(false);
  });

  it("a lista do bônus vem do mais novo para o mais velho, e só dele", async () => {
    const velho = await criado(5);
    const novo = await criado(3);
    const lista = await repo.listarCarrosseisDoBonus(bonusId);
    expect(lista.map((l) => l.id)).toEqual([novo, velho]);
  });

  it("id que não é uuid não chega ao banco", async () => {
    expect(await repo.lerCarrossel("nao-e-uuid")).toBeNull();
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-processo.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, e FAIL por import que não resolve.

- [ ] **Passo 3: escrever o repositório**

Crie `lib/bonus/carrossel-repositorio.ts`:

```ts
import "server-only";
import { sql } from "@/lib/db";
import type { ContextoDoCarrossel } from "./carrossel-ia-parametros";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { TETO_CARROSSEL_DIARIO } from "./carrossel-pedido";
import type { TextoDoCarrossel } from "./carrossel-texto";
import type { Medicao } from "./ia-parametros";
import { ehIdDeBonus } from "./pedido";

// O SQL DO CARROSSEL. Toda escrita é um `update` CONDICIONAL: o `where` é a proteção, e
// testes-integracao/bonus-carrossel-processo.integracao.ts é quem acusa se alguém a tirar.
// Objeto vai CRU para coluna `jsonb`, nunca `JSON.stringify` (a lição da FASE 1.7).

/**
 * A chave da trava do teto do carrossel. Número fixo, PRÓPRIO e diferente da do bônus
 * (`TRAVA_DO_TETO`, repositorio.ts): os dois tetos são independentes. Exportada para o teste
 * segurar a trava e provar que o pedido espera por ela.
 */
export const TRAVA_DO_TETO_DO_CARROSSEL = 2026093001;

export async function carrosseisNasUltimas24h(): Promise<number> {
  const [linha] = (await sql().query(
    `select count(*)::int as n from carrosseis_gerados where criado_em > now() - interval '24 hours'`
  )) as { n: number }[];
  return linha?.n ?? 0;
}

/** CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11. */
export async function criarPedidoDeCarrossel(p: {
  bonusId: string;
  total: number;
  palavra: string;
  contexto: ContextoDoCarrossel;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  return sql().begin(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);
    const [contagem] = (await tx.query(
      `select count(*)::int as n from carrosseis_gerados where criado_em > now() - interval '24 hours'`
    )) as { n: number }[];
    if ((contagem?.n ?? 0) >= TETO_CARROSSEL_DIARIO) return { ok: false as const };
    const [criada] = (await tx.query(
      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
       values ($1, $2, $3, $4::jsonb) returning id`,
      [p.bonusId, p.total, p.palavra, p.contexto]
    )) as { id: string }[];
    return { ok: true as const, id: criada.id };
  });
}

/** Só quem muda a linha de `pendente` para `gerando` chama a IA. */
export async function reivindicarCarrossel(id: string): Promise<LinhaDoCarrossel | null> {
  const linhas = (await sql().query(
    `update carrosseis_gerados set estado = 'gerando' where id = $1 and estado = 'pendente' returning *`,
    [id]
  )) as LinhaDoCarrossel[];
  return linhas[0] ?? null;
}

export async function gravarCarrosselPronto(id: string, texto: TextoDoCarrossel, medicao: Medicao): Promise<void> {
  await sql().query(
    `update carrosseis_gerados
        set estado = 'pronto', gerado = $2::jsonb, medicao = $3::jsonb, erro = null, gerado_em = now()
      where id = $1 and estado = 'gerando'`,
    [id, texto, medicao]
  );
}

export async function gravarFalhaDoCarrossel(id: string, erro: string, medicao: Medicao | null): Promise<void> {
  await sql().query(
    `update carrosseis_gerados
        set estado = 'falhou', erro = $2, medicao = $3::jsonb, gerado_em = now()
      where id = $1 and estado in ('pendente', 'gerando')`,
    [id, erro.slice(0, 1000), medicao]
  );
}

export async function lerCarrossel(id: string): Promise<LinhaDoCarrossel | null> {
  if (!ehIdDeBonus(id)) return null;
  const linhas = (await sql().query(`select * from carrosseis_gerados where id = $1`, [id])) as LinhaDoCarrossel[];
  return linhas[0] ?? null;
}

export async function listarCarrosseisDoBonus(bonusId: string): Promise<LinhaDoCarrossel[]> {
  if (!ehIdDeBonus(bonusId)) return [];
  return (await sql().query(
    `select * from carrosseis_gerados where bonus_id = $1 order by criado_em desc limit 50`,
    [bonusId]
  )) as LinhaDoCarrossel[];
}

/** A revisão só vale para carrossel pronto. Devolve falso quando a linha não estava pronta. */
export async function salvarRevisaoDoCarrossel(id: string, texto: TextoDoCarrossel): Promise<boolean> {
  const linhas = (await sql().query(
    `update carrosseis_gerados set revisado = $2::jsonb, revisado_em = now()
      where id = $1 and estado = 'pronto'
      returning id`,
    [id, texto]
  )) as { id: string }[];
  return linhas.length > 0;
}
```

- [ ] **Passo 4: escrever o processo**

Crie `lib/bonus/carrossel-processo.ts`:

```ts
import "server-only";
import { gerarTextoDoCarrossel, type ResultadoDoCarrossel } from "./carrossel-ia";
import { contextoGravado, type PedidoParaIA } from "./carrossel-ia-parametros";
import { gravarCarrosselPronto, gravarFalhaDoCarrossel, reivindicarCarrossel } from "./carrossel-repositorio";
import { conferirGerado } from "./carrossel-texto";
import { textoDaConferencia } from "./carrossel-textos";
import { mensagemDeFalhaInesperada } from "./erros";

// GERAR O CARROSSEL, DE PONTA A PONTA. As decisões moram nas funções puras; aqui só se costura a
// ordem: reivindicar → gerar → conferir → gravar.

export type GeradorDeCarrossel = (p: PedidoParaIA) => Promise<ResultadoDoCarrossel>;

/** Roda no `after()` da action. Nunca lança: toda saída vira linha gravada. */
export async function processarCarrossel(id: string, gerar: GeradorDeCarrossel = gerarTextoDoCarrossel): Promise<void> {
  try {
    const linha = await reivindicarCarrossel(id);
    if (!linha) return;
    const contexto = contextoGravado(linha.contexto);
    if (!contexto) {
      await gravarFalhaDoCarrossel(id, "O pedido deste carrossel foi gravado sem o contexto do bônus. Gere de novo.", null);
      return;
    }
    const r = await gerar({ total: linha.total_slides, palavra: linha.palavra, contexto });
    if (!r.ok) {
      await gravarFalhaDoCarrossel(id, r.erro, r.medicao);
      return;
    }
    const falha = conferirGerado(linha.total_slides, linha.palavra, r.texto);
    if (falha) await gravarFalhaDoCarrossel(id, textoDaConferencia(falha, linha.palavra), r.medicao);
    else await gravarCarrosselPronto(id, r.texto, r.medicao);
  } catch (e) {
    try {
      await gravarFalhaDoCarrossel(id, mensagemDeFalhaInesperada(e), null);
    } catch {
      // Sem banco não há o que gravar: a linha aparece como "travou" pelo relógio.
    }
  }
}
```

- [ ] **Passo 5: ver o teste passar**

```bash
npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-processo.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, PASS nos 13 casos.

- [ ] **Passo 6: provar que as proteções medem**

Um de cada vez, rodando o arquivo de integração depois de cada troca e desfazendo em seguida:
1. Em `criarPedidoDeCarrossel`, apague a linha do `pg_advisory_xact_lock`. Esperado: FAIL em "o
   pedido espera a trava do teto". Depois, mova a trava para DEPOIS da contagem. Esperado: FAIL no
   mesmo caso, no `ok === false` do fim.
2. Em `reivindicarCarrossel`, tire `and estado = 'pendente'`. Esperado: FAIL em "dois disparos da
   mesma linha chamam a IA uma vez só".
3. Em `salvarRevisaoDoCarrossel`, tire `and estado = 'pronto'`. Esperado: FAIL em "só salva
   carrossel pronto".
4. Em `processarCarrossel`, troque `const falha = conferirGerado(...)` por `const falha = null`.
   Esperado: FAIL nos dois casos da conferência.

- [ ] **Passo 7: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-processo.ts testes-integracao/bonus-carrossel-processo.integracao.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-processo.ts testes-integracao/bonus-carrossel-processo.integracao.ts
git commit -m "feat(bonus): gerar o carrossel contra o banco, com teto travado e a conferência antes de gravar"
```

---

### FASE 2.8 — As actions e as telas

**Arquivos:**
- Criar: `app/bonus/carrossel-actions.ts`, `app/bonus/[id]/no-labs.tsx`,
  `app/bonus/[id]/carrossel/[cid]/page.tsx`, `app/bonus/[id]/carrossel/[cid]/campo.tsx`
- Modificar: `app/bonus/[id]/page.tsx` (o bloco do envio criado e dois imports)
- Testar: `tests/bonus-carrossel-paginas.test.ts`, `testes-dom/bonus-carrossel-campo.dom.tsx`,
  `testes-integracao/bonus-carrossel-acoes.integracao.ts`

**Interfaces:**
- Consome: tudo o que as fases 2.2 a 2.7 produzem; `lerLinha` de `repositorio.ts`;
  `temChaveDaIA` de `config.ts`; `textoDaConfig`, `urlDoBonusComAviso`, `TEXTO_BONUS_NAO_ENCONTRADO`,
  `TEXTO_TRAVOU`, `TomDoQuadro` de `textos.ts`; `Acompanhar` de `app/bonus/[id]/acompanhar.tsx`;
  `CopyField` de `app/setup/copy-field.tsx`.
- Produz: as actions `pedirCarrossel(form: FormData)`, `gerarCarrosselDeNovo(form: FormData)` e
  `salvarRevisaoDoCarrossel(form: FormData)`, todas `Promise<void>`, todas começando por
  `await exigirSessao();`; o componente `Campo({ nome, rotulo, valorInicial, max, linhas })`.

- [ ] **Passo 1: escrever os três testes**

Crie `tests/bonus-carrossel-paginas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_DURATION_S } from "@/lib/bonus/tempos";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");

describe("a página do carrossel", () => {
  it("declara o mesmo maxDuration de lib/bonus/tempos.ts: o Gerar de novo roda no after() dela", () => {
    const m = /export const maxDuration = (\d+);/.exec(ler("app/bonus/[id]/carrossel/[cid]/page.tsx"));
    expect(m?.[1]).toBe(String(MAX_DURATION_S));
  });

  it("acompanha a geração com o componente da Etapa 1, e não com um segundo", () => {
    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain('import Acompanhar from "../../acompanhar";');
  });
});

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

// A SESSÃO É CONFERIDA DENTRO DE CADA ACTION, e não só no proxy.ts: Server Action tem endereço
// próprio. O mesmo leitor de tests/bonus-paginas.test.ts, para o arquivo novo.
describe("toda action do carrossel confere a sessão antes de qualquer coisa", () => {
  it("as três actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler("app/bonus/carrossel-actions.ts"));
    expect(achados.map((a) => a.nome).sort()).toEqual([
      "gerarCarrosselDeNovo",
      "pedirCarrossel",
      "salvarRevisaoDoCarrossel",
    ]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler("app/bonus/carrossel-actions.ts");
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});
```

Crie `testes-dom/bonus-carrossel-campo.dom.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Campo from "@/app/bonus/[id]/carrossel/[cid]/campo";

// O CAMPO DO CARROSSEL: o operador edita e copia para o Canva. O que vai para a área de
// transferência é o que está NO CAMPO agora, e não o que abriu na página.

const escrever = vi.fn(async (_texto: string) => {});

beforeEach(() => {
  escrever.mockReset();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
});

describe("o campo do carrossel", () => {
  it("copia o texto EDITADO, e não o que abriu na página", async () => {
    render(<Campo nome="gancho" rotulo="Gancho (slide 1)" valorInicial="O texto que veio da IA" max={120} linhas={2} />);
    fireEvent.change(screen.getByLabelText("Gancho (slide 1)"), { target: { value: "O texto que a pessoa editou" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    });
    expect(escrever).toHaveBeenCalledWith("O texto que a pessoa editou");
  });

  it("a contagem acompanha o que se digita", () => {
    render(<Campo nome="chamada" rotulo="Chamada (slide 5)" valorInicial="" max={200} linhas={3} />);
    fireEvent.change(screen.getByLabelText("Chamada (slide 5)"), { target: { value: "abcdef" } });
    expect(screen.getByText("6 de 200 caracteres")).toBeTruthy();
  });
});
```

Crie `testes-integracao/bonus-carrossel-acoes.integracao.ts`:

```ts
// AS TRÊS ACTIONS DO CARROSSEL RECUSAM SEM SESSÃO, dentro do contexto de requisição do Next
// (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. O molde é
// bonus-acoes.integracao.ts. O caminho com sessão é medido uma camada abaixo, em
// bonus-carrossel-processo.integracao.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/bonus/carrossel-actions");

const banco = bancoDescartavel();
let acoes: ModuloAcoes;

beforeAll(async () => {
  acoes = await import("@/app/bonus/carrossel-actions");
});

/** A URL do redirect que a action lançou, lida do `digest`. */
async function destinoDe(acao: (f: FormData) => Promise<void>, form: FormData): Promise<string | null> {
  const { valor } = await comoNumaRequisicao("/bonus", async () => {
    try {
      await acao(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return null;
  return valor.split(";").slice(2, -2).join(";");
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("sem sessão, nenhuma action do carrossel age", () => {
  it("pedirCarrossel vai para /entrar e não insere nada, mesmo com pedido válido e chave de IA", async () => {
    const antes = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "chave-inventada-para-o-teste";
    try {
      const destino = await destinoDe(
        acoes.pedirCarrossel,
        formulario({ bonus_id: "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f", total: "10" })
      );
      expect(destino).toBe("/entrar");
    } finally {
      if (antes === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = antes;
    }
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as {
      n: number;
    }[];
    expect(n).toBe(0);
  });

  it.each(["gerarCarrosselDeNovo", "salvarRevisaoDoCarrossel"] as const)("%s vai para /entrar", async (nome) => {
    const destino = await destinoDe(acoes[nome], formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d" }));
    expect(destino).toBe("/entrar");
  });
});
```

- [ ] **Passo 2: ver os três falharem**

```bash
npx vitest run tests/bonus-carrossel-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-carrossel-campo.dom.tsx
npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
```

Esperado: FAIL nos três, porque os arquivos que eles leem ou importam ainda não existem.

- [ ] **Passo 3: escrever as actions**

Crie `app/bonus/carrossel-actions.ts`:

```ts
"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
import { criarPedidoDeCarrossel, lerCarrossel, salvarRevisaoDoCarrossel as gravarRevisao } from "@/lib/bonus/carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { camposDoFormulario, lerRevisaoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import {
  TEXTO_CARROSSEL_NAO_ENCONTRADO,
  TEXTO_CARROSSEL_NAO_REVISAVEL,
  TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO,
  TEXTO_REVISAO_SALVA,
  TEXTO_SO_BONUS_CRIADO,
  quadroDaSituacao,
  textoDaRecusaDoPedidoDeCarrossel,
  textoDoTetoDoCarrossel,
  textoDosProblemasDoCarrossel,
  urlDoCarrosselComAviso,
} from "@/lib/bonus/carrossel-textos";
import { temChaveDaIA } from "@/lib/bonus/config";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { situacaoNoLabs } from "@/lib/bonus/publicado";
import { lerLinha } from "@/lib/bonus/repositorio";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import { TEXTO_BONUS_NAO_ENCONTRADO, textoDaConfig, urlDoBonusComAviso } from "@/lib/bonus/textos";

// AS AÇÕES DO CARROSSEL.
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem
// endereço próprio. tests/bonus-carrossel-paginas.test.ts confere que a primeira instrução de
// cada uma é `await exigirSessao();`.
//
// A PALAVRA E O CONTEXTO SÃO LIDOS DO LABS AQUI, NO SERVIDOR, a cada pedido, e nunca aceitos do
// formulário: a página aberta pode estar velha.

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

/** O bônus pronto para carrossel: criado no Labs e publicado lá. Qualquer outra coisa é recusa. */
async function bonusParaCarrossel(
  bonusId: string
): Promise<{ ok: true; palavra: string; contexto: ContextoDoCarrossel } | { ok: false; texto: string }> {
  const linha = await lerLinha(bonusId);
  if (!linha) return { ok: false, texto: TEXTO_BONUS_NAO_ENCONTRADO };
  if (linha.envio_estado !== "criado" || !linha.slug) return { ok: false, texto: TEXTO_SO_BONUS_CRIADO };
  const situacao = await situacaoNoLabs(process.env.LABS_URL, linha.slug);
  if (situacao.tipo !== "publicado") return { ok: false, texto: quadroDaSituacao(situacao).texto };
  return {
    ok: true,
    palavra: situacao.bonus.palavra,
    contexto: {
      tema: situacao.bonus.tema,
      titulo: situacao.bonus.titulo,
      descricao: situacao.bonus.descricao,
      oQueResolve: linha.o_que_resolve,
    },
  };
}

export async function pedirCarrossel(form: FormData): Promise<void> {
  await exigirSessao();
  const bonusId = form.get("bonus_id");
  if (!ehIdDeBonus(bonusId)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_BONUS_NAO_ENCONTRADO }));
  const lido = lerPedidoDeCarrossel({ bonusId, total: form.get("total") });
  if (!lido.ok) {
    redirect(urlDoBonusComAviso(bonusId, { tom: "erro", texto: textoDaRecusaDoPedidoDeCarrossel(lido.motivo) }));
  }
  if (!temChaveDaIA(process.env)) {
    redirect(urlDoBonusComAviso(bonusId, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
  }
  const bonus = await bonusParaCarrossel(bonusId);
  if (!bonus.ok) redirect(urlDoBonusComAviso(bonusId, { tom: "erro", texto: bonus.texto }));
  const criado = await criarPedidoDeCarrossel({
    bonusId,
    total: lido.pedido.total,
    palavra: bonus.palavra,
    contexto: bonus.contexto,
  });
  if (!criado.ok) redirect(urlDoBonusComAviso(bonusId, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
  const id = criado.id;
  after(() => processarCarrossel(id));
  redirect(`/bonus/${bonusId}/carrossel/${id}`);
}

export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const linha = await lerCarrossel(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const naTela = geracaoNaTela(linha.estado, linha.criado_em, Date.now());
  if (naTela !== "falhou" && naTela !== "travou") {
    redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO }));
  }
  if (!temChaveDaIA(process.env)) {
    redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
  }
  const bonus = await bonusParaCarrossel(linha.bonus_id);
  if (!bonus.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: bonus.texto }));
  const criado = await criarPedidoDeCarrossel({
    bonusId: linha.bonus_id,
    total: linha.total_slides,
    palavra: bonus.palavra,
    contexto: bonus.contexto,
  });
  if (!criado.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
  const novo = criado.id;
  after(() => processarCarrossel(novo));
  redirect(`/bonus/${linha.bonus_id}/carrossel/${novo}`);
}

export async function salvarRevisaoDoCarrossel(form: FormData): Promise<void> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const linha = await lerCarrossel(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const atual = textoDaLinhaDoCarrossel(linha);
  if (linha.estado !== "pronto" || !atual) {
    redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_REVISAVEL }));
  }
  const bruto: Record<string, unknown> = Object.fromEntries(
    camposDoFormulario(linha.total_slides).map((c) => [c.nome, form.get(c.nome)])
  );
  const lido = lerRevisaoDoCarrossel(linha.total_slides, linha.palavra, atual.titulo, bruto);
  if (!lido.ok) {
    redirect(
      urlDoCarrosselComAviso(linha.bonus_id, id, {
        tom: "erro",
        texto: `Corrija antes de salvar. ${textoDosProblemasDoCarrossel(linha.total_slides, lido.problemas)}`,
      })
    );
  }
  const salvou = await gravarRevisao(id, lido.texto);
  redirect(
    urlDoCarrosselComAviso(
      linha.bonus_id,
      id,
      salvou ? { tom: "ok", texto: TEXTO_REVISAO_SALVA } : { tom: "erro", texto: TEXTO_CARROSSEL_NAO_REVISAVEL }
    )
  );
}
```

- [ ] **Passo 4: escrever o campo com copiar**

A spec citava o `CopyField` (`app/setup/copy-field.tsx`), mas ele copia o valor fixo que recebeu
por propriedade, e aqui o operador edita antes de copiar: com ele, o botão levaria o texto da IA,
e não o editado. Daí um campo próprio, com o mesmo texto de botão ("Copiar", "Copiado ✓"). A spec
é corrigida no mesmo commit do plano.

Crie `app/bonus/[id]/carrossel/[cid]/campo.tsx`:

```tsx
"use client";
import { useRef, useState } from "react";
import { btnSecondary, hint, input, label } from "@/app/ui";

// UM CAMPO DO CARROSSEL: edita, conta e copia. O botão copia o que está NO CAMPO agora, e não o
// que abriu na página: é esse texto que o operador leva para o Canva até a Etapa 3 existir.
export default function Campo({
  nome,
  rotulo,
  valorInicial,
  max,
  linhas,
}: {
  nome: string;
  rotulo: string;
  valorInicial: string;
  max: number;
  linhas: number;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [tamanho, setTamanho] = useState(valorInicial.length);
  const [copiado, setCopiado] = useState(false);

  return (
    <div>
      <label htmlFor={nome} className={label}>
        {rotulo}
      </label>
      <textarea
        ref={campo}
        id={nome}
        name={nome}
        defaultValue={valorInicial}
        maxLength={max}
        rows={linhas}
        onChange={(e) => setTamanho(e.target.value.length)}
        className={input}
      />
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={hint}>
          {tamanho} de {max} caracteres
        </p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(campo.current?.value ?? "");
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
          className={btnSecondary}
        >
          {copiado ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Passo 5: escrever o bloco do bônus criado**

Crie `app/bonus/[id]/no-labs.tsx`:

```tsx
import Link from "next/link";
import CopyField from "@/app/setup/copy-field";
import {
  alertError,
  alertOk,
  alertWarn,
  badgeErr,
  badgeNeutral,
  badgeOk,
  badgeWarn,
  btnPrimary,
  card,
  hint,
  input,
  label,
  muted,
  rowDivide,
  rowHover,
} from "@/app/ui";
import { pedirCarrossel } from "@/app/bonus/carrossel-actions";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import {
  SLIDES_MAX,
  SLIDES_MIN,
  SLIDES_PADRAO,
  TETO_CARROSSEL_DIARIO,
  restamCarrosseisHoje,
} from "@/lib/bonus/carrossel-pedido";
import { carrosseisNasUltimas24h, listarCarrosseisDoBonus } from "@/lib/bonus/carrossel-repositorio";
import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { TEXTO_TABELA_CARROSSEL_AUSENTE, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import type { LinhaDoBonus } from "@/lib/bonus/linha";
import { situacaoNoLabs, type SituacaoNoLabs } from "@/lib/bonus/publicado";
import type { TipoDoRotulo } from "@/lib/bonus/tela";
import type { TomDoQuadro } from "@/lib/bonus/textos";
import { fmtDate } from "@/lib/format";

// O BÔNUS DEPOIS DE CRIADO NO LABS: a situação lida de lá, o link e os carrosséis.
//
// A SITUAÇÃO É LIDA A CADA VEZ (lib/bonus/publicado.ts), e nunca afirmada de memória: o bônus
// nasce oculto, e o operador o publica no /admin do Labs (achado 43 do auditor). Só "publicado"
// libera o pedido de carrossel; a action confere de novo no servidor.

const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };
const SELO: Record<TipoDoRotulo, string> = { neutro: badgeNeutral, ok: badgeOk, atencao: badgeWarn, erro: badgeErr };

export default async function NoLabs({
  linha,
  publico,
  agora,
}: {
  linha: LinhaDoBonus;
  publico: string | null;
  agora: number;
}) {
  const situacao: SituacaoNoLabs = linha.slug
    ? await situacaoNoLabs(process.env.LABS_URL, linha.slug)
    : { tipo: "nao_publicado" };
  const quadro = quadroDaSituacao(situacao);
  const publicado = situacao.tipo === "publicado";

  let carrosseis: LinhaDoCarrossel[];
  let usadas: number;
  try {
    [carrosseis, usadas] = await Promise.all([listarCarrosseisDoBonus(linha.id), carrosseisNasUltimas24h()]);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  const restam = restamCarrosseisHoje(usadas);

  return (
    <>
      <div className={QUADRO[quadro.tom]}>{quadro.texto}</div>

      {publico ? (
        <section className={`${card} p-6`}>
          <CopyField
            label={publicado ? "O link do bônus" : "O link, que só funciona depois de publicado"}
            value={publico}
          />
        </section>
      ) : (
        <p className={`text-sm ${muted}`}>Endereço no Labs: /bonus/{linha.slug}</p>
      )}

      <section className={card}>
        <h2 className="border-b border-traco px-4 py-3 text-sm font-semibold dark:border-traco-escuro">
          Carrosséis deste bônus
        </h2>
        {carrosseis.length === 0 ? (
          <p className={`px-4 py-3 text-sm ${muted}`}>Nenhum carrossel ainda.</p>
        ) : (
          <ul className={rowDivide}>
            {carrosseis.map((c) => {
              const rotulo = rotuloDoCarrossel(c, agora);
              return (
                <li key={c.id}>
                  <Link
                    href={`/bonus/${linha.id}/carrossel/${c.id}`}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {textoDaLinhaDoCarrossel(c)?.titulo ?? descricaoDoCarrossel(c)}
                      </span>
                      <span className={`block text-xs ${muted}`}>
                        {descricaoDoCarrossel(c)} · {fmtDate(c.criado_em)}
                      </span>
                    </span>
                    <span className={SELO[rotulo.tipo]}>{rotulo.texto}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <form action={pedirCarrossel} className="space-y-3 border-t border-traco p-4 dark:border-traco-escuro">
          <input type="hidden" name="bonus_id" value={linha.id} />
          <div>
            <label htmlFor="total" className={label}>
              Quantos slides?
            </label>
            <select id="total" name="total" defaultValue={String(SLIDES_PADRAO)} className={input}>
              {Array.from({ length: SLIDES_MAX - SLIDES_MIN + 1 }, (_, i) => SLIDES_MIN + i).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 (post de imagem única)" : `${n} slides`}
                </option>
              ))}
            </select>
          </div>
          <p className={hint}>
            Restam {restam} de {TETO_CARROSSEL_DIARIO} gerações de carrossel nas últimas 24 horas.
          </p>
          <button type="submit" className={btnPrimary} disabled={!publicado || restam === 0}>
            Gerar carrossel
          </button>
        </form>
      </section>
    </>
  );
}
```

- [ ] **Passo 6: ligar o bloco na página do bônus**

Em `app/bonus/[id]/page.tsx`, troque o bloco

```tsx
      {envio === "criado" &&
        (publico ? (
          <section className={`${card} p-6`}>
            <CopyField label="O link que vai existir depois de publicar" value={publico} />
          </section>
        ) : (
          <p className={`text-sm ${muted}`}>Endereço no Labs: /bonus/{linha.slug}</p>
        ))}
```

por

```tsx
      {envio === "criado" && <NoLabs linha={linha} publico={publico} agora={agora} />}
```

No mesmo arquivo: apague `import CopyField from "@/app/setup/copy-field";`, tire `muted,` da
lista de imports de `@/app/ui`, e acrescente `import NoLabs from "./no-labs";` depois de
`import Acompanhar from "./acompanhar";`. Confira com `npm run lint` que nenhum import ficou sem
uso.

- [ ] **Passo 7: escrever a página do carrossel**

Crie `app/bonus/[id]/carrossel/[cid]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
import { gerarCarrosselDeNovo, salvarRevisaoDoCarrossel } from "@/app/bonus/carrossel-actions";
import { avisoDaUrl } from "@/lib/avisos";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { camposDoFormulario, valoresPorCampo } from "@/lib/bonus/carrossel-texto";
import {
  TEXTO_CARROSSEL_SEM_TEXTO,
  TEXTO_TABELA_CARROSSEL_AUSENTE,
  avisoDePalavraTrocada,
  quadroDaSituacao,
} from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { situacaoNoLabs, type SituacaoNoLabs } from "@/lib/bonus/publicado";
import { lerLinha } from "@/lib/bonus/repositorio";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
import Acompanhar from "../../acompanhar";
import Campo from "./campo";

// O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
// tests/bonus-carrossel-paginas.test.ts confere que é o mesmo número. O "Gerar de novo" desta
// página corre sob este teto.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };

export default async function PaginaDoCarrossel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; cid: string }>;
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const { id, cid } = await params;
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);

  let carrossel: LinhaDoCarrossel | null;
  try {
    carrossel = await lerCarrossel(cid);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  if (!carrossel || carrossel.bonus_id !== id) notFound();

  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const geracao = geracaoNaTela(carrossel.estado, carrossel.criado_em, agora);
  const texto = textoDaLinhaDoCarrossel(carrossel);

  // A SITUAÇÃO NO LABS É LIDA A CADA VEZ, menos durante a geração. A palavra do carrossel é a
  // que o Labs tinha na hora de GERAR; salvar confere contra ela e não relê o Labs (achado 51,
  // decisão do Eduardo). Depois de gerar, o bônus pode ser despublicado ou trocar de palavra no
  // /admin do Labs, e é esta leitura, feita também logo depois de salvar, que avisa. Durante a
  // geração a tela pergunta ao servidor a cada 2 s, e cada pergunta leria a lista inteira do
  // Labs de novo, sem nada a mostrar ainda.
  const situacao = geracao === "gerando" ? null : await situacaoDoBonus(carrossel.bonus_id);
  const quadro = situacao ? quadroDaSituacao(situacao) : null;
  const trocada =
    situacao?.tipo === "publicado" && situacao.bonus.palavra !== carrossel.palavra ? situacao.bonus.palavra : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/bonus/${id}`} className={link}>
          Voltar para o bônus
        </Link>
        <h1 className={`mt-2 ${pageTitle}`}>{texto?.titulo ?? descricaoDoCarrossel(carrossel)}</h1>
        <p className={pageSubtitle}>
          {descricaoDoCarrossel(carrossel)} · palavra {carrossel.palavra}
        </p>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}
      {quadro && <div className={QUADRO[quadro.tom]}>{quadro.texto}</div>}
      {trocada && <div className={alertWarn}>{avisoDePalavraTrocada(trocada, carrossel.palavra)}</div>}

      {geracao === "gerando" && (
        <section className={`${card} space-y-3 p-6`}>
          <div className={`h-4 w-2/3 ${skeleton}`} />
          <div className={`h-4 w-1/2 ${skeleton}`} />
          <div className={`h-24 ${skeleton}`} />
          <Acompanhar criadoEmMs={carrossel.criado_em.getTime()} />
        </section>
      )}

      {(geracao === "falhou" || geracao === "travou") && (
        <section className={`${card} space-y-4 p-6`}>
          <div className={alertError}>
            {geracao === "travou" ? TEXTO_TRAVOU : (carrossel.erro ?? "A geração falhou sem dizer o motivo.")}
          </div>
          <form action={gerarCarrosselDeNovo}>
            <input type="hidden" name="id" value={carrossel.id} />
            <button type="submit" className={btnPrimary}>
              Gerar de novo
            </button>
          </form>
          <p className={hint}>Conta como uma das gerações de carrossel do dia.</p>
        </section>
      )}

      {geracao === "pronto" && <Revisao carrossel={carrossel} />}
    </div>
  );
}

async function situacaoDoBonus(bonusId: string): Promise<SituacaoNoLabs> {
  const bonus = await lerLinha(bonusId);
  return bonus?.slug ? situacaoNoLabs(process.env.LABS_URL, bonus.slug) : { tipo: "nao_publicado" };
}

function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
  const texto = textoDaLinhaDoCarrossel(carrossel);
  if (!texto) return <div className={alertError}>{TEXTO_CARROSSEL_SEM_TEXTO}</div>;
  const valores = valoresPorCampo(texto);

  return (
    <>
      <form action={salvarRevisaoDoCarrossel} className={`${card} space-y-4 p-6`}>
        <input type="hidden" name="id" value={carrossel.id} />
        <p className={hint}>
          A chamada pede a palavra <strong>{carrossel.palavra}</strong>. Ela vem do bônus e não se edita aqui.
        </p>
        {camposDoFormulario(carrossel.total_slides).map((c) => (
          <Campo
            key={c.nome}
            nome={c.nome}
            rotulo={c.rotulo}
            valorInicial={valores[c.nome] ?? ""}
            max={c.max}
            linhas={c.linhas}
          />
        ))}
        <button type="submit" className={btnPrimary}>
          Salvar revisão
        </button>
      </form>
    </>
  );
}
```

- [ ] **Passo 8: ver os três testes passarem, e o lint e o typecheck**

```bash
npx vitest run tests/bonus-carrossel-paginas.test.ts tests/bonus-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-carrossel-campo.dom.tsx
npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
npm run lint
npm run typecheck
npm test
```

Esperado: PASS nos três arquivos de teste, lint e typecheck limpos, e o `npm test` inteiro verde:
`tests/escala.test.ts` e `tests/paleta.test.ts` varrem todo `app/`, inclusive as três telas novas.

- [ ] **Passo 9: provar que os testes medem**

Um de cada vez, desfazendo em seguida:
1. Em `app/bonus/carrossel-actions.ts`, apague a linha `await exigirSessao();` de
   `salvarRevisaoDoCarrossel`. Rode `npx vitest run tests/bonus-carrossel-paginas.test.ts`: FAIL
   nomeando `salvarRevisaoDoCarrossel`.
2. Em `campo.tsx`, troque `campo.current?.value ?? ""` por `valorInicial`. Rode o teste de tela:
   FAIL em "copia o texto EDITADO".

- [ ] **Passo 10: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/bonus/carrossel-actions.ts "app/bonus/[id]/no-labs.tsx" "app/bonus/[id]/page.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/campo.tsx" tests/bonus-carrossel-paginas.test.ts testes-dom/bonus-carrossel-campo.dom.tsx testes-integracao/bonus-carrossel-acoes.integracao.ts
test "$(git branch --show-current)" = "gerador-de-carrossel"
git add app/bonus/carrossel-actions.ts "app/bonus/[id]/no-labs.tsx" "app/bonus/[id]/page.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/campo.tsx" tests/bonus-carrossel-paginas.test.ts testes-dom/bonus-carrossel-campo.dom.tsx testes-integracao/bonus-carrossel-acoes.integracao.ts
git commit -m "feat(bonus): as telas e as actions do carrossel, com a situação do bônus lida do Labs"
```

---

### FASE 2.9 — A verificação completa

**Arquivos:** nenhum código novo. Pode modificar a linha "Estado" da spec.

- [ ] **Passo 1: o `verify` do dono**

```bash
npm run verify
```

Esperado: lint, typecheck, `npm test`, `test:dom`, varredura e build limpos. O build roda
`migrar.mjs --aplicar`, que **pula** nesta máquina ("MIGRAÇÃO PULADA"). Se imprimir "MODO:
APLICANDO", pare: `VERCEL_ENV` está no shell.

- [ ] **Passo 2: a contagem subiu**

Esperado: 80 arquivos puros (os 70 da base mais `bonus-carrossel-pedido`, `bonus-publicado`,
`bonus-carrossel-instrucao`, `bonus-carrossel-schema`, `bonus-carrossel-texto`,
`bonus-carrossel-ia-parametros`, `bonus-achado-43`, `bonus-carrossel-textos`,
`bonus-carrossel-tela` e `bonus-carrossel-paginas`), e 11 de tela. No ensaio do plano, em 30/09
(o código deste plano extraído numa worktree à parte), deram 2 207 casos puros e 71 de tela. Se
a execução mudou algum teste, o número muda junto: confira que a diferença é a que se esperava.

- [ ] **Passo 3: a suíte de integração inteira, no container**

```bash
npm run banco:teste
npm run test:integracao
npm run banco:teste:parar
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 36 arquivos (os 33 da base mais os três do
carrossel); `fundacao` e `esquema-base` pulados, como sempre contra o container.

- [ ] **Passo 4: revisão de segurança e varredura de segredo**

Invoque a skill `security-review` sobre o diff da branch (`git diff main...gerador-de-carrossel`)
e a skill `scan-secrets` sobre uma cópia só dos arquivos que a branch toca (nunca a árvore
inteira, para o `.env.local` ficar de fora). Corrija o que for achado real, com teste antes.

- [ ] **Passo 5: a varredura de texto sobre tudo o que a branch tocou**

```bash
git diff --name-only main...gerador-de-carrossel | tr '\n' '\0' | xargs -0 node "$SCRATCH/varrer-texto.mjs"
```

Esperado: saída 0, "limpo" em todos.

- [ ] **Passo 6: atualizar o estado da spec e commitar**

Em `docs/specs/2026-09-30-gerador-de-carrossel.md`, troque a linha `**Estado:**` para dizer que
a Etapa 2 está construída e verificada, e que falta a prova real (FASE 2.10). Varra, confira a
branch e commite só esse arquivo:

```bash
git add docs/specs/2026-09-30-gerador-de-carrossel.md
git commit -m "docs: a Etapa 2 do gerador está construída e verificada, falta a prova real"
```

Avise o auditor com o hash e os totais de teste.

---

### FASE 2.10 — A prova real (cada escrita só com o OK do Eduardo)

**Arquivos:** nenhum do repositório, até o passo 7.

- [ ] **Passo 1: o ensaio a seco da migração, e PARE**

```bash
node scripts/migrar.mjs --a-mao
```

Isto **conecta na produção do Chat**, só para ler. Se aparecer **qualquer** migração além da
`014`, **pare** e mostre a saída ao Eduardo. Se for só a `014`, mostre a saída mesmo assim e
**espere o OK dele**.

- [ ] **Passo 2: com o OK, aplicar**

```bash
node scripts/migrar.mjs --aplicar --a-mao
```

Isto **grava na produção do Chat**: cria `carrosseis_gerados`. Esperado:
`014-carrosseis-gerados.sql — aplicada e registrada`, código 0. Rode o ensaio a seco de novo:
`014 … já aplicada`.

- [ ] **Passo 3: subir o Chat local só para ler o Labs**

Com o OK do Eduardo, e **sem** o `BONUS_INTAKE_SECRET`. Confira só pelos nomes, sem imprimir
valor: `grep -c "^BONUS_INTAKE_SECRET=" .env.local` tem de dar `0`, `grep -c "^LABS_URL=" .env.local`
tem de dar `0`, e `grep -c "^ANTHROPIC_API_KEY=" .env.local` tem de dar `1` (dava `1` em 30/09).
Então suba:

```bash
LABS_URL=https://metodolabs.metodotia.com npx next dev -p 3001
```

em segundo plano. O Chat local fala com o **banco de produção** e lê a lista pública do Labs, mas
não consegue escrever no Labs (`configDoEnvio` recusa sem segredo). Não edite nenhum arquivo
enquanto ele estiver de pé: uma recarga por edição deu `57014` em 29/09.

- [ ] **Passo 4: gerar, com o OK**

O Eduardo entra em `http://localhost:3001/bonus`, abre o bônus `reativar-clientes-whatsapp`
(publicado, palavra `SUMIDO`) e confere que a linha de situação diz "Publicado no Labs · palavra
SUMIDO". Com o OK dele, gera quatro carrosséis: de **10**, de **3**, de **2** e de **1** slide.
Custa perto de US$ 0,24 e 4 das 10 gerações do dia. Confira na tela: o número de slides, a palavra
na chamada e na legenda, e a qualidade dos tamanhos pequenos, que o Labs nunca testou. Um que
falhar pela conferência (o número de slides nos totais pequenos é o mais provável) é informação,
e não defeito: anote a frase.

- [ ] **Passo 5: medir, só lendo**

Leia na produção do Chat, por um script só de leitura no scratchpad (molde:
`medir-prova.mjs` da FASE 1.11), o estado, o erro, a `medicao` e o tempo
(`gerado_em - criado_em`) de cada linha de `carrosseis_gerados`, sem imprimir o texto.

- [ ] **Passo 6: salvar uma revisão**

O Eduardo edita um campo de um carrossel pronto, tenta tirar a palavra da chamada (esperado: a
recusa com o motivo) e depois salva uma edição válida (esperado: "Revisão salva."). Desligue o
Chat local assim que terminar, conferindo que a porta 3001 ficou livre.

- [ ] **Passo 7: registrar**

Escreva na spec, numa seção "O que a prova mediu", o que foi medido (tempos, tokens, quais totais
passaram na conferência, as frases das falhas). Varra, confira a branch, commite só a spec e avise
o auditor.

---

### FASE 2.11 — O PR (só quando o Eduardo mandar)

- [ ] **Passo 1:** invoque `superpowers:finishing-a-development-branch` e siga a opção que o
  Eduardo escolher.
- [ ] **Passo 2:** se for PR, `git push -u origin gerador-de-carrossel:gerador-de-carrossel`. O push
  gera um deploy de preview, protegido por SSO, que conversa com o banco de produção e não aplica
  migração.
- [ ] **Passo 3:** `gh pr create --base main --head gerador-de-carrossel`, com o corpo escrito para o
  Vinícius: o porquê (o carrossel nasce de um bônus publicado, e a palavra da chamada vem do Labs),
  a `014` já aplicada, os toques em arquivo da Etapa 1 (as frases do achado 43, o bloco da página do
  bônus, o `export` do `lerAteOTeto`), o pedido ao Labs de pôr a lista pública no contrato, e as
  pré-condições do merge da spec. Sem rodapé de IA. Mostre o texto ao Eduardo antes de criar.
- [ ] **Passo 4:** depois do merge, lembrar o Eduardo de recarregar a página por completo antes de
  usar (Skew Protection, achado 42).
