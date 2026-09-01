import { windowState } from "./inbox-window";

// O ENVIO EM LOTE, e as decisões dele fora do JSX e fora do motor.
//
// ESTE É O PRIMEIRO RECURSO DO PRODUTO QUE MANDA MENSAGEM PARA MUITA GENTE DE
// UMA VEZ. Tudo até aqui responde a quem falou primeiro. Isso muda o que um
// defeito custa: um erro aqui não é uma mensagem errada, são quarenta — saindo
// do perfil de verdade, para clientes de verdade. Por isso as três decisões
// (quem recebe, quem espera, até quando vale) moram aqui, com caso para cada
// saída, e não espalhadas pela tela e pelo dreno.

/** O que vai no `payload` de cada item de fila do lote. */
export type PayloadDoLote = {
  lote_id: string;
  text: string;
  url?: string;
  button_label?: string;
  valido_ate: string | null;
};

/**
 * Monta o payload. É a ÚNICA função que escreve estas chaves.
 *
 * `url` em branco NÃO vira chave: `lib/queue-drain.ts` decide o formato da
 * mensagem por `p.url` — com url monta botão, sem url manda texto puro. Uma
 * url vazia faria toda mensagem de lote virar um botão para lugar nenhum.
 */
export function payloadDoLote(dados: {
  loteId: string;
  text: string;
  url?: string;
  buttonLabel?: string;
  validoAte: string | null;
}): PayloadDoLote {
  const url = (dados.url ?? "").trim();
  const rotulo = (dados.buttonLabel ?? "").trim();
  return {
    lote_id: dados.loteId,
    text: dados.text,
    ...(url ? { url } : {}),
    ...(url && rotulo ? { button_label: rotulo } : {}),
    valido_ate: dados.validoAte,
  };
}

/** Lê o payload de volta. `null` quando não é um item de lote. */
export function lerPayloadDoLote(bruto: unknown): {
  loteId: string;
  text: string;
  url?: string;
  buttonLabel?: string;
  validoAte: string | null;
} | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const p = bruto as Record<string, unknown>;
  if (typeof p.lote_id !== "string" || !p.lote_id) return null;
  if (typeof p.text !== "string") return null;
  return {
    loteId: p.lote_id,
    text: p.text,
    ...(typeof p.url === "string" && p.url ? { url: p.url } : {}),
    ...(typeof p.button_label === "string" && p.button_label
      ? { buttonLabel: p.button_label }
      : {}),
    validoAte: typeof p.valido_ate === "string" ? p.valido_ate : null,
  };
}

export type DestinoDoLote = {
  /** ig_ids que recebem agora — a janela está aberta. */
  agora: string[];
  /** ig_ids cuja mensagem fica guardada até eles voltarem a falar. */
  esperam: string[];
  /**
   * Quantos dos que ESPERAM provavelmente nunca receberão.
   *
   * É PALPITE, e a tela tem de dizer isso. Conta quem tem uma única mensagem
   * recebida em todo o histórico — medido em 01/09/2026: 48 de 120 pessoas.
   * Eles continuam dentro de `esperam`, porque podem voltar amanhã; este número
   * é informação, não um terceiro balde, e não se subtrai dos outros dois.
   */
  improvaveis: number;
};

/**
 * Quem recebe agora e quem espera.
 *
 * A JANELA VEM DE `windowState`, a MESMA função que `lib/queue-drain.ts` usa
 * para RECUSAR um envio — ela fecha 5 minutos antes das 24h. Uma regra própria
 * aqui faria a tela prometer alcance que o motor recusa, no exato caso em que
 * ninguém conseguiria reproduzir: a faixa dura cinco minutos e some sozinha.
 */
export function destinoDoLote(
  contatos: { ig_id: string; last_reply_at: Date | string | null; recebidas: number }[],
  agora: number = Date.now()
): DestinoDoLote {
  const destino: DestinoDoLote = { agora: [], esperam: [], improvaveis: 0 };
  for (const c of contatos) {
    if (windowState(c.last_reply_at, agora).open) {
      destino.agora.push(c.ig_id);
      continue;
    }
    destino.esperam.push(c.ig_id);
    if (c.recebidas <= 1) destino.improvaveis += 1;
  }
  return destino;
}

/**
 * O lote já venceu?
 *
 * `null` é "sem prazo", e nunca vence — é o valor que atende o conteúdo que não
 * envelhece ("segue o material"), sem exigir um segundo mecanismo.
 *
 * DATA INVÁLIDA NÃO EXPIRA, e isso é escolha: tratar lixo como "vencido"
 * cancelaria envios em silêncio, que é a falha muda que este produto passou
 * semanas fechando. Tratar como "sem prazo" mantém a mensagem viva e visível.
 */
export function loteExpirou(validoAte: string | null, agora: number = Date.now()): boolean {
  if (!validoAte) return false;
  const t = new Date(validoAte).getTime();
  if (!Number.isFinite(t)) return false;
  return agora > t;
}
