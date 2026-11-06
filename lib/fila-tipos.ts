// OS TIPOS DE LINHA QUE ESTE CÓDIGO SABE DRENAR (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// É A MESMA LISTA DO `queue_kind_check` do banco, e um teste prende as duas (tests/fila-tipos.test.ts): ele
// lê a última migração que escreve a restrição e exige os mesmos tipos daqui. O tipo da linha da fila
// (`QueueItem["kind"]`, lib/db.ts) sai daqui também, para não haver uma segunda lista que o compilador
// confira e o banco não.
//
// O DRENO SÓ PEGA ESTES TIPOS. A seleção e o rodapé do tique (lib/queue-drain.ts) filtram por esta lista:
// uma linha de tipo que este código não conhece — escrita por um código mais novo, com o banco já
// alargado — fica `pending`, intocada, até o código que a conhece chegar. Sem o filtro, o dreno de hoje a
// mandaria para o caminho das mensagens, e o rodapé armaria um tique a cada 20 segundos por ela.
//
// SEM IMPORT NENHUM: o arquivo é puro, e o teste o lê sem banco.
export const TIPOS_QUE_O_DRENO_CONHECE = [
  "private_reply",
  "comment_reply",
  "dm_welcome",
  "dm_link",
  "dm_reminder",
  "dm_follow_gate",
  "dm_email_ask",
  "story_reaction",
  "dm_manual",
  "dm_lote",
  "publicacao",
] as const;

export type TipoDaFila = (typeof TIPOS_QUE_O_DRENO_CONHECE)[number];
