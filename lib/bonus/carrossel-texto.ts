// O TEXTO DE UM CARROSSEL: a forma que o Chat guarda, as conferências e a revisão.
//
// PURO. A forma é uma só para o que a IA gerou e para o que o operador revisou, e é ela que vai
// para `carrosseis_gerados.gerado` e `.revisado` (objeto cru, nunca `JSON.stringify`).
//
// A CHAMADA PEDE A PALAVRA DO BÔNUS E NENHUMA OUTRA, na hora de gerar e na de salvar. É a falha
// que o Labs registrou em `src/lib/ia/funil.ts`: um carrossel pedindo "Comente EXCEL", palavra
// que não existia, deixaria quem comentou sem resposta, e nada no sistema acusaria.
import { z } from "zod";
import { slidesDeConteudo } from "./carrossel-pedido";
import type { CarrosselDoChat, PostDoChat } from "./carrossel-schema";

export type Slide = { titulo: string; texto: string };

export type TextoDeCarrossel = {
  tipo: "carrossel";
  titulo: string;
  gancho: string;
  slides: Slide[];
  chamada: string;
  legenda: string;
};

export type TextoDePost = { tipo: "post"; titulo: string; texto: string; chamada: string; legenda: string };

export type TextoDoCarrossel = TextoDeCarrossel | TextoDePost;

export function deCarrossel(d: CarrosselDoChat): TextoDeCarrossel {
  return {
    tipo: "carrossel",
    titulo: d.titulo,
    gancho: d.gancho,
    slides: d.slides.map((s) => ({ titulo: s.titulo, texto: s.texto })),
    chamada: d.chamadaParaAcao,
    legenda: d.legenda,
  };
}

export function dePost(d: PostDoChat): TextoDePost {
  return { tipo: "post", titulo: d.titulo, texto: d.texto, chamada: d.chamadaParaAcao, legenda: d.legenda };
}

const TextoGravadoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("carrossel"),
    titulo: z.string(),
    gancho: z.string(),
    slides: z.array(z.object({ titulo: z.string(), texto: z.string() })),
    chamada: z.string(),
    legenda: z.string(),
  }),
  z.object({
    tipo: z.literal("post"),
    titulo: z.string(),
    texto: z.string(),
    chamada: z.string(),
    legenda: z.string(),
  }),
]);

/** O `gerado` ou o `revisado` lidos do banco. Forma errada → null, e a tela diz isso. */
export function textoGravado(v: unknown): TextoDoCarrossel | null {
  const r = TextoGravadoSchema.safeParse(v);
  return r.success ? r.data : null;
}

/**
 * A palavra INTEIRA, em maiúsculas: sem letra nem número colado antes ou depois. Com a bandeira
 * `u`, `\p{L}` inclui as letras acentuadas; um `\b` acharia PROMO dentro de PROMOÇÃO (achado 46
 * do auditor).
 */
export function temPalavra(texto: string, palavra: string): boolean {
  if (!/^[A-Z0-9]+$/.test(palavra)) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${palavra}(?![\\p{L}\\p{N}])`, "u").test(texto);
}

/**
 * Palavras que costumam aparecer gritadas numa chamada sem serem palavra-chave. A LISTA É A DO
 * LABS (site-ia, src/lib/ia/funil.ts, `RARAMENTE_E_PALAVRA_CHAVE`), com VENCE do bordão
 * "Quem vende, VENCE." que as duas instruções ensinam.
 */
export const GRITADAS_PERMITIDAS: ReadonlySet<string> = new Set([
  "PDF",
  "LINK",
  "BIO",
  "GRATIS",
  "GRÁTIS",
  "AQUI",
  "AGORA",
  "VENCE",
]);

/**
 * As OUTRAS palavras gritadas: todas em maiúsculas, de 3 caracteres ou mais, com pelo menos uma
 * letra (número não é palavra-chave), fora a palavra do bônus e as permitidas. Decisão do
 * Eduardo em 30/09: "Comente SUMIDO ou GUIA" é recusada.
 */
export function outrasGritadas(texto: string, palavra: string): string[] {
  const achadas = texto.match(/(?<![\p{L}\p{N}])[\p{Lu}\p{N}]{3,}(?![\p{L}\p{N}])/gu) ?? [];
  return [...new Set(achadas)].filter((w) => /\p{Lu}/u.test(w) && w !== palavra && !GRITADAS_PERMITIDAS.has(w));
}

export type FalhaDaConferencia =
  | { motivo: "tipo_errado" }
  | { motivo: "slides"; vieram: number; esperados: number }
  | { motivo: "palavra"; onde: "chamada" | "legenda" }
  | { motivo: "outra_palavra"; palavras: string[] };

/**
 * O que a IA devolveu serve? `null` é que serve.
 *
 * "Nenhuma outra palavra" vale SÓ NA CHAMADA; na legenda, só se confere que a palavra está lá.
 * Decisão do Eduardo em 30/09 (achado 49 do auditor): o Labs também só confere a chamada, e uma
 * legenda de até 900 caracteres tem ênfases em maiúsculas que recusariam gerações boas. O
 * operador revisa a legenda antes de usar.
 */
export function conferirGerado(total: number, palavra: string, t: TextoDoCarrossel): FalhaDaConferencia | null {
  if ((total === 1) !== (t.tipo === "post")) return { motivo: "tipo_errado" };
  if (t.tipo === "carrossel" && t.slides.length !== slidesDeConteudo(total)) {
    return { motivo: "slides", vieram: t.slides.length, esperados: slidesDeConteudo(total) };
  }
  if (!temPalavra(t.chamada, palavra)) return { motivo: "palavra", onde: "chamada" };
  if (!temPalavra(t.legenda, palavra)) return { motivo: "palavra", onde: "legenda" };
  const outras = outrasGritadas(t.chamada, palavra);
  if (outras.length) return { motivo: "outra_palavra", palavras: outras };
  return null;
}

/**
 * `pedePalavra`: o campo tem de pedir a palavra do bônus, e a tela avisa na hora quando ela some
 * (achado 53). São a chamada e a legenda, as mesmas que `lerRevisaoDoCarrossel` confere.
 */
export type CampoDoCarrossel = {
  nome: string;
  rotulo: string;
  min: number;
  max: number;
  linhas: number;
  pedePalavra?: boolean;
};

/**
 * Os campos da tela, na ordem do post, com os tetos do formato (carrossel-schema.ts). É a fonte
 * única dos nomes do formulário: a tela desenha a partir daqui, e a revisão lê a partir daqui.
 */
export function camposDoFormulario(total: number): CampoDoCarrossel[] {
  if (total === 1) {
    return [
      { nome: "texto", rotulo: "Texto da imagem", min: 60, max: 300, linhas: 5 },
      { nome: "chamada", rotulo: "Chamada", min: 20, max: 200, linhas: 3, pedePalavra: true },
      { nome: "legenda", rotulo: "Legenda do post", min: 80, max: 900, linhas: 8, pedePalavra: true },
    ];
  }
  const slides = Array.from({ length: slidesDeConteudo(total) }, (_, i) => [
    { nome: `slide_${i + 1}_titulo`, rotulo: `Slide ${i + 2}: título`, min: 8, max: 70, linhas: 1 },
    { nome: `slide_${i + 1}_texto`, rotulo: `Slide ${i + 2}: texto`, min: 30, max: 300, linhas: 4 },
  ]).flat();
  return [
    { nome: "gancho", rotulo: "Gancho (slide 1)", min: 15, max: 120, linhas: 2 },
    ...slides,
    { nome: "chamada", rotulo: `Chamada (slide ${total})`, min: 20, max: 200, linhas: 3, pedePalavra: true },
    { nome: "legenda", rotulo: "Legenda do post", min: 80, max: 900, linhas: 8, pedePalavra: true },
  ];
}

export function valoresPorCampo(t: TextoDoCarrossel): Record<string, string> {
  if (t.tipo === "post") return { texto: t.texto, chamada: t.chamada, legenda: t.legenda };
  const valores: Record<string, string> = { gancho: t.gancho };
  t.slides.forEach((s, i) => {
    valores[`slide_${i + 1}_titulo`] = s.titulo;
    valores[`slide_${i + 1}_texto`] = s.texto;
  });
  valores.chamada = t.chamada;
  valores.legenda = t.legenda;
  return valores;
}

/** O \r\n do textarea volta a ser \n antes de contar (a lição da FASE 1.11-bis). */
function texto(v: unknown): string {
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
}

/**
 * A revisão do operador. O número de slides não muda (vem do pedido), o título interno não se
 * edita, e a palavra vem da linha, nunca do formulário.
 */
export function lerRevisaoDoCarrossel(
  total: number,
  palavra: string,
  titulo: string,
  bruto: Record<string, unknown>
): { ok: true; texto: TextoDoCarrossel } | { ok: false; problemas: { campo: string; erro: string }[] } {
  const v: Record<string, string> = {};
  const problemas: { campo: string; erro: string }[] = [];
  for (const c of camposDoFormulario(total)) {
    const t = texto(bruto[c.nome]);
    v[c.nome] = t;
    if (t.length < c.min) problemas.push({ campo: c.nome, erro: `precisa de pelo menos ${c.min} caracteres` });
    else if (t.length > c.max) problemas.push({ campo: c.nome, erro: `passa de ${c.max} caracteres` });
  }
  // As mesmas regras de `conferirGerado`, e na mesma ordem: sem a palavra, é isso que se diz da
  // chamada; com ela, as outras gritadas. Na legenda, só a presença (achado 49).
  if (v.chamada && !temPalavra(v.chamada, palavra)) {
    problemas.push({ campo: "chamada", erro: `precisa pedir a palavra ${palavra}` });
  } else if (v.chamada) {
    const outras = outrasGritadas(v.chamada, palavra);
    if (outras.length) {
      problemas.push({ campo: "chamada", erro: `pede também ${outras.join(", ")}; deixe só a palavra ${palavra}` });
    }
  }
  if (v.legenda && !temPalavra(v.legenda, palavra)) {
    problemas.push({ campo: "legenda", erro: `precisa pedir a palavra ${palavra}` });
  }
  if (problemas.length) return { ok: false, problemas };

  if (total === 1) {
    return { ok: true, texto: { tipo: "post", titulo, texto: v.texto, chamada: v.chamada, legenda: v.legenda } };
  }
  const slides = Array.from({ length: slidesDeConteudo(total) }, (_, i) => ({
    titulo: v[`slide_${i + 1}_titulo`],
    texto: v[`slide_${i + 1}_texto`],
  }));
  return {
    ok: true,
    texto: { tipo: "carrossel", titulo, gancho: v.gancho, slides, chamada: v.chamada, legenda: v.legenda },
  };
}
