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
oito defeitos que sobrevivem hoje.

| caminho | o que prova | prioridade |
|---|---|---|
| **portão → link** | a recompensa não sai para quem não segue | **1ª** |
| **dreno → mensagem** | rótulos e payloads chegam pareados | 2ª |
| toque em botão → braço certo | o payload de quatro partes leva ao destino certo | 3ª |
| gatilho → entrega | a automação entrega o que o editor montou | 4ª |

**A prioridade mudou em 21/08**, e a medição que a mudou: o defeito de três
tokens que passou por tudo estava no caminho do portão, não no do dreno.

### Onde está — a FUNDAÇÃO existe desde 25/08

**Os quatro caminhos ainda não foram escritos. O chão sobre o qual eles rodam,
sim.**

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
`npm run test:integracao` = **4 casos, ~3,1 s**, um schema temporário por
arquivo. `public` intacto por digital ancorada num corte, e **zero schemas
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
