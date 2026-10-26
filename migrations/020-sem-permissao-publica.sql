-- A CHAVE PÚBLICA SEM PERMISSÃO NENHUMA no schema: os papéis `anon` e `authenticated` do Supabase perdem
-- o que têm nas tabelas, sequências e funções, e perdem também o que ganhariam nas que uma migração
-- futura criar (varredura de segurança de 26/10/2026; recomendação da auditoria, decidida pelo Eduardo).
--
-- MEDIDO NA PRODUÇÃO, numa transação `read only`:
--   - as 24 permissões dos dois nas 12 tabelas do `public` foram concedidas pelo `postgres`, o papel que
--     roda as migrações, então é ele que pode revogá-las;
--   - os privilégios PADRÃO do `public` para o criador `postgres` (pg_default_acl, por schema e não
--     globais) dão `arwdDxtm` aos dois em toda tabela nova, `rwU` em toda sequência e `X` em toda função.
--     Sem esta migração, uma tabela criada por uma migração futura nasceria aberta para a API pública.
--
-- A 019 E ESTA SE COMPLETAM: a 019 liga o RLS, e sem regra nenhuma o RLS não deixa ler nem gravar
-- linha; esta tira a permissão, que é o que o RLS não cobre (o TRUNCATE, por exemplo) e o que uma
-- tabela nova traria de nascença.
--
-- O QUE ELA NÃO ALCANÇA: os privilégios padrão do criador `supabase_admin` no `public` também dão tudo
-- aos dois, e o `postgres` não é membro do `supabase_admin` (medido), então não pode mudá-los. Uma
-- tabela criada por esse papel, e não por uma migração, nasceria com as permissões. Quem segura esse
-- caso é o RLS, conferido por testes-integracao/rls-nas-tabelas.integracao.ts na rodada do
-- `test:integracao`.
--
-- SÓ AGE ONDE OS PAPÉIS EXISTEM: no Supabase. No container de teste eles não existem, e o laço não roda
-- nenhuma vez. O schema é o `current_schema()`, como na 019, e o criador dos privilégios padrão é o
-- `current_user`, o mesmo papel que vai criar as tabelas futuras.
--
-- IDEMPOTENTE: revogar o que já foi revogado não muda nada nem dá erro.
do $$
declare
  papel text;
begin
  for papel in
    select rolname from pg_roles where rolname in ('anon', 'authenticated') order by rolname
  loop
    execute format('revoke all on all tables in schema %I from %I', current_schema(), papel);
    execute format('revoke all on all sequences in schema %I from %I', current_schema(), papel);
    execute format('revoke all on all functions in schema %I from %I', current_schema(), papel);
    execute format('alter default privileges for role %I in schema %I revoke all on tables from %I',
      current_user, current_schema(), papel);
    execute format('alter default privileges for role %I in schema %I revoke all on sequences from %I',
      current_user, current_schema(), papel);
    execute format('alter default privileges for role %I in schema %I revoke all on functions from %I',
      current_user, current_schema(), papel);
  end loop;
end $$;
