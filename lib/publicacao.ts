// AS DECISÕES DE PUBLICAR NO INSTAGRAM, fora do JSX e fora do motor.
//
// ESTE É O PRIMEIRO RECURSO DO PRODUTO QUE ESCREVE NO PERFIL PÚBLICO. Tudo até
// aqui responde em conversa privada. Um defeito aqui não é uma mensagem errada
// para uma pessoa — é um post no perfil de 2.933 publicações, visível para
// todos os seguidores, que some do feed mas não da memória de quem viu.
//
// Por isso as quatro decisões (o arquivo serve? quais parâmetros a Meta espera?
// o contêiner está pronto? a legenda cabe?) moram aqui, com caso para cada
// saída, e não espalhadas pela tela e pelo dreno.
//
// NENHUM IMPORT, e isto é deliberado: o arquivo é puro, roda no navegador e no
// servidor, e a tela (Tarefa 5) precisa dele no cliente para validar ANTES de
// enviar 200 MB. Um `server-only` puxado por engano aqui derrubaria o
// enviador — e derrubaria esta suíte junto.
//
// =============================================================================
// A VALIDAÇÃO RODA DUAS VEZES, E AS DUAS SÃO ESTA FUNÇÃO
//
// O navegador valida para dar mensagem boa antes do upload; o servidor valida
// (Tarefa 3, `app/api/midia/assinar`) porque o navegador é do usuário. É o
// MESMO código nos dois lados justamente para as duas barreiras nunca
// discordarem sobre o que é um arquivo bom.

// -----------------------------------------------------------------------------
// OS NÚMEROS DA META, lidos na referência em 03/09/2026 e não estimados.
//
// Cada um é uma constante nomeada, uma por forma, para que a mudança de um
// limite seja uma linha e não uma caçada. Fonte:
// developers.facebook.com/documentation/instagram-platform/instagram-graph-api/
// reference/ig-user/media
// -----------------------------------------------------------------------------

const MB = 1024 * 1024;

/** Imagem: JPEG, sRGB, 8 MB. */
const IMAGEM_BYTES_MAX = 8 * MB;
/** Imagem: largura mínima de 320px. Acima de 1440 a Meta reduz sozinha — por
 *  isso o teto NÃO recusa nada, e só o piso vira problema. */
const IMAGEM_LARGURA_MIN = 320;
/** Imagem: da vertical 4:5 (0,8) à horizontal 1.91:1. As duas bordas ENTRAM. */
const IMAGEM_PROPORCAO_MIN = 0.8;
const IMAGEM_PROPORCAO_MAX = 1.91;

/** Reels: 300 MB, de 3 segundos a 15 minutos. */
const REELS_BYTES_MAX = 300 * MB;
const REELS_SEGUNDOS_MIN = 3;
const REELS_SEGUNDOS_MAX = 15 * 60;
/** Reels: 0.01:1 a 10:1. A faixa é larguíssima de propósito — ela não enquadra
 *  arte, ela pega arquivo absurdo. A faixa da IMAGEM não vale aqui: um reels
 *  9:16 (0,5625) é mais vertical que 4:5 e tem de passar. */
const VIDEO_PROPORCAO_MIN = 0.01;
const VIDEO_PROPORCAO_MAX = 10;

/** Story em vídeo: 100 MB, de 3 a 60 segundos. SÃO OUTROS NÚMEROS, e não os do
 *  reels — 60s contra 15min, 100 MB contra 300 MB. */
const STORY_BYTES_MAX = 100 * MB;
const STORY_SEGUNDOS_MIN = 3;
const STORY_SEGUNDOS_MAX = 60;

/** Legenda: 2.200 caracteres, 30 hashtags, 20 menções. */
const LEGENDA_CARACTERES_MAX = 2200;
const LEGENDA_HASHTAGS_MAX = 30;
const LEGENDA_MENCOES_MAX = 20;

/** O único formato de imagem que a Meta aceita. PNG é o formato mais comum de
 *  quem monta arte, e recusá-lo AQUI é a diferença entre um aviso na hora e
 *  8 MB enviados para a Meta recusar depois. A tela converte para JPEG por
 *  `canvas` antes de chegar aqui (Tarefa 5). */
const MIMES_DE_IMAGEM = ["image/jpeg"];
/** MOV e MP4. AVI não entra. */
const MIMES_DE_VIDEO = ["video/mp4", "video/quicktime"];

// -----------------------------------------------------------------------------
// OS NÚMEROS MEDIDOS CONTRA A META, em 03/09/2026, e não os que a documentação
// diz — ela se contradiz, 50 num lugar e 100 noutro.
//
// Vieram de `GET /{ig-user-id}/content_publishing_limit`, na conta
// @vannuchi.eng: `quota_total: 100`, `quota_duration: 86400`.
//
// ELES SÃO REFERÊNCIA, E NÃO O PORTÃO. Quem decide se cabe publicar agora é a
// resposta da Meta no momento (Tarefa 4, passo 4) — uma constante não sabe
// quanto da cota já foi gasto hoje. Estes números servem para a tela avisar e
// para o dreno escolher um adiamento que faça sentido.
// -----------------------------------------------------------------------------

/** Publicações por conta a cada 24h. MEDIDO: `quota_total: 100`. */
export const PUBLICACOES_POR_DIA = 100;
/** A janela da cota, em segundos. MEDIDO: `quota_duration: 86400`. */
export const JANELA_DA_COTA_EM_SEGUNDOS = 86400;
/** Contêineres por conta a cada 24h. Este NÃO foi medido — veio da
 *  documentação, e está aqui nomeado para não ser confundido com o de cima. */
export const CONTAINERS_POR_DIA = 400;

export type FormaDePublicacao = "imagem" | "reels" | "story" | "carrossel";

export type ProblemaDoArquivo =
  | "tipo_nao_suportado"
  | "grande_demais"
  | "grande_para_o_bucket"
  | "curto_demais"
  | "longo_demais"
  | "proporcao_fora"
  | "estreito_demais";

/** O que se sabe do arquivo antes de ele subir. `segundos`, `largura` e
 *  `altura` são opcionais porque o navegador nem sempre os entrega — vídeo sem
 *  metadados carregados devolve `videoWidth: 0`, e recusar por falta de
 *  medição bloquearia arquivo bom. */
export type ArquivoDeclarado = {
  mime: string;
  bytes: number;
  segundos?: number;
  largura?: number;
  altura?: number;
};

/**
 * `null` quando o arquivo serve.
 *
 * =============================================================================
 * POR QUE O TETO DO BUCKET É PARÂMETRO, E NÃO CONSTANTE
 *
 * MEDIDO em 03/09/2026: o bucket do projeto está em 50 MB
 * (`file_size_limit: 52428800`, lido em `GET /storage/v1/bucket/{nome}`) — não
 * por escolha de desenho, mas porque o pagamento do plano pago atrasou. O plano
 * pago vai a 500 GB, e o teto sobe SOZINHO quando o pagamento entrar.
 *
 * Cravar 50 MB aqui criaria uma dívida que ninguém lembra de pagar: no dia em
 * que o plano voltasse, vídeo continuaria recusado por uma constante esquecida,
 * e o sintoma seria "não sei por que não sobe". Quem lê o teto de verdade é
 * `tetoDoBucket` (Tarefa 3), contra o Supabase, e ele chega até a tela.
 *
 * =============================================================================
 * POR QUE SÃO DOIS PROBLEMAS DE TAMANHO, E NÃO UM
 *
 * O menor entre o teto da Meta e o do bucket é que vale — mas a frase que ajuda
 * o dono é DIFERENTE em cada caso:
 *
 *   `grande_demais`        a Meta recusaria de qualquer jeito. "Exporte menor"
 *                          é conselho verdadeiro.
 *   `grande_para_o_bucket` NÓS é que somos o gargalo. O arquivo está certo, e
 *                          o que falta é o plano. Dizer "exporte menor" aqui é
 *                          mentira por omissão.
 *
 * E QUANDO OS DOIS TETOS SÃO ESTOURADOS, QUEM MANDA É A META: subir o plano não
 * faria aquele arquivo funcionar, e mandar o dono cobrar um pagamento que não
 * resolve nada é o pior dos dois erros.
 */
export function problemaDoArquivo(
  forma: FormaDePublicacao,
  arq: ArquivoDeclarado,
  tetoDoBucketEmBytes: number
): ProblemaDoArquivo | null {
  const ehVideo = MIMES_DE_VIDEO.includes(arq.mime);
  const ehImagem = MIMES_DE_IMAGEM.includes(arq.mime);

  // O TIPO VEM PRIMEIRO, e a ordem não é estética: um AVI de 80 MB tem dois
  // problemas, e o que ajuda é o do formato — trocar de plano não faria a Meta
  // aceitar AVI.
  if (!ehVideo && !ehImagem) return "tipo_nao_suportado";

  // A forma decide QUAIS mídias ela aceita. Story aceita as duas; reels só
  // vídeo; imagem só imagem. Carrossel aceita as duas, e cada item segue a
  // regra da sua mídia (o pai é montado noutro lugar).
  if (forma === "imagem" && !ehImagem) return "tipo_nao_suportado";
  if (forma === "reels" && !ehVideo) return "tipo_nao_suportado";

  const bytesMax = tetoDaMeta(forma, ehVideo);
  // A META GANHA DO BUCKET quando os dois são estourados. Ver o cabeçalho.
  if (arq.bytes > bytesMax) return "grande_demais";
  if (arq.bytes > tetoDoBucketEmBytes) return "grande_para_o_bucket";

  if (ehVideo) {
    const [minimo, maximo] =
      forma === "story"
        ? [STORY_SEGUNDOS_MIN, STORY_SEGUNDOS_MAX]
        : [REELS_SEGUNDOS_MIN, REELS_SEGUNDOS_MAX];
    if (arq.segundos !== undefined) {
      if (arq.segundos < minimo) return "curto_demais";
      if (arq.segundos > maximo) return "longo_demais";
    }
  }

  const proporcao =
    arq.largura !== undefined && arq.altura !== undefined && arq.altura > 0
      ? arq.largura / arq.altura
      : null;

  if (ehImagem) {
    if (arq.largura !== undefined && arq.largura < IMAGEM_LARGURA_MIN) return "estreito_demais";
    // A PROPORÇÃO DA IMAGEM SÓ VALE NO FEED. Story é enquadrado 9:16 pela
    // própria Meta, e recusar uma arte quadrada de story seria inventar regra.
    if (forma !== "story" && proporcao !== null) {
      if (proporcao < IMAGEM_PROPORCAO_MIN || proporcao > IMAGEM_PROPORCAO_MAX) return "proporcao_fora";
    }
  } else if (proporcao !== null) {
    if (proporcao < VIDEO_PROPORCAO_MIN || proporcao > VIDEO_PROPORCAO_MAX) return "proporcao_fora";
  }

  return null;
}

/** O teto de bytes que a META impõe para esta forma e esta mídia. */
function tetoDaMeta(forma: FormaDePublicacao, ehVideo: boolean): number {
  if (!ehVideo) return IMAGEM_BYTES_MAX;
  if (forma === "story") return STORY_BYTES_MAX;
  return REELS_BYTES_MAX;
}

/**
 * A frase que a tela mostra. É a ÚNICA fonte do texto de recusa — nenhuma
 * string destas mora em componente, porque a suíte não testa componente.
 */
export function textoDoProblema(p: ProblemaDoArquivo): string {
  switch (p) {
    case "tipo_nao_suportado":
      return "O Instagram só aceita JPEG para imagem e MP4 ou MOV para vídeo. Exporte neste formato e tente de novo.";
    case "grande_demais":
      return "O arquivo passa do tamanho que o Instagram aceita. Exporte uma versão menor.";
    // A FRASE QUE NOMEIA O NOSSO GARGALO. Ela diz que o arquivo está certo,
    // porque está — e quem lê precisa saber que o caminho é o plano, e não o
    // exportador.
    case "grande_para_o_bucket":
      return "O Instagram aceitaria este arquivo, mas o nosso plano de armazenamento não. Envie uma versão menor ou peça para liberar o plano maior.";
    case "curto_demais":
      return "O vídeo é curto demais: o mínimo é 3 segundos.";
    case "longo_demais":
      return "O vídeo é longo demais para esta forma de publicação. Reels vai até 15 minutos; story, até 60 segundos.";
    case "proporcao_fora":
      return "A proporção não é aceita nesta forma de publicação. No feed, a imagem vai de 4:5 (vertical) a 1.91:1 (horizontal).";
    case "estreito_demais":
      return "A imagem é estreita demais: a largura mínima é 320 pixels.";
  }
}

/** O que se pede à Meta para nascer um contêiner. */
export type PedidoDeContainer = {
  forma: FormaDePublicacao;
  url: string;
  legenda?: string;
  compartilharNoFeed?: boolean;
  nomeDoAudio?: string;
  filho?: boolean;
  /** O tipo da mídia, quando se sabe. Story aceita imagem E vídeo, e a Meta
   *  pede CHAVES DIFERENTES para cada um; sem isto, só a extensão da URL
   *  sobra para decidir. */
  mime?: string;
};

/**
 * Os parâmetros do `POST /media` para esta forma.
 *
 * ELA RECUSA ALTO em vez de montar um pedido que a Meta rejeita depois de dois
 * uploads: reels e story não entram em carrossel, e o contêiner PAI do
 * carrossel não nasce aqui — ele precisa da lista de filhos, que esta função
 * não recebe.
 */
export function parametrosDoContainer(pedido: PedidoDeContainer): Record<string, string> {
  if (pedido.forma === "carrossel") {
    throw new Error(
      "O container pai do carrossel nao nasce aqui: ele precisa da lista de filhos (children)."
    );
  }
  if (pedido.filho && pedido.forma !== "imagem") {
    // REELS NÃO ENTRA EM CARROSSEL — regra da Meta: vídeo em carrossel é vídeo
    // comum, sem `share_to_feed`, sem `audio_name` e sem capa. E story não é
    // item de feed nenhum.
    throw new Error(`A forma "${pedido.forma}" nao pode ser item de carrossel.`);
  }

  const p: Record<string, string> = {};

  // A CHAVE DA URL DEPENDE DA MÍDIA, e não da forma: story de imagem quer
  // `image_url`, story de vídeo quer `video_url`. Mandar a chave errada faz o
  // contêiner nascer errado.
  const ehVideo =
    pedido.forma === "reels" ? true : pedido.mime ? pedido.mime.startsWith("video/") : pareceVideo(pedido.url);
  p[ehVideo ? "video_url" : "image_url"] = pedido.url;

  // IMAGEM DE FEED NÃO MANDA `media_type` — a Meta o toma como IMAGE por
  // omissão, e mandá-lo explicitamente não é o que a referência descreve.
  if (pedido.forma === "reels") p.media_type = "REELS";
  if (pedido.forma === "story") p.media_type = "STORIES";

  if (pedido.filho) {
    // FILHO DE CARROSSEL NÃO LEVA LEGENDA NEM `media_type`. A legenda mora no
    // PAI, e repeti-la no filho é o erro natural de quem reaproveita a função.
    p.is_carousel_item = "true";
    return p;
  }

  const legenda = (pedido.legenda ?? "").trim();
  if (legenda) p.caption = legenda;

  // `share_to_feed` E `audio_name` SÓ VALEM EM REELS. Mandados em imagem ou
  // story, a Meta ignora calada — e calado é o que esta base não aceita.
  if (pedido.forma === "reels") {
    if (pedido.compartilharNoFeed) p.share_to_feed = "true";
    const audio = (pedido.nomeDoAudio ?? "").trim();
    if (audio) p.audio_name = audio;
  }

  return p;
}

/** O ÚLTIMO RECURSO para decidir imagem contra vídeo, quando o `mime` não veio.
 *  Extensão é palpite, e por isso ela é o degrau de baixo: quem tem o arquivo
 *  na mão tem o `mime`, e quem só tem a URL guardada no payload tem isto. */
function pareceVideo(url: string): boolean {
  const semQuery = url.split(/[?#]/)[0].toLowerCase();
  return [".mp4", ".mov", ".m4v", ".webm"].some((ext) => semQuery.endsWith(ext));
}

export type EstadoDoContainer = "esperando" | "pronto" | "erro" | "vencido" | "publicado";

/**
 * O `status_code` da Meta, traduzido.
 *
 * =============================================================================
 * ESTADO DESCONHECIDO É `erro`, E NUNCA `esperando`. É o caso mais importante
 * deste arquivo.
 *
 * Tratar o que não se conhece como "ainda processando" faria o item girar na
 * fila para sempre: cada passada gastaria uma tentativa, nenhuma terminaria, e
 * o dreno passaria a carregar um item que nunca sai. É exatamente a FOME DE
 * FILA que o envio em lote fechou em 01/09 (ver
 * `migrations/009-fila-estado-guardado.sql`), voltando por outra porta.
 *
 * `erro` é terminal e visível: o item vai para `failed` com motivo escrito, e
 * aparece na tela de Envios. Um estado que a Meta inventou amanhã é notícia,
 * não é espera.
 *
 * A COMPARAÇÃO NÃO É FROUXA: a Meta escreve em maiúsculas, e aceitar
 * "finished" seria inventar um contrato que ela não prometeu. O que não é uma
 * das cinco palavras exatas — inclusive objeto, número ou nulo — cai no ramo
 * seguro, sem estourar, porque quem chama é o dreno dentro do webhook.
 */
export function estadoDoContainer(bruto: unknown): EstadoDoContainer {
  switch (bruto) {
    case "FINISHED":
      return "pronto";
    case "IN_PROGRESS":
      return "esperando";
    case "EXPIRED":
      return "vencido";
    case "PUBLISHED":
      return "publicado";
    case "ERROR":
      return "erro";
    default:
      return "erro";
  }
}

/**
 * O que impede esta legenda de sair. `null` quando ela serve.
 *
 * A ORDEM É COMPRIMENTO, HASHTAG, MENÇÃO — e só uma frase pode aparecer na
 * tela. O comprimento vem primeiro porque é o que a contagem da tela já mostra
 * enquanto se digita: dizer "hashtags demais" para um texto de 3.000
 * caracteres esconderia o problema que a pessoa está vendo crescer.
 */
export function problemaDaLegenda(
  texto: string
): "longa" | "hashtags_demais" | "mencoes_demais" | null {
  if (texto.length > LEGENDA_CARACTERES_MAX) return "longa";
  if (contar(texto, /#[^\s#@]+/g) > LEGENDA_HASHTAGS_MAX) return "hashtags_demais";
  if (contar(texto, /@[^\s#@]+/g) > LEGENDA_MENCOES_MAX) return "mencoes_demais";
  return null;
}

function contar(texto: string, padrao: RegExp): number {
  return texto.match(padrao)?.length ?? 0;
}
