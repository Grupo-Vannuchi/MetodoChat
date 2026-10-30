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
//
// A CAPA (spec da Etapa 11) é o quarto jeito do slide 1: a imagem no slide inteiro e o gancho grande por
// cima. Ela mora numa chave própria, `capa: true`, porque só o slide 1 a tem. O carrossel sem a chave
// continua como hoje. Ela não convive com o "Só texto" no slide 1, e o post de 1 slide nunca a tem
// (achado 98): o slide dele não tem gancho.

export type EscolhasDaArte = { conta: string | null; nome: string | null; arroba: string | null; soTexto: number[]; capa: boolean };

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
  // A CAPA SÓ VALE COM O BOOLEANO `true`, no carrossel de 2 slides ou mais, e sem o "Só texto" no slide 1.
  // A tela nunca grava os dois juntos (`lerCapaDoFormulario`); se uma escrita errada gravar, vale o "Só
  // texto", que é o jeito de antes da capa.
  const capa = o.capa === true && total >= 2 && !soTexto.includes(1);
  return { conta: textoOuNulo(o.conta), nome: textoOuNulo(o.nome), arroba: textoOuNulo(o.arroba), soTexto, capa };
}

/** O slide 1 em "Capa com imagem" (Etapa 11). */
export function ehCapa(e: EscolhasDaArte, numero: number): boolean {
  return e.capa && numero === 1;
}

/** "Com espaço" é o padrão; "só texto" é o que o operador marcou. A capa não tem o espaço: a imagem é o slide inteiro. */
export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
  return !e.soTexto.includes(numero) && !ehCapa(e, numero);
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

export type RecusaDaCapa = "capa" | "capa_no_post" | "capa_e_so_texto";

/**
 * A CAPA QUE O FORMULÁRIO DA ARTE MANDOU (Etapa 11): "1" liga, a ausência desliga, e o resto é recusado. O
 * post de 1 slide não tem capa (achado 98), e a capa não vai junto do "Só texto" no slide 1: a tela desliga
 * um ao ligar o outro, e o servidor não escolhe por ela.
 */
export function lerCapaDoFormulario(
  bruto: unknown,
  soTexto: number[],
  total: number
): { ok: true; capa: boolean } | { ok: false; motivo: RecusaDaCapa } {
  if (bruto === null || bruto === undefined) return { ok: true, capa: false };
  if (bruto !== "1") return { ok: false, motivo: "capa" };
  if (total < 2) return { ok: false, motivo: "capa_no_post" };
  if (soTexto.includes(1)) return { ok: false, motivo: "capa_e_so_texto" };
  return { ok: true, capa: true };
}
