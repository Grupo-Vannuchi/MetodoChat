# O quadro: montar automações arrastando blocos, ligados por setas

**Data:** 06/08/2026
**Estado:** aprovado
**Base:** `a332e6a`
**Fase:** 1b de duas. A Fase 1a pôs o fluxo no banco; esta põe o quadro na
tela. A ramificação sai daqui e vira projeto próprio — ver *Fora de escopo*.

---

## O problema

A Fase 1a trocou o motor: o fluxo de cada automação virou uma lista de passos
em `automations.steps`, e `lib/engine.ts` passou a executar essa lista em vez de
conhecer a sequência. Está em produção desde 06/08, exercitado ponta a ponta.

O que ela **não** entregou foi a tela. Montar uma automação continua sendo
preencher `app/automacoes/form.tsx` — 612 linhas de campos fixos que só sabem
expressar uma DM de boas-vindas, um portão, um link e um lembrete. O motor já
aceita três mensagens seguidas; o formulário não tem onde escrevê-las.

## O pedido, e o que ele revelou

O pedido original era "blocos, estilo n8n". No meio do desenho ele cresceu:
o quadro tem que ser **arrastável livremente**, como um mapa mental ou o
draw.io, e a intenção por trás é tripla — que o produto **pareça** um builder
de verdade na frente de um cliente, que dê para montar fluxos que
**ramificam**, e que o dono possa **montar espacialmente**, arrastando.

As três são legítimas. A terceira é a que muda o desenho: ramificação não é
enfeite de tela, é capacidade de motor. E o motor não a tem — `interpretar`
percorre uma lista reta.

Daí a decisão que organiza esta fase inteira:

> **O quadro vem agora. A ramificação vem depois, e começa pelo motor.**

Duas das três intenções são atendidas em dias. A terceira vira projeto próprio,
e quando chegar **não refaz a tela**: a segunda alça aparece no nó que já
existe.

## A armadilha que este desenho existe para evitar

Num quadro branco, o que define a ordem de execução?

Só há duas respostas, e uma delas é perigosa:

**A posição define a ordem** (esquerda para a direita, por exemplo). Aí
empurrar um bloco três pixels sem querer reordena o fluxo, e a próxima pessoa
que acionar a automação recebe as mensagens fora de ordem. Sem erro, sem aviso.
Descobre-se pelo cliente reclamando. **Recusado.**

**As setas definem a ordem.** É o certo, e é o que o draw.io faz. Só que quem
vê setas desenha uma segunda saindo do mesmo bloco — é o gesto natural. Sem
ramificação no motor, essa seta não roda: a interface teria ensinado a fazer
errado.

A saída adotada é a terceira: **a ordem continua sendo o array `steps`**, as
setas são desenhadas a partir dele, e cada bloco tem **uma** alça de saída. Não
existe onde puxar a segunda. Arrastar move; reordenar é outro gesto.

## O que muda no dado

### O bloco ganha nome próprio

```jsonc
// antes — quem o passo é depende de onde ele está
{ "tipo": "dm", "texto": "Aqui está o seu link!", "url": "https://..." }

// depois
{ "id": "b_7f3a91c2", "pos": { "x": 546, "y": 182 },
  "tipo": "dm", "texto": "Aqui está o seu link!", "url": "https://..." }
```

O `id` nasce no editor quando o bloco é criado e **nunca muda** — nem ao
arrastar, nem ao editar o texto, nem ao reordenar. Único dentro da automação;
não precisa ser global, porque tudo que o consome já é qualificado pela
automação.

O prefixo `b_` não é decoração: sem ele um id como `"2"` colidiria com uma
chave de deduplicação antiga, que carrega o índice. Com ele, chave velha e
chave nova nunca podem se confundir.

O `pos` é **cosmético** e não participa de decisão nenhuma. Bloco sem `pos` —
toda automação de hoje — recebe arranjo automático na primeira abertura.

### Três coisas deixam de apontar para a posição

| | antes | depois |
|---|---|---|
| chave de deduplicação | `passo:auto:pessoa:2:dia` | `passo:auto:pessoa:b_7f3a91c2:dia` |
| cursor de quem parou no meio | `contacts.flow_step_index` (int) | `contacts.flow_step_id` (text) |
| payload do botão | `AUTO:<automação>` | `AUTO:<automação>:<bloco>` |

**A primeira linha é o motivo desta mudança existir.** Arrastar um bloco é *a*
operação do editor, e hoje ela troca o índice de tudo que vem depois — chave
nova, e a mensagem sai de novo para quem já a recebeu.

**A segunda impede o pior caso.** Hoje o cursor é um número: apagar um bloco
antes do portão faz o índice de quem estava parado apontar para *depois* dele,
e a pessoa recebe o link sem nunca ter seguido. Silenciosamente.

**A terceira resolve de brinde** a ambiguidade que a revisão da Fase 1a
encontrou: o botão "Já sigo!" carrega só o id da automação e por isso não sabe
a qual portão voltar quando há mais de um.

**Os dois formatos de payload precisam conviver, e por tempo indefinido.** Um
botão já entregue vive na conversa da pessoa para sempre — ela pode tocar nele
daqui a um mês. Então o motor aceita as duas formas: `AUTO:<automação>` (uma
parte) resolve como hoje; `AUTO:<automação>:<bloco>` (duas partes) usa o id.
Mesma regra para `FOLLOW:`. Isso **não** é dívida a limpar depois — é a forma
final, e o comentário no código precisa dizer isso, senão alguém "limpa" o
ramo antigo e quebra todo botão já entregue.

**Da mesma forma, `flow_step_index` não é apagada agora.** A coluna nova
`flow_step_id` passa a ser a que vale; a antiga fica órfã e sai junto com as
outras 28, não antes. Apagar no mesmo deploy tira o caminho de volta.

### O motor não é tocado

Verificado em `lib/steps.ts`: `conferir` valida apenas os campos que usa e
devolve o objeto inteiro. Campos extras passam. Então `id` e `pos` entram no
`jsonb` sem o interpretador precisar conhecê-los.

Isto é o que torna a fase barata **e** segura. A Fase 1a produziu treze
defeitos, todos em `lib/engine.ts`; nada daquilo é remexido aqui. O que entra
em `lib/steps.ts` são duas funções puras novas — nenhuma delas altera o
caminho de execução existente.

## O que muda na tela

### O quadro

Blocos posicionados livremente sobre um fundo pontilhado, ligados por setas
curvas, com zoom e pan. Biblioteca: **React Flow** (MIT). É a primeira
dependência de UI do projeto — a spec da Fase 1a já a previa, para a Fase 2;
chegou antes.

- **O gatilho é o primeiro bloco** e não tem entrada. Palavras-chave, tipo de
  correspondência e o seletor de post/story ficam dentro dele, ao abrir.
- **Arrastar um bloco muda `pos`, nunca a ordem.**
- **Reordenar é soltar o bloco em cima de uma seta**, que acende ao receber. É
  explícito de propósito: nenhum empurrão acidental troca a ordem.
- **Uma alça de saída por bloco.** A segunda não existe na tela.
- **Inserir** é arrastar da paleta para o quadro, ou soltar sobre uma seta.

**Todo bloco está sempre na corrente, e isso é invariante.** Como a ordem *é* o
array `steps`, não existe bloco solto: arrastar da paleta para um ponto vazio
**anexa no fim** da lista, e a seta é desenhada até lá. Não há como desconectar
um bloco — só apagá-lo. Isso contraria a expectativa de quem conhece o draw.io,
onde caixa solta é normal, e é deliberado: bloco solto seria um bloco que
nunca roda, e nada na tela explicaria por quê.

### A paleta: oito itens sobre seis tipos

| item | grava | por que separado |
|---|---|---|
| Mensagem | `dm` | texto puro, o fluxo segue direto |
| Mensagem com botão | `dm` + `botao_label` | **o fluxo PARA** esperando o toque |
| Mensagem com link | `dm` + `url` + `botao_label` | abre um endereço, o fluxo segue |
| Esperar | `esperar` | |
| Pedir follow | `pedir_follow` | portão |
| Pedir e-mail | `pedir_email` | portão |
| Resposta pública | `resposta_publica` | só no gatilho de comentário |
| Coraçãozinho | `reagir_story` | só no gatilho de story |

Os três primeiros salvam o mesmo `tipo`. Separá-los na paleta não é maquiagem:
o que distingue uma DM que **para o fluxo** de uma que segue é ter rótulo de
botão **sem** url — uma diferença invisível que já causou defeito na Fase 1a,
quando um lembrete sem link virou parada dura sem ninguém ter pedido. Nomear os
três casos faz a distinção aparecer na hora de criar, não depois.

Os dois últimos só aparecem clicáveis no gatilho correspondente. Assim o bloco
impossível não chega a ser criado, e uma validação deixa de precisar existir.

### O painel lateral

Abre e fecha sobre o quadro, à direita — não divide a tela ao meio. Contém os
campos do bloco selecionado e a prévia da conversa, que acompanha enquanto se
digita. Fechado, o quadro é inteiro.

Reaproveitados como estão: `phone-preview.tsx`, `variable-picker.tsx`,
`media-picker.tsx`.

## A validação

Roda em **dois lugares** — no navegador, para desabilitar o salvar e dizer por
quê; e no Server Action, porque nada vindo do navegador é confiável. Escrever a
regra duas vezes é como as duas versões passam a discordar.

Por isso ela é **uma função pura em `lib/steps.ts`**, importada pelos dois
lados:

```ts
export function conferirLista(passos: unknown, gatilho: string): Problema[]
```

### O que impede salvar

1. **Lista sem nenhum bloco** — entrega zero.
2. **Bloco com campo obrigatório vazio** — mensagem sem texto, portão sem
   texto. `interpretar` o ignora, então quem montou acha que mandou e não
   mandou.
3. **Bloco que não pode disparar naquele gatilho** — coraçãozinho numa
   automação de DM.
4. **Dois portões de follow na mesma lista** — decisão explícita do dono do
   produto.
5. **Mais de um bloco de `pedir_email`, de `reagir_story` ou de
   `resposta_publica`** — a chave de deduplicação desses três não distingue o
   bloco, então o segundo nunca é enviado. Só `passoKey` ganhou identidade na
   Fase 1b; as irmãs não conhecem o bloco: `emailAskKey(auto, pessoa, dia)` é a
   mesma para os dois pedidos de e-mail do dia, `storyReactionKey(message_id)` a
   mesma para as duas reações à mesma story, `commentReplyKey(comment_id)` a
   mesma para as duas respostas ao mesmo comentário. O `on conflict do nothing`
   engole o segundo sem erro, e quem montou a lista acha que mandou e não
   mandou. É a mesma regra do item 4 — bloquear o que o motor engoliria em
   silêncio — aplicada aos casos que a revisão da Tarefa 1 encontrou.

O item 4 vale registrar: com `AUTO:<automação>:<bloco>` a ambiguidade técnica
some, e permitir dois portões passaria a custar zero. O bloqueio fica porque
foi pedido, não porque é necessário. Se um dia virar pedido inverso, é apagar
uma regra.

O item 5 é diferente: ele não é decisão de produto, é limite do motor. Sai da
lista no dia em que as três chaves passarem a levar a identidade do bloco, como
`passoKey` já leva. Enquanto não passarem, permitir o segundo bloco é prometer
um envio que nunca acontece. `followGateKey` tem exatamente o mesmo buraco, mas
o item 4 já barra dois portões de follow, então ele não é alcançável pelo
editor.

### O que apenas avisa

Amarelo, sem travar:

- **Link antes do portão de follow** — o link sai para quem não segue; o portão
  só segura o que vier depois dele. Pode ser engano, pode ser estratégia.
- **Espera como último bloco** — descartada, não atrasa nada.

## Arquivos

```
app/automacoes/editor/
  quadro.tsx      React Flow, estado Passo[], salvar
  no.tsx          um nó: cabeçalho, resumo, alças
  painel.tsx      campos do bloco + prévia
  paleta.tsx      os oito itens
  gatilho.tsx     o nó de gatilho (embrulha o media-picker existente)
```

`lib/steps.ts` ganha `conferirLista` e `indiceDoId`, ambas puras e testadas.
`lib/dedupe.ts` tem `passoKey` trocando índice por id. `lib/db.ts` ganha a
coluna `flow_step_id`.

`app/automacoes/form.tsx` sai.

## Testes

Tudo que **decide** vai para `lib/steps.ts` e nasce com teste — é a regra que a
Fase 1a mediu, não uma preferência: o arquivo puro atravessou treze rodadas de
revisão sem um defeito, e o `server-only` produziu treze.

O teste de `conferirLista` é o mais importante da fase: ele é o que garante que
cliente e servidor concordam, já que os dois chamam a mesma função.

**A interface não terá teste automatizado.** Arrastar, soltar sobre a seta,
abrir o painel — nada disso é coberto. O projeto não tem ferramenta de teste de
componente, e montar uma é trabalho maior que a feature. Fica dito: **a tela é
verificada à mão, pelo dono do produto.**

## Riscos

**A troca da chave pode duplicar mensagem na virada.** Chave com índice e chave
com id nunca casam, então quem estiver no meio de um fluxo no instante do
deploy pode receber um passo repetido. Medido em 06/08: zero contatos com
cursor, zero itens pendentes na fila. **Conferir de novo na hora do deploy, não
presumir.**

**O caminho de volta para o motor antigo morre.** Hoje o formulário grava
`steps` **e** as 28 colunas antigas, e é isso que torna o `git revert` da Fase
1a seguro. Um editor livre não consegue: três mensagens não cabem em
`welcome_text`, `link_text` e `reminder_text`. As colunas órfãs já sairiam em
11/08; esta fase antecipa a queima da ponte.

**Primeira dependência de UI.** React Flow traz peso de bundle e uma superfície
de atualização que o projeto não tinha. Aceito porque a alternativa — escrever
canvas, zoom, pan e arestas à mão — é maior e pior.

**A interface fica sem rede de segurança.** É a maior superfície não testada
que o projeto já teve. Mitigação parcial: toda decisão mora fora dela, em
funções puras testadas; o que sobra na tela é montagem e gesto.

## Fora de escopo

**Ramificação (Fase 2), e é o item mais importante desta lista.** Caminhos
diferentes conforme a resposta. Começa **pelo motor**, não pela tela: o cursor
deixa de ser "onde ela parou" e vira "em qual caminho, onde ela parou", e o
interpretador deixa de percorrer um array. É a parte cara — cara em risco, não
em teclado, porque é exatamente o tipo de mudança que produziu treze defeitos
na Fase 1a.

Quando chegar, a tela quase não muda: a segunda alça aparece no nó que já
existe, e nada do quadro é refeito. **Esta é a resposta escrita para "e as duas
setas?".**

**Tipos de passo novos** — mandar imagem, esperar por dias, chamar API externa.
Cada um é trabalho próprio.

**Editar automação pelo celular.** O quadro é de computador — arrastar no
celular briga com a rolagem, e o dono do produto usa no computador.

Isso deixa uma ponta que precisa estar decidida, não descoberta em uso: hoje
`/automacoes/[id]` abre no celular e funciona. Depois desta fase, **abrir o
editor no celular mostra um aviso** dizendo que a edição é pelo computador, com
a lista de blocos em modo leitura. Não é tela quebrada nem editor pela metade —
é uma frase e a lista. O resto do painel (conversas, contatos, eventos)
continua igual no celular.

**Desfazer/refazer.** Tentador num editor visual, e não pedido.

## Os cinco itens herdados da Fase 1a

Registrados quando a 1a foi mergeada. Esta fase resolve dois:

| | item | aqui |
|---|---|---|
| 1 | `dedupe_key` carrega o índice → reordenar reenvia | **resolvido** pelo id |
| 2 | edição que encurta o prefixo desloca cursores | **resolvido** pelo id |
| 3 | `esperar` descartado antes de um portão | fica |
| 4 | `gravarCursor`/`limparCursor` não conferem dono | fica |
| 5 | cursor obsoleto some sem linha em Atividade | fica |

Os itens 3 a 5 não bloqueiam esta fase e continuam registrados.

## Como reverter

`git revert` desta branch devolve o formulário e o índice. Duas ressalvas:

**Os ids gravados no `jsonb` ficam.** São campo extra; `conferir` os ignora, e
o formulário antigo reescreve `steps` inteiro ao salvar. Inofensivos.

**Os cursores em `flow_step_id` não voltam para `flow_step_index`.** Quem
estiver no meio de um fluxo no momento do revert perde o lugar e precisa
reacionar a automação. É recuperável e não silencioso — some do meio, não
recebe coisa errada.
