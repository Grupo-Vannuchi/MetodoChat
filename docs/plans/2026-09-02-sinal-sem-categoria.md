# O sinal de "sem categoria" — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development para implementar tarefa a tarefa.

**Objetivo:** a lista de conversas mostra quais ainda não têm categoria, e
quantas faltam.

**Arquitetura:** a regra do que conta como "sem categoria" vira função pura em
`lib/categorias.ts`, construída sobre `normalizarCategoria` que a gravação já
usa. A lista de conversas passa a carregar a categoria, a linha ganha a marca no
fluxo da segunda linha, e o cabeçalho ganha o contador — os dois pela mesma
função.

**Tecnologias:** Next.js 16 App Router, React 19, Vitest.

## Restrições globais

- **A suíte não testa componente.** Decisão em JSX é defeito.
- **NÃO alterar `badgeDaConversa`** (`lib/inbox-badge.ts`) — spec §1: ela decide
  o canto direito, e a categoria não mora lá.
- **`lista.tsx` já é `"use client"` e continua** — nenhum componente de cliente
  NOVO.
- **`lib/steps.ts` não tem NENHUM import.** Não tocar.
- **A janela de 24h tem UMA fonte: `windowState`.**
- A `DATABASE_URL` pode ser usada, nunca impressa. Não ler `ADMIN_PASSWORD`,
  não forjar cookie.
- Nunca rodar `next build` nem `npm run dev`. Nunca escrever no banco.
- Comentários em português; commits em português SEM acentos, sem trailer, sem
  menção a agente.

## Estrutura de arquivos

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `lib/categorias.ts` | as duas funções puras | 1 |
| `tests/categorias.test.ts` | os casos | 1 |
| `lib/conversations.ts` | a consulta passa a trazer `categoria` | 2 |
| `app/conversas/lista.tsx` | a marca na segunda linha | 2 |
| `app/conversas/layout.tsx` | o contador no cabeçalho | 2 |

---

### Tarefa 1: a regra do que conta como "sem categoria"

**Arquivos:** `lib/categorias.ts` (acrescentar), `tests/categorias.test.ts`.

**Produz:**

```ts
export function semCategoria(bruto: unknown): boolean;
export function quantasSemCategoria(lista: { categoria: string | null }[]): number;
```

- [ ] **Passo 1: escrever os testes primeiro**

Acrescentar a `tests/categorias.test.ts`:

```ts
describe("semCategoria", () => {
  it("null e sem categoria", () => {
    expect(semCategoria(null)).toBe(true);
  });
  it("texto de verdade tem categoria", () => {
    expect(semCategoria("aluno")).toBe(false);
  });
  // O CASO QUE JUSTIFICA A FUNCAO EXISTIR. Uma categoria de espacos em branco
  // marcaria a conversa como resolvida sem ninguem ter decidido nada, e ela
  // deixaria de pedir marcacao PARA SEMPRE — numa tela cheia, nenhum olho pega.
  it("so espacos conta como SEM categoria", () => {
    expect(semCategoria("   ")).toBe(true);
    expect(semCategoria("")).toBe(true);
  });
  // `normalizarCategoria` remove os invisiveis de largura zero ANTES de
  // colapsar espaco. Uma categoria feita so deles tem de cair no mesmo balde.
  it("so invisiveis conta como SEM categoria", () => {
    expect(semCategoria("\u200d\u200b")).toBe(true);
  });
  it("o que nao e string conta como SEM categoria", () => {
    expect(semCategoria(42)).toBe(true);
    expect(semCategoria(undefined)).toBe(true);
  });
});

describe("quantasSemCategoria", () => {
  it("conta so as que faltam, e a mesma regra da marca", () => {
    expect(
      quantasSemCategoria([
        { categoria: "aluno" },
        { categoria: null },
        { categoria: "   " },
        { categoria: "interessado" },
      ])
    ).toBe(2);
  });
  it("lista vazia e zero", () => {
    expect(quantasSemCategoria([])).toBe(0);
  });
});
```

- [ ] **Passo 2: rodar e ver vermelho**

`npx vitest run tests/categorias.test.ts` — esperado: FALHA, funções não existem.

- [ ] **Passo 3: escrever as duas funções**

Em `lib/categorias.ts`, junto de `normalizarCategoria`. `semCategoria` é
`normalizarCategoria(bruto) === null` — **construída sobre ela, não copiando a
regra**: leitura e escrita não podem divergir, e o comentário tem de dizer isso.
`quantasSemCategoria` é a mesma função aplicada à lista.

- [ ] **Passo 4: rodar e ver verde**

`npx vitest run tests/categorias.test.ts`, depois `npx vitest run` inteiro.

- [ ] **Passo 5: plantar e medir**

Trocar `semCategoria` por `bruto === null`. Esperado: VERMELHO nos casos de
espaços e invisíveis. Reverter com `git checkout --` e conferir
`git status --porcelain` vazio.

- [ ] **Passo 6: commitar**

---

### Tarefa 2: a marca e o contador

**Consome:** `semCategoria` e `quantasSemCategoria` da Tarefa 1.

**Arquivos:** `lib/conversations.ts`, `app/conversas/lista.tsx`,
`app/conversas/layout.tsx`.

- [ ] **Passo 1: a consulta traz a categoria**

Em `listConversations` (`lib/conversations.ts`), acrescentar `c.categoria` ao
`select` **E ao `group by`**.

**ARMADILHA:** o `group by` lista uma a uma as colunas de `contacts`
(`c.username, c.name, c.profile_pic, c.last_reply_at, c.last_seen_at`). Pôr a
coluna só no `select` estoura com 42803 em tempo de execução — o banco pega, mas
só quando alguém abrir a tela. Acrescente nos dois lugares.

Acrescentar `categoria: string | null` ao tipo de retorno inline da função.

- [ ] **Passo 2: o tipo da lista**

`ConversaResumo` (`app/conversas/lista.tsx`) ganha `categoria: string | null`.

- [ ] **Passo 3: a marca na linha**

Na SEGUNDA linha, depois do contador de mensagens, separada pelo mesmo `·` que
já separa os campos de lá:

```tsx
{semCategoria(c.categoria) && (
  <>
    <span aria-hidden="true">·</span>
    <span className="shrink-0">sem categoria</span>
  </>
)}
```

Mesma classe apagada da linha (o `muted` já está no `div` que a envolve), sem
cor de alerta e sem fundo — spec §1. **Antes** do `ml-auto` da contagem, para
não disputar o canto direito.

- [ ] **Passo 4: o contador no cabeçalho**

Em `app/conversas/layout.tsx`, junto do subtítulo que já explica a regra das
24h. **Zero não vira linha** (spec §3): quando `quantasSemCategoria` devolve 0,
não renderiza nada.

- [ ] **Passo 5: conferir**

`npm run lint && npm run typecheck && npx vitest run && npm run test:integracao`

- [ ] **Passo 6: plantar e medir**

Plantio A: tirar `c.categoria` do `group by` (deixando no `select`).
Esperado: VERMELHO na integração que exercita `listConversations`. Se ficar
VERDE, **diga** — significa que nenhum caminho de integração roda essa consulta,
e isso é achado.

Plantio B: trocar a condição da marca por `c.categoria === null`.
Esperado: nada vermelho (a suíte não testa componente) — **diga isso**, e diga
o que de fato protege a linha.

- [ ] **Passo 7: commitar**
