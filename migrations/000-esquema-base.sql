-- O ESQUEMA BASE — as 8 tabelas, os 8 índices e os 26 `alter table` de que todo
-- o resto depende. Até hoje ele nascia DENTRO da aplicação, na lista `DDL` de
-- `lib/db.ts`, e por isso um banco novo só existia depois de o código subir.
--
-- =============================================================================
-- POR QUE `000` E NÃO `004`
--
-- `migrar.mjs` aplica os arquivos em ordem de NOME. `001-ligacoes.sql`,
-- `002-entrega-sem-portao.sql` e `003-fila-sobrevive-a-automacao.sql` são
-- `alter table` sobre `automations` e `queue` — num banco vazio, elas estouram
-- com 42P01 antes de chegar à primeira linha, porque as tabelas não existem.
--
-- O esquema base não é uma quarta mudança: é o CHÃO sobre o qual as três já
-- estavam escritas, e sempre esteve — só morava noutro arquivo. `000` diz isso
-- pelo nome, e não renumera nada que já foi aplicado em produção.
--
-- =============================================================================
-- POR QUE UM ARQUIVO SÓ, E NÃO OITO OU QUARENTA E DOIS
--
-- Um arquivo desta pasta é o registro de UMA DECISÃO: o que mudou, por quê, e o
-- que acontece se não rodar. O esquema base não tem esse formato — ele não é uma
-- mudança, é o ponto de partida. Repartir as 42 instruções em vários arquivos
-- inventaria uma cronologia que nunca existiu: elas nunca foram aplicadas
-- separadamente, nunca houve um banco com metade delas, e nenhuma delas foi
-- decidida sozinha.
--
-- Três razões práticas, além dessa:
--
--   1. A ORDEM É INTERNA E IMPORTA. Tabelas antes dos índices, índices antes dos
--      `alter`, e o par que derruba e recria a chave estrangeira de `queue`
--      depois da criação da tabela. Num arquivo só, a ordem se lê de cima para
--      baixo; espalhada em oito, ela vira convenção de nome.
--   2. A CONFERÊNCIA DE `migrar.mjs` É POR ITEM, E NÃO POR ARQUIVO. Repartir não
--      acrescenta uma asserção sequer, e multiplica o que alguém precisa
--      lembrar de atualizar.
--   3. ESTE ARQUIVO É TRANSCRIÇÃO, E NÃO REDESENHO. As 42 instruções estão aqui
--      na MESMA ordem e com o MESMO texto da lista `DDL` de `lib/db.ts` —
--      extraídas do próprio arquivo, não copiadas à mão. Isso é o que torna
--      possível provar que os dois lados produzem o mesmo banco (ver
--      `testes-integracao/esquema-base.integracao.ts`), e é o que fará da
--      remoção futura de `ensureSchema` um apagamento puro, sem tradução no
--      meio. Qualquer melhoria de forma aqui teria de ser paga com uma
--      divergência entre as duas fontes de verdade que ainda coexistem.
--
-- =============================================================================
-- O QUE ESTE ARQUIVO **NÃO** TEM, e onde está
--
-- `ensureSchema` faz quatro coisas, e só a primeira é a lista `DDL`. Duas das
-- outras três estão aqui embaixo (os dois `alter` extras e a semente de
-- `config`); a quarta, `migrateAccounts`, é migração de DADO com DUAS mudanças
-- de FORMA escondidas dentro, e essas duas viraram `004` e `005`. Estão fora
-- deste arquivo de propósito: elas não valem só para banco novo — precisam
-- alcançar bancos que já existem, e `create table if not exists` nunca alcança
-- tabela que já está lá.
--
-- =============================================================================
-- OS DOIS `alter` EXTRAS, E POR QUE ELES ESTAVAM FORA DA LISTA
--
-- `ensureSchema` roda, depois da lista, mais dois comandos soltos:
--
--     alter table config add column if not exists meta_app_id text;
--     alter table config add column if not exists meta_app_secret text;
--
-- MEDIDO: as duas colunas JÁ ESTÃO no `create table config` acima. Num banco
-- novo os dois comandos são no-op — a sonda que montou o esquema sem eles e com
-- eles devolveu o mesmo retrato. Eles só fazem efeito num banco criado ANTES de
-- as duas colunas entrarem no `create table`, e é isso que eles são: migração
-- leve para instalação antiga, exatamente como o bloco de `alter table` da lista.
--
-- Ou seja, estar fora da lista não significava nada — nem ordem, nem categoria,
-- nem dependência. Era só onde alguém digitou. Ficam aqui, no fim, na mesma
-- posição em que rodam hoje, pelo mesmo motivo do item 3 acima: transcrever, não
-- redesenhar.
--
-- =============================================================================
-- A SEMENTE DE `config` — NÃO É DDL, E A DECISÃO ESTÁ ESCRITA AQUI
--
-- A última linha deste arquivo não cria estrutura: ela insere a linha única de
-- `config` (`id = 1`) com um token de verificação de webhook. Não é DDL, mas é
-- PRÉ-REQUISITO DE FUNCIONAMENTO — sem ela, `getConfig()` devolve `undefined` e
-- o painel não sobe. Um banco que "nasce só das migrações" e não funciona não
-- nasceu.
--
-- O TOKEN É GERADO, e valor gerado dentro de migração idempotente é uma decisão
-- de verdade: rodar duas vezes NÃO PODE trocar o token de quem já está usando o
-- sistema — o token vive no painel de webhooks da Meta, e trocá-lo derruba a
-- entrega de todo webhook até alguém reconfigurar a Meta à mão.
--
-- O QUE O `on conflict (id) do nothing` GARANTE, medido e não suposto: com a
-- linha `id = 1` já presente, o `insert` não escreve NADA — nem coluna nula,
-- nem token novo. A trava é a chave primária `id`, e a tabela tem
-- `check (id = 1)`, então existe no máximo uma linha e ela é sempre esta. Ou
-- seja: a primeira execução semeia, e toda execução seguinte é silêncio.
-- É exatamente a garantia que `ensureSchema` dá hoje, com a MESMA cláusula.
--
-- O QUE FOI ESCOLHIDO, E O QUE FOI RECUSADO:
--
--   - ESCOLHIDO: manter o `on conflict (id) do nothing` idêntico ao de hoje, e
--     gerar o token no PRÓPRIO BANCO, com
--     `replace(gen_random_uuid()::text, '-', '')` — 32 caracteres hexadecimais,
--     a mesma forma que `randomBytes(16).toString("hex")` produz em `lib/db.ts`.
--     `gen_random_uuid()` é embutido no Postgres 13+ e JÁ É usado como padrão de
--     quatro chaves primárias deste mesmo esquema, então não entra dependência
--     nova nem extensão (`pgcrypto`, que `gen_random_bytes` exigiria).
--   - RECUSADO: `update` para preencher o token quando ele estiver nulo. Ele
--     seria "conserto útil" e é justamente a porta por onde um token trocaria de
--     valor sozinho num banco vivo. Linha com token nulo continua com token
--     nulo, como hoje.
--   - RECUSADO: token fixo no arquivo. Um segredo igual em toda instalação não é
--     segredo, e este arquivo está no repositório.
--
-- Isto NÃO é migração que MOVE dado: nenhuma linha existente é lida, alterada ou
-- apagada. Só nasce uma linha, e só quando não há nenhuma — que é o que o
-- cabeçalho de `scripts/migrar.mjs` exige enquanto não houver tabela de
-- controle.
--
-- =============================================================================
-- IDEMPOTÊNCIA
--
-- Toda instrução abaixo é `if not exists`, exceto o par que derruba e recria a
-- chave estrangeira de `queue` — que é a forma idempotente equivalente para
-- restrição, o precedente é `migrations/003`, e é a MESMA dupla que `lib/db.ts`
-- já roda em toda instância.
--
-- ESTAS LINHAS TAMBÉM ESTÃO EM `lib/db.ts` (`ensureSchema`), e a duplicação é
-- deliberada durante a transição, pelo motivo já escrito em `001` e `002`: lá
-- elas são a REDE, aqui são a ORDEM. **A rede não sai antes da hora** — ver
-- `docs/plans/2026-08-17-esquema-e-harness.md`. O que impede as duas de
-- divergirem enquanto coexistem é `testes-integracao/esquema-base.integracao.ts`,
-- que monta um schema por cada lado e compara tabela, coluna, índice, chave e
-- `check`, campo a campo.

create table if not exists config (
    id int primary key default 1 check (id = 1),
    ig_user_id text,
    username text,
    name text,
    profile_picture_url text,
    access_token text,
    token_expires_at timestamptz,
    connected_at timestamptz,
    instagram_app_id text,
    instagram_app_secret text,
    meta_app_id text,
    meta_app_secret text,
    webhook_verify_token text,
    app_url text,
    updated_at timestamptz not null default now()
  );

create table if not exists automations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    active boolean not null default true,
    triggers text[] not null default '{comment}',
    keywords text[] not null default '{}',
    match_type text not null default 'contains' check (match_type in ('contains','exact','any')),
    media_id text,
    media_thumbnail_url text,
    media_caption text,
    public_replies text[] not null default '{}',
    welcome_text text not null default '',
    quick_reply_label text not null default 'Quero o link! 🔗',
    link_text text not null default '',
    link_button_label text not null default 'Abrir link',
    link_url text not null default '',
    reminder_text text not null default '',
    reminder_delay_minutes int not null default 60,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

create table if not exists followups (
    id uuid primary key default gen_random_uuid(),
    automation_id uuid not null references automations(id) on delete cascade,
    position int not null,
    kind text not null check (kind in ('link','reminder')),
    text text not null default '',
    button_label text,
    url text,
    delay_minutes int not null default 0
  );

create index if not exists followups_automation_idx on followups(automation_id, position);

create table if not exists contacts (
    ig_id text primary key,
    username text,
    first_contact_at timestamptz not null default now(),
    last_reply_at timestamptz,
    last_automation_id uuid references automations(id) on delete set null
  );

create table if not exists queue (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('private_reply','comment_reply','dm_welcome','dm_link','dm_reminder')),
    contact_ig_id text,
    -- "set null", e nao "cascade": a fila e o HISTORICO do que foi entregue, e
    -- apagar uma automacao nao pode apagar o que ela ja entregou. Ver
    -- migrations/003. Segue a mesma regra de contacts.last_automation_id.
    -- (sem crases aqui: este comentario mora DENTRO de um template literal, e
    --  uma crase o fecharia no meio — foi o que quebrou a suite ao escrever.)
    automation_id uuid references automations(id) on delete set null,
    comment_id text,
    payload jsonb not null default '{}',
    dedupe_key text unique,
    status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
    attempts int not null default 0,
    not_before timestamptz not null default now(),
    claimed_at timestamptz,
    sent_at timestamptz,
    error text,
    created_at timestamptz not null default now()
  );

create index if not exists queue_pending_idx on queue(status, not_before);

alter table queue drop constraint if exists queue_automation_id_fkey;

alter table queue add constraint queue_automation_id_fkey
     foreign key (automation_id) references automations(id) on delete set null;

create table if not exists events (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    payload jsonb not null default '{}',
    created_at timestamptz not null default now()
  );

create index if not exists events_created_idx on events(created_at desc);

create table if not exists accounts (
    ig_user_id text primary key,
    username text,
    name text,
    profile_picture_url text,
    access_token text not null,
    token_expires_at timestamptz,
    connected_at timestamptz,
    created_at timestamptz not null default now()
  );

alter table automations add column if not exists story_id text;

alter table automations add column if not exists story_thumbnail_url text;

alter table contacts add column if not exists name text;

alter table contacts add column if not exists profile_pic text;

alter table automations add column if not exists account_id text;

alter table contacts add column if not exists account_id text;

alter table queue add column if not exists account_id text;

alter table events add column if not exists account_id text;

alter table automations add column if not exists require_follow boolean not null default false;

alter table automations add column if not exists follow_text text not null default '';

alter table automations add column if not exists follow_button_label text not null default 'Já sigo! ✅';

alter table automations add column if not exists ask_email boolean not null default false;

alter table automations add column if not exists email_text text not null default '';

alter table automations add column if not exists story_reaction text not null default '';

alter table contacts add column if not exists email text;

alter table contacts add column if not exists awaiting text;

alter table contacts add column if not exists follow_attempts int not null default 0;

create index if not exists automations_account_idx on automations(account_id);

create index if not exists queue_account_idx on queue(account_id, status);

create index if not exists events_account_idx on events(account_id, created_at desc);

create table if not exists login_attempts (
    ip text not null,
    attempted_at timestamptz not null default now()
  );

create index if not exists login_attempts_idx on login_attempts(ip, attempted_at desc);

alter table queue add column if not exists message_id text;

create index if not exists events_media_idx on events ((payload->'media'->>'id'));

alter table contacts add column if not exists last_seen_at timestamptz;

alter table automations add column if not exists steps jsonb not null default '[]'::jsonb;

alter table contacts add column if not exists flow_step_index int;

alter table contacts add column if not exists flow_step_id text;

alter table automations add column if not exists ligacoes jsonb not null default '[]'::jsonb;

alter table automations add column if not exists entrega_sem_portao boolean not null default false;

-- Os dois `alter` extras que `ensureSchema` roda FORA da lista. Ver o cabeçalho.
alter table config add column if not exists meta_app_id text;

alter table config add column if not exists meta_app_secret text;

-- A semente de `config`. NÃO é DDL — ver "A SEMENTE DE `config`" no cabeçalho.
insert into config (id, webhook_verify_token)
  values (1, replace(gen_random_uuid()::text, '-', ''))
  on conflict (id) do nothing;
