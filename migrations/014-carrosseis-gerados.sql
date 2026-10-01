-- OS CARROSSÉIS DO GERADOR DE BÔNUS (Etapa 2: o texto).
--
-- Uma linha é um carrossel pedido a partir de um bônus já publicado no Método Labs, do
-- pedido ao texto revisado. O desenho inteiro está em
-- docs/specs/2026-09-30-gerador-de-carrossel.md.
--
-- TABELA DE FEATURE, como a 013: entra em `naoObservaveis` de lib/esquema.ts, e quem confere
-- as colunas é testes-integracao/bonus-carrossel-tabela.integracao.ts.
--
-- `palavra` e `contexto` são o que o Labs dizia NO MOMENTO DO PEDIDO. A palavra pode ser
-- trocada depois no /admin de lá, e o carrossel pede a que valia quando foi escrito. A
-- geração roda no `after()` e não lê o Labs de novo: tudo o que ela precisa está aqui.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e nos índices.
create table if not exists carrosseis_gerados (
  id uuid primary key default gen_random_uuid(),
  bonus_id uuid not null references bonus_gerados (id) on delete cascade,
  criado_em timestamptz not null default now(),
  total_slides integer not null
    constraint carrosseis_gerados_total_check
      check (total_slides between 1 and 10),
  palavra text not null,
  contexto jsonb not null,
  estado text not null default 'pendente'
    constraint carrosseis_gerados_estado_check
      check (estado in ('pendente', 'gerando', 'pronto', 'falhou')),
  gerado jsonb,
  revisado jsonb,
  erro text,
  medicao jsonb,
  gerado_em timestamptz,
  revisado_em timestamptz
);

-- A lista na página do bônus.
create index if not exists carrosseis_gerados_bonus_idx
  on carrosseis_gerados (bonus_id, criado_em desc);

-- O teto diário lê por `criado_em`, do mais novo para trás.
create index if not exists carrosseis_gerados_criado_em_idx
  on carrosseis_gerados (criado_em desc);
