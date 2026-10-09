-- AS IMAGENS GERADAS PELO CRIADOR DE IMAGEM (Etapa 6 do gerador de bônus).
--
-- Uma linha é um pedido de imagem à OpenAI, para o espaço da arte de um slide: o carrossel, o número
-- do slide, a descrição digitada, o estado (gerando, pronta ou falhou), o motivo da falha, o caminho
-- guardado no bucket e as horas de começo e de fim. O desenho inteiro está em
-- docs/specs/2026-10-09-criador-de-imagem.md.
--
-- O TETO CONTA ESTAS LINHAS: as das últimas 24 horas, de qualquer estado, porque o pedido que falhou
-- pode ter sido cobrado. Por isso o carrossel apagado deixa a linha, com o carrossel nulo (`on delete
-- set null`): apagar um carrossel não zera a conta do dia. A linha também guarda a última descrição de
-- cada slide, para o "Gerar de novo".
--
-- TABELA DE FEATURE, como a 013 e a 014: entra em `naoObservaveis` de lib/esquema.ts, e quem confere
-- as colunas é testes-integracao/bonus-imagens-tabela.integracao.ts. O scripts/migrar.mjs não muda
-- (achado 82 da auditoria).
--
-- Os quatro `check` amarram o estado ao resto: a pronta tem o caminho, a que falhou tem o motivo, e só a
-- que ainda gera fica sem a hora do fim.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e nos índices.
create table if not exists imagens_geradas (
  id uuid primary key default gen_random_uuid(),
  carrossel_id uuid references carrosseis_gerados (id) on delete set null,
  numero integer not null
    constraint imagens_geradas_numero_check
      check (numero between 1 and 10),
  descricao text not null
    constraint imagens_geradas_descricao_check
      check (descricao <> ''),
  estado text not null default 'gerando'
    constraint imagens_geradas_estado_check
      check (estado in ('gerando', 'pronta', 'falhou')),
  motivo text,
  caminho text,
  criado_em timestamptz not null default now(),
  terminado_em timestamptz,
  constraint imagens_geradas_caminho_check
    check ((estado = 'pronta') = (caminho is not null)),
  constraint imagens_geradas_motivo_check
    check ((estado = 'falhou') = (motivo is not null)),
  constraint imagens_geradas_fim_check
    check ((estado = 'gerando') = (terminado_em is null))
);

-- O teto lê por `criado_em`, do mais novo para trás.
create index if not exists imagens_geradas_criado_em_idx
  on imagens_geradas (criado_em desc);

-- A página lê a última linha de cada slide do carrossel.
create index if not exists imagens_geradas_carrossel_idx
  on imagens_geradas (carrossel_id, numero, criado_em desc);
