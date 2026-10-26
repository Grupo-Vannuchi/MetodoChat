-- O RLS LIGADO EM TODA TABELA DO SCHEMA, sem nenhuma regra (achado da varredura de segurança de
-- 26/10/2026).
--
-- MEDIDO NA PRODUÇÃO, numa transação `read only`: as 12 tabelas do `public` estavam com o RLS desligado,
-- e os papéis `anon` e `authenticated` do Supabase tinham SELECT, INSERT, UPDATE, DELETE e TRUNCATE em
-- todas, inclusive `accounts` (os tokens do Instagram) e `config` (as chaves do app). É o padrão do
-- Supabase para tabela criada no `public`, e ninguém aqui o tinha mudado. Quem tivesse a chave pública
-- (anon) do projeto lia e mudava tudo pela API REST do Supabase, sem passar pelo painel.
--
-- POR QUE NÃO QUEBRA NADA: o app entra no banco como `postgres`, que é o DONO de todas as tabelas e tem
-- `bypassrls` (medido no mesmo dia). O dono passa por cima do RLS. Nem o Chat nem o Labs usam a API REST
-- das tabelas: o Chat só fala com a de arquivos (Storage), com a chave de serviço.
--
-- SEM NENHUMA REGRA (`policy`) DE PROPÓSITO: RLS ligado e nenhuma regra quer dizer que quem não é dono
-- não vê nenhuma linha e não grava nenhuma. Não há leitor legítimo fora do dono, então não há regra a
-- escrever.
--
-- O LAÇO, E NÃO UMA LISTA DE TABELAS: ele liga o RLS em toda tabela do schema em que roda (o `public`
-- na produção, o schema descartável nos testes), inclusive a `schema_migrations`, que nasce do
-- scripts/migrar.mjs e não de uma migração. Uma tabela criada DEPOIS desta migração nasce aberta: quem
-- segura isso é testes-integracao/rls-nas-tabelas.integracao.ts, que exige o RLS em toda tabela.
--
-- IDEMPOTENTE, como toda migração desta pasta: o laço só pega as tabelas que ainda não têm o RLS.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = current_schema()
       and c.relkind in ('r', 'p')
       and not c.relrowsecurity
  loop
    execute format('alter table %I enable row level security', t.relname);
  end loop;
end $$;
