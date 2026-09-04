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
export function problemaDaLegenda(texto: string): ProblemaDaLegenda | null {
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

// =============================================================================
// AS DECISÕES DA TELA DE COMPOR (Tarefa 5)
//
// A tela de publicar é a EXCEÇÃO declarada na especificação (§3): ela tem
// componente de cliente, porque o progresso do upload só existe se o navegador
// for quem envia o arquivo — e ele é, porque a Vercel recusa corpo acima de
// 4,5 MB (medido) e um reels vai a 300 MB. Não há versão em servidor deste
// recurso.
//
// ESTAS FUNÇÕES SÃO A MITIGAÇÃO INTEIRA DESSA EXCEÇÃO. A suíte não testa
// componente: o que ficar decidido dentro do JSX fica sem rede nenhuma — foi o
// que o plantio da rota de assinar mediu em 03/09 (ver `decisaoDeAssinatura`),
// e o que o plantio do Passo 6 desta tarefa mede de novo. Então a conversão, a
// frase de cada estado do envio, a hora do agendamento e a forma escolhida
// decidem-se AQUI, e o componente só desenha o que sai daqui.
//
// A regra prática, para quem mexer depois: um `if` sobre regra de negócio
// dentro do JSX está no lugar errado. O lugar é este arquivo.
// =============================================================================

/**
 * A qualidade com que o `canvas` grava o JPEG convertido.
 *
 * 0,9 É ESCOLHA, E O PORQUÊ VAI ESCRITO porque o `canvas` RE-COMPRIME: o
 * arquivo que sai daqui não é o que a pessoa exportou, e a perda é
 * irreversível — ela chega ao perfil público assim.
 *
 * O que entra aqui é ARTE, e não fotografia: peça montada em ferramenta de
 * design, com fundo chapado, texto e borda reta. É justamente o conteúdo em
 * que o JPEG erra mais cedo — a 0,8 aparece faixa ao redor de letra sobre cor
 * lisa, e quem montou a arte vê. A 0,9 isso some, e o custo é aceitável: uma
 * peça de 1440px a 0,9 fica na casa de 300–600 KB, muito abaixo dos 8 MB da
 * Meta e do teto do bucket.
 *
 * Acima de 0,9 o arquivo cresce rápido sem diferença que se enxergue — é pagar
 * banda por nada, e a banda aqui é a da pessoa que está enviando.
 */
export const QUALIDADE_DO_JPEG = 0.9;

/** A maior largura que vale a pena subir. Acima de 1440 a Meta REDUZ sozinha
 *  (ver `IMAGEM_LARGURA_MIN`, lá em cima): os pixels a mais são bytes que
 *  sobem, atravessam o bucket e são jogados fora do outro lado. */
const CONVERSAO_LARGURA_MAX = 1440;

/** O que o `canvas` sabe redesenhar SEM inventar. GIF e SVG ficam de fora de
 *  propósito: um GIF "convertido" viraria um quadro parado sem ninguém ter
 *  pedido isso, e SVG não tem pixel — os dois seguem direto para a recusa de
 *  `problemaDoArquivo`, que nomeia o formato. */
const MIMES_QUE_O_CANVAS_CONVERTE = ["image/png", "image/jpeg", "image/webp"];

/** O que o enviador faz com o arquivo antes de subir. `converter: false` é o
 *  arquivo indo cru, byte por byte, como a pessoa o exportou. */
export type PlanoDaConversao =
  | { converter: false }
  | { converter: true; largura: number; altura: number; qualidade: number };

/**
 * O que fazer com este arquivo antes de enviá-lo.
 *
 * =============================================================================
 * JPEG QUE JÁ SERVE NÃO PASSA PELO CANVAS, E ISSO É DECISÃO
 *
 * O `canvas` re-comprime sempre — não existe "redesenhar sem perder". Passar
 * por ele um JPEG que já está dentro das regras é perda de qualidade sem ganho
 * nenhum, em cima de toda arte que chegou certa. Converter "por via das
 * dúvidas" degradaria justamente o caso bom.
 *
 * Acima de 1440px converte até JPEG, porque aí a conversão não é de FORMATO, é
 * de TAMANHO: são bytes que não precisam subir.
 *
 * =============================================================================
 * E O CANVAS DESCARTA A TRANSPARÊNCIA — quem converte tem de pintar antes
 *
 * PNG com fundo transparente desenhado num `canvas` recém-criado vira JPEG com
 * fundo PRETO, porque o JPEG não tem canal alfa e o `canvas` começa
 * transparente. Quem consome este plano (`app/publicar/enviador.tsx`) preenche
 * o retângulo de branco ANTES do `drawImage` — está escrito lá, com este mesmo
 * aviso. É a armadilha nº 1 desta conversão, e ela não aparece em teste
 * nenhum: o sintoma é um post com moldura preta no perfil público.
 *
 * SEM MEDIDA NÃO HÁ REDIMENSIONAMENTO, MAS AINDA HÁ CONVERSÃO DE FORMATO: o
 * navegador entrega `naturalWidth: 0` enquanto a imagem não carregou, e cravar
 * zero no `canvas` daria um arquivo de zero pixel. Quem chama usa o tamanho
 * natural da imagem quando estes vierem zerados.
 */
export function planoDaConversao(arq: {
  mime: string;
  largura?: number;
  altura?: number;
}): PlanoDaConversao {
  if (!MIMES_QUE_O_CANVAS_CONVERTE.includes(arq.mime)) return { converter: false };

  const largura = arq.largura ?? 0;
  const altura = arq.altura ?? 0;
  const grandeDemais = largura > CONVERSAO_LARGURA_MAX;

  // O JPEG SÓ ENTRA NO CANVAS PARA ENCOLHER. Formato ele já tem.
  if (arq.mime === "image/jpeg" && !grandeDemais) return { converter: false };

  if (largura <= 0 || altura <= 0) {
    return { converter: true, largura: 0, altura: 0, qualidade: QUALIDADE_DO_JPEG };
  }

  if (!grandeDemais) {
    return { converter: true, largura, altura, qualidade: QUALIDADE_DO_JPEG };
  }

  // A ALTURA ACOMPANHA, ARREDONDADA: meio pixel não existe no `canvas`, e um
  // `height` fracionário vira medida truncada com faixa transparente na borda
  // — que, depois do JPEG, é faixa preta.
  return {
    converter: true,
    largura: CONVERSAO_LARGURA_MAX,
    altura: Math.round((altura * CONVERSAO_LARGURA_MAX) / largura),
    qualidade: QUALIDADE_DO_JPEG,
  };
}

/**
 * O nome do arquivo depois de convertido.
 *
 * O NOME VIAJA ATÉ O CAMINHO NO BUCKET: `caminhoDoObjeto` (lib/bucket.ts) lê a
 * EXTENSÃO dele para nomear o objeto, e o que não está na lista dela vira
 * ".bin". Um PNG convertido que chegasse lá ainda chamando-se "arte.png"
 * viraria um objeto ".bin", e a URL que a META vai buscar terminaria em ".bin"
 * — conteúdo certo, nome errado, que é o tipo de defeito que só aparece do
 * outro lado.
 *
 * NOME VAZIO NÃO VIRA SÓ UM PONTO: trocar a extensão de `""` daria `".jpg"`,
 * um objeto sem nome no bucket.
 */
export function nomeDepoisDaConversao(nome: string): string {
  const limpo = nome.trim();
  if (!limpo) return "imagem.jpg";
  const ponto = limpo.lastIndexOf(".");
  // `ponto > 0`, e não `>= 0`: um nome que COMEÇA com ponto não tem extensão,
  // ele tem um nome que começa com ponto.
  const base = ponto > 0 ? limpo.slice(0, ponto) : limpo;
  return `${base}.jpg`;
}

// -----------------------------------------------------------------------------
// O ENVIO DE UM ARQUIVO, E AS FRASES DELE
// -----------------------------------------------------------------------------

/** Onde um arquivo está no caminho até o bucket. Os três últimos são
 *  terminais: depois deles nada mais acontece com aquele arquivo. */
export type EstadoDoEnvio =
  | "escolhido"
  | "convertendo"
  | "assinando"
  | "enviando"
  | "pronto"
  | "recusado"
  | "falhou";

/** Um arquivo a caminho do bucket, como o enviador o conhece. `detalhe` é o
 *  motivo, quando existe — e ele vem de `textoDoProblema`, e não de string
 *  escrita no componente. */
export type EnvioEmAndamento = {
  nome: string;
  estado: EstadoDoEnvio;
  /** Bytes já aceitos pelo servidor. Vem de `upload.onprogress`. */
  enviados: number;
  /** Bytes do arquivo. ZERO quando o `progress` veio com
   *  `lengthComputable: false` — ver `porcentagemDoEnvio`. */
  total: number;
  detalhe?: string;
};

/** Os estados em que aquele arquivo já não anda mais. */
const ESTADOS_TERMINAIS: readonly EstadoDoEnvio[] = ["pronto", "recusado", "falhou"];
/** Os estados em que o arquivo não chegou ao bucket, e não vai chegar. */
const ESTADOS_DE_FALHA: readonly EstadoDoEnvio[] = ["recusado", "falhou"];

/**
 * A largura da barra deste arquivo, de 0 a 100.
 *
 * O ESTADO MANDA MAIS QUE OS BYTES, nos dois sentidos, e cada um tem motivo:
 *
 * `pronto` é 100 mesmo com os bytes atrasados. O último `progress` do
 * `XMLHttpRequest` costuma chegar antes do `load`, e uma barra parada em 99%
 * depois de o arquivo estar no bucket é a tela mentindo por arredondamento.
 *
 * `falhou` NÃO enche a barra: ela para onde parou. Barra cheia num envio que
 * não foi é a comemoração errada — a mesma doença que o conserto de 02/09
 * curou nas cinco ações que recusavam em silêncio.
 *
 * TOTAL ZERO É ZERO, E NUNCA NaN. `XMLHttpRequest` dispara `progress` com
 * `lengthComputable: false` quando não sabe o tamanho, e `0/0` numa largura de
 * CSS é uma barra que some da tela sem ninguém entender por quê.
 *
 * O ARREDONDAMENTO É PARA BAIXO, de propósito: 99,6% viraria "100" com
 * `Math.round`, e a barra diria "acabou" antes de acabar. Cheia, só por
 * `pronto`.
 */
export function porcentagemDoEnvio(envio: EnvioEmAndamento): number {
  if (envio.estado === "pronto") return 100;
  if (!(envio.total > 0)) return 0;
  const bruta = Math.floor((envio.enviados / envio.total) * 100);
  return Math.min(100, Math.max(0, bruta));
}

/**
 * A frase deste arquivo, na janelinha de progresso.
 *
 * NENHUMA DESTAS STRINGS MORA NO COMPONENTE, e é o ponto inteiro deste bloco:
 * a suíte não testa componente, então texto escrito lá é texto sem rede. Aqui
 * há um caso para cada um dos sete estados, e o teste prende que nenhum é
 * vazio — um estado novo acrescentado sem frase acusa.
 *
 * O NOME DO ARQUIVO APARECE SEMPRE: com dois envios em andamento, a frase sem
 * nome não diz de qual arquivo ela fala.
 *
 * O MOTIVO ENTRA QUANDO EXISTE. "Falhou" sozinho não diz o que fazer, e o
 * motivo é justamente o que `textoDoProblema` já sabe escrever — quem chama
 * passa a frase de lá em `detalhe`, em vez de redigir a própria.
 */
export function fraseDoEnvio(envio: EnvioEmAndamento): string {
  const detalhe = (envio.detalhe ?? "").trim();
  const fim = detalhe ? ` ${detalhe}` : "";
  switch (envio.estado) {
    case "escolhido":
      return `${envio.nome}: na fila para enviar.${fim}`;
    case "convertendo":
      return `${envio.nome}: preparando a imagem para o formato do Instagram…${fim}`;
    case "assinando":
      return `${envio.nome}: pedindo a permissão de envio…${fim}`;
    case "enviando":
      return `${envio.nome}: enviando, ${porcentagemDoEnvio(envio)}%…${fim}`;
    case "pronto":
      return `${envio.nome}: enviado.${fim}`;
    case "recusado":
      return `${envio.nome}: este arquivo não serve.${fim}`;
    case "falhou":
      return `${envio.nome}: o envio não foi.${fim}`;
  }
}

/** O que a janelinha do canto mostra. `linhas` é uma frase por arquivo, na
 *  ordem em que eles foram escolhidos. */
export type ResumoDoProgresso = {
  titulo: string;
  porcentagem: number;
  /** Nenhum arquivo anda mais. NÃO quer dizer que deu certo — ver `houveFalha`. */
  encerrado: boolean;
  houveFalha: boolean;
  linhas: string[];
};

/**
 * O conjunto dos envios, resumido para a janelinha do canto.
 *
 * SEM ENVIO NÃO HÁ MODAL: `null` é o que faz a janelinha não existir na tela de
 * quem não está enviando nada — inclusive nas outras telas, já que ela mora no
 * `app-shell` para sobreviver à navegação.
 *
 * =============================================================================
 * A PORCENTAGEM DO CONJUNTO É PESADA POR BYTES, e não a média das barras
 *
 * Um reels de 200 MB ao lado de uma capa de 200 KB: pela média das barras, a
 * janelinha saltaria para "50%" assim que a capa terminasse — em dois segundos
 * — e ficaria lá parada por minutos. Pesada por bytes, ela anda junto com o que
 * de fato está subindo.
 *
 * =============================================================================
 * FALHA NÃO SOME, E ENCERRADO NÃO É SUCESSO
 *
 * Um envio que não foi não pode desaparecer da janelinha como se tivesse ido —
 * é a mesma regra de `avisoDoLoteEnviado` (lib/avisos.ts): o desfecho ruim é o
 * que mais precisa aparecer. Por isso `encerrado` e `houveFalha` são DOIS
 * campos: o primeiro diz que ninguém mais anda, o segundo diz se valeu.
 *
 * E ENQUANTO UM ANDA, O CONJUNTO NÃO ESTÁ ENCERRADO — nem que outro já tenha
 * falhado. Encerrar cedo fecharia a janelinha em cima de um upload vivo.
 */
export function resumoDoProgresso(envios: EnvioEmAndamento[]): ResumoDoProgresso | null {
  if (!envios.length) return null;

  const total = envios.reduce((soma, e) => soma + Math.max(0, e.total), 0);
  const feitos = envios.reduce(
    (soma, e) => soma + (porcentagemDoEnvio(e) / 100) * Math.max(0, e.total),
    0
  );
  // TOTAL ZERO É ZERO AQUI TAMBÉM, pelo mesmo motivo de `porcentagemDoEnvio`:
  // ninguém declarou tamanho ainda, e uma barra NaN some da tela.
  const porcentagem = total > 0 ? Math.min(100, Math.floor((feitos / total) * 100)) : 0;

  const encerrado = envios.every((e) => ESTADOS_TERMINAIS.includes(e.estado));
  const falharam = envios.filter((e) => ESTADOS_DE_FALHA.includes(e.estado)).length;

  return {
    titulo: tituloDoProgresso(encerrado, falharam, envios.length),
    porcentagem,
    encerrado,
    houveFalha: falharam > 0,
    linhas: envios.map(fraseDoEnvio),
  };
}

/** O título da janelinha. A PALAVRA "CONCLUÍDO" SÓ APARECE QUANDO TUDO SUBIU —
 *  um conjunto que encerrou com falha se anuncia pela falha, e não pelo fim. */
function tituloDoProgresso(encerrado: boolean, falharam: number, quantos: number): string {
  if (!encerrado) {
    return quantos === 1 ? "Enviando o arquivo…" : `Enviando ${quantos} arquivos…`;
  }
  if (falharam > 0) {
    if (falharam === quantos) {
      return quantos === 1 ? "O arquivo não subiu." : "Nenhum arquivo subiu.";
    }
    return `${falharam} de ${quantos} não ${falharam === 1 ? "subiu" : "subiram"}.`;
  }
  return quantos === 1 ? "Envio concluído." : "Envios concluídos.";
}

// -----------------------------------------------------------------------------
// O QUE A TELA MANDA, LIDO COM DESCONFIANÇA
//
// O que chega à ação de servidor vem de `FormData`, ou seja de um formulário
// que é do usuário. As funções abaixo leem esses campos do mesmo jeito que
// `decisaoDeAssinatura` lê o corpo da rota: recusando o que não se entende, e
// nunca adivinhando.
// -----------------------------------------------------------------------------

/**
 * A forma que ESTA TELA sabe publicar, lida de um campo de formulário.
 *
 * CARROSSEL É DA TAREFA 6, E A TELA NÃO O OFERECE — mas o campo é do usuário, e
 * um `<select>` alterado no navegador manda o que quiser. Aceitá-lo aqui
 * gravaria um item de fila que o dreno já recusa ("o carrossel ainda nao
 * publica por aqui", lib/queue-drain.ts): um post que nasce morto, DEPOIS de o
 * arquivo ter subido e ocupado o bucket. A recusa é alta, antes de gravar nada.
 *
 * A COMPARAÇÃO NÃO É FROUXA ("IMAGEM" não passa) pelo mesmo motivo de
 * `estadoDoContainer`: aceitar variação que ninguém prometeu é inventar
 * contrato — e o `<select>` da tela manda minúsculas.
 */
export function formaQueATelaPublica(bruto: unknown): FormaDePublicacao | null {
  if (bruto !== "imagem" && bruto !== "reels" && bruto !== "story") return null;
  return bruto;
}

/** Os cinco números de uma data e hora escolhidas na tela. */
export type CamposDaDataHora = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
};

/** O que o `<input type="datetime-local">` manda: `2026-09-10T14:30`, com os
 *  segundos opcionais porque alguns navegadores os incluem. */
const DATA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

/**
 * Lê o campo de data e hora. `null` quando não dá para entender.
 *
 * =============================================================================
 * DIA QUE NÃO EXISTE NÃO VIRA DATA, E É POR ISSO QUE ESTA FUNÇÃO EXISTE
 *
 * `Date.UTC(2026, 1, 30)` não estoura: ele TRANSBORDA, calado, para 2 de março.
 * É o mesmo cuidado que `validadeDoDia` (lib/lote.ts) documenta — só que lá o
 * transbordo movia um PRAZO, e aqui ele move a HORA em que um post aparece no
 * perfil público. Quem digitasse 30 de fevereiro por engano veria o post sair
 * num dia que não escolheu.
 *
 * A conferência é a volta pelo `Date`: monta-se a data e pergunta-se se o ano,
 * o mês e o dia continuam os mesmos. Se transbordou, não continuam.
 *
 * OS SEGUNDOS, QUANDO VÊM, NÃO ATRAPALHAM, e são descartados: o campo tem
 * resolução de minuto, e recusar por causa de um `:00` que o próprio HTML
 * permite seria um agendamento que não sai por detalhe de navegador.
 */
export function camposDaDataHora(bruto: unknown): CamposDaDataHora | null {
  if (typeof bruto !== "string") return null;
  const m = DATA_HORA.exec(bruto.trim());
  if (!m) return null;

  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const hora = Number(m[4]);
  const minuto = Number(m[5]);

  if (mes < 1 || mes > 12) return null;
  if (dia < 1 || dia > 31) return null;
  if (hora > 23) return null;
  if (minuto > 59) return null;

  // O TRANSBORDO SÓ APARECE NA VOLTA. Ver o cabeçalho.
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }

  return { ano, mes, dia, hora, minuto };
}

/** Por que um pedido de publicação não tem hora. */
export type MotivoDoMomento = "quando_ilegivel" | "data_invalida" | "data_no_passado";

/** Quando publicar: `null` é agora. */
export type MomentoDaPublicacao =
  | { ok: true; quando: Date | null }
  | { ok: false; motivo: MotivoDoMomento };

/**
 * A TOLERÂNCIA DE UM MINUTO É O CAMPO, e não generosidade.
 *
 * O `datetime-local` tem resolução de MINUTO: quem escolhe "12:00" e confirma
 * às 12:00:30 manda um instante 30 segundos no passado. Sem esta folga, a tela
 * recusaria o pedido mais comum que existe — "publicar neste minuto".
 */
const TOLERANCIA_DO_MINUTO_EM_MS = 60_000;

/**
 * Quando este post deve sair.
 *
 * =============================================================================
 * O CAMPO ILEGÍVEL NÃO CAI EM "AGORA", E ESTE É O CASO MAIS IMPORTANTE DAQUI
 *
 * Publicar AGORA quando a pessoa pediu para agendar é IRREVERSÍVEL:
 * `DELETE /{ig-media-id}` NÃO existe no Login do Instagram (medido em 03/09 —
 * é exclusivo da API via Login do Facebook), então o post fica no perfil de
 * 2.933 publicações até alguém apagá-lo à mão pelo celular. Some do feed, não
 * some da memória de quem viu.
 *
 * Um pedido que não se entende é RECUSADO, nunca adivinhado. É a mesma regra do
 * "presente-e-vazio contra ausente" que o Crítico de 01/09 deixou nesta base: o
 * padrão silencioso é o que morde.
 *
 * =============================================================================
 * DIA PASSADO NÃO É ADIANTAMENTO
 *
 * `enqueuePublicacao` (lib/engine.ts) trata atraso negativo como zero — ou
 * seja, o post agendado para ontem sairia NA HORA. Quem escolheu a data errada
 * publicaria agora, no perfil público, sem desfazer. Recusar aqui é o que
 * transforma um engano de digitação num aviso, em vez de num post.
 */
export function momentoDaPublicacao(
  quando: unknown,
  instante: number | null | undefined,
  agora: number
): MomentoDaPublicacao {
  if (quando === "agora") return { ok: true, quando: null };
  if (quando !== "depois") return { ok: false, motivo: "quando_ilegivel" };

  if (typeof instante !== "number" || !Number.isFinite(instante)) {
    return { ok: false, motivo: "data_invalida" };
  }
  if (instante < agora - TOLERANCIA_DO_MINUTO_EM_MS) {
    return { ok: false, motivo: "data_no_passado" };
  }
  return { ok: true, quando: new Date(instante) };
}

/** O que impede uma legenda de sair, nomeado. */
export type ProblemaDaLegenda = "longa" | "hashtags_demais" | "mencoes_demais";

/**
 * A frase de um problema de legenda.
 *
 * A TELA E A AÇÃO DIZEM A MESMA COISA, e é para isso que ela existe: duas
 * redações do mesmo "não" fazem quem lê achar que são dois problemas
 * diferentes. É o mesmo motivo pelo qual `decisaoDeAssinatura` usa
 * `textoDoProblema` em vez de escrever a própria frase.
 *
 * CADA FRASE DIZ O NÚMERO. "Hashtags demais" sem o limite não diz quantas
 * tirar, e quem está com 34 fica adivinhando.
 */
export function textoDoProblemaDaLegenda(p: ProblemaDaLegenda): string {
  switch (p) {
    case "longa":
      return "A legenda passa de 2.200 caracteres, que é o limite do Instagram. Encurte o texto.";
    case "hashtags_demais":
      return "A legenda tem mais de 30 hashtags, e o Instagram não aceita além disso. Tire as que sobram.";
    case "mencoes_demais":
      return "A legenda tem mais de 20 menções, e o Instagram não aceita além disso. Tire as que sobram.";
  }
}

// -----------------------------------------------------------------------------
// O QUE A AÇÃO DE SERVIDOR PRECISA DECIDIR (app/publicar/actions.ts)
//
// A ação não pode ter saída muda — o conserto de 02/09 fechou isso em cinco
// ações e este projeto não reabre. Toda recusa dela sai por `redirect` com
// aviso, e o texto do aviso vem daqui, nunca de string escrita na ação.
// -----------------------------------------------------------------------------

/** Por que um pedido de publicação não vira item de fila. Os três primeiros
 *  são os de `momentoDaPublicacao`, reaproveitados de propósito: a ação repassa
 *  o motivo dela sem traduzir no meio do caminho. */
export type RecusaDaPublicacao =
  | MotivoDoMomento
  | "sem_conta"
  | "sem_arquivo"
  | "forma_desconhecida"
  | "ja_enfileirado";

/** A frase de cada recusa da ação. No molde de `textoDaRecusaDoLote`
 *  (lib/avisos.ts): um caso por motivo, e o `switch` sem `default` faz o
 *  TypeScript acusar o motivo novo que alguém acrescentar sem frase. */
export function textoDaRecusaDaPublicacao(motivo: RecusaDaPublicacao): string {
  switch (motivo) {
    case "sem_conta":
      return "Nenhuma conta do Instagram está selecionada. Conecte ou escolha uma conta antes de publicar.";
    // O ARQUIVO É O QUE FALTA COM MAIS FREQUÊNCIA, e o motivo é a forma da
    // tela: o envio ao bucket acontece ANTES do botão, e quem clica cedo
    // demais chega aqui sem caminho nenhum.
    case "sem_arquivo":
      return "Escolha um arquivo e espere o envio terminar antes de publicar.";
    case "forma_desconhecida":
      return "Escolha entre imagem, reels e story. O carrossel ainda não publica por aqui.";
    case "quando_ilegivel":
      return "Diga se a publicação sai agora ou em outra hora. O pedido não foi entendido, e nada foi publicado.";
    case "data_invalida":
      return "A data e a hora escolhidas não formam um dia que existe. Confira e tente de novo.";
    case "data_no_passado":
      return "A hora escolhida já passou. Escolha um horário à frente — publicar agora é a outra opção, e ela é a que não dá para desfazer.";
    case "ja_enfileirado":
      return "Este arquivo já está na fila de publicação. Nada foi duplicado.";
  }
}

/**
 * Os caminhos do bucket que o formulário mandou, um por linha.
 *
 * =============================================================================
 * ESTE CAMPO É DO USUÁRIO, E ELE DECIDE QUAL OBJETO VAI AO PERFIL PÚBLICO
 *
 * O `<input type="hidden">` é escrito pelo enviador, no navegador — e o
 * navegador é do usuário. Quem trocar o valor à mão escolhe QUALQUER caminho do
 * bucket para publicar, inclusive um da pasta de outra conta: é o "post da
 * conta A saindo pela conta B" que `alvoDoLote` fecha no envio em lote, aqui
 * pela porta do arquivo.
 *
 * Por isso a `pasta` é PARÂMETRO e a conferência é feita: quem chama passa a
 * pasta da conta do COOKIE de seleção (`pastaDaConta`, lib/bucket.ts), nunca a
 * que veio do formulário. O que não estiver dentro dela é descartado.
 *
 * A FORMA TAMBÉM É CONFERIDA (`pasta/identificador.extensao`, e nada de "..")
 * porque este texto vira parte de uma URL pública que a Meta vai buscar. É a
 * mesma desconfiança de `caminhoDoObjeto`, do outro lado do caminho.
 */
export function caminhosDoCampo(bruto: unknown, pasta: string): string[] {
  if (typeof bruto !== "string" || !pasta) return [];
  return bruto
    .split("\n")
    .map((c) => c.trim())
    .filter((c) => c.startsWith(`${pasta}/`) && FORMA_DO_CAMINHO.test(c));
}

/** `pasta/identificador.extensao`, e nada além. Sem barra a mais (que
 *  inventaria um segmento), sem ".." (que subiria de pasta), sem caractere que
 *  precise ser escapado na URL que a Meta vai buscar. */
const FORMA_DO_CAMINHO = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.[a-z0-9]+$/;

/**
 * O fuso do navegador, como `Date.prototype.getTimezoneOffset()` o escreve:
 * MINUTOS A SOMAR ao horário local para chegar ao UTC. Brasília é 180.
 *
 * O PADRÃO É O DO PAINEL, e ele é piso e não palpite: quem usa este painel está
 * no Brasil, e o Brasil não tem horário de verão desde 2019 — o deslocamento é
 * -03:00 o ano inteiro. E o campo só chega vazio num navegador que não rodou
 * JavaScript; nesse navegador o arquivo também não subiu, então a ação recusa
 * antes por `sem_arquivo` e este valor nem é usado.
 *
 * O LIMITE DE 900 MINUTOS (15 horas) é mais largo que qualquer fuso real
 * (±14h): ele não julga fuso, ele descarta número inventado que jogaria a
 * publicação para outro dia.
 */
export const FUSO_DO_PAINEL_EM_MINUTOS = 180;

export function fusoDoCampo(bruto: unknown): number {
  if (typeof bruto !== "string" || !bruto.trim()) return FUSO_DO_PAINEL_EM_MINUTOS;
  const n = Number(bruto);
  if (!Number.isFinite(n) || Math.abs(n) > 900) return FUSO_DO_PAINEL_EM_MINUTOS;
  return Math.trunc(n);
}

/**
 * O instante, em milissegundos, de uma data e hora escolhidas num fuso.
 *
 * O CAMPO `datetime-local` NÃO TEM FUSO, e essa é a armadilha inteira: ele
 * manda "2026-09-10T14:30" e cala sobre onde são 14:30. Lido no servidor da
 * Vercel, que roda em UTC, esse texto viraria 14:30 UTC — 11:30 em Brasília, e
 * o post sairia TRÊS HORAS ANTES do que a pessoa marcou.
 *
 * Por isso o fuso vem do navegador (ver `fusoDoCampo`) e a conta é feita aqui,
 * uma vez, com teste — e não espalhada por um `-3h` escrito na ação, que é o
 * jeito de o erro sobreviver a uma mudança de fuso.
 *
 * `camposDaDataHora` JÁ RECUSOU O DIA QUE NÃO EXISTE antes de chegar aqui, e é
 * por isso que esta função pode usar `Date.UTC` sem medo do transbordo.
 */
export function instanteDoAgendamento(campos: CamposDaDataHora, fusoEmMinutos: number): number {
  return (
    Date.UTC(campos.ano, campos.mes - 1, campos.dia, campos.hora, campos.minuto) +
    fusoEmMinutos * 60_000
  );
}

/**
 * O que o `<input type="file">` oferece no seletor do sistema, por forma.
 *
 * ELE NÃO É UMA BARREIRA — o `accept` é uma sugestão que qualquer um contorna
 * escolhendo "todos os arquivos". Quem recusa de verdade é `problemaDoArquivo`,
 * no navegador e de novo no servidor. O que ele faz é poupar a pessoa de
 * atravessar a pasta inteira para descobrir depois que o AVI não serve.
 *
 * ESTÁ AQUI, E NÃO NO JSX, pelo mesmo motivo que todo o resto deste bloco: é a
 * lista de formatos que a Meta aceita, ou seja regra de negócio, e uma segunda
 * cópia dela dentro do componente envelheceria calada no dia em que a Meta
 * aceitasse um formato novo.
 */
export function tiposQueOCampoAceita(forma: FormaDePublicacao): string {
  if (forma === "reels") return MIMES_DE_VIDEO.join(",");
  if (forma === "imagem") {
    // O CAMPO DE IMAGEM ACEITA MAIS DO QUE A META, de propósito: PNG e WEBP
    // entram porque `planoDaConversao` os CONVERTE para JPEG antes de subir.
    // Bloqueá-los aqui recusaria justamente o formato mais comum de quem monta
    // arte, num caso em que o produto sabe resolver sozinho.
    return [...MIMES_DE_IMAGEM, "image/png", "image/webp"].join(",");
  }
  // Story aceita as duas mídias, e a conversão vale para a imagem dele igual.
  return [...MIMES_DE_IMAGEM, "image/png", "image/webp", ...MIMES_DE_VIDEO].join(",");
}
