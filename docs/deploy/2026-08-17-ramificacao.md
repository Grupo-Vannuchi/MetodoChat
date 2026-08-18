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

## Como o impasse foi resolvido

A primeira ideia era fazer `scripts/ligar-passos-existentes.mjs` criar a coluna.
**Recusada ao ler o código:** o comentário daquele script diz, com todas as
letras, que ele não grava DDL *"para não fazer esquema ser coisa de script de
dado"*. O princípio está certo — misturar os dois faria um script de migração de
dado precisar de permissão de DDL, e tornaria impossível rodar só um deles.

Nasceu então um passo próprio: **`migrations/` + `scripts/migrar.mjs`**. Aquele
script preenche; este cria. É também a primeira parcela da mudança maior —
tirar o esquema de dentro da aplicação — descrita em
`docs/plans/2026-08-17-esquema-e-harness.md`.

A DDL de `ligacoes` fica **nos dois lugares** durante a transição, e é
deliberado: em `lib/db.ts` ela é a **rede** (implantar sem rodar a migração ainda
cria a coluna), em `migrations/001` ela é a **ordem** (existir antes do código
subir). As duas são `if not exists`, então não podem divergir em efeito.

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

### 2 · Crie a coluna

```
node scripts/migrar.mjs              # ensaio a seco, mostra o que faria
node scripts/migrar.mjs --aplicar    # grava
```

Ele **confere no banco** depois de aplicar, e não confia no próprio "aplicada" —
`if not exists` tem sucesso mesmo quando não faz nada, inclusive quando o arquivo
está errado. Espere ver `automations.ligacoes existe (jsonb, default …)`.

Ensaio a seco rodado em 17/08 contra o banco real: a coluna **não existe**, e o
único comando previsto é o `alter table` de `migrations/001-ligacoes.sql`.

### 3 · Ensaio a seco da migração de DADO

```
node scripts/ligar-passos-existentes.mjs
```

Sem `--aplicar` ele **não grava nada**. Confira que **as ligações previstas por
automação são `blocos − 1`** — é uma corrente reta, e qualquer outro número
significa que o dado não é o que se espera. **Se divergir, pare.**

Medição de 14/08: "Bacana" 2 blocos → 1 ligação; "Fluxo de teste 1a" 5 → 4.

### 4 · Preencha a corrente

```
node scripts/ligar-passos-existentes.mjs --aplicar
```

Idempotente: automação que já tem ligações não é tocada. Rode **duas vezes** e
confirme que a segunda não muda nada — é a prova barata da idempotência.

### 5 · Confira antes de implantar

Cada automação tem `blocos − 1` ligações, todas `{"tipo":"sempre"}`, e a corrente
reproduz a ordem do array de hoje. **Este é o último ponto de volta sem
consequência para quem usa.**

### 6 · Implante a branch

Motor e editor juntos. Depois, com a aplicação no ar:

- abra uma automação no editor e confirme que **as setas desenhadas batem com a
  corrente migrada**
- arraste um bloco, salve, reabra — as ligações acompanharam?
- rode a automação de ponta a ponta com um dos dois perfis autorizados
  (**@jvsiqueira_** ou **@alicistica**) e confira em Atividade

### 7 · O quadro, item por item — a prova que a sessão não conseguiu dar

A Tarefa 6 (o quadro desenhando setas de verdade) **não pôde ser conferida na
tela**: os perfis de navegador guardados caem na tela de login, e entrar exigiria
a senha de admin ou forjar cookie — as duas proibidas na sessão que a construiu.
A metade pura de cada item está testada; a metade visual não.

**Confira estes seis, um a um, antes de considerar a fase entregue:**

- [ ] as setas desenhadas **batem com as gravadas** — abra uma automação migrada
      e compare com a corrente que o passo 5 conferiu
- [ ] arrastar de uma alça até outro bloco **cria a ligação**, e ela sobrevive ao
      salvar e reabrir
- [ ] um bloco com dois botões mostra **duas alças, cada uma nomeada**
- [ ] soltar um bloco **sobre uma seta** o põe no meio, e as duas ligações
      resultantes estão certas
- [ ] soltar num ponto vazio cria **bloco solto**, e a barra avisa em âmbar sem
      travar o salvar
- [ ] selecionar uma seta e apertar **Delete a apaga** — e apertar Backspace
      dentro de um campo de texto do painel **não** apaga seta nenhuma

**O último é o que fecha uma armadilha medida:** antes da correção não havia
gesto para tirar uma seta, e uma seta acidental num bloco final travava o salvar
da sessão inteira.

**E meça durante o gesto, não antes e depois.** Nesta base a comparação
antes/depois já aprovou item quebrado quatro vezes, porque o defeito preservava o
estado final.

### 8 · A prova que não pôde ser dada antes

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

**Antes do passo 6**, é só não implantar: a coluna `ligacoes` preenchida não é
lida por nenhum código no ar. A Fase 1b ignora a coluna inteira.

**Depois do passo 6**, voltar a aplicação para o commit anterior devolve o
comportamento antigo — a coluna fica no banco e é ignorada, exatamente como antes
do passo 4. **Não apague a coluna** para reverter; ela é inofensiva parada, e
apagá-la obrigaria a refazer a migração.

O que **não** volta sozinho: mensagens já entregues. Um botão de bifurcação já
enviado continua vivo na conversa da pessoa, e o payload de quatro partes deixa
de ser entendido se a aplicação voltar. **É o argumento mais forte para fazer o
passo 5 com calma.**
