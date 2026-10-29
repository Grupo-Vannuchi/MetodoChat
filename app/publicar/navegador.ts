import {
  QUALIDADE_DO_JPEG,
  medidasDaConversao,
  nomeDepoisDaConversao,
  orientacaoDoJpeg,
  type FormaDePublicacao,
  type Retangulo,
} from "@/lib/publicacao";

// A FIAÇÃO DO NAVEGADOR DO /publicar — medir, ler a orientação, desenhar no
// `canvas`, pedir a URL assinada e subir com progresso. Nenhuma decisão de
// negócio mora aqui: o retângulo do desenho vem de `geometriaDoEnquadramento`,
// e se o arquivo vai cru vem de `vaiSemRedesenho` (lib/publicacao.ts).
//
// ELA É UM OBJETO QUE O COMPOSITOR RECEBE, e não funções soltas, porque o jsdom
// não tem `canvas`, `createImageBitmap` nem `URL.createObjectURL`: o teste de
// tela entrega uma falsa, no molde das actions que entram por propriedade no
// gerador. A de verdade é `navegadorDeVerdade`, no fim.

export type Medidas = { largura?: number; altura?: number; segundos?: number };

export type PedidoDeAssinatura = {
  forma: FormaDePublicacao;
  nome: string;
  mime: string;
  bytes: number;
  segundos?: number;
  largura?: number;
  altura?: number;
};

export type Navegador = {
  /** O endereço local do arquivo, para a miniatura. Liberado por `soltarEndereco`. */
  criarEndereco(arquivo: File): string;
  soltarEndereco(endereco: string): void;
  /** As medidas que o `canvas` vai usar: a imagem pelo mesmo bitmap que desenha, o vídeo pelos metadados. */
  medir(arquivo: File): Promise<Medidas>;
  /** A orientação EXIF do JPEG: de 1 a 8, ou 0 quando não deu para ler (`orientacaoDoJpeg`). */
  lerOrientacao(arquivo: File): Promise<number>;
  /** O desenho do enquadramento, num JPEG do tamanho do canvas. */
  enquadrar(arquivo: File, desenho: { largura: number; altura: number; origem: Retangulo; destino: Retangulo }): Promise<File>;
  /** A conversão de sempre (o story): PNG ou WebP em JPEG, no tamanho que `planoDaConversao` mandou. */
  converter(arquivo: File, plano: { largura: number; altura: number; qualidade: number }): Promise<File>;
  /** O pedido da URL assinada. O sinal interrompe, como o da subida. */
  assinar(
    pedido: PedidoDeAssinatura,
    sinal: AbortSignal
  ): Promise<{ ok: true; caminho: string; url: string } | { ok: false; erro: string }>;
  /** O PUT na URL assinada, com progresso. O sinal interrompe. */
  subir(url: string, arquivo: File, aoAndar: (enviados: number, total: number) => void, sinal: AbortSignal): Promise<void>;
};

/**
 * O BITMAP COM A ORIENTAÇÃO APLICADA, e é o MESMO para medir e para desenhar
 * (achado 110). A tela media com `new Image().naturalWidth` e desenhava com
 * `createImageBitmap(arquivo)`, e o desenho era esticado nas medidas da
 * primeira API.
 *
 * A OPÇÃO `imageOrientation: "from-image"` É PEDIDA, MAS NÃO É EXIGIDA. Ela é o
 * padrão da norma de hoje, e nada em produção prova que todo navegador a aceita:
 * o gerador chama `createImageBitmap(arquivo)` sem opção nenhuma
 * (`app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`). Um navegador que a
 * recusasse deixaria TODA imagem como "ilegível". Então, se ela der erro, a
 * chamada se repete sem ela.
 *
 * MENOS PARA O JPEG QUE PRECISA GIRAR (achado 120). O navegador que dá erro com
 * "from-image" é justamente o que não conhece o valor, e sem ele a rotação do
 * EXIF não é garantida: a foto de celular em pé seria medida e cortada deitada,
 * e o `canvas` tira o EXIF, então o post sairia deitado, sem `DELETE`, com a
 * miniatura (que o CSS gira) mostrando certo. Então o JPEG com orientação
 * diferente de 1 (o 0, que é "não deu para ler", incluído) não repete: o erro
 * sobe, e o slide fica "ilegível", que é visível. O JPEG com orientação 1, o PNG
 * e o WebP repetem.
 */
async function bitmapDe(arquivo: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch (erro) {
    if (arquivo.type === "image/jpeg" && (await orientacaoDoArquivo(arquivo)) !== 1) throw erro;
    return await createImageBitmap(arquivo);
  }
}

/**
 * A ORIENTAÇÃO EXIF DE UM ARQUIVO: a do JPEG (`orientacaoDoJpeg`), e 1 para o
 * resto, que não tem o que girar aqui.
 *
 * OS CABEÇALHOS DO JPEG ficam no começo: 64 KiB bastam, e ler o arquivo inteiro
 * de uma foto de 8 MB para achar dois bytes seria desperdício. O EXIF que termina
 * depois deles dá 0, e o 0 vai pelo `canvas` (achado 117). A LEITURA QUE FALHA
 * TAMBÉM DÁ 0: sem o `catch`, o slide ficava em "Lendo o arquivo…" e o Publicar
 * recusando para sempre.
 */
async function orientacaoDoArquivo(arquivo: Blob): Promise<number> {
  if (arquivo.type !== "image/jpeg") return 1;
  try {
    return orientacaoDoJpeg(new Uint8Array(await arquivo.slice(0, 64 * 1024).arrayBuffer()));
  } catch {
    return 0;
  }
}

/** ZERO VIRA AUSENTE: `videoWidth` é 0 enquanto os metadados não carregaram. */
function numeroOuNada(n: number): number | undefined {
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * O TEMPO-LIMITE DA MEDIDA DO VÍDEO. Um navegador que não dispara nem o
 * `loadedmetadata` nem o `error` deixaria o slide em "Lendo o arquivo…" e o
 * Publicar recusando para sempre. Passado o tempo, o vídeo fica sem medida, que
 * é o mesmo desfecho do vídeo que o navegador não abre.
 */
export const TEMPO_PARA_MEDIR_VIDEO_EM_MS = 10_000;

function medirVideo(arquivo: File): Promise<Medidas> {
  const endereco = URL.createObjectURL(arquivo);
  let relogio: ReturnType<typeof setTimeout> | undefined;
  return new Promise<Medidas>((ok) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      ok({
        largura: numeroOuNada(video.videoWidth),
        altura: numeroOuNada(video.videoHeight),
        segundos: numeroOuNada(video.duration),
      });
    // MEDIR PODE FALHAR, E FALHAR NÃO É RECUSAR: um codec que este navegador não
    // abre (o `.mov` HEVC no Chrome) ainda pode ser um vídeo que a Meta aceita.
    video.onerror = () => ok({});
    relogio = setTimeout(() => ok({}), TEMPO_PARA_MEDIR_VIDEO_EM_MS);
    video.src = endereco;
  }).finally(() => {
    clearTimeout(relogio);
    URL.revokeObjectURL(endereco);
  });
}

/**
 * O DESENHO, com o branco pintado ANTES. O `canvas` nasce transparente e o JPEG
 * não tem canal alfa: sem o branco, o PNG transparente vira fundo preto no
 * perfil público, onde não há `DELETE`. É a armadilha nº 1 que o Vinícius deixou
 * escrita, e agora o mesmo branco é a cor das bordas do "Inteira, com bordas".
 *
 * O TIPO É CONFERIDO DEPOIS DO `toBlob`: um navegador que não gera JPEG devolve
 * PNG calado, e um ".jpg" que é PNG seria recusado pela Meta depois de tudo
 * pronto.
 */
async function desenharJpeg(
  bitmap: ImageBitmap,
  largura: number,
  altura: number,
  origem: Retangulo,
  destino: Retangulo,
  nome: string,
  qualidade: number
): Promise<File> {
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const pincel = tela.getContext("2d");
  if (!pincel) throw new Error("Este navegador não permitiu preparar a imagem.");
  pincel.fillStyle = "#ffffff";
  pincel.fillRect(0, 0, largura, altura);
  pincel.drawImage(
    bitmap,
    origem.x,
    origem.y,
    origem.largura,
    origem.altura,
    destino.x,
    destino.y,
    destino.largura,
    destino.altura
  );
  const blob = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, "image/jpeg", qualidade));
  if (!blob || blob.type !== "image/jpeg") throw new Error("Este navegador não conseguiu gerar o JPEG da imagem.");
  return new File([blob], nomeDepoisDaConversao(nome), { type: "image/jpeg" });
}

export const navegadorDeVerdade: Navegador = {
  criarEndereco: (arquivo) => URL.createObjectURL(arquivo),
  soltarEndereco: (endereco) => URL.revokeObjectURL(endereco),

  async medir(arquivo) {
    if (arquivo.type.startsWith("video/")) return medirVideo(arquivo);
    if (!arquivo.type.startsWith("image/")) return {};
    try {
      const bitmap = await bitmapDe(arquivo);
      try {
        return { largura: numeroOuNada(bitmap.width), altura: numeroOuNada(bitmap.height) };
      } finally {
        bitmap.close();
      }
    } catch {
      return {};
    }
  },

  lerOrientacao: orientacaoDoArquivo,

  async enquadrar(arquivo, d) {
    const bitmap = await bitmapDe(arquivo);
    try {
      return await desenharJpeg(bitmap, d.largura, d.altura, d.origem, d.destino, arquivo.name, QUALIDADE_DO_JPEG);
    } finally {
      bitmap.close();
    }
  },

  async converter(arquivo, plano) {
    const bitmap = await bitmapDe(arquivo);
    try {
      // PLANO SEM MEDIDA USA A DA IMAGEM: `planoDaConversao` devolve 0/0 quando
      // não sabia o tamanho, e cravar zero gravaria um arquivo de zero pixel.
      const { largura, altura } = medidasDaConversao(plano, bitmap);
      const inteira = { x: 0, y: 0, largura: bitmap.width, altura: bitmap.height };
      return await desenharJpeg(bitmap, largura, altura, inteira, { x: 0, y: 0, largura, altura }, arquivo.name, plano.qualidade);
    } finally {
      bitmap.close();
    }
  },

  async assinar(pedido, sinal) {
    const resposta = await fetch("/api/midia/assinar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
      signal: sinal,
    });
    const dados = (await resposta.json().catch(() => null)) as { caminho?: string; url?: string; error?: string } | null;
    // A FRASE DO SERVIDOR PASSA INTEIRA: ela veio de `textoDoProblema` do outro
    // lado, e reescrevê-la aqui criaria a segunda redação do mesmo "não".
    if (!resposta.ok || !dados?.url || !dados?.caminho) {
      return { ok: false, erro: dados?.error ?? "O servidor não liberou o envio." };
    }
    return { ok: true, caminho: dados.caminho, url: dados.url };
  },

  subir: subirComProgresso,
};

/**
 * O `PUT` na URL assinada, com progresso, e INTERROMPÍVEL.
 *
 * É `XMLHttpRequest` PORQUE `fetch` NÃO DÁ PROGRESSO DE UPLOAD: a API expõe o
 * corpo que desce, não o que sobe. SEM CABEÇALHO DE AUTENTICAÇÃO (medido em
 * 03/09): o `?token=` da URL é a credencial inteira, de um caminho só, para
 * subir, por 2 horas. A `SUPABASE_SERVICE_ROLE_KEY` nunca sai do servidor.
 *
 * O SINAL É NOVO (spec 2026-10-19-enquadrar-imagens): o envio agora acontece no
 * clique de publicar, e sair da tela no meio NÃO pode deixar a subida andando e
 * a action ser chamada depois, de uma tela que ninguém está vendo. Sair aborta.
 */
export function subirComProgresso(
  endereco: string,
  arquivo: File,
  aoAndar: (enviados: number, total: number) => void,
  sinal: AbortSignal
): Promise<void> {
  return new Promise((ok, nao) => {
    if (sinal.aborted) {
      nao(new Error("O envio foi interrompido."));
      return;
    }
    const pedido = new XMLHttpRequest();
    const abortar = () => pedido.abort();
    sinal.addEventListener("abort", abortar, { once: true });
    const fim = () => sinal.removeEventListener("abort", abortar);
    pedido.open("PUT", endereco, true);
    pedido.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
    pedido.upload.onprogress = (ev) => {
      // `lengthComputable` FALSO É NÃO SABER O TOTAL; não vale inventar um.
      if (ev.lengthComputable) aoAndar(ev.loaded, ev.total);
    };
    pedido.onload = () => {
      fim();
      if (pedido.status >= 200 && pedido.status < 300) ok();
      else nao(new Error(`O armazenamento recusou o arquivo (HTTP ${pedido.status}).`));
    };
    pedido.onerror = () => {
      fim();
      nao(new Error("A conexão caiu durante o envio."));
    };
    pedido.onabort = () => {
      fim();
      nao(new Error("O envio foi interrompido."));
    };
    pedido.send(arquivo);
  });
}
