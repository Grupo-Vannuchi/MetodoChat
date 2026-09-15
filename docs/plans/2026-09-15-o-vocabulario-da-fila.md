# O vocabulário da fila tem um dono — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`,
> tarefa a tarefa. Os passos usam caixa (`- [ ]`).

**Objetivo:** conserta um número errado em produção e fecha a porta pela qual ele
entrou — telas reescrevendo, em SQL, regras que já moram em `lib/`.

**Arquitetura:** as quatro definições passam a ter um dono só, ao lado das
vizinhas que já existem (`lib/envio-filters.ts`, `lib/event-filters.ts`); as
consultas as recebem por parâmetro; e uma varredura reprova quem escrever os
valores à mão.

**Pilha:** Next.js 16, postgres.js, Vitest.

**Sem spec separada:** este plano corrige defeitos MEDIDOS, não cria capacidade
nova. O desenho foi apresentado ao dono com os números abaixo e aprovado. A
seção "Por que existe" faz o papel da spec.

---

## Por que existe

### O defeito ativo, medido em produção em 15/09/2026

`/desempenho` mostra **"Mensagens entregues: 5"**. O motor entregou **3**. Os
outros dois são **posts publicados** contados como mensagem — e "Mensagens
entregues" é justamente o número que existe para dizer se o sistema está
funcionando.

```
como está: toda a fila                        5
só o motor (sem dm_manual, sem publicacao)    3
```

A mesma subconsulta (`sent7`) alimenta o estado calmo do Início: *"N mensagens
entregues em 7 dias"*. Duas telas, o mesmo número inflado.

### A raiz: a mesma definição escrita em vários lugares

Nas últimas 48h, **quatro** defeitos distintos foram achados, e os quatro têm a
mesma forma — uma tela reescrevendo uma regra que já existia:

| a tela afirmava | onde a regra já morava |
|---|---|
| `media_id` tem de bater exatamente | `findMatch`, que aceita nulo como "todo post" |
| `dm_manual` é entrega do motor | `KINDS_MANUAIS` (`lib/envio-filters.ts:22`) |
| fila viva é só `pending` | `/desempenho`, que já contava `guardado` |
| mensagem recebida é `type='message'` | `/contatos`, em dois lugares, com os quatro tipos |

**E o código já sabia.** O comentário de `app/contatos/page.tsx:344` diz, com
todas as letras: *"duas contas iguais em lugares diferentes é o mesmo risco que
a tela e o CSV já correram"*. E o de `origemDoKind`: *"uma função só, usada pela
tela e espelhada pelo SQL, para as duas nunca discordarem de quem mandou"*. As
duas frases descrevem exatamente o que voltou a acontecer.

### O que foi investigado e NÃO é defeito

O calendário de publicações usa `status in ('pending','sent')`, sem `guardado`.
Medido: publicação **nunca** fica `guardado` — `guardado` é o envio que espera a
pessoa voltar a falar, e post não tem janela. Os três status de `publicacao` no
banco são `sent`, `skipped` e `failed`. Está certo, e fica como está.

---

## Restrições globais

- As definições vão para os arquivos que JÁ têm as vizinhas: nada de módulo novo.
- `lib/envio-filters.ts` e `lib/event-filters.ts` **não têm `server-only`**, de
  propósito — a barra de filtros é componente de cliente. Não acrescente.
- As consultas recebem as listas **por parâmetro** (`= any($n)`), como
  `app/page.tsx` já faz com `KINDS_MANUAIS` desde 15/09. Nada de interpolar
  string em SQL.
- Comentário em português explicando **por quê**, no tom do arquivo vizinho.
- Antes de cada commit: `npx tsc --noEmit` e `npx vitest run`.

---

## Estrutura de arquivos

| arquivo | o que muda |
|---|---|
| `lib/envio-filters.ts` | ganha `KIND_PUBLICACAO`, `KINDS_FORA_DA_ENTREGA_DO_MOTOR`, `STATUS_DE_FILA_VIVA` |
| `lib/event-filters.ts` | ganha `TIPOS_DE_MENSAGEM_RECEBIDA` |
| `app/page.tsx` | `sent7` deixa de contar publicação; o resto passa a usar as constantes |
| `app/desempenho/page.tsx` | `sent7` e `sent_prev7` idem; `pending` passa a usar a constante |
| `app/contatos/page.tsx`, `app/contatos/actions.ts` | a lista de tipos vem da constante |
| `tests/vocabulario-da-fila.test.ts` (criar) | o portão de varredura |
| `testes-integracao/pulso-do-inicio.integracao.ts` | o caso do `sent7` corrigido |

---

## Tarefa 1: as quatro definições ganham dono

**Arquivos:** modificar `lib/envio-filters.ts` e `lib/event-filters.ts`;
testar em `tests/envio-filters.test.ts` e `tests/event-filters.test.ts` (os dois
já existem — confira o nome real antes de escrever).

**Produz:**
- `KIND_PUBLICACAO: "publicacao"`
- `KINDS_FORA_DA_ENTREGA_DO_MOTOR: readonly string[]`
- `STATUS_DE_FILA_VIVA: readonly ["pending", "guardado"]`
- `TIPOS_DE_MENSAGEM_RECEBIDA: readonly ["message","story_reply","quick_reply","abertura"]`

- [ ] **Passo 1: escrever os casos que falham**

Em `tests/envio-filters.test.ts`:

```ts
describe("o vocabulário que o SQL consome", () => {
  it("publicação está FORA da conta de entrega do motor, junto com os manuais", () => {
    // O defeito que este vocabulário fecha: /desempenho dizia "Mensagens
    // entregues: 5" com 3 entregues pelo motor — os outros dois eram POSTS.
    expect([...KINDS_FORA_DA_ENTREGA_DO_MOTOR]).toEqual(["dm_manual", "publicacao"]);
  });

  it("a lista DERIVA de KINDS_MANUAIS, e não o repete", () => {
    // Se alguém acrescentar um kind manual novo, ele tem de entrar aqui
    // sozinho. Duas listas escritas à mão são duas listas que vão divergir.
    for (const k of KINDS_MANUAIS) {
      expect(KINDS_FORA_DA_ENTREGA_DO_MOTOR).toContain(k);
    }
  });

  it("fila viva é `pending` E `guardado`", () => {
    // `guardado` é o lote que espera a pessoa voltar a falar
    // (migrations/009). Contar só `pending` faz a tela dizer "fila vazia" com
    // 111 itens esperando — foi o defeito do Início em 14/09.
    expect([...STATUS_DE_FILA_VIVA]).toEqual(["pending", "guardado"]);
  });

  it("todo status de fila viva é um status que a tabela aceita", () => {
    // A rede contra escrever um status que o `check` da tabela recusaria: a
    // lista de SITUACOES já cobre exatamente o `check (status in (...))`.
    const conhecidos = SITUACOES.map((s) => s.key);
    for (const s of STATUS_DE_FILA_VIVA) expect(conhecidos).toContain(s);
  });
});
```

Em `tests/event-filters.test.ts`:

```ts
describe("TIPOS_DE_MENSAGEM_RECEBIDA", () => {
  it("são os quatro que o motor grava quando alguém fala", () => {
    expect([...TIPOS_DE_MENSAGEM_RECEBIDA]).toEqual([
      "message",
      "story_reply",
      "quick_reply",
      "abertura",
    ]);
  });

  it("não inclui `comment` nem `error`", () => {
    // Comentário não é mensagem — ele tem contagem própria na tela. `error` não
    // é coisa que alguém falou.
    expect(TIPOS_DE_MENSAGEM_RECEBIDA as readonly string[]).not.toContain("comment");
    expect(TIPOS_DE_MENSAGEM_RECEBIDA as readonly string[]).not.toContain("error");
  });

  it("todo tipo daqui é um tipo consultável", () => {
    // Um tipo que não estivesse em EVENT_TYPES seria um `where type = ...` que
    // nunca casa com nada — e nenhuma tela acusaria.
    for (const t of TIPOS_DE_MENSAGEM_RECEBIDA) {
      expect(EVENT_TYPES as readonly string[]).toContain(t);
    }
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run tests/envio-filters.test.ts tests/event-filters.test.ts`
Esperado: FALHA por nome não exportado.

- [ ] **Passo 3: implementar**

Em `lib/envio-filters.ts`, logo depois de `origemDoKind`:

```ts
/**
 * O `kind` da PUBLICAÇÃO, e ele merece nome porque é a exceção mais repetida
 * deste produto: publicação usa a mesma fila das mensagens e não é mensagem.
 *
 * O dreno já o separa, com o motivo escrito (`lib/queue-drain.ts`): um post não
 * pode comer a cota de DM. As telas precisam da mesma separação por outro
 * motivo — "mensagens entregues" com post dentro é um número que mente sobre a
 * saúde do motor.
 */
export const KIND_PUBLICACAO = "publicacao";

/**
 * OS KINDS QUE NÃO CONTAM COMO "O MOTOR ENTREGOU".
 *
 * Duas exclusões, por dois motivos diferentes:
 *
 * `dm_manual` é o que UMA PESSOA digitou na tela de conversa
 * (`enqueueManualReply`), e ele passa pela MESMA fila — de propósito, para
 * herdar a trava, o teto por hora e a checagem de janela. Contá-lo como entrega
 * do motor faz a tela dizer que está tudo rodando quando quem está rodando é
 * gente. Medido em 15/09: era exatamente esse o risco no pulso do Início.
 *
 * `publicacao` é post, não mensagem — ver `KIND_PUBLICACAO`. Medido no mesmo
 * dia: `/desempenho` dizia "Mensagens entregues: 5" com 3 entregues.
 *
 * DERIVADA DE `KINDS_MANUAIS`, e não reescrita: um kind manual novo entra aqui
 * sozinho no dia em que nascer.
 */
export const KINDS_FORA_DA_ENTREGA_DO_MOTOR = [
  ...KINDS_MANUAIS,
  KIND_PUBLICACAO,
] as const;

/**
 * OS STATUS EM QUE UM ITEM AINDA VAI SAIR — a "fila viva".
 *
 * `guardado` é o envio em lote que espera a pessoa voltar a falar
 * (`migrations/009-fila-estado-guardado.sql`). Ele ainda vai sair; só não por
 * conta do relógio. Uma contagem de fila que o ignore faz a tela anunciar "fila
 * vazia" com itens esperando — e foi o que o Início fez até 15/09/2026,
 * enquanto `/desempenho`, na mesma base, já contava os dois.
 */
export const STATUS_DE_FILA_VIVA = ["pending", "guardado"] as const;
```

Em `lib/event-filters.ts`, logo depois de `EVENT_TYPES`:

```ts
/**
 * OS TIPOS DE EVENTO QUE SIGNIFICAM "ALGUÉM FALOU COM A CONTA".
 *
 * São QUATRO, e o motor grava os quatro: `message` é a DM comum, `story_reply`
 * é a resposta a um story, `quick_reply` é o toque num botão, e `abertura` é a
 * resposta a uma pergunta de abertura (`lib/engine.ts`).
 *
 * ESTA LISTA EXISTIA EM TRÊS LUGARES até 15/09/2026 — `app/contatos/page.tsx`,
 * `app/contatos/actions.ts` e `app/page.tsx` —, e o terceiro nasceu errado, com
 * `type = 'message'` só. Medido: 14 `story_reply` numa semana. Num dia calmo
 * com só uma, a tela escrevia "nada aconteceu nas últimas 24h" — e "nada
 * aconteceu" é a frase que faz a pessoa decidir não olhar.
 *
 * `comment` fica de fora porque comentário tem contagem própria em toda tela
 * que os separa; `error` fica de fora porque não é coisa que alguém falou.
 */
export const TIPOS_DE_MENSAGEM_RECEBIDA = [
  "message",
  "story_reply",
  "quick_reply",
  "abertura",
] as const;
```

- [ ] **Passo 4: rodar, plantar, commitar**

Rode os dois arquivos de teste — esperado: PASSA.
Plante: tire `KIND_PUBLICACAO` de `KINDS_FORA_DA_ENTREGA_DO_MOTOR` → o primeiro
caso fica vermelho. Desfaça depois de commitar.
Rode `npx tsc --noEmit` e `npx vitest run`, e commite.

---

## Tarefa 2: as telas param de reescrever, e o número errado conserta

**Arquivos:** `app/page.tsx`, `app/desempenho/page.tsx`, `app/contatos/page.tsx`,
`app/contatos/actions.ts`; caso novo em
`testes-integracao/pulso-do-inicio.integracao.ts`.

**Consome:** as quatro constantes da Tarefa 1.

- [ ] **Passo 1: o caso que prova o defeito ativo**

Acrescente ao FIM do `describe` de `testes-integracao/pulso-do-inicio.integracao.ts`.
Os ajudantes já existem no arquivo: `semear({kind, status, sentAt?})`,
`limparAFila()` e `arvoreDoPainel()`.

```ts
  // =========================================================================
  // CASO 6 — "N MENSAGENS ENTREGUES" NÃO CONTA POST PUBLICADO.
  //
  // O DEFEITO, medido em produção em 15/09/2026: `/desempenho` dizia "Mensagens
  // entregues: 5" e o motor tinha entregue 3 — os outros dois eram POSTS. A
  // MESMA subconsulta (`sent7`) alimenta o estado calmo do Início, que é onde
  // este caso a lê, porque o Início é a tela que esta suíte já sabe renderizar.
  //
  // O ESTADO CALMO É A PORTA: a frase "N mensagens entregues em 7 dias" só
  // aparece quando nada precisa do dono — por isso este caso limpa a fila
  // antes e não semeia conversa esperando.
  // =========================================================================
  test("`N mensagens entregues` conta o motor, e não o post publicado", async () => {
    await limparAFila();
    await semear({ kind: "dm_link", status: "sent" });
    await semear({ kind: "publicacao", status: "sent" });

    const painel = await arvoreDoPainel();

    // UM, e não dois: o post entregue não é uma mensagem entregue.
    expect(painel).toContain("1 mensagem entregue");
    // A ASSERÇÃO NEGATIVA NÃO É ENFEITE: sem ela, uma frase que dissesse "2
    // mensagens entregues" e por acaso contivesse o texto acima passaria. Ela
    // é o que separa "contou certo" de "contou errado e a substring casou".
    expect(painel).not.toContain("2 mensagens entregues");
  });
```

**Se a frase do estado calmo não for exatamente "1 mensagem entregue"**, leia
`app/page.tsx` e afirme o texto REAL — nunca mude a tela para caber no teste. E
registre no relatório qual era a frase.

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run --config vitest.integracao.config.ts testes-integracao/pulso-do-inicio.integracao.ts`
Esperado: FALHA — hoje a tela diria "2 mensagens entregues".

- [ ] **Passo 3: trocar as consultas**

Em `app/page.tsx`:
- `sent7` ganha `and not (kind = any($N::text[]))` com `KINDS_FORA_DA_ENTREGA_DO_MOTOR`
- as subconsultas do pulso que hoje escrevem `not (kind = any($4::text[])) and kind <> 'publicacao'` passam a usar a constante única
- `na_fila` passa a usar `STATUS_DE_FILA_VIVA` por parâmetro
- `msg24` passa a usar `TIPOS_DE_MENSAGEM_RECEBIDA` por parâmetro

Em `app/desempenho/page.tsx`:
- `sent7` e `sent_prev7` ganham a mesma exclusão
- `pending` passa a usar `STATUS_DE_FILA_VIVA`

Em `app/contatos/page.tsx` e `app/contatos/actions.ts`:
- a lista de quatro tipos passa a vir de `TIPOS_DE_MENSAGEM_RECEBIDA`

**ATENÇÃO À NUMERAÇÃO DOS PARÂMETROS:** `app/page.tsx` já usa `$1..$4`. Um `$N`
trocado grava a coisa certa no lugar errado e o `tsc` não pega. Confira cada
subconsulta contra o array de valores, uma a uma, depois de mexer.

- [ ] **Passo 4: rodar tudo**

`npx tsc --noEmit`, `npx vitest run`, o de integração acima, e
`npm run test:integracao` inteiro — as telas de contatos têm casos próprios que
podem depender da lista antiga.

- [ ] **Passo 5: plantar**

Tire a exclusão do `sent7` de `app/page.tsx` → o caso do Passo 1 fica vermelho.
Desfaça depois de commitar.

- [ ] **Passo 6: commitar**

---

## Tarefa 3: o portão de varredura

**Arquivos:** criar `tests/vocabulario-da-fila.test.ts`.

**A ideia, e ela é a mesma de `tests/escala.test.ts`:** varrer `app/**` e
reprovar quem escrever à mão um valor que já tem dono em `lib/`.

- [ ] **Passo 1: escrever o portão**

Ele varre os arquivos de `app/`, **tira comentários antes de olhar** (a mesma
função `semComentarios` de `tests/escala.test.ts` — copie-a com crédito, ou
extraia-a; decida e escreva o porquê), e procura os literais proibidos dentro de
texto que parece SQL.

**OS LITERAIS VIGIADOS:** `'dm_manual'`, `'guardado'`, `'story_reply'`,
`'quick_reply'`, `'abertura'`.

**AS EXCEÇÕES, DECLARADAS — e sem elas o portão reprova código correto:**

- **`app/publicar/**`** e **`app/labels.ts`** podem escrever `'publicacao'`: ali
  ele é o ASSUNTO da tela, não uma regra de exclusão. Por isso `'publicacao'`
  **não entra** na lista vigiada — ele é comum demais como assunto legítimo, e um
  portão que reprova código certo é um portão que alguém desliga. O que protege
  o `sent7` é o caso de integração da Tarefa 2.
- **`app/labels.ts`** mapeia `kind` e `status` para rótulo: é a tabela de
  tradução, e escrever os valores ali é o trabalho dela.
- **`lib/`** inteiro fica fora: é lá que as definições moram.

Escreva as exceções como lista nomeada no topo, com o motivo de cada uma — o
padrão de `FORA_DA_VARREDURA` em `tests/escala.test.ts`.

- [ ] **Passo 2: a contraprova**

Um portão que não acusa nada não mede nada. O arquivo tem de ter:
- um caso que passa uma string com `'dm_manual'` dentro de SQL e exige que o
  verificador ACUSE
- um caso que passa o mesmo valor dentro de comentário e exige que ele NÃO acuse
- um caso que varre a árvore de verdade e exige zero achados

- [ ] **Passo 3: rodar contra a árvore**

Se acusar algo que a Tarefa 2 deveria ter consertado, conserte. Se acusar código
correto, a exceção está faltando — acrescente-a **com o motivo escrito**, nunca
em silêncio.

- [ ] **Passo 4: plantar**

Escreva `and kind = 'dm_manual'` numa consulta qualquer de `app/` → o portão fica
vermelho. Desfaça.

- [ ] **Passo 5: commitar**

---

## Fechamento

- [ ] `npx tsc --noEmit`, `npx vitest run`, `npm run test:integracao`, `npx next build`
- [ ] Conferir na prévia: `/desempenho` diz **"Mensagens entregues: 3"**, e não 5
- [ ] Atualizar `.superpowers/sdd/progress.md`

## O que este plano NÃO faz, declarado

**Não unifica `sent7` entre o Início e o Desempenho.** As duas telas continuam
com a consulta própria; o que passa a ser comum é a DEFINIÇÃO de quais kinds
contam. Unificar a consulta exigiria um módulo de leitura que nenhuma das duas
telas pediu, e as janelas delas já diferem (7 dias contra 7 e 14).

**Não vigia `'publicacao'`** — a razão está na Tarefa 3, Passo 1.
