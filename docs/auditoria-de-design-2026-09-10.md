# Auditoria de design — 10/09/2026

**Método:** navegador real (depuração remota) contra produção, 15 rotas, dois
temas, desktop (1366px) e celular (390px). Medição no DOM para o que o olho não
faz — contraste, escala tipográfica, raios, espaçamentos, foco, alvos de toque —
e leitura visual página a página.

**Nada foi consertado** quando este documento foi escrito. Ele era o registro
para executarmos de uma vez.

> **FECHADA EM 11/09/2026, 16:39.** Os doze defeitos e os seis pontos de
> melhoria foram executados e estão em produção (`2e84f7e`). O rodapé deste
> arquivo — *"O que a execução corrigiu no próprio relatório"* — registra os
> três achados cuja DESCRIÇÃO não sobreviveu à medição na hora de consertar.

---

## O que está bom, e não deve ser mexido

Vale escrever antes dos defeitos, porque uma auditoria que só lista problemas
convida a refazer o que já funciona.

- **Existe um sistema de tokens de verdade** (`app/ui.ts`, 132 linhas): cartão,
  tipografia, formulário, botão, etiqueta, tabela, aviso, esqueleto e estado
  vazio, com variante para os dois temas. Os defeitos abaixo são quase todos
  desvios do sistema, não ausência dele.
- **O celular está resolvido, não remendado.** Medido em 390px: **nenhuma das
  páginas rola na horizontal**, a barra lateral vira menu recolhido, os cartões
  passam a duas colunas e o gráfico escala. Zero elementos estourando a largura.
- **`/automacoes/nova` é a melhor página do site:** os quatro gatilhos como
  cartões com ícone, nome e consequência ("Alguém comenta a palavra-chave e
  recebe sua DM") em vez de um `select`.
- **A numeração de `/setup` significa algo real** — são as quatro posições que a
  conta tem na Meta, não decoração.
- **O vocabulário melhorou de verdade** nesta semana: "Seu perfil", "Sai em",
  "Não enviada", "Falhou em". O trabalho aparece na tela.
- **`alt=""` no avatar é deliberado e correto** — o nome está sempre ao lado.
- `lang="pt-BR"`, um `<h1>` por página, hierarquia de títulos sem saltos.

---

## DEFEITOS

### D1 — ALTO — a tela mente sobre um post que o dono cancelou

**Onde:** `/eventos`, e a raiz em `app/labels.ts:421` e
`lib/publicacao.ts:1882` (`dataDaLinhaDeEnvio`).

Medido em produção, sobre o post cancelado em 09/09
(`status='skipped'`, `error='cancelado por voce'`, `not_before=12/09 19:10`):

> **Não enviada** · *"Não conseguimos enviar desta vez. O sistema tenta de novo
> automaticamente."* · **Sai em 12/09/2026, 16:10**

As três afirmações são falsas: não falhou (foi cancelado), o sistema **não**
tenta de novo (`skipped` é terminal), e não sai nunca.

**Raiz dupla:** `skipped` é um estado só para duas coisas diferentes — "o
sistema pulou" e "o dono cancelou" —, e `dataDaLinhaDeEnvio` diz "Sai em" para
qualquer coisa com hora futura sem olhar se o estado é terminal.

**E o motivo certo já está no banco**, na coluna `error`, sem ser usado.

### D2 — ALTO — a ação destrutiva é a mais discreta da linha

**Onde:** `/automacoes`, lista.

Medido: **"Excluir" é `zinc-500` (113,113,123)**; "Pausar", "Editar" e
"Duplicar" são `zinc-400` (159,159,169). A ação que apaga uma automação é
**mais apagada** que a que a duplica, no mesmo tamanho (12px) e peso (500).

O token `btnDanger` existe em `app/ui.ts:85` e não é usado aqui.

### D11 — ALTO — a opacidade derruba a linha inteira de ações abaixo do mínimo

**Achado em 10/09, DURANTE a execução da Onda 2, e não pela auditoria original.**

`app/automacoes/list-client.tsx`: o contêiner das quatro ações tem
`sm:opacity-60` — o padrão de "revelar no hover". Medido em produção, a ≥640px,
em repouso:

| ação | contraste do texto | contraste REAL, com a opacidade |
|---|---|---|
| Pausar / Editar / Duplicar | 7,72:1 | **2,90:1** |
| Excluir | 4,83:1 | **2,31:1** |

**As quatro ações de todas as 18 linhas ficam abaixo de 4,5:1 em repouso.** Não
é o "Excluir" que está apagado — é a linha inteira.

E vale registrar por que a auditoria não pegou: **meu medidor não acumulava a
opacidade dos ancestrais**, então mediu a cor declarada e não a cor vista. É a
terceira limitação da ferramenta, junto das cinco do fim deste documento.

### D12 — MÉDIO — o balão de saída já nasce abaixo do mínimo, e a opacidade o afunda

**Achado em 10/09, DURANTE a execução da Onda 3**, com o auditor consertado, e
registrado sem conserto: mexer nele é decisão de produto, não de disciplina.

**Onde:** `app/conversas/[id]/page.tsx:290-305`, a mensagem que o dono envia.

O balão é `bg-indigo-500` com `text-white`, e a hora embaixo é
`text-indigo-100`. Medido, sobre o fundo da conversa:

| estado | texto | hora |
|---|---|---|
| em repouso (`opacity` 1) | **4,58:1** | **3,71:1** |
| "enviando…" / "guardada" (`opacity-60`) | **2,36:1** (claro) · 3,31:1 (escuro) | **2,08:1** · 2,76:1 |

Duas coisas distintas, e a segunda é o mecanismo do D11:

1. **Branco sobre `indigo-500` dá 4,58:1** — passa por 0,08, e a hora em
   `indigo-100` já reprova antes de qualquer opacidade.
2. **`opacity-60` marca "está saindo"** e derruba o balão inteiro, porque a
   opacidade compõe o texto E o fundo dele contra a página.

**Por que não foi consertado aqui:** o indigo do balão é a cor de ação do
sistema inteiro (`app/ui.ts`), e trocá-la na conversa é um desenho, não um
ajuste de token. O sinal de "enviando" também precisa continuar existindo.

### D3 — MÉDIO — três tokens de texto quieto abaixo do contraste mínimo

| token | onde | claro | escuro |
|---|---|---|---|
| rótulo de seção, 10px | "Gerenciar", "Sistema", "trocar conta", "Criado por N8X" | **2,49:1** | **2,58:1** |
| `hint`, 12px | toda explicação abaixo de campo | passa | **3,67:1** |
| `thead`, 11px | cabeçalho de toda tabela | passa | **4,1:1** |

Mínimo exigido: 4,5:1.

**Raiz única:** todos usam `zinc-500`, e `hint`/`thead` o usam **igual nos dois
temas** (`text-zinc-500 dark:text-zinc-500`) — diferente de `muted`, que troca
(`zinc-600`/`zinc-400`) e por isso passa. Consertar a regra do texto quieto
resolve as três de uma vez.

### D4 — MÉDIO — a ação mais perigosa do produto é o estado padrão de uma tela de leitura

**Onde:** `/contatos`.

O formulário de envio em massa é a **primeira coisa** da página, já montado,
com a ficha "todos (125)" **pré-selecionada** e o botão "Enviar" visível sem
rolar. Quem abre Contatos para *olhar* contatos encontra um disparo para 125
pessoas armado.

A confirmação existe e é obrigatória — mas ela é a única barreira, e está a um
clique de distância do estado inicial.

### D5 — MÉDIO — os três números do lote leem como partes de um todo

**Onde:** `/contatos`, dentro do formulário.

```
9 recebem agora
116 quando voltarem a falar
56 provavelmente nunca — nunca falaram, ou falaram uma única vez
```

Três linhas, mesmo tamanho, mesmo peso, mesma cor, empilhadas. Somam **181** de
125 pessoas, porque o terceiro é subconjunto do segundo.

A especificação de 01/09 previu exatamente isto — *"o número não pode ser
subtraído dos outros dois como se fosse certo"* — e o texto diz
"provavelmente". Mas o **layout** contradiz o texto.

### D6 — MÉDIO — duas linguagens de formulário na mesma linha

**Onde:** `/setup`, e onde mais houver `<select>`.

O campo de texto usa o token `input` (borda própria, raio, foco desenhado); o
`<select>` de automação ao lado é nativo, com a moldura e a seta do sistema
operacional. Lado a lado, na mesma linha.

### D7 — BAIXO — a queda tem exatamente a cor do texto que a explica

**Onde:** `app/dashboard-parts.tsx:30-33`.

```ts
trend > 0 ? "text-emerald-600 dark:text-emerald-400"
          : "font-medium text-zinc-500"
```

A assimetria é defensável — menos mensagens recebidas não é falha, e vermelho
alarmaria sobre algo que não quebrou. **O problema é que o cinza escolhido é o
mesmo `zinc-500` do texto ao lado**, então "↓ 31" e "vs. 7 dias antes" viram
uma frase só e o número perde estatuto de número.

**MEDIDO NA ONDA 3, e registrado aqui porque é o outro braço do mesmo
ternário:** a subida — `text-emerald-600 dark:text-emerald-400` — dá
**3,65:1** no claro, abaixo do mínimo de 4,5:1. `emerald-700` daria 5,42:1
sobre `bg-white`. Não foi consertado na Onda 3: `emerald-600` é o verde de
sucesso do sistema inteiro (`alertOk`, `badgeOk`), e trocá-lo num lugar só
criaria o segundo verde que esta seção existe para evitar. Vai junto com D7,
na rodada de acabamento.

**A queda continua como estava para a cor**, mas passou pelo D3 junto com o
resto: era `zinc-500` cru (3,67:1 no escuro) e agora é o token `muted`
(7,19:1). A crítica do D7 — os dois textos com a mesma cor — segue de pé, e é
de hierarquia, não de contraste.

### D8 — BAIXO — duas linguagens de foco, e a fraca está no que mais se usa

Medido em `/contatos`: 23 focáveis visíveis, **6 com anel desenhado, 17 sem**.

Os 17 são a navegação inteira, e neles vale o anel padrão do navegador:
`outline: auto 1px rgb(113,113,123)` — 1px, no mesmo `zinc-500` de baixo
contraste do D3. Os formulários têm anel próprio.

### D9 — BAIXO — sem `<main>` e sem atalho para o conteúdo

Nenhuma página tem marco `<main>` (medido: `document.querySelector('main')`
devolve nulo), e não há link "pular para o conteúdo". Quem navega por teclado
atravessa os 11 itens da barra lateral em toda página.

### D10 — BAIXO — trilha de navegação inconsistente

`/automacoes/nova` tem ("Automações / Nova"). `/publicar/agendados`,
`/conversas/[id]` e `/automacoes/[id]` não têm, e são igualmente aninhadas.

---

## PONTOS DE MELHORIA

### M1 — a escala tipográfica tem 26 combinações e 13 tamanhos

Medido em todo o site: **9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 24, 30 px**.

Dois problemas distintos:

- **Pares que o olho não distingue mas que fragmentam o sistema:** 12/13,
  14/15, 16/17. Nenhum leitor percebe a diferença; toda manutenção precisa
  decidir entre eles.
- **9px e 10px estão abaixo do que se lê confortavelmente**, e não são raros:
  `10px` aparece **277 vezes** (190 em peso 500, 69 em 600, 18 em 400).

Os cavalos de trabalho são `12px/400` (627x) e `14px/400` (378x).

### M2 — sete raios de borda, e três são avulsos

`8px`, `12px`, `16px` formam um ritmo coerente. Fora dele: **`9px`**, **`10px`**
e `4px 4px 0px 0px`. (O valor gigante é `rounded-full`, correto.)

### M3 — dez espaçamentos distintos

`2, 4, 6, 8, 10, 12, 14, 20, 24 px` — passo de 2px, mais fino que qualquer
rimo perceptível, o que indica decisão caso a caso em vez de escala.

### M4 — o gráfico não tem eixo nem valores

`/`, "Mensagens por dia": barras com datas embaixo, sem eixo vertical e sem
número em lugar nenhum. Dá para ver a forma, não a grandeza — e num painel cujo
assunto é quantas mensagens saíram, a grandeza é o ponto.

### M5 — o feed repete a mesma linha

`/`, "Últimas interações": quatro linhas seguidas de "Mandou mensagem /
@nicholasvannuchi / há 18-19 min". Quatro linhas para um fato só.

### M6 — duas páginas passam de dez telas de rolagem

`/eventos`: **6819px** (11 telas). `/contatos`: **8777px** (14 telas).

O precedente de `/setup` — que saiu de 6341px para 1660px em 31/08 — mostra que
o problema tem solução conhecida nesta base.

---

## Erros da própria auditoria, registrados para não se repetirem

Seis achados foram **descartados por medição errada minha**, e vale saber
quais, porque um relatório com achado falso contamina os verdadeiros:

1. **126 falhas de contraste** — meu extrator lia `lab()` do Tailwind v4 com
   expressão de `rgb()`, tratando os componentes do lab como RGB. Refeito com
   conversão via canvas.
2. **"Imagens sem alt"** (até 56 por página) — `alt=""` no avatar é correto e
   deliberado; meu contador tratava vazio como ausente.
3. **"Miniaturas não carregam"** em `/automacoes` — só existe uma imagem na
   tela e ela carregou. Os quadrados cinza são outra coisa.
4. **43 falhas no tema claro** — eu forcei a classe `dark` fora em vez de usar o
   botão do site, e produzi um meio-estado que não existe para o usuário. Pelo
   botão real: 18, todas do D3.
5. **"Zero anéis de foco"** — a medição rodava num contexto obsoleto do
   navegador (`scrollHeight` devolvia 623px numa página de 8777px). Refeita com
   aba nova.

   **A CAUSA EXATA, achada em 11/09 ao reproduzir o erro por acidente:** a aba
   estava em SEGUNDO PLANO. `document.visibilityState` devolvia `"hidden"`, e o
   Chrome não calcula layout de aba oculta — `scrollHeight` volta ao tamanho da
   janela (os mesmos 623px) e toda `getBoundingClientRect()` devolve zero. Não
   era contexto "obsoleto", era aba invisível, e o sintoma é reconhecível: toda
   altura zero e a página inteira com a altura do viewport.

   **Como evitar:** `cdp("Page.bringToFront")` antes de medir, e conferir
   `document.visibilityState` no mesmo `js(...)` que colhe os números. Esperar
   mais tempo NÃO resolve — a aba oculta não vai pintar sozinha.
6. **"Nenhuma página tem marco `<main>`"** (metade do D9, achado em 11/09 ao
   executar o próprio achado) — `<main>` sempre existiu, e em três lugares
   diferentes: `app/app-shell.tsx:205` nas páginas públicas, `:269` nas páginas
   com menu, e `app/automacoes/editor/quadro.tsx:1372` no quadro, que toma a
   janela inteira e por isso desenha o seu. A base é *cuidadosa* com esse marco
   a ponto de `app/automacoes/[id]/not-found.tsx` explicar, em comentário, por
   que ele é `<div>` — para não aninhar dois `<main>`. O
   `document.querySelector('main')` que devolveu nulo tem a mesma causa do erro
   5: contexto obsoleto do navegador.

   **A outra metade do achado era verdadeira** e foi executada: não havia link
   "pular para o conteúdo", e quem navega por teclado atravessava os onze itens
   da barra lateral em toda página.

---

## O que a execução corrigiu no próprio relatório

Os seis erros acima foram descobertos DURANTE a auditoria. Estes três só
apareceram na hora de consertar, e são de outra natureza: o defeito existia,
mas a descrição dele estava errada — e consertar pela descrição teria produzido
a mudança errada.

**D10 — "três padrões de navegação".** Eram dois, e não os que o texto nomeava.
`/automacoes/[id]` e `/conversas/[id]` JÁ tinham link de volta quando o achado
foi escrito. Os verdadeiros fora do padrão eram a trilha de `/automacoes/nova`
(a única do painel) e o `"← Voltar para a lista"` de `/conversas/[id]`, que
não nomeia o destino — um problema de CÓPIA, e não de estrutura.

**M3 — "dez espaçamentos, passo de 2px".** Contados na árvore: 703 ocorrências
em dezoito valores. E dois deles não são escolha, o que muda o que "arbitrário"
quer dizer aqui:

- `pl-9` (36px) é **derivado** da posição do ícone do campo — `left-3` (12px)
  mais 16px de ícone mais 8 de folga. Encostá-lo em 32px poria o texto em cima
  do ícone; em 40 abriria um buraco. O número obedece ao ícone, não a um ritmo.
- `px-3.5` (14px) é padding **horizontal** de campo, e ritmo vertical não passa
  por ali. É a medida do token `input`.

Saíram três, todos de uma ocorrência, todos em layout folgado: `mt-20`, `py-14`
e `mt-7`. E um quarto **nem existia**: a primeira contagem acusou `mt-24` em
`/eventos` e era `scroll-mt-24` — deslocamento de âncora, que não é espaço
entre nada. A régua está em `app/escala.ts`, na mesma forma das de tipografia e
raio, com o portador em `tests/escala.test.ts`.

**A régua NÃO normaliza 6, 10 e 14, e isso é decisão e não omissão.** Seriam
110 alterações, várias em layouts medidos à mão — a coluna de conversas tem
224px úteis, e o comentário dela conta pixel a pixel onde cada um foi parar.

### A lição de método, que é a mesma dos seis erros

Uma varredura mente na BORDA. `` fez `scroll-mt-24` virar um degrau de 96px
que nenhum layout tem; `(?![\w])` fez `mt-4.5` ser lido como `mt-4`, e todo
meio degrau fora da régua passava calado. O segundo só apareceu porque um
defeito plantado **sobreviveu** — a contraprova achou o que a contagem não
teria achado nunca.
