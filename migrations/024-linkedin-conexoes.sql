-- A CONEXÃO DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §1 e §2; a parte 1 de 3 da entrega
-- do LinkedIn, a conexão): o LinkedIn pessoal de uma conta do painel, conectado pelo link de convite.
--
-- `linkedin_conexoes`: uma linha por conta do painel, com a pessoa do LinkedIn (o `sub` do OpenID Connect),
-- o nome dela para a tela, a autorização e o vencimento (60 dias, sem renovação automática). O token fica em
-- texto puro, como o do Instagram em `accounts`, e protegido do mesmo jeito. A linha sai junto com a conta.
-- Quem lê a tabela é só lib/linkedin-conexoes.ts.
--
-- O CONVITE GANHA A REDE E A CONTA-ALVO: o convite do LinkedIn liga o LinkedIn a uma conta que já existe no
-- painel, e o do Instagram cria a conta. As linhas de hoje ficam `instagram` e sem conta-alvo, e passam no
-- check. O convite do LinkedIn sai junto com a conta-alvo.
--
-- O TIPO DA FILA DO LINKEDIN (`publicacao_linkedin`) NÃO ENTRA AQUI: ele vem na 025, na parte 2, junto com o
-- ramo do dreno que sabe drenar a linha (tests/fila-tipos.test.ts prende a lista do dreno à última migração
-- que escreve o `queue_kind_check`).
--
-- TABELA E COLUNAS DE FEATURE, como a 021: entram em `naoObservaveis` de lib/esquema.ts, e quem as confere é
-- testes-integracao/linkedin-tabela.integracao.ts.
--
-- O RLS É LIGADO AQUI, como na 021, na 022 e na 023. A permissão da API pública não precisa de linha: os
-- privilégios padrão da 020 já fazem a tabela nascer sem nada para `anon` e `authenticated`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e nas colunas, o check da conta-alvo
-- apagado e escrito de novo, e ligar o RLS de novo não muda nada.

create table if not exists linkedin_conexoes (
  account_id text primary key
    constraint linkedin_conexoes_account_id_fkey references accounts (ig_user_id) on delete cascade,
  pessoa_id text not null,
  nome text not null,
  access_token text not null,
  expira_em timestamptz not null,
  conectado_em timestamptz not null default now()
);
alter table linkedin_conexoes enable row level security;

alter table convites_de_conexao
  add column if not exists rede text not null default 'instagram'
    constraint convites_de_conexao_rede_check check (rede in ('instagram', 'linkedin'));
alter table convites_de_conexao
  add column if not exists conta_alvo text
    constraint convites_de_conexao_conta_alvo_fkey references accounts (ig_user_id) on delete cascade;
alter table convites_de_conexao drop constraint if exists convites_de_conexao_alvo_check;
alter table convites_de_conexao
  add constraint convites_de_conexao_alvo_check check ((rede = 'linkedin') = (conta_alvo is not null));
