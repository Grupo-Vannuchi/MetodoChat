import { CABECALHO_DA_FOTO, CABECALHO_DA_VERSAO, urlDaArte } from "@/lib/bonus/arte-tela";
import {
  problemaDaFotoDoEspaco,
  problemaDaProporcaoDoSlide,
  recorteDaFoto,
  type JeitoDaImagem,
} from "@/lib/bonus/publicar-regras";
import {
  TEXTO_FORMATO_DA_IMAGEM,
  TEXTO_FOTO_ILEGIVEL,
  TEXTO_IMAGEM_ILEGIVEL,
  textoDaArteQueNaoVeio,
  textoDaFotoQueFaltou,
  textoDaProporcao,
  textoDoProblemaDaFoto,
  type AvisoDaImagem,
  type AvisoDaPublicacao,
  type RespostaDaAssinatura,
} from "@/lib/bonus/publicar-textos";
import { medidasDaConversao, planoDaConversao } from "@/lib/publicacao";

// A IMAGEM NO NAVEGADOR (spec da Etapa 5). O arquivo NÃO passa pelo servidor: a Vercel recusa corpo
// acima de 4,5 MB (lib/bucket.ts), e o navegador sobe direto ao bucket, pela URL assinada que a
// action devolve. Aqui moram a conversão para JPEG, a conferência do 4:5 antes de subir, o recorte da
// foto do espaço (adendo de 05/10), o PUT, e as artes do Chat preparadas na hora de publicar. As
// actions entram por parâmetro, para o teste de tela (testes-dom/bonus-publicar-imagem.dom.tsx) usar
// falsas.

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

/** A qualidade do JPEG da foto, a mesma da conversão do /publicar. */
const QUALIDADE_DA_FOTO = 0.9;

/**
 * A FOTO DO ESPAÇO DA ARTE (adendo de 05/10): cortada ao centro na proporção do espaço (860:573) e
 * reduzida até 1720×1146, em JPEG, sempre pelo canvas (com o branco antes, como `converterParaJpeg`).
 * O que sobe já tem a forma do espaço, e a rota não corta nada. A pequena é recusada antes de assinar,
 * e a que passa de 2 MB também (achado 79), com a regra que a assinatura vai conferir.
 */
export async function prepararFoto(arquivo: Blob): Promise<{ ok: true; pronta: ImagemPronta } | { ok: false; texto: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    return { ok: false, texto: TEXTO_FOTO_ILEGIVEL };
  }
  try {
    const r = recorteDaFoto(bitmap.width, bitmap.height);
    if (!r.ok) return { ok: false, texto: textoDoProblemaDaFoto(r.problema) };
    const { x, y, largura, altura, saida } = r.recorte;
    const tela = document.createElement("canvas");
    tela.width = saida.largura;
    tela.height = saida.altura;
    const pincel = tela.getContext("2d");
    if (!pincel) return { ok: false, texto: "Este navegador não permitiu preparar a foto." };
    pincel.fillStyle = "#ffffff";
    pincel.fillRect(0, 0, saida.largura, saida.altura);
    pincel.drawImage(bitmap, x, y, largura, altura, 0, 0, saida.largura, saida.altura);
    const jpeg = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, "image/jpeg", QUALIDADE_DA_FOTO));
    if (!jpeg || jpeg.type !== "image/jpeg") return { ok: false, texto: TEXTO_FOTO_ILEGIVEL };
    const problema = problemaDaFotoDoEspaco(saida.largura, saida.altura, jpeg.size);
    if (problema) return { ok: false, texto: textoDoProblemaDaFoto(problema) };
    return { ok: true, pronta: { jpeg, largura: saida.largura, altura: saida.altura } };
  } finally {
    bitmap.close();
  }
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

/** O slide pronto: o JPEG cru ou convertido, no 4:5 da arte (achado 76). */
async function prepararSlidePronto(arquivo: Blob): Promise<{ ok: true; pronta: ImagemPronta } | { ok: false; texto: string }> {
  let pronta: ImagemPronta;
  try {
    pronta = await prepararImagem(arquivo);
  } catch {
    return { ok: false, texto: TEXTO_IMAGEM_ILEGIVEL };
  }
  if (pronta.jpeg.type !== "image/jpeg") return { ok: false, texto: TEXTO_FORMATO_DA_IMAGEM };
  const proporcao = problemaDaProporcaoDoSlide(pronta.largura, pronta.altura);
  if (proporcao) return { ok: false, texto: textoDaProporcao(proporcao) };
  return { ok: true, pronta };
}

/**
 * A IMAGEM DE UM SLIDE, de um dos dois jeitos: a foto do espaço (recortada) ou o slide pronto do Canva
 * (no 4:5). Confere antes de pedir a assinatura, assina no destino do jeito, sobe direto ao bucket, e
 * guarda. O jeito vai só na assinatura: no guardar, o servidor o lê do caminho que ele assinou. Cada
 * saída é um aviso, e nenhuma é muda.
 */
export async function enviarImagemDoSlide(p: {
  carrosselId: string;
  numero: number;
  jeito: JeitoDaImagem;
  arquivo: Blob;
  assinar: Assinar;
  guardar: Guardar;
}): Promise<AvisoDaImagem> {
  const preparada = p.jeito === "foto" ? await prepararFoto(p.arquivo) : await prepararSlidePronto(p.arquivo);
  if (!preparada.ok) return erro(preparada.texto);
  const { pronta } = preparada;
  const assinatura = await p.assinar({
    id: p.carrosselId,
    numero: p.numero,
    destino: p.jeito,
    arquivo: {
      nome: `${p.jeito === "foto" ? "foto" : "slide"}-${p.numero}.jpg`,
      mime: "image/jpeg",
      bytes: pronta.jpeg.size,
      largura: pronta.largura,
      altura: pronta.altura,
    },
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
 * AS ARTES DO CHAT, NA HORA DE PUBLICAR: as do "Só texto" e as dos slides com foto (adendo de 05/10).
 * Baixa a arte de cada uma pela rota da Etapa 3 (mesma origem, com a sessão), converte o PNG em JPEG,
 * assina no destino da fila e sobe.
 *
 * A VERSÃO QUE VAI JUNTO É A QUE A ROTA MANDOU COM A ARTE (`X-Arte-Versao`): a do que ela desenhou.
 * O servidor a confere contra o que está salvo, e recusa a velha. Achado no ensaio do adendo: a versão
 * da página era a de quando ela abriu, e depois de salvar um slide sem recarregar ia a velha, recusada
 * sempre.
 *
 * O SLIDE COM FOTO SÓ SOBE COM A FOTO DESENHADA (achado 78): a rota diz `X-Arte-Foto: sim`, e qualquer
 * outra coisa (o "faltou", ou nada) recusa antes de assinar. O post sairia sem a foto, sem volta. E O
 * QUE A ROTA DIZ VALE MAIS QUE A PÁGINA (achado 81): ela só manda o cabeçalho no slide que tem foto no
 * banco, e a página pode estar velha (a foto subiu noutra aba). Com o cabeçalho, só o "sim" sobe.
 */
export async function prepararArtes(p: {
  caminho: string;
  carrosselId: string;
  desenhados: { numero: number; comFoto: boolean }[];
  versoesDaMiniatura: string[];
  assinar: Assinar;
}): Promise<{ ok: true; artes: { numero: number; caminho: string; versao: string }[] } | { ok: false; texto: string }> {
  const artes: { numero: number; caminho: string; versao: string }[] = [];
  for (const { numero, comFoto } of p.desenhados) {
    let pronta: ImagemPronta;
    let versao: string | null;
    try {
      const r = await fetch(urlDaArte(p.caminho, numero, p.versoesDaMiniatura[numero - 1] ?? ""), { cache: "no-store" });
      if (!r.ok) return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
      const foto = r.headers.get(CABECALHO_DA_FOTO);
      if ((comFoto || foto !== null) && foto !== "sim") return { ok: false, texto: textoDaFotoQueFaltou(numero) };
      versao = r.headers.get(CABECALHO_DA_VERSAO);
      if (!versao) return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
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
    artes.push({ numero, caminho: assinatura.caminho, versao });
  }
  return { ok: true, artes };
}

/**
 * O CLIQUE NO "PUBLICAR": prepara as artes do Chat e manda o pedido, com a hora e o fuso do navegador
 * (o `datetime-local` não tem fuso; a action lê os dois com as funções do /publicar). Fora do
 * componente, para o relógio não ser lido durante o desenho da tela.
 */
export async function publicarDaTela(p: {
  caminho: string;
  carrosselId: string;
  desenhados: { numero: number; comFoto: boolean }[];
  versoesDaMiniatura: string[];
  quando: "agora" | "depois";
  dataHora: string;
  assinar: Assinar;
  publicar: (pedido: unknown) => Promise<AvisoDaPublicacao>;
}): Promise<AvisoDaPublicacao> {
  const artes = await prepararArtes(p);
  if (!artes.ok) return { tom: "erro", texto: artes.texto, em: Date.now() };
  return p.publicar({
    id: p.carrosselId,
    quando: p.quando,
    dataHora: p.dataHora,
    fuso: String(new Date().getTimezoneOffset()),
    artes: artes.artes,
  });
}
