# O RLS ligado em toda tabela e a chave pública sem permissão

**Nascido em:** 26/10/2026, sobre a `main` em `260b9dd`, da varredura de segurança que o Eduardo pediu
nesse dia. **Decisões do Eduardo pela caixa:**
- o RLS vem primeiro, num PR próprio, e o furo do login do proxy vai num segundo PR, logo depois;
- a 020, recomendada pela auditoria (metodochat-48), entra no mesmo PR da 019.

---

## O que foi medido

Na produção, numa transação `read only`, em 26/10/2026:

- **As 12 tabelas do `public` estavam com o RLS desligado:** `accounts`, `automations`,
  `bonus_gerados`, `carrosseis_gerados`, `config`, `contacts`, `events`, `followups`,
  `imagens_geradas`, `login_attempts`, `queue` e `schema_migrations`.
- **Os papéis `anon` e `authenticated` do Supabase tinham todos os privilégios em todas.** São 24
  concessões, todas feitas pelo `postgres`. É o padrão do Supabase para tabela criada no `public`, e
  nenhuma migração o mudava.
- **Por isso, quem tivesse a chave pública (anon) do projeto lia e mudava tudo** pela API REST do
  Supabase, sem passar pelo painel. Isso inclui os tokens do Instagram (`accounts.access_token`), as
  chaves do app (`config`) e os dados dos contatos.
- **Os privilégios PADRÃO repetem isso em toda tabela nova.** No `public` (pg_default_acl, por schema),
  o criador `postgres` dá `arwdDxtm` aos dois em toda tabela, `rwU` em toda sequência e `X` em toda
  função. O criador `supabase_admin` dá o mesmo. O `postgres` não é membro do `supabase_admin`.
- **A chave anon NÃO está nas variáveis do Chat**, e nem o Chat nem o Labs usam a API REST das
  tabelas. O Supabase trata essa chave como pública, então a porta se fecha de qualquer jeito.
- **O app entra como `postgres`**, que é o dono de todas as tabelas e tem `bypassrls = true`. O dono
  passa por cima do RLS.
  - A auditoria confirmou que o runtime e o build da produção usam esse papel: a consulta do motor
    aparece no pg_stat_statements só sob o `postgres`.
  - A `DATABASE_URL` da Vercel é uma entrada só.
  - Nesta conexão, `current_schema()` é o `public`.

## O que muda

- **`migrations/019-rls-nas-tabelas.sql`:** um laço liga o RLS em toda tabela do schema em que roda,
  SEM NENHUMA REGRA (`policy`). Na produção, o schema é o `public`; nos testes, o descartável.
  - RLS ligado e nenhuma regra quer dizer que quem não é dono não lê e não grava nenhuma linha.
  - Não há leitor legítimo fora do dono.
- **`migrations/020-sem-permissao-publica.sql`:** para `anon` e `authenticated`, quando os papéis
  existem, ela revoga tudo nas tabelas, sequências e funções do schema. Também revoga os privilégios
  padrão do criador `current_user` (o `postgres` na produção) nesse schema.
  - Assim, uma tabela que uma migração futura criar nasce sem permissão para a API pública, mesmo que
    quem a criou esqueça o RLS.
  - No container os dois papéis não existem, e o laço não roda.
- **As duas são idempotentes.**
- **`lib/esquema.ts`:** declara a 019 e a 020 entre as não observáveis. Elas mudam atributos e
  permissões, que presença de coluna não vê, e um banco sem elas serve o painel normalmente.
- **Os testes:**
  - **`testes-integracao/rls-nas-tabelas.integracao.ts`:**
    - toda tabela tem o RLS;
    - um papel comum com SELECT e INSERT não lê nenhuma linha e não grava;
    - o dono lê e grava;
    - a 019 roda duas vezes.
  - **`testes-integracao/sem-permissao-publica.integracao.ts`:**
    - o teste cria `anon` e `authenticated`, reproduz o que o Supabase concede e roda a 020;
    - nenhuma tabela dá permissão aos dois;
    - os privilégios padrão do schema não os citam;
    - uma tabela e uma sequência criadas depois nascem sem permissão;
    - o dono lê e grava;
    - a 020 roda duas vezes;
    - no fim, ele apaga os papéis que criou.
  - **Os dois só rodam no `npm run test:integracao`, à mão.** Essa suíte não está no `verify` nem no
    build. Uma tabela futura sem o RLS só derruba o primeiro caso na próxima vez que alguém rodar a
    integração. Até lá, quem a segura fechada é a 020, que tira dela as permissões de nascença.

## O que não muda

O painel, o motor, a fila, o webhook, o gerador e o Labs. Nenhuma linha de dado muda.

## Medido no ensaio

- Sem a 019, o papel comum leu a `config` e gravou em `accounts`, que é a exposição da produção
  reproduzida.
- A mutação "a 019 pula a tabela `accounts`" derruba três casos.
- Mutações da 020:
  - sem papel nenhum no laço: 4 casos caem;
  - sem os privilégios padrão: 2 caem;
  - sem as sequências: 3 caem.
- Sem a declaração em `lib/esquema.ts`, cai o caso "a MARCA D'ÁGUA cobre a pasta inteira".
- A suíte inteira foi rodada de novo antes do commit, e os números estão na mensagem à auditoria.

## Como chega à produção

Pelo build do merge, como as outras migrações: o `scripts/migrar.mjs --aplicar` aplica a 019 e a 020
antes do `next build`. Cada uma roda numa transação própria, com `lock_timeout` de 15s. Se a trava não
vier, o build cai e a produção fica no deploy anterior. O preview não aplica migração, de propósito.

É uma gravação no banco de produção, e pede três coisas:
- o OK do Eduardo pela caixa;
- a hora mandada à auditoria antes, e o "pode" dela;
- nenhum `npm run dev` apontando para a produção na hora, e uma hora de pouco movimento.

**A conferência depois do deploy** (a auditoria mede o antes na hora do "pode", só leitura):

- as 12 tabelas com `relrowsecurity = true`;
- 0 permissões de `anon` e `authenticated` nas tabelas do `public`, e os privilégios padrão do
  criador `postgres` no `public` sem os dois;
- o log do build com as linhas da 019 e da 020 "aplicada e registrada";
- um evento `comment` novo em `events`;
- o contador da consulta das automações ativas no pg_stat_statements subindo depois do deploy. Isso
  prova que o dono lê através do RLS.

## O que fica de fora, e por quê

- **Os privilégios padrão do criador `supabase_admin`:** o `postgres` não pode mudá-los. Uma tabela
  criada por esse papel (e não por uma migração) nasceria com as permissões. Quem a segura é o RLS, e
  o caso que o cobra roda na integração.
- **Descobrir se a chave anon circulou:** só há uma medição parcial.
  - Pela auditoria, no pg_stat_statements desde 14/09, há 0 consultas do `anon` e do `authenticated`
    em tabela do `public`.
  - A ressalva é que o pg_stat_statements descartou entradas (`dealloc` = 3, com 4 982 guardadas para
    um teto de 5 000). Consultas raras podem ter saído, então isso NÃO prova que ninguém usou a chave.
  - Se o Eduardo quiser, dá para trocá-la no painel do Supabase. Com a 019 e a 020, ela deixa de abrir
    as tabelas.
- **O furo do login (o matcher do proxy):** é o PR seguinte, como decidido.
