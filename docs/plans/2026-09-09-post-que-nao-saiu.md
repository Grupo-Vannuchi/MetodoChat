# O post que não saiu precisa aparecer — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development.

**Objetivo:** publicação que falha para de sumir da tela, e o painel para de
chamá-la de mensagem.

**Arquitetura:** duas leituras a mais e nenhuma escrita. As decisões — o que a
tela mostra, a frase do aviso, a janela de cada tipo — são funções puras com
teste. Nenhuma migração, nenhuma ação de servidor nova.

## Restrições globais

- **A suíte não testa componente.** Decisão em JSX é defeito.
- **Nenhum `"use client"` novo.** Nenhuma ação de servidor nova.
- **A conta vem do cookie, nunca do formulário.**
- **`lib/steps.ts` não tem NENHUM import.** Não tocar. **Nenhuma migração.**
- A `DATABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` podem ser USADAS, nunca
  IMPRESSAS. Não ler a `ADMIN_PASSWORD`, não forjar cookie.
- Nunca rodar `next build` nem `npm run dev`. Nunca publicar de verdade.
- **Não mudar o comportamento de MENSAGEM** em lugar nenhum — só o de
  publicação, e só onde a spec manda.
- Comentários em português; commits em português SEM acentos, terminando com
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Tarefa 1: as decisões puras

**Arquivos:** `lib/publicacao.ts` (acrescentar), `tests/publicacao.test.ts`.

**Produz:**

```ts
/** Quantos dias uma falha continua valendo AVISO no painel, por tipo. */
export const DIAS_DE_AVISO_DA_PUBLICACAO = 7;
export const HORAS_DE_AVISO_DA_MENSAGEM = 24;

export function avisoDeFalhas(
  publicacoes: number,
  mensagens: number
): { texto: string; href: string } | null;

/** O que a seção "Não saíram" mostra para um item falhado. */
export function linhaDaFalha(item: {
  not_before: Date; error: string | null; payload: Record<string, unknown>;
}): { quando: Date; motivo: string; forma: string; legenda: string };
```

- [ ] **Passo 1: escrever os testes primeiro, e ver o vermelho**

```ts
describe("avisoDeFalhas", () => {
  it("sem falha nenhuma nao ha aviso", () => {
    expect(avisoDeFalhas(0, 0)).toBeNull();
  });
  // PUBLICACAO E MENSAGEM SAO FATOS DIFERENTES, e o painel os chamava do mesmo
  // nome — "mensagem nao saiu", inclusive para post. Cada um se resolve em tela
  // diferente, entao a frase E o destino tem de mudar junto.
  it("so publicacao aponta para a tela de agendados", () => {
    const a = avisoDeFalhas(1, 0)!;
    expect(a.texto).toContain("publicação");
    expect(a.texto).not.toContain("mensagem");
    expect(a.href).toBe("/publicar/agendados");
  });
  it("so mensagem continua apontando para eventos", () => {
    const a = avisoDeFalhas(0, 2)!;
    expect(a.texto).toContain("mensagens");
    expect(a.href).toBe("/eventos");
  });
  // AS DUAS AO MESMO TEMPO: a frase diz as duas coisas, e o destino nao pode
  // esconder metade. Publicacao vem primeiro porque e a que fica publica.
  it("as duas juntas dizem as duas, e mandam para a publicacao", () => {
    const a = avisoDeFalhas(1, 3)!;
    expect(a.texto).toContain("publicação");
    expect(a.texto).toContain("mensagens");
    expect(a.href).toBe("/publicar/agendados");
  });
  it("o singular e o plural nao saem errados", () => {
    expect(avisoDeFalhas(1, 0)!.texto).not.toContain("publicações");
    expect(avisoDeFalhas(2, 0)!.texto).toContain("publicações");
  });
});

describe("linhaDaFalha", () => {
  const base = { not_before: new Date("2026-09-11T12:59:00Z"), payload: { forma: "reels", legenda: "oi" } };
  it("o motivo escrito pelo dreno chega inteiro", () => {
    expect(linhaDaFalha({ ...base, error: "Instagram API 400: media nao encontrada" }).motivo)
      .toContain("media nao encontrada");
  });
  // ITEM `failed` SEM MOTIVO E POSSIVEL — o `error` e opcional na tabela. A
  // tela nao pode ficar em branco, porque branco parece defeito da tela e nao
  // do envio.
  it("falha sem motivo escrito ainda diz alguma coisa", () => {
    const m = linhaDaFalha({ ...base, error: null }).motivo;
    expect(m.length).toBeGreaterThan(0);
    expect(m.toLowerCase()).not.toBe("null");
  });
  it("a data e a que ele DEVERIA ter saido", () => {
    expect(linhaDaFalha({ ...base, error: null }).quando).toEqual(base.not_before);
  });
  // PAYLOAD ADULTERADO NAO PODE DERRUBAR A TELA: a coluna e jsonb e editavel
  // por fora do painel. O par disto no dreno e `publicacao_com_payload_invalido`.
  it("payload sem forma nem legenda nao quebra", () => {
    const r = linhaDaFalha({ not_before: base.not_before, error: "x", payload: {} });
    expect(typeof r.forma).toBe("string");
    expect(typeof r.legenda).toBe("string");
  });
});
```

- [ ] **Passo 2: implementar** em `lib/publicacao.ts`. Reuse `rotuloDaFormaDoItem`
      se ela servir — **leia antes**, e não escreva uma segunda fonte para a
      mesma palavra.
- [ ] **Passo 3: verde**, e a suíte inteira também.
- [ ] **Passo 4: plantar** — `avisoDeFalhas(1, 0)` devolvendo a frase de
      mensagem. Esperado: VERMELHO. Reverter e conferir a árvore.
- [ ] **Passo 5: commitar.**

---

### Tarefa 2: as duas telas

**Arquivos:** `app/publicar/agendados/page.tsx`, `app/page.tsx`.

- [ ] **Passo 1: a seção "Não saíram"**

Em `app/publicar/agendados/page.tsx`, uma segunda consulta:

```sql
select * from queue
 where account_id = $1 and kind = 'publicacao' and status = 'failed'
 order by not_before desc
 limit $2
```

**Sem recorte de tempo** (spec §1): é a tela para onde se vai procurar.

A seção só aparece quando há alguma. Cada linha usa `linhaDaFalha`, e mostra o
motivo. **Não há botão** — não há o que cancelar num post que já falhou.

**Cuidado com a consulta existente:** ela continua filtrando `pending`, e é isso
que mantém as duas seções separadas. Não junte.

- [ ] **Passo 2: o aviso do painel**

Em `app/page.tsx`, a contagem única de `failed24` vira duas:

```sql
count(*) filter (where kind = 'publicacao'
   and created_at > now() - make_interval(days => 7))  as falhas_publicacao,
count(*) filter (where kind <> 'publicacao'
   and created_at > now() - interval '24 hours')       as falhas_mensagem
```

**As duas janelas são diferentes de propósito** (spec §3): mensagem fica em 24h
porque o comportamento não muda; publicação vai a 7 dias porque o modo de falha
declarado é "sexta à noite, ninguém vê até segunda".

A frase e o destino vêm de `avisoDeFalhas`. **Nenhum texto novo no JSX.**

- [ ] **Passo 3: conferir** os cinco portões.

- [ ] **Passo 4: o caminho de integração**

`testes-integracao/` — no molde de `agendados.integracao.ts`. Os casos:

- publicação `failed` aparece na seção de falhadas, com o motivo
- publicação `pending` continua na seção de agendados e **não** aparece na outra
- falha de OUTRA conta não aparece em nenhuma das duas
- falha de 8 dias atrás **sai** do aviso do painel e **continua** na tela de
  agendados — é o par que prende a diferença entre as duas regras

- [ ] **Passo 5: plantar e medir**

1. a consulta das falhadas sem `account_id` → VERMELHO
2. a janela de 7 dias virando 24h → VERMELHO no caso dos 8 dias
3. a frase de publicação virando a de mensagem → VERMELHO no puro
4. a seção nova lendo `pending` em vez de `failed` → VERMELHO

- [ ] **Passo 6: commitar.**
