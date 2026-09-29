// OS PARÂMETROS DA CHAMADA À IA, PUROS, para o teste ver o que sai sem gastar nada.
//
// Decisões (spec, "A geração"): `claude-opus-5-5`, esforço `high` (o nível em que a
// instrução foi calibrada no Labs; o padrão deste modelo seria `medium`), fallback
// de recusa do servidor na forma `default`. SEM `cache_control`: a escrita no
// cache custa 1,25x e só se paga com duas gerações em 5 minutos, o que o teto de 5
// por dia torna raro. A medição grava cache criado e lido para rever com número.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { INSTRUCAO_BONUS } from "./instrucao-bonus";
import type { Pedido } from "./pedido";
import { BonusGeradoSchema } from "./schema";

export const MODELO = "claude-opus-5-5";
export const BETA_DO_FALLBACK = "server-side-fallback-2026-07-01";

/**
 * A mensagem do usuário. O que o operador digitou mora AQUI, e nunca no `system`.
 * A palavra digitada NÃO vai: ela vence a da IA depois (`palavraFinal`), e o schema
 * aceita até 14 letras contra as 30 que o formulário aceita.
 */
export function mensagemDoPedido(p: Pedido): string {
  return `Tema: ${p.tema}\n\nO que deve resolver:\n${p.oQueResolve}`;
}

export function parametrosDaGeracao(p: Pedido) {
  return {
    model: MODELO,
    max_tokens: 16_000,
    betas: [BETA_DO_FALLBACK],
    fallbacks: "default" as const,
    system: INSTRUCAO_BONUS,
    messages: [{ role: "user" as const, content: mensagemDoPedido(p) }],
    output_config: { effort: "high" as const, format: betaZodOutputFormat(BonusGeradoSchema) },
  };
}

export type Medicao = {
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  cacheCriado: number;
  cacheLido: number;
};

/** `modelo` é o que RESPONDEU: com o fallback ligado, pode não ser o pedido. */
export function medicaoDe(
  modelo: string,
  uso: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  }
): Medicao {
  return {
    modelo,
    tokensEntrada: uso.input_tokens,
    tokensSaida: uso.output_tokens,
    cacheCriado: uso.cache_creation_input_tokens ?? 0,
    cacheLido: uso.cache_read_input_tokens ?? 0,
  };
}
