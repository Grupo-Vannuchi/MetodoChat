import type { Aviso } from "@/lib/avisos";
import type { MotivoDoApagar, PodeApagar } from "./apagar-regras";
import { TEXTO_CARROSSEL_NAO_ENCONTRADO } from "./carrossel-textos";

// AS FRASES DO APAGAR (spec da Etapa 10, "A página do carrossel"), fora do JSX e da action (o princípio
// de lib/bonus/textos.ts): uma saída muda é indistinguível de sucesso, e cada recusa tem frase, testada.

/** A resposta da action: só a recusa volta (o sucesso sai por redirect). `em` remonta o aviso. */
export type AvisoDoApagar = Aviso & { em: number };

export const TEXTO_APAGAR_CARROSSEL = "Apagar carrossel";
export const TEXTO_CONFIRMAR_APAGAR = "Apagar este carrossel e as imagens dele? Não tem volta.";
export const TEXTO_SIM_APAGAR = "Sim, apagar";
export const TEXTO_CANCELAR_APAGAR = "Cancelar";
export const TEXTO_CARROSSEL_APAGADO = "Carrossel apagado.";

export function textoDoApagar(motivo: MotivoDoApagar): string {
  switch (motivo) {
    case "agendado":
      return "Para apagar, cancele o agendamento no calendário antes.";
    case "publicado":
      return "Este carrossel já foi publicado, e fica como histórico.";
    case "desconhecido":
      return "Não consegui conferir a publicação deste carrossel; ele não pode ser apagado agora.";
    case "geracao":
      return "Espere a geração terminar para apagar.";
    case "imagem":
      return "Espere a imagem terminar para apagar.";
    case "nao_existe":
      return TEXTO_CARROSSEL_NAO_ENCONTRADO;
  }
}

/**
 * O QUE A PÁGINA MOSTRA NO FIM: o botão, quando pode; a frase no lugar dele, quando não pode; e nada no
 * publicado, que fica como histórico (decisão do Eduardo em 09/10).
 */
export function apagarNaPagina(r: PodeApagar): { tipo: "botao" } | { tipo: "frase"; texto: string } | { tipo: "nada" } {
  if (r.ok) return { tipo: "botao" };
  return r.motivo === "publicado" ? { tipo: "nada" } : { tipo: "frase", texto: textoDoApagar(r.motivo) };
}
