# Categoria do contato — plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`).

**Objetivo:** cada contato ganha uma categoria, a lista filtra por ela, e cada
categoria mostra quantos dos seus contatos estão de fato alcançáveis agora.

**Arquitetura:** uma coluna em `contacts`, sem tabela nem tela de administração.
As decisões (normalizar o nome, montar as fichas com a contagem) são funções
puras em `lib/categorias.ts`, com teste. O alcance vem de `windowState`
(`lib/inbox-window.ts`) — a mesma função que o motor de envio usa para recusar.

**Ferramentas:** Next.js 16.2.10 (App Router, Server Components e Server
Actions), Postgres via `postgres.js`, Tailwind, Vitest.

**Especificação:** `docs/specs/2026-08-31-categoria-do-contato.md`

## Restrições globais

- **A suíte NÃO testa componente.** Toda decisão sai do JSX e vira função pura
  com caso em `tests/`.
- **A janela de 24h tem UMA fonte: `windowState`.** Nenhum SQL de 24 horas
  cravado, nenhum `h < 24` — em lugar nenhum desta funcionalidade. Ela fecha
  5 minutos antes do limite real (`WINDOW_MARGIN_MS`), e o motor de envio
  (`lib/queue-drain.ts`) usa exatamente essa.
- **Migração é imutável depois de aplicada.** `schema_migrations` recusa arquivo
  editado; mudança é arquivo NOVO.
- **`lib/steps.ts` não tem NENHUM import.** Nada aqui mexe nele.
- **Em produção, não mexer em automação existente.**
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
- Comentários em português. Commits em português **sem acentos**, sem trailer.

## Estrutura de arquivos

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `migrations/007-categoria-do-contato.sql` | a coluna | 1 |
| `lib/categorias.ts` (novo) | normalizar o nome, montar as fichas | 1 e 3 |
| `tests/categorias.test.ts` (novo) | os casos das duas | 1 e 3 |
| `scripts/migrar.mjs` | declarar a coluna em `ESPERADAS` | 1 |
| `lib/esquema.ts` | declarar a coluna na marca d'água | 1 |
| `app/conversas/[id]/actions.ts` | a ação que grava | 2 |
| `app/conversas/[id]/page.tsx` | o campo, no cabeçalho | 2 |
| `app/contatos/page.tsx` | a coluna, as fichas, o filtro, e a janela certa | 3 |

---

### Tarefa 1: A coluna existe e o nome tem regra

**Arquivos:**
- Criar: `migrations/007-categoria-do-contato.sql`
- Criar: `lib/categorias.ts`
- Criar: `tests/categorias.test.ts`
- Modificar: `scripts/migrar.mjs` (a lista `ESPERADAS`)
- Modificar: `lib/esquema.ts` (a lista `colunas` de `MARCA_DAGUA`)

**Interfaces:**
- Produz: `LIMITE_DA_CATEGORIA: number` e
  `normalizarCategoria(bruto: unknown): string | null`.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `tests/categorias.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LIMITE_DA_CATEGORIA, normalizarCategoria } from "@/lib/categorias";

// ============================================================
// A NORMALIZAÇÃO É O QUE SUBSTITUI A GOVERNANÇA.
//
// Este produto NÃO tem tela para criar e renomear categorias, por decisão de
// desenho: a lista é o conjunto de valores em uso. Isso só se sustenta se
// `Aluno`, `aluno ` e `ALUNO` forem a MESMA categoria — sem isso a lista
// apodrece em três semanas e ninguém confia mais no filtro.
// ============================================================
describe("normalizarCategoria", () => {
  it("maiúscula e espaço nas pontas não criam categoria nova", () => {
    expect(normalizarCategoria("Aluno")).toBe("aluno");
    expect(normalizarCategoria("  aluno  ")).toBe("aluno");
    expect(normalizarCategoria("ALUNO")).toBe("aluno");
  });

  it("espaço repetido no meio vira um só", () => {
    expect(normalizarCategoria("turma   de    setembro")).toBe("turma de setembro");
    expect(normalizarCategoria("ex\tAluno")).toBe("ex aluno");
  });

  // Devolver "" faria a coluna guardar texto vazio, e a ficha "sem categoria"
  // passaria a ter DUAS formas — o balde do null e o balde do vazio.
  it("vazio e só-espaço viram null, e não texto vazio", () => {
    expect(normalizarCategoria("")).toBe(null);
    expect(normalizarCategoria("   ")).toBe(null);
    expect(normalizarCategoria("\n\t ")).toBe(null);
  });

  it("o que não é texto vira null em vez de estourar", () => {
    expect(normalizarCategoria(null)).toBe(null);
    expect(normalizarCategoria(undefined)).toBe(null);
    expect(normalizarCategoria(42)).toBe(null);
    expect(normalizarCategoria({})).toBe(null);
    expect(normalizarCategoria([])).toBe(null);
  });

  // O limite existe para a coluna da tabela não virar um parágrafo. Cortar é
  // melhor que recusar: quem colou um texto longo por engano vê o que ficou.
  it("corta no limite, e o corte não deixa espaço na ponta", () => {
    const longo = "a".repeat(LIMITE_DA_CATEGORIA + 20);
    expect(normalizarCategoria(longo)).toHaveLength(LIMITE_DA_CATEGORIA);
    const comEspaco = "b".repeat(LIMITE_DA_CATEGORIA - 1) + "   fim";
    expect(normalizarCategoria(comEspaco)).toBe("b".repeat(LIMITE_DA_CATEGORIA - 1));
  });

  it("acento é preservado: é nome de gente, não identificador", () => {
    expect(normalizarCategoria("Não respondeu")).toBe("não respondeu");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npx vitest run tests/categorias.test.ts`
Esperado: FALHA na importação — `lib/categorias.ts` não existe.

- [ ] **Passo 3: Escrever o módulo**

Criar `lib/categorias.ts`:

```ts
// A CATEGORIA DO CONTATO, e as decisões dela fora do JSX.
//
// Este produto não tem tela para criar e renomear categorias, por decisão de
// desenho: a lista de categorias É o conjunto de valores distintos em uso —
// nasce quando alguém usa e some quando ninguém usa mais.
//
// ISSO SÓ SE SUSTENTA COM NORMALIZAÇÃO. Sem ela, `Aluno` e `aluno ` viram duas
// categorias, o filtro passa a mentir, e em três semanas ninguém confia mais na
// lista — que é exatamente o custo que a governança evitaria, pago de outro
// jeito. A função abaixo é o que compra a simplicidade da coluna única.

/** O tamanho máximo, para a coluna da tabela não virar um parágrafo. */
export const LIMITE_DA_CATEGORIA = 40;

/**
 * O nome canônico de uma categoria, ou `null` quando não há categoria.
 *
 * `null` e nunca `""`: texto vazio na coluna faria a ficha "sem categoria" ter
 * DUAS formas — o balde do nulo e o balde do vazio —, e as contagens da tela
 * deixariam de somar o total.
 *
 * O ACENTO FICA. Isto é nome que gente lê ("não respondeu"), e não
 * identificador — tirar acento tornaria a categoria mais feia sem tornar nada
 * mais seguro.
 */
export function normalizarCategoria(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const limpo = bruto.replace(/\s+/g, " ").trim().toLowerCase();
  if (!limpo) return null;
  // Aparar DEPOIS de cortar: o corte pode cair no meio de um espaço e deixar a
  // ponta suja.
  const cortado = limpo.slice(0, LIMITE_DA_CATEGORIA).trim();
  return cortado || null;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npx vitest run tests/categorias.test.ts`
Esperado: PASSA, com 6 casos.

- [ ] **Passo 5: Escrever a migração**

Criar `migrations/007-categoria-do-contato.sql`:

```sql
-- A CATEGORIA DO CONTATO — uma coluna, e mais nada.
--
-- Sem tabela de categorias, sem tela de administração, sem ciclo de vida
-- próprio: a lista de categorias É o conjunto de valores distintos em uso.
-- Quem impede `Aluno` e `aluno ` de virarem duas é `normalizarCategoria`
-- (lib/categorias.ts), com teste — a normalização é o que paga a simplicidade
-- desta coluna.
--
-- `null` significa "sem categoria", e é o estado de todos os 126 contatos que
-- existem no dia em que esta migração roda.

alter table contacts add column if not exists categoria text;
```

- [ ] **Passo 6: Declarar a coluna nas duas conferências**

Em `scripts/migrar.mjs`, acrescentar ao fim da lista `ESPERADAS` (ela termina
com a entrada de `entrega_sem_portao`):

```js
  {
    tabela: "contacts",
    coluna: "categoria",
    de: "007-categoria-do-contato.sql",
    tipo: "text",
    padrao: null,
    naoNulo: false,
  },
```

Em `lib/esquema.ts`, acrescentar ao fim da lista `colunas` de `MARCA_DAGUA` (ela
termina com a entrada de `entrega_sem_portao`):

```ts
    { tabela: "contacts", coluna: "categoria", de: "007-categoria-do-contato.sql" },
```

**Ela entra em `colunas` e NÃO em `naoObservaveis`:** esta migração CRIA coluna,
então a conferência de presença a enxerga. A `006` foi para `naoObservaveis`
porque removia — o oposto.

- [ ] **Passo 7: Conferir com o ensaio a seco, que não grava nada**

Rodar: `node scripts/migrar.mjs`
Esperado: a linha `►    007-categoria-do-contato.sql` na lista do que rodaria, e
`CONFERIDO no banco: contacts.categoria NÃO existe (007-categoria-do-contato.sql)
(esperado no ensaio a seco)`.

- [ ] **Passo 8: Rodar os portões**

```bash
npm run lint && npm run typecheck && npx vitest run && npm run test:integracao
```
Esperado: os quatro limpos. Os puros sobem em 6; a integração continua em 61 —
o schema descartável passa a nascer com a coluna, e nada a lê ainda.

- [ ] **Passo 9: Commitar**

```bash
git add migrations/007-categoria-do-contato.sql lib/categorias.ts tests/categorias.test.ts scripts/migrar.mjs lib/esquema.ts
git commit -m "A categoria do contato ganha coluna e regra de nome"
```

---

### Tarefa 2: Marca-se na conversa

**Arquivos:**
- Modificar: `app/conversas/[id]/actions.ts`
- Modificar: `app/conversas/[id]/page.tsx`

**Interfaces:**
- Consome: `normalizarCategoria(bruto: unknown): string | null` de `@/lib/categorias`.
- Produz: a ação `definirCategoria(formData: FormData): Promise<void>`.

- [ ] **Passo 1: Escrever a ação**

Em `app/conversas/[id]/actions.ts`, acrescentar ao fim (o arquivo já tem
`"use server"` no topo, e já importa `revalidatePath`, `getSelectedAccount` e
`sql`; acrescentar só o import de `normalizarCategoria`):

```ts
import { normalizarCategoria } from "@/lib/categorias";
```

```ts
/**
 * Marca (ou desmarca) a categoria de um contato.
 *
 * QUEM DECIDE O NOME É `normalizarCategoria`, e não esta função: `Aluno` e
 * `aluno ` têm de gravar a MESMA coisa, senão o filtro da lista passa a mentir.
 * Campo em branco grava `null` — é o pedido legítimo de "tirar a categoria".
 *
 * O `account_id` no `where` é o que impede marcar contato de outra conta: o
 * identificador vem do formulário, e formulário é do navegador.
 */
export async function definirCategoria(formData: FormData): Promise<void> {
  const account = await getSelectedAccount();
  if (!account) return;

  const contactIgId = String(formData.get("contato") ?? "");
  if (!contactIgId) return;

  const categoria = normalizarCategoria(formData.get("categoria"));

  await sql().query(
    `update contacts set categoria = $3 where account_id = $1 and ig_id = $2`,
    [account.ig_user_id, contactIgId, categoria]
  );

  revalidatePath(`/conversas/${contactIgId}`);
  revalidatePath("/contatos");
}
```

- [ ] **Passo 2: Conferir que compila**

```bash
npm run lint && npm run typecheck
```
Esperado: os dois limpos.

- [ ] **Passo 3: Ler a categoria e as em uso, na página**

Em `app/conversas/[id]/page.tsx`, a consulta do contato hoje é:

```
      `select username, name, profile_pic, last_reply_at
```

Acrescentar `categoria` à lista de colunas selecionadas, e ao tipo declarado
logo abaixo dela (o tipo já lista `username`, `name`, `profile_pic` e
`last_reply_at`):

```ts
    categoria: string | null;
```

E, depois dessa consulta, ler as categorias já em uso para oferecer no campo:

```tsx
  // AS CATEGORIAS JÁ EM USO, para o campo oferecer em vez de exigir memória.
  // Sai daqui e não de uma tabela de categorias porque não há tabela: a lista
  // É o conjunto de valores distintos, por decisão de desenho.
  const emUso = (await sql().query(
    `select distinct categoria from contacts
      where account_id = $1 and categoria is not null
      order by categoria`,
    [account.ig_user_id]
  )) as { categoria: string }[];
```

**Conferir antes de escrever:** este arquivo já tem uma conta em mãos para fazer
a consulta do contato. Usar a MESMA variável — não chamar `getSelectedAccount()`
de novo.

- [ ] **Passo 4: O campo, no cabeçalho**

Em `app/conversas/[id]/page.tsx`, dentro do `<div>` do cabeçalho, entre o bloco
do nome (`<div className="min-w-0 flex-1 leading-tight">…</div>`) e o selo da
janela (`<span className={janela.open ? badgeOk : badgeNeutral}>`):

```tsx
        {/* A CATEGORIA MARCA-SE AQUI, e não na tabela de contatos: marcar na
            lista exigiria um formulário por linha, 126 deles no mesmo
            documento. E aqui você marca com contexto — acabou de ler o que a
            pessoa disse.

            `<datalist>` é HTML nativo: oferece o que já existe e continua
            aceitando um nome novo digitado. Nenhum componente de cliente,
            nenhum estado. */}
        <form action={definirCategoria} className="flex items-center gap-1">
          <input type="hidden" name="contato" value={id} />
          <input
            name="categoria"
            list="categorias-em-uso"
            defaultValue={contato?.categoria ?? ""}
            placeholder="sem categoria"
            maxLength={LIMITE_DA_CATEGORIA}
            className={`w-36 rounded-lg px-2 py-1 text-xs ${input}`}
          />
          <datalist id="categorias-em-uso">
            {emUso.map((c) => (
              <option key={c.categoria} value={c.categoria} />
            ))}
          </datalist>
          <button type="submit" className={`${btnGhost} text-xs`}>
            salvar
          </button>
        </form>
```

**Os imports, conferidos no arquivo:** ele já traz
`import { muted, badgeOk, badgeNeutral } from "../../ui";` (linha 13) e **não**
traz `input` nem `btnGhost`. Trocar essa linha por:

```tsx
import { muted, badgeOk, badgeNeutral, input, btnGhost } from "../../ui";
```

E acrescentar duas linhas novas:

```tsx
import { definirCategoria } from "./actions";
import { LIMITE_DA_CATEGORIA } from "@/lib/categorias";
```

**O botão é um `<button>` simples**, e não o `SubmitButton` do `/setup`: aquele
componente é de cliente e existe para desabilitar durante um envio demorado. Aqui
a gravação é um `update` de uma linha, e trazer um componente de cliente para o
cabeçalho de uma página que não tem nenhum seria pagar caro por nada.

- [ ] **Passo 5: Rodar os portões**

```bash
npm run lint && npm run typecheck && npx vitest run
```
Esperado: os três limpos, e a contagem de testes puros sem mudança (esta tarefa
não acrescenta decisão pura).

- [ ] **Passo 6: Commitar**

```bash
git add "app/conversas/[id]/actions.ts" "app/conversas/[id]/page.tsx"
git commit -m "A categoria marca-se na conversa, com as em uso oferecidas"
```

---

### Tarefa 3: Vê-se e filtra-se na lista, com o alcance verdadeiro

**Arquivos:**
- Modificar: `lib/categorias.ts`
- Modificar: `tests/categorias.test.ts`
- Modificar: `app/contatos/page.tsx`

**Interfaces:**
- Consome: `normalizarCategoria` de `@/lib/categorias`; `windowState` de
  `@/lib/inbox-window`.
- Produz: o tipo `FichaDeCategoria` e
  `resumoDasCategorias(contatos, agora?): FichaDeCategoria[]`.

- [ ] **Passo 1: Escrever o teste que falha**

Acrescentar ao fim de `tests/categorias.test.ts`, e acrescentar
`resumoDasCategorias` e o tipo `FichaDeCategoria` ao import do topo:

```ts
// ============================================================
// AS FICHAS, E O NÚMERO QUE ELAS EXISTEM PARA CONTAR.
//
// Medido em 31/08/2026 no banco de produção: 126 contatos, 9 alcançáveis —
// 7,1%. Duas das quatro contas com ZERO. É esse número que a ficha mostra, e
// mostrá-lo ANTES de existir botão de enviar é a razão de esta funcionalidade
// vir primeiro.
// ============================================================
describe("resumoDasCategorias", () => {
  const AGORA = new Date("2026-08-31T12:00:00Z").getTime();
  const HORAS = (h: number) => new Date(AGORA - h * 3_600_000);

  it("conta por categoria, e conta quantos estão alcançáveis", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: "aluno", last_reply_at: HORAS(1) },
        { categoria: "aluno", last_reply_at: HORAS(30) },
        { categoria: "aluno", last_reply_at: null },
        { categoria: "interessado", last_reply_at: HORAS(2) },
      ],
      AGORA
    );
    expect(fichas).toEqual([
      { nome: "aluno", total: 3, alcancaveis: 1 },
      { nome: "interessado", total: 1, alcancaveis: 1 },
    ]);
  });

  // O balde do `null` é uma ficha como as outras — sem ele as contagens não
  // somam o total, e a tela passa a esconder gente.
  it("quem não tem categoria vira a ficha `sem categoria`, sempre por último", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: null, last_reply_at: HORAS(1) },
        { categoria: null, last_reply_at: HORAS(99) },
        { categoria: "aluno", last_reply_at: HORAS(99) },
      ],
      AGORA
    );
    expect(fichas.map((f) => f.nome)).toEqual(["aluno", null]);
    expect(fichas.at(-1)).toEqual({ nome: null, total: 2, alcancaveis: 1 });
  });

  it("a ordem é por tamanho, e empate desempata pelo nome", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: "zeta", last_reply_at: null },
        { categoria: "alfa", last_reply_at: null },
        { categoria: "meio", last_reply_at: null },
        { categoria: "meio", last_reply_at: null },
      ],
      AGORA
    );
    expect(fichas.map((f) => f.nome)).toEqual(["meio", "alfa", "zeta"]);
  });

  // ESTE É O CASO QUE PRENDE A HONESTIDADE, e ele existe por uma medição:
  // `windowState` fecha 5 minutos ANTES das 24h (WINDOW_MARGIN_MS), e o motor de
  // envio usa exatamente essa regra. Uma contagem por "menos de 24h" seria
  // QUASE sempre certa — e erraria ~7 vezes por dia, por 5 minutos cada,
  // prometendo alcance que o envio recusa. Erro que some sozinho é erro que
  // ninguém reproduz.
  it("quem está nos últimos 5 minutos da janela conta como FORA", () => {
    const fichas = resumoDasCategorias(
      [{ categoria: "aluno", last_reply_at: new Date(AGORA - (24 * 60 - 2) * 60_000) }],
      AGORA
    );
    expect(fichas[0]).toEqual({ nome: "aluno", total: 1, alcancaveis: 0 });
  });

  it("as contagens somam o total de contatos", () => {
    const contatos = [
      { categoria: "a", last_reply_at: HORAS(1) },
      { categoria: "b", last_reply_at: HORAS(1) },
      { categoria: null, last_reply_at: HORAS(1) },
    ];
    const fichas = resumoDasCategorias(contatos, AGORA);
    expect(fichas.reduce((s, f) => s + f.total, 0)).toBe(contatos.length);
  });

  it("lista vazia devolve lista vazia, e não estoura", () => {
    expect(resumoDasCategorias([], AGORA)).toEqual([]);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npx vitest run tests/categorias.test.ts`
Esperado: FALHA na importação — `resumoDasCategorias` não existe.

- [ ] **Passo 3: Escrever a função**

Em `lib/categorias.ts`, acrescentar **no topo do arquivo** (import de ESM não
vai no fim):

```ts
import { windowState } from "./inbox-window";
```

E o resto ao fim do arquivo:

```ts
export type FichaDeCategoria = {
  /** `null` é a ficha "sem categoria" — um balde de verdade, não um buraco. */
  nome: string | null;
  total: number;
  alcancaveis: number;
};

/**
 * As fichas da lista de contatos: cada categoria, quantos tem, e quantos estão
 * ALCANÇÁVEIS agora.
 *
 * O ALCANCE VEM DE `windowState`, E ISSO NÃO É ESTILO. Essa é a mesma função que
 * `lib/queue-drain.ts` usa para RECUSAR um envio, e ela fecha a janela 5 minutos
 * antes das 24h (`WINDOW_MARGIN_MS`). Uma contagem escrita aqui como "menos de
 * 24 horas" seria QUASE sempre igual — medido em 31/08/2026, as duas davam 9 —
 * e erraria enquanto alguém estivesse naquela faixa de cinco minutos: cerca de
 * 7 vezes por dia, cinco minutos cada. A tela prometeria uma pessoa alcançável,
 * o envio a recusaria, e ao conferir já teria passado.
 *
 * `agora` é parâmetro para o teste poder fixar o relógio; em produção ninguém o
 * passa.
 */
export function resumoDasCategorias(
  contatos: { categoria: string | null; last_reply_at: Date | string | null }[],
  agora: number = Date.now()
): FichaDeCategoria[] {
  const baldes = new Map<string | null, FichaDeCategoria>();
  for (const c of contatos) {
    const nome = c.categoria ?? null;
    const ficha = baldes.get(nome) ?? { nome, total: 0, alcancaveis: 0 };
    ficha.total += 1;
    if (windowState(c.last_reply_at, agora).open) ficha.alcancaveis += 1;
    baldes.set(nome, ficha);
  }
  return [...baldes.values()].sort((a, b) => {
    // "Sem categoria" fica sempre no fim: ela não é uma categoria que alguém
    // escolheu, e disputar posição com as escolhidas a faria parecer uma.
    if (a.nome === null) return 1;
    if (b.nome === null) return -1;
    return b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR");
  });
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npx vitest run tests/categorias.test.ts`
Esperado: PASSA, com 12 casos ao todo no arquivo.

- [ ] **Passo 5: Commitar a decisão pura**

```bash
git add lib/categorias.ts tests/categorias.test.ts
git commit -m "As fichas de categoria contam quantos estao alcancaveis de verdade"
```

- [ ] **Passo 6: A janela da lista passa a usar a fonte única**

Em `app/contatos/page.tsx`, a função `Janela` hoje é:

```tsx
function Janela({ c }: { c: Row }) {
  const h = hoursAgo(c.last_reply_at);
  const aberta = h !== null && h < 24;
```

**Isto é a segunda regra de janela do produto, e ela diverge da do motor.**
Trocar por:

```tsx
function Janela({ c }: { c: Row }) {
  // A MESMA função que o motor de envio usa para recusar (`lib/queue-drain.ts`).
  // Aqui havia `hoursAgo(...) < 24`, uma segunda regra — e ela é QUASE igual:
  // `windowState` fecha 5 minutos antes, e nessa faixa a lista dizia "aberta"
  // sobre alguém que o envio recusaria. Cerca de 7 travessias por dia, de 5
  // minutos cada, medido em 31/08/2026.
  const aberta = windowState(c.last_reply_at).open;
```

Acrescentar `import { windowState } from "@/lib/inbox-window";` aos imports, e
remover `hoursAgo` do import de `@/lib/format` **se nada mais no arquivo o
usar** (conferir com `grep -n hoursAgo app/contatos/page.tsx`).

- [ ] **Passo 7: A coluna, as fichas e o filtro**

Em `app/contatos/page.tsx`:

**(a)** o tipo `Contact` de `lib/db.ts:263` **NÃO tem `categoria` — conferido**.
Acrescentar, depois de `flow_step_id: string | null;`:

```ts
  categoria: string | null;
```

`Row` em `app/contatos/page.tsx` é `Contact & { automation_name: string | null }`
e a consulta usa `select c.*`, então a coluna chega sozinha assim que o tipo a
declara.

**(b)** a página passa a receber o filtro da URL:

```tsx
export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const sp = await searchParams;
  const filtro = normalizarCategoria(sp.categoria);
```

**(c)** a consulta traz TODOS os contatos da conta (as fichas contam o conjunto
inteiro), e o filtro é aplicado sobre o resultado:

```tsx
  const fichas = resumoDasCategorias(rows);
  const visiveis = sp.categoria === undefined ? rows : rows.filter((r) => (r.categoria ?? null) === filtro);
```

**Por que filtrar em memória e não no SQL:** as fichas precisam contar o conjunto
inteiro para os números não mudarem quando você clica num filtro. Duas consultas
diriam a mesma coisa por caminhos diferentes; uma só, filtrada depois, não pode
divergir. São 126 linhas com `limit 200` — não há volume que justifique a
segunda consulta.

**(d)** as fichas, acima da tabela, cada uma um link:

```tsx
      <div className="flex flex-wrap gap-2">
        <Link href="/contatos" className={sp.categoria === undefined ? badgeOk : badgeNeutral}>
          todos ({rows.length})
        </Link>
        {fichas.map((f) => (
          <Link
            key={f.nome ?? "__sem__"}
            href={`/contatos?categoria=${encodeURIComponent(f.nome ?? "")}`}
            className={filtro === f.nome && sp.categoria !== undefined ? badgeOk : badgeNeutral}
          >
            {f.nome ?? "sem categoria"} · {f.total} · {f.alcancaveis} alcançáveis
          </Link>
        ))}
      </div>
```

**(e)** a coluna na tabela: um `<th className="px-4 py-3">Categoria</th>` depois
de `Pessoa`, e a célula correspondente:

```tsx
              <td className={`px-4 py-2.5 ${muted}`}>{c.categoria ?? "—"}</td>
```

**(f)** passar `visiveis` para `<Tabela rows={...}>` no lugar de `rows`.

Acrescentar aos imports: `Link` de `next/link`, `normalizarCategoria` e
`resumoDasCategorias` de `@/lib/categorias`, e `badgeOk`/`badgeNeutral` de
`../ui` (conferir os nomes exatos em `app/ui.ts` antes de escrever).

- [ ] **Passo 8: Rodar os portões**

```bash
npm run lint && npm run typecheck && npx vitest run && npm run test:integracao
```
Esperado: os quatro limpos.

- [ ] **Passo 9: Commitar**

```bash
git add app/contatos/page.tsx lib/db.ts
git commit -m "A lista de contatos mostra, filtra e conta o alcance por categoria"
```

---

## Como isto é provado na tela

A suíte não testa componente, então estes itens são de roteiro, feitos com a
depuração remota do Chrome contra o `npm run dev`. **O `dev` aponta para o banco
de PRODUÇÃO — marcar uma categoria aqui marca de verdade.** Usar um contato de
teste e desmarcá-lo no fim.

- [ ] Abrir uma conversa, digitar uma categoria, salvar, e recarregar: o valor
      permanece.
- [ ] Abrir outra conversa: o campo oferece a categoria recém-criada na lista
      de sugestões, sem precisar digitar tudo.
- [ ] Digitar `  Aluno  ` numa conversa e `aluno` noutra: a lista de contatos
      mostra UMA ficha, com 2.
- [ ] Em `/contatos`, as fichas aparecem acima da tabela e a soma dos `total`
      é igual ao número de contatos da conta.
- [ ] Clicar numa ficha filtra a tabela, e os números das fichas **não mudam**.
- [ ] Limpar o campo numa conversa e salvar: o contato volta para a ficha
      "sem categoria".
- [ ] Desmarcar o contato de teste no fim.
