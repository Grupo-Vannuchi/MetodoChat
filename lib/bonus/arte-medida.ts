// A CONTA DO "NÃO CABE": quantas linhas o Satori dá a cada linha da composição (arte-composicao.ts) e
// quanto a composição ocupa de altura, sem desenhar. PURA, e roda no navegador (o aviso do editor).
//
// ⚠️ É A QUEBRA DO SATORI, REFEITA, e não uma estimativa (spec da Etapa 4, "A largura real de cada
// letra"; a 48.4 do Labs). A conta de antes media toda letra pela largura média das maiúsculas e não
// via a quebra por palavra; em caixa alta e fonte grande ela previa uma linha a menos, e o texto que
// ela aceitava no limite invadia a margem (achado 70). Lido no Satori 0.25.0 do og do Next 16.3.8
// (node_modules/next/dist/compiled/@vercel/og/index.node.js), e é isso que a conta repete:
// - a largura de um texto é a soma da largura de cada grafema, medido SOZINHO (por isso o kerning
//   nunca entra); a do grafema é, glifo a glifo, avanço × (1 / unidades por em × fonte), mais
//   (espaçamento / fonte) × fonte, nesta ordem de operações, que é a do opentype.js;
// - o grafema com algum caractere fora da fonte vale 1em, sem espaçamento: o emoji vira imagem do
//   tamanho da fonte. O caractere sem desenho que não é emoji vai buscar fonte na rede, e aí a conta
//   é aproximada;
// - a palavra que o quebrador entrega leva os espaços do fim, e cabe na linha quando
//   linha + palavra ≤ largura útil + espaços do fim dela (igual cabe);
// - a palavra mais larga que a linha não quebra (a arte não pede `wordBreak`) e vaza pela direita;
// - cada linha quebrada ocupa `alturaDaLinha`.
//
// ⚠️ ONDE A CONTA SÓ ERRA PARA O LADO SEGURO: o quebrador do Satori também quebra DENTRO da palavra,
// depois do hífen entre letras, em volta do travessão e do emoji colados, e depois de ? / … seguidos
// de letra. A conta só quebra no espaço. Com menos pontos de quebra, a quebra gulosa nunca termina
// uma linha antes, então a conta nunca prevê menos linhas que o desenho. Os vetores
// (tests/vetores-da-arte.json) marcam esses textos como "conservadores".
import type { LinhaDaArte } from "./arte-composicao";
import { alturaDaLinha, espacoAntes, LARGURA_UTIL } from "./arte-geometria";
import { FAIXAS_DE_LARGURA, UNIDADES_POR_EM } from "./arte-larguras";

type Avancos = Map<number, number>;
let avancos: { regular: Avancos; negrito: Avancos } | null = null;

function tabela(negrito: boolean): Avancos {
  if (!avancos) {
    const regular: Avancos = new Map();
    const deNegrito: Avancos = new Map();
    for (const [inicio, valores] of FAIXAS_DE_LARGURA) {
      for (let i = 0; i < valores.length / 2; i++) {
        regular.set(inicio + i, valores[2 * i]);
        deNegrito.set(inicio + i, valores[2 * i + 1]);
      }
    }
    avancos = { regular, negrito: deNegrito };
  }
  return negrito ? avancos.negrito : avancos.regular;
}

const grafemas = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** A largura que o Satori dá a um texto numa linha, em px. */
export function larguraDoTexto(texto: string, fonte: number, negrito: boolean, espacamento: number): number {
  const avancosDaFonte = tabela(negrito);
  const escala = (1 / UNIDADES_POR_EM) * fonte;
  let largura = 0;
  for (const { segment } of grafemas.segment(texto)) {
    let grafema = 0;
    for (const c of segment) {
      const unidades = avancosDaFonte.get(c.codePointAt(0)!);
      if (unidades === undefined) {
        grafema = fonte;
        break;
      }
      grafema += unidades * escala;
      if (espacamento) grafema += (espacamento / fonte) * fonte;
    }
    largura += grafema;
  }
  return largura;
}

/** Não quebra antes destes, mesmo depois de espaço (UAX#14, LB13). */
const COLAM_ANTES = new Set([..."!),./:;?]}"]);
/** Não quebra depois destes, mesmo antes de espaço (LB14). */
const ABREM = new Set([..."([{\u00A1\u00BF\u201E\u201A"]);
/** As aspas: entre elas e um dos que abrem, não quebra (LB15). */
const ASPAS = new Set([..."\"'\u00AB\u00BB\u201C\u201D\u2018\u2019\u2039\u203A"]);
const TRAVESSAO = "\u2014";

/**
 * O quebrador do Satori deixa quebrar neste espaço? Medido no quebrador dele (o do pacote linebreak,
 * dentro do og), em 02/10, com todos os pares de 230 caracteres em volta de um espaço: só estes quatro
 * casos colam.
 */
function quebraNoEspaco(antes: string, depois: string): boolean {
  if (COLAM_ANTES.has(depois) || ABREM.has(antes)) return false;
  if (ASPAS.has(antes) && ABREM.has(depois)) return false;
  return !(antes === TRAVESSAO && depois === TRAVESSAO);
}

/**
 * Os pedaços em que a linha pode quebrar, cada um com o espaço do fim, como o quebrador os entrega.
 * Recebe o texto da composição, que não tem espaço duplo nem nas pontas.
 */
export function pedacosDaLinha(texto: string): string[] {
  const partes = texto.split(" ");
  const pedacos: string[] = [];
  let atual = partes[0];
  for (const parte of partes.slice(1)) {
    if (quebraNoEspaco(Array.from(atual).at(-1) ?? "", Array.from(parte)[0] ?? "")) {
      pedacos.push(`${atual} `);
      atual = parte;
    } else atual += ` ${parte}`;
  }
  if (atual) pedacos.push(atual);
  return pedacos;
}

/** Em quantas linhas o Satori quebra uma linha da composição, e se alguma palavra vaza pela direita. */
export function quebraDaLinha(linha: LinhaDaArte, fonte: number): { linhas: number; vaza: boolean } {
  const medir = (t: string) => larguraDoTexto(t, fonte, linha.negrito, linha.espacamento);
  let linhas = 0;
  let ocupado = 0;
  let vaza = false;
  for (const pedaco of pedacosDaLinha(linha.texto)) {
    const largura = medir(pedaco);
    const semFim = pedaco.trimEnd() === pedaco ? largura : medir(pedaco.trimEnd());
    if (semFim > LARGURA_UTIL) vaza = true;
    if (linhas > 0 && ocupado + largura > LARGURA_UTIL + (largura - semFim)) {
      linhas++;
      ocupado = largura;
    } else {
      linhas = Math.max(linhas, 1);
      ocupado += largura;
    }
  }
  return { linhas, vaza };
}

/** A altura que o desenho dá à composição nesta fonte, e se alguma palavra vaza pela direita. */
export function medidaDaComposicao(linhas: LinhaDaArte[], fonte: number): { altura: number; vaza: boolean } {
  let altura = 0;
  let vaza = false;
  for (const linha of linhas) {
    const q = quebraDaLinha(linha, fonte);
    altura += espacoAntes(linha.antes, fonte) + q.linhas * alturaDaLinha(fonte);
    vaza ||= q.vaza;
  }
  return { altura, vaza };
}
