// AS FRASES DO CARROSSEL AVULSO (spec da Etapa 7), fora do JSX, como as de carrossel-textos.ts: uma
// saída muda é indistinguível de sucesso, e o texto de cada saída vem de função pura, com teste.
import type { Aviso } from "@/lib/avisos";
import { CONTEUDO_MAX, CONTEUDO_MIN, DESTAQUE_MAX, type RecusaDoPedidoAvulso } from "./avulso-pedido";
import { contextoGravado } from "./carrossel-ia-parametros";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { SLIDES_MAX, SLIDES_MIN } from "./carrossel-pedido";
import { PALAVRA_MAX, PALAVRA_MIN, TEMA_MAX } from "./pedido";

/** A recusa do "Novo carrossel", que volta como estado do formulário (achado 52), e nunca por redirect. */
export type AvisoDoAvulso = Aviso & { em: number };

export function textoDaRecusaDoPedidoAvulso(motivo: RecusaDoPedidoAvulso): string {
  switch (motivo) {
    case "origem_invalida":
      return "Escolha de onde vem o carrossel: um bônus do Labs ou um texto livre.";
    case "jeito_invalido":
      return "Escolha se a IA escreve o texto ou se você escreve à mão.";
    case "total_invalido":
      return `Escolha de ${SLIDES_MIN} a ${SLIDES_MAX} slides.`;
    case "sem_bonus":
      return "Escolha um bônus do Labs.";
    case "destaque_longo":
      return `O que destacar passa de ${DESTAQUE_MAX} caracteres. Resuma.`;
    case "tema_vazio":
      return "Escreva o tema do post.";
    case "tema_longo":
      return `O tema passa de ${TEMA_MAX} caracteres.`;
    case "palavra_invalida":
      return `A palavra-chave é uma palavra só, com letras e números, de ${PALAVRA_MIN} a ${PALAVRA_MAX}.`;
    case "conteudo_curto":
      return `Escreva ou cole o conteúdo do post, com pelo menos ${CONTEUDO_MIN} caracteres.`;
    case "conteudo_longo":
      return `O conteúdo passa de ${CONTEUDO_MAX} caracteres. Resuma.`;
  }
}

/** De onde o carrossel veio, na lista "Carrosséis" e no topo da página do avulso. */
export function textoDaOrigem(l: Pick<LinhaDoCarrossel, "origem" | "contexto">): string {
  if (l.origem === "bonus") return "Bônus do Chat";
  const c = contextoGravado(l.contexto);
  if (l.origem === "labs") return c && !("tipo" in c) ? `Bônus do Labs: ${c.titulo}` : "Bônus do Labs";
  return c && "tipo" in c ? `Texto livre: ${c.tema}` : "Texto livre";
}
