// AS ESCOLHAS DA ARTE de um carrossel: a coluna `arte` (migrations/015-arte-do-carrossel.sql).
//
// PURO. `conta` é o ig_user_id da conta do carrossel (null: ele é de antes de a conta ser gravada).
// `nome` e `arroba` são os dela, guardados quando o carrossel nasce (spec da Etapa 4), para a arte
// seguir com eles se a conta for desconectada do Chat. `soTexto` são os slides sem o espaço da
// imagem; os outros saem "com espaço", que é o padrão, como no Labs.
//
// ⚠️ GRAVAR O "SÓ TEXTO" É DIFERENTE DO LABS, de propósito (spec da Etapa 3): lá a escolha não é
// gravada, porque a presença da ilustração já a responde (ROADMAP do Labs, 22.6). No Chat não há
// ilustração guardada, e o PNG baixado amanhã tem de sair igual à prévia de hoje.

export type EscolhasDaArte = { conta: string | null; nome: string | null; arroba: string | null; soTexto: number[] };

const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * As escolhas lidas do banco. O que não tiver a forma certa volta ao padrão, e não quebra a
 * página: uma linha anterior à 015 tem `{}`, e uma da Etapa 3 tem a conta sem o nome.
 */
export function escolhasDaArte(v: unknown, total: number): EscolhasDaArte {
  const o = v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const lista = Array.isArray(o.soTexto) ? o.soTexto : [];
  const soTexto = [...new Set(lista.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= total))].sort(
    (a, b) => a - b
  );
  return { conta: textoOuNulo(o.conta), nome: textoOuNulo(o.nome), arroba: textoOuNulo(o.arroba), soTexto };
}

/** "Com espaço" é o padrão; "só texto" é o que o operador marcou. */
export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
  return !e.soTexto.includes(numero);
}

export type RecusaDaArte = "slide" | "ja_tem_conta" | "sem_conta";

/**
 * O "só texto" que o formulário da arte mandou. O navegador manda o que quiser: cada slide tem de
 * existir no carrossel, e o número vem como texto, só dígitos e sem zero à esquerda. A conta não vem
 * do formulário (spec da Etapa 4): o carrossel é da conta em que nasceu.
 */
export function lerSoTextoDoFormulario(
  bruto: unknown[],
  total: number
): { ok: true; soTexto: number[] } | { ok: false; motivo: "slide" } {
  const soTexto: number[] = [];
  for (const v of bruto) {
    const n = typeof v === "string" && /^[1-9]\d*$/.test(v) ? Number(v) : 0;
    if (n < 1 || n > total) return { ok: false, motivo: "slide" };
    if (!soTexto.includes(n)) soTexto.push(n);
  }
  return { ok: true, soTexto: soTexto.sort((a, b) => a - b) };
}
