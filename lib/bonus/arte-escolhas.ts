// AS ESCOLHAS DA ARTE de um carrossel: a coluna `arte` (migrations/015-arte-do-carrossel.sql).
//
// PURO. `conta` é o ig_user_id da conta do cabeçalho (null: a selecionada no Chat). `soTexto` são
// os slides sem o espaço da imagem; os outros saem "com espaço", que é o padrão, como no Labs.
//
// ⚠️ GRAVAR O "SÓ TEXTO" É DIFERENTE DO LABS, de propósito (spec da Etapa 3): lá a escolha não é
// gravada, porque a presença da ilustração já a responde (ROADMAP do Labs, 22.6). No Chat não há
// ilustração guardada, e o PNG baixado amanhã tem de sair igual à prévia de hoje.

export type EscolhasDaArte = { conta: string | null; soTexto: number[] };

/**
 * As escolhas lidas do banco. O que não tiver a forma certa volta ao padrão, e não quebra a
 * página: uma linha anterior à 015 tem `{}`.
 */
export function escolhasDaArte(v: unknown, total: number): EscolhasDaArte {
  const o = v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const conta = typeof o.conta === "string" && o.conta ? o.conta : null;
  const lista = Array.isArray(o.soTexto) ? o.soTexto : [];
  const soTexto = [...new Set(lista.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= total))].sort(
    (a, b) => a - b
  );
  return { conta, soTexto };
}

/** "Com espaço" é o padrão; "só texto" é o que o operador marcou. */
export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
  return !e.soTexto.includes(numero);
}

export type RecusaDaArte = "conta" | "slide";

/**
 * O que o formulário da arte mandou. O navegador manda o que quiser: a conta tem de ser uma das
 * conectadas (spec da Etapa 3, "Segurança"), e cada slide "só texto" tem de existir no carrossel.
 * O número vem como texto, só dígitos e sem zero à esquerda.
 */
export function lerEscolhasDoFormulario(
  bruto: { conta: unknown; soTexto: unknown[] },
  total: number,
  conectadas: string[]
): { ok: true; escolhas: EscolhasDaArte } | { ok: false; motivo: RecusaDaArte } {
  const conta = typeof bruto.conta === "string" ? bruto.conta : "";
  if (!conectadas.includes(conta)) return { ok: false, motivo: "conta" };
  const soTexto: number[] = [];
  for (const v of bruto.soTexto) {
    const n = typeof v === "string" && /^[1-9]\d*$/.test(v) ? Number(v) : 0;
    if (n < 1 || n > total) return { ok: false, motivo: "slide" };
    if (!soTexto.includes(n)) soTexto.push(n);
  }
  return { ok: true, escolhas: { conta, soTexto: soTexto.sort((a, b) => a - b) } };
}
