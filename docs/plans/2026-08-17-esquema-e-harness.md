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

**Esta é a que muda o jogo**, e é o único item que teria pego os dois defeitos
plantados na Tarefa 4.

**Não é "testar tudo".** São três ou quatro caminhos, rodando o **motor de
verdade** contra um **banco de verdade**, num schema temporário criado e
destruído pelo próprio teste:

| caminho | o que ele prova |
|---|---|
| gatilho → entrega | a automação entrega o que o editor montou |
| toque em botão → braço certo | o payload de quatro partes leva ao destino certo |
| portão → link | a recompensa não sai para quem não segue |
| dreno → mensagem | os rótulos e payloads chegam pareados |

O quarto é literalmente o defeito que ninguém pegou.

**Por que schema temporário e não banco separado:** o Postgres já em uso serve;
cada rodada cria um schema com nome próprio, roda as migrações nele, e o derruba
no fim. Sem infraestrutura nova, sem tocar no banco de produção, e o mesmo
`DATABASE_URL` que os scripts já usam.

**O que isso custa, e é uma decisão real:**

- a suíte deixa de rodar em ~2 segundos; estes testes são de outra ordem de
  grandeza
- por isso eles ficam **separados** dos 485 puros — comando próprio, e o
  `verify` decide se os chama ou não
- exige que as migrações da Frente 1 existam, porque é delas que o schema
  temporário nasce. **A Frente 1 vem primeiro por dependência, não por
  preferência.**

**O que NÃO fazer:** transformar isto em suíte de integração que cresce sem
limite. A regra que mantém o valor: **um caminho novo entra aqui só quando um
defeito real escapou por ele.** A lista acima já tem três que escaparam.

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

---

## Quando

**Não durante a Fase 2a.** Faltam as Tarefas 5 a 8 e a revisão final; abrir
frente nova agora troca uma fase quase pronta por duas pela metade.

**Frente 1 primeiro**, porque a Frente 2 depende dela.

**A Frente 3 já está valendo** — é descrição, não construção.
