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
  // O POST NO PERFIL PESSOAL DO LINKEDIN (a 025; docs/specs/2026-11-06-linkedin-no-perfil.md, §6). Quem o
  // publica é lib/linkedin-fila.ts, chamado pelo ramo dele no dreno.
  "publicacao_linkedin",
] as const;

export type TipoDaFila = (typeof TIPOS_QUE_O_DRENO_CONHECE)[number];

// OS TIPOS QUE SÃO POST, E NÃO MENSAGEM (a spec, §6). Os pontos que dizem "post, e não mensagem" perguntam a
// esta lista, e não a um literal: a cota horária de DM não conta post, a conta no teto de DM não segura post, e
// os tiques do dia são armados só para post (lib/queue-drain.ts). Com um literal, o post do LinkedIn comeria a
// cota de DM e ficaria parado atrás de um lote grande.
export const TIPOS_DE_PUBLICACAO = ["publicacao", "publicacao_linkedin"] as const satisfies readonly TipoDaFila[];

// A ORDEM DO LOTE (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md). O laço do
// dreno (lib/queue-drain.ts) percorre o lote nesta ordem: primeiro o post do LinkedIn que já foi adiado por falta de
// tempo, e depois o resto, na ordem em que a seleção o trouxe.
//
// POR QUÊ: o ramo do LinkedIn só começa um passo se o prazo da função cobre o pior caso dele, e devolve a linha à fila
// sem gastar a tentativa quando não cobre (lib/linkedin-fila.ts). Uma linha que sempre chega tarde no lote, depois
// de outros itens, seria adiada para sempre. A parte 3 grava o `adiamentos` no payload; este código só o lê.
//
// SÓ O JÁ ADIADO SOBE (nota da auditoria): um post do LinkedIn novo à frente de todo lote ocuparia quase a passada
// inteira, e as mensagens e as respostas a comentário do mesmo lote iriam sempre para a passada seguinte. O adiamento
// que conta é um número inteiro a partir de 1; qualquer outra coisa no payload não move a linha.
export function naOrdemDoLote<T extends { kind: string; payload: unknown }>(lote: readonly T[]): T[] {
  const jaAdiado = (i: T) => i.kind === "publicacao_linkedin" && adiamentosDoPayload(i.payload) >= 1;
  return [...lote.filter(jaAdiado), ...lote.filter((i) => !jaAdiado(i))];
}

function adiamentosDoPayload(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const v = (payload as Record<string, unknown>).adiamentos;
  return typeof v === "number" && Number.isInteger(v) ? v : 0;
}
