// AS LARGURAS DE AVANÇO de cada caractere de um .ttf, em unidades da fonte, como o Satori as usa:
// o glifo vem do cmap (plataforma 3, codificação 1, formato 4, a subtabela que o opentype.js do
// Satori escolhe) e o avanço vem do hmtx. PURO, e sem import de pacote: o gerador da tabela
// (lib/bonus/fonte/gerar-larguras.ts) roda no `node` puro, e o teste
// (tests/bonus-arte-larguras.test.ts) recalcula a tabela com esta mesma função.

/** Os avanços de uma fonte: as unidades por em e, por código de caractere, o avanço em unidades. */
export type LargurasDaFonte = { unidadesPorEm: number; avancos: Map<number, number> };

export function lerLarguras(ttf: Uint8Array): LargurasDaFonte {
  const v = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const tabelas = new Map<string, number>();
  for (let i = 0; i < v.getUint16(4); i++) {
    const o = 12 + i * 16;
    tabelas.set(String.fromCharCode(...ttf.subarray(o, o + 4)), v.getUint32(o + 8));
  }
  const exigir = (nome: string): number => {
    const o = tabelas.get(nome);
    if (o === undefined) throw new Error(`a fonte não tem a tabela ${nome}`);
    return o;
  };
  const head = exigir("head");
  const hhea = exigir("hhea");
  const hmtx = exigir("hmtx");
  const cmap = exigir("cmap");
  const nMetricas = v.getUint16(hhea + 34);
  const avancoDoGlifo = (g: number) => v.getUint16(hmtx + 4 * Math.min(g, nMetricas - 1));

  let formato4 = -1;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const r = cmap + 4 + i * 8;
    const o = cmap + v.getUint32(r + 4);
    if (v.getUint16(r) === 3 && v.getUint16(r + 2) === 1 && v.getUint16(o) === 4) formato4 = o;
  }
  if (formato4 < 0) throw new Error("a fonte não tem o cmap 3/1 de formato 4");

  const segmentos = v.getUint16(formato4 + 6) / 2;
  const fins = formato4 + 14;
  const inicios = fins + segmentos * 2 + 2;
  const deltas = inicios + segmentos * 2;
  const desvios = deltas + segmentos * 2;
  const avancos = new Map<number, number>();
  for (let s = 0; s < segmentos; s++) {
    const inicio = v.getUint16(inicios + 2 * s);
    const fim = v.getUint16(fins + 2 * s);
    const delta = v.getInt16(deltas + 2 * s);
    const desvio = v.getUint16(desvios + 2 * s);
    for (let c = inicio; c <= fim && c !== 0xffff; c++) {
      let g: number;
      if (desvio === 0) g = (c + delta) & 0xffff;
      else {
        const bruto = v.getUint16(desvios + 2 * s + desvio + 2 * (c - inicio));
        g = bruto === 0 ? 0 : (bruto + delta) & 0xffff;
      }
      if (g !== 0) avancos.set(c, avancoDoGlifo(g));
    }
  }
  return { unidadesPorEm: v.getUint16(head + 18), avancos };
}

/**
 * O texto do arquivo lib/bonus/arte-larguras.ts, com o Regular e o Bold juntos: cada faixa é o
 * primeiro código e, para cada código seguido, o avanço no Regular e no Bold. O gerador escreve
 * este texto, e o teste o compara com o arquivo versionado.
 */
export function textoDaTabela(regular: LargurasDaFonte, negrito: LargurasDaFonte): string {
  if (regular.unidadesPorEm !== negrito.unidadesPorEm) throw new Error("os dois pesos têm unidades por em diferentes");
  const codigos = [...regular.avancos.keys()].sort((a, b) => a - b);
  const deNegrito = [...negrito.avancos.keys()].sort((a, b) => a - b);
  if (codigos.join() !== deNegrito.join()) throw new Error("os dois pesos não desenham os mesmos caracteres");

  const faixas: string[] = [];
  let atual: number[] = [];
  let inicio = -1;
  const fechar = () => {
    if (atual.length) faixas.push(`  [0x${inicio.toString(16)}, [${atual.join(", ")}]],`);
  };
  for (const c of codigos) {
    if (c !== inicio + atual.length / 2) {
      fechar();
      inicio = c;
      atual = [];
    }
    atual.push(regular.avancos.get(c)!, negrito.avancos.get(c)!);
  }
  fechar();

  return [
    "// GERADO por lib/bonus/fonte/gerar-larguras.ts a partir dos .ttf de lib/bonus/fonte, e não se",
    "// edita à mão: tests/bonus-arte-larguras.test.ts recalcula a tabela e reprova a diferença. Quem",
    "// troca a fonte roda `node lib/bonus/fonte/gerar-larguras.ts` e versiona o arquivo novo.",
    "",
    `export const UNIDADES_POR_EM = ${regular.unidadesPorEm};`,
    "",
    "/** Cada faixa: o primeiro código e, para cada código seguido, o avanço no Regular e no Bold. */",
    "export const FAIXAS_DE_LARGURA: readonly (readonly [number, readonly number[]])[] = [",
    ...faixas,
    "];",
    "",
  ].join("\n");
}
