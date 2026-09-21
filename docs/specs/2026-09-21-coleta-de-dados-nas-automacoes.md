# Coleta de dados nas automações — spec

**Data:** 21/09/2026
**Estado:** aprovada no desenho; aguarda plano de implementação.

## O que se quer

Hoje uma automação sabe pedir **uma** coisa à pessoa: o e-mail. O marketing quer
pedir outras — nome, telefone, data de nascimento — e também perguntas que só
eles conhecem ("qual sua cidade?", "qual seu maior desafio?"), guardando a
resposta para usar em mensagem e para exportar.

## O que já existe, medido em 21/09/2026

Antes de qualquer desenho, o que está no ar:

- **`pedir_email` é um tipo de passo próprio** com quatro peças espalhadas: o
  extrator `extractEmail` (lib/match.ts), o ramo de captura em `lib/engine.ts`,
  o item na paleta (app/automacoes/editor/modelos.ts) e a variável `{{email}}`
  (lib/variables.ts).
- **O motor JÁ PULA o passo quando a pessoa já tem e-mail** — `lib/engine.ts`,
  com a decisão numa função pura e testada (`retomadaDoEmailConhecido`,
  lib/steps.ts). Não é comportamento novo a inventar; é comportamento existente
  a refinar.
- **O pedido de e-mail não tem teto de tentativas.** Ele repete a cada mensagem
  recebida, para sempre, até vir um endereço válido. O `pedir_follow`, ao lado,
  tem teto de cinco e solta a pessoa. É assimetria, e é armadilha.
- **`contacts.email` é lido em SEIS lugares**: `lib/busca-de-contatos.ts`,
  `lib/engine.ts` (duas vezes), `lib/queue-drain.ts`, `lib/variables.ts`,
  `app/api/contatos/csv/route.ts` e `app/contatos/page.tsx`.
- **O volume é pequeno**: 4 automações usam `pedir_email` (4 passos ao todo,
  todas ativas) e 9 de 163 contatos têm e-mail coletado. Migrar o que existe é
  trivial.
- `contacts.name` **já existe e vem do perfil do Instagram** — é o que alimenta
  `{{first_name}}`.

## Decisões tomadas

Cada uma foi escolhida pelo dono, e o motivo está junto porque é o que impede
alguém de "melhorar" a decisão sem saber o que ela custa.

### 1. Campos fixos E campos livres

Quatro campos **fixos**, cada um com extração própria: `email` (já existe),
`telefone`, `nome_informado`, `nascimento`. Mais **campos livres**, criados pelo
marketing no próprio passo.

O fixo ganha extração específica porque é o que permite aceitar "meu zap é (11)
99999-9999" e recusar um ano. O livre aceita o texto como veio, aparado — é o
preço declarado da flexibilidade.

### 2. O nome coletado NÃO toca no nome do Instagram

`contacts.name` fica intacto e `{{first_name}}` **nunca muda de origem**. A
resposta da pessoa vira o campo `nome_informado`, com variável própria.

**Por quê:** quem escreve a mensagem decide qual usar. A alternativa
(sobrescrever) faz uma resposta "kkkk" virar o nome em toda mensagem futura,
sem volta.

### 3. Resposta que não serve: repete e depois SEGUE

Teto de tentativas, e esgotado o teto **o fluxo continua sem aquele dado** — o
mesmo desfecho que o `pedir_follow` já tem. Ninguém fica preso.

**Isto conserta a armadilha atual do e-mail de graça.**

### 4. Pular quando o dado já existe E é recente

O passo é pulado quando o campo já foi coletado há **menos de 30 dias**. Passado
esse prazo, pergunta de novo e atualiza.

**Por quê:** pular sempre nunca atualiza um telefone que mudou; perguntar sempre
irrita quem acabou de responder.

### 5. Um lugar só para o dado coletado — e esta decisão foi REVISTA

A proposta inicial era *campo conhecido tem coluna, campo livre vira chave*. A
decisão 4 a derrubou: "há pouco tempo" exige guardar **quando** cada dado
chegou, e isso faria cada campo custar duas colunas (`phone` e
`phone_coletado_em`), com migração dupla a cada campo novo.

A medição desempatou: dos seis leitores de `contacts.email`, **quatro já iam
mudar** por causa desta funcionalidade (o motor, o contexto das variáveis, as
variáveis e o CSV). Só a busca e a divisão "Com e-mail / Sem e-mail" do
`/contatos` não iam.

Então: **tudo num `jsonb`**, fixo e livre no mesmo formato, e `contacts.email`
migra para lá e a coluna sai.

**O que se paga:** mexer em duas telas que funcionam hoje.
**O que se ganha:** nenhuma cópia para divergir, o "quando" de graça para todo
campo, e campo novo sem migração. A alternativa era manter para sempre duas
fontes do mesmo dado — o defeito que custou a este projeto 19 miniaturas
quebradas em 15/09.

## Arquitetura

### `lib/campos.ts` — puro, e é o dono da regra

O catálogo, e nada mais decide sobre campo:

```ts
type Campo = {
  chave: string;              // "telefone"
  rotulo: string;             // "Telefone / WhatsApp"
  perguntaPadrao: string;     // texto com que o passo nasce
  reperguntar: string;        // o "não entendi" DESTE campo
  extrair(texto: string): string | null;
  variavel: string;           // vira {{telefone}}
  exemplo: string;            // o que o editor mostra
};
```

Mais três funções puras:

- `lerCampos(jsonb)` — o registro do contato num formato só;
- `normalizarChaveLivre(texto)` — `"Qual sua Cidade"` → `cidade`;
- `campoEstaFresco(em, agora = Date.now())` — a regra dos 30 dias.

**O `agora` é parâmetro, e isso não é preferência.** Em 21/09/2026 dois testes
desta base ficaram vermelhos sozinhos porque cravaram uma data que passou, num
bloco cujo comentário JÁ PREVIA que isso aconteceria. Com o instante como
parâmetro, os casos dos 30 dias não apodrecem.

### O que cada `extrair` aceita e recusa

O extrator **acha o dado dentro da frase** — ninguém responde só o valor. É o
que `extractEmail` já faz, generalizado.

| campo | aceita | recusa |
|---|---|---|
| `email` | o que já aceita hoje (sem mudança de comportamento) | — |
| `telefone` | 10 ou 11 dígitos com DDD, com ou sem DDI, máscara ou espaços | qualquer coisa fora de 10–11 dígitos: ano, CPF, número curto |
| `nome_informado` | qualquer texto; "meu nome é Ana Souza" → `Ana Souza` | vazio, só emoji/pontuação, mais de 60 caracteres |
| `nascimento` | `01/02/1990`, `1990-02-01`, "1º de fevereiro de 1990" | data impossível (`30/02`), data no futuro |
| livre | o texto aparado, como veio | só o vazio |

A recusa do nome é **fraca de propósito**: uma lista de palavras proibidas
sempre erra alguém, e o custo de aceitar "sou a ana" é menor que o de recusar um
nome de verdade.

### Armazenamento

Coluna nova `contacts.campos jsonb not null default '{}'`:

```json
{ "email":    { "valor": "ana@email.com", "em": "2026-09-21T12:00:00Z", "automacao": "…" },
  "telefone": { "valor": "11999999999",   "em": "2026-09-21T12:01:00Z", "automacao": "…" },
  "cidade":   { "valor": "Osasco",        "em": "2026-09-21T12:02:00Z", "automacao": "…" } }
```

`automacao` é **o único campo que ninguém pediu**. Está aí porque "qual campanha
trouxe estes contatos" é pergunta que vai ser feita, e responder depois exigiria
coletar tudo de novo: é barato agora e impossível retroativamente.

Mais uma coluna `campo_tentativas int not null default 0`, espelhando o
`follow_attempts` que já existe.

### O passo

`pedir_email` deixa de existir como tipo. Em lugar dele, `pedir_dado`:

```ts
{ id, tipo: "pedir_dado", campo: "telefone", texto: "…" }
{ id, tipo: "pedir_dado", campo: "livre", chave: "cidade", texto: "…" }
```

### O motor — um ramo, quatro passos em ordem

1. **Fresco?** Campo já coletado há menos de 30 dias → pula, pela mesma função
   pura que hoje pula o e-mail conhecido (que ganha nome novo e passa a valer
   para qualquer campo).
2. **Senão, pergunta** com o texto do passo.
3. **Na resposta, `extrair`.** `null` → repergunta com o texto do campo, até o
   teto de **3 tentativas**, contando em `campo_tentativas`.

   **Três, e não cinco como o `pedir_follow`.** O portão de follow é uma
   condição do produto e vale insistir; um campo é um favor que se pede. Três
   perguntas erradas seguidas já são conversa ruim. O número é constante do
   catálogo: mudar é uma linha.
4. **Esgotado o teto → SEGUE sem o dado**, e zera o contador.

### O editor

A paleta ganha **um item por campo conhecido** — *Pedir e-mail*, *Pedir
telefone*, *Pedir nome*, *Pedir data de nascimento* — mais *Pedir outro dado*
para os livres. Cinco itens, **um mecanismo**: todos criam o mesmo `pedir_dado`.

**Por que não um bloco genérico:** "Pedir telefone" se acha na paleta; "Pedir um
dado, agora escolha qual" não se acha.

No cartão do passo o marketing edita a pergunta e, **só para campo livre**, o
nome do campo — mostrando o resultado normalizado ali: *"vai virar
`{{cidade}}`"*, porque o mesmo texto serve de rótulo, variável e coluna do CSV.

O teto de tentativas **não** vira campo configurável: fica constante, como já é
no `pedir_follow`.

**Chave livre que colide com campo conhecido é RECUSADA no editor.** Quem
digitar "e-mail" como campo livre recebe a recusa e o caminho: *"e-mail já é um
campo do sistema — use o bloco Pedir e-mail"*. Sem isso, um campo livre chamado
`email` gravaria por cima do e-mail de verdade sem extração nenhuma, e o
`{{email}}` passaria a devolver o que a pessoa digitou em qualquer formato.

### Onde o dado aparece

- **Variáveis:** cada campo fixo ganha a sua (`{{telefone}}`, `{{nome_informado}}`,
  `{{nascimento}}`); campo livre gera `{{<chave>}}`. `{{email}}` continua
  funcionando igual. `VariableContext` passa a carregar o registro de campos.
- **CSV:** colunas fixas mais uma coluna por campo livre que exista naquela
  conta. O filtro de hoje (`where email is not null`) passa a ser "tem pelo
  menos um campo coletado".
- **`/contatos`:** a divisão "Com e-mail / Sem e-mail" e a célula de e-mail
  passam a ler do registro em vez da coluna.

## Isto são DUAS entregas, e a costura entre elas é limpa

O escopo acima é grande demais para um plano só, e ele tem uma junta natural:

**Parte 1 — coletar e guardar.** Catálogo, passo `pedir_dado`, editor, motor,
`contacts.campos`, migração dos 4 passos e dos 9 e-mails, e as variáveis novas.
Ao fim dela o produto FUNCIONA: a automação pergunta, valida, guarda, e a
mensagem seguinte já usa `{{telefone}}`.

**Parte 2 — mostrar e exportar.** CSV com coluna por campo livre, `/contatos`
lendo do registro, e só então a remoção da coluna `contacts.email`.

**O que torna a costura limpa:** na Parte 1 a coluna `contacts.email` CONTINUA
sendo escrita junto com o registro, e os seis leitores de hoje seguem intactos.
Ninguém precisa mudar de tela para a Parte 1 entregar valor. A janela de
divergência (dado em dois lugares) abre na Parte 1 e fecha na Parte 2 — está
declarada no fim deste documento e tem dono.

Esta spec cobre as duas. O plano de implementação começa pela Parte 1.

## Migração

1. Criar `contacts.campos` e `contacts.campo_tentativas`.
2. Copiar `contacts.email` para `campos.email.valor`, com `em` =
   `first_contact_at` (é o que se sabe; não há data de coleta guardada hoje) e
   `automacao` nulo. **9 linhas.**
3. Reescrever os passos `pedir_email` para `pedir_dado` com `campo: "email"`.
   **4 passos, em 4 automações ativas.**
4. Remover a coluna `contacts.email` **só depois** de os seis leitores estarem
   migrados e medidos em produção.

O passo 4 é deliberadamente separado: derrubar a coluna junto com a troca dos
leitores faz um defeito em qualquer um deles virar perda de dado em vez de tela
errada.

## Como se prova

- **Puro** (`tests/`): cada `extrair` com os casos da tabela acima, aceitos e
  recusados; `normalizarChaveLivre`; `campoEstaFresco` nas bordas (29, 30 e 31
  dias), com o instante fixo.
- **Integração** (`testes-integracao/`): a conversa inteira contra o banco —
  pergunta, resposta ruim, repergunta, resposta boa, dado gravado; e o teto
  esgotado seguindo o fluxo. Mais o caso do campo fresco pulando o passo e o do
  campo vencido perguntando de novo.
- **DOM** (`testes-dom/`): o cartão do passo no editor, com a normalização da
  chave livre aparecendo ao digitar.
- **Navegador** (`scripts/conferir-no-navegador.mjs`): nada a acrescentar por
  enquanto — a coleta não tem comportamento que dependa de hidratação.
- **Plantio obrigatório** em cada portão: um caso que não sabe ficar vermelho
  não conta. Esta base perdeu 19 miniaturas por isso.

## Declarado

**O campo livre não tem validação, e isso é escolha.** Quem criar "qual sua
cidade?" vai receber "kkkk" de alguém. A alternativa seria pedir ao marketing que
descrevesse um formato, o que ninguém faria.

**`{{first_name}}` continua vindo do Instagram.** Se o marketing quiser usar o
nome que a pessoa digitou, tem de escrever `{{nome_informado}}` — de propósito.

**A coluna `email` sai só na Parte 2**, e até lá o dado existe em dois lugares:
a Parte 1 escreve nos DOIS, e os seis leitores de hoje continuam lendo a coluna.
É a única janela de divergência desta entrega. Ela é temporária, tem dono (o
passo 4 da migração) e tem um jeito de não mentir: quem escreve os dois é UMA
função, e um portão de texto prende isso — a mesma forma dos portões que esta
base já usa para impedir cópia de regra.
