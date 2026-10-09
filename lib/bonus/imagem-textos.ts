import { TETO_IMAGEM_DIARIO, type ProblemaDaImagem } from "./imagem-regras";
import { textoDaRecusaDaPublicacaoDoCarrossel, type RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";

// AS FRASES DO CRIADOR DE IMAGEM, fora do JSX e das actions (o princípio de lib/bonus/textos.ts): uma
// saída muda é indistinguível de sucesso, e cada saída tem frase, testada. As frases das recusas da
// OpenAI são as do Labs (erro-ilustracao.ts, copiado byte a byte).

export const TEXTO_GERANDO_A_IMAGEM = "Gerando a imagem… leva uns 30 segundos.";
export const TEXTO_IMAGEM_GERADA = "Imagem gerada.";
export const TEXTO_IMAGEM_TRAVADA = "A geração não terminou. Tente de novo.";
export const TEXTO_IMAGEM_NAO_SUBIU = "Não consegui guardar a imagem no armazenamento. Tente de novo.";
export const TEXTO_IMAGEM_FALHOU_SEM_MOTIVO = "A geração falhou sem dizer o motivo. Tente de novo.";

/**
 * As recusas de pedir uma imagem: as do carrossel (na fila, sem conta, slide só texto…), que são as do
 * publicar, e as próprias.
 */
export type RecusaDaImagem =
  | RecusaDaPublicacaoDoCarrossel
  | { motivo: "descricao"; texto: string }
  | { motivo: "sem_chave" }
  | { motivo: "teto" }
  | { motivo: "gerando" };

export function textoDaRecusaDaImagem(r: RecusaDaImagem): string {
  switch (r.motivo) {
    case "descricao":
      return r.texto;
    case "sem_chave":
      return TEXTO_SEM_CHAVE_DA_IMAGEM;
    case "teto":
      return `As ${TETO_IMAGEM_DIARIO} imagens das últimas 24 horas já foram geradas. A próxima libera quando a mais antiga completar um dia.`;
    case "gerando":
      return "Este slide já está gerando uma imagem. Espere ela terminar.";
    default:
      return textoDaRecusaDaPublicacaoDoCarrossel(r);
  }
}

/** "Hoje: 3 de 10 imagens." A conta das últimas 24 horas, que a tela mostra junto do campo. */
export function textoDoContador(hoje: number): string {
  return `Hoje: ${Math.min(hoje, TETO_IMAGEM_DIARIO)} de ${TETO_IMAGEM_DIARIO} imagens.`;
}

/** A imagem que voltou e não serve para o espaço: a frase não fala em subir, porque ninguém subiu nada. */
export function textoDoProblemaDaImagem(p: ProblemaDaImagem): string {
  return p === "pesada"
    ? "A imagem veio com mais de 2 MB, e o Chat não a guarda. Tente de novo."
    : "A OpenAI devolveu uma imagem que não serve para o espaço da arte. Tente de novo.";
}

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
