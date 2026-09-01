-- O TIPO `dm_lote` ENTRA NA FILA.
--
-- A `004` é o precedente exato: ela já reescreveu esta mesma restrição uma vez,
-- de cinco tipos para nove, e o comentário dela explica que `add constraint`
-- VALIDA as linhas existentes — num banco com `kind` fora da lista, isto falha
-- alto em vez de passar calado.
--
-- ALARGAR É SEGURO EM UM DEPLOY SÓ, e o motivo é a direção: o código ANTIGO
-- nunca escreve `dm_lote`, então ele continua funcionando contra a restrição
-- nova. Estreitar seria o caso perigoso — e foi por isso que a remoção das
-- colunas mortas (006) precisou de dois deploys.

alter table queue drop constraint if exists queue_kind_check;

alter table queue add constraint queue_kind_check check (kind in (
  'private_reply','comment_reply','dm_welcome','dm_link','dm_reminder',
  'dm_follow_gate','dm_email_ask','story_reaction','dm_manual','dm_lote'
));
