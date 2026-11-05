-- AS CONTAS POR LOGIN: o login comum vê só as contas que o administrador der a ele, e o administrador vê
-- todas. O desenho inteiro está em docs/specs/2026-11-05-contas-por-login.md (a entrega 2 de 2 dos logins).
--
-- `logins_contas`: uma linha diz que o login comum vê aquela conta. O administrador não precisa de linha
-- nenhuma. Apagar o login ou desconectar a conta apaga a ligação junto. O índice da conta serve a esse
-- apagar e a quem pergunta "quem vê esta conta".
--
-- O PADRÃO DE `administrador` PASSA A SER `false`: um login criado sem dizer o papel nasce comum, com menos
-- acesso, e não mais. O código sempre passa o papel; o padrão é só a rede de baixo. Entre esta migração na
-- produção e o merge do código, ninguém cria login (achado 180): a página de antes cria sem dizer o papel.
--
-- A TABELA É OBSERVÁVEL, como as da 022: sem ela o login comum não acha conta nenhuma, e a conferência da
-- partida (lib/esquema.ts) passa a exigi-la.
--
-- O RLS É LIGADO AQUI, como na 021 e na 022. A permissão da API pública não precisa de linha: os
-- privilégios padrão da 020 já fazem a tabela nascer sem nada para `anon` e `authenticated`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e no índice; ligar o RLS e trocar o
-- padrão de novo não mudam nada.

create table if not exists logins_contas (
  login_id uuid not null
    constraint logins_contas_login_id_fkey references logins (id) on delete cascade,
  account_id text not null
    constraint logins_contas_account_id_fkey references accounts (ig_user_id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint logins_contas_pkey primary key (login_id, account_id)
);
create index if not exists logins_contas_account_id_idx on logins_contas (account_id);
alter table logins_contas enable row level security;
alter table logins alter column administrador set default false;
