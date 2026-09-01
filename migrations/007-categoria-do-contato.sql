-- A CATEGORIA DO CONTATO — uma coluna, e mais nada.
--
-- Sem tabela de categorias, sem tela de administração, sem ciclo de vida
-- próprio: a lista de categorias É o conjunto de valores distintos em uso.
-- Quem impede `Aluno` e `aluno ` de virarem duas é `normalizarCategoria`
-- (lib/categorias.ts), com teste — a normalização é o que paga a simplicidade
-- desta coluna.
--
-- `null` significa "sem categoria", e é o estado de todos os 126 contatos que
-- existem no dia em que esta migração roda.

alter table contacts add column if not exists categoria text;
