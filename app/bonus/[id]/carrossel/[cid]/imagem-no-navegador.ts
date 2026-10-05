import { urlDaArte } from "@/lib/bonus/arte-tela";
import { problemaDaProporcaoDoSlide } from "@/lib/bonus/publicar-regras";
import {
  TEXTO_FORMATO_DA_IMAGEM,
  TEXTO_IMAGEM_ILEGIVEL,
  textoDaArteQueNaoVeio,
  textoDaProporcao,
  type AvisoDaImagem,
  type RespostaDaAssinatura,
} from "@/lib/bonus/publicar-textos";
import { medidasDaConversao, planoDaConversao } from "@/lib/publicacao";

// A IMAGEM NO NAVEGADOR (spec da Etapa 5). O arquivo NÃO passa pelo servidor: a Vercel recusa corpo
// acima de 4,5 MB (lib/bucket.ts), e o navegador sobe direto ao bucket, pela URL assinada que a
// action devolve. Aqui moram a conversão para JPEG, a conferência do 4:5 antes de subir, o PUT, e as
// artes "Só texto" preparadas na hora de publicar. As actions entram por parâmetro, para o teste de
// tela (testes-dom/bonus-publicar-imagem.dom.tsx) usar falsas.

export type ImagemPronta = { jpeg: Blob; largura: number; altura: number };

/**
 * Redesenha a imagem como JPEG, no tamanho do plano.
 *
 * COPIADA de `converterParaJpeg` (app/publicar/enviador.tsx:549-583, do Vinícius), que não é
 * exportada: exportá-la seria mexer no arquivo dele. A diferença é o `Blob` no lugar do `File`, porque
 * a arte "Só texto" chega de um `fetch`, sem nome. As decisões continuam nas funções puras que o
 * /publicar exporta (`planoDaConversao`, `medidasDaConversao`, lib/publicacao.ts).
 *
 * O `fillRect` BRANCO NÃO É ENFEITE (a armadilha nº 1, app/publicar/enviador.tsx:537-544): o canvas
 * nasce transparente, e o JPEG não tem canal alfa. Sem ele, o PNG de fundo transparente sairia com
 * fundo PRETO, no perfil público.
 */
export async function converterParaJpeg(imagem: Blob, plano: { largura: number; altura: number; qualidade: number }): Promise<Blob> {
  const bitmap = await createImageBitmap(imagem);
  try {
    const { largura, altura } = medidasDaConversao(plano, bitmap);
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const pincel = tela.getContext("2d");
    if (!pincel) throw new Error("Este navegador não permitiu preparar a imagem.");
    pincel.fillStyle = "#ffffff";
    pincel.fillRect(0, 0, largura, altura);
    pincel.drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, "image/jpeg", plano.qualidade));
    if (!blob) throw new Error("Não foi possível preparar a imagem para envio.");
    return blob;
  } finally {
    bitmap.close();
  }
}

/** A imagem em JPEG e as medidas FINAIS dela: JPEG que já serve vai cru; o resto passa pelo canvas. */
export async function prepararImagem(arquivo: Blob): Promise<ImagemPronta> {
  const bitmap = await createImageBitmap(arquivo);
  const medida = { largura: bitmap.width, altura: bitmap.height };
  bitmap.close();
  const plano = planoDaConversao({ mime: arquivo.type, ...medida });
  if (!plano.converter) return { jpeg: arquivo, ...medida };
  const final = medidasDaConversao(plano, { width: medida.largura, height: medida.altura });
  return { jpeg: await converterParaJpeg(arquivo, plano), ...final };
}

/** O PUT na URL assinada. Sem cabeçalho de autenticação: o token da URL é a credencial inteira. */
export async function subirParaOBucket(url: string, jpeg: Blob): Promise<void> {
  const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
  if (!r.ok) throw new Error(`O armazenamento recusou a imagem (HTTP ${r.status}).`);
}

type Assinar = (pedido: unknown) => Promise<RespostaDaAssinatura>;
type Guardar = (pedido: unknown) => Promise<AvisoDaImagem>;

const erro = (texto: string): AvisoDaImagem => ({ tom: "erro", texto, em: Date.now() });
const mensagem = (e: unknown) => (e instanceof Error && e.message ? e.message : TEXTO_IMAGEM_ILEGIVEL);

/**
 * A IMAGEM DO CANVA DE UM SLIDE: prepara o JPEG, confere o 4:5 (achado 76) e o formato antes de pedir
 * a assinatura, sobe direto ao bucket, e guarda. Cada saída é um aviso, e nenhuma é muda.
 */
export async function enviarImagemDoSlide(p: {
  carrosselId: string;
  numero: number;
  arquivo: Blob;
  assinar: Assinar;
  guardar: Guardar;
}): Promise<AvisoDaImagem> {
  let pronta: ImagemPronta;
  try {
    pronta = await prepararImagem(p.arquivo);
  } catch {
    return erro(TEXTO_IMAGEM_ILEGIVEL);
  }
  if (pronta.jpeg.type !== "image/jpeg") return erro(TEXTO_FORMATO_DA_IMAGEM);
  const proporcao = problemaDaProporcaoDoSlide(pronta.largura, pronta.altura);
  if (proporcao) return erro(textoDaProporcao(proporcao));
  const assinatura = await p.assinar({
    id: p.carrosselId,
    numero: p.numero,
    destino: "slide",
    arquivo: { nome: `slide-${p.numero}.jpg`, mime: "image/jpeg", bytes: pronta.jpeg.size, largura: pronta.largura, altura: pronta.altura },
  });
  if (!assinatura.ok) return erro(assinatura.texto);
  try {
    await subirParaOBucket(assinatura.url, pronta.jpeg);
  } catch (e) {
    return erro(mensagem(e));
  }
  return p.guardar({ id: p.carrosselId, numero: p.numero, caminho: assinatura.caminho });
}

/**
 * AS ARTES "SÓ TEXTO", NA HORA DE PUBLICAR: baixa a arte de cada uma pela rota da Etapa 3 (mesma
 * origem, com a sessão), converte o PNG em JPEG, assina no destino da fila e sobe. A versão que vai
 * junto é a do texto que a página mostrou: se o texto mudou depois, o servidor recusa.
 */
export async function prepararArtesSoTexto(p: {
  bonusId: string;
  carrosselId: string;
  soTexto: number[];
  versoesDaMiniatura: string[];
  versoesDoTexto: string[];
  assinar: Assinar;
}): Promise<{ ok: true; artes: { numero: number; caminho: string; versao: string }[] } | { ok: false; texto: string }> {
  const artes: { numero: number; caminho: string; versao: string }[] = [];
  for (const numero of p.soTexto) {
    let pronta: ImagemPronta;
    try {
      const r = await fetch(urlDaArte(p.bonusId, p.carrosselId, numero, p.versoesDaMiniatura[numero - 1] ?? ""), { cache: "no-store" });
      if (!r.ok) return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
      pronta = await prepararImagem(await r.blob());
    } catch {
      return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
    }
    // O que não virou JPEG não sobe: a assinatura declara JPEG, e o servidor não vê os bytes.
    if (pronta.jpeg.type !== "image/jpeg") return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
    const assinatura = await p.assinar({
      id: p.carrosselId,
      numero,
      destino: "fila",
      arquivo: { nome: `slide-${numero}.jpg`, mime: "image/jpeg", bytes: pronta.jpeg.size, largura: pronta.largura, altura: pronta.altura },
    });
    if (!assinatura.ok) return { ok: false, texto: assinatura.texto };
    try {
      await subirParaOBucket(assinatura.url, pronta.jpeg);
    } catch (e) {
      return { ok: false, texto: mensagem(e) };
    }
    artes.push({ numero, caminho: assinatura.caminho, versao: p.versoesDoTexto[numero - 1] ?? "" });
  }
  return { ok: true, artes };
}
