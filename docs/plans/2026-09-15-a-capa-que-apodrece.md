# A capa do post para de apodrecer — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`.

**Objetivo:** `/automacoes` mostra 19 imagens quebradas de 22. Parar de ler do
banco uma URL que expira, e resolvê-la na hora de exibir — como o próprio
repositório já decidiu e já implementou em outro lugar.

**Sem spec separada:** é conserto de defeito medido, com a solução já escrita no
repositório. A seção abaixo faz o papel da spec.

---

## Por que existe

### Medido em produção, 15/09/2026

Na tela de `/automacoes`, agora: **22 imagens, 19 quebradas** (`naturalWidth === 0`).
As três que carregam são de 14/09 e 15/09.

Buscando as URLs guardadas direto do banco:

| automação criada em | HTTP |
|---|---|
| 14/09 | **200** |
| 31/08 | **403** |
| 24/08 | **403** |

As 26 automações com post guardam miniatura **e** legenda no banco. As URLs de
miniatura do CDN do Instagram são assinadas e expiram em ~2 semanas.

### O repositório já sabia, e já tinha resolvido em outro lugar

`lib/media-lookup.ts`, primeira linha do cabeçalho:

> *"Capa e link do post ficam SÓ aqui, buscados na hora de exibir — nunca no
> banco. As URLs de miniatura do CDN do Instagram expiram, então um link salvo
> vira imagem quebrada semanas depois."*

`/eventos` segue essa política e não tem imagem quebrada. `/automacoes` e o
editor leem a coluna e têm.

### E a auditoria apontou, e eu descartei

O documento de 10/09 lista, entre os **meus** erros: *"'Miniaturas não carregam'
em /automacoes — só existe uma imagem na tela e ela carregou. Os quadrados
cinza são outra coisa."* Ela estava certa. Eu olhei num dia em que a automação
mais recente tinha URL fresca e concluí que o resto não era imagem.

### A decisão: guardar o que não apodrece, resolver o que apodrece

- **`media_caption` FICA guardada.** Legenda não expira, e ela é o nome que a
  pessoa reconhece. Serve de recuo quando a busca na Meta não alcançar o post.
- **`media_thumbnail_url` SAI** — deixa de ser lida e deixa de ser gravada. Uma
  coluna que guarda algo com prazo de validade é uma coluna que mente com o
  tempo, e o fato de ela parecer preenchida é o que esconde o problema.

### Escopo: só post, e o motivo é medido

`story_thumbnail_url` fica como está: **zero automações usam story** (26 com
post, 0 com story, de 27). Story some do Instagram em 24h de qualquer jeito —
mexer nisso seria escrever código que nunca renderizou uma linha.

---

## Restrições globais

- A chamada à Meta **nunca no caminho crítico**: `resolvePosts` já tem
  `try/catch` interno e devolve mapa parcial ou vazio. Sem capa, a tela
  renderiza inteira.
- Toda consulta leva `account_id`.
- Nenhuma migração: a coluna continua existindo, só deixa de ser usada.
- Comentário em português explicando **por quê**.
- Antes de cada commit: `npx tsc --noEmit` e `npx vitest run`.

---

## Tarefa 1: a lista de automações resolve a capa na hora

**Arquivos:** modificar `app/automacoes/page.tsx`; testar em
`testes-integracao/capa-do-post.integracao.ts` (criar).

- [ ] **Passo 1: o caso que falha**

Crie `testes-integracao/capa-do-post.integracao.ts`. Ele semeia uma automação
com `media_thumbnail_url` **podre** (uma URL que nunca vai carregar) e exige que
essa URL **não apareça** na árvore da tela.

O padrão de renderizar tela e ler a árvore está em
`testes-integracao/nao-saiu.integracao.ts` (`comoNumaRequisicao` +
`textoDaArvore`). O harness é `bancoDescartavel()`.

```ts
const PODRE = "https://scontent.cdninstagram.com/v/expirada-ha-semanas.jpg";

test("a URL guardada no banco NÃO chega na tela", async () => {
  // A prova do defeito de 15/09/2026: 19 de 22 imagens quebradas em
  // /automacoes, porque a tela lia uma URL assinada que expira em ~2 semanas.
  // Este caso nao depende da Meta responder: ele exige que o valor PODRE do
  // banco nao seja usado. Se a busca na hora falhar, a tela fica sem capa --
  // que e o desfecho certo, e nao uma imagem quebrada.
  await semearAutomacao({ mediaId: "17900000000000001", thumb: PODRE, caption: "Carrossel de teste" });
  const arvore = await arvoreDasAutomacoes();
  expect(arvore).not.toContain(PODRE);
  // E o nome do post CONTINUA aparecendo, porque legenda nao apodrece:
  expect(arvore).toContain("Carrossel de teste");
});
```

O implementador escreve `semearAutomacao` e `arvoreDasAutomacoes` seguindo os
ajudantes dos arquivos vizinhos. **Não invente maquinaria nova.**

- [ ] **Passo 2: rodar e ver falhar**

`DATABASE_URL_TESTES=... npx vitest run --config vitest.integracao.config.ts testes-integracao/capa-do-post.integracao.ts`
Esperado: FALHA — hoje a URL podre está na árvore.

- [ ] **Passo 3: trocar a fonte da capa**

Em `app/automacoes/page.tsx`, hoje:

```ts
thumb: a.media_thumbnail_url ?? a.story_thumbnail_url ?? null,
```

Passa a: buscar na Meta os `media_id` das automações da lista, com
`resolvePosts(account.ig_user_id, account.access_token, ids)`, e usar
`mapa.get(a.media_id)?.thumb ?? null`. O `story_thumbnail_url` **continua vindo
do banco** — ver o escopo.

A chamada vai num `try/catch` que devolve `new Map()` no erro, com o comentário
dizendo que sem capa a tela serve e sem tela nada serve.

**A legenda ganha um recuo:** onde a lista mostrar o nome do post, use
`mapa.get(id)?.caption ?? a.media_caption ?? null` — o que veio da Meta primeiro,
o guardado depois. Legenda não expira, então o guardado é recuo honesto.

- [ ] **Passo 4: rodar, plantar, commitar**

Rode o caso — esperado: PASSA.
Plante: volte `thumb: a.media_thumbnail_url` → o caso fica vermelho.
`npx tsc --noEmit`, `npx vitest run`, `npx next build`, e commite.

---

## Tarefa 2: o editor idem, e a coluna podre deixa de ser gravada

**Arquivos:** modificar `app/automacoes/[id]/page.tsx` e
`app/automacoes/actions.ts`; acrescentar caso em
`testes-integracao/capa-do-post.integracao.ts`.

- [ ] **Passo 1: os casos que falham**

```ts
test("o editor não usa a URL guardada, e mostra a legenda", async () => {
  await semearAutomacao({ mediaId: "17900000000000002", thumb: PODRE, caption: "Carrossel Renner" });
  const arvore = await arvoreDoEditor(idDaAutomacao);
  expect(arvore).not.toContain(PODRE);
  expect(arvore).toContain("Carrossel Renner");
});

test("salvar NÃO grava mais a miniatura, e CONTINUA gravando a legenda", async () => {
  // A legenda fica porque nao expira e e o nome que a pessoa reconhece. A
  // miniatura sai porque uma coluna que guarda coisa com prazo de validade
  // mente com o tempo -- e parecer preenchida e o que esconde o problema.
  await salvarPelaAcao({ id: idDaAutomacao, post: { id: "17900000000000002", thumb: PODRE, caption: "Renner" } });
  const linha = await lerAutomacao(idDaAutomacao);
  expect(linha.media_thumbnail_url).toBeNull();
  expect(linha.media_caption).toBe("Renner");
  expect(linha.media_id).toBe("17900000000000002");
});
```

- [ ] **Passo 2: rodar e ver falhar**

- [ ] **Passo 3: implementar**

Em `app/automacoes/[id]/page.tsx`, a `configuracaoInicial` hoje faz:

```ts
post: a.media_id
  ? { id: a.media_id, thumb: a.media_thumbnail_url ?? "", caption: a.media_caption ?? "" }
  : null,
```

Passa a resolver pela Meta, com recuo para a legenda guardada:

```ts
post: a.media_id
  ? {
      id: a.media_id,
      thumb: doPost?.thumb ?? "",
      caption: doPost?.caption ?? a.media_caption ?? "",
    }
  : null,
```

onde `doPost` vem de `resolvePosts(...)` para o único `media_id` da tela, dentro
de `try/catch`.

**ISSO FECHA O SEGUNDO DEFEITO DE UMA VEZ:** a automação criada a partir do
Início (`/automacoes/nova?post=…`) grava só `media_id`. Hoje o editor abre com o
id numérico cru no lugar do nome, porque lê colunas vazias. Resolvendo na hora,
ela mostra a legenda como qualquer outra.

Em `app/automacoes/actions.ts`, na consulta de `salvarAutomacao`, o parâmetro de
`media_thumbnail_url` passa a ser `null` fixo — com o comentário dizendo por quê,
e que a coluna continua existindo para não exigir migração.

- [ ] **Passo 4: rodar, plantar, commitar**

Plante: volte a gravar `post?.thumb` → o caso de salvar fica vermelho.
Rode tudo e commite.

---

## Fechamento

- [ ] `npx tsc --noEmit`, `npx vitest run`, integração no container, **e** a
      rodada sem `DATABASE_URL_TESTES` (as duas provas do `public` de produção)
- [ ] `npx next build`
- [ ] Conferir na prévia: `/automacoes` sem imagem quebrada, e uma automação
      criada pelo Início abrindo o editor com a legenda no lugar do id
- [ ] Atualizar `.superpowers/sdd/progress.md`

## Declarado

**A coluna `media_thumbnail_url` não é apagada nem limpa.** Ela para de ser lida
e gravada; as 26 linhas com valor podre continuam lá. Apagar exigiria migração
para resolver um dado que ninguém mais olha — e migração é o tipo de mudança
que este plano não precisa ter.

**`/automacoes` NÃO passa a fazer uma chamada à Meta por carregamento** — essa
frase, escrita aqui antes de medir, é falsa. `resolvePosts`
(lib/media-lookup.ts) faz `getMedia(limit=40)` MAIS até
`MAX_INDIVIDUAL_LOOKUPS = 8` buscas avulsas para o que não estiver nos 40
recentes: até **9 chamadas por carregamento**, e isso se repete a cada
`revalidatePath("/automacoes")` (salvar, ativar, pausar, duplicar, excluir).
A consequência: automação apontando para post fora dos 40 recentes só resolve
capa nas 8 primeiras dessa sobra — a tela não vira "22 capas certas", vira
"recentes + 8". Mesma proteção e mesma dívida declarada do Início de qualquer
forma: sem timeout em `graphFetch`, o teto é o `try/catch`. Consertar na raiz
continua na lista.
