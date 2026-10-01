// O QUE A TELA MOSTRA PARA CADA CARROSSEL, decidido fora do JSX, com teste.
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { textoGravado, type TextoDoCarrossel } from "./carrossel-texto";
import type { TipoDoRotulo } from "./tela";
import { geracaoNaTela } from "./tempos";

/** O que abre no formulário e no título: o último revisado, ou o gerado. */
export function textoDaLinhaDoCarrossel(l: LinhaDoCarrossel): TextoDoCarrossel | null {
  return textoGravado(l.revisado) ?? textoGravado(l.gerado);
}

export function descricaoDoCarrossel(l: Pick<LinhaDoCarrossel, "total_slides">): string {
  return l.total_slides === 1 ? "Post de 1 imagem" : `Carrossel de ${l.total_slides} slides`;
}

export function rotuloDoCarrossel(l: LinhaDoCarrossel, agoraMs: number): { texto: string; tipo: TipoDoRotulo } {
  switch (geracaoNaTela(l.estado, l.criado_em, agoraMs)) {
    case "gerando":
      return { texto: "Gerando", tipo: "neutro" };
    case "travou":
      return { texto: "Travou", tipo: "erro" };
    case "falhou":
      return { texto: "Falhou", tipo: "erro" };
    case "pronto":
      return l.revisado_em ? { texto: "Revisado", tipo: "ok" } : { texto: "Pronto para revisar", tipo: "neutro" };
  }
}
