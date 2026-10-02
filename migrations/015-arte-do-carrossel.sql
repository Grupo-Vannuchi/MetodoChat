-- A ARTE DO CARROSSEL (Etapa 3 do gerador de bônus): as escolhas do operador para desenhar os
-- slides em PNG. O desenho inteiro está em docs/specs/2026-10-01-arte-do-carrossel.md.
--
-- `arte` guarda a conta do Instagram do cabeçalho (`conta`, o ig_user_id) e os slides marcados
-- como "só texto" (`soTexto`, números de 1 ao total). Nenhum PNG é guardado: cada slide é
-- desenhado na hora, a partir do texto salvo.
--
-- COLUNA DE FEATURE, como a 014: entra em `naoObservaveis` de lib/esquema.ts, e quem confere é
-- testes-integracao/bonus-carrossel-tabela.integracao.ts.
--
-- Os carrosséis que já existem ganham `{}`: até o operador escolher, a arte usa a conta
-- selecionada no Chat. IDEMPOTENTE, como toda migração desta pasta: `add column if not exists`.
alter table carrosseis_gerados
  add column if not exists arte jsonb not null default '{}'::jsonb;
