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

// ============================================================
// decisaoDeAssinatura — A DECISÃO INTEIRA DO CORPO QUE CHEGA EM
// `app/api/midia/assinar/route.ts`, movida para cá.
//
// A MEDIÇÃO QUE OBRIGOU, no plantio de 03/09/2026: apagar a validação inteira
// de dentro da rota (a chamada a `problemaDoArquivo` e as checagens ao redor)
// passava por lint, typecheck, os 1.081 testes puros, os 88 de integração e a
// varredura — TODOS VERDES. A rota não tinha rede nenhuma, e não podia ganhar
// uma: ela exige cookie de sessão, e forjar cookie é proibido nesta base (ver
// o cabeçalho de `testes-integracao/semear-requisicao.ts`). A porta do
// webhook resolveu o mesmo problema do mesmo jeito — ver `lib/webhook-messaging.ts`
// do começo — e é o exemplo que este arquivo segue: a decisão sai da fiação e
// vira função pura, com caso para cada saída.
//
// `FORMAS` e `numeroOuNada` vieram junto: elas são parte da decisão sobre o
// corpo, não da fiação que assina. A rota, depois deste corte, só faz sessão,
// conta pelo cookie, `req.json()`, chamar esta função e assinar.
// ============================================================

/** As quatro formas, escritas UMA vez, para a checagem de corpo vindo de fora
 *  (JSON desconhecido, e não a união de tipos do TypeScript, que não existe em
 *  tempo de execução). */
const FORMAS: readonly FormaDePublicacao[] = ["imagem", "reels", "story", "carrossel"];

/** Um número que veio de JSON e pode ser qualquer coisa. `undefined` quando
 *  não veio ou não é número — e não zero, que seria um arquivo de tamanho
 *  zero. A distinção é deliberada: `decisaoDeAssinatura` recusa os dois
 *  valores, mas por `if` diferentes, porque um significa "faltou dizer" e o
 *  outro significa "o número diz que não há arquivo". */
function numeroOuNada(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** O que `app/api/midia/assinar` deve responder para um corpo de requisição.
 *  `problema` só vem preenchido na recusa que passou por `problemaDoArquivo` —
 *  é o que permite a rota decidir se ecoa o `teto` junto, sem repetir a
 *  pergunta "qual foi o motivo?" na fiação. */
export type DecisaoDeAssinatura =
  | { ok: false; erro: string; status: 400; problema?: ProblemaDoArquivo }
  | { ok: true; forma: FormaDePublicacao; nome: string; arquivo: ArquivoDeclarado };

/**
 * A decisão inteira sobre o CORPO que chegou a `app/api/midia/assinar`: dado
 * um JSON desconhecido e o teto do bucket, o que a rota deve fazer.
 *
 * O TETO CONTINUA PARÂMETRO, pela mesma razão de `problemaDoArquivo` (ver o
 * cabeçalho dela): quem pergunta ao Supabase é `tetoDoBucket` (lib/bucket.ts),
 * que faz rede, e esta função continua pura.
 */
export function decisaoDeAssinatura(corpo: unknown, teto: number): DecisaoDeAssinatura {
  // O QUE CHEGA AQUI É `JSON.parse` DE UM CORPO EXTERNO: a única garantia é
  // que é JSON válido, não que é um objeto. `null`, lista, string e número são
  // JSON válidos, e SÓ `null` derrubava a rota antiga — `corpo.forma` em cima
  // de `null` estoura `TypeError` antes de qualquer checagem. `corpo ?? {}`
  // troca só `null`/`undefined` por um registro vazio; lista, string e número
  // passam batido, porque ler uma chave ausente deles já devolve `undefined`,
  // sem estourar — o MESMO efeito de um registro vazio. Por isso o
  // comportamento não muda para esses três, e só o de `null` deixa de
  // derrubar a rota.
  const registro = (corpo ?? {}) as Record<string, unknown>;

  const forma = registro.forma as FormaDePublicacao;
  if (!FORMAS.includes(forma)) {
    return { ok: false, erro: "Forma de publicacao desconhecida", status: 400 };
  }

  const nome = typeof registro.nome === "string" ? registro.nome : "";
  const mime = typeof registro.mime === "string" ? registro.mime : "";
  const bytes = numeroOuNada(registro.bytes);
  // ZERO NÃO É "AUSENTE" — `numeroOuNada` preserva essa distinção de
  // propósito (ver o comentário dela). Este `if` é quem de fato USA a
  // distinção: um arquivo declarado com `bytes: 0` TEM um número, e o número
  // diz que não há arquivo nenhum para subir. As duas causas caem na mesma
  // frase porque, para quem vê a tela, "não veio tamanho" e "veio tamanho
  // zero" pedem a mesma ação — declarar um arquivo de verdade.
  if (!mime || bytes === undefined || bytes === 0) {
    return { ok: false, erro: "Informe o tipo e o tamanho do arquivo", status: 400 };
  }

  const arquivo: ArquivoDeclarado = {
    mime,
    bytes,
    segundos: numeroOuNada(registro.segundos),
    largura: numeroOuNada(registro.largura),
    altura: numeroOuNada(registro.altura),
  };

  const problema = problemaDoArquivo(forma, arquivo, teto);
  if (problema) {
    // A FRASE VEM DE `textoDoProblema`, e não é escrita aqui: ela é a mesma
    // que a tela mostra antes do upload, e duas redações do mesmo "não"
    // fariam a pessoa achar que são dois problemas.
    return { ok: false, erro: textoDoProblema(problema), status: 400, problema };
  }

  return { ok: true, forma, nome, arquivo };
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

// =============================================================================
// O QUE O DRENO PRECISA DECIDIR, DECIDIDO AQUI
//
// `lib/queue-drain.ts` é `server-only`, roda dentro do webhook e NENHUM teste
// da suíte pura o executa. O cabeçalho dele conta os dois defeitos que essa
// cegueira já produziu — os dois com a suíte inteira verde, `tsc` e `eslint`
// limpos, e nenhum botão do produto funcionando em produção.
//
// O ramo da publicação chega com três leituras novas: a resposta do contêiner,
// a resposta da cota e o payload de volta. As três são DECISÃO, e por isso
// moram aqui, com um caso para cada saída. O que sobra lá é ida de rede e
// escrita no banco — fiação, sem nada para plantar.
// =============================================================================

/** Um número que veio da Meta, aceitando também o que veio como texto.
 *
 *  A META MANDA NÚMERO COMO TEXTO, e este produto já tropeçou nisso uma vez:
 *  `numeroOuNulo` (lib/steps.ts) nasceu porque o `code` de um erro veio
 *  `"230"`, entre aspas. `numeroOuNada`, logo acima, é mais estrita de
 *  propósito — ela lê o corpo do NOSSO navegador, onde número é número. */
function numeroDaMeta(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** O que a Meta respondeu sobre o contêiner, traduzido. */
export type LeituraDoContainer = {
  estado: EstadoDoContainer;
  /** A frase da Meta, quando ela explica um estado ruim. `null` no resto. */
  detalhe: string | null;
};

/**
 * Lê a resposta de `GET /{container-id}?fields=status_code,status`.
 *
 * O ESTADO SAI DE `estadoDoContainer`, e não de um `switch` novo: as cinco
 * palavras da Meta já têm um tradutor com caso de teste para cada saída, e o
 * caso mais importante dele — desconhecido é `erro`, e nunca `esperando` — não
 * pode existir em duas versões que envelheçam separado.
 *
 * O `detalhe` SÓ ACOMPANHA O ESTADO RUIM. A Meta manda `status` em todo estado
 * ("Finished", "In progress"), e repetir isso no motivo de um post que deu
 * certo seria ruído numa coluna que só se lê quando algo deu errado. No `erro`
 * é o contrário: é a frase que diz se o vídeo tem codec errado ou se a URL não
 * abriu, e sem ela o dono lê "a Meta recusou" e não tem o que fazer com isso.
 *
 * RESPOSTA QUE NÃO É OBJETO É `erro`, pelo mesmo motivo que a palavra
 * desconhecida é: a Meta ficando estranha é notícia, não é espera. Um item que
 * espera para sempre não aparece em tela nenhuma.
 */
export function leituraDoContainer(bruto: unknown): LeituraDoContainer {
  if (typeof bruto !== "object" || bruto === null) {
    return { estado: "erro", detalhe: null };
  }
  const r = bruto as Record<string, unknown>;
  const estado = estadoDoContainer(r.status_code);
  const frase = typeof r.status === "string" && r.status.trim() ? r.status.trim() : null;
  return {
    estado,
    detalhe: estado === "erro" || estado === "vencido" ? frase : null,
  };
}

/** A cota de publicação desta conta, como a Meta a informou. */
export type CotaDePublicacao = {
  usadas: number;
  total: number;
  janelaEmSegundos: number;
};

/**
 * Lê a resposta de `GET /{ig-user-id}/content_publishing_limit`.
 *
 * A FORMA É A MEDIDA em 03/09/2026, e não a da documentação:
 * `{"config":{"quota_total":100,"quota_duration":86400},"quota_usage":N}`.
 *
 * `null` É "NÃO DEU PARA SABER", E NÃO "PODE PUBLICAR" — a distinção é a mesma
 * de `checkFollowsAccount` (lib/ig.ts), que devolve `segue: null` em vez de
 * `false` justamente para ninguém confundir ignorância com resposta. Quem
 * chama trata as duas diferente: sem saber a cota, o dreno segue e deixa a
 * Meta recusar; o que ele não pode é inventar que a cota está livre e depois
 * usar o palpite como se fosse medição.
 *
 * SEM `quota_duration` A JANELA É A MEDIDA (86400), e não zero: dos três
 * números, ele é o único com valor conhecido e estável em toda medição — e um
 * zero aqui viraria um adiamento de zero segundo, que é o item girando na fila.
 */
export function cotaDePublicacao(bruto: unknown): CotaDePublicacao | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const r = bruto as Record<string, unknown>;
  const config =
    typeof r.config === "object" && r.config !== null
      ? (r.config as Record<string, unknown>)
      : null;
  if (!config) return null;
  const total = numeroDaMeta(config.quota_total);
  const usadas = numeroDaMeta(r.quota_usage);
  if (total === null || usadas === null) return null;
  const janela = numeroDaMeta(config.quota_duration);
  return {
    usadas,
    total,
    janelaEmSegundos: janela !== null && janela > 0 ? janela : JANELA_DA_COTA_EM_SEGUNDOS,
  };
}

/**
 * A cota acabou?
 *
 * A BORDA ENTRA: com `quota_total: 100`, a centésima publicação já gastou tudo,
 * e a de número 101 é a que a Meta recusa. Um `>` no lugar de `>=` faria o
 * produto tentar sempre uma a mais e colher um erro que ele podia ter evitado.
 *
 * COTA DESCONHECIDA NÃO É COTA ESTOURADA (ver `cotaDePublicacao`): recusar
 * publicar porque a leitura falhou transformaria uma indisponibilidade da Meta
 * num post que não sai.
 */
export function cotaEstourada(cota: CotaDePublicacao | null): boolean {
  if (!cota) return false;
  return cota.usadas >= cota.total;
}

/** O que o item de fila de publicação carrega. As chaves são as do `jsonb`. */
export type PayloadDaPublicacao = {
  forma: FormaDePublicacao;
  /** Os caminhos NO BUCKET, e não as URLs: a URL pública se monta a partir
   *  deles (`urlPublicaDoObjeto`, lib/bucket.ts), e guardar o caminho é o que
   *  permite APAGAR o objeto depois de publicar. */
  caminhos: string[];
  legenda?: string;
  compartilhar_no_feed?: boolean;
  nome_do_audio?: string;
  /** O contêiner que já nasceu, gravado pelo dreno. Ver `lerPayloadDaPublicacao`. */
  container_id?: string;
  /** Quantas vezes o dreno já perguntou o `status_code`. Ver o teto de cinco. */
  consultas?: number;
};

/** Monta o payload do item. No molde de `payloadDoLote` (lib/lote.ts). */
export function payloadDaPublicacao(pedido: {
  forma: FormaDePublicacao;
  caminhos: string[];
  legenda?: string;
  compartilharNoFeed?: boolean;
  nomeDoAudio?: string;
}): PayloadDaPublicacao {
  const legenda = (pedido.legenda ?? "").trim();
  const audio = (pedido.nomeDoAudio ?? "").trim();
  // O QUE É VAZIO NÃO VIRA CHAVE, e não é economia de bytes: uma `legenda: ""`
  // no payload é indistinguível de uma legenda que a pessoa apagou de
  // propósito, e `parametrosDoContainer` já trata as duas igual. Chave ausente
  // é a forma que não mente.
  return {
    forma: pedido.forma,
    caminhos: pedido.caminhos,
    ...(legenda ? { legenda } : {}),
    ...(pedido.compartilharNoFeed ? { compartilhar_no_feed: true } : {}),
    ...(audio ? { nome_do_audio: audio } : {}),
  };
}

/**
 * Lê o payload de volta. `null` quando não é um item de publicação.
 *
 * ELE RECUSA EM VEZ DE CONFIAR, e o motivo é o mesmo de `lerPayloadDoLote`
 * (lib/lote.ts): a coluna é `jsonb` e pode ser editada por fora do painel. Um
 * payload sem `caminhos` que atravessasse daqui viraria um `POST /media` com
 * `undefined` dentro, e o erro apareceria três passos depois da causa. Com
 * `null`, o dreno encerra o item com motivo escrito — e um desfecho errado
 * aparece na tela de Envios, enquanto "esperando para sempre" não aparece em
 * lugar nenhum.
 *
 * `containerId` É O QUE IMPEDE A SEGUNDA PASSADA DE CRIAR OUTRO CONTÊINER. Um
 * reels leva 32 segundos para ficar pronto (medido em 03/09), então a segunda
 * passada é o caso NORMAL, e não a exceção: sem esta chave, cada passada
 * criaria um contêiner novo, a Meta baixaria o vídeo de novo, e o teto de 400
 * contêineres por dia seria gasto por engano.
 *
 * `consultas` QUE NÃO É NÚMERO CONTA COMO ZERO, e isso é deliberado: o teto de
 * cinco passadas existe para o item não girar para sempre, e um valor
 * inventado no `jsonb` não pode nem travar o item (contando alto demais) nem
 * derrubar a leitura inteira. Zero é o valor que faz o teto voltar a contar do
 * começo — no pior caso, cinco passadas a mais.
 */
export function lerPayloadDaPublicacao(bruto: unknown): {
  forma: FormaDePublicacao;
  caminhos: string[];
  legenda?: string;
  compartilharNoFeed?: boolean;
  nomeDoAudio?: string;
  containerId: string | null;
  consultas: number;
} | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const p = bruto as Record<string, unknown>;
  const forma = p.forma as FormaDePublicacao;
  if (!FORMAS.includes(forma)) return null;
  if (!Array.isArray(p.caminhos) || !p.caminhos.length) return null;
  if (!p.caminhos.every((c) => typeof c === "string" && c)) return null;
  const consultas = numeroDaMeta(p.consultas);
  return {
    forma,
    caminhos: p.caminhos as string[],
    ...(typeof p.legenda === "string" && p.legenda ? { legenda: p.legenda } : {}),
    ...(p.compartilhar_no_feed === true ? { compartilharNoFeed: true } : {}),
    ...(typeof p.nome_do_audio === "string" && p.nome_do_audio
      ? { nomeDoAudio: p.nome_do_audio }
      : {}),
    containerId:
      typeof p.container_id === "string" && p.container_id ? p.container_id : null,
    consultas: consultas !== null && consultas >= 0 ? Math.floor(consultas) : 0,
  };
}
