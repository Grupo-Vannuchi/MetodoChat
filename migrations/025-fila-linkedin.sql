-- O TIPO `publicacao_linkedin` ENTRA NA FILA (docs/specs/2026-11-06-linkedin-no-perfil.md, §0 e §6; a parte 2a
-- da entrega: o post só de texto ou com uma imagem, no perfil pessoal do LinkedIn).
--
-- A MECÂNICA É A DA `010`, que é o precedente exato: mesma tabela, mesma coluna, derruba a restrição e a recria
-- alargada. O `add constraint` VALIDA as linhas existentes, então um banco com `kind` fora da lista falha alto
-- em vez de passar calado. Esta alarga de onze tipos para doze.
--
-- ALARGAR É SEGURO EM UM DEPLOY SÓ, pelo motivo da `010`: o código antigo nunca escreve `publicacao_linkedin`,
-- e continua funcionando contra a restrição nova. E o código antigo NÃO DRENA o tipo novo: a seleção do dreno
-- filtra pelos tipos que ele conhece (lib/fila-tipos.ts), e uma linha do LinkedIn escrita por um preview fica
-- `pending`, intocada, até o código que a conhece chegar (testes-integracao/dreno-tipo-desconhecido.integracao.ts).
--
-- APLICADA À MÃO ANTES DO MERGE DA PARTE 2a, como a `022`, a `023` e a `024`. Na janela entre a aplicação e o
-- merge, o `scripts/migrar.mjs` da `main` aceita as duas formas do `queue_kind_check` (a da `010` e a desta);
-- com o merge, a forma desta vira a única (testes-integracao/conferencia-do-kind.integracao.ts).
--
-- OS TIPOS NA ORDEM DA `010`, com o novo no fim: o texto que o Postgres devolve (`pg_get_constraintdef`) segue
-- a ordem da lista, e a conferência compara o texto inteiro.
--
-- =============================================================================
-- POR QUE O NOME É `publicacao_linkedin`
--
-- O `publicacao` da `010` não leva sufixo porque, quando nasceu, todo tipo da fila era do Instagram. Este é o
-- primeiro que não é, e o sufixo é o que distingue. Renomear o `publicacao` para `publicacao_instagram` seria
-- migração de dado em produção, para nada.
--
-- E NÃO HÁ TABELA NOVA, pelo argumento da `010`: o post do LinkedIn cabe no `payload` (a forma, o caminho da
-- imagem quando há, o texto, e as marcas do que já foi feito: `imagem_urn`, `post_tentado_em`, `post_urn`).

alter table queue drop constraint if exists queue_kind_check;

alter table queue add constraint queue_kind_check check (kind in (
  'private_reply','comment_reply','dm_welcome','dm_link','dm_reminder',
  'dm_follow_gate','dm_email_ask','story_reaction','dm_manual','dm_lote',
  'publicacao','publicacao_linkedin'
));
