// A janela de 24h da Meta, como função pura.
//
// A regra já existia dentro do motor de envio, mas só respondia "dá ou não dá".
// O inbox precisa mostrar QUANTO tempo resta antes de a pessoa digitar — senão
// ela escreve, clica em enviar e toma erro, o que parece defeito do produto.

export const WINDOW_MS = 24 * 60 * 60 * 1000;

// Fecha 5 minutos antes do limite real. A mesma margem que o motor de envio
// sempre usou: uma mensagem que sai faltando 10 segundos pode chegar tarde.
export const WINDOW_MARGIN_MS = 5 * 60 * 1000;

export type WindowState = { open: boolean; msLeft: number };

export function windowState(
  lastReplyAt: Date | string | null | undefined,
  now: number = Date.now()
): WindowState {
  const last = lastReplyAt ? new Date(lastReplyAt).getTime() : 0;
  if (!last) return { open: false, msLeft: 0 };
  const msLeft = WINDOW_MS - WINDOW_MARGIN_MS - (now - last);
  return { open: msLeft > 0, msLeft: Math.max(0, msLeft) };
}

export function formatWindowLeft(msLeft: number): string {
  if (msLeft <= 0) return "fechada";
  if (msLeft < 60_000) return "menos de 1 min";
  const minutos = Math.floor(msLeft / 60_000);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}`;
}

/**
 * QUANTO DA JANELA AINDA EXISTE, de 0 a 1 — o preenchimento do traço.
 *
 * É a assinatura visual desta reformulação (spec §3): a janela de 24h deixa de
 * ser uma pílula no canto e vira um traço no começo de toda linha que tem
 * prazo, cujo preenchimento é o tempo restante. Cheio é o dia inteiro pela
 * frente; vazio é fechada.
 *
 * O DENOMINADOR É A JANELA ÚTIL, e não as 24h cheias: `windowState` já desconta
 * a margem de 5 minutos que o motor sempre respeitou, então o traço tem de
 * medir contra o mesmo total — senão ele nunca chegaria a cheio, e a linha de
 * quem acabou de escrever apareceria com um pedacinho faltando sem motivo.
 *
 * SATURA NAS DUAS PONTAS. Acima de 1 aconteceria com relógio adiantado do
 * servidor ou `last_reply_at` no futuro (o webhook grava o que a Meta manda);
 * abaixo de 0, com a janela vencida. Nenhum dos dois pode virar uma barra que
 * transborda a caixa ou que desenha para trás.
 */
export function fracaoDaJanela(msLeft: number): number {
  const util = WINDOW_MS - WINDOW_MARGIN_MS;
  return Math.min(1, Math.max(0, msLeft / util));
}
