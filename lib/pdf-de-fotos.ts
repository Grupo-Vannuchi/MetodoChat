// O PDF DE FOTOS DO CARROSSEL NO LINKEDIN (a parte 3a; scratchpad/desenho-li3.md, §6). PURO, SEM DEPENDÊNCIA.
//
// O LinkedIn publica o carrossel como documento: um PDF, uma página por foto, que a pessoa passa com a seta. A
// decisão do Eduardo pela caixa, em 11/11 ("Montado pelo painel"), foi escrever o PDF aqui, e não pôr uma biblioteca:
// a que a spec citava está sem mudança no registro desde 2022 e tem 19,5 MB. Um PDF de fotos é pequeno: um catálogo,
// a árvore das páginas e, por página, a página, o desenho dela e a imagem.
//
// O JPEG ENTRA COMO ESTÁ (o filtro /DCTDecode do próprio PDF): sem recomprimir, sem perder qualidade e sem gastar
// processamento além de juntar os bytes. As medidas e as cores saem do cabeçalho do JPEG (`cabecalhoDoJpeg`). A
// página tem o tamanho da foto, um ponto por pixel: quem mostra o PDF o escala, e a proporção é o que conta.
//
// SÓ CINZA E COR DE TELA (1 ou 3 componentes), DE 8 BITS. O CMYK de gráfica pediria a inversão do Adobe, que nem todo
// leitor faz igual, e o de 12 bits não é aceito pelo filtro em todo lugar. A tela de publicar converte para JPEG de
// cor de tela, pelo canvas, toda foto que não sirva quando o LinkedIn está marcado (`vaiCruParaOLinkedin`), então
// esta recusa só se alcança por um pedido montado à mão.
import { cabecalhoDoJpeg } from "./bonus/imagem-jpeg";

const ESPACO_DE_COR: Record<number, string> = { 1: "/DeviceGray", 3: "/DeviceRGB" };

/** Monta o PDF, uma página por foto, na ordem. Lança com o número da foto (a partir de 1) que não serve. */
export function pdfDeFotos(fotos: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  if (fotos.length === 0) throw new Error("o PDF precisa de ao menos uma foto");
  const paginas = fotos.map((foto, i) => {
    const c = cabecalhoDoJpeg(foto);
    const cor = c ? ESPACO_DE_COR[c.componentes] : undefined;
    if (!c || !cor || c.precisao !== 8) {
      throw new Error(`a foto ${i + 1} não é um JPEG de 8 bits em cor de tela (RGB) ou em tons de cinza`);
    }
    return { foto, largura: c.largura, altura: c.altura, cor };
  });

  // OS OBJETOS: 1 o catálogo, 2 as páginas, e três por página (a página, o desenho dela e a imagem).
  const pedacos: Uint8Array[] = [];
  const posicoes: number[] = [];
  let tamanho = 0;
  const escrever = (parte: string | Uint8Array) => {
    const bytes = typeof parte === "string" ? latin1(parte) : parte;
    pedacos.push(bytes);
    tamanho += bytes.length;
  };
  const objeto = (numero: number, ...partes: (string | Uint8Array)[]) => {
    posicoes[numero] = tamanho;
    escrever(`${numero} 0 obj\n`);
    for (const parte of partes) escrever(parte);
    escrever("\nendobj\n");
  };

  // O CABEÇALHO E A LINHA COM BYTES ACIMA DE 127, que diz aos programas que o arquivo é binário.
  escrever("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const numeroDaPagina = (i: number) => 3 + i * 3;
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, `<< /Type /Pages /Kids [${paginas.map((_, i) => `${numeroDaPagina(i)} 0 R`).join(" ")}] /Count ${paginas.length} >>`);
  paginas.forEach((p, i) => {
    const pagina = numeroDaPagina(i);
    const desenho = `q ${p.largura} 0 0 ${p.altura} 0 0 cm /Im0 Do Q`;
    objeto(
      pagina,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.largura} ${p.altura}] ` +
        `/Resources << /XObject << /Im0 ${pagina + 2} 0 R >> >> /Contents ${pagina + 1} 0 R >>`
    );
    objeto(pagina + 1, `<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`);
    objeto(
      pagina + 2,
      `<< /Type /XObject /Subtype /Image /Width ${p.largura} /Height ${p.altura} /ColorSpace ${p.cor} ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.foto.length} >>\nstream\n`,
      p.foto,
      "\nendstream"
    );
  });

  // A TABELA DE POSIÇÕES: cada linha tem exatos 20 bytes, com o espaço antes da quebra.
  const total = 3 + paginas.length * 3;
  const inicioDaTabela = tamanho;
  escrever(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) escrever(`${String(posicoes[n]).padStart(10, "0")} 00000 n \n`);
  escrever(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`);

  const pdf = new Uint8Array(tamanho);
  let onde = 0;
  for (const p of pedacos) {
    pdf.set(p, onde);
    onde += p.length;
  }
  return pdf;
}

/** O texto das marcas do PDF, um byte por caractere (todas são ASCII, fora a linha binária do cabeçalho). */
function latin1(texto: string): Uint8Array {
  const b = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) b[i] = texto.charCodeAt(i) & 0xff;
  return b;
}
