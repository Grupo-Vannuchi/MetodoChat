// O DESENHO DE VERDADE, MEDIDO NO PIXEL: o ajudante da régua e dos vetores combinados com o Labs
// (tests/bonus-arte-desenho.test.ts e tests/vetores-da-arte.json). Desenha com o Satori do og do
// Next, com a Carlito do disco, e lê o PNG com um decodificador pequeno (zlib e os 5 filtros do PNG):
// o `sharp` só existe como dependência opcional do Next, e pô-lo no package.json mexeria num arquivo
// do dono.
//
// COMO SE MEDE (spec da Etapa 4, "A régua, como teste"):
// - a coluna do texto e o espaço da imagem são pintados de preto (o espaço é branco no branco, e a
//   última linha escura não o veria);
// - a altura desenhada é a da coluna, achada na borda direita da área útil, menos o respiro de 48;
// - a palavra que vaza aparece como tinta à direita da área útil (com folga de 10px: a tinta de uma
//   letra pode passar um pouco do avanço dela sem que a linha tenha passado da largura);
// - cabe quando a última linha escura da peça fica acima de 1240, onde começa a margem de baixo, e
//   nada vaza.
import { inflateSync } from "node:zlib";
import { ImageResponse } from "next/og";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { composicaoDoSlide } from "@/lib/bonus/arte-composicao";
import { desenhoDoSlide } from "@/lib/bonus/arte-desenho";
import { FAMILIA_DA_ARTE, fontesDaArte } from "@/lib/bonus/arte-fonte";
import { ALTURA, ALTURA_ILUSTRACAO, GAP_CABECALHO, LARGURA, LARGURA_UTIL, MARGEM } from "@/lib/bonus/arte-geometria";
import { pedacosDaLinha } from "@/lib/bonus/arte-medida";
import { degrausDoSlide, type SlideParaArte, type TipoDeSlide } from "@/lib/bonus/arte-slides";
import type { CabecalhoDaArte } from "@/lib/bonus/arte-tela";

/** O cabeçalho dos desenhos medidos: sem foto (as iniciais), como uma conta desconectada. */
export const CABECALHO: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: null, iniciais: "TV" };

/** O SVG que o teste entrega no lugar do emoji da rede: a largura do emoji é 1em, seja qual for o desenho. */
export const SVG_DO_EMOJI = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#888888"/></svg>';

type Imagem = { largura: number; altura: number; rgba: Buffer };

/** O PNG em RGBA de 8 bits, sem entrelaçamento, que é o que o Resvg grava. Outro formato recusa. */
export function lerPng(png: Buffer): Imagem {
  const largura = png.readUInt32BE(16);
  const altura = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error("o PNG não é RGBA de 8 bits sem entrelaçamento");
  const partes: Buffer[] = [];
  for (let o = 8; o < png.length; ) {
    const n = png.readUInt32BE(o);
    if (png.toString("latin1", o + 4, o + 8) === "IDAT") partes.push(png.subarray(o + 8, o + 8 + n));
    o += 12 + n;
  }
  const cru = inflateSync(Buffer.concat(partes));
  const passo = largura * 4;
  const rgba = Buffer.alloc(passo * altura);
  // Os 5 filtros, um laço por filtro: a = o byte à esquerda (4 antes), b = o de cima, c = o de cima à esquerda.
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (passo + 1)];
    const e = y * (passo + 1) + 1;
    const s = y * passo;
    const cima = s - passo;
    const a = (i: number) => (i >= 4 ? rgba[s + i - 4] : 0);
    const b = (i: number) => (y > 0 ? rgba[cima + i] : 0);
    const c = (i: number) => (i >= 4 && y > 0 ? rgba[cima + i - 4] : 0);
    if (filtro === 0) cru.copy(rgba, s, e, e + passo);
    else if (filtro === 1) for (let i = 0; i < passo; i++) rgba[s + i] = cru[e + i] + a(i);
    else if (filtro === 2) for (let i = 0; i < passo; i++) rgba[s + i] = cru[e + i] + b(i);
    else if (filtro === 3) for (let i = 0; i < passo; i++) rgba[s + i] = cru[e + i] + ((a(i) + b(i)) >> 1);
    else if (filtro === 4) {
      for (let i = 0; i < passo; i++) {
        const [va, vb, vc] = [a(i), b(i), c(i)];
        const p = va + vb - vc;
        const pa = Math.abs(p - va);
        const pb = Math.abs(p - vb);
        const pc = Math.abs(p - vc);
        rgba[s + i] = cru[e + i] + (pa <= pb && pa <= pc ? va : pb <= pc ? vb : vc);
      }
    } else throw new Error(`filtro de PNG desconhecido: ${filtro}`);
  }
  return { largura, altura, rgba };
}

/** Escuro é a luminância abaixo de 250 (a régua da auditoria). */
function escuro(img: Imagem, x: number, y: number): boolean {
  const o = (y * img.largura + x) * 4;
  return 0.299 * img.rgba[o] + 0.587 * img.rgba[o + 1] + 0.114 * img.rgba[o + 2] < 250;
}

/** A última linha da imagem com algum escuro (-1 se não houver). */
function ultimaLinhaEscura(img: Imagem): number {
  for (let y = img.altura - 1; y >= 0; y--) {
    for (let x = 0; x < img.largura; x++) if (escuro(img, x, y)) return y;
  }
  return -1;
}

async function desenharPng(el: ReactElement, altura: number, largura = LARGURA): Promise<Imagem> {
  const imagem = new ImageResponse(el, { width: largura, height: altura, fonts: await fontesDaArte() });
  return lerPng(Buffer.from(await imagem.arrayBuffer()));
}

type Estilo = { style?: Record<string, unknown>; children?: ReactNode };

/** O desenho do slide com a coluna do texto e o espaço da imagem pintados de preto. */
function pintado(slide: SlideParaArte, fonte: number, comEspaco: boolean): ReactElement {
  const raiz = desenhoDoSlide({ slide, fonte, comEspaco, cabecalho: CABECALHO, familia: FAMILIA_DA_ARTE }) as ReactElement<Estilo>;
  const filhos = ([] as ReactNode[]).concat(raiz.props.children).map((filho) => {
    if (!isValidElement<Estilo>(filho)) return filho;
    const s = filho.props.style ?? {};
    const ehColuna = s.flexDirection === "column" && s.flexShrink === 0;
    const ehEspaco = s.height === ALTURA_ILUSTRACAO;
    return ehColuna || ehEspaco ? cloneElement(filho, { style: { ...s, background: "#000000" } }) : filho;
  });
  return cloneElement(raiz, {}, ...filhos);
}

/** O que o desenho de um slide numa fonte mostra no pixel. */
export type Desenhado = { altura: number; vaza: boolean; cabe: boolean };

const BORDA = MARGEM + LARGURA_UTIL - 5;
const ALEM_DA_DIREITA = MARGEM + LARGURA_UTIL + 10;

/** A coluna pintada na imagem: do topo até a primeira linha clara na borda direita da área útil. */
function coluna(img: Imagem): { topo: number; fim: number | null } {
  let topo = 0;
  while (topo < img.altura && !escuro(img, BORDA, topo)) topo++;
  let fim = topo;
  while (fim < img.altura && escuro(img, BORDA, fim)) fim++;
  return { topo, fim: fim < img.altura ? fim : null };
}

function vazaNaColuna(img: Imagem, topo: number, fim: number): boolean {
  for (let y = topo; y < fim; y++) {
    for (let x = ALEM_DA_DIREITA; x < img.largura; x++) if (escuro(img, x, y)) return true;
  }
  return false;
}

/** Na peça de 1350: cabe quando a última linha com algum escuro fica acima de 1240 e nada vaza. */
function cabeNaImagem(img: Imagem, topo: number, fim: number): boolean {
  return ultimaLinhaEscura(img) < ALTURA - MARGEM && !vazaNaColuna(img, topo, fim);
}

/** Cabe na peça? A coluna que passa da peça não cabe, e não precisa de mais medida. */
export async function cabeNaPeca(slide: SlideParaArte, fonte: number, comEspaco: boolean): Promise<boolean> {
  const img = await desenharPng(pintado(slide, fonte, comEspaco), ALTURA);
  const { topo, fim } = coluna(img);
  return fim !== null && cabeNaImagem(img, topo, fim);
}

/**
 * A altura da coluna do texto, se alguma palavra vaza, e se cabe na peça. A coluna que passa da peça
 * não cabe, e é medida de novo numa tela mais alta até achar o fim: a altura dela não depende da tela
 * (flexShrink 0), e o resto só desce.
 */
export async function desenharSlide(slide: SlideParaArte, fonte: number, comEspaco: boolean): Promise<Desenhado> {
  const el = pintado(slide, fonte, comEspaco);
  for (const tela of [ALTURA, 4000, 16000]) {
    const img = await desenharPng(el, tela);
    const { topo, fim } = coluna(img);
    if (fim === null) continue;
    const vaza = vazaNaColuna(img, topo, fim);
    return { altura: fim - topo - GAP_CABECALHO, vaza, cabe: tela === ALTURA && cabeNaImagem(img, topo, fim) };
  }
  throw new Error("a coluna do texto passa até da tela de 16000px");
}

/**
 * Quantas linhas de 20px os textos dão, cada um numa caixa de 1px de largura: uma por pedaço do
 * quebrador. A tela tem lugar para o dobro do `esperado`; passando disso, a conta para no dobro, e
 * continua diferente do esperado.
 */
async function linhasNaCaixaEstreita(textos: { texto: string; negrito: boolean }[], esperado: number): Promise<number> {
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#FFFFFF", fontFamily: FAMILIA_DA_ARTE }}>
      {textos.map((t, i) => (
        <div
          key={i}
          style={{ display: "flex", flexDirection: "column", width: 1, background: "#000000", color: "transparent", fontSize: 20, lineHeight: 1, fontWeight: t.negrito ? 700 : 400 }}
        >
          {t.texto}
        </div>
      ))}
    </div>
  );
  const img = await desenharPng(el, 20 * esperado * 2 + 40, 64);
  let y = 0;
  while (y < img.altura && escuro(img, 0, y)) y++;
  return y / 20;
}

/**
 * O VETOR É EXATO quando o texto normalizado só tem ponto de quebra no espaço, e quem decide é o
 * quebrador do próprio Satori, e não um rótulo à mão (pedido do Labs, 02/10). Numa caixa de 1px, ele
 * põe cada pedaço numa linha: cada pedaço da conta, sozinho, tem de dar uma linha (nada quebra
 * dentro dele), e cada linha da composição tem de dar tantas linhas quanto pedaços (todo ponto de
 * quebra dele é um da conta).
 */
export async function soQuebraNoEspaco(slide: SlideParaArte): Promise<boolean> {
  const linhas = composicaoDoSlide(slide.titulo, slide.texto);
  const pedacos = linhas.flatMap((l) => pedacosDaLinha(l.texto).map((texto) => ({ texto, negrito: l.negrito })));
  const n = pedacos.length;
  return (await linhasNaCaixaEstreita(pedacos, n)) === n && (await linhasNaCaixaEstreita(linhas, n)) === n;
}

/** O que um vetor pede: o slide, sem número. */
export type EntradaDoVetor = {
  nome: string;
  categoria: string;
  texto: string;
  tipo: TipoDeSlide;
  titulo: string | null;
  comIlustracao: boolean;
  assinaturaNoPe: boolean;
};

/** O que o desenho responde: o maior degrau em que cabe (ou o piso), a altura nele, e se cabe. */
export type RespostaDoDesenho = { degrau: number; alturaDesenhada: number; cabe: boolean };

export function slideDoVetor(e: EntradaDoVetor): SlideParaArte {
  return { numero: 2, total: 3, tipo: e.tipo, titulo: e.titulo, texto: e.texto, assinaturaNoPe: e.assinaturaNoPe };
}

/** O primeiro da lista para o qual a pergunta responde sim, perguntando em ordem. */
async function achar<T>(lista: T[], pergunta: (x: T) => Promise<boolean>): Promise<T | undefined> {
  for (const x of lista) if (await pergunta(x)) return x;
  return undefined;
}

/** Desce a escada de degraus do tipo, desenhando cada um, até o primeiro em que o desenho cabe. */
export async function respostaDoDesenho(e: EntradaDoVetor): Promise<RespostaDoDesenho> {
  const slide = slideDoVetor(e);
  const degraus = degrausDoSlide(e.tipo, e.comIlustracao);
  // Os degraus de cima só precisam do "cabe"; a altura é medida só no degrau da resposta.
  const degrau = (await achar(degraus, (d) => cabeNaPeca(slide, d, e.comIlustracao))) ?? degraus[degraus.length - 1];
  const d = await desenharSlide(slide, degrau, e.comIlustracao);
  return { degrau, alturaDesenhada: d.altura, cabe: d.cabe };
}
