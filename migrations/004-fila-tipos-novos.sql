-- A fila aceita os NOVE tipos que o motor de fato enfileira, e não os cinco que
-- o `create table` declara.
--
-- =============================================================================
-- DE ONDE ESTA MIGRAÇÃO SAIU, E POR QUE ELA QUASE NÃO EXISTIU
--
-- Ela estava escondida dentro de `migrateAccounts` (lib/db.ts), uma função cujo
-- comentário diz "migração de instalação single-conta → multi-conta" e cujo nome
-- promete DADO. Tratá-la como dado e deixá-la para trás — que é o que o plano
-- original mandava fazer — faria todo banco novo nascer **recusando quatro tipos
-- de fila em uso**: `dm_follow_gate`, `dm_email_ask`, `story_reaction` e
-- `dm_manual`. O portão de follow, o pedido de e-mail, a reação ao story e o
-- envio manual estourariam 23514 no `insert`, em produção e não em teste.
--
-- MEDIDO em 26/08, montando dois schemas descartáveis — um com a lista `DDL`
-- sozinha, outro com `ensureSchema()` inteiro — e comparando o catálogo:
--
--     SEM migrateAccounts: CHECK (kind = ANY (ARRAY['private_reply','comment_reply',
--                                 'dm_welcome','dm_link','dm_reminder']))
--     COM migrateAccounts: … as cinco acima MAIS 'dm_follow_gate','dm_email_ask',
--                                 'story_reaction','dm_manual'
--
-- =============================================================================
-- POR QUE ELA NÃO FOI PARA DENTRO DE `000`
--
-- Porque `create table if not exists` não alcança tabela que já existe. Corrigir
-- a linha do `check` lá dentro valeria só para banco NOVO, e todo banco que já
-- rodou este esquema continuaria com a restrição de cinco tipos. É a mesma razão
-- pela qual `migrations/003` existe separada da criação de `queue`, e o
-- comentário daquela linha em `lib/db.ts` já a escreve por extenso.
--
-- =============================================================================
-- SOBRE A IDEMPOTÊNCIA
--
-- Não existe `add constraint if not exists` no Postgres. O par abaixo é a forma
-- idempotente equivalente — derruba se houver, cria em seguida —, e o precedente
-- é `migrations/003`. Rodar duas vezes é inofensivo.
--
-- Isto NÃO move dado: nenhuma linha é lida, escrita ou apagada. Mas o
-- `add constraint` VALIDA as linhas existentes, e é bom saber: num banco onde
-- alguém tivesse gravado um `kind` fora dos nove, ele falharia alto em vez de
-- passar calado. Em produção isso não era risco novo quando esta migração
-- nasceu: `ensureSchema` recriava esta mesma restrição, com estes mesmos nove
-- tipos, em toda instância. Ele foi apagado em 26/08, e desde então esta linha é
-- a única que a instala.
alter table queue drop constraint if exists queue_kind_check;

alter table queue add constraint queue_kind_check check (kind in (
  'private_reply','comment_reply','dm_welcome','dm_link','dm_reminder',
  'dm_follow_gate','dm_email_ask','story_reaction','dm_manual'
));
