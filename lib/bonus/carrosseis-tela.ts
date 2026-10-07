// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"), decidido
// fora do JSX, com teste. PURO: a página lê as linhas e o estado da fila, e esta função decide.
import { escolhasDaArte } from "./arte-escolhas";
import { textoDaOrigem } from "./avulso-textos";
import { caminhoDoCarrossel } from "./carrossel-caminho";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "./carrossel-tela";
import type { EstadoDaPublicacao } from "./publicar-estado";
import { rotuloDaPublicacao } from "./publicar-textos";
import type { TipoDoRotulo } from "./tela";

export type RotuloDaLista = { texto: string; tipo: TipoDoRotulo };

/**
 * Uma linha da lista. `href` é a página do carrossel: a de bônus, embaixo do bônus; a do avulso, em
 * /carrosseis. `detalhe` é a conta (o @ guardado no carrossel) e o número de slides; a data, a página
 * formata.
 */
export type ItemDaListaDeCarrosseis = {
  id: string;
  href: string;
  titulo: string;
  origem: string;
  detalhe: string;
  geracao: RotuloDaLista;
  publicacao: RotuloDaLista | null;
};

/** `estado` é o da fila, só para o carrossel que tem publicação; null nos outros. */
export function itemDaListaDeCarrosseis(l: LinhaDoCarrossel, estado: EstadoDaPublicacao | null, agoraMs: number): ItemDaListaDeCarrosseis {
  const { arroba } = escolhasDaArte(l.arte, l.total_slides);
  return {
    id: l.id,
    href: caminhoDoCarrossel(l),
    titulo: textoDaLinhaDoCarrossel(l)?.titulo ?? descricaoDoCarrossel(l),
    origem: textoDaOrigem(l),
    detalhe: [arroba ? `@${arroba}` : null, descricaoDoCarrossel(l)].filter((x): x is string => x !== null).join(" · "),
    geracao: rotuloDoCarrossel(l, agoraMs),
    publicacao: estado ? rotuloDaPublicacao(estado) : null,
  };
}
