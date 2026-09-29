import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { mensagemDeErro } from "./erros";
import { medicaoDe, parametrosDaGeracao, type Medicao } from "./ia-parametros";
import type { Pedido } from "./pedido";
import type { BonusGerado } from "./schema";
import { TIMEOUT_IA_MS } from "./tempos";

// A CHAMADA À IA. O resto da feature não conhece a SDK; a política (modelo,
// esforço, fallback) mora em ia-parametros.ts, que é puro e testado.

export type ResultadoDaGeracao =
  | { ok: true; dados: BonusGerado; medicao: Medicao }
  | { ok: false; erro: string; medicao: Medicao | null };

export const TEXTO_SEM_CHAVE =
  "A geração está desligada: falta a ANTHROPIC_API_KEY no servidor.";

/**
 * `maxRetries: 0` DE PROPÓSITO: o padrão da SDK é 2, e com ele o pior caso vira
 * 3 x 150 s, bem além do teto da página. A repetição que resta é o botão "gerar de
 * novo", que conta no teto diário.
 */
export async function gerarBonus(pedido: Pedido): Promise<ResultadoDaGeracao> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, erro: TEXTO_SEM_CHAVE, medicao: null };

  const cliente = new Anthropic({ timeout: TIMEOUT_IA_MS, maxRetries: 0 });
  try {
    const resposta = await cliente.beta.messages.parse(parametrosDaGeracao(pedido));
    const medicao = medicaoDe(resposta.model, resposta.usage);

    if (resposta.stop_reason === "refusal") {
      return {
        ok: false,
        erro: "O modelo recusou o pedido. Reescreva o tema ou o que o bônus resolve e gere de novo.",
        medicao,
      };
    }
    if (resposta.stop_reason === "max_tokens") {
      return { ok: false, erro: "A resposta da IA passou do tamanho máximo e veio cortada. Gere de novo.", medicao };
    }
    if (!resposta.parsed_output) {
      return { ok: false, erro: "A IA respondeu fora do formato esperado. Gere de novo.", medicao };
    }
    return { ok: true, dados: resposta.parsed_output, medicao };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e), medicao: null };
  }
}
