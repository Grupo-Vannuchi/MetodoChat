# O esquema sai da aplicação, e o motor passa a rodar em teste

**Estado:** proposto, e **corrigido em 24/08** com o que a Fase 2a mediu depois
de ele ser escrito. Quatro afirmações da versão original caíram — estão listadas
na seção seguinte, com o que as derrubou.

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
2. **Separar o que não é esquema**: a semente de `config` e o `migrateAccounts`
   não são DDL e não devem viajar junto
3. **Reduzir `ensureSchema` a nada**, e limpar os 27 pontos de chamada
4. **Criar a tabela de controle** — ver o aviso abaixo

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

### A PERGUNTA ABERTA, e ela decide o tamanho do projeto

O plano original dizia: *"exige que as migrações da Frente 1 existam, porque é
delas que o schema temporário nasce. A Frente 1 vem primeiro por dependência."*

**Isso pode não ser verdade**, e medi o que sustenta a dúvida:

- a DDL de `lib/db.ts` **não é qualificada por schema** (zero ocorrências de
  `public.`), então ela obedece ao `search_path`
- ou seja, o schema temporário poderia nascer de `ensureSchema` rodando contra
  ele, em vez de das migrações

**O que impede hoje, e é pequeno:** a lista `DDL` não é exportada,
`ensureSchema()` não aceita argumento, e ela mistura DDL com semente de dado e
com migração de instalação antiga. Um `export` ou um parâmetro opcional
resolveriam o primeiro; a mistura é justamente o que a Frente 1 desfaz.

**Se funcionar, a ordem se inverte:** a Frente 2 vem primeiro, entrega valor
semanas antes, e a Frente 1 deixa de ser bloqueio.

**É a primeira coisa a fazer**, antes de escolher a ordem. Uma sonda de mais ou
menos uma hora, e ela responde por medição em vez de por suposição.

### Por que schema temporário e não banco separado

O Postgres já em uso serve. Cada rodada cria um schema com nome próprio, monta a
estrutura nele, e o derruba no fim. Sem infraestrutura nova, sem tocar em
produção, e com o mesmo `DATABASE_URL` que os scripts já usam.

### O que custa, e é decisão do dono

- a suíte deixa de rodar em ~2 segundos; estes testes são de outra ordem de
  grandeza
- por isso ficam **separados** dos 677 puros, com comando próprio — e **o dono
  decide se `verify` os chama**
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

## A ordem, e o que decide

1. **A sonda do schema temporário** — uma hora, e responde se a Frente 2 depende
   mesmo da Frente 1
2. **Conforme a resposta:** ou Frente 2 primeiro (valor mais cedo), ou Frente 1
   primeiro (como o plano original supunha)
3. **A remoção de `flow_step_index`** vem depois da tabela de controle, nunca
   antes — e em dois passos: primeiro a leitura de reserva sai do código

**A Frente 3 já está valendo** — é descrição, não construção.
