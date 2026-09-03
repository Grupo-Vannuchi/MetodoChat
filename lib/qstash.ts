import "server-only";
import { Client, Receiver } from "@upstash/qstash";

// QStash (Upstash, via marketplace da Vercel) acorda o app na hora certa
// para enviar lembretes e tentar de novo após falhas. É OPCIONAL:
// sem ele, a fila é drenada quando chega webhook e no cron diário.

export function qstashEnabled(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}

/**
 * O ATRASO MÁXIMO QUE ESTE PRODUTO ENTREGA AO QSTASH: um dia.
 *
 * NÃO É O LIMITE DELE — É O LIMITE DO QUE NÓS CONFERIMOS. O horizonte real do
 * QStash não foi verificado, e o levantamento da publicação registrou isso
 * como pergunta aberta. Um post agendado para o mês que vem não pode depender
 * da resposta: se o QStash recusar um atraso de 30 dias, `scheduleTick` engole
 * o erro (é o `catch` logo abaixo, e ele está certo) e o post simplesmente não
 * sai — sem uma linha dizendo por quê.
 *
 * O DESENHO QUE NÃO DEPENDE DA RESPOSTA é o do cron diário: ele varre o que
 * vence nas próximas 24 h e arma um tique para cada (`armarTiquesDoDia`,
 * lib/queue-drain.ts). Horizonte infinito do nosso lado, e o QStash só recebe
 * atrasos de até um dia — que é a faixa em que ele já funciona hoje, todo dia,
 * em produção.
 *
 * Quem respeita esta constante são os dois lugares que pedem tique com atraso
 * escolhido: `enqueue` (lib/engine.ts) e o rodapé de `drainQueue`.
 */
export const HORIZONTE_DO_TIQUE_EM_SEGUNDOS = 24 * 60 * 60;

// Agenda uma chamada a /api/queue/tick daqui a `delaySeconds`.
export async function scheduleTick(appUrl: string, delaySeconds: number): Promise<void> {
  if (!qstashEnabled() || !appUrl) return;
  try {
    const client = new Client({ token: process.env.QSTASH_TOKEN! });
    await client.publishJSON({
      url: `${appUrl}/api/queue/tick`,
      body: { reason: "scheduled" },
      delay: Math.max(0, Math.ceil(delaySeconds)),
    });
  } catch {
    // sem pânico: o cron diário e os webhooks seguintes drenam a fila
  }
}

export async function verifyQstashSignature(
  signature: string | null,
  body: string
): Promise<boolean> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !signature) return false;
  try {
    const receiver = new Receiver({
      currentSigningKey: current,
      nextSigningKey: next ?? current,
    });
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}
