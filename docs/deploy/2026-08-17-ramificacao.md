# Implantação da Fase 2a — ramificação por botões

**Estado:** as doze tarefas terminaram, a revisão final da branch foi feita em
três frentes, e **os nove itens de tela foram provados ao vivo em 21/08**. **A
ordem já está fechada** e é o que este documento existe para registrar, porque
errá-la quebra todas as automações em silêncio.

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

### 2 · Crie as colunas — são DUAS

```
node scripts/migrar.mjs              # ensaio a seco, mostra o que faria
node scripts/migrar.mjs --aplicar    # grava
```

**São duas migrações**, e a segunda nasceu na Tarefa 9:

- `001-ligacoes.sql` — `automations.ligacoes`, o mapa de caminhos
- `002-entrega-sem-portao.sql` — `automations.entrega_sem_portao`, a chave por
  automação de entregar o link sem exigir o follow. Nasce `false`, que é o
  comportamento de hoje, então **nenhuma automação muda de veredicto** por causa
  dela

Ele **confere no banco** depois de aplicar, e não confia no próprio "aplicada" —
`if not exists` tem sucesso mesmo quando não faz nada, inclusive quando o arquivo
está errado. Espere ver as duas linhas de `CONFERIDO no banco`.

**LEIA O CÓDIGO DE SAÍDA, não só a tela.** Desde a Tarefa 9 o script sai
diferente de zero quando a migração não faz efeito ou quando a coluna existe
com forma diferente da esperada — é o que separa "seguiu" de "parou" num roteiro
executado à mão. Coluna ausente **no ensaio a seco** não conta como falha, de
propósito.

#### Uma armadilha achada na Tarefa 9, e ela vale para todo deploy futuro

**No banco de desenvolvimento, a coluna `entrega_sem_portao` já existe — e
ninguém decidiu aplicá-la.** O `npm run dev` de pé recompilou `lib/db.ts` e
rodou `ensureSchema` na requisição seguinte. Confirmado por `ordinal_position`:
ela é a coluna 31, a mais alta da tabela.

Ou seja: **enquanto `ensureSchema` existir, editar `lib/db.ts` com um servidor
de dev de pé É aplicar a migração.** "O script roda em ensaio a seco e para" não
basta para manter o banco intocado. Contra o banco de dev, `--aplicar` hoje é um
no-op. **Contra produção, não é** — lá o passo continua obrigatório e continua
sendo o que quebra o impasse.

É mais um argumento para a Frente 1 de `docs/plans/2026-08-17-esquema-e-harness.md`,
que tira o esquema de dentro da aplicação.

### 3 · Ensaio a seco da migração de DADO

```
node scripts/ligar-passos-existentes.mjs
```

Sem `--aplicar` ele **não grava nada**. Confira que **as ligações previstas por
automação são `blocos − 1`** — é uma corrente reta, e qualquer outro número
significa que o dado não é o que se espera. **Se divergir, pare.**

#### A ARMADILHA: "já tem N ligações, não mexida" é um AVISO, não um `ok`

O script é idempotente por uma regra só: **automação que já tem qualquer
ligação não é tocada.** Essa regra existe para proteger contra rodar duas vezes
— e ela **não distingue** "já migrada" de "meio ligada à mão". As duas saem na
tela com a mesma palavra: `ok`.

Medido em 20/08, no banco real:

| automação | ativa | blocos | ligações | esperado |
|---|---|---|---|---|
| Bacana | não | 2 | **0** | 1 |
| Fluxo de teste 1a | não | 6 | **1** | 5 |

Aquela ligação única de "Fluxo de teste 1a" é `{"quando":{"tipo":"botao"}}`,
sobra das provas de tela desta fase. **Se a migração rodar assim, o script pula
essa automação inteira** — ela vai para o ar com 6 blocos e uma seta, entregando
`steps[0]` e o braço daquele botão. **Quatro blocos ficam inalcançáveis, e nada
acusa**, porque o motor entrega o que alcança e cala sobre o resto.

**A conferência certa, então, não é só o número previsto.** Antes de preencher:

- toda automação tem **zero** ligações? Se alguma tiver, ela **não** será
  migrada — abra no editor e resolva à mão, ou zere a coluna dela de propósito
- só depois rode com `--aplicar`

Isto vale para qualquer banco, não só para este: a linha `ok … não mexida` é a
única saída do script que parece sucesso e pode ser perda silenciosa.

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

**Confira automação por automação, não o total.** Uma que ficou de fora por já
ter ligação (a armadilha do passo 3) some numa soma e aparece numa lista. E
confira que **todo bloco é alcançável a partir de `steps[0]`** — é o que o motor
vai fazer, e é a diferença entre "6 blocos gravados" e "6 blocos entregues".

### 6 · Implante a branch

Motor e editor juntos. Depois, com a aplicação no ar:

- abra uma automação no editor e confirme que **as setas desenhadas batem com a
  corrente migrada**
- arraste um bloco, salve, reabra — as ligações acompanharam?
- rode a automação de ponta a ponta com um dos dois perfis autorizados
  (**@jvsiqueira_** ou **@alicistica**) e confira em Atividade

### 7 · O quadro, item por item — a prova que a sessão não conseguiu dar

O dono liberou o Chrome com depuração remota em 18/08 e **parte destes itens
foi medida na tela**. O que ficou provado sai da lista; o resto continua aqui.

### JÁ PROVADO na tela — não precisa refazer

Medido em `Fluxo de teste 1a` (5 blocos, nenhuma seta gravada):

- **o editor abre e desenha** — 6 nós (5 blocos + gatilho), 11 alças
- **as setas desenhadas batem com as gravadas** — zero ligações desenhadas,
  zero gravadas. A única seta é `gatilho→primeiro bloco`, que é sintética
- **arrastar de uma alça cria a ligação** — a seta `ligacao-0` apareceu no
  quadro depois do gesto, e **o dono confirmou à mão**, com mouse de verdade.
  Vale registrar a diferença: a medição automatizada usa evento sintético, e o
  gesto de arrasto é justamente onde ela é mais frágil — a confirmação humana é
  a prova mais forte aqui, não a mais fraca
- **selecionar uma seta e apertar Delete a apaga** — era a armadilha que a
  revisão achou, e ela está fechada
- **a seta do gatilho é PROTEGIDA** — o React Flow não a marca como
  selecionável, então ela não pode ser apagada por engano
- **lista sem seta nenhuma mantém as regras de grafo caladas**, e o Salvar fica
  habilitado — é a decisão da Tarefa 5 confirmada na tela, e é o que impede o
  dono de ser trancado fora das automações antigas antes da migração

### PROVADO NA TELA em 21/08 — os nove, com o navegador do dono

A depuração remota foi liberada e **todos os itens que faltavam foram medidos ao
vivo**, no editor real, com 30 capturas guardadas. Nenhum defeito de produto.

- [x] **Backspace num campo do painel NÃO apaga a seta selecionada.** O cenário
      só existe com Ctrl segurado (nó + seta selecionados, painel aberto). A seta
      continuou lá **entre o keyDown e o keyUp**, e o campo perdeu um caractere —
      que é o que impede a prova de ser vazia
- [x] **A ligação sobrevive ao salvar e reabrir** — gravada no banco, redesenhada
- [x] **Bloco solto SOBRE a seta entra no meio.** Medido DURANTE o `dragover`: a
      seta acendeu, e as duas ligações resultantes foram conferidas pelo ponto de
      saída do traço, não pelo estado final
- [x] **Ponto vazio cria bloco solto**, a barra avisa em âmbar, o Salvar continua
      habilitado
- [x] **Dois botões, duas alças nomeadas** — e `+ Adicionar botão` faz a alça
      nascer na hora
- [x] **"Salvo, mas ficou pausada: …"** aparece na largura inteira, sem truncar,
      e a caixa "Ativa" volta sozinha para desmarcada
- [x] **A chave do portão CALA a acusação, e só ela.** A forma que faltava foi
      montada: menu com um braço passando pelo portão e outro direto no link.
      Desmarcada, um único impedimento e `ativa: false` no banco; marcada, barra
      muda e a **mesma automação publicou**; desmarcando, a acusação volta
- [x] **O menu solto sobre a seta RECUSA** — e a prova é do jeito certo: **no
      mesmo ponto (609,384)** em que "Mensagem" acendeu a seta e a partiu,
      "Mensagem com opções" não acendeu nada e virou bloco solto
- [x] **A alça "continuação"** mostra a seta, **não começa** arrasto, **não
      termina** arrasto (classes durante o gesto: `connectingto` sem `valid`,
      contra `connectingto valid` na alça normal) e **apaga com Delete**

#### O que essa sessão ensinou, e vale mais que os itens

**Um quase-falso-positivo.** No item da alça "continuação", a primeira medição
disse "não criou nada" — mas o **controle na alça normal também não criou**. Só
depois de dar tempo de assentamento o controle passou a funcionar, e aí a recusa
virou prova. **Sem o controle, o item teria passado pelo motivo errado.**

**Um sintoma disfarçado.** No meio da sessão cada evento de mouse passou a custar
~5s e estourar o socket. O sintoma não foi um erro: o quadro **panoramizava** em
vez de arrastar. Resolvido subindo o tempo limite.

**Nenhum `mousePressed` ficou sem `mouseReleased`.** Três scripts estouraram
tempo no meio de um gesto; nas três o `finally` correu, e depois foi conferido
`dragging === false`, sem traço de conexão e setas intactas. É a regra que nasceu
do dia em que a tela do dono ficou travada por minutos.

#### Uma correção a este documento

Este roteiro dizia que a ligação gravada de "Fluxo de teste 1a" produzia o caso
da alça de sobra. **Não produz:** ela é `botao/op_zgg37i` e **esse botão existe**,
então ela tem alça própria. O caso teve de ser construído à mão (soltar menu →
apagar os dois botões → arrastar a `sempre` → recolocar um botão).

#### O estado foi devolvido

Todo trabalho destrutivo foi feito numa **cópia** criada pelo botão Duplicar e
excluída pela tela ao fim. As duas automações estão como estavam — "Fluxo de
teste 1a" com 6 blocos e 1 ligação, "Bacana" com 2 blocos e 0 —, ambas pausadas.
A cópia esteve ativa por menos de um minuto e **nunca disparou; nada foi enviado
a perfil nenhum.**

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

**Antes do passo 6**, é só não implantar: as duas colunas novas não são lidas
por nenhum código no ar. A Fase 1b ignora `ligacoes` e `entrega_sem_portao`
inteiras.

**Depois do passo 6**, voltar a aplicação para o commit anterior devolve o
comportamento antigo — a coluna fica no banco e é ignorada, exatamente como antes
do passo 4. **Não apague a coluna** para reverter; ela é inofensiva parada, e
apagá-la obrigaria a refazer a migração.

O que **não** volta sozinho: mensagens já entregues. Um botão de bifurcação já
enviado continua vivo na conversa da pessoa, e o payload de quatro partes deixa
de ser entendido se a aplicação voltar. **É o argumento mais forte para fazer o
passo 5 com calma.**
