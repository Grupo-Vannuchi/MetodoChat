# O esquema sai da aplicação, e o motor passa a rodar em teste

**Estado:** proposto, e **corrigido em 24/08** com o que a Fase 2a mediu depois
de ele ser escrito. Quatro afirmações da versão original caíram — estão listadas
na seção seguinte, com o que as derrubou.

**A pergunta que decidia a ordem foi RESPONDIDA em 24/08, por sonda executada
contra o banco real: SIM, e por zero linhas de mudança.** A ordem se inverteu —
ver "A ordem" no fim.

**Data:** 17/08/2026 · **última correção:** 24/08/2026
**Contexto:** a Fase 2a está implantada. Suíte hoje: **677 testes puros**.

---

## O que caiu desde 17/08, e quem derrubou

Este documento nasceu antes da metade da Fase 2a. Quatro coisas que ele afirmava
foram medidas depois e não se sustentaram. Ficam escritas aqui **com o erro
junto**, porque um plano que só mostra a versão certa não ensina a duvidar da
próxima.

### 1 · "São três dependências separando a varredura do motor" — FALSO

A ideia era que `lib/engine.ts` não podia ser importado em teste por causa de
`./db`, `./ig` e `./qstash`, e que separá-las abriria o caminho barato.

**Medido em 24/08, por sonda executada e apagada:** `lib/engine.ts` **carrega no
vitest hoje, sem mudar uma linha**. `lib/db.ts` também — o cliente do banco nasce
dentro de `sql()`, não no topo do módulo, então importar não conecta.
`vitest.config.ts` já aponta `server-only` para o `empty.js` do próprio pacote.

**A barreira não é de IMPORTAÇÃO. É de CHAMADA.** A decisão lê fatos do banco no
meio do caminho — lê o e-mail e decide, pergunta à Meta se a pessoa segue e
decide, conta a tentativa com `returning` e decide.

Números do mesmo dia: das **22 funções** de `lib/engine.ts`, **19 alcançam banco,
rede ou fila**. Puras de verdade são **3, somando 24 linhas** — 3,4% do arquivo.
Nas quatro funções grandes, 410 linhas de código se repartem em **267 de efeito
e 143 de decisão**, e há **74 pontos de chamada de efeito**.

**A decisão não é uma camada para extrair. É recheio.** Qualquer plano que
comece por "separa a parte pura" precisa encarar esse número primeiro.

### 2 · "O resíduo é só a ordem dos argumentos na linha de chamada" — FALSO, E PIOR

A versão anterior comemorava que o buraco tinha encolhido para "trocar dois
parâmetros na chamada". A revisão final mediu que a linha de chamada pode fazer
coisa pior: **descartar o retorno da função pura e reconstruir o valor errado à
mão**. No caso medido, três tokens.

**Levar a decisão para o arquivo puro tornou o erro difícil de escrever, não
impossível.**

### 3 · "`flow_step_index` está órfã" — FALSO, e é o erro mais perigoso dos quatro

O documento a indicava como "candidata natural à primeira migração de remoção".

**Ela não está órfã.** `lib/engine.ts:1004` a **lê**, como reserva do cursor
antigo:

```
passoId: r?.flow_step_id ?? (r?.flow_step_index != null ? String(r.flow_step_index) : null)
```

Apagar a coluna sem tirar essa reserva quebraria o cursor de quem ainda
estivesse guardado no formato antigo.

**O que a medição do banco diz, em 24/08:** 92 contatos, **zero** com o cursor
antigo. E nada mais **escreve** valor não-nulo ali — as duas ocorrências em
`lib/engine.ts` só o zeram. A coluna só encolhe.

Então a remoção é possível, mas é de **dois passos e nessa ordem**: tirar a
leitura de reserva do código, e só depois derrubar a coluna. E continua sendo a
primeira migração que **move** — o que torna a tabela de controle obrigatória
(ver Frente 1).

### 4 · Os números da suíte envelheceram

O texto citava 447, 485, 496 e 525 testes em momentos diferentes. **Hoje são
677.** As conclusões daquelas medições continuam valendo; os números, não.

---

## O que foi medido e CONTINUA valendo

A tese central do documento sobreviveu a tudo, e ficou mais forte:

**O que é puro é provável; o que é `server-only` é invisível.**

A revisão final da Fase 2a plantou **14 defeitos**. **Oito sobreviveram** a 677
testes, ao `tsc`, ao `eslint` e à varredura exaustiva — e **todos os oito estão
em arquivos que nenhum teste importa** (`lib/engine.ts`, `lib/queue-drain.ts`,
`app/automacoes/actions.ts`). Os **seis** que morreram estão **todos** em
arquivos que os testes importam. **Zero exceções.**

Entre os sobreviventes, em português: *"o dreno entrega só o primeiro botão"* e
*"o toque em botão pula a regra do portão"*.

**CINCO DOS OITO DEIXARAM DE SOBREVIVER EM 25/08.** Três caíram com o primeiro
caminho da Frente 2 (os do portão) e dois com o segundo (os do dreno), todos
replantados um a um e medidos (ver "A prova que fecha" e "A segunda prova que
fecha", mais abaixo). **Os três que sobram continuam em arquivos que nenhum
teste importa**, e dois deles são o mesmo arquivo: `app/automacoes/actions.ts`.

Sobre *"o dreno pareia rótulo com payload trocados"*, o segundo caminho mediu
uma coisa que muda como se lê a lista: **a linha em que a revisão o plantava não
existe mais**. A correção da Tarefa 4 levou o mapeamento para a função pura, e o
dreno passou a só entregar a forma pronta. O defeito foi replantado **reescrevendo
o `map` histórico** para provar que morre — e morre —, mas a superfície natural
dele foi fechada por construção, não por teste.

---

## O que já foi fechado SEM a Frente 2

Vale registrar, porque muda o tamanho do que falta.

A classe mais grave — **descartar a regra do portão na linha de chamada** — foi
fechada em 21/08 por **23 linhas**, estreitando um tipo. `executarFluxo` aceitava
`de: string | null | Retomada`; como `Retomada.destino` é `string | null`,
escrever `.destino` num ponto de chamada **compilava**.

Hoje ele exige `Retomada`, e as três dispensas deliberadas dizem o nome. Medido:
plantando as **cinco** formas de escrever o erro, o `tsc` acusa **as cinco**.

**A lição para o resto do plano:** nem tudo que parece precisar de harness
precisa. Antes de construir infraestrutura, vale perguntar se o erro pode ser
tornado **impossível de escrever**. Foi o que funcionou aqui, e foi barato.

---

## Frente 1 · O esquema sai da aplicação

### Onde está

**Começou.** `migrations/` e `scripts/migrar.mjs` nasceram na Fase 2a porque o
impasse do deploy não deixava seguir sem eles. **Em 26/08 o esquema base entrou
na pasta**, e são seis migrações:

| | |
|---|---|
| `000-esquema-base.sql` | as 42 instruções da lista `DDL`, os dois `alter` extras e a semente de `config` |
| `001-ligacoes.sql` | a coluna do mapa de caminhos |
| `002-entrega-sem-portao.sql` | a chave por automação |
| `003-fila-sobrevive-a-automacao.sql` | a fila deixa de morrer com a automação |
| `004-fila-tipos-novos.sql` | `queue_kind_check` com os 9 tipos, tirada de `migrateAccounts` |
| `005-contatos-chave-composta.sql` | a chave primária `(account_id, ig_id)`, tirada de `migrateAccounts` |

**`000` e não `004`** porque `migrar.mjs` aplica por ordem de nome, e `001`,
`002` e `003` são `alter table` sobre tabelas que num banco vazio ainda não
existem.

**A REDE CAIU EM 26/08.** `ensureSchema()` foi apagado — a lista `DDL`, o
`migrateAccounts`, a memoização e a função inteira —, e com ela os **24 pontos de
chamada em 15 arquivos**. `lib/db.ts` caiu de 763 para 403 linhas, e **nada na
aplicação executa DDL**.

**O que autorizou a remoção:** `testes-integracao/esquema-base.integracao.ts`
montou um schema descartável por lado e os comparou campo a campo. Medido em
26/08, com **8 tabelas, 99 colunas, 16 índices e 16 restrições de cada lado: ZERO
divergências**. A remoção foi, por isso, apagamento puro — sem tradução no meio.

**O que a substituiu, e a palavra é a diferença inteira:** `lib/esquema.ts`
CONFERE, e não CRIA. Uma consulta de catálogo, uma vez por instância, chamada de
um lugar só (`register()` de `instrumentation.ts`), que **recusa servir** se o
banco estiver atrás. Nenhuma linha dela emite DDL, e há um caso de teste que
falha se alguém a fizer criar.

### O que fazer

1. ~~**Mover as 42 instruções** para arquivos numerados em `migrations/`~~ —
   **FEITO em 26/08**, num arquivo só (`000`), por transcrição extraída do
   próprio `lib/db.ts` e não por cópia à mão
2. ~~**Separar o que não é esquema**~~ — **FEITO**, e a armadilha abaixo era
   maior do que estava escrito: ver "TRÊS, e não duas"
3. ~~**Reduzir `ensureSchema` a nada**, e limpar os 27 pontos de chamada~~ —
   **FEITO em 26/08.** Eram **24** chamadas em 15 arquivos (o 27 contava os
   `import`). O degrau veio com duas coisas que não estavam na lista, e as duas
   foram medidas antes de escritas: a trava de produção deixou de poder **pular
   calada** num build, e a aplicação ganhou uma **conferência de partida** no
   lugar da criação. Ver "O QUE O DEGRAU 3 MEDIU", no fim desta seção
4. **Criar a tabela de controle** — ver o aviso abaixo

### O passo 2 está CERTO NA INTENÇÃO E PERIGOSO NA LETRA

A versão anterior dizia: *"a semente de `config` e o `migrateAccounts` não são
DDL e não devem viajar junto"*. A semente, sim. O `migrateAccounts`, **não** — e
a sonda de 24/08 mediu por quê.

**`migrateAccounts` carrega duas mudanças de FORMA que a lista `DDL` não tem:**

| | a `DDL` diz | o que de fato fica no schema |
|---|---|---|
| chave primária de `contacts` | `ig_id text primary key` (`db.ts:367`) | **`primary key (account_id, ig_id)`** |
| `queue_kind_check` | 5 tipos (`db.ts:375`) | **9 tipos** |

Descartá-lo como "migração de dado" faria **todo banco novo nascer com a chave
primária errada** — o `on conflict (account_id, ig_id)` estoura em runtime — e
**recusando quatro tipos de fila em uso**. Quebraria em produção, não em teste.

**O que fazer:** extrair essas duas mudanças de forma para migrações próprias
ANTES de mexer no `migrateAccounts`. O resto dele é dado, seleciona zero linhas
num banco vazio, e aí sim pode sair.

#### TRÊS, e não duas — medido em 26/08

A tabela acima está certa e está **incompleta**. Sonda de 26/08: dois schemas
descartáveis, um com a lista `DDL` sozinha e outro com `ensureSchema()` inteiro,
comparados campo a campo pelo catálogo. Saíram **quatro divergências**, que são
**três mudanças** (a chave primária conta duas vezes, pela restrição e pelo
índice que a implementa):

| | a `DDL` deixa | `migrateAccounts` faz ficar |
|---|---|---|
| restrição `contacts_pkey` | `PRIMARY KEY (ig_id)` | **`PRIMARY KEY (account_id, ig_id)`** |
| índice `contacts_pkey` | `btree (ig_id)` | **`btree (account_id, ig_id)`** |
| **coluna `contacts.account_id`** | **`nao_nulo=false`** | **`nao_nulo=true`** |
| restrição `queue_kind_check` | 5 tipos | **9 tipos** |

**A terceira não está escrita em lugar nenhum**, e é o achado: `account_id` nasce
de um `alter table … add column if not exists account_id text`, sem `not null`.
Quem a torna `not null` é o próprio `add primary key`, por definição do Postgres.
Uma migração que instalasse a chave "na mão" — um índice único, por exemplo —
produziria um schema **parecido e não igual**, e a diferença só apareceria no dia
em que uma linha com `account_id` nulo fosse gravada.

**Medido também, porque a pergunta é legítima:** derrubar a chave antiga **não**
solta o `not null` de `ig_id`. Ele continua `nao_nulo=true` dos dois lados.

**A lição é a mesma da pergunta pelo chamador:** a tabela de 24/08 listava o que
alguém tinha ido procurar. A de 26/08 é o que o catálogo devolveu quando a
pergunta foi "o que MUDA", sem lista de candidatos. As duas formas de perguntar
não dão o mesmo número.

**A semente de `config`** (uma linha, com o token do webhook) é desejável até em
banco de teste — ela não é DDL, mas é pré-requisito de funcionamento.

### O que ganhou — MEDIDO em 26/08, e não estimado

- some a classe de impasse que a Fase 2a viveu: preparar o banco deixou de
  depender de subir o código
- **a primeira requisição de cada instância**: de **49 idas ao banco e 1398 ms**
  (a frio, contra um schema vazio deste mesmo Postgres) para **zero**. Das 49, 26
  eram `alter table`, que pede trava exclusiva de tabela. No lugar entrou UMA
  consulta de catálogo, de **19 a 23 ms**, memoizada por instância
- **a rodada de integração inteira** caiu de **61,1 s para 41,2 s** — oito
  arquivos que deixaram de montar o esquema pela aplicação
- **A ARMADILHA DA TAREFA 9 SUMIU, e foi medida sumindo.** Com um servidor de dev
  apontado para um schema descartável: coluna `automations.ligacoes` derrubada à
  mão, `lib/db.ts` editado com o servidor de pé, requisição feita — **a coluna
  continuou ausente**. Antes, editar aquele arquivo era aplicar a migração; foi
  assim que `entrega_sem_portao` nasceu no banco de produção
- a estrutura virou coisa que se lê num diretório, em ordem, em vez de um array

### O QUE O DEGRAU 3 MEDIU, e que não estava na lista

**1 · A trava de produção podia pular CALADA, e isso deixou de ser inofensivo.**
Com a caixa "Enable access to System Environment Variables" desmarcada,
`VERCEL_ENV` some, o script pulava com código 0 e o build seguia. Enquanto
`ensureSchema` existia, isso devolvia o estado antigo. Sem ele, seria um deploy
verde sobre um banco sem migração.

A pergunta "dá para distinguir um build da Vercel sem as variáveis de uma máquina
qualquer?" foi levada à documentação da Vercel, e a resposta é **NÃO, por
construção**: `VERCEL=1` é definida como *"an indicator to show that system
environment variables have been exposed"* — ela **é** o indicador da caixa, e
`CI`, `VERCEL_URL` e as outras saem pela mesma. Então o script parou de perguntar
ao ambiente e passou a exigir **prova**: `VERCEL_ENV` (é um deploy) ou
`.env.local` (é a máquina de alguém — o arquivo que o `.gitignore` mantém fora do
repositório, e cuja ausência num build da Vercel já estava medida desde o ENOENT
de 26/08). Sem prova nenhuma, **recusa com código 1**, e o `next build` não roda.
A mesma prova passou a ser exigida do `--a-mao`, o que fecha o espelho do buraco.

**2 · O que a aplicação faz se uma coluna faltar — medido, e é o pior caso.**

| | com `automations.ligacoes` | sem ela |
|---|---|---|
| mensagens enfileiradas | **3**, na ordem do grafo | **1** |
| `ignorados` | 0 | **0** |
| erro | nenhum | **nenhum** |

A chave nem chega na linha: `select *` devolve o objeto sem ela, e `interpretar`
lê `undefined`. É o mesmo formato do precedente da `003`. O contraste importa: um
`select` que **nomeia** a coluna estoura `42703`, e uma tabela ausente estoura
`42P01` — os dois ALTO. **A única forma calada é a coluna ausente lida por
`select *`**, e é exatamente ela que a conferência de partida cobre.

**O caminho real por onde isso aconteceria é o PREVIEW:** a trava pula em deploy
de branch, de propósito, e o preview fala com o mesmo banco. Uma branch com
migração nova encontraria o banco sem ela e pareceria funcionar.

**A tabela de controle vira obrigatória** no dia da primeira migração que MOVE
dado — e a remoção de `flow_step_index` é exatamente ela. O contrato de hoje
(*toda migração é idempotente*) está escrito no cabeçalho de
`scripts/migrar.mjs`, junto com o aviso de que a tabela não existe.

**A conferência de `migrar.mjs` precisa acompanhar.** Ela já aprendeu duas vezes:
na Tarefa 9 passou a aferir forma de coluna (tipo, nulidade, padrão), e em 24/08
passou a aferir **chave estrangeira**, porque a `003` não cria coluna nenhuma. O
próprio arquivo tinha previsto esse dia. **Toda migração de forma nova exige
perguntar se a conferência sabe enxergá-la** — senão ela imprime "CONFERIDO"
sobre outra coisa.

---

## Frente 2 · Um harness fino contra um banco descartável

### O que ela é

Caminhos rodando o **código de verdade** contra um **banco de verdade**, num
schema temporário criado e destruído pelo próprio teste. São **cinco**: quatro
entram pelo motor, e o quinto pelas duas portas de publicar.

**Não é "testar tudo".** É fechar a metade que nenhum teste puro alcança — os
oito defeitos que sobreviviam quando isto foi escrito. **Cinco morreram nos
quatro primeiros caminhos e dois no quinto; sobra um**, num componente de tela,
fora de alcance por decisão do dono (o porquê está mais abaixo). Além deles, um
defeito que ninguém tinha na lista foi achado **por teste**, e não por plantio.

| caminho | o que prova | prioridade |
|---|---|---|
| **portão → link** | a recompensa não sai para quem não segue | **1ª — FEITO em 25/08** |
| **dreno → mensagem** | rótulos e payloads chegam pareados | **2ª — FEITO em 25/08** |
| toque em botão → braço certo | o payload de quatro partes leva ao destino certo | **3ª — FEITO em 25/08** |
| gatilho → entrega | a automação entrega o que o editor montou | **4ª — FEITO em 25/08** |

**A prioridade mudou em 21/08**, e a medição que a mudou: o defeito de três
tokens que passou por tudo estava no caminho do portão, não no do dreno.

### Onde está — a FUNDAÇÃO E OS CINCO CAMINHOS

**Os quatro caminhos da tabela acima estão escritos, e um quinto entrou depois
deles pela regra do fim desta frente.**

| | |
|---|---|
| `testes-integracao/portao-link.integracao.ts` | **portão → link**, o 1º da tabela acima — 4 casos |
| `testes-integracao/dreno-botoes.integracao.ts` | **dreno → mensagem**, o 2º da tabela acima — 4 casos |
| `testes-integracao/toque-botao.integracao.ts` | **toque em botão → braço certo**, o 3º — 4 casos |
| `testes-integracao/gatilho-entrega.integracao.ts` | **gatilho → entrega**, o 4º — 4 casos |
| `testes-integracao/portas-de-publicar.integracao.ts` | **as duas portas de publicar** — 5 casos |
| `testes-integracao/semear-requisicao.ts` | a fundação do 5º: semeia o escopo de requisição do Next, com a guarda |

Com a fundação (4 casos), a suíte de integração é de **25 casos em 6 arquivos**.

**O nó dele era a Meta, e ele foi desatado sem mock.** O portão pergunta à Meta
se a pessoa segue, e a resposta decide se a recompensa sai. Deixar a chamada
FALHAR é a saída que parece inofensiva e é a pior: `checkFollowsAccount` engole
o erro e devolve `null`, `resolverFollow` trata `null` como PASSOU — o teste
exercitaria justamente o ramo que NÃO prova a promessa, depois de ter disparado
uma requisição de verdade contra a Meta com um token inventado.

O que se fez: um **servidor HTTP na própria máquina**, que o teste sobe e
derruba, com a base do Graph apontada para ele por `IG_GRAPH_BASE`. **Não é
mock** — o `fetch` é real, a resposta é HTTP de verdade, o parsing é o do
`graphFetch`, e quem decide é o `resolverFollow` de verdade. O que foi
substituído é a **fronteira de rede**, e só ela. Medido: **6 requisições HTTP
reais** atravessam essa fronteira só no primeiro caso.

**Custou 12 linhas em `lib/ig.ts`** — `baseDoGraph()`, lida no momento da
chamada, com o valor real como padrão e **duas travas independentes**: `VITEST
=== "true"` (medido: no vitest deste projeto, `VITEST=true`, `NODE_ENV=test`; o
`next dev`, o `next build` e a Vercel não a definem) **e loopback só** (o
`access_token` viaja na query destas chamadas, então base apontando para fora
seria exfiltração de credencial por painel de deploy). **As duas são medidas por
teste, não afirmadas em comentário.**

**Recusado por medição:** desviar o DNS por um dispatcher do `undici` manteria o
`fetch` real, mas `undici` **não está instalado** (`require` → MODULE_NOT_FOUND),
seria dependência nova, e como a URL é `https` exigiria certificado
auto-assinado de fixture — além de sequestrar um hostname REAL no processo
inteiro, sem nome nenhum no código dizendo que isso aconteceu.

### A PROVA QUE FECHA: três dos oito sobreviventes MORRERAM

Os três defeitos deste caminho foram plantados de novo, um por vez, e medidos
contra tudo o que existe:

| defeito plantado | `tsc` | `eslint` | 677 puros | varredura | **caminho novo** |
|---|---|---|---|---|---|
| o motor ignora `retomada.portao` (bloco apagado) | 0 | 0 | 677 ✓ | SEM VAZAMENTO | **3 vermelhos** |
| e-mail já conhecido pula a regra do portão | 0 | 0 | 677 ✓ | SEM VAZAMENTO | **1 vermelho** |
| toque em botão pula a regra do portão | 0 | 0 | 677 ✓ | SEM VAZAMENTO | **1 vermelho** |

**Sobre o terceiro, a dúvida era legítima e a medição a separou em duas
metades.** A união estreitada de 21/08 fechou a forma MUDA: escrever
`executarFluxo(…, caminho.retomada.destino)` **não compila** (TS2345, medido). Ela
**não** fecha a forma NOMEADA: `semRegraDoPortao(caminho.retomada.destino)`
compila, passa no eslint, deixa os 677 verdes e a varredura imprime "SEM
VAZAMENTO". **É essa metade que o caminho novo fecha** — e é a lição inteira da
Frente 2 num caso só: tornar o erro impossível de escrever fecha a porta da
frente, e a dispensa deliberada continua sendo uma porta.

### O SEGUNDO CAMINHO: o dreno e os botões

`lib/queue-drain.ts` é onde a fila vira mensagem no Instagram, e **nenhum teste
do projeto o importava**. Ele já escondeu dois defeitos plantados que passaram
por 485 e por 671 verdes, `tsc` e `eslint` limpos.

**Ele não precisou de mecanismo novo:** herdou `IG_GRAPH_BASE`/`baseDoGraph()` do
primeiro caminho e a guarda que falha ANTES de qualquer requisição sair. A
diferença é o que atravessa a fronteira: lá era uma consulta, aqui é um **POST de
envio de mensagem**, com o texto e os botões dentro.

**A prova é feita no FIO** — o corpo JSON que chegou no servidor local —, e o caso
central fecha o círculo inteiro: o motor escreve os payloads, o dreno os entrega,
o payload do **terceiro** botão é lido **do fio** e devolvido ao motor como toque,
e o braço que chega é o que o **rótulo** daquele botão prometia. Afirmar só os
títulos passaria com os payloads embaralhados entre si — e isso foi medido, não
suposto (ver a linha "payloads rodados uma casa" na tabela abaixo).

**Sobre o teto de 13 da Meta, o dreno TEM o que dizer, e são duas coisas:** ele
corta preservando a ordem e o pareamento do que sobrou, **e** grava
`quick_replies_cortados` em Atividade, com o total e o limite. Os dois são
afirmados. Desde a Tarefa 5 `conferirLista` recusa ATIVAR um bloco com mais de 13
botões, então a porta que sobra para exceder é o `jsonb` editado por fora do
painel — que é exatamente a porta que o dreno diz defender, e é por ela que o
caso entra.

### A SEGUNDA PROVA QUE FECHA: os dois defeitos do dreno MORREM

| defeito plantado | onde | `tsc` | `eslint` | 677 puros | **caminho novo** |
|---|---|---|---|---|---|
| o dreno entrega só o primeiro botão (`slice(0, 1)`) | `lib/queue-drain.ts` | 0 | — | **677 ✓** | **2 vermelhos** |
| rótulo e payload trocados na função pura | `lib/steps.ts` | 0 | — | 671 (6 vermelhos) | **2 vermelhos** |
| rótulo e payload trocados, com o `map` histórico reescrito no dreno | `lib/queue-drain.ts` | 0 | 0 | **677 ✓** | **2 vermelhos** |
| payloads rodados uma casa: rótulos certos, cada botão leva ao destino do vizinho | `lib/queue-drain.ts` | 0 | — | **677 ✓** | **2 vermelhos** |

**As três linhas com 677 verdes são o ponto.** O plantio na função pura morre nos
testes puros (6 vermelhos) porque `botoesDaMensagem` é alcançável; os outros três
vivem no `server-only` e não têm quem os veja — até este caminho.

**A quarta linha existe para provar o próprio teste**, e não o produto: com os
rótulos todos certos e só os payloads rodados, um teste que comparasse os títulos
passaria. É o formato exato do defeito histórico da Tarefa 4 ("cada botão levaria
a pessoa ao destino de OUTRO botão"), e é a razão de o caso afirmar o par inteiro
e depois fazer a volta pelo motor.

### O TERCEIRO CAMINHO: o toque em botão e o braço dele

`testes-integracao/toque-botao.integracao.ts` — 4 casos. A prova é feita olhando
**a fila, o cursor e a Atividade**, nunca perguntando de novo à função que
decidiu. E o toque **não é forjado**: o payload vem da fila, achado pelo
**rótulo** do botão, que é exatamente o que a Meta devolve quando a pessoa toca
no botão que mostra aquele rótulo. Nenhuma string de payload é montada à mão.

Os quatro: cada botão ao braço dele (duas pessoas, o mesmo menu, e a `senao` não
sai para nenhuma); quem digita cai na `senao` (com o texto mencionando uma das
opções de propósito — um motor que casasse por rótulo cairia no braço errado); o
botão **antigo** continua indo ao braço dele, com a pessoa já num segundo menu; e
botão sem caminho não entrega nada e vira linha em Atividade, nas duas formas de
orfandade.

### O QUARTO CAMINHO: do gatilho até a entrega

`testes-integracao/gatilho-entrega.integracao.ts` — 4 casos. É o único que
atravessa o sistema inteiro numa tacada: webhook → `handleMessagingEvent` /
`handleCommentEvent` → `interpretar` → fila → `drainQueue` → o corpo JSON que
chegaria à Meta. Os três anteriores mediam um trecho cada; este mede a costura.

Os quatro: a ordem é a do **grafo**, não a do array (array embaralhado de
propósito, e o bloco solto não sai por caminho nenhum); a espera do editor segura
o que vem depois **e depois solta** — com o tempo passando pela coluna que o
dreno compara, não por relógio falso; o gatilho por comentário fura a janela, com
a resposta privada endereçada ao comentário e a pública saindo pelo **outro**
caminho de rede; e o gatilho certo dispara a automação certa, com duas ativas ao
mesmo tempo.

**Uma trava nova, que os anteriores não precisavam:** este arquivo tem um item
adiado, e `enqueue`/`drainQueue` chamam `scheduleTick` (lib/qstash.ts) quando há
um. Essa chamada **não** passa por `baseDoGraph()`. O `beforeAll` apaga
`QSTASH_TOKEN` e **afirma** `qstashEnabled() === false`, em vez de torcer.

### O ACHADO QUE NENHUM PLANTIO PLANTOU — e é o melhor argumento da Frente 2

**As mensagens de uma automação chegavam fora de ordem na conversa da pessoa.**
Defeito de produção, antigo, em `lib/queue-drain.ts`. Não é regressão de nada
deste trabalho — e **ninguém tinha como ver, porque nenhum teste executava o
dreno** até esta frente existir.

Ele apareceu sozinho: o primeiro caso do quarto caminho **nasceu** afirmando a
ordem no fio, e falhou. A consulta que reivindica o lote era

```sql
update queue q set status = 'sending', … where q.id in (
  select id from queue where … order by created_at limit 15 for update skip locked
) returning q.*
```

O `order by` vive **dentro da subconsulta**: ele decide QUAIS itens entram no
lote, não em que ordem o `returning` os devolve — e a ordem do `returning` de um
`update` não é especificada pelo Postgres. O laço que envia segue a ordem que
vier.

Medido, com `created_at` distinto e crescente (26 ms entre itens): três itens
voltaram `3, 1, 2` numa execução e `2, 3, 1` noutra; oito voltaram
`u8 u5 u6 u7 u1 u4 u2 u3`. Em produção isso é "Oi! Toca no botão pra receber o
link" chegando **depois** do cartão com o link.

**Consertado em 25/08** (`61c82d2`), com a ordenação subindo para um `with` por
fora do `update` — e **não** para um `items.sort()` em JavaScript. A escolha foi
por medição, não por gosto: o driver (postgres.js) entrega `created_at` como
`Date`, de resolução de **milissegundo**, e o Postgres guarda **microssegundo**;
com oito itens separados por 200 µs — que é o que acontece quando o banco está
perto do app, e não a 26 ms como nesta máquina — o `sort` em JS devolveu
`u1 u4 u3 u2 u8 u6 u5 u7`, porque os microssegundos já tinham sido jogados fora
antes de o JavaScript ver a coluna. Custo das duas formas: **833 ms contra
835 ms** em 20 rodadas. O `explain` confirma que o `skip locked` continua debaixo
do `limit`, dentro da CTE.

Sobre **empate de `created_at`** — dois itens gravados no mesmo instante existem
—, a ordenação é `(created_at, id)`. Medido com 12 linhas empatadas, 6 leituras:
**1 resultado distinto**, ou seja a mesma ordem em toda drenagem e retentativa.
Ela **não** recupera a ordem de inserção dos empatados: o `id` é
`gen_random_uuid()` e `queue` não tem coluna monotônica. O que ela promete é
estabilidade, não adivinhação — recuperar inserção exigiria coluna nova, que é
migração em banco vivo e decisão de outro dia.

**Por que isto é o melhor argumento que a Frente 2 tem de existir:** todos os
outros achados desta frente vieram de defeito **plantado** — alguém escolheu o
defeito, escondeu, e mediu quem via. Este não. Ele estava lá, em produção, e a
única coisa que precisou acontecer foi um teste executar o dreno de verdade e
perguntar a coisa certa. Plantio prova que o teste tem dentes; achado prova que
os dentes servem para alguma coisa.

### O PLACAR DOS PLANTIOS — com o viés declarado

Dez plantios nos caminhos 3 e 4, um por vez, medidos contra tudo o que existia:

| defeito plantado | onde | `tsc` | `eslint` | 677 puros | varredura | **caminho novo** |
|---|---|---|---|---|---|---|
| `ligacaoEscolhida` deixa de comparar o id do botão | `lib/steps.ts` | 0 | 0 | 668 (9 vermelhos) | SEM VAZAMENTO | **2 vermelhos** |
| `caminhoDoBotao` cai na `senao` quando o botão não tem ligação | `lib/steps.ts` | 0 | 0 | 676 (1 vermelho) | SEM VAZAMENTO | **1 vermelho** |
| **o toque resolve a ligação a partir do CURSOR, não do payload** | `lib/engine.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **1 vermelho** |
| **`payloadDoBotao` chamado com bloco e botão trocados** | `lib/engine.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **3 vermelhos** |
| `retomadaDoTexto` deixa de consultar a `senao` | `lib/steps.ts` | 0 | 0 | 675 (2 vermelhos) | **ACUSOU** | **1 vermelho** |
| `interpretar` volta a caminhar pelo ARRAY | `lib/steps.ts` | 0 | 2 | 666 (11 vermelhos) | **87.420 VAZAMENTOS** | **2 vermelhos** |
| **a resposta privada some do `kind`** | `lib/engine.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **1 vermelho** |
| **o dreno perde o link da resposta privada** | `lib/queue-drain.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **1 vermelho** |
| **o dreno ignora `not_before` (a espera some)** | `lib/queue-drain.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **1 vermelho** |
| **`findMatch` cai em `automations[0]` quando nada casa** | `lib/engine.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **3 vermelhos** |

**Seis das dez passaram por `tsc`, `eslint`, os 677 puros e a varredura, e só o
caminho novo as viu. Nenhuma das dez sobreviveu.**

E o replantio do defeito de ordem, feito depois do conserto, tem a mesma forma:
tirar o `order by created_at, id` de fora da CTE deixa `tsc`, `eslint` e os 677
limpos, e devolve o vermelho no primeiro caso do quarto caminho.

**O VIÉS, declarado:** cada plantio foi escolhido **por quem escreveu os casos**
para ser plausível **e alcançável** por eles, e isso pende a favor. Dez de dez
mortos não é taxa de detecção — é a confirmação de que os casos têm dentes
**onde foram apontados**. O que mede o resto é o achado da seção anterior, que
ninguém apontou.

### O QUINTO CAMINHO: as duas portas de publicar

`testes-integracao/portas-de-publicar.integracao.ts` — 5 casos, sobre
`testes-integracao/semear-requisicao.ts`. Ele exercita `salvarAutomacao` e
`toggleAutomation` de `app/automacoes/actions.ts` contra o schema descartável.

**ELE NÃO ESTAVA NO PLANO ORIGINAL, e a razão é a regra da Frente 2:** *"um
caminho novo entra só quando um defeito real escapou por ele."* Escaparam
**dois**, e os dois moram naquele arquivo, que não tinha nenhum teste que o
importasse.

**O nó nunca foi o banco.** As duas funções passam por `getSelectedAccountId`
(lib/account.ts), que chama `cookies()` de `next/headers`; fora de uma requisição
isso estoura com "`cookies` was called outside a request scope". O nó é o
**escopo de requisição do Next**, e ele foi desatado com quatro peças do próprio
pacote `next`, sem uma linha de produção:

| peça | de onde | por quê |
|---|---|---|
| planta `globalThis.AsyncLocalStorage` | `next/dist/server/node-environment-baseline.js` | sem ela o Next cai no `FakeAsyncLocalStorage`, cujo `run()` lança |
| `createRequestStoreForAPI` | `next/dist/server/async-storage/request-store.js` | monta a jarra de cookies e os headers |
| `createWorkStore` | `next/dist/server/async-storage/work-store.js` | sem ele `revalidatePath` não acha `incrementalCache` |
| `IncrementalCache` | `next/dist/server/lib/incremental-cache/index.js` | o cache real, em memória — sem `fs`, sem `serverDistDir` |

**A ordem é obrigatória:** `createAsyncLocalStorage` lê
`globalThis.AsyncLocalStorage` **uma vez, na avaliação do módulo**. Em Node puro
esse global não existe (medido: Node v24.16.0 → `undefined`). Quem carregar os
módulos de armazenamento antes do baseline não tem conserto depois.

**NADA É IMITADO, E NENHUM COOKIE É FORJADO.** Sem `vi.mock`, sem `vi.stubGlobal`,
sem banco de mentira: os dois armazenamentos são `AsyncLocalStorage` **do Node**
(conferido com `instanceof`), exportados pelos módulos `.external.js` do próprio
Next, e `cookies()` continua sendo o `cookies()` do Next. **A jarra sai VAZIA** —
sem `metodochat_session`, sem `metodochat_account`. `getSelectedAccount` cai na
**primeira conta** quando o cookie está ausente, e o schema descartável tem
exatamente uma. **Esse tombo é o comportamento declarado da função**, e não uma
brecha: a conta que as portas enxergam é a conta do teste por construção do
schema, não por credencial inventada.

**O limite honesto, o mesmo dos outros quatro:** sob o vitest o `"use server"` é
inerte, então as funções são chamadas direto. Isto exercita o **corpo** do Server
Action, não a fronteira de serialização do POST.

**A GUARDA, e ela é metade do valor do caminho.** Ele depende de caminhos
internos do Next, que não são API pública. Sem proteção, uma atualização do Next
não o deixaria vermelho — poderia deixá-lo **verde sem medir nada**, que é o pior
defeito possível num instrumento, e esta base já foi mordida por ele **duas
vezes** (a contraprova da varredura ficou muda por três pontos de chamada; e a
guarda do instrumento perguntava `=== 0` onde devia perguntar `> 0`). São três
níveis, e a resposta errada estoura **na importação do módulo**:

| nível | o que ele pergunta |
|---|---|
| **A** a peça resolve | `pecaDoNext` nomeia o caminho interno que sumiu |
| **B** a exportação existe e é do tipo certo | `fabricaDoNext` lista o que o módulo exporta hoje; `alsDoNext` pergunta `instanceof AsyncLocalStorage` do Node — e **não** "tem `.run`?", porque o `FakeAsyncLocalStorage` **tem** `.run` e só lança quando chamado |
| **C** o contexto faz efeito, nas **duas** metades | sem semear, `cookies()` **tem de estourar**; semeado, tem de responder de **jarra vazia**. Só a metade positiva não distingue "o contexto chegou" de "o Next parou de exigir contexto" |

A prova do nível C roda **dentro de `comoNumaRequisicao`**, na primeira chamada:
é parte do caminho, e não um teste ao lado que dá para apagar sem ninguém notar.

**A GUARDA FOI PROVADA QUEBRANDO CADA PEÇA, uma de cada vez** — uma guarda que
não guarda é pior que nenhuma, porque agora existe alguém dizendo que está
protegido. Nove quebras, nove mensagens que nomeiam a peça:

| o que foi quebrado | o que saiu |
|---|---|
| o caminho do baseline não resolve | `PEÇA DO NEXT NÃO RESOLVE: …node-environment-baseline-QUE-SUMIU.js` |
| o baseline resolve mas não planta o global | `BASELINE DO NEXT NÃO FEZ EFEITO: … continua \`undefined\`` |
| o baseline é pulado | `ARMAZENAMENTO DO NEXT NÃO É O DO NODE: … veio \`object\` (FakeAsyncLocalStorage)` |
| `createRequestStoreForAPI` renomeada | `EXPORTAÇÃO DO NEXT AUSENTE: … (o módulo exporta hoje: createRequestStoreForAPI, createRequestStoreForRender, synchronizeMutableCookies)` |
| `createWorkStore` renomeada | `EXPORTAÇÃO DO NEXT AUSENTE: … (o módulo exporta hoje: createWorkStore)` |
| `IncrementalCache` renomeada | `EXPORTAÇÃO DO NEXT AUSENTE: … (o módulo exporta hoje: CacheHandler, IncrementalCache)` |
| `workUnitAsyncStorage` renomeada | `ARMAZENAMENTO DO NEXT NÃO É O DO NODE: … veio \`undefined\`` |
| alguém forja um cookie na montagem | `CONTEXTO SEMEADO COM COOKIE DENTRO: a jarra veio com 1 cookie(s)` |
| `cookies()` para de estourar fora de escopo | `O CONTEXTO DO NEXT DEIXOU DE SER EXIGIDO` |

**OS DOIS PLANTIOS, no arquivo de verdade e não numa cópia, medidos nas cinco
camadas:**

| defeito plantado | onde | `tsc` | `eslint` | 677 puros | varredura | **o quinto caminho** |
|---|---|---|---|---|---|---|
| **as duas portas trocadas** (`:238` passa a filtrar os dois níveis, `:554` passa a filtrar só os de salvar) | `app/automacoes/actions.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **3 vermelhos** |
| **`toggleAutomation` tratando toda automação como chave ligada** (`:553`, `Boolean(a.entrega_sem_portao)` → `true`) | `app/automacoes/actions.ts` | 0 | 0 | **677 ✓** | **SEM VAZAMENTO** | **1 vermelho** |

**Os dois passaram por `tsc`, `eslint`, os 677 puros e a varredura, e só o
caminho novo os viu.** O primeiro acusa **três vezes e pelos dois lados** — a
porta que passou a deixar subir link contornável, e a porta que passou a travar
quem está montando pela metade. Cada plantio foi revertido na mesma chamada de
shell, com `git status --porcelain` vazio conferido em seguida.

**A prova é a coluna `active` no banco**, e não o objeto que a porta devolveu: é
ela que decide se o motor entrega.

**UM ACHADO DE LADO, sobre o instrumento e não sobre o código:** em duas rodadas
seguidas o caso "public ficou intacto, por digital ancorada no corte"
(`fundacao.integracao.ts`) também ficou vermelho, e **não foi o plantio**. Aquele
arquivo roda **antes** do quinto caminho, e nada nele importa
`app/automacoes/actions.ts`. Na terceira rodada com o **mesmo** plantio ele
passou. **O banco é de produção e está vivo**: a digital afirma que nenhuma linha
anterior ao corte foi escrita, apagada ou alterada, e produção altera linha
antiga enquanto a rodada acontece. É ruído do mundo real, não do plantio — mas
quem for medir aqui precisa saber que esse caso pode piscar, e conferir **qual**
arquivo ficou vermelho antes de concluir qualquer coisa.

> **ATUALIZAÇÃO de 25/08:** isto deixou de ser "ruído que se convive". Foi
> medido e consertado — a coluna que se mexia sozinha é `contacts.last_reply_at`,
> a rajada é o que explica "duas vezes em três", e a verificação passou a julgar
> presença e identidade em vez de conteúdo. Ver a última seção deste plano, com
> o **preço** do conserto escrito por extenso.

### O PLACAR: DOS OITO SOBREVIVENTES, SOBRA UM

Dos **oito** defeitos que sobreviviam a `tsc`, `eslint`, aos 677 puros e à
varredura na medição da Fase 2a:

| | quantos | quem matou |
|---|---|---|
| morreram nos quatro primeiros caminhos | **cinco** | portão-link, dreno-botões, toque-botão, gatilho-entrega |
| morreram no quinto caminho | **dois** | portas-de-publicar (os dois de `app/automacoes/actions.ts`) |
| **sobra** | **um** | vive num **componente de tela**, e está **fora de alcance por decisão do dono** |

**O último não é descuido, e não é tarefa pendente.** Ele mora num componente de
tela; alcançá-lo exigiria uma categoria de teste que esta base decidiu não ter, e
a decisão é do dono. Fica registrado como **fora de alcance por decisão**, e não
como dívida.

**A seção anterior deste plano dizia que o quinto caminho tinha "um obstáculo
próprio, ainda não medido", e que afirmar um número ali seria inventá-lo.** Foi
medido. O número é **zero linha de produção**: um arquivo novo de fundação, um
arquivo novo de caminho, nenhum ponto de chamada tocado, nenhuma dependência
nova, nenhuma mudança de configuração.

### POR QUE O PARÂMETRO DE CONTA FOI RECUSADO — e este é o registro mais importante

Havia um caminho mais curto para desatar o nó, e ele foi **recusado**. Ele
custava **quatro linhas**: as duas funções ganhariam `contaExplicita?: string`, e
duas linhas virariam

```ts
const accountId = contaExplicita ?? (await getSelectedAccountId());
```

**Nenhum ponto de chamada mudaria.** Medido: os pontos de chamada reais são
exatamente **dois** — `app/automacoes/editor/quadro.tsx:1296` (`salvarAutomacao`)
e `app/automacoes/list-client.tsx:98` (`toggleAutomation`) —, e os dois
continuariam como estão.

**E é por isso que ele é inaceitável.** Os dois arquivos começam com
`"use client"`. **Argumento de Server Action vem do navegador.** Hoje o
`where account_id = $n` das duas funções é a única coisa que separa uma conta da
outra, e o valor dele **nasce no servidor**, num cookie que o painel controla.
Com o parâmetro, ele passaria a nascer no **corpo da requisição**: um POST direto
com o id de outra conta **grava, ou publica, na automação alheia**. Isso é
**travessia entre contas**, e não é hipótese — é desfazer, para o teste ver,
exatamente o comentário que já está escrito quatro vezes naquele arquivo:

```
// o account_id no where impede gravar em automação de outra conta
```

Dava para trancá-lo com as duas travas de `baseDoGraph()` (só sob `VITEST`), por
mais ~6 linhas. Mas aí seria **código de teste dentro de produção**, na superfície
de autorização, para comprar o que o caminho escolhido dá de graça.

**Barato em linha, inaceitável em risco.** Quatro linhas é o preço da edição, não
o preço da mudança.

### E EXTRAIR A DECISÃO PARA FUNÇÃO PURA NÃO FECHAVA

A saída de reflexo desta base — "decisão vai para função pura" — foi medida
contra estes dois defeitos, e **não os pega**.

**Aquelas funções são recheio, não camada.** Contadas sem comentário e sem linha
em branco:

| função | linhas de código | decisão | efeito | decisão |
|---|---|---|---|---|
| `salvarAutomacao` (134–364) | 79 | 23 | 44 | 29% |
| `toggleAutomation` (480–568) | 33 | 8 | 21 | 24% |
| **as duas** | **112** | **31** | **65** | **28%** |

É a mesma proporção que a sondagem achou em `lib/engine.ts`. Mas o argumento
decisivo não é a proporção — é **onde os defeitos moram**:

- **O defeito 1 é FIAÇÃO, não decisão.** Ele é *qual das duas listas cada porta
  usa*. Mesmo com `errosDoSalvar()` e `errosDoAtivar()` puras e testadas em
  `lib/steps.ts`, a **troca das chamadas** continua dentro do `server-only`, e
  nenhum teste puro a enxerga. **`podeFicarAtiva` (lib/steps.ts:4075) já é essa
  função pura, já tem teste** (`tests/editor-modelos.test.ts`) — e o defeito 1
  **passa por baixo dela**.
- **O defeito 2 é o valor que o chamador lê da coluna.** Uma função pura que
  recebesse a linha inteira pegaria a versão de hoje do defeito; a versão
  seguinte — `{ ...a, entrega_sem_portao: true }` no chamador — volta a passar.

Extrair decisão continua sendo boa higiene, e a Frente 3 a registra como
disciplina. **Como prova destes dois defeitos, não serve.**


**O chão sobre o qual os caminhos rodam:**

| | |
|---|---|
| `testes-integracao/banco-descartavel.ts` | a mecânica: nome, URL, inventário, criar, destruir. Não importa o vitest |
| `testes-integracao/harness.ts` | `bancoDescartavel()`, os ganchos que um teste usa |
| `testes-integracao/rede-global.ts` | recolhe schema órfão no início e no fim da rodada, e **falha alto** se achou |
| `testes-integracao/fundacao.integracao.ts` | o teste mínimo que prova a fundação — 4 casos |
| `testes-integracao/retrato-estrutural.ts` | o retrato de um schema (tabela, coluna, índice, restrição) e a comparação entre dois |
| `testes-integracao/migracoes.ts` | a leitura de `migrations/`, uma vez só, para o harness e para o caminho do esquema |
| `testes-integracao/esquema-base.integracao.ts` | a pasta basta? 4 casos — inclusive **`public` de produção contém tudo o que ela produz** |
| `testes-integracao/esquema-de-partida.integracao.ts` | a conferência de `lib/esquema.ts`, dos dois lados: ela acusa, e **não cria** — 6 casos |
| `vitest.integracao.config.ts` | configuração própria |
| `npm run test:integracao` | o comando novo |

**Eles moram fora da suíte padrão, e a separação é dupla de propósito:** o
`include` dos 677 é `tests/**/*.test.ts`, e estes vivem em `testes-integracao/`
com sufixo `*.integracao.ts`. Cada metade sozinha já bastaria.

**Não se usou `test.projects`**, que esta versão do vitest suporta, e a razão é
o padrão: com projetos, um `vitest run` sem argumento roda todos, e a suíte
padrão passaria a tocar o banco por omissão. O padrão seguro tem de ser o que
acontece quando ninguém digita nada.

**O `verify` continua sem chamar nada disto** — a decisão de exigir banco nele é
do dono, e segue adiada.

Medido: `npm test` = **677 em 22 arquivos**, sem banco.
`npm run test:integracao` = **42 casos em 9 arquivos** (26/08, com o caminho da
conferência de partida), um schema temporário por arquivo. **A rodada caiu de
61,1 s para 41,2 s** quando o esquema descartável passou a nascer de
`migrations/` em vez de `ensureSchema()`. `public` intacto por **presença e identidade** ancoradas num corte — a
digital da linha inteira foi trocada por isso em 25/08, e o motivo, a medição e o
**preço** estão na última seção deste plano —, e **zero schemas `teste_tmp_` no
banco** antes e depois.

**A destruição foi provada com o teste QUEBRADO de propósito:** a rodada falhou
(saída 1) e o schema `teste_tmp_54a28896` foi derrubado assim mesmo. E a
rede-global foi provada com um órfão plantado à mão: ela o derrubou e **fez a
rodada falhar**, em vez de limpar calada.

### A PERGUNTA FOI RESPONDIDA: SIM, POR ZERO LINHAS

O plano original dizia: *"exige que as migrações da Frente 1 existam, porque é
delas que o schema temporário nasce. A Frente 1 vem primeiro por dependência."*

**Falso.** Sonda executada em 24/08 contra o banco real, com inventário
antes/depois idêntico e nenhum schema temporário deixado para trás.

**O caminho mínimo é mais barato do que qualquer versão deste plano supôs: NÃO
MUDA UMA LINHA DE `lib/db.ts`.** O `search_path` viaja como parâmetro de query da
própria `DATABASE_URL`:

```
postgresql://…/postgres?search_path=sonda_tmp_ab12cd34
```

Quatro peças medidas sustentam isso:

1. `limparUrl` (`lib/db.ts:53`) só remove `channel_binding` e `pgbouncer` — o
   parâmetro novo sobrevive
2. o `parseOptions` do postgres.js joga todo parâmetro desconhecido em
   `connection`, o que o torna **parâmetro de startup**, não um `set`
3. o **Supavisor em modo transação** deixa passar — era o risco real
4. **a armadilha do `max: 3` não morde**, e isto foi medido, não deduzido: 6
   consultas simultâneas, 3 PIDs distintos, e **as 6** responderam com o schema
   temporário. É a diferença entre `set search_path` (vale para uma conexão) e
   parâmetro de startup (vale para todas)

**A prova que fecha:** `ensureSchema()` montou 8 tabelas, 16 índices e 99 colunas
no schema temporário, em ~4 segundos; e o `handleCommentEvent` do **motor de
verdade** leu a automação de lá, casou a palavra-chave, gravou o contato e
enfileirou a resposta. **Zero linhas escritas em `public`.**

### A ARMADILHA QUE O HARNESS PRECISA HERDAR

`search_path=<temporário>,public` é o reflexo natural de quem escreve isso, e é
**veneno**. Medido:

```
[só o temporário]        select count(*) from contacts  ->  ERRO 42P01
[temporário + public]    select count(*) from contacts  ->  93 ... da PRODUÇÃO
```

Com `public` de reserva, **`current_schema()` mente**: devolve o nome do
temporário enquanto lê os contatos reais. Um teste escrito assim **passa** — lendo
dado de verdade — e ninguém desconfia.

**A regra: o `search_path` é o schema temporário SOZINHO.** O que faltar tem que
falhar alto, em vez de cair calado na produção.

*(A sonda também derrubou uma hipótese dela mesma no caminho: supunha que
`create table if not exists` viraria no-op nesse arranjo. Não vira — ele olha só
o schema de criação. Medir venceu presumir, de novo.)*

### Por que schema temporário e não banco separado

O Postgres já em uso serve. Cada rodada cria um schema com nome próprio, monta a
estrutura nele, e o derruba no fim. Sem infraestrutura nova, sem tocar em
produção, e com o mesmo `DATABASE_URL` que os scripts já usam.

### O que custa, e é decisão do dono

- **"outra ordem de grandeza" era exagero, e a medição de 24/08 desfaz:** a ida e
  volta ao banco tem mediana de **24ms**, e montar a estrutura inteira levou
  **3,7 a 4,8 segundos** na sonda. Quatro caminhos compartilhando um schema
  ficam em **5 a 10 segundos**; um schema por caminho, em **15 a 25**. Para
  comparar: a varredura, que **já está** no `verify`, leva ~60 segundos
- **o custo real não é tempo, é dependência:** o `verify` roda offline hoje. Com
  estes testes dentro, ele passa a exigir banco. **É essa a decisão do dono**, e
  não o relógio
- por isso ficam **separados** dos 677 puros, com comando próprio
- **nada de mock.** O protótipo de sondagem funcionou e **pegou** o defeito nº 1,
  mas usava `vi.mock` e um banco de mentira que despachava por texto de SQL:
  trocava "cópia da cola" por "cópia do esquema", que é **a mesma doença por
  outra porta**. Foi recusado, e a recusa é parte do plano

### A regra que impede virar suíte sem fim

**Um caminho novo entra aqui só quando um defeito real escapou por ele.** Os
quatro da tabela escaparam de verdade, e o quinto entrou pela mesma porta:
os dois defeitos de `app/automacoes/actions.ts` escaparam de `tsc`, de `eslint`,
dos 677 puros e da varredura, e nenhum dos quatro os alcançava.

---

## Frente 3 · A disciplina que já funciona, escrita

Não é trabalho a fazer — é o que a Fase 2a mediu, registrado para não se perder.

**Decisão vai para função pura.** Toda vez que isso foi feito, o defeito ficou
visível. `envioDaDm` matou três cópias divergentes da mesma regra.
`caminhoDoBotao` nasceu **sem o cursor como argumento**, o que torna o erro
impossível de escrever em vez de apenas documentado.

**Antes de construir rede, pergunte se o erro pode ser tornado impossível.** A
união estreitada fechou a classe mais grave por 23 linhas, sem teste, banco, rede
ou harness. Nem todo buraco precisa de infraestrutura.

**Prova que não pôde ser dada vai para o roteiro de deploy, não para o
relatório.** Foi o que se fez com o envio de vários botões — virou passo que
alguém executa, em vez de ressalva que ninguém relê. E ele **foi executado**: em
21/08, numa conversa real, o toque num botão levou ao braço dele e quem digitou
em vez de tocar foi para o `senao`.

**Varredura com contraprova.** Uma varredura que dá zero pode estar certa ou pode
não estar procurando. A da Fase 2a só virou prova quando plantaram defeitos e ela
acusou. **E ela quebrou uma vez, calada**: uma reescrita mecânica deixou três
pontos de chamada sem o ramo antigo, a contraprova foi a zero, e o único sinal
era indistinguível de "o código de hoje e o de ontem ficaram parecidos". Hoje o
instrumento **acusa quando emudece**.

**Toda revisão pergunta pelo chamador:**

> *Cada variante que esta função aceita é produzida por alguém em produção? Se
> não, isso é deliberado e está escrito?*

Ela nasceu de um caso real: uma seta ficava desenhada, editável, salva e
validada, e o motor nunca a consultava. **Nenhuma ferramenta pega isso** —
medido: zero exportações mortas, o ramo coberto por teste, `tsc` e `eslint`
satisfeitos. **O que pega é a pergunta**, e ela custa uma linha.

E ela vale para os DOCUMENTOS também: foi aplicando-a a este arquivo que se
descobriu que `flow_step_index` nunca esteve órfã.

**As duas regras gêmeas, do editor:**

> O quadro não pode **desenhar** um caminho que o motor não percorre.
> A prévia não pode **esconder** um caminho que o motor percorre.

Uma tarefa da fase quebrou as duas ao mesmo tempo, e a correção de uma abriu a
outra. Existe uma terceira forma, achada na revisão final: **o motor percorrer
algo que o quadro não desenha** — o dono não consegue ver nem apagar o que está
quebrando a automação dele.

---

## A ordem — decidida por medição em 24/08

A sonda foi feita e respondeu SIM. **A ordem original está invertida:**

1. **FRENTE 2 PRIMEIRO.** Ela não depende de nada. Zero linhas de mudança para o
   schema temporário nascer, e o motor de verdade já provou que lê de lá
2. **FRENTE 1 DEPOIS**, e ela deixa de ser pré-requisito para virar melhoria: a
   primeira requisição para de carregar 42 comandos, o impasse do deploy some, e
   acaba a armadilha de "editar `lib/db.ts` com dev de pé é aplicar migração"
3. **As remoções de coluna vêm por último**, depois da tabela de controle:
   - **`flow_step_index`** — em dois passos, a leitura de reserva sai do código
     primeiro (ver correção 3 no topo)
   - **`contacts.follow_attempts_dia`** — **esta sim é órfã de verdade**: existe
     no banco e **não aparece em nenhum arquivo do repositório** (`grep` em
     `.ts`, `.tsx`, `.sql` e `.mjs`: zero). É o oposto exato do
     `flow_step_index`, e o par das duas é o melhor argumento para a pergunta
     pelo chamador: **parecer órfã e ser órfã não são a mesma coisa, e só a
     medição separa as duas**

**A Frente 3 já está valendo** — é descrição, não construção.

---

## A INSTABILIDADE DO INSTRUMENTO, MEDIDA E CONSERTADA — 25/08

O "achado de lado" registrado acima virou trabalho: o caso `public ficou
intacto` de `fundacao.integracao.ts` ficou **vermelho duas vezes sem relação
nenhuma com a mudança que estava sendo medida**, e verde na terceira. **Um teste
que fica vermelho por motivo alheio à mudança é o que destrói a confiança numa
suíte inteira** — em duas semanas alguém começa a ignorar o vermelho, e aí a
rede toda perde o valor, inclusive as partes que funcionam.

### 1 · O QUE SE MOVE SOZINHO NO BANCO VIVO — medido, não suposto

**Primeira medição, no catálogo.** `pg_stat_user_tables`, estatísticas desde
**2026-07-24** (32 dias), lidas em 25/08:

| tabela | inserções | **ATUALIZAÇÕES** | deleções |
|---|---|---|---|
| `contacts` | 134 | **1432** | 33 |
| `queue` | 144 | **278** | 49 |
| `automations` | 21 | **120** | 11 |
| `accounts` | 5 | **59** | 1 |
| `config` | 2 | 9 | 1 |
| `followups` | 15 | 4 | 15 |
| `events` | 6395 | 1 | 572 |
| `login_attempts` | 2 | 0 | 2 |

**`contacts` é atualizada dez vezes para cada linha que nasce.** O caminho é o
`upsertContact` (`lib/engine.ts:296`), por onde passa todo webhook de DM: o
`on conflict do update` reescreve `username`, `name`, `profile_pic`,
`last_reply_at` e `last_automation_id` de um contato **que já existia**. O dreno
faz o mesmo com `queue` (`lib/queue-drain.ts:82`: `status`, `sent_at`,
`not_before`, `error`, `message_id`, `payload`).

**Segunda medição, ao vivo, com o instrumento do próprio teste.** 30 ciclos de
`corte → inventário → espera 25 s → inventário → compara`, entre 15h43 e 15h56
de 25/08, **só leitura sobre `public`**:

```
## regra ATUAL     reprovou: 1/30
## regra CANDIDATA reprovou: 0/30
## por categoria: estrutura=0 n_caiu=0 n_subiu=0 identidade=0 conteudo=1
## colunas que se mexeram sozinhas: contacts.last_reply_at (1)
```

O ciclo 30 saiu assim, e é a prova direta:

```
[ciclo 30/30] atual=VERMELHO candidata=verde :: contacts: conteudo mexeu [last_reply_at]
```

Uma leitura paralela de **40 minutos, 152 leituras a cada 15 s, corte fixo**,
fechou com isto:

```
## janelas de 15s com movimento ATE O CORTE: 1/152
## [vs BASE] tabelas cuja DIGITAL ate o corte mudou:   contacts: 101/152
## [vs BASE] COLUNAS que se mexeram sozinhas:          contacts.last_reply_at: 101/152
## [vs BASE] tabelas cujo N ate o corte mudou:         (nada)
## [vs ANTERIOR] TOTAL cresceu (linha nova, tolerada): events: 13/152
## [vs ANTERIOR] COLUNAS que se mexeram por janela:    contacts.last_reply_at: 1/152
```

**Três coisas se leem aí, e as três importam.** Primeira: a única coluna que se
moveu sozinha em 40 minutos foi `contacts.last_reply_at` — a mesma dos 30 ciclos.
Segunda: **a contagem das linhas anteriores ao corte NÃO se mexeu nenhuma vez**
(`N ate o corte: (nada)`, 0/152), o que sustenta manter a contagem como PERDA nos
dois sentidos. Terceira, e é a que explica o pisca: a divergência aconteceu em
**uma** janela de 15 s, mas a partir dela **101 das 152 leituras** divergiram da
base. **Uma escrita só envenena todo o resto da rodada** — não é preciso azar
repetido, basta um webhook cair entre o corte e a conferência.

**A coluna que se move sozinha é `contacts.last_reply_at`, e não
`last_seen_at`** — vale corrigir o palpite: `last_seen_at` é escrita pelo painel
(`app/conversas/[id]/marcar-visto.ts:32`), quando alguém abre a conversa;
`last_reply_at` é escrita pelo **webhook**, sem ninguém por perto.

**Por que duas vezes em três, se a média é baixa.** A taxa média não explica o
que se viu; a **rajada** explica. Nos últimos 7 dias: **2697 eventos em 1861
minutos distintos**, pico de **22 num único minuto**, 28 minutos com 5 ou mais.
Fora de rajada o teste passa sempre; dentro de uma, ele reprova quase sempre.
Foi por isso que a terceira rodada com o mesmo cenário passou — a rajada tinha
acabado, e não o defeito.

### 2 · OS CANDIDATOS, E POR QUE DOIS FORAM RECUSADOS POR MEDIÇÃO

**"O corte considerar atualização além de inserção."** Recusado: **não existe
coluna para isso**. Colunas lidas do banco, em 25/08 — só `config` e
`automations` têm `updated_at`. `contacts`, `queue`, `events`, `accounts`,
`followups` e `login_attempts` não têm. E `config` e `followups` não têm nem
coluna de nascimento, o que significa que hoje elas são comparadas **sem corte
nenhum**. Criar a coluna seria migração em banco de produção vivo, que é decisão
de outro dia.

**"A assinatura olhar só as colunas que não podem mudar sozinhas, listadas à
mão."** Recusado, e a razão é o próprio defeito que estamos consertando: uma
lista de "colunas que produção não reescreve" envelhece **em silêncio**. O dia
em que uma funcionalidade nova passasse a escrever numa delas, o teste voltaria
a piscar — e ninguém ligaria a causa ao efeito.

### 3 · A FORMA ESCOLHIDA: PRESENÇA E IDENTIDADE, NÃO CONTEÚDO

A comparação passa a julgar **três coisas**, todas ancoradas no mesmo corte:

1. a **ESTRUTURA** — tabelas e colunas, em força total
2. a **CONTAGEM** das linhas anteriores ao corte
3. a **IDENTIDADE** dessas linhas — `sum(hashtext(row(<chave>)::text))`, onde
   `<chave>` é a **chave primária perguntada ao `pg_index`** mais a coluna do
   corte

**A identidade vem do catálogo, e não de uma lista escrita à mão.** Chave
primária e carimbo de nascimento não são reescritos por definição: são o NOME da
linha, e não o conteúdo dela. Nenhum código de produção os escreve, e nenhum
código futuro os escreverá sem mudar o modelo de dados.

**Tabela sem chave primária cai no lado ESTRITO, e não no frouxo:** a identidade
dela é a linha inteira. Hoje é o caso de `login_attempts`, e há um teste que
prova isso — porque emudecer pelo lado que ninguém confere é exatamente como
esta base já se machucou duas vezes.

O veredito deixou de ser uma lista só. São duas: **`perdas`**, que reprova, e
**`vida`**, que é **impressa em voz alta** e não reprova. Sem a impressão, o
afrouxamento seria mudo.

### 4 · O PREÇO — o que esta forma DEIXA DE PEGAR

**Ela deixa de pegar uma coisa, e é grande: escrita que muda só o CONTEÚDO de
uma linha que já existia, com a chave e o carimbo intactos.** Se um teste
escapasse para `public` e virasse `automations.active`, sobrescrevesse
`accounts.access_token` ou trocasse `contacts.email` de uma linha real, a
comparação ficaria **verde**.

Não é descuido: é que a produção faz exatamente isso, milhares de vezes, e
nenhuma leitura de fora separa a escrita do teste da escrita do mundo.

**O preço está escrito no código, e não só aqui:** o cabeçalho de
`banco-descartavel.ts` o diz por extenso, e `digital.integracao.ts` o prova como
**asserção executada** — o caso `O PREÇO` afirma que a digital da linha inteira
**mudou** (é ela que a regra antiga usava para reprovar) e que `perdas` está
**vazio**.

O que continua fechando aquela porta são as travas que agem **antes** da
escrita, e são três: `exigirPrefixo` recusa a cauda `,public` no nome;
`conferirCaminho` pergunta ao banco quantos schemas o caminho tem antes de a
estrutura nascer; e `fundacao.integracao.ts` confere que `contacts` do schema
temporário tem ZERO linhas enquanto a produção tem mais de zero.

### 5 · A PROVA DOS DOIS LADOS

**Que ainda acusa** — `testes-integracao/digital.integracao.ts`, **7 casos,
todos dentro de um schema descartável**. Nenhuma simulação de perda tocou
`public`:

| perda simulada | fica |
|---|---|
| linha anterior ao corte APAGADA | **vermelho** (`linhas até o corte CAÍRAM de 3 para 2`) |
| linha velha que VIROU OUTRA (chave primária trocada, contagem igual) | **vermelho** (`a IDENTIDADE das linhas até o corte mudou`) |
| alteração em tabela SEM chave primária | **vermelho** (identidade = linha inteira) |
| COLUNA que sumiu | **vermelho** |
| TABELA que sumiu | **vermelho** |
| conteúdo de linha velha alterado (o PREÇO) | **verde**, e dito em voz alta no balde `vida` |
| linha NOVA, nascida depois do corte | **verde**, como sempre foi |

**Que o instrumento não está mudo** — quatro quebras de propósito na regra, uma
de cada vez, cada uma revertida na mesma chamada de shell com
`git status --porcelain` vazio conferido em seguida:

| o que foi quebrado | o que ficou vermelho |
|---|---|
| a identidade parou de reprovar | **2** (linha que virou outra; tabela sem chave) |
| a contagem que CAI parou de reprovar | **1** (linha apagada) |
| tabela e coluna que somem pararam de reprovar | **2** |
| a REGRA ANTIGA de volta (conteúdo volta a reprovar) | **1** (o caso do PREÇO) |

### 6 · O QUE ESTA SEÇÃO CORRIGE DO QUE ESTAVA ESCRITO ACIMA

- **"~6 linhas por minuto" em `public.events` está errado.** Medido em 25/08:
  2697 eventos em 7 dias = **0,27/min de média**, com pico de 22 num minuto. O
  número certo não é a média: é a rajada.
- **"`public` intacto por digital ancorada num corte"** virou **"por presença e
  identidade ancoradas num corte"**, e o que isso deixa de afirmar está no
  parágrafo 4.
- **`npm run test:integracao` = 32 casos em 7 arquivos**, e não 25 em 6. (Em
  26/08 passou a 36 em 8, com `esquema-base.integracao.ts`.)
