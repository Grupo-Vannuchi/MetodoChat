// AS FRASES DO CRIADOR DE IMAGEM, fora do JSX e das actions (o princípio de lib/bonus/textos.ts): uma
// saída muda é indistinguível de sucesso, e cada saída tem frase, testada. As frases das recusas da
// OpenAI são as do Labs (erro-ilustracao.ts, copiado byte a byte).

export const TEXTO_SEM_CHAVE_DA_IMAGEM =
  "A geração de imagem não está configurada: falta a chave da OpenAI no servidor. Avise quem cuida do Chat.";
export const TEXTO_OPENAI_DEMOROU = "A OpenAI demorou demais para responder. Tente de novo.";
export const TEXTO_SEM_REDE_DA_OPENAI = "Não consegui falar com a OpenAI. Tente de novo em instantes.";
export const TEXTO_OPENAI_SEM_IMAGEM = "A OpenAI respondeu sem a imagem. Tente de novo; se repetir, avise quem cuida do Chat.";

/**
 * A CHAVE NUNCA VAI PARA UMA FRASE. A mensagem que a OpenAI devolve num 401 traz um pedaço mascarado da
 * chave ("Incorrect API key provided: " seguido do começo e do fim dela), e a frase do Labs repassa a
 * mensagem inteira entre parênteses. Antes de a frase ir para a tela ou para o banco, todo trecho que
 * começa como uma chave da OpenAI vira "sk-…", e a chave inteira, se aparecer, vira "…".
 */
export function tirarChave(texto: string, chave?: string): string {
  const semInteira = chave ? texto.split(chave).join("…") : texto;
  return semInteira.replace(/sk-[A-Za-z0-9_*.-]+/g, "sk-…");
}
