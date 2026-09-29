// O BÔNUS REVISADO CONTRA O CONTRATO DA PORTA DO LABS.
//
// Contrato: site-ia/docs/contrato-metodo-chat.md. As regras de tamanho abaixo são
// as dele, para o Labs nunca recusar por culpa nossa. A palavra é a exceção, e
// mais estreita de propósito (ver `palavraValida`, lib/bonus/pedido.ts).
import { normalizarPalavra, palavraValida, PALAVRA_MAX, PALAVRA_MIN, TEMA_MAX } from "./pedido";

export type Revisado = {
  titulo: string;
  slug: string;
  palavra: string;
  descricao: string;
  intro: string;
  prompt: string;
  tema: string;
};

export const CAMPOS_REVISADOS = [
  "titulo",
  "slug",
  "palavra",
  "descricao",
  "intro",
  "prompt",
  "tema",
] as const;

export type CampoRevisado = (typeof CAMPOS_REVISADOS)[number];
export type ProblemaDoCampo = { campo: CampoRevisado; erro: string };

export const LIMITES = {
  titulo: { min: 3, max: 220 },
  slug: { min: 3, max: 90 },
  descricao: { min: 8, max: 1200 },
  prompt: { min: 20, max: 20_000 },
  intro: { min: 0, max: 4_000 },
  tema: { min: 1, max: TEMA_MAX },
} as const;

/** O teto do corpo no Labs (contrato, "Teto do corpo"). */
export const CORPO_MAX_BYTES = 64_000;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function lerRevisado(
  bruto: Record<string, unknown>
): { ok: true; revisado: Revisado } | { ok: false; problemas: ProblemaDoCampo[] } {
  const r: Revisado = {
    titulo: texto(bruto.titulo),
    slug: texto(bruto.slug).toLowerCase(),
    palavra: normalizarPalavra(texto(bruto.palavra)),
    descricao: texto(bruto.descricao),
    intro: texto(bruto.intro),
    prompt: texto(bruto.prompt),
    tema: texto(bruto.tema),
  };

  const problemas: ProblemaDoCampo[] = [];
  for (const campo of ["titulo", "slug", "descricao", "prompt", "intro", "tema"] as const) {
    const { min, max } = LIMITES[campo];
    const n = r[campo].length;
    if (n < min) {
      problemas.push({
        campo,
        erro: min === 1 ? "não pode ficar vazio" : `precisa de pelo menos ${min} caracteres`,
      });
    } else if (n > max) {
      problemas.push({ campo, erro: `passa de ${max} caracteres` });
    }
  }
  if (r.slug && !problemas.some((p) => p.campo === "slug") && !SLUG.test(r.slug)) {
    problemas.push({ campo: "slug", erro: "só letras minúsculas, números e hífen entre palavras" });
  }
  if (!palavraValida(r.palavra)) {
    problemas.push({
      campo: "palavra",
      erro: `uma palavra só, de ${PALAVRA_MIN} a ${PALAVRA_MAX} letras ou números`,
    });
  }
  if (!problemas.length && Buffer.byteLength(montarCorpo(r), "utf8") > CORPO_MAX_BYTES) {
    problemas.push({
      campo: "prompt",
      erro: `o bônus inteiro passa de 64 000 bytes, que é o teto do Labs; encurte o prompt`,
    });
  }

  return problemas.length ? { ok: false, problemas } : { ok: true, revisado: r };
}

/**
 * O CORPO, SERIALIZADO UMA VEZ SÓ. Quem assina e quem envia recebem ESTA string
 * (contrato: "assine o corpo que você VAI ENVIAR, não o objeto"). A ordem das
 * chaves é fixada pela ordem do literal abaixo, e o teste a confere byte a byte.
 */
export function montarCorpo(r: Revisado): string {
  return JSON.stringify({
    slug: r.slug,
    title: r.titulo,
    description: r.descricao,
    prompt: r.prompt,
    theme: r.tema,
    keyword: r.palavra,
    intro: r.intro === "" ? null : r.intro,
    skillId: null,
  });
}
