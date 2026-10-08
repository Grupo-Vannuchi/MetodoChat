// O PEDIDO DE UM CARROSSEL AVULSO (spec da Etapa 7): de um bônus que já está no Método Labs, ou de um
// texto livre, pela IA ou escrito à mão.
//
// PURO, como lib/bonus/pedido.ts: quem decide o que é pedido válido é esta função, e não o corpo da
// action. Do bônus do Labs, o formulário só traz o código: o título, a descrição, o tema e a palavra
// são lidos da lista pública na hora do pedido, e nunca aceitos do formulário.
import type { ContextoDeBonus, ContextoDoCarrossel, ContextoLivre } from "./carrossel-ia-parametros";
import { lerTotalDeSlides } from "./carrossel-pedido";
import { O_QUE_RESOLVE_MAX, TEMA_MAX, normalizarPalavra, palavraValida } from "./pedido";
import { CODIGO_MAX, type BonusDoLabs } from "./publicado";

/** O conteúdo do texto livre: o que o post divulga, escrito ou colado do Notion. */
export const CONTEUDO_MIN = 20;
export const CONTEUDO_MAX = 8000;
/** O "O que destacar" vai para a IA no lugar do "o que resolve" do bônus do Chat, com o mesmo teto. */
export const DESTAQUE_MAX = O_QUE_RESOLVE_MAX;

/** A IA escreve, ou o operador escreve à mão (sem IA e fora do teto). */
export type JeitoDoTexto = "ia" | "mao";

export type PedidoAvulso =
  | { origem: "labs"; codigo: string; destaque: string; total: number; jeito: JeitoDoTexto }
  | { origem: "livre"; tema: string; palavra: string; conteudo: string; total: number; jeito: JeitoDoTexto };

export type RecusaDoPedidoAvulso =
  | "origem_invalida"
  | "jeito_invalido"
  | "total_invalido"
  | "sem_bonus"
  | "destaque_longo"
  | "tema_vazio"
  | "tema_longo"
  | "palavra_invalida"
  | "conteudo_curto"
  | "conteudo_longo";

/** O \r\n do textarea volta a ser \n antes de contar (a lição da FASE 1.11-bis). */
function texto(v: unknown): string {
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
}

export function lerPedidoAvulso(bruto: {
  origem: unknown;
  codigo: unknown;
  destaque: unknown;
  tema: unknown;
  palavra: unknown;
  conteudo: unknown;
  total: unknown;
  jeito: unknown;
}): { ok: true; pedido: PedidoAvulso } | { ok: false; motivo: RecusaDoPedidoAvulso } {
  const origem = bruto.origem;
  if (origem !== "labs" && origem !== "livre") return { ok: false, motivo: "origem_invalida" };
  const jeito = bruto.jeito;
  if (jeito !== "ia" && jeito !== "mao") return { ok: false, motivo: "jeito_invalido" };
  const total = lerTotalDeSlides(bruto.total);
  if (total === null) return { ok: false, motivo: "total_invalido" };

  if (origem === "labs") {
    const codigo = texto(bruto.codigo);
    if (!codigo || codigo.length > CODIGO_MAX) return { ok: false, motivo: "sem_bonus" };
    const destaque = texto(bruto.destaque);
    if (destaque.length > DESTAQUE_MAX) return { ok: false, motivo: "destaque_longo" };
    return { ok: true, pedido: { origem, codigo, destaque, total, jeito } };
  }

  const tema = texto(bruto.tema);
  if (!tema) return { ok: false, motivo: "tema_vazio" };
  if (tema.length > TEMA_MAX) return { ok: false, motivo: "tema_longo" };
  const palavra = normalizarPalavra(texto(bruto.palavra));
  if (!palavraValida(palavra)) return { ok: false, motivo: "palavra_invalida" };
  const conteudo = texto(bruto.conteudo);
  if (conteudo.length < CONTEUDO_MIN) return { ok: false, motivo: "conteudo_curto" };
  if (conteudo.length > CONTEUDO_MAX) return { ok: false, motivo: "conteudo_longo" };
  return { ok: true, pedido: { origem, tema, palavra, conteudo, total, jeito } };
}

/** O contexto do avulso do Labs: o que o Labs diz do bônus, e o destaque (ou a descrição) para a IA. */
export function contextoDoLabs(b: BonusDoLabs, destaque: string): ContextoDeBonus {
  return { tema: b.tema, titulo: b.titulo, descricao: b.descricao, oQueResolve: destaque || b.descricao };
}

export function contextoLivre(p: { tema: string; conteudo: string }): ContextoLivre {
  return { tipo: "livre", tema: p.tema, conteudo: p.conteudo };
}

/**
 * O TÍTULO INTERNO do carrossel escrito à mão: o campo `titulo` do texto, que a IA escreve quando gera
 * e que dá nome ao carrossel na lista. O do bônus do Labs, ou o tema do texto livre.
 */
export function tituloInterno(c: ContextoDoCarrossel): string {
  return "tipo" in c ? c.tema : c.titulo;
}
