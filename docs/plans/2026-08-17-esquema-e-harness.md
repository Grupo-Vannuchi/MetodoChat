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
impasse do deploy não deixava seguir sem eles. Existem três migrações:

| | |
|---|---|
| `001-ligacoes.sql` | a coluna do mapa de caminhos |
| `002-entrega-sem-portao.sql` | a chave por automação |
| `003-fila-sobrevive-a-automacao.sql` | a fila deixa de morrer com a automação |

**Falta o essencial.** O esquema base ainda nasce dentro da aplicação. Medido em
24/08, na lista `DDL` de `lib/db.ts`: **42 instruções** — 8 tabelas, 8 índices e
26 `alter table`. E `ensureSchema` faz mais que rodar essa lista: dois `alter`
extras, um `insert` que semeia a linha de `config`, e `migrateAccounts`, que é
migração de dado para instalações antigas.

`ensureSchema()` é chamado de **27 lugares**, não recebe argumento, e memoriza a
promessa num módulo — uma vez por instância.

### O que fazer

1. **Mover as 42 instruções** para arquivos numerados em `migrations/`
2. **Separar o que não é esquema** — E AQUI MORA UMA ARMADILHA, ver abaixo
3. **Reduzir `ensureSchema` a nada**, e limpar os 27 pontos de chamada
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

**A semente de `config`** (uma linha, com o token do webhook) é desejável até em
banco de teste — ela não é DDL, mas é pré-requisito de funcionamento.

### O que ganha

- some a classe de impasse que a Fase 2a viveu: preparar o banco deixa de
  depender de subir o código
- a primeira requisição depois de cada deploy deixa de carregar 42 comandos, dos
  quais 26 pedem trava exclusiva de tabela
- **some a armadilha medida na Tarefa 9**: hoje, com um servidor de dev de pé,
  **editar `lib/db.ts` É aplicar a migração**. A coluna `entrega_sem_portao`
  nasceu no banco assim, sem ninguém ter decidido aplicá-la
- a estrutura vira coisa que se lê num diretório, em ordem, em vez de um array

### O que precisa de cuidado

**A rede não pode sumir antes da hora.** Enquanto `ensureSchema` existe,
implantar sem rodar a migração ainda funciona. No dia em que ele morrer, esquecer
de rodar passa a **quebrar o deploy** — e isso precisa ser intencional, não
descoberto.

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

Três ou quatro caminhos rodando o **motor de verdade** contra um **banco de
verdade**, num schema temporário criado e destruído pelo próprio teste.

**Não é "testar tudo".** É fechar a metade que nenhum teste puro alcança — os
oito defeitos que sobreviviam quando isto foi escrito. **Em 25/08, cinco deles
morreram**, e os três que restam não são alcançáveis por estes quatro caminhos
(o porquê está mais abaixo). Além deles, um defeito que ninguém tinha na lista
foi achado **por teste**, e não por plantio.

| caminho | o que prova | prioridade |
|---|---|---|
| **portão → link** | a recompensa não sai para quem não segue | **1ª — FEITO em 25/08** |
| **dreno → mensagem** | rótulos e payloads chegam pareados | **2ª — FEITO em 25/08** |
| toque em botão → braço certo | o payload de quatro partes leva ao destino certo | **3ª — FEITO em 25/08** |
| gatilho → entrega | a automação entrega o que o editor montou | **4ª — FEITO em 25/08** |

**A prioridade mudou em 21/08**, e a medição que a mudou: o defeito de três
tokens que passou por tudo estava no caminho do portão, não no do dreno.

### Onde está — a FUNDAÇÃO E OS QUATRO CAMINHOS, todos de 25/08

**Os quatro caminhos estão escritos. Não falta nenhum da tabela acima.**

| | |
|---|---|
| `testes-integracao/portao-link.integracao.ts` | **portão → link**, o 1º da tabela acima — 4 casos |
| `testes-integracao/dreno-botoes.integracao.ts` | **dreno → mensagem**, o 2º da tabela acima — 4 casos |
| `testes-integracao/toque-botao.integracao.ts` | **toque em botão → braço certo**, o 3º — 4 casos |
| `testes-integracao/gatilho-entrega.integracao.ts` | **gatilho → entrega**, o 4º — 4 casos |

Com a fundação (4 casos), a suíte de integração é de **20 casos em 5 arquivos**.

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

### OS TRÊS SOBREVIVENTES QUE RESTAM NÃO SÃO ALCANÇÁVEIS POR ESTES QUATRO

Dos oito defeitos que sobreviviam à medição da Fase 2a, **cinco morreram**. Os
três que restam **não** morrem por nenhum destes quatro caminhos, e isso é
estrutura, não descuido:

- **dois vivem em `app/automacoes/actions.ts`**, que continua sem nenhum teste
  que o importe
- **um vive num componente de tela**, que também não é alcançável daqui

**Um quinto caminho existe — e tem um obstáculo próprio, ainda não medido.** As
Server Actions de `app/automacoes/actions.ts` passam por `getSelectedAccountId`
(lib/account.ts), que chama `cookies()` de `next/headers`. Medido pelo dono:
fora de uma requisição isso **estoura**, com

```
cookies was called outside a request scope
```

Ou seja: o banco descartável, que era o nó dos quatro primeiros caminhos, **não
é** o nó deste. O nó é o escopo de requisição do Next. Quanto custa desatá-lo —
e se dá para desatar sem mock, que é a regra desta base — **não foi medido**, e
afirmar um número aqui seria inventá-lo. Fica como a próxima pergunta da
Frente 2, e não como tarefa com estimativa.

**O chão sobre o qual os caminhos rodam:**

| | |
|---|---|
| `testes-integracao/banco-descartavel.ts` | a mecânica: nome, URL, inventário, criar, destruir. Não importa o vitest |
| `testes-integracao/harness.ts` | `bancoDescartavel()`, os ganchos que um teste usa |
| `testes-integracao/rede-global.ts` | recolhe schema órfão no início e no fim da rodada, e **falha alto** se achou |
| `testes-integracao/fundacao.integracao.ts` | o teste mínimo que prova a fundação — 4 casos |
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

Medido em 25/08: `npm test` = **677 em 22 arquivos**, sem banco.
`npm run test:integracao` = **20 casos em 5 arquivos, ~37 s**, um schema
temporário por arquivo. `public` intacto por digital ancorada num corte, e **zero schemas
`teste_tmp_` no banco** antes e depois.

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
quatro da tabela escaparam de verdade.

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
