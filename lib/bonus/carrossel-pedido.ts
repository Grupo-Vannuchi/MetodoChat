// O PEDIDO DE UM CARROSSEL: de qual bônus e com quantos slides.
//
// PURO, como lib/bonus/pedido.ts: quem decide o que é pedido válido é esta função, e não o
// corpo da action.
import { ehIdDeBonus } from "./pedido";

/** Gerações de carrossel em 24 horas, somando o painel inteiro. Decidido pelo Eduardo em 30/09. */
export const TETO_CARROSSEL_DIARIO = 10;

/** O total de slides do post, contando o gancho e a chamada. 1 é um post de imagem única. */
export const SLIDES_MIN = 1;
/** O teto da Meta para um carrossel, o mesmo `CARROSSEL_ITENS_MAX` de lib/publicacao.ts. */
export const SLIDES_MAX = 10;
/** Sugestão do chefe do Eduardo, em 30/09: o máximo que a Meta aceita. */
export const SLIDES_PADRAO = 10;

export type PedidoDeCarrossel = { bonusId: string; total: number };
export type RecusaDoPedidoDeCarrossel = "bonus_invalido" | "total_invalido";

export function lerPedidoDeCarrossel(bruto: { bonusId: unknown; total: unknown }):
  | { ok: true; pedido: PedidoDeCarrossel }
  | { ok: false; motivo: RecusaDoPedidoDeCarrossel } {
  if (!ehIdDeBonus(bruto.bonusId)) return { ok: false, motivo: "bonus_invalido" };
  const texto = typeof bruto.total === "string" ? bruto.total.trim() : "";
  if (!/^\d{1,2}$/.test(texto)) return { ok: false, motivo: "total_invalido" };
  const total = Number(texto);
  if (total < SLIDES_MIN || total > SLIDES_MAX) return { ok: false, motivo: "total_invalido" };
  return { ok: true, pedido: { bonusId: bruto.bonusId, total } };
}

export function restamCarrosseisHoje(usadas: number): number {
  return Math.max(0, TETO_CARROSSEL_DIARIO - usadas);
}

/** Os slides de conteúdo entre o gancho e a chamada. 0 no post único e no carrossel de 2. */
export function slidesDeConteudo(total: number): number {
  return Math.max(0, total - 2);
}
