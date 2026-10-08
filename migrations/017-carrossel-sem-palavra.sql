-- O CARROSSEL SEM PALAVRA-CHAVE (Etapa 8 do gerador de bônus): a chamada final pede uma ação
-- escolhida pelo operador (salvar o post, compartilhar, seguir o perfil ou comentar a opinião), e não
-- há funil de palavra. Vale no texto livre e no bônus do Labs que não tem palavra. O desenho inteiro
-- está em docs/specs/2026-10-08-carrossel-sem-palavra.md.
--
-- `palavra` passa a aceitar nulo, e `acao_da_chamada` guarda a ação. Os quatro `check` de baixo
-- amarram as duas: ou palavra, ou ação, nunca as duas e nunca nenhuma; o carrossel de bônus do Chat
-- sempre tem palavra; a ação é uma das quatro; e a palavra vazia não é um terceiro jeito de dizer
-- "sem palavra" (o nulo passa nesse, e nos outros dois que olham uma coluna só).
--
-- COLUNA DE FEATURE, como a 014, a 015 e a 016: entra em `naoObservaveis` de lib/esquema.ts, e quem
-- confere é testes-integracao/bonus-carrossel-tabela.integracao.ts. O scripts/migrar.mjs não muda
-- (achado 82 da auditoria).
--
-- SEGURA NA JANELA DO DEPLOY: o código antigo grava sempre a palavra e nunca a ação, e lê com
-- `select *`, que ignora coluna nova. As linhas que já existem têm palavra e ficam sem ação, e passam
-- nos quatro `check`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `add column if not exists`, e cada `check` é
-- derrubado se existir e criado de novo (o molde da 009).
alter table carrosseis_gerados alter column palavra drop not null;

alter table carrosseis_gerados add column if not exists acao_da_chamada text;

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_acao_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_acao_check
  check (acao_da_chamada in ('salvar', 'compartilhar', 'seguir', 'comentar'));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_palavra_ou_acao_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_palavra_ou_acao_check
  check ((palavra is null) = (acao_da_chamada is not null));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_bonus_palavra_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_bonus_palavra_check
  check (origem <> 'bonus' or palavra is not null);

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_palavra_vazia_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_palavra_vazia_check
  check (palavra <> '');
