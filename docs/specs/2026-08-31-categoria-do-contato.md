# Categoria do contato — organizar 126 pessoas, e ver o alcance antes de precisar dele

**Nascido em:** 31/08/2026, do "Projeto B" adiado em 26/08 (*categoria e envio em
lote*). **Estado:** desenho aprovado, pronto para virar plano.

---

## O que foi medido, e como isso partiu o projeto em dois

O pedido original era **disparo em massa por categoria**. A medição de 26/08 já
tinha derrubado metade dele (109 contatos, 13 alcançáveis). Remedida hoje, com o
banco de produção:

| medida | valor |
|---|---|
| contatos | **126** |
| alcançáveis agora | **9 — 7,1%** |
| `@thiagovannuchi` | 106 contatos, **8** alcançáveis |
| `@n8xmarketing` | 8 contatos, **1** alcançável |
| `@vannuchi.eng` | 7 contatos, **0** |
| `@saas.metodoia` | 5 contatos, **0** |
| falaram na última 1h / 12h / 24h / 168h | 1 / 2 / 9 / 48 |

Três leituras, e cada uma mata uma premissa:

**Duas das quatro contas têm ZERO alcançáveis.** Um botão de "enviar em lote"
nelas manda para ninguém.

**O conjunto alcançável vira quase todo dia.** De 4 a 10 pessoas falam por dia, e
cada uma sai da janela 24 horas depois. Uma categoria com 40 pessoas nunca terá
40 alcançáveis ao mesmo tempo — nem perto.

**E a trava já existe.** `lib/queue-drain.ts` recusa todo item cujo contato esteja
fora da janela. Mandar para quem não pode receber **já é impossível**. O que
falta não é a trava: é o dono **saber o número antes de apertar o botão**.

### A decisão que saiu daí

O projeto foi partido em dois, e **só o primeiro é este documento**:

1. **Categoria** — etiquetar contatos vale sozinho: organizar 126 pessoas,
   filtrar, ver quem é aluno e quem é interessado. Sem restrição da Meta.
2. **Envio em lote** — fica para depois, com desenho próprio, **quando a
   categoria já existir e o número real de alcançáveis já estiver na tela há
   semanas**.

---

## O desenho

### 1 · Uma coluna, e mais nada

`migrations/007-categoria-do-contato.sql`:

```sql
alter table contacts add column if not exists categoria text;
```

Sem tabela nova, sem tela de administração, sem ciclo de vida próprio. **A lista
de categorias É o conjunto de valores distintos em uso** — nasce quando alguém
usa e some quando ninguém usa mais.

**RECUSADA a lista governada** (uma tela para criar e renomear categorias, e o
contato escolhendo entre elas). Ela impede nome solto e permite renomear em
massa — e custa uma tabela, uma tela e um caso novo ("o que acontece com os
contatos de uma categoria apagada"). Para 126 contatos e uma equipe pequena,
é máquina demais para governar cinco palavras.

### 2 · O nome é normalizado, e a regra é pura

`lib/categorias.ts`, novo:

```
normalizarCategoria(bruto: unknown): string | null
```

Apara as pontas, colapsa espaço repetido, passa para minúsculas, corta no
limite, e devolve `null` para vazio. `Aluno`, `aluno ` e `ALUNO` viram **a
mesma** categoria.

É isto que substitui a governança: sem normalizar, a lista apodrece em três
semanas e ninguém confia mais no filtro. Com normalizar, ela se governa sozinha.

### 3 · Marca-se na conversa, não na tabela

O campo vive em `app/conversas/[id]/page.tsx`, ao lado do nome da pessoa — a
página que já carrega o contato e já mostra o selo da janela.

**Por que não na lista:** marcar na tabela de contatos exigiria um formulário por
linha, 126 deles no mesmo documento. E marcar olhando para a conversa é marcar
com contexto: você acabou de ler o que a pessoa disse.

O campo oferece as categorias **já em uso** e aceita uma nova digitada.

### 4 · Vê-se e filtra-se na lista

`app/contatos/page.tsx` ganha a coluna `Categoria`, e no topo as categorias em
uso viram fichas que filtram por `?categoria=`.

A lista de hoje não tem filtro nenhum e mostra até 200 linhas de uma vez; este é
o primeiro corte que ela ganha.

### 5 · E cada ficha diz a verdade sobre alcance

```
todos (126)   aluno · 31 · 2 alcançáveis   interessado · 54 · 5 alcançáveis
              ex-aluno · 12 · 0            sem categoria · 29 · 2
```

**Este é o item que justifica a ordem do projeto.** O número de alcançáveis
aparece na tela **antes de existir botão de enviar** — então, quando o envio em
lote for desenhado, o dono já terá semanas de convivência com o número real, em
vez de descobri-lo no primeiro disparo frustrado.

**E ele é calculado com `windowState` de `lib/inbox-window.ts`** — a MESMA função
que `queue-drain.ts` usa para recusar o envio. Não é preferência de estilo: essa
função fecha a janela **5 minutos antes** do limite real (`WINDOW_MARGIN_MS`),
margem que o motor sempre teve.

**A DIVERGÊNCIA É INTERMITENTE, E ISSO A TORNA PIOR, NÃO MELHOR** — medido hoje,
e a primeira versão desta seção afirmava o contrário sem ter medido:

```
24h cravadas           9
com a margem de 5 min  9
na faixa dos 5 min     0   <- a diferença, NESTE instante
```

As duas contagens concordam agora. Elas discordam só enquanto alguém está dentro
daquela faixa de cinco minutos — e **48 pessoas falaram nos últimos 7 dias**, ou
seja, cerca de **7 travessias por dia**, cada uma durando cinco minutos.

Um erro que aparece sete vezes por dia, por cinco minutos, e some sozinho, é
exatamente o tipo que ninguém consegue reproduzir: a tela prometeria uma pessoa
alcançável, o envio a recusaria, e na hora de conferir já teria passado. Um SQL
cravado em 24 horas seria **quase sempre certo**, que é a pior categoria de
errado.

---

## Como isto fica provado

**O que é decisão vira função pura, com teste** — `tests/categorias.test.ts`:

- `normalizarCategoria`: maiúscula, espaço nas pontas, espaço repetido, vazio,
  só-espaço, `null`, não-texto, e o limite de tamanho.
- `resumoDasCategorias`: a lista de fichas com contagem e alcançáveis, incluindo
  o balde "sem categoria", a ordenação, e o caso de nenhum contato.

**O caso que prende a honestidade:** um contato cuja janela está a menos de 5
minutos de fechar conta como **fora** — porque é assim que o motor de envio o
trata. Sem esse caso, alguém "simplifica" o resumo para um `>` sobre 24 horas e a
tela passa a prometer alcance que o envio recusa.

**A migração `007` passa pelas três conferências** que a `006` ensinou o caminho:
`ESPERADAS` em `scripts/migrar.mjs` (a coluna existe, com a forma certa), a marca
d'água de `lib/esquema.ts` (ela É observável por presença, então entra em
`colunas` e não em `naoObservaveis`), e a lista de estrutura dos testes de
integração.

**A tela é provada na tela**, com a depuração remota, e vira item de roteiro:
marcar uma categoria numa conversa e vê-la aparecer na lista; clicar numa ficha e
a lista filtrar; e as contagens das fichas somarem 126.

---

## O que este desenho recusa, e por quê

**Várias etiquetas por contato.** Cobriria cruzar duas dimensões (`aluno` +
`turma-setembro`) sem inventar categoria composta. Custa: a coluna vira lista, o
filtro precisa decidir entre E e OU, e o envio em lote de amanhã herda essa
decisão. Uma categoria por contato responde ao que existe hoje.

**Categoria automática por automação.** Tentador — "quem tocou nesta pergunta
vira `interessado`" —, e é uma funcionalidade inteira, com desenho próprio. Fora
daqui.

**Envio em lote.** Adiado por medição, não por esforço. Ver o topo deste
documento.

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **`lib/steps.ts` não tem NENHUM import.** Nada aqui mexe nele.
- **A janela de 24h tem UMA fonte:** `windowState`. Nenhum SQL de 24 horas
  cravado, em lugar nenhum desta funcionalidade.
- **Migração é imutável depois de aplicada** — o registro de `schema_migrations`
  recusa arquivo editado.
- **Em produção, não mexer em automação existente.**
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
