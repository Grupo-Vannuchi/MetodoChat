import Anthropic from "@anthropic-ai/sdk";

// A FALHA DA API VIRA FRASE QUE O OPERADOR ENTENDE. Trazido do Labs (site-ia,
// src/lib/ia/erros.ts, commit b43ad27), SEM a repetição automática: lá ela nasceu
// de um problema medido (429 no meio de uma pauta), e aqui essa medição não existe.
// Um 429 vira "gere de novo".

/** Constante porque a tela a reconhece depois, lida do banco. */
export const AVISO_SEM_CREDITO =
  "Os créditos da API da Anthropic acabaram. Adicione crédito em console.anthropic.com → Billing";

const SINAIS_DE_CREDITO = ["credit balance is too low", "insufficient_quota", "billing"];

function pareceFaltaDeCredito(texto: string): boolean {
  const t = texto.toLowerCase();
  return SINAIS_DE_CREDITO.some((sinal) => t.includes(sinal));
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) {
    return "A chave da API da Anthropic é inválida ou expirou. Confira ANTHROPIC_API_KEY nas variáveis de ambiente.";
  }
  if (e instanceof Anthropic.RateLimitError) {
    return "A API da Anthropic recusou por excesso de chamadas. Tente de novo em alguns minutos.";
  }
  if (e instanceof Anthropic.BadRequestError) {
    if (pareceFaltaDeCredito(e.message)) {
      return `${AVISO_SEM_CREDITO} e tente de novo. Nada foi cobrado por esta tentativa.`;
    }
    return `A API recusou o pedido. Isso costuma ser defeito no código, e não configuração: vale reportar. Detalhe técnico: ${e.message.slice(0, 300)}`;
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return "Não foi possível falar com a API da Anthropic (rede ou tempo esgotado). Tente de novo.";
  }
  if (e instanceof Anthropic.APIError) {
    if (pareceFaltaDeCredito(e.message)) return `${AVISO_SEM_CREDITO} e tente de novo.`;
    if (e.status && e.status >= 500) {
      return "A API da Anthropic está com problema do lado dela. Tente de novo em alguns minutos.";
    }
    return `Erro ${e.status ?? "desconhecido"} na API da Anthropic: ${e.message.slice(0, 300)}`;
  }
  return e instanceof Error ? e.message.slice(0, 300) : "Falha inesperada ao gerar.";
}

/**
 * Exceção que não devia acontecer (bug, banco fora). Separada de `mensagemDeErro`
 * para um defeito nosso não aparecer como "a API recusou" e mandar a pessoa
 * procurar no lugar errado.
 */
export function mensagemDeFalhaInesperada(erro: unknown): string {
  const detalhe = erro instanceof Error ? erro.message : String(erro);
  return `A geração falhou por um erro inesperado no servidor: ${detalhe.slice(0, 300)}`;
}

/** 42P01: a tabela não existe. É a 013 que falta, e a tela diz isso em vez de estourar. */
export function ehTabelaAusente(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "42P01";
}
