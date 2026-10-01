import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { parametrosDoCarrossel, parametrosDoPost, type PedidoParaIA } from "./carrossel-ia-parametros";
import { deCarrossel, dePost, type TextoDoCarrossel } from "./carrossel-texto";
import { mensagemDeErro } from "./erros";
import { TEXTO_SEM_CHAVE } from "./ia";
import { medicaoDe, type Medicao } from "./ia-parametros";
import { TIMEOUT_IA_MS } from "./tempos";

// A CHAMADA À IA PARA O CARROSSEL. O resto da feature não conhece a SDK; a política mora em
// carrossel-ia-parametros.ts, que é puro e testado. Molde: lib/bonus/ia.ts.

export type ResultadoDoCarrossel =
  | { ok: true; texto: TextoDoCarrossel; medicao: Medicao }
  | { ok: false; erro: string; medicao: Medicao | null };

type RespostaParseada<T> = {
  model: string;
  usage: Parameters<typeof medicaoDe>[1];
  stop_reason: string | null;
  parsed_output?: T | null;
};

function resultadoDe<T>(r: RespostaParseada<T>, converter: (d: T) => TextoDoCarrossel): ResultadoDoCarrossel {
  const medicao = medicaoDe(r.model, r.usage);
  if (r.stop_reason === "refusal") {
    return { ok: false, erro: "O modelo recusou o pedido. Gere de novo.", medicao };
  }
  if (r.stop_reason === "max_tokens") {
    return { ok: false, erro: "A resposta da IA passou do tamanho máximo e veio cortada. Gere de novo.", medicao };
  }
  if (!r.parsed_output) {
    return { ok: false, erro: "A IA respondeu fora do formato esperado. Gere de novo.", medicao };
  }
  return { ok: true, texto: converter(r.parsed_output), medicao };
}

/**
 * `maxRetries: 0` DE PROPÓSITO, como no bônus: com o padrão da SDK (2), o pior caso passaria do
 * teto da página. A repetição que resta é o botão "Gerar de novo", que conta no teto diário.
 */
export async function gerarTextoDoCarrossel(p: PedidoParaIA): Promise<ResultadoDoCarrossel> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, erro: TEXTO_SEM_CHAVE, medicao: null };

  const cliente = new Anthropic({ timeout: TIMEOUT_IA_MS, maxRetries: 0 });
  try {
    if (p.total === 1) return resultadoDe(await cliente.beta.messages.parse(parametrosDoPost(p)), dePost);
    return resultadoDe(await cliente.beta.messages.parse(parametrosDoCarrossel(p)), deCarrossel);
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e), medicao: null };
  }
}
