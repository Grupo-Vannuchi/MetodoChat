# Auditoria de design — 10/09/2026

**Método:** navegador real (depuração remota) contra produção, 15 rotas, dois
temas, desktop (1366px) e celular (390px). Medição no DOM para o que o olho não
faz — contraste, escala tipográfica, raios, espaçamentos, foco, alvos de toque —
e leitura visual página a página.

**Nada foi consertado.** Este documento é o registro para executarmos de uma vez.

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

Cinco achados foram **descartados por medição errada minha**, e vale saber
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
