-- OS CONVITES DE CONEXÃO: o link que o painel gera para o cliente conectar a própria conta do Instagram,
-- sem a senha do painel e sem passar a senha do Instagram a ninguém. O desenho inteiro está em
-- docs/specs/2026-11-03-link-de-convite.md.
--
-- Uma linha é um convite: o hash do código do link (o código em si não é guardado, e por isso o link não
-- pode ser mostrado de novo), o nome que o dono deu, o prazo de 7 dias, o cancelamento, o uso com a conta
-- que entrou, e o último erro, que só o painel mostra.
--
-- O USO É UMA ESCRITA SÓ: a volta do Instagram reivindica o convite com `usado_em is null and
-- cancelado_em is null and expira_em > now()` na mesma transação que grava a conta. Duas abas com o mesmo
-- link não conectam duas vezes.
--
-- TABELA DE FEATURE, como a 013, a 014 e a 018: entra em `naoObservaveis` de lib/esquema.ts, e quem
-- confere as colunas é testes-integracao/convites-tabela.integracao.ts.
--
-- O RLS É LIGADO AQUI: a 019 só alcançou as tabelas que já existiam, e
-- testes-integracao/rls-nas-tabelas.integracao.ts cobra o RLS de toda tabela do schema. A permissão da
-- API pública não precisa de linha: os privilégios padrão que a 020 mudou já fazem a tabela nascer sem
-- nada para `anon` e `authenticated`. Não há função, então o achado 130 não se aplica.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e no índice, e ligar o RLS de
-- novo não muda nada.
create table if not exists convites_de_conexao (
  id uuid primary key default gen_random_uuid(),
  codigo_hash text not null
    constraint convites_de_conexao_codigo_hash_check
      check (codigo_hash ~ '^[0-9a-f]{64}$'),
  para_quem text not null
    constraint convites_de_conexao_para_quem_check
      check (char_length(para_quem) between 1 and 60),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  cancelado_em timestamptz,
  usado_em timestamptz,
  conta_conectada text,
  ultimo_erro text
    constraint convites_de_conexao_ultimo_erro_check
      check (char_length(ultimo_erro) between 1 and 160),
  ultimo_erro_em timestamptz,
  constraint convites_de_conexao_codigo_hash_key unique (codigo_hash),
  constraint convites_de_conexao_usado_check
    check ((usado_em is null) = (conta_conectada is null)),
  constraint convites_de_conexao_erro_check
    check ((ultimo_erro is null) = (ultimo_erro_em is null))
);

-- A lista da etapa 6 lê os mais recentes.
create index if not exists convites_de_conexao_criado_em_idx
  on convites_de_conexao (criado_em desc);

alter table convites_de_conexao enable row level security;
