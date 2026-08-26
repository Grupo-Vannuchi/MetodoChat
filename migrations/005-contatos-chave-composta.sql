-- A chave primária de `contacts` passa a ser (account_id, ig_id).
--
-- =============================================================================
-- POR QUE ISTO NÃO É DETALHE
--
-- A lista `DDL` de `lib/db.ts` cria `contacts` com `ig_id text primary key`. O
-- código que grava contato — `upsertContact` (lib/engine.ts) — escreve
-- `on conflict (account_id, ig_id)`. **As duas coisas não podem estar certas ao
-- mesmo tempo:** com a chave só em `ig_id`, o `on conflict` estoura 42P10 no
-- primeiro webhook de DM, porque não há restrição única sobre aquelas colunas.
--
-- Quem conserta isso hoje é `migrateAccounts` (lib/db.ts), uma função cujo nome
-- promete migração de DADO. Deixá-la de fora ao mover o esquema para cá — que é
-- o que o plano original mandava fazer — faria **todo banco novo nascer com a
-- chave primária errada**, e o defeito só apareceria em tempo de execução, na
-- primeira mensagem recebida.
--
-- E o motivo do modelo é real: a MESMA pessoa pode falar com DUAS contas de
-- Instagram conectadas, e são dois contatos, não um.
--
-- =============================================================================
-- O QUE ELA MUDA, MEDIDO NO CATÁLOGO — e são TRÊS coisas, não uma
--
-- Sonda de 26/08, dois schemas descartáveis (um com a lista `DDL` sozinha, outro
-- com `ensureSchema()` inteiro), comparados campo a campo:
--
--   1. a RESTRIÇÃO   `contacts_pkey`: PRIMARY KEY (ig_id) -> (account_id, ig_id)
--   2. o ÍNDICE      `contacts_pkey`: btree (ig_id)       -> btree (account_id, ig_id)
--   3. a COLUNA      `contacts.account_id`: nao_nulo=false -> nao_nulo=true
--
-- A TERCEIRA NÃO ESTÁ ESCRITA EM LUGAR NENHUM, e é o achado desta migração:
-- `account_id` nasce como `alter table contacts add column if not exists
-- account_id text`, sem `not null`. Quem a torna `not null` é o próprio
-- `add primary key`, por definição do Postgres. Ou seja, uma migração que só
-- criasse a restrição "na mão" (um índice único, por exemplo) produziria um
-- schema PARECIDO e não IGUAL — e a diferença só apareceria no dia em que uma
-- linha com `account_id` nulo fosse gravada.
--
-- MEDIDO TAMBÉM, porque a pergunta é legítima: derrubar a chave antiga **não**
-- solta o `not null` de `ig_id`. Ele continua `nao_nulo=true` dos dois lados.
--
-- =============================================================================
-- POR QUE ELA NÃO FOI PARA DENTRO DE `000`
--
-- Pelo mesmo motivo de `004`: `create table if not exists` não alcança tabela
-- que já existe. Escrever a chave certa no `create table` valeria só para banco
-- novo, e todo banco já criado continuaria com a chave em `ig_id` sozinho.
--
-- =============================================================================
-- AS DUAS GUARDAS, E POR QUE ELAS FICAM COMO ESTÃO
--
-- O bloco abaixo é o de `migrateAccounts`, e cada passo tem guarda própria:
--
--   - a chave antiga só cai se ela for de UMA coluna (`array_length(conkey,1) = 1`)
--     E não houver contato com `account_id` nulo
--   - a chave composta só entra se a tabela estiver SEM chave primária E não
--     houver contato com `account_id` nulo
--
-- A segunda condição é a que impede o pior desfecho possível: derrubar a chave
-- antiga, falhar ao instalar a nova por causa de um nulo, e deixar `contacts`
-- **sem chave primária nenhuma** num banco vivo. Com as guardas, parar no meio
-- ou rodar de novo nunca quebra — que é o contrato desta pasta.
--
-- QUEM PREENCHE O `account_id` NULO continua sendo `migrateAccounts`, e continua
-- lá: aquilo é DADO, e migração que move dado exige a tabela de controle que
-- ainda não existe (ver o cabeçalho de `scripts/migrar.mjs`). Num banco novo não
-- há nulo para preencher — `contacts` está vazia —, então esta migração passa
-- sozinha. Num banco antigo com nulos, ela não faz nada e a rede de `lib/db.ts`
-- continua fazendo, exatamente como faz hoje.
--
-- =============================================================================
-- SOBRE A IDEMPOTÊNCIA
--
-- É o `do $$ … $$` com as duas guardas: rodar duas vezes é inofensivo, porque na
-- segunda a chave já é composta (`array_length` = 2, então não cai) e já existe
-- (então não é criada). Isto NÃO move dado.
do $$
begin
  if exists (
       select 1 from pg_constraint
       where conrelid = 'contacts'::regclass and contype = 'p'
         and array_length(conkey, 1) = 1
     )
     and not exists (select 1 from contacts where account_id is null) then
    alter table contacts drop constraint contacts_pkey;
  end if;

  if not exists (
       select 1 from pg_constraint
       where conrelid = 'contacts'::regclass and contype = 'p'
     )
     and not exists (select 1 from contacts where account_id is null) then
    alter table contacts add primary key (account_id, ig_id);
  end if;
end $$;
