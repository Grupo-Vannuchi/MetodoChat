# Marcar categoria em lote

**Nascido em:** 14/09/2026, de uma medição que contradiz uma decisão de 02/09.
**Estado:** desenho aprovado pelo dono, pronto para virar plano.

---

## Por que existe

O envio em lote por categoria está em produção desde 01/09 e **continua sem
alvo**. Duas medições, doze dias de distância:

| | 02/09 | 14/09 |
|---|---:|---:|
| (sem categoria) | 120 | **143** |
| teste | 12 | **12** |
| equipe | 1 | **1** |

Os dois baldes com categoria estão **idênticos**. Não um contato a mais em doze
dias. Chegaram 23 pessoas novas, e as 23 caíram em "sem categoria".

### Isto derruba a premissa de 02/09, e a decisão que ela sustentava

A spec `2026-09-02-sinal-sem-categoria.md` registra, com todas as letras:

> **A marcação em massa foi RECUSADA, e a recusa é do dono:** as categorias vão
> sendo postas organicamente, pelo marketing, conforme as conversas chegam.

E registra que eu concordei, com este argumento: *"ferramenta de marcação em
massa existe para limpar acúmulo, e acúmulo que não vai ser limpo não precisa
de ferramenta."* O produto daquela decisão foi o **sinal de "sem categoria"** na
lista de conversas — construído justamente para que "orgânico" não virasse
"esquecido".

**O sinal foi para produção e produziu zero marcações.** A aposta era que o
vocabulário nasceria do uso; doze dias depois não nasceu nada, e o acúmulo
cresce cerca de 2 por dia.

O dono reverteu a recusa em 14/09, olhando os números.

### E havia um vazio maior, que só apareceu ao medir quem estava marcado

As 13 marcações existentes são **todas internas**: `teste` são as contas de
teste da própria casa (n8xmarketing, saas.metodoia, thiagovannuchi,
vannuchi.eng, repetidas por conta conectada) e `equipe` é uma pessoa do time.

**Nenhum lead real foi categorizado, nunca.** Não é que o vocabulário estivesse
pouco usado — ele nunca existiu. `teste` e `equipe` são etiquetas de arrumação
da casa, não segmentos de marketing.

Por isso este trabalho tem DUAS partes, e a segunda não é software: o dono
nomeou as categorias. São quatro, e ficam declaradas no código:

**`clientes`, `equipe`, `amigos`, `alunos`**

(minúsculas porque `normalizarCategoria` baixa a caixa; "Alunos" e "alunos" são
a mesma coisa por construção.)

### Por que não dá para derivar categoria do que o sistema já sabe

Foi considerado e medido, e não fecha. Das 143 sem categoria:

- **126 não vieram de automação nenhuma** — `last_automation_id` é nulo
- **138 não têm e-mail**
- o que sobra é idade: 13 com até 7 dias, 75 entre 7 e 30, 56 entre 30 e 90

Não há sinal no banco que separe cliente de amigo. A informação está na cabeça
de quem atende, e o trabalho da tela é **coletá-la rápido**, não adivinhá-la.

---

## O que foi recusado, e por quê

**Triagem uma a uma** (uma tela por contato, com as mensagens à vista e quatro
botões) foi proposta e recusada. O argumento a favor é o de 02/09 e continua
verdadeiro em geral: a categoria decidida lendo a conversa é mais certa que a
decidida olhando uma linha de tabela.

Ele não vale **para este acúmulo**, e a medição é a razão: para 126 das 143
pessoas não existe conversa rica para ler — existe um @ e uma data, que é
exatamente o que a tabela já mostra. A triagem cobraria 143 telas sequenciais
para entregar a mesma informação. E trabalho que ninguém termina é precisamente
como chegamos aqui.

---

## O desenho

### 1 · Onde fica

Em `/contatos`, na tabela que já existe (`app/contatos/page.tsx`). Uma coluna
nova de caixas à esquerda, e a barra de ações presa ao rodapé da tabela — onde
hoje mora o *"Mostrando 25 de 143 · Ver mais 25"*.

**Não nasce uma tela nova.** A tabela já tem busca, filtro por categoria, e a
coluna "Categoria" para conferir o resultado. Uma tela à parte duplicaria as
três coisas.

### 2 · O gesto, e ele funciona sem JavaScript

A tabela vira um `<form method="post">`. Cada linha carrega
`<input type="checkbox" name="ig_id" value="{ig_id}">`. A barra tem **quatro
botões de envio**, um por categoria, cada um carregando a sua:

```html
<button name="categoria" value="alunos">alunos</button>
```

Um formulário, quatro saídas. É HTML puro — botão de envio com `name`/`value` é
do padrão, e a página continua sendo componente de servidor.

**Texto livre não entra aqui.** Marcar com um nome fora da lista continua sendo
feito dentro da conversa, onde já existe e onde a decisão é informada. Um campo
de texto livre na barra de lote convidaria a inventar categoria olhando uma
tabela, que é como o vocabulário se fragmenta.

### 3 · A barra só aparece quando há alguém marcado

Por CSS, com `:has(input:checked)` no contêiner da tabela — a mesma família de
`has-checked:` que o "Quando" de `/publicar/novo` já usa. Sem seleção, a tela é
exatamente a de hoje.

**O SENTIDO DA REGRA É DELIBERADO, e é o mesmo do campo de data:** o padrão é
ESCONDIDO e o que a variante faz é MOSTRAR. Se `:has()` não compilar num
navegador antigo, a barra fica invisível e ninguém marca nada — falha para o
lado seguro. Escrita ao contrário, uma falha de CSS deixaria quatro botões de
escrita sempre visíveis numa tela de leitura, que é o achado D4 por outra porta.

### 4 · O "selecionar todos" cobre o que está na tela, e a tela diz quanto é

**`recorteDaTabela` não pagina, ele cresce**: "Ver mais" leva o limite de 25
para 50, 75, até `MAX_DA_TABELA = 500`. O rodapé já escreve *"Mostrando 25 de
143"*. Então "as da tela" é um conceito que **já existe e já está escrito**, e
escala: quem quiser pegar mais clica "Ver mais" antes de marcar.

A caixa do cabeçalho marca **`mostradas`**, nunca `rows`. Marcar em massa gente
que não apareceu na tela seria decidir por 118 pessoas invisíveis — e categoria
alimenta o envio em lote, que manda DM de verdade.

### 5 · O contador e o "selecionar todos" são a única peça de cliente

Um componente `app/contatos/selecao-client.tsx`, pequeno: a caixa do cabeçalho
e o texto *"25 selecionados"*. Ele alcança as caixas pelo DOM do formulário
(`form.querySelectorAll('input[name=ig_id]')`), então **a tabela continua
renderizada no servidor** — o cliente não passa a dona das linhas.

É a menor superfície que resolve. CSS marca todas as caixas de uma vez? Não —
`:has()` lê estado, não escreve. Sem este componente não há caixa de marcar
tudo.

### 6 · A frase do desfecho diz o que aconteceu, inclusive o que ninguém pediu

O aviso volta pela URL (`?aviso=&tom=`, o padrão da casa desde 02/09):

- caso comum: **"25 contatos marcados como alunos."**
- com sobrescrita: **"25 contatos marcados como alunos · 3 trocaram de
  categoria."**

Sobrescrever categoria é legítimo — é correção. Fazer isso **calado** não é.
Quem seleciona 25 linhas sem reparar que 3 já eram `clientes` precisa sair da
ação sabendo disso, e o lugar de contar é a frase, não um aviso prévio.

O singular e o plural vêm junto, na mesma função pura, pela razão de sempre:
são a mesma decisão, e separá-los deixaria metade da frase sem rede.

### 7 · Não vai ter desfazer, e é escolha declarada

Desfazer exigiria guardar o valor anterior de cada contato num lugar que não
existe — coluna nova ou tabela de histórico, numa migração, para uma ação que
**é reversível por natureza**: marcar de novo desfaz.

É diferente do envio em lote, que dispara DM e não volta atrás, e é por isso que
lá a confirmação é cara e aqui não é. O que compra a segurança aqui é a frase
do item 6.

### 8 · O que é decisão vai para `lib/`, com caso

Em `lib/categorias.ts`, ao lado do que já mora lá:

- **`CATEGORIAS_SUGERIDAS`** — a lista das quatro, na ordem em que aparecem.
  Declarada, e não derivada dos valores em uso: `teste` está em uso e não é
  botão.
- **`idsSelecionados(formData)`** — lê os `ig_id` do formulário, tira repetido,
  devolve lista. Formulário é digitável; o que sai daqui é o que a consulta vai
  usar.
- **`resumoDaMarcacao({ marcados, trocaram, categoria })`** — a frase do item 6,
  pura.

  **`marcados` é quantas linhas o `update` MEXEU, e nunca quantos ids o
  formulário mandou.** Os dois números divergem quando um id não pertence à
  conta — e é justamente aí que a frase não pode mentir: dizer "25 marcados"
  quando 24 mudaram esconderia a única pista de que alguém mandou um id que não
  era seu.

A escrita é uma consulta só:

```sql
update contacts set categoria = $3
 where account_id = $1 and ig_id = any($2)
```

**O escopo por conta não é detalhe.** Os `ig_id` vêm do formulário e formulário
é digitável por qualquer um; sem `account_id` no `where`, um id colado à mão
marcaria contato de outra conta. É a mesma proteção que a marcação individual
já tem em `app/conversas/[id]/actions.ts`.

A contagem de "quantos trocaram" sai de um `select` do estado anterior, dentro
da mesma transação da escrita — contar depois de escrever devolveria zero
sempre.

### 9 · A categoria passa por `normalizarCategoria` antes do banco

Mesmo vindo de uma lista fixa nossa. Não porque o valor possa estar sujo, mas
porque **a marcação individual já faz isso**, e duas telas que gravam a mesma
coluna por caminhos diferentes são duas telas que vão divergir. Um valor fora da
lista chega como `null` e a ação recusa.

---

## Armadilhas identificadas antes de escrever código

**Formulário dentro de formulário é ilegal em HTML**, e `/contatos` já tem dois:
o de busca (GET) e o de exportar CSV. O novo tem de ser **irmão** deles, nunca
filho — aninhado, o navegador descarta o interno e a tela falha de um jeito que
não acusa.

**A busca e o filtro de categoria precisam sobreviver à ação.** Depois de
marcar, o `redirect` volta para a URL que a pessoa estava vendo, com `?q=`,
`?categoria=` e `?linhas=` preservados. Voltar para `/contatos` puro jogaria
fora o filtro e o "Ver mais" — e quem estava limpando o acúmulo em blocos de 50
perderia o lugar a cada clique. É o mesmo cuidado de `permanentRedirect` em
`app/publicar/agendados/page.tsx`.

**Nenhum contato selecionado.** Os quatro botões existem, a barra está
escondida por CSS, mas um envio sem caixa marcada é alcançável (teclado, CSS que
não carregou). A ação devolve o aviso *"Nenhum contato selecionado."* em vez de
rodar um `update` com lista vazia.

---

## Testes

**Puros** (`tests/categorias.test.ts`, que já existe com 49 casos):
`idsSelecionados` com repetido, com vazio e com campo ausente;
`resumoDaMarcacao` no singular, no plural, com zero trocas, com trocas, e com
`marcados` MENOR que o número de ids pedidos — o caso do item 8; `CATEGORIAS_SUGERIDAS` com as quatro, em
minúscula, e cada uma sobrevivendo a `normalizarCategoria` sem mudar — um nome
que a normalização alterasse viraria botão que grava outra coisa.

**Integração** (`testes-integracao/`): marcar três contatos de uma conta e
conferir os três; marcar incluindo um `ig_id` de OUTRA conta e conferir que ele
não mudou — é o caso que prende o `account_id` do `where`; marcar por cima de
categoria existente e conferir a contagem de trocas.

**Plantio obrigatório**, porque é a disciplina da casa: trocar `mostradas` por
`rows` no "selecionar todos", tirar o `account_id` do `where`, e trocar a
contagem de trocas para depois da escrita. Os três têm de matar um caso.

---

## Fora de escopo, declarado

- **Desfazer** — item 7.
- **Criar, renomear e apagar categoria** — o modelo continua sendo "a lista é o
  conjunto de valores em uso", agora com quatro nomes em destaque. Tela de
  governança de categoria não se justifica com quatro.
- **Marcar em massa a partir de `/conversas`** — a lista de conversas mostra
  conversa, não contato, e uma pessoa tem uma conversa por conta conectada.
  Marcar ali multiplicaria o gesto.
- **Sugerir categoria automaticamente** — medido e sem base: 126 de 143 sem
  automação, 138 sem e-mail.
