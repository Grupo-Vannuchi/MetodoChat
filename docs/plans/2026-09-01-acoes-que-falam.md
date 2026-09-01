# As ações que falam — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development para implementar tarefa a tarefa.

**Objetivo:** nenhuma ação do painel recusa ou conclui em silêncio.

**Arquitetura:** as frases e as decisões de aviso viram funções puras em
`lib/avisos.ts`, com teste. Telas de servidor (`/contatos`, `/conversas/[id]`)
recebem o aviso por `redirect` com parâmetro de busca, no molde de
`app/setup/actions.ts`. A tela de automações, que já é cliente e já tem estado,
recebe pelo tipo `Resultado` que `toggleAutomation` já usa no mesmo arquivo.

**Tecnologias:** Next.js 16 App Router, React 19, Server Actions, Vitest.

## Restrições globais

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **NENHUM `"use client"` novo** em `/contatos` nem em `/conversas/[id]`.
- **`lib/steps.ts` não tem NENHUM import.** Não mexer nele.
- **`redirect()` funciona LANÇANDO.** Nunca dentro de `try/catch` que engole.
- **`?categoria=` ausente e presente-e-vazio são pedidos DIFERENTES.** Foi o
  Crítico de 01/09. Toda URL remontada passa por `urlComFiltro`.
- **NÃO alterar `alvoDoLote`** (`lib/lote.ts`): é a função que matou aquele
  Crítico. O motivo do vazio é função IRMÃ, que só explica vazio já decidido.
- Comentários em português; commits em português SEM acentos, sem trailer,
  sem menção a agente.
- Nunca rodar `next build` nem `npm run dev`. Nunca escrever no banco.
- A `DATABASE_URL` pode ser usada, nunca impressa.

## Estrutura de arquivos

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `lib/avisos.ts` | CRIAR — as frases, o motivo do vazio, a URL com aviso | 1 |
| `tests/avisos.test.ts` | CRIAR — os casos | 1 |
| `app/contatos/actions.ts` | as duas ações passam a redirecionar com aviso | 2 |
| `app/contatos/page.tsx` | lê o aviso e mostra a faixa | 2 |
| `app/conversas/[id]/actions.ts` | `definirCategoria` redireciona com aviso | 3 |
| `app/conversas/[id]/page.tsx` | lê o aviso e mostra a faixa | 3 |
| `app/automacoes/actions.ts` | as duas ações devolvem `Resultado` | 3 |
| `app/automacoes/list-client.tsx` | mostra o erro das duas | 3 |
| `app/account-actions.ts` | comentário: o silêncio é deliberado | 3 |
| `app/conversas/[id]/marcar-visto.ts` | comentário: o silêncio é deliberado | 3 |

---

### Tarefa 1: as decisões puras

**Arquivos:** Criar `lib/avisos.ts` e `tests/avisos.test.ts`.

**Produz** (as outras tarefas dependem destes nomes exatos):

```ts
export type TomDoAviso = "ok" | "erro";
export type Aviso = { tom: TomDoAviso; texto: string };

export type RecusaDoLote =
  | "sem_conta" | "sem_texto" | "url_invalida"
  | "sem_confirmacao" | "ninguem_no_filtro";

export function motivoDoLoteVazio(
  confirmado: boolean,
  filtroEntendido: boolean,
  quantosNaConta: number
): RecusaDoLote;

export function textoDaRecusaDoLote(motivo: RecusaDoLote): string;
export function textoDoLoteEnviado(agora: number, guardadas: number): string;
export function urlComAviso(base: string, filtro: FiltroDeCategoria, aviso: string): string;
export function avisoDaUrl(bruto: string | undefined, tomBruto: string | undefined): Aviso | null;
```

- [ ] **Passo 1: escrever os testes primeiro**

Em `tests/avisos.test.ts`. Os casos que TÊM de existir:

```ts
import { describe, it, expect } from "vitest";
import {
  motivoDoLoteVazio, textoDaRecusaDoLote, textoDoLoteEnviado,
  urlComAviso, avisoDaUrl,
} from "../lib/avisos";

describe("motivoDoLoteVazio", () => {
  // A ORDEM DOS MOTIVOS IMPORTA, e este caso é o que a segura: sem confirmação
  // E sem ninguém no filtro é possível ao mesmo tempo, e a frase útil é a que
  // diz o que FAZER — marcar a caixa —, não a que descreve o filtro.
  it("sem confirmacao vence, mesmo com o filtro vazio", () => {
    expect(motivoDoLoteVazio(false, true, 0)).toBe("sem_confirmacao");
  });
  it("filtro que nao foi entendido nao e confundido com filtro vazio", () => {
    expect(motivoDoLoteVazio(true, false, 10)).toBe("ninguem_no_filtro");
  });
  it("confirmado e com gente na conta, mas ninguem no recorte", () => {
    expect(motivoDoLoteVazio(true, true, 10)).toBe("ninguem_no_filtro");
  });
});

describe("urlComAviso", () => {
  // AS DUAS ARMADILHAS NUM CASO SÓ: "tudo" não tem parâmetro nenhum e o aviso
  // entra com "?"; "uma" já tem "?categoria=" e o aviso PRECISA entrar com "&".
  // Concatenar "?" nos dois casos produziria "?categoria=x?aviso=y", que o
  // Next lê como categoria = "x?aviso=y" — e o filtro do redirect passaria a
  // ser uma categoria que não existe.
  it("filtro tudo: o aviso entra com interrogacao", () => {
    expect(urlComAviso("/contatos", { tipo: "tudo" }, "enviado"))
      .toBe("/contatos?aviso=enviado");
  });
  it("filtro com nome: o aviso entra com e-comercial", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: "aluno" }, "enviado"))
      .toBe("/contatos?categoria=aluno&aviso=enviado");
  });
  // O CASO QUE E O CRITICO DE HOJE VOLTANDO POR OUTRA PORTA: "sem categoria" e
  // `?categoria=` PRESENTE E VAZIO. Se o redirect o perder, a tela volta
  // mostrando a conta inteira depois de um envio.
  it("a ficha sem categoria sobrevive ao redirect", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: null }, "enviado"))
      .toBe("/contatos?categoria=&aviso=enviado");
  });
  it("categoria com espaco e e-comercial continua codificada", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: "turma & cia" }, "enviado"))
      .toBe("/contatos?categoria=turma%20%26%20cia&aviso=enviado");
  });
});

describe("textoDoLoteEnviado", () => {
  it("diz o repartimento, e nao so 'enviado'", () => {
    expect(textoDoLoteEnviado(3, 0)).toContain("3");
    expect(textoDoLoteEnviado(3, 0)).toContain("agora");
  });
  it("o singular nao sai errado", () => {
    expect(textoDoLoteEnviado(1, 1)).not.toContain("1 pessoas");
  });
  it("tudo guardado NAO diz que alguem recebeu agora", () => {
    const t = textoDoLoteEnviado(0, 5);
    expect(t).toContain("5");
    expect(t.toLowerCase()).not.toMatch(/0 receber/);
  });
});

describe("avisoDaUrl", () => {
  it("aviso ausente e nulo", () => {
    expect(avisoDaUrl(undefined, undefined)).toBeNull();
  });
  // O TOM VEM DA URL, E A URL E DIGITAVEL: um tom desconhecido tem de cair em
  // "erro", e nunca virar classe de CSS montada com texto de fora.
  it("tom desconhecido cai em erro, e nao vira classe solta", () => {
    expect(avisoDaUrl("qualquer coisa", "roxo")?.tom).toBe("erro");
  });
});
```

- [ ] **Passo 2: rodar e ver vermelho**

`npx vitest run tests/avisos.test.ts` — esperado: FALHA, módulo não existe.

- [ ] **Passo 3: escrever `lib/avisos.ts`**

Importa `FiltroDeCategoria` e `urlComFiltro` de `./categorias`. `urlComAviso`
TEM de ser construída sobre `urlComFiltro` — nunca montando `?categoria=` de
novo —, e decide entre `?` e `&` por já haver ou não parâmetro. As frases são
as da spec §3. `textoDoLoteEnviado` trata singular e o caso `agora === 0`.

- [ ] **Passo 4: rodar e ver verde**

`npx vitest run tests/avisos.test.ts`, depois `npx vitest run` inteiro.

- [ ] **Passo 5: plantar e medir**

Plantio A: em `urlComAviso`, trocar a escolha entre `?` e `&` por `?` sempre.
Esperado: VERMELHO no caso "filtro com nome".
Plantio B: em `motivoDoLoteVazio`, inverter a ordem dos dois primeiros ramos.
Esperado: VERMELHO no caso "sem confirmacao vence".
Reverter cada um com `git checkout --` e conferir `git status --porcelain` vazio.

- [ ] **Passo 6: commitar**

---

### Tarefa 2: `/contatos` passa a falar

**Consome:** tudo da Tarefa 1.

**Arquivos:** `app/contatos/actions.ts`, `app/contatos/page.tsx`.

- [ ] **Passo 1: `enviarLote` conta o que fez**

As cinco saídas mudas viram `redirect(urlComAviso("/contatos", filtro ?? {tipo:"tudo"}, ...))`.
Duas exigências, e são as armadilhas 2 e 3 da spec:

1. O `redirect` de sucesso fica **FORA** do `try { await drainQueue() } catch {}`.
   Dentro, o `catch` o engoliria e a ação voltaria muda.
2. O número do aviso vem de uma consulta pelos itens **do próprio lote** —
   `crypto.randomUUID()` hoje é descartado; guardar em variável e usar no
   `where`. NÃO usar o retorno de `drainQueue`, que conta a fila inteira.

Para distinguir "sem confirmação" de "ninguém no filtro", chamar
`motivoDoLoteVazio` quando `alvo.length === 0`. **Não alterar `alvoDoLote`.**

- [ ] **Passo 2: `atualizarPerfis` idem**, com aviso de sucesso dizendo quantos
      perfis foram atualizados.

- [ ] **Passo 3: a faixa na página**

`searchParams` ganha `aviso?: string; tom?: string`. A faixa usa `alertOk` e
`alertError` de `app/ui.ts`, no molde de `app/setup/page.tsx:146`.
**Sem `"use client"`.**

- [ ] **Passo 4: conferir** `npm run lint && npm run typecheck && npx vitest run`

- [ ] **Passo 5: plantar e medir**

Plantio: mover o `redirect` de sucesso para DENTRO do `try` do `drainQueue`.
Não há teste que pegue isso (a ação não é alcançável sem cookie) — **diga
isso no relatório em vez de forçar um caso**, e diga o que protege a linha.

- [ ] **Passo 6: commitar**

---

### Tarefa 3: as outras três telas, e as duas que ficam mudas

**Arquivos:** `app/conversas/[id]/actions.ts`, `app/conversas/[id]/page.tsx`,
`app/automacoes/actions.ts`, `app/automacoes/list-client.tsx`,
`app/account-actions.ts`, `app/conversas/[id]/marcar-visto.ts`.

- [ ] **Passo 1: `definirCategoria` fala**, no mesmo molde da Tarefa 2, com a
      faixa em `app/conversas/[id]/page.tsx`. Sem `"use client"`.

- [ ] **Passo 2: `deleteAutomation` e `duplicateAutomation` devolvem `Resultado`**

O tipo JÁ EXISTE no arquivo (linha 42) e `toggleAutomation` já o devolve. As
duas passam de `Promise<void>` para `Promise<Resultado>`. `list-client.tsx`
mostra o erro onde já mostra o de `toggleAutomation`.

- [ ] **Passo 3: as duas que ficam mudas ganham o motivo POR ESCRITO**

Em `app/account-actions.ts` e `app/conversas/[id]/marcar-visto.ts`, um
comentário dizendo que o silêncio é deliberado e por quê (spec §4), para a
próxima varredura não os tratar como esquecimento.

- [ ] **Passo 4: conferir** os quatro portões.

- [ ] **Passo 5: plantar e medir** — apagar o ramo de erro de
      `duplicateAutomation` em `list-client.tsx`.

- [ ] **Passo 6: commitar**
