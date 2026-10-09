// AS MEDIDAS DO JPEG QUE VOLTA DA OPENAI (spec da Etapa 6, "Guardar como foto"). PURO.
//
// A foto subida pelo navegador chega com as medidas que ele mediu (imagem-no-navegador.ts). A imagem
// gerada não passa pelo navegador: o servidor a recebe da OpenAI e lê as medidas do cabeçalho do próprio
// arquivo, antes de qualquer gravação. Sem biblioteca: o cabeçalho do JPEG é uma sequência de segmentos
// (FF, a marca, o tamanho em dois bytes), e a largura e a altura estão no segmento SOF.

export type MedidasDoJpeg = { largura: number; altura: number };

/**
 * As marcas SOF (C0 a CF) trazem as medidas, menos três que usam a mesma faixa para outra coisa: a C4
 * (tabela de Huffman), a C8 (reservada) e a CC (tabela aritmética).
 */
const ehSof = (marca: number) => marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;

/**
 * A largura e a altura do JPEG, ou `null` quando os bytes não são JPEG ou acabam antes das medidas. O
 * JPEG começa por FF D8; depois do SOS (DA) vêm os dados da imagem, e as medidas já teriam aparecido.
 */
export function medidasDoJpeg(b: Uint8Array): MedidasDoJpeg | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marca = b[i + 1];
    if (marca === 0xff) {
      i += 1;
      continue;
    }
    if (marca === 0xd9 || marca === 0xda) return null;
    const tamanho = (b[i + 2] << 8) | b[i + 3];
    if (tamanho < 2) return null;
    if (ehSof(marca)) {
      if (i + 9 > b.length) return null;
      const altura = (b[i + 5] << 8) | b[i + 6];
      const largura = (b[i + 7] << 8) | b[i + 8];
      return largura > 0 && altura > 0 ? { largura, altura } : null;
    }
    i += 2 + tamanho;
  }
  return null;
}
