// O PEDIDO DE UM BÔNUS: o que o operador digita antes de a IA escrever.
//
// PURO, sem `server-only`. Quem decide o que é pedido válido é esta função, e não
// o corpo da action: pergunta solta numa action é invisível para os portões (a
// lição medida em `enviarLote`, app/contatos/actions.ts).

/** Gerações em 24 horas, somando o painel inteiro. Decidido pelo Eduardo em 29/09. */
export const TETO_DIARIO = 5;

export const TEMA_MAX = 80;
export const O_QUE_RESOLVE_MIN = 20;
export const O_QUE_RESOLVE_MAX = 1000;
export const PALAVRA_MIN = 3;
export const PALAVRA_MAX = 30;

export type Pedido = { tema: string; oQueResolve: string; palavraDigitada: string | null };

export type RecusaDoPedido =
  | "tema_vazio"
  | "tema_longo"
  | "o_que_resolve_curto"
  | "o_que_resolve_longo"
  | "palavra_invalida";

/**
 * A palavra na forma que o Labs grava: sem acento e em maiúscula (contrato,
 * "`keyword` é normalizada antes de gravar"). O Chat normaliza ANTES para mostrar
 * ao operador a palavra que vai existir, e não uma parecida.
 *
 * `\p{M}` com a bandeira `u` tira as marcas de acento que a decomposição separou.
 * Não há caractere de acento escrito neste arquivo, de propósito.
 */
export function normalizarPalavra(bruta: string): string {
  return bruta.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().trim();
}

/**
 * Uma palavra só: letras e números, de PALAVRA_MIN a PALAVRA_MAX. Mais estreita que
 * o contrato (≤ 80) de propósito: estreitar é seguro, e simplifica casar a palavra
 * com a automação na Etapa 5.
 */
export function palavraValida(palavra: string): boolean {
  return new RegExp(`^[A-Z0-9]{${PALAVRA_MIN},${PALAVRA_MAX}}$`).test(palavra);
}

/**
 * O navegador manda o textarea com a quebra \r\n (medido na prova real de 29/09). Ela
 * volta a ser \n antes de contar: sem isso, cada linha conta um caractere a mais que
 * na tela, e um texto no limite seria recusado.
 */
function texto(v: unknown): string {
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
}

export function lerPedido(bruto: { tema: unknown; oQueResolve: unknown; palavra: unknown }):
  | { ok: true; pedido: Pedido }
  | { ok: false; motivo: RecusaDoPedido } {
  const tema = texto(bruto.tema);
  const oQueResolve = texto(bruto.oQueResolve);
  const palavra = normalizarPalavra(texto(bruto.palavra));

  if (!tema) return { ok: false, motivo: "tema_vazio" };
  if (tema.length > TEMA_MAX) return { ok: false, motivo: "tema_longo" };
  if (oQueResolve.length < O_QUE_RESOLVE_MIN) return { ok: false, motivo: "o_que_resolve_curto" };
  if (oQueResolve.length > O_QUE_RESOLVE_MAX) return { ok: false, motivo: "o_que_resolve_longo" };
  if (palavra && !palavraValida(palavra)) return { ok: false, motivo: "palavra_invalida" };

  return { ok: true, pedido: { tema, oQueResolve, palavraDigitada: palavra || null } };
}

/**
 * A palavra que vai ao Labs. A DIGITADA VENCE A GERADA: se o post pede "Comente
 * IAKIDS" e a IA sugere "EDUCAIA", quem comenta IAKIDS não recebe nada, e nada
 * avisa (site-ia, docs/superpowers/specs/2026-09-22-prompt-do-post-design.md).
 */
export function palavraFinal(digitada: string | null, sugerida: string): string {
  return digitada ?? normalizarPalavra(sugerida);
}

export function restamHoje(usadas: number): number {
  return Math.max(0, TETO_DIARIO - usadas);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O id vem de formulário ou de URL, e é digitável. Conferir antes evita o 22P02 do Postgres. */
export function ehIdDeBonus(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
