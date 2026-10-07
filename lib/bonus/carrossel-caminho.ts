// O ENDEREÇO DE CADA CARROSSEL, decidido pela linha (spec da Etapa 7, "As rotas"). PURO.
//
// O carrossel de bônus mora na página de hoje, embaixo do bônus; o avulso, em /carrosseis. A arte, o
// "Baixar", o aviso na URL e os redirects montam o endereço a partir daqui, e não do id do bônus.
import type { LinhaDoCarrossel } from "./carrossel-linha";

/** A rota que pediu o carrossel: a do bônus, com o id dele na URL, ou a dos avulsos. */
export type RotaDoCarrossel = { tipo: "bonus"; bonusId: string } | { tipo: "avulso" };

/** O caminho da página do carrossel, sem a barra do fim. */
export function caminhoDoCarrossel(l: Pick<LinhaDoCarrossel, "id" | "origem" | "bonus_id">): string {
  return l.origem === "bonus" && l.bonus_id ? `/bonus/${l.bonus_id}/carrossel/${l.id}` : `/carrosseis/${l.id}`;
}

/** Cada rota serve só a sua origem: o carrossel da outra dá 404 nas duas. */
export function ehDaRota(l: Pick<LinhaDoCarrossel, "origem" | "bonus_id">, rota: RotaDoCarrossel): boolean {
  return rota.tipo === "bonus" ? l.origem === "bonus" && l.bonus_id === rota.bonusId : l.origem !== "bonus";
}
