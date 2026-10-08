-- O CARROSSEL AVULSO (Etapa 7 do gerador de bônus): o carrossel que nasce sem um bônus do Chat,
-- de um bônus que já está no Método Labs ou de um texto livre. O desenho inteiro está em
-- docs/specs/2026-10-06-carrossel-avulso.md.
--
-- `origem` diz de onde o carrossel veio: 'bonus' (o bônus do Chat, `bonus_id`), 'labs' (o bônus
-- do Labs, pelo código dele, `labs_codigo`) ou 'livre'. Os dois `check` de baixo amarram as
-- colunas à origem: o banco recusa um avulso com bônus, ou um carrossel de bônus sem ele.
-- `texto_a_mao` marca o carrossel escrito pelo operador, que não gasta IA e não conta no teto.
--
-- COLUNAS DE FEATURE, como a 014 e a 015: entram em `naoObservaveis` de lib/esquema.ts, e quem
-- confere é testes-integracao/bonus-carrossel-tabela.integracao.ts. O scripts/migrar.mjs não
-- muda (achado 82 da auditoria): ele só aplica este arquivo, como aplicou os do bônus antes.
--
-- SEGURA NA JANELA DO DEPLOY: o código antigo grava sempre o `bonus_id` e nunca a `origem`, que
-- nasce 'bonus' pelo padrão, e lê com `select *`, que ignora coluna nova. As linhas que já existem
-- ganham 'bonus', `labs_codigo` nulo e `texto_a_mao` falso, e passam nos três `check`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `add column if not exists`, e cada `check` é
-- derrubado se existir e criado de novo (o molde da 009).
alter table carrosseis_gerados alter column bonus_id drop not null;

alter table carrosseis_gerados add column if not exists origem text not null default 'bonus';
alter table carrosseis_gerados add column if not exists labs_codigo text;
alter table carrosseis_gerados add column if not exists texto_a_mao boolean not null default false;

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_origem_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_origem_check
  check (origem in ('bonus', 'labs', 'livre'));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_origem_bonus_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_origem_bonus_check
  check ((origem = 'bonus') = (bonus_id is not null));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_origem_labs_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_origem_labs_check
  check ((origem = 'labs') = (labs_codigo is not null));
