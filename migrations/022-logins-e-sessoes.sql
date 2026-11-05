-- OS LOGINS E AS SESSÕES: cada pessoa entra no painel com o próprio e-mail e a própria senha, e a sessão
-- fica gravada no banco, para o Sair, a troca de senha e a desativação derrubarem o acesso na hora. O
-- desenho inteiro está em docs/specs/2026-11-04-logins.md (a entrega 1 de 2).
--
-- `logins`: o e-mail sempre em minúsculas, o nome, o hash scrypt da senha (nunca a senha), o marcador de
-- administrador e a desativação. O `senha_hash` só é nulo no login da passagem da senha única, que a
-- primeira entrada preenche.
--
-- `sessoes`: o SHA-256 do código que vai no cookie (o código em si não é guardado), o login e o prazo de
-- 30 dias. Apagar o login apaga as sessões dele; desativar não apaga o login, e quem apaga as sessões é o
-- código, na mesma hora.
--
-- AS DUAS SÃO OBSERVÁVEIS, ao contrário das tabelas de feature (a 013, a 014, a 018 e a 021): sem elas
-- ninguém entra no painel, e a conferência da partida (lib/esquema.ts) passa a exigir as duas.
--
-- O RLS É LIGADO AQUI, como na 021: a 019 só alcançou as tabelas que já existiam. A permissão da API
-- pública não precisa de linha: os privilégios padrão da 020 já fazem as tabelas nascerem sem nada para
-- `anon` e `authenticated`. Não há função, então o achado 130 não se aplica.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` nas tabelas e no índice, e ligar o RLS de
-- novo não muda nada.
create table if not exists logins (
  id uuid primary key default gen_random_uuid(),
  email text not null
    constraint logins_email_check
      check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  nome text not null
    constraint logins_nome_check
      check (nome = btrim(nome) and char_length(nome) between 1 and 60),
  senha_hash text
    constraint logins_senha_hash_check
      check (senha_hash ~ '^scrypt\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$'),
  administrador boolean not null default true,
  criado_em timestamptz not null default now(),
  desativado_em timestamptz,
  constraint logins_email_key unique (email)
);

create table if not exists sessoes (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null
    constraint sessoes_token_hash_check
      check (token_hash ~ '^[0-9a-f]{64}$'),
  login_id uuid not null
    constraint sessoes_login_id_fkey
      references logins (id) on delete cascade,
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null,
  constraint sessoes_token_hash_key unique (token_hash)
);

-- Derrubar as sessões de um login (a senha nova, a desativação, a troca da própria senha) lê por login.
create index if not exists sessoes_login_id_idx on sessoes (login_id);

alter table logins enable row level security;
alter table sessoes enable row level security;
