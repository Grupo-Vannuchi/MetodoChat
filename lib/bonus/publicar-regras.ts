// AS REGRAS PURAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro"). PURO: a tela, as
// actions e o repositório leem daqui, e nenhuma regra mora no JSX nem no SQL.
import type { FormaDePublicacao } from "@/lib/publicacao";
import { ALTURA_ILUSTRACAO, LARGURA_UTIL } from "./arte-geometria";
import type { SlideParaArte } from "./arte-slides";
import { versaoDaArte } from "./arte-tela";

/**
 * OS TRÊS DESTINOS DE UMA IMAGEM NO BUCKET, sempre na pasta da conta do carrossel (`pastaDaConta`,
 * lib/bucket.ts), nunca na do cookie:
 * - `slide`: o slide pronto do Canva guardado no slide, em `<pasta>/bonus/<uuid>.jpg`;
 * - `foto`: a foto guardada no slide, para o espaço da arte, em `<pasta>/bonus-foto/<uuid>.jpg`
 *   (adendo de 05/10);
 * - `fila`: o que vai para a fila do /publicar (as cópias dos slides prontos e as artes desenhadas,
 *   convertidas), em `<pasta>/bonus-fila/<uuid>.jpg`. O dreno apaga estas depois de publicar.
 * O /publicar só aceita `pasta/arquivo.ext`, com uma barra (`FORMA_DO_CAMINHO`,
 * lib/publicacao.ts), e nenhum dos três entra por ele. O dreno não confere a forma, e os três saem
 * por ele. A guardada nunca vai para a fila: o que vai é sempre uma cópia ou uma arte.
 */
export type DestinoDaImagem = "slide" | "foto" | "fila";

/**
 * O JEITO DE UMA IMAGEM GUARDADA NO SLIDE: o slide pronto, que é o slide inteiro, ou a foto, que entra
 * no espaço da arte. É o destino em que ela foi assinada, e o prefixo do caminho o diz.
 */
export type JeitoDaImagem = Exclude<DestinoDaImagem, "fila">;

const PREFIXO: Record<DestinoDaImagem, string> = { slide: "bonus", foto: "bonus-foto", fila: "bonus-fila" };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** A pasta já sai higienizada de `pastaDaConta`; conferir de novo impede um padrão montado errado. */
const PASTA = /^[A-Za-z0-9_-]+$/;
const GUARDADA = new RegExp(`^[A-Za-z0-9_-]+/(${PREFIXO.slide}|${PREFIXO.foto})/${UUID}\\.jpg$`);

export function caminhoDaImagem(pasta: string, destino: DestinoDaImagem, uuid: string): string {
  return `${pasta}/${PREFIXO[destino]}/${uuid}.jpg`;
}

/** O caminho que voltou do navegador, conferido na forma exata do destino e da pasta. */
export function ehCaminhoDoDestino(caminho: unknown, pasta: string, destino: DestinoDaImagem): caminho is string {
  if (typeof caminho !== "string" || !PASTA.test(pasta)) return false;
  return new RegExp(`^${pasta}/${PREFIXO[destino]}/${UUID}\\.jpg$`).test(caminho);
}

/**
 * O JEITO É O PREFIXO DO CAMINHO (revisão do adendo pela auditoria): `bonus-foto/` é a foto,
 * `bonus/` é o slide pronto, inclusive o guardado antes do adendo. Não há campo de jeito na coluna: o
 * caminho, que o servidor assinou, é a fonte única. Outro caminho não tem jeito, e não conta.
 */
export function jeitoDoCaminho(caminho: string): JeitoDaImagem | null {
  const m = GUARDADA.exec(caminho);
  if (!m) return null;
  return m[1] === PREFIXO.foto ? "foto" : "slide";
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
 * A FOTO DO ESPAÇO DA ARTE (adendo de 05/10): o espaço é 860×573 (`LARGURA_UTIL` por
 * `ALTURA_ILUSTRACAO`), deitado. A foto chega já cortada nessa proporção, com 1% de tolerância, entre
 * o espaço e o dobro dele: menor sairia borrada no post, e o navegador nunca amplia. O 4:5 não vale
 * para ela, que não é o slide inteiro.
 */
export const LARGURA_DA_FOTO = LARGURA_UTIL;
export const ALTURA_DA_FOTO = ALTURA_ILUSTRACAO;
export const FOTO_MAX_LARGURA = LARGURA_DA_FOTO * 2;
export const FOTO_MAX_ALTURA = ALTURA_DA_FOTO * 2;
const PROPORCAO_DA_FOTO = LARGURA_DA_FOTO / ALTURA_DA_FOTO;
export const PROPORCAO_DA_FOTO_MIN = PROPORCAO_DA_FOTO * 0.99;
export const PROPORCAO_DA_FOTO_MAX = PROPORCAO_DA_FOTO * 1.01;

/**
 * O TETO DA FOTO EM BYTES, o mesmo da rota que a desenha (lib/bonus/arte-foto.ts), e daqui só (achado
 * 79): uma foto maior seria assinada, subiria e seria guardada, e a rota nunca a leria. O slide
 * travaria o publicar para sempre, com uma frase que manda esperar.
 */
export const FOTO_DO_ESPACO_MAX_BYTES = 2 * 1024 * 1024;

export type ProblemaDaFoto = "sem_medida" | "proporcao" | "pequena" | "grande" | "pesada";

/** A foto declarada para o espaço: as medidas e o tamanho em bytes, como o navegador os declara. */
export function problemaDaFotoDoEspaco(
  largura: number | undefined,
  altura: number | undefined,
  bytes: number | undefined
): ProblemaDaFoto | null {
  if (!largura || !altura || !(largura > 0) || !(altura > 0) || !(typeof bytes === "number" && bytes >= 0)) return "sem_medida";
  const p = largura / altura;
  if (p < PROPORCAO_DA_FOTO_MIN || p > PROPORCAO_DA_FOTO_MAX) return "proporcao";
  if (largura < LARGURA_DA_FOTO || altura < ALTURA_DA_FOTO) return "pequena";
  if (largura > FOTO_MAX_LARGURA || altura > FOTO_MAX_ALTURA) return "grande";
  return bytes > FOTO_DO_ESPACO_MAX_BYTES ? "pesada" : null;
}

export type RecorteDaFoto = { x: number; y: number; largura: number; altura: number; saida: { largura: number; altura: number } };

/**
 * O RECORTE DA FOTO, NO NAVEGADOR: ao centro, na proporção do espaço, e reduzido até o dobro dele,
 * nunca ampliado. A foto cujo recorte fica menor que o espaço é pequena. A saída grande é fixada no
 * dobro exato, para o arredondamento não a fazer passar de 1720×1146.
 */
export function recorteDaFoto(
  largura: number,
  altura: number
): { ok: true; recorte: RecorteDaFoto } | { ok: false; problema: "sem_medida" | "pequena" } {
  if (!(largura > 0) || !(altura > 0)) return { ok: false, problema: "sem_medida" };
  const [l, a] =
    largura / altura > PROPORCAO_DA_FOTO
      ? [Math.round(altura * PROPORCAO_DA_FOTO), altura]
      : [largura, Math.round(largura / PROPORCAO_DA_FOTO)];
  if (l < LARGURA_DA_FOTO || a < ALTURA_DA_FOTO) return { ok: false, problema: "pequena" };
  const reduz = l > FOTO_MAX_LARGURA || a > FOTO_MAX_ALTURA;
  const saida = reduz ? { largura: FOTO_MAX_LARGURA, altura: FOTO_MAX_ALTURA } : { largura: l, altura: a };
  return { ok: true, recorte: { x: Math.floor((largura - l) / 2), y: Math.floor((altura - a) / 2), largura: l, altura: a, saida } };
}

/**
 * A VERSÃO DO TEXTO DO SLIDE: o resumo só do slide (número, total, tipo, manchete e texto). Não é a
 * versão da miniatura (`versoesDosSlides`), que leva a URL da foto da conta: a Meta a troca sozinha,
 * e o aviso "o texto mudou depois desta imagem" apareceria sem o texto ter mudado.
 */
export function versaoDoTextoDoSlide(s: SlideParaArte): string {
  return versaoDaArte([JSON.stringify(s)]);
}

/**
 * A VERSÃO DO DESENHO de um slide que sai com a arte do Chat: a rota a manda com a arte, e o publicar
 * a confere contra o que está salvo. O "Só texto" é a versão do texto; o slide com foto leva também o
 * caminho da foto, e trocar a foto muda a versão.
 */
export function versaoDoDesenho(s: SlideParaArte, caminhoDaFoto: string | null): string {
  return caminhoDaFoto === null ? versaoDoTextoDoSlide(s) : versaoDaArte([JSON.stringify(s), caminhoDaFoto]);
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
 * não quebra a página, como em `escolhasDaArte`: o slide volta a pedir a imagem. O caminho sem jeito
 * também fica de fora (`jeitoDoCaminho`), que é o lado seguro: nunca se publica uma imagem do jeito
 * errado.
 */
export function imagensDaArte(v: unknown, total: number): Record<number, ImagemGuardada> {
  const imagens = objeto(objeto(v)?.imagens);
  const lidas: Record<number, ImagemGuardada> = {};
  for (const [chave, valor] of Object.entries(imagens ?? {})) {
    const n = /^[1-9]\d*$/.test(chave) ? Number(chave) : 0;
    const img = objeto(valor);
    if (n < 1 || n > total || !img || !textoCheio(img.caminho) || !textoCheio(img.versao)) continue;
    if (!jeitoDoCaminho(img.caminho)) continue;
    lidas[n] = { caminho: img.caminho, versao: img.versao };
  }
  return lidas;
}

/** O caminho da foto de cada slide que tem uma (o jeito "foto"), pelo número do slide. */
export function fotosDaArte(v: unknown, total: number): Record<number, string> {
  const fotos: Record<number, string> = {};
  for (const [n, img] of Object.entries(imagensDaArte(v, total))) {
    if (jeitoDoCaminho(img.caminho) === "foto") fotos[Number(n)] = img.caminho;
  }
  return fotos;
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
