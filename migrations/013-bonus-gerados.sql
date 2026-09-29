-- A TABELA DO GERADOR DE BÔNUS (app/bonus/, lib/bonus/).
--
-- Uma linha é um bônus, do pedido ao envio ao Método Labs. O desenho inteiro, e o
-- porquê de cada coluna, está em docs/specs/2026-09-29-gerador-de-bonus.md.
--
-- É UMA TABELA DE FEATURE, E NÃO DO PAINEL. Ela entra em `naoObservaveis` de
-- lib/esquema.ts, e não em `tabelas`: registrada lá, uma tabela que só o /bonus
-- lê faria o painel inteiro, DMs incluídas, se recusar a subir. Sem ela, quem
-- quebra é só o /bonus, que diz "falta a migração 013". Quem confere as colunas é
-- testes-integracao/bonus-tabela.integracao.ts.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e no
-- índice. Rodar duas vezes não faz nada na segunda.
--
-- `corpo_enviado` GUARDA A STRING EXATA que foi ao Labs, e nunca o cabeçalho de
-- assinatura: o `t` entra no HMAC e a janela do Labs é de ±5 minutos, então um
-- cabeçalho guardado faria o reenvio de amanhã voltar 401.
create table if not exists bonus_gerados (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  tema text not null,
  o_que_resolve text not null,
  palavra_digitada text,
  estado text not null default 'pendente'
    constraint bonus_gerados_estado_check
      check (estado in ('pendente', 'gerando', 'pronto', 'falhou')),
  gerado jsonb,
  revisado jsonb,
  erro text,
  medicao jsonb,
  gerado_em timestamptz,
  slug text,
  corpo_enviado text,
  envio_estado text
    constraint bonus_gerados_envio_estado_check
      check (envio_estado in ('enviando', 'criado', 'colisao', 'recusado', 'esperar',
                              'incerto', 'conferir', 'porta_desligada')),
  incerto_pendente boolean not null default false,
  conferido_pelo_operador boolean not null default false,
  envio_resposta jsonb,
  tentativas integer not null default 0,
  envio_iniciado_em timestamptz,
  enviado_em timestamptz
);

-- A lista da tela e o teto diário leem por `criado_em`, do mais novo para trás.
create index if not exists bonus_gerados_criado_em_idx on bonus_gerados (criado_em desc);
