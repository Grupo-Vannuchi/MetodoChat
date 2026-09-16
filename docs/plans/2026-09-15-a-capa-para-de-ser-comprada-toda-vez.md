# A capa para de ser comprada toda vez — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`.

**Objetivo:** as quatro telas que mostram post pagam **9 chamadas à Meta e ~1,5 s
a cada carregamento**, sempre as mesmas. Guardar o resultado por um tempo que é
muito menor do que o prazo de validade da miniatura — e, com a repetição barata,
deixar de mostrar capa só para "os recentes + 8".

**Sem spec separada:** é dívida declarada, medida, com o alvo já nomeado. Esta
seção faz o papel da spec.

---

## Por que existe

### Medido em 15/09/2026, contra a produção

Contra a conta real, cronometrando as chamadas que `/automacoes` faz num render:

| chamada | tempo | quantas |
|---|---|---|
| `getMedia(limit=40)` | **999 ms** | 1 |
| buscas avulsas, em paralelo | **509 ms** | 8 |

**~1,5 s e 9 chamadas por carregamento.** Bate com a medição de fora, na
produção: `/automacoes` carrega em **2,3–2,8 s** contra **1,07 s** do Início, que
resolve no máximo 3 posts.

E isso **se repete a cada `revalidatePath("/automacoes")`** — salvar, ativar,
pausar, duplicar, excluir. Quatro telas chamam `resolvePosts`: Início,
`/automacoes`, `/automacoes/[id]` e `/eventos`. `/api/media` (o seletor de post)
chama `getMedia` direto.

### O segundo fato, que é o que a pessoa vê

**21 das 27** automações com post apontam para post FORA dos 40 recentes. O teto
`MAX_INDIVIDUAL_LOOKUPS = 8` deixa 13 delas sem capa **para sempre** — e o teto
existe exatamente porque cada busca custa caro. Barateando a repetição, o teto
deixa de ser necessário no tamanho em que está.

### O prazo de validade dá a folga

A URL de miniatura do CDN do Instagram expira em ~2 semanas (medido em 15/09: a
de 14/09 devolvia 200; as de 31/08 e 24/08, 403). Qualquer vida de cache medida
em minutos ou horas está ordens de grandeza abaixo disso — guardar por 6 h o que
vale 2 semanas não inventa risco novo.

---

## A decisão de desenho, e o que a sustenta

### O cache vai na camada semântica, NÃO no `fetch`

`export const dynamic = "force-dynamic"` — que as quatro telas usam — faz TODO
`fetch` da página virar `no-store`. Pôr `cache: "force-cache"` dentro de
`graphFetch` (lib/ig.ts) seria **silenciosamente anulado**: o código pareceria
certo e não guardaria nada. Além disso `graphFetch` é o caminho de ENVIO, e
semântica de cache não tem o que fazer lá.

### E `unstable_cache` SOBREVIVE ao `force-dynamic` — lido na fonte, não na doc

A doc diz que `force-dynamic` "equivale a `fetchCache = 'force-no-store'`". Isso
é verdade para `fetch`, e **não** para `unstable_cache`. Na versão instalada
(Next **16.2.10**):

- `node_modules/next/dist/server/app-render/create-component-tree.js:151` —
  `dynamic === 'force-dynamic'` seta **só** `workStore.forceDynamic = true`.
- `node_modules/next/dist/server/web/spec-extension/unstable-cache.js:146` — o
  ramo que LÊ do cache pergunta `workStore.fetchCache !== 'force-no-store'` e
  **nunca** olha `forceDynamic`.
- `node_modules/next/dist/server/lib/patch-fetch.js:353` — é o `fetch` que trata
  `workStore.forceDynamic` à parte. Por isso os dois se comportam diferente.

**Nenhuma tela deste projeto declara `fetchCache`.** Conferir com
`grep -rn "fetchCache" app/` antes de implementar: se algum dia alguém declarar
`fetchCache = 'force-no-store'` numa dessas telas, o cache morre calado.

### Por que `unstable_cache` e não `use cache`

`use cache` (Next 16) exige `cacheComponents: true`, que é migração de aplicação
inteira — todo acesso dinâmico precisa ir para trás de `Suspense`. Esta base é
`force-dynamic` em tudo e está em produção com usuário real. `unstable_cache`
continua documentado no guia
`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`
e é a mudança de raio pequeno. **Declarado como dívida:** quando a migração para
Cache Components acontecer, estas duas funções são o primeiro lugar a trocar.

### O token NÃO entra na chave

`unstable_cache` monta a chave com os ARGUMENTOS mais `keyParts`. O token passa
por **fechamento**, fora dos dois, e isso é deliberado por dois motivos:

1. O token **não é parte da identidade** de "os 40 posts recentes da conta X".
2. Ele é renovado a cada ~60 dias; na chave, a renovação jogaria fora o cache
   inteiro sem que nada tivesse mudado — e poria um segredo num lugar que
   persiste entre implantações.

A doc avisa que fechamentos usados dentro da função devem ir em `keyParts` "se
não forem passados como parâmetro". Aqui a omissão é a escolha certa **porque o
token não distingue um resultado do outro** — e é isso que o comentário no
código precisa dizer, para ninguém "consertar" depois.

### Duas vidas, e cada uma tem um motivo

| o quê | vida | por quê |
|---|---|---|
| lista dos 40 recentes | **120 s** | é o que alimenta o seletor de post; quem acabou de publicar precisa ver o post ali. Dois minutos é o máximo de mentira tolerável. |
| um post pelo id | **6 h** | post antigo não muda. A miniatura vale ~2 semanas, então 6 h fica muito abaixo do prazo. |

---

## Restrições globais

- A chamada à Meta **nunca no caminho crítico**: `resolvePosts` já tem
  `try/catch` interno e devolve mapa parcial ou vazio. Sem capa, a tela
  renderiza inteira.
- `TETO_DA_LEITURA_MS` (lib/ig.ts) continua valendo: o cache não substitui o teto
  de tempo, ele reduz quantas vezes o teto é exercitado.
- Nenhuma migração, nenhuma coluna nova.
- Comentário em português explicando **por quê**, com o `arquivo:linha` do Next
  citado literalmente onde a decisão depende dele.
- Antes de cada commit: `npx tsc --noEmit` e `npx vitest run`.

---

## Tarefa 1: a camada que guarda, e o guarda que avisa quando ela morrer

**Arquivos:** modificar `lib/media-lookup.ts`; criar `tests/cache-da-capa.test.ts`.

**Interfaces produzidas:**
- `export const VIDA_DA_LISTA_S = 120`
- `export const VIDA_DO_POST_S = 21600`
- `resolvePosts(igUserId, token, mediaIds)` — assinatura **inalterada**.

- [ ] **Passo 1: o guarda, que é o caso que só falha no futuro**

Crie `tests/cache-da-capa.test.ts`. O primeiro caso NÃO testa o nosso código:
ele trava o fato do Next em que o desenho se apoia.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// O DESENHO DESTE CACHE SE APOIA NUM FATO DA FONTE DO NEXT, e não na doc dele.
//
// A doc diz que `dynamic = "force-dynamic"` equivale a
// `fetchCache = 'force-no-store'`. Se isso valesse para `unstable_cache`, o
// cache das capas não guardaria NADA em producao — as quatro telas sao
// `force-dynamic` — e ninguem perceberia: a tela continuaria certa, so lenta.
//
// MEDIDO na fonte do Next 16.2.10: `unstable_cache` so desiste quando
// `workStore.fetchCache === 'force-no-store'`, e NUNCA olha
// `workStore.forceDynamic`, que e o unico campo que `force-dynamic` seta
// (create-component-tree.js:151). Quem trata `forceDynamic` e o `fetch`,
// noutro arquivo (patch-fetch.js:353).
//
// ESTE CASO EXISTE PARA MORRER EM VERMELHO numa atualizacao do Next que junte
// os dois. Sem ele, a juncao viraria uma perda de desempenho silenciosa.
const FONTE = "node_modules/next/dist/server/web/spec-extension/unstable-cache.js";

describe("o fato do Next em que este cache se apoia", () => {
  const fonte = readFileSync(FONTE, "utf8");

  test("o ramo que LE do cache existe e pergunta por `fetchCache`", () => {
    expect(fonte).toContain("workStore.fetchCache !== 'force-no-store'");
  });

  test("o ramo que LE do cache NAO consulta `forceDynamic`", () => {
    // Recorte generoso ao redor da condicao, para pegar uma consulta
    // acrescentada perto dela.
    const i = fonte.indexOf("workStore.fetchCache !== 'force-no-store'");
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i - 600, i + 600);
    expect(trecho).not.toContain("forceDynamic");
  });
});
```

- [ ] **Passo 2: rodar e ver PASSAR**

`npx vitest run tests/cache-da-capa.test.ts`
Esperado: **PASSA** — é um guarda, e o fato vale hoje.

**Plante para provar que ele mede:** troque `forceDynamic` por `fetchCache` na
última asserção; ela fica vermelha. Desfaça.

- [ ] **Passo 3: o caso que falha, sobre o nosso código**

Acrescente ao mesmo arquivo. O que se mede aqui é **a chave**, que é onde o
defeito de segurança moraria:

```ts
import { chaveDaLista, chaveDoPost, VIDA_DA_LISTA_S, VIDA_DO_POST_S } from "@/lib/media-lookup";

const TOKEN = "IGQVJXtoken-que-nao-pode-vazar-para-lugar-nenhum";

describe("a chave do cache", () => {
  test("a lista e por conta, e o token NAO entra", () => {
    const k = chaveDaLista("17900000000000901");
    expect(k).toContain("17900000000000901");
    expect(k.join("|")).not.toContain(TOKEN);
    expect(k.join("|")).not.toContain("token");
  });

  test("o post e por id, e o token NAO entra", () => {
    const k = chaveDoPost("17900000000000002");
    expect(k).toContain("17900000000000002");
    expect(k.join("|")).not.toContain(TOKEN);
  });

  test("duas contas nunca compartilham chave", () => {
    expect(chaveDaLista("111")).not.toEqual(chaveDaLista("222"));
  });

  test("as vidas ficam MUITO abaixo do prazo da miniatura (~2 semanas)", () => {
    // Medido em 15/09/2026: URL de 14/09 -> 200; de 31/08 e 24/08 -> 403.
    const DUAS_SEMANAS_S = 14 * 24 * 3600;
    expect(VIDA_DA_LISTA_S).toBeLessThan(DUAS_SEMANAS_S / 100);
    expect(VIDA_DO_POST_S).toBeLessThan(DUAS_SEMANAS_S / 10);
  });
});
```

- [ ] **Passo 4: rodar e ver falhar**

Esperado: FALHA — `chaveDaLista` / `chaveDoPost` / as duas constantes não existem.

- [ ] **Passo 5: implementar**

Em `lib/media-lookup.ts`:

```ts
import { unstable_cache } from "next/cache";
```

Acrescente as constantes, as duas funções de chave (exportadas, porque é o que o
teste mede) e os dois embrulhos. As chaves:

```ts
export function chaveDaLista(igUserId: string): string[] {
  return ["ig", "lista-recente", igUserId];
}
export function chaveDoPost(mediaId: string): string[] {
  return ["ig", "post", mediaId];
}
```

Os embrulhos são criados **por chamada**, com o token no fechamento:

```ts
function listaRecenteCacheada(igUserId: string, token: string) {
  return unstable_cache(
    () => getMedia(igUserId, token, RECENT_MEDIA_LIMIT),
    chaveDaLista(igUserId),
    { revalidate: VIDA_DA_LISTA_S, tags: [`ig:lista:${igUserId}`] }
  )();
}
```

e o análogo para `getMediaById` com `chaveDoPost(id)`, `VIDA_DO_POST_S` e a tag
`ig:post:${id}`.

`resolvePosts` troca as duas chamadas cruas pelas cacheadas. **Nada mais muda**:
os `try/catch` e o `Promise.allSettled` ficam onde estão — uma chamada que falha
não deve gravar a falha no cache, e `unstable_cache` não grava o que lançou.

O comentário obrigatório acima do bloco, em português, cobrindo: (a) por que o
cache não pode ficar no `fetch` (`force-dynamic` o anularia); (b) por que ele
SOBREVIVE no `unstable_cache`, com os três `arquivo:linha` do Next; (c) por que
o token fica FORA da chave; (d) as duas vidas e o porquê de cada número; (e) que
sob o vitest `unstable_cache` chama direto, sem guardar — **medido em 15/09**,
então nenhum teste desta base prova que o cache guarda, e a prova é a medição em
produção registrada no fechamento deste plano.

- [ ] **Passo 6: rodar, plantar, commitar**

Rode o arquivo — esperado: PASSA.
Plante: ponha o token em `chaveDaLista` → o caso do token fica vermelho.
Plante: `VIDA_DO_POST_S = 30 * 24 * 3600` → o caso do prazo fica vermelho.
`npx tsc --noEmit`, `npx vitest run`, e commite.

---

## Tarefa 2: o teto de buscas avulsas para de ser "recentes + 8"

**Arquivos:** modificar `lib/media-lookup.ts`; acrescentar caso em
`testes-integracao/capa-do-post.integracao.ts`.

**Consome da Tarefa 1:** os dois embrulhos cacheados.

- [ ] **Passo 1: o caso que falha, com servidor de verdade contando**

O padrão de servidor HTTP local com `IG_GRAPH_BASE` está em
`testes-integracao/teto-da-meta.integracao.ts` (leia o cabeçalho: as duas travas
de `baseDoGraph` e por que não há mock). Aqui ele serve para **contar
requisições**.

```ts
test("resolvePosts busca alem dos 8 antigos, e respeita o teto novo", async () => {
  // O QUE ISTO MEDE: a FORMA das chamadas -- uma listagem mais N avulsas --,
  // e nao o cache do Next, que sob o vitest nao guarda nada (medido em
  // 15/09/2026, dentro e fora de `comoNumaRequisicao`).
  //
  // O DEFEITO QUE ELE PRENDE: em 15/09, 21 das 27 automacoes apontavam para
  // post fora dos 40 recentes e o teto de 8 deixava 13 SEM CAPA para sempre.
  // O teto existia porque cada busca custava ~500ms; com a repeticao barata,
  // ele passa a existir so contra lista patologica.
  const pedidos = await contarPedidos(async () => {
    await resolvePosts(CONTA, TOKEN, idsDeTeste(20)); // nenhum nos "recentes"
  });
  expect(pedidos.listagens).toBe(1);
  expect(pedidos.avulsas).toBe(20);
});

test("o teto ainda existe, contra lista patologica", async () => {
  const pedidos = await contarPedidos(async () => {
    await resolvePosts(CONTA, TOKEN, idsDeTeste(100));
  });
  expect(pedidos.avulsas).toBe(MAX_INDIVIDUAL_LOOKUPS);
});
```

O implementador escreve `contarPedidos` e `idsDeTeste` seguindo o servidor de
`teto-da-meta.integracao.ts`. O servidor responde `{"data":[]}` para a listagem
e `{"id":"..."}` para a busca avulsa, e conta cada rota. **Não invente
maquinaria nova.**

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run --config vitest.integracao.config.ts testes-integracao/capa-do-post.integracao.ts
```
Esperado: FALHA — hoje `avulsas` para em 8.

- [ ] **Passo 3: implementar**

Em `lib/media-lookup.ts`, `MAX_INDIVIDUAL_LOOKUPS` passa de `8` para **`32`** e
é **exportado** (o teste o usa). O comentário passa a dizer o que o número é
agora: **não** um teto de custo por chamada — com o cache, a repetição é de
graça —, e sim um teto contra lista patológica. Trinta e dois cobre as 27 de
hoje com folga, e 32 buscas em paralelo, uma vez a cada 6 h, é o mesmo perfil de
rede que 8 a cada carregamento — **muito menos**, na verdade.

Registre no comentário a medição de 15/09: 8 avulsas em paralelo = 509 ms.

- [ ] **Passo 4: rodar, plantar, commitar**

Plante: volte o teto para 8 → o primeiro caso fica vermelho.
Plante: tire o `.slice` → o segundo caso fica vermelho.
`npx tsc --noEmit`, `npx vitest run`, integração, `npx next build`, e commite.

---

## Fechamento

- [ ] `npx tsc --noEmit`, `npx vitest run`, `npm run varredura`
- [ ] Integração no container (`npm run banco:teste` antes) **e** a rodada sem
      `DATABASE_URL_TESTES` (as duas provas do `public` de produção)
- [ ] `npx next build`
- [ ] `grep -rn "fetchCache" app/` — precisa continuar sem nenhuma ocorrência
- [ ] **A PROVA QUE VALE, e ela é em produção.** Nenhum teste desta base prova
      que o cache guarda. Depois do deploy, medir `/automacoes` três vezes
      seguidas no navegador. **Linha de base de 15/09, ANTES: 2,83 s / 2,34 s /
      2,31 s.** Esperado DEPOIS: a primeira parecida, e as seguintes perto de
      1 s — a diferença é exatamente o 1,5 s da Meta que deixou de ser pago.
      Se as três continuarem em 2,3 s, **o cache não está guardando** e o
      desfecho certo é dizer isso, não declarar vitória.
- [ ] Conferir que `/automacoes` mostra MAIS capas do que as 14 de hoje
- [ ] Atualizar `.superpowers/sdd/progress.md`

## Declarado

**Nenhum teste desta base prova que o cache guarda.** Medido em 15/09/2026:
`unstable_cache` não guarda nada sob o vitest — nem entre duas
`comoNumaRequisicao`, nem dentro da mesma (o harness monta um `IncrementalCache`
novo por requisição, com `maxMemoryCacheSize: 0`). Um teste que afirmasse o
contrário passaria verde medindo o nada, que é o pior defeito possível num
instrumento. O que esta branch prende é: o fato do Next (guarda), a chave (sem
token), as vidas (abaixo do prazo) e a forma das chamadas (contador de
requisições). O resto é a medição em produção, acima.

**Nada é invalidado por evento.** Publicar um post pelo painel não derruba o
cache da listagem: o post aparece no seletor em até 120 s. Fazer melhor custaria
um `revalidateTag` no dreno, e 120 s de atraso não justifica a amarração agora.

**`/api/media` NÃO entra nesta branch.** O seletor de post chama `getMedia`
direto, fora de `resolvePosts`. Passá-lo pelo cache é uma linha, mas ele é
justamente a tela onde a listagem precisa estar fresca — decidir isso merece
medição própria, e não carona.

**A migração para Cache Components continua em aberto.** `unstable_cache` está
marcado como substituído por `use cache` na versão instalada. Quando a migração
acontecer, estas duas funções são o primeiro lugar a trocar.
