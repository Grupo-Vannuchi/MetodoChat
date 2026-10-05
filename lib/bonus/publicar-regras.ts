// AS REGRAS PURAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro"). PURO: a tela, as
// actions e o repositório leem daqui, e nenhuma regra mora no JSX nem no SQL.
import type { FormaDePublicacao } from "@/lib/publicacao";
import type { SlideParaArte } from "./arte-slides";
import { versaoDaArte } from "./arte-tela";

/**
 * OS DOIS DESTINOS DE UMA IMAGEM NO BUCKET, sempre na pasta da conta do carrossel (`pastaDaConta`,
 * lib/bucket.ts), nunca na do cookie:
 * - `slide`: a imagem do Canva guardada no slide, em `<pasta>/bonus/<uuid>.jpg`;
 * - `fila`: o que vai para a fila do /publicar (as cópias das guardadas e a arte "Só texto"
 *   convertida), em `<pasta>/bonus-fila/<uuid>.jpg`. O dreno apaga estas depois de publicar.
 * O /publicar só aceita `pasta/arquivo.ext`, com uma barra (`FORMA_DO_CAMINHO`,
 * lib/publicacao.ts), e nenhum dos dois entra por ele. O dreno não confere a forma, e os dois saem
 * por ele. A guardada nunca vai para a fila: o que vai é sempre uma cópia.
 */
export type DestinoDaImagem = "slide" | "fila";

const PREFIXO: Record<DestinoDaImagem, string> = { slide: "bonus", fila: "bonus-fila" };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** A pasta já sai higienizada de `pastaDaConta`; conferir de novo impede um padrão montado errado. */
const PASTA = /^[A-Za-z0-9_-]+$/;

export function caminhoDaImagem(pasta: string, destino: DestinoDaImagem, uuid: string): string {
  return `${pasta}/${PREFIXO[destino]}/${uuid}.jpg`;
}

/** O caminho que voltou do navegador, conferido na forma exata do destino e da pasta. */
export function ehCaminhoDoDestino(caminho: unknown, pasta: string, destino: DestinoDaImagem): caminho is string {
  if (typeof caminho !== "string" || !PASTA.test(pasta)) return false;
  return new RegExp(`^${pasta}/${PREFIXO[destino]}/${UUID}\\.jpg$`).test(caminho);
}

/**
 * A IMAGEM DO SLIDE TEM DE SER 4:5, COMO A ARTE (1080×1350), com 1% de tolerância (achado 76,
 * decisão do Eduardo em 05/10). O Instagram corta todos os itens do carrossel pela proporção do
 * PRIMEIRO (lib/dedupe.ts:211-212), e uma imagem quadrada no slide 1 cortaria o texto das artes "Só
 * texto". O /publicar aceita de 0,8 a 1,91; esta regra é só da página do carrossel.
 */
export const PROPORCAO_MIN = 0.792;
export const PROPORCAO_MAX = 0.808;

export type ProblemaDaProporcao = "sem_medida" | "proporcao";

export function problemaDaProporcaoDoSlide(largura: number | undefined, altura: number | undefined): ProblemaDaProporcao | null {
  if (!largura || !altura || !(largura > 0) || !(altura > 0)) return "sem_medida";
  const p = largura / altura;
  return p >= PROPORCAO_MIN && p <= PROPORCAO_MAX ? null : "proporcao";
}

/**
 * A VERSÃO DO TEXTO DO SLIDE: o resumo só do slide (número, total, tipo, manchete e texto). Não é a
 * versão da miniatura (`versoesDosSlides`), que leva a URL da foto da conta: a Meta a troca sozinha,
 * e o aviso "o texto mudou depois desta imagem" apareceria sem o texto ter mudado.
 */
export function versaoDoTextoDoSlide(s: SlideParaArte): string {
  return versaoDaArte([JSON.stringify(s)]);
}

/** O post de 1 slide sai como imagem única; de 2 a 10, como carrossel. */
export function formaDoCarrossel(total: number): FormaDePublicacao {
  return total === 1 ? "imagem" : "carrossel";
}

export type ImagemGuardada = { caminho: string; versao: string };

const objeto = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const textoCheio = (v: unknown): v is string => typeof v === "string" && v !== "";

/**
 * As imagens guardadas nos slides (`arte.imagens`). O que não tiver a forma certa fica de fora, e
 * não quebra a página, como em `escolhasDaArte`: o slide volta a pedir a imagem.
 */
export function imagensDaArte(v: unknown, total: number): Record<number, ImagemGuardada> {
  const imagens = objeto(objeto(v)?.imagens);
  const lidas: Record<number, ImagemGuardada> = {};
  for (const [chave, valor] of Object.entries(imagens ?? {})) {
    const n = /^[1-9]\d*$/.test(chave) ? Number(chave) : 0;
    const img = objeto(valor);
    if (n < 1 || n > total || !img || !textoCheio(img.caminho) || !textoCheio(img.versao)) continue;
    lidas[n] = { caminho: img.caminho, versao: img.versao };
  }
  return lidas;
}

export type PublicacaoGuardada = {
  /** A `dedupe_key` EXATA que foi para a fila, e não os caminhos para recalcular. */
  chave: string;
  caminhos: string[];
  /** Gravada com o `now()` do banco. */
  reservadaEm: Date;
  /** Só existe depois de a fila aceitar o item (achado 75). */
  enfileiradaEm: Date | null;
};

const data = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * A publicação do carrossel (`arte.publicacao`). `null` quando não há. A FORMA ESTRANHA É
 * "estranha", e não `null`: a trava se escreve pelo que libera (spec, "A trava no servidor"), e o que
 * não se reconhece não libera.
 */
export function publicacaoDaArte(v: unknown): PublicacaoGuardada | null | "estranha" {
  const o = objeto(v);
  if (!o || !("publicacao" in o)) return null;
  const p = objeto(o.publicacao);
  if (!p || !textoCheio(p.chave)) return "estranha";
  const caminhos = Array.isArray(p.caminhos) ? p.caminhos : [];
  if (!caminhos.length || !caminhos.every(textoCheio)) return "estranha";
  const reservadaEm = data(p.reservada_em);
  if (!reservadaEm) return "estranha";
  const enfileiradaEm = "enfileirada_em" in p ? data(p.enfileirada_em) : null;
  if ("enfileirada_em" in p && !enfileiradaEm) return "estranha";
  return { chave: p.chave, caminhos: caminhos as string[], reservadaEm, enfileiradaEm };
}
