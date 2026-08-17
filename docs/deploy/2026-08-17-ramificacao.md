# Implantação da Fase 2a — ramificação por botões

**Estado:** rascunho. As Tarefas 5 a 8 ainda não terminaram, e o roteiro cresce
com elas. **A ordem já está fechada** e é o que este documento existe para
registrar, porque errá-la quebra todas as automações em silêncio.

**Branch:** `ramificacao`. **Produção hoje:** Fase 1b, intocada.

---

## O nó, medido

A Fase 1b implantou assim: **sobe a aplicação, roda o script depois.** Aqui isso
**não funciona**, e são três fatos que se somam.

**1 · A coluna `ligacoes` ainda não existe no banco.** Quem a cria é
`ensureSchema` (`lib/db.ts`), que só roda quando a aplicação sobe com o código
novo. Medido pelo ensaio a seco: *"A coluna `ligacoes` ainda não existe neste
banco"*, 2 automações de 2 sem ligação.

**2 · Com a coluna vazia, a caminhada para no bloco de entrada — calada.** O
motor novo segue setas; sem setas, não há para onde ir. Medido: **"Fluxo de teste
1a" cai de 5 blocos entregues para 1.** E não estoura: `lib/engine.ts` usa
`select *`, então a coluna faltando vira `undefined`, `ligacoesDe` devolve `[]` e
o webhook aceita normalmente. **Ninguém recebe nada e nada acusa.**

**3 · O editor ainda não grava `ligacoes`.** `app/automacoes/actions.ts` nunca
escreve na coluna, e `quadro.tsx` reordena o array `steps` ao arrastar. Logo,
entre a migração e a Tarefa 6:

- arrastar um bloco reordena `steps` e deixa `ligacoes` na corrente antiga → **o
  motor envia numa ordem e a prévia mostra outra**
- acrescentar bloco → nenhuma seta chega nele → **nunca é entregue**
- apagar bloco → seta pendurada → **o fluxo trunca ali**

### A conclusão

**O motor novo e o editor novo têm que subir juntos, e a migração tem que estar
feita antes dos dois.** Não dá para fatiar.

---

## A decisão que falta, e é sua

O script `scripts/ligar-passos-existentes.mjs` hoje **só confere** se a coluna
existe (`information_schema.columns`) — ele não a cria. Isso deixa um
impasse: a coluna nasce quando a aplicação sobe, e a aplicação não pode subir
antes da migração.

Duas saídas:

**A · O script passa a criar a coluna** (recomendado). Uma linha —
`alter table automations add column if not exists ligacoes jsonb not null default
'[]'::jsonb`, a mesma que já está em `lib/db.ts`. No Postgres 11+ acrescentar
coluna com `default` não reescreve a tabela, então é rápido mesmo com dados. A
sequência vira **script → deploy**, em dois passos, e a janela de risco fecha.

**B · Um deploy só com a DDL primeiro.** Levar para `main` apenas a mudança de
`lib/db.ts`, deixar a aplicação subir e criar a coluna, rodar o script, e só
então implantar a branch inteira. **Três passos, e um deles é um deploy que não
entrega nada** — mais superfície para errar, e mais tempo com o banco num estado
intermediário.

Recomendo **A**. Vou implementá-la quando você aprovar; ela é pequena e cabe
antes da revisão final.

---

## O roteiro

Ordem obrigatória. Cada passo tem como conferir antes de seguir.

### 0 · Antes de tudo — pause as automações

Elas estão pausadas hoje, mas **confira**, não presuma. Automação ativa durante a
migração recebe evento no meio da troca.

### 1 · Meça o estado real do banco

Não presuma o que o ensaio a seco de hoje disse — ele foi rodado dias antes.

- a coluna `ligacoes` existe?
- quantas automações há, e quantos blocos cada uma tem?
- quantas já têm ligações? (devem ser zero)

### 2 · Ensaio a seco da migração

```
node scripts/ligar-passos-existentes.mjs
```

Sem `--aplicar` ele **não grava nada**. Confira que **as ligações previstas por
automação são `blocos − 1`** — é uma corrente reta, e qualquer outro número
significa que o dado não é o que se espera. **Se divergir, pare.**

Medição de 14/08: "Bacana" 2 blocos → 1 ligação; "Fluxo de teste 1a" 5 → 4.

### 3 · Aplique

```
node scripts/ligar-passos-existentes.mjs --aplicar
```

Idempotente: automação que já tem ligações não é tocada. Rode **duas vezes** e
confirme que a segunda não muda nada — é a prova barata da idempotência.

### 4 · Confira antes de implantar

Cada automação tem `blocos − 1` ligações, todas `{"tipo":"sempre"}`, e a corrente
reproduz a ordem do array de hoje. **Este é o último ponto de volta sem
consequência para quem usa.**

### 5 · Implante a branch

Motor e editor juntos. Depois, com a aplicação no ar:

- abra uma automação no editor e confirme que **as setas desenhadas batem com a
  corrente migrada**
- arraste um bloco, salve, reabra — as ligações acompanharam?
- rode a automação de ponta a ponta com um dos dois perfis autorizados
  (**@jvsiqueira_** ou **@alicistica**) e confira em Atividade

### 6 · A prova que não pôde ser dada antes

A Tarefa 4 **não conseguiu** provar o envio de vários botões de ponta a ponta —
o caminho do webhook forjado escreve no banco, o que estava proibido, e não havia
automação com botões para exercitar. A prova offline cobriu as funções puras e
foi declarada como mais fraca.

**Aqui é onde ela se completa.** Monte um menu de três opções no editor, dispare,
e confirme na conversa real: os três botões chegam, e **cada um leva ao braço
certo**. Enquanto isso não for feito, o envio de vários botões está provado só no
papel.

---

## Como voltar atrás

**Antes do passo 5**, é só não implantar: a coluna `ligacoes` preenchida não é
lida por nenhum código no ar. A Fase 1b ignora a coluna inteira.

**Depois do passo 5**, voltar a aplicação para o commit anterior devolve o
comportamento antigo — a coluna fica no banco e é ignorada, exatamente como antes
do passo 3. **Não apague a coluna** para reverter; ela é inofensiva parada, e
apagá-la obrigaria a refazer a migração.

O que **não** volta sozinho: mensagens já entregues. Um botão de bifurcação já
enviado continua vivo na conversa da pessoa, e o payload de quatro partes deixa
de ser entendido se a aplicação voltar. **É o argumento mais forte para fazer o
passo 4 com calma.**
