# O esquema sai da aplicação, e o motor passa a rodar em teste

**Estado:** proposto. **Não é para executar durante a Fase 2a** — ver *Quando*.
**Data:** 17/08/2026

---

## O que foi medido, e é o mesmo problema com duas roupas

Cinco tarefas de motor da Fase 2a produziram três medições que apontam para o
mesmo lugar.

**`lib/steps.ts` produziu zero defeitos.** Puro, sem nenhum import, testado.

**Apagar as correções que vivem em `lib/engine.ts` deixou a suíte 100% verde.**
A revisão da Tarefa 2 tentou de propósito: removeu as duas metades das correções
que moram no motor e rodou os 447 testes. Todos passaram.

**Dois defeitos plantados no coração da Tarefa 4 passaram por tudo.** O payload
do botão carregando o id do bloco em vez do id do botão; e os rótulos pareados ao
contrário dos payloads. Resultado: 485 testes verdes, `tsc` limpo, varredura
idêntica, e até a prova offline do próprio implementador. **Ninguém pegou.**

Um deles é, em português, *"o menu entrega só o primeiro botão"*.

### E a correção mostrou exatamente onde a fronteira está

O commit `3949e43` levou as duas regras para `lib/steps.ts`. Replantando os
mesmos defeitos **depois** da correção, medido:

| onde o defeito é plantado | quem pega |
|---|---|
| na **regra**, dentro de `lib/steps.ts` | 4, 6 e 2 testes vermelhos, conforme o caso — e um deles move a varredura |
| na **fiação**, no ponto de chamada em `engine.ts` / `queue-drain.ts` | **ninguém: 496 verdes, varredura idêntica** |

Isto corrige o que este documento afirmava antes — que a Frente 2 era o *único*
item capaz de pegá-los. Não é: levar a decisão para a função pura já pegou a
metade da regra, e é a metade maior.

**O que sobrou é menor e mais preciso:** em que ordem os argumentos entram na
função pura. Nada executa esses dois arquivos, então trocar dois parâmetros na
chamada continua invisível.

É exatamente a quarta linha da tabela da Frente 2 — *dreno → mensagem* — e é a
melhor notícia deste documento: o buraco passou de **invisível em qualquer
lugar** para **invisível só na linha de chamada**.

**O padrão é único: o que é puro é provável; o que é `server-only` é invisível.**

E o impasse do deploy é a mesma coisa de outro ângulo — o esquema mora dentro da
aplicação, então a estrutura só existe depois que o código sobe, e não dá para
preparar o banco antes.

---

## Frente 1 · O esquema sai da aplicação

**Já começou.** `migrations/` e `scripts/migrar.mjs` nasceram na Fase 2a porque
o impasse não deixava seguir sem eles. Falta terminar.

Hoje `ensureSchema` (`lib/db.ts`) roda **54 comandos de DDL** — 8 tabelas, 8
índices, 22 `alter table … add column` — memoizados por instância, ou seja, uma
vez na primeira requisição depois de cada deploy.

**O que fazer:** mover a DDL para arquivos numerados em `migrations/`, aplicados
por `scripts/migrar.mjs` no deploy, e reduzir `ensureSchema` a nada.

**O que ganha:**

- some a classe de impasse que a Fase 2a viveu — preparar o banco deixa de
  depender de subir o código
- a primeira requisição depois de cada deploy deixa de carregar 54 comandos
- a estrutura vira uma coisa que se lê num diretório, em ordem, em vez de um
  array de 54 strings

**O que precisa de cuidado, e é o motivo de não ser trivial:**

- **A rede não pode sumir antes da hora.** Enquanto `ensureSchema` existe,
  implantar sem rodar a migração ainda funciona. No dia em que ele morrer, deixar
  de rodar `migrar.mjs` passa a quebrar o deploy — e isso precisa ser
  intencional, não descoberto.
- **A tabela de controle vira obrigatória** no dia em que aparecer a primeira
  migração que MOVE DADO (renomear coluna preservando conteúdo, quebrar uma
  tabela em duas). Essas não são idempotentes por natureza. O contrato de hoje —
  *toda migração é `if not exists`* — está escrito no cabeçalho de
  `scripts/migrar.mjs` junto com este aviso.
- **`flow_step_index` está órfã** desde a Fase 1b e é candidata natural à
  primeira migração de remoção. Que é, justamente, uma que não é idempotente.

---

## Frente 2 · Um harness fino contra um banco descartável

**Esta é a que fecha a metade que sobrou.** Depois de `3949e43`, os dois defeitos
da Tarefa 4 são pegos quando plantados na **regra** — e continuam invisíveis
quando plantados na **fiação**, porque nada executa `lib/engine.ts` nem
`lib/queue-drain.ts`. É essa metade que mora aqui.

**Não é "testar tudo".** São três ou quatro caminhos, rodando o **motor de
verdade** contra um **banco de verdade**, num schema temporário criado e
destruído pelo próprio teste:

| caminho | o que ele prova |
|---|---|
| gatilho → entrega | a automação entrega o que o editor montou |
| toque em botão → braço certo | o payload de quatro partes leva ao destino certo |
| portão → link | a recompensa não sai para quem não segue |
| dreno → mensagem | os rótulos e payloads chegam pareados |

O quarto é literalmente o que continua invisível: trocar a ordem de dois
argumentos na chamada do dreno deixa 496 testes verdes e a varredura idêntica.

**Por que schema temporário e não banco separado:** o Postgres já em uso serve;
cada rodada cria um schema com nome próprio, roda as migrações nele, e o derruba
no fim. Sem infraestrutura nova, sem tocar no banco de produção, e o mesmo
`DATABASE_URL` que os scripts já usam.

**O que isso custa, e é uma decisão real:**

- a suíte deixa de rodar em ~2 segundos; estes testes são de outra ordem de
  grandeza
- por isso eles ficam **separados** dos 496 puros — comando próprio, e o
  `verify` decide se os chama ou não
- exige que as migrações da Frente 1 existam, porque é delas que o schema
  temporário nasce. **A Frente 1 vem primeiro por dependência, não por
  preferência.**

**O que NÃO fazer:** transformar isto em suíte de integração que cresce sem
limite. A regra que mantém o valor: **um caminho novo entra aqui só quando um
defeito real escapou por ele.** Os quatro da tabela escaparam de verdade, e o
quarto **ainda escapa** — é o único da lista que continua sem rede hoje.

---

## Frente 3 · A disciplina que já funciona, escrita

Não é trabalho novo — é registrar o que a Fase 2a mediu, para não se perder:

**Decisão vai para função pura.** Toda vez que isso foi feito nesta fase, o
defeito ficou visível. `envioDaDm` matou três cópias divergentes da mesma regra.
`caminhoDoBotao` nasceu **sem o cursor como argumento**, o que torna o erro
impossível de escrever em vez de apenas documentado.

**Prova que não pôde ser dada vai para o roteiro de deploy, não para o
relatório.** Foi o que se fez com o envio de vários botões: virou um passo que
alguém executa antes de subir, em vez de uma ressalva que ninguém relê.

**Varredura com contraprova.** Uma varredura que dá zero pode estar certa ou pode
não estar procurando. A da Fase 2a só virou prova quando plantaram defeitos nela
e ela acusou — inclusive um que a suíte inteira não vê.

**Toda revisão pergunta pelo chamador.** A pergunta, literal:

> *Cada variante que esta função aceita é produzida por alguém em produção? Se
> não, isso é deliberado e está escrito?*

**Por que ela existe.** A Fase 2a fez nove descobertas por medição, e **todas as
nove foram na fronteira entre camadas**, nunca dentro delas: o motor chamando o
arquivo puro com o argumento errado, o dreno pareando rótulo com payload
trocados, a Server Action filtrando o nível errado, o quadro filtrando sem olhar
o campo novo — e, a última, **um chamador que nunca existiu**.

`ligacaoEscolhida` aceita `{tipo:"botao"}` e `{tipo:"texto"}`. Produção a chama
**três vezes, sempre com `botao`**. A seta do "digitou" ficava desenhada,
editável, salva e validada, e o motor nunca a consultava. A função pura tinha
teste do caso de texto, e ele passava.

**Por que nenhuma ferramenta pega isso, medido:**

- **detector de código morto:** zero funções exportadas estão mortas — todas as
  44 têm chamador. Não é código morto, é **ramo** morto
- **cobertura de teste:** o ramo *está* coberto, por teste
- **`tsc` e `eslint`:** a variante é legítima, só ninguém a produz

**O que pega é a pergunta**, e ela custa uma linha. Quem a responde precisa
mostrar o chamador e a forma do argumento — não afirmar que existe.

**E a Frente 2 é quem a torna mecânica.** Um caminho de ponta a ponta "a pessoa
digitou em vez de tocar" teria falhado sozinho, sem depender de alguém ser
esperto na hora certa.

---

## Quando

**Não durante a Fase 2a.** Faltam as Tarefas 5 a 8 e a revisão final; abrir
frente nova agora troca uma fase quase pronta por duas pela metade.

**Frente 1 primeiro**, porque a Frente 2 depende dela.

**E a prioridade da Frente 2 subiu**, por uma medição da Tarefa 5. A decisão de
produto mais discutida da fase — **qual porta recusa o quê**, salvar ou ativar —
é uma linha de filtro em cada Server Action, e trocar as duas deixa **525 de 525
testes verdes**. Não é mais só "o código de entrega não tem rede": é a regra que
o dono do produto passou uma conversa inteira decidindo, sem nada que a segure no
lugar.

**A Frente 3 já está valendo** — é descrição, não construção.
