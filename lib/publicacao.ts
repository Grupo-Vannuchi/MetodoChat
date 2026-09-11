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

/**
 * O teto de bytes que a META impõe para esta forma e esta mídia.
 *
 * ABERTO E DECLARADO: VÍDEO DE CARROSSEL CAI NO RAMO DO REELS, aqui (300 MB) e
 * no bloco de duração acima (3 s a 15 min). Vídeo em carrossel é vídeo COMUM —
 * é a própria regra que `parametrosDoContainer` aplica ao recusar `share_to_feed`
 * e `audio_name` no filho —, e os limites DELE não foram medidos em lugar nenhum
 * desta branch.
 *
 * NÃO FOI CONSERTADO PORQUE O CONSERTO PEDE NÚMERO, e número aqui só vale
 * medido: os desta função vieram todos da referência da Meta lida em 03/09/2026
 * (ver o bloco no topo do arquivo), e inventar um teto mais apertado recusaria
 * arquivo bom sem que ninguém saiba por quê. Enquanto isso, metade do risco está
 * mascarada pelo teto do PRÓPRIO bucket, que é de 50 MB e vem antes.
 *
 * MESMA FAMÍLIA DO ITEM ABERTO Nº 1 do plano.
 */
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
  if (pedido.forma === "carrossel" && !pedido.filho) {
    // SEM `filho: true`, PEDIR "carrossel" É PEDIR O PAI — e o pai precisa da
    // lista de `children`, que esta função não recebe. Quem o monta é
    // `parametrosDoContainerPai`.
    throw new Error(
      "O container pai do carrossel nao nasce aqui: ele precisa da lista de filhos (children)."
    );
  }
  if (pedido.filho && pedido.forma !== "imagem" && pedido.forma !== "carrossel") {
    // REELS NÃO ENTRA EM CARROSSEL — regra da Meta: vídeo em carrossel é vídeo
    // comum, sem `share_to_feed`, sem `audio_name` e sem capa. E story não é
    // item de feed nenhum.
    throw new Error(`A forma "${pedido.forma}" nao pode ser item de carrossel.`);
  }

  const p: Record<string, string> = {};

  // A CHAVE DA URL DEPENDE DA MÍDIA, e não da forma: story de imagem quer
  // `image_url`, story de vídeo quer `video_url`. Mandar a chave errada faz o
  // contêiner nascer errado.
  const ehVideo = pedido.forma === "reels" ? true : pareceVideo(pedido.url);
  p[ehVideo ? "video_url" : "image_url"] = pedido.url;

  // IMAGEM DE FEED NÃO MANDA `media_type` — a Meta o toma como IMAGE por
  // omissão, e mandá-lo explicitamente não é o que a referência descreve.
  if (pedido.forma === "reels") p.media_type = "REELS";
  if (pedido.forma === "story") p.media_type = "STORIES";

  if (pedido.filho) {
    // ===========================================================================
    // FILHO DE CARROSSEL NÃO LEVA LEGENDA — ela mora no PAI, e repeti-la aqui é
    // o erro natural de quem reaproveita a função. ESSA METADE ESTÁ CERTA.
    //
    // A OUTRA METADE — "filho não leva `media_type`" — ERA UMA REGRA GERAL QUE
    // NÃO É GERAL, e ela derrubava todo carrossel com vídeo em produção. Ela foi
    // generalizada a partir do único caso que alguém tinha testado: o de imagem.
    //
    // MEDIDO EM 10/09/2026 contra @vannuchi.eng, criando contêineres sem
    // publicar:
    //
    //   filho imagem, sem `media_type`      FINISHED
    //   filho vídeo, sem `media_type`       HTTP 400, code=100,
    //                                       "The parameter image_url is required"
    //   filho vídeo, `media_type=VIDEO`     FINISHED
    //   filho vídeo, `media_type=REELS`     FINISHED
    //   pai CAROUSEL, imagem + vídeo        FINISHED
    //
    // SEM `media_type`, A META TRATA O FILHO COMO IMAGEM e exige `image_url` —
    // e nós mandamos `video_url`. O custo do defeito era o pior que existe: o
    // 400 só chegava DEPOIS do upload inteiro, na cara de quem tentou.
    //
    // `VIDEO`, E NÃO `REELS`, embora os dois tenham sido medidos FINISHED: vídeo
    // em carrossel é vídeo COMUM — é a mesma regra que esta função já aplica
    // acima ao recusar `share_to_feed` e `audio_name` no filho, e que o
    // cabeçalho de `tetoDaMeta` registra. `REELS` seria semanticamente errado
    // mesmo funcionando hoje, e o dia em que a Meta apertar a distinção não
    // avisa antes.
    //
    // QUEM DECIDE SE É VÍDEO É O MESMO `ehVideo` QUE ESCOLHEU A CHAVE DA URL,
    // logo acima, e isso é deliberado: era o desacordo entre os dois que
    // quebrava. Amarrados na mesma variável, `video_url` e `media_type: VIDEO`
    // não têm como discordar de novo — quem mandar `video_url` manda o
    // `media_type` junto, sempre.
    // ===========================================================================
    if (ehVideo) p.media_type = "VIDEO";
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

// -----------------------------------------------------------------------------
// O CONTÊINER PAI DO CARROSSEL (Tarefa 6)
//
// AS REGRAS DA META, lidas na referência do endpoint em 03/09/2026:
//
//   `media_type=CAROUSEL` no pai, e `children` é a lista de até 10
//   identificadores de contêiner; os filhos levam `is_carousel_item=true` e NÃO
//   levam legenda, que mora no pai; reels não entra; todos os itens são
//   cortados pela proporção do PRIMEIRO; não há marcação de localização; e o
//   carrossel conta como UMA publicação no limite de 100 por 24 h (medido na
//   Tarefa 1).
// -----------------------------------------------------------------------------

/** Até 10 itens por carrossel — o teto da Meta. */
export const CARROSSEL_ITENS_MAX = 10;
/**
 * Menos de dois não é carrossel.
 *
 * ZERO É O CASO QUE A TAREFA 2 NOMEOU ao declarar que o pai precisa de função
 * própria: um `children` vazio é um pedido que não descreve post nenhum.
 *
 * UM É DECISÃO DE PRODUTO, e vai dita: a Meta pode até aceitá-lo — não foi
 * medido —, mas um carrossel de um item é um post comum com uma seta de
 * deslizar que não desliza. Quem tem uma peça só escolhe "Imagem no feed", e a
 * tela diz isso com a frase de `textoDaRecusaDaPublicacao`.
 */
export const CARROSSEL_ITENS_MIN = 2;

/**
 * Os parâmetros do `POST /media` do contêiner PAI.
 *
 * ELA EXISTE PORQUE `parametrosDoContainer` NÃO SERVE PARA O PAI — achado da
 * Tarefa 2, e a assinatura é a prova: o pai precisa de `children`, que aquela
 * função não recebe, e ela não tem como montar um carrossel de zero itens.
 *
 * A ORDEM DA LISTA É CONTEÚDO, e não arrumação: todos os itens são cortados
 * pela proporção do PRIMEIRO. Uma lista reordenada no caminho até aqui publica
 * um post enquadrado por outro arquivo — por isso a tela deixa a ordem
 * editável, e por isso esta função não a toca.
 *
 * A LISTA VAI SEPARADA POR VÍRGULA porque é assim que a referência do endpoint
 * a escreve no corpo `application/x-www-form-urlencoded`.
 */
export function parametrosDoContainerPai(pedido: {
  filhos: string[];
  legenda?: string;
}): Record<string, string> {
  if (pedido.filhos.length < CARROSSEL_ITENS_MIN) {
    throw new Error(
      `Um carrossel precisa de pelo menos ${CARROSSEL_ITENS_MIN} itens, e este tem ${pedido.filhos.length}.`
    );
  }
  if (pedido.filhos.length > CARROSSEL_ITENS_MAX) {
    // RECUSAR ALTO, e não mandar para a Meta recusar: chegar aqui com onze quer
    // dizer que onze arquivos já subiram ao bucket e onze contêineres já
    // nasceram. Quem paga a recusa tardia é quem esperou o upload.
    throw new Error(
      `Um carrossel leva no maximo ${CARROSSEL_ITENS_MAX} itens, e este tem ${pedido.filhos.length}.`
    );
  }

  const p: Record<string, string> = {
    media_type: "CAROUSEL",
    children: pedido.filhos.join(","),
  };
  // A LEGENDA MORA NO PAI, e é a única coisa que ele carrega além dos filhos.
  // Nada de `share_to_feed` nem `audio_name` (são de reels, e reels não entra
  // em carrossel), nada de localização (o carrossel não aceita), nada de URL de
  // mídia (a mídia está nos filhos).
  const legenda = (pedido.legenda ?? "").trim();
  if (legenda) p.caption = legenda;
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

/**
 * IMAGEM CONTRA VÍDEO, pela extensão do objeto no bucket.
 *
 * ELA DEIXOU DE SER PALPITE, e o conserto foi do outro lado: `caminhoDoObjeto`
 * (lib/bucket.ts) grava a extensão a partir do `mime` DECLARADO, que
 * `decisaoDeAssinatura` acabou de validar. O que sobe por este produto ganha
 * `.jpg`, `.mp4` ou `.mov`, e esta função lê exatamente o que aquela escreveu.
 *
 * POR QUE NÃO UM `mime` NO PEDIDO. `PedidoDeContainer` teve um campo `mime`
 * opcional, criado para este caso e que NENHUM chamador jamais passou — as duas
 * chamadas do dreno o omitiam, e a única rede dele eram testes de uma saída que
 * a produção não alcançava. Passá-lo de verdade exigiria guardar um mime POR
 * CAMINHO no payload da publicação, porque um carrossel mistura imagem e vídeo
 * na mesma lista — mudança de forma de payload em fila viva, que não cabia
 * nesta onda. O campo saiu, e o buraco que ele descrevia foi fechado onde dava
 * para fechar: no nome do objeto.
 *
 * O QUE ELA AINDA NÃO SABE: objeto gravado ANTES desse conserto, cujo caminho
 * ficou `.bin` porque o nome do arquivo não tinha extensão conhecida. Esse
 * continua sendo lido como imagem, e a Meta continua recusando alto.
 */
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
  /** O contêiner que já nasceu, gravado pelo dreno. Ver `lerPayloadDaPublicacao`.
   *  No carrossel, ele é o PAI. */
  container_id?: string;
  /** Os contêineres FILHOS do carrossel que já nasceram, na ordem dos
   *  `caminhos`. Ver `lerPayloadDaPublicacao`. */
  filhos?: string[];
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
 *
 * =============================================================================
 * `filhos` É O `containerId` DO CARROSSEL, E A MEDIÇÃO QUE O OBRIGA É ESTA
 *
 * Um filho que falha por 5xx devolve o item à fila (o `catch` de `drainQueue`,
 * `retryInSeconds: 120`), e o contêiner da Meta VENCE EM 24 HORAS. Entre a
 * falha e a passada seguinte passam dois minutos: os filhos que já nasceram
 * continuam valendo com folga de três ordens de grandeza. Recriá-los seria
 * fazer a Meta baixar a mídia de novo e gastar o teto de 400 contêineres por
 * dia — num carrossel de dez, quatro passadas custariam 40 contêineres para um
 * post só.
 *
 * A LISTA É POSICIONAL: `filhos[i]` é o contêiner de `caminhos[i]`, e é isso
 * que permite retomar do ponto em que parou. Por isso ela é aceita INTEIRA ou
 * NÃO É ACEITA: um buraco no meio (um número, um nulo, um texto vazio vindos
 * de uma edição do `jsonb`) desalinharia os filhos dos caminhos, e o carrossel
 * sairia com a peça errada na posição errada. Recomeçar do zero custa
 * contêineres; publicar embaralhado custa o perfil público, onde não há
 * `DELETE` que desfaça.
 */
export function lerPayloadDaPublicacao(bruto: unknown): {
  forma: FormaDePublicacao;
  caminhos: string[];
  legenda?: string;
  compartilharNoFeed?: boolean;
  nomeDoAudio?: string;
  containerId: string | null;
  filhos: string[];
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
    filhos:
      Array.isArray(p.filhos) && p.filhos.every((f) => typeof f === "string" && f)
        ? (p.filhos as string[])
        : [],
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
 * AS MEDIDAS QUE O `canvas` USA, a partir do plano e do tamanho real da imagem.
 *
 * ELA EXISTE PORQUE ERA A ÚNICA PARTE DO PLANO DE CONVERSÃO SEM CASO. A reserva
 * "plano sem medida usa a da imagem" estava escrita dentro de
 * `converterParaJpeg` (app/publicar/enviador.tsx), onde a suíte não alcança —
 * `planoDaConversao` DELEGAVA ao componente a metade que ela mesma não sabia
 * responder, e delegar para onde não há teste é a forma de decisão que esta base
 * mais deixou sobreviver.
 *
 * O ZERO É O CASO DE VERDADE, e não um cuidado teórico: `planoDaConversao`
 * devolve `0/0` quando o navegador ainda não sabia o tamanho (`naturalWidth: 0`
 * enquanto a imagem não carregou), e cravar zero no `canvas` grava um arquivo de
 * ZERO PIXEL. O `bitmap` de `createImageBitmap`, esse, sempre sabe.
 */
export function medidasDaConversao(
  plano: { largura: number; altura: number },
  bitmap: { width: number; height: number }
): { largura: number; altura: number } {
  return {
    largura: plano.largura > 0 ? plano.largura : bitmap.width,
    altura: plano.altura > 0 ? plano.altura : bitmap.height,
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
 * AS QUATRO PASSAM, DESDE A TAREFA 6. Enquanto o carrossel não publicava, ele
 * era recusado aqui para não gravar um item de fila que o dreno recusaria
 * depois — um post que nasce morto, DEPOIS de o arquivo ter subido e ocupado o
 * bucket. Agora o dreno sabe montá-lo, e a recusa que sobra é a de QUANTIDADE
 * (`recusaDaQuantidade`), que é outra pergunta e tem outra frase.
 *
 * ELA CONTINUA EXISTINDO porque o campo é do usuário: um `<select>` alterado no
 * navegador manda o que quiser, e o que não é uma das quatro formas não vira
 * item de fila.
 *
 * A COMPARAÇÃO NÃO É FROUXA ("IMAGEM" não passa) pelo mesmo motivo de
 * `estadoDoContainer`: aceitar variação que ninguém prometeu é inventar
 * contrato — e o `<select>` da tela manda minúsculas.
 */
export function formaQueATelaPublica(bruto: unknown): FormaDePublicacao | null {
  return typeof bruto === "string" && (FORMAS as readonly string[]).includes(bruto)
    ? (bruto as FormaDePublicacao)
    : null;
}

/**
 * A QUANTIDADE DE ARQUIVOS QUE ESTA FORMA PUBLICA. `null` quando serve.
 *
 * =============================================================================
 * OS DOIS LADOS QUE ESTA FUNÇÃO FECHA, e os dois são silenciosos sem ela
 *
 * DOIS ARQUIVOS NUMA FORMA DE UM SÓ: o dreno publica `caminhos[0]` e descarta o
 * resto sem dizer nada. O segundo arquivo subiu, ocupa o bucket, e a pessoa
 * acredita que ele foi publicado — é a mesma família da saída muda que o
 * conserto de 02/09 fechou nas cinco ações.
 *
 * ONZE ITENS NUM CARROSSEL: `parametrosDoContainerPai` lança, mas ele só é
 * chamado DEPOIS de os onze filhos nascerem na Meta. Recusar aqui é recusar
 * antes de gastar contêiner nenhum.
 *
 * ELA NÃO É A PRIMEIRA BARREIRA, e sim a que decide: a tela também conta, para
 * avisar cedo, mas quem recusa é a ação de servidor — porque o formulário é do
 * usuário.
 */
export function recusaDaQuantidade(
  forma: FormaDePublicacao,
  quantos: number
): RecusaDaPublicacao | null {
  if (quantos < 1) return "sem_arquivo";
  if (forma !== "carrossel") return quantos > 1 ? "um_arquivo_so" : null;
  if (quantos < CARROSSEL_ITENS_MIN) return "carrossel_curto_demais";
  if (quantos > CARROSSEL_ITENS_MAX) return "carrossel_longo_demais";
  return null;
}

/**
 * Move um item de lugar, sem mexer na lista original.
 *
 * ELA É A ORDEM DO CARROSSEL, e a ordem é conteúdo: todos os itens são cortados
 * pela proporção do PRIMEIRO. Trocar o primeiro de lugar reenquadra o post
 * inteiro — por isso isto é decisão com teste, e não um `splice` escrito dentro
 * do componente, onde a suíte não alcança.
 *
 * FORA DA FAIXA DEVOLVE A MESMA LISTA, e a mesma POR IDENTIDADE: quem desenha
 * compara por identidade, e uma cópia nova a cada clique no botão de subir do
 * primeiro item seria um render por clique que não muda nada.
 */
export function moverNaOrdem<T>(lista: T[], de: number, para: number): T[] {
  if (de === para) return lista;
  if (de < 0 || de >= lista.length) return lista;
  if (para < 0 || para >= lista.length) return lista;
  const proxima = [...lista];
  const [item] = proxima.splice(de, 1);
  proxima.splice(para, 0, item);
  return proxima;
}

/**
 * O rótulo de um arquivo na janelinha de progresso.
 *
 * A POSIÇÃO ENTRA QUANDO HÁ MAIS DE UM ARQUIVO, e ela não é enfeite: no
 * carrossel a ordem decide o enquadramento de todos, e a janelinha é o único
 * lugar em que os arquivos aparecem enquanto sobem.
 *
 * E ELA É TAMBÉM O QUE OS SEPARA. O depósito de envios identifica cada arquivo
 * pelo rótulo (`atualizarEnvio`, app/publicar/envios.ts), e duas fotos
 * exportadas como "arte.jpg" da mesma pasta são um caso comum de quem monta
 * carrossel — sem a posição, as duas seriam a mesma linha e as duas barras
 * andariam juntas.
 */
export function rotuloDoEnvio(nome: string, posicao: number, total: number): string {
  return total > 1 ? `${posicao + 1}/${total} ${nome}` : nome;
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
  | "ja_enfileirado"
  // As três da QUANTIDADE, que `recusaDaQuantidade` decide.
  | "um_arquivo_so"
  | "carrossel_curto_demais"
  | "carrossel_longo_demais";

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
      return "Escolha entre imagem, carrossel, reels e story.";
    // AS TRÊS FRASES DA QUANTIDADE DIZEM O QUE FAZER, e cada uma diz outra
    // coisa: sobrar arquivo, faltar item e passar do teto são três enganos
    // diferentes, e uma frase só para os três mandaria a pessoa procurar o
    // problema errado.
    case "um_arquivo_so":
      return "Esta forma publica um arquivo só. Para várias peças no mesmo post, escolha Carrossel.";
    case "carrossel_curto_demais":
      return `Um carrossel precisa de pelo menos ${CARROSSEL_ITENS_MIN} itens. Com uma peça só, escolha Imagem no feed.`;
    case "carrossel_longo_demais":
      return `O Instagram aceita no máximo ${CARROSSEL_ITENS_MAX} itens por carrossel. Tire os que passam disso.`;
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
 * -03:00 o ano inteiro.
 *
 * O CAMPO CHEGA VAZIO QUANDO O JAVASCRIPT NÃO RODOU, e as duas telas que o
 * mandam o preenchem por caminhos diferentes: a de compor por um `useEffect`
 * (`app/publicar/enviador.tsx`, que é cliente), a dos agendados por um
 * `<Script>` embutido (`app/publicar/agendados/page.tsx`, que é 100% servidor).
 *
 * ATÉ 09/09/2026 A TELA DOS AGENDADOS NÃO MANDAVA O CAMPO, e o comentário que
 * estava aqui dizia que um campo vazio era impossível na prática — "nesse
 * navegador o arquivo também não subiu, então a ação recusa antes por
 * `sem_arquivo`". Aquilo valia para a tela de compor, e só para ela: remarcar
 * não sobe arquivo nenhum, então o padrão era o CAMINHO NORMAL daquela tela, e
 * ela acertava a hora por estar no Brasil. Agora o padrão voltou a ser rede, e
 * quem não rodar JavaScript continua caindo nele — que é o comportamento que
 * aquela tela sempre teve.
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
 * O `<input type="file">` aceita mais de um arquivo nesta forma?
 *
 * É A MESMA REGRA DE `recusaDaQuantidade`, e é dela que ela sai: carrossel é a
 * única forma que publica mais de um arquivo. Nas outras, escolher dois
 * publicaria o primeiro e descartaria o segundo — silenciosamente, do lado do
 * dreno.
 *
 * ESTÁ AQUI, E NÃO NO JSX, porque uma segunda escrita da mesma regra dentro do
 * componente é a que envelhece calada: no dia em que a Meta aceitasse duas
 * mídias noutra forma, `recusaDaQuantidade` mudaria e o atributo do campo não.
 * Ela pergunta à própria `recusaDaQuantidade` em vez de repetir a condição, para
 * as duas não terem como discordar.
 */
export function campoAceitaVariosArquivos(forma: FormaDePublicacao): boolean {
  return recusaDaQuantidade(forma, 2) === null;
}

/**
 * O TETO QUE A CONFERÊNCIA DA TELA USA quando o do bucket não pôde ser lido.
 *
 * "TETO DESCONHECIDO É TETO NENHUM" É DECISÃO, e ela morava dentro do
 * componente. A alternativa — tratar desconhecido como zero — recusaria TODO
 * arquivo na tela por causa de uma leitura que falhou, e a pessoa leria "grande
 * demais" sobre um arquivo de 2 MB.
 *
 * O QUE SOBRA NÃO É NADA: sem o nosso teto, continua valendo o da Meta, que
 * `problemaDoArquivo` confere de qualquer jeito. E quem diz "não" com certeza é
 * o servidor, que pergunta ao bucket antes de assinar — esta conferência é a
 * primeira barreira, a que dá mensagem boa e poupa o upload, nunca a última.
 */
export function tetoParaAConferenciaDaTela(tetoDoBucket: number | null): number {
  return tetoDoBucket ?? Number.POSITIVE_INFINITY;
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
  // STORY E CARROSSEL ACEITAM AS DUAS MÍDIAS, e a conversão vale para a imagem
  // deles igual. No carrossel, vídeo é vídeo COMUM — sem `share_to_feed`, sem
  // `audio_name`, sem capa —, e é por isso que ele não é a mesma coisa que
  // reels, que a Meta não deixa entrar em carrossel.
  return [...MIMES_DE_IMAGEM, "image/png", "image/webp", ...MIMES_DE_VIDEO].join(",");
}

// =============================================================================
// AS DECISÕES DE VER, CANCELAR E REMARCAR O AGENDADO (04/09/2026)
//
// A publicação subiu em 03/09 SEM NENHUMA FORMA DE OLHAR PARA O QUE FOI
// AGENDADO — buraco de desenho, e não de código: a especificação de 03/09 disse
// que a tela de Envios "já existe", o que é verdade, mas ela responde "o que
// aconteceu?" e um agendamento faz a pergunta oposta, "o que vai acontecer, e
// posso mudar?".
//
// É urgente porque a API do Instagram NÃO APAGA MÍDIA (medido em 03/09:
// `DELETE /{ig-media-id}` só existe no caminho do Login do Facebook). Um post
// agendado por engano só se corrige ANTES de sair.
// =============================================================================

/**
 * O que aconteceu com um pedido de cancelar ou remarcar.
 *
 * OS DOIS ÚLTIMOS SÃO OS DE `MotivoDoMomento`, reaproveitados de propósito: o
 * remarcar passa a data pela MESMA `momentoDaPublicacao` que a tela de compor
 * usa, e repassa o motivo dela sem traduzir no meio do caminho. Nenhuma regra
 * de data nova nesta entrega.
 *
 * `quando_ilegivel` NÃO ENTRA, e a ausência é a decisão: aquele motivo existe
 * porque a tela de compor tem o par de rádios "agora"/"em outra hora". Remarcar
 * não tem essa escolha — remarcar é sempre "depois", por definição —, então a
 * ação passa a palavra fixa e aquele ramo é inalcançável daqui.
 */
export type DesfechoDaMudanca =
  | "feito"
  | "tarde_demais"
  | "nao_encontrado"
  | "data_invalida"
  | "data_no_passado";

/**
 * A LEITURA DE UM `update` CONDICIONAL, E ELA É A PEÇA CENTRAL DESTA ENTREGA.
 *
 * O dreno reivindica o item com
 *
 *   update queue set status = 'sending' ...
 *    where status = 'pending' and not_before <= now() ... for update skip locked
 *
 * e ele roda DENTRO DO WEBHOOK (`lib/queue-drain.ts`), ou seja a qualquer
 * instante. Entre a tela ser desenhada e o clique em cancelar, o item pode já
 * estar em voo. Por isso cancelar e remarcar são `update` CONDICIONAIS em
 * `status = 'pending'`, e por isso ZERO LINHAS AFETADAS É UMA RESPOSTA, e não
 * uma falha genérica.
 *
 * FINGIR SUCESSO AQUI SERIA A PIOR MENTIRA QUE ESTE PAINEL PODE CONTAR: o dono
 * fecharia a tela achando que impediu um post que já está no ar — e não há
 * `DELETE` que desfaça isso do lado da Meta.
 *
 * `statusExistente` VEM DE UMA SEGUNDA CONSULTA, sem o filtro de status, e é o
 * que separa dois "zero linhas" que significam coisas opostas: o item é seu e já
 * saiu (`tarde_demais`), ou o item nunca foi seu — identificador trocado, conta
 * errada, item já apagado (`nao_encontrado`). Duas idas ao banco só no caminho
 * de falha, que é o raro.
 *
 * =============================================================================
 * ELA PERGUNTA O STATUS, E NÃO "EXISTE?" — E A DIFERENÇA É UMA MENTIRA INTEIRA
 *
 * A primeira versão desta função recebia um `boolean`. `status <> 'pending'` tem
 * CINCO valores, e só dois deles são "o post saiu": `sent` e `sending`. Os
 * outros três — `skipped` (o próprio dono cancelou, talvez na outra aba),
 * `failed` (a Meta recusou), e qualquer status que nasça amanhã — recebiam a
 * frase de `tarde_demais`, que diz palavra por palavra:
 *
 *   "Este post já saiu... Se ele já estiver no perfil, só o aplicativo do
 *    Instagram apaga."
 *
 * Medido em 09/09/2026: cancelar duas vezes o MESMO post (duas abas, ou o botão
 * de voltar do navegador) fazia o painel afirmar que o post estava no perfil
 * público — sobre um post que o próprio dono acabara de cancelar, e que não
 * existe em perfil nenhum. No `failed` é pior: o dono vai ao aplicativo
 * procurar à mão um post que a Meta recusou.
 *
 * É A MESMA CLASSE DE MENTIRA QUE ESTA ENTREGA EXISTE PARA APAGAR, ESPELHADA.
 *
 * A LISTA É DE QUEM SAIU, E NÃO DE QUEM NÃO SAIU, e a direção é a decisão: um
 * status novo (um `cancelando` de amanhã) cai em `nao_encontrado`, cuja frase
 * manda RECARREGAR A LISTA. Errar para "recarregue" custa um clique; errar para
 * "já está no seu perfil" manda a pessoa procurar no celular um post que não
 * existe.
 */
const STATUS_QUE_JA_SAIU = ["sent", "sending"];

export function desfechoDaMudanca(
  linhasAfetadas: number,
  statusExistente: string | null
): DesfechoDaMudanca {
  if (linhasAfetadas > 0) return "feito";
  if (statusExistente !== null && STATUS_QUE_JA_SAIU.includes(statusExistente)) {
    return "tarde_demais";
  }
  return "nao_encontrado";
}

/**
 * O ATRASO, EM SEGUNDOS, DO TIQUE QUE UM REMARCAR TEM DE ARMAR — ou `null`
 * quando não há tique a armar.
 *
 * =============================================================================
 * O DEFEITO QUE ELA FECHA, medido em 09/09/2026
 *
 * Remarcar não armava tique nenhum, e o comentário que justificava a ausência
 * LIA ERRADO o código que citava: ele dizia que `enqueuePublicacao` "passa
 * `agendarTique: false` de propósito". Ela não passa —
 * `lib/engine.ts` passa `agendarTique: atraso <= HORIZONTE_DO_TIQUE_EM_SEGUNDOS`.
 * Ou seja, COMPOR ARMA O TIQUE sempre que a hora cabe em 24 h; só além de um dia
 * é que o cron diário assume.
 *
 * Medido com um QStash falso, o mesmo post e a mesma distância de 2 h:
 * **compor gera 1 tique, remarcar gerava 0.**
 *
 * E A GARANTIA DO CRON NÃO COBRIA O BURACO. `armarTiquesDoDia`
 * (lib/queue-drain.ts) é honesta enquanto o `not_before` for escrito ANTES da
 * passagem do cron — é isso que faz "todo post que vence em T teve uma passagem
 * nas 24 h anteriores a T". Remarcar quebra a premissa: ele move o `not_before`
 * para dentro de uma janela cuja passagem JÁ ACONTECEU. O cron é diário
 * (`vercel.json`: `0 9 * * *`), então um post remarcado para daqui a duas horas
 * podia sair ~23 h depois, CALADO — depois de a tela ter dito "Ele sai na hora
 * nova".
 *
 * =============================================================================
 * AS TRÊS REGRAS SÃO AS DE `enqueue` (lib/engine.ts), e nenhuma é nova
 *
 *   `<= 15 s`   não arma: o item sai na drenagem que já está a caminho, e um
 *               tique para daqui a nada é uma volta ao app sem serventia. É o
 *               `atraso > 15` de `enqueue`, escrito com o mesmo número.
 *   `> horizonte` não arma: além de um dia, quem arma é o cron diário. Entregar
 *               um mês de atraso ao QStash depende de um horizonte que NUNCA foi
 *               verificado — e se ele recusasse, `scheduleTick` engoliria o erro
 *               (está certo em engolir) e o post não sairia, calado. É o
 *               `agendarTique: atraso <= HORIZONTE` de `enqueuePublicacao`.
 *   `+ 5 s`     de folga: o tique tem de chegar DEPOIS de o item ficar elegível,
 *               e não no instante exato — a seleção do dreno pede
 *               `not_before <= now()`, e um tique adiantado por um milissegundo
 *               é uma drenagem que não acha nada.
 *
 * O TETO É APLICADO DEPOIS DA FOLGA, e essa é a única diferença para o
 * `enqueue` — de propósito, e pela lição já escrita em `armarTiquesDoDia` e no
 * rodapé do dreno: com a hora nova na borda exata do horizonte, `distância + 5`
 * entregaria 86405 s, CINCO SEGUNDOS além do horizonte que este projeto declarou
 * nunca ultrapassar. Os cinco segundos não se perdem — um tique cinco segundos
 * cedo acorda uma drenagem que não acha nada, e a seguinte acha.
 *
 * O `horizonteEmSegundos` É PARÂMETRO porque a constante mora em `lib/qstash.ts`,
 * que é `server-only`, e este arquivo é lido pelo enviador no NAVEGADOR (ver o
 * cabeçalho). Quem passa o número é a ação, que já é servidor.
 */
export function atrasoDoTiqueDoRemarcar(
  quando: Date,
  agora: number,
  horizonteEmSegundos: number
): number | null {
  const distancia = Math.round((quando.getTime() - agora) / 1000);
  if (!Number.isFinite(distancia)) return null;
  if (distancia <= 15) return null;
  if (distancia > horizonteEmSegundos) return null;
  return Math.min(distancia + 5, horizonteEmSegundos);
}

/**
 * A frase de cada desfecho, por ação.
 *
 * A FRASE DE `tarde_demais` TEM DE DIZER QUE O POST SAIU, e não apenas que o
 * cancelamento falhou: são fatos diferentes, e o segundo sozinho deixa o dono
 * achando que pode tentar de novo — sobre um post que já está no perfil.
 *
 * CANCELAR E REMARCAR NÃO REPETEM A MESMA FRASE, mesmo no mesmo desfecho: quem
 * clicou fez pedidos diferentes, e a confirmação tem de responder ao pedido que
 * foi feito.
 *
 * AS DUAS RECUSAS DE DATA SÃO AS FRASES QUE JÁ EXISTEM (`textoDaRecusaDaPublicacao`).
 * Uma segunda redação do mesmo "não" faria quem lê achar que apareceu um
 * problema novo no caminho — é a mesma disciplina de `textoDoProblemaDaLegenda`.
 */
export function textoDoDesfecho(
  d: DesfechoDaMudanca,
  acao: "cancelar" | "remarcar"
): string {
  switch (d) {
    case "feito":
      return acao === "cancelar"
        ? "Post cancelado. Ele não vai sair, e o arquivo continua no seu computador."
        : "Post remarcado. Ele sai na hora nova.";
    case "tarde_demais":
      return acao === "cancelar"
        ? "Este post já saiu ou está saindo agora, e não deu para cancelar. Se ele já estiver no perfil, só o aplicativo do Instagram apaga."
        : "Este post já saiu ou está saindo agora, e não deu para remarcar. Não adianta escolher outra hora — confira o desfecho em Atividade.";
    // A ÚNICA FRASE QUE NÃO MUDA COM A AÇÃO, e a igualdade é o fato: não há
    // item para cancelar nem para remarcar, e o conselho — recarregar a lista —
    // é o mesmo nos dois casos. Escrever duas redações da mesma verdade só para
    // cumprir um padrão faria a diferença entre elas parecer significar algo.
    case "nao_encontrado":
      return "Não achei este post agendado nesta conta. Recarregue a lista: ele pode já ter sido cancelado, ou ser de outra conta.";
    // AS DUAS DE DATA REPETEM A FRASE DA TELA DE COMPOR, palavra por palavra.
    case "data_invalida":
    case "data_no_passado":
      return textoDaRecusaDaPublicacao(d);
  }
}

/**
 * OS DOIS STATUS DA FILA DE QUEM NÃO VOLTA PARA O DRENO.
 *
 * O NOME DIZ "DA FILA" PORQUE JÁ EXISTE `ESTADOS_TERMINAIS` NESTE ARQUIVO, e as
 * duas falam de coisas diferentes: aquele é sobre o `EstadoDoEnvio` do envio em
 * lote (`pronto`, `recusado`, `falhou`), este é sobre a coluna `status` da
 * tabela `queue`. Dois nomes iguais para dois vocabulários seria a confusão que
 * este arquivo inteiro vem evitando.
 *
 * `skipped` e `failed` são o fim da linha de um item da fila: o dreno reivindica
 * com `where status = 'pending'`, e nenhum dos dois volta para lá sozinho.
 *
 * `pending` E `guardado` FICAM DE FORA, e a exclusão é a metade importante desta
 * constante. O `guardado` parece terminal e não é — ele sai assim que a pessoa
 * voltar a falar (`upsertContact` o devolve a `pending`) —, e o `pending` com
 * hora à frente é o único caso em que "Sai em" é uma promessa que o sistema
 * pode cumprir. Um conserto que os alcançasse trocaria uma mentira por outra.
 *
 * `sending` TAMBÉM FICA DE FORA: ele está EM VOO, e o desfecho dele ainda vai
 * ser gravado.
 */
const STATUS_TERMINAIS_DA_FILA = new Set(["skipped", "failed"]);

/**
 * A data que uma linha de envio deve mostrar: quando SAIU, ou quando VAI sair.
 *
 * =============================================================================
 * O DEFEITO QUE ESTA FUNÇÃO CONSERTA, medido em 04/09/2026
 *
 * `app/eventos/page.tsx` mostrava `fmtDate(q.sent_at ?? q.created_at)`. Para um
 * item que ainda não saiu, isso é a data em que ele foi AGENDADO: um post
 * marcado para o dia 20, criado hoje, aparecia na lista com a data de hoje. A
 * informação que mais importa num item agendado era justamente a que não estava
 * na tela.
 *
 * ELA NÃO OLHA O `kind`, E ISSO É DELIBERADO: o lote guardado tem o mesmo
 * problema. Ele espera a pessoa voltar a falar, então o `not_before` dele não é
 * promessa de hora — mas ainda é mais honesto que a data em que foi criado.
 *
 * `futuro` NÃO É "O ITEM ESTÁ PENDENTE": um `pending` com `not_before` já
 * vencido está ATRASADO (o dreno ainda não passou por ele), e a tela não pode
 * prometer uma saída que já devia ter acontecido. A pergunta é sobre o RELÓGIO —
 * e o status entra ANTES dela, não no lugar dela: ver o parágrafo seguinte.
 *
 * =============================================================================
 * O SEGUNDO DEFEITO QUE ELA CONSERTA, medido em produção em 10/09/2026
 *
 * Um post cancelado pelo dono (`status='skipped'`, `error='cancelado por voce'`)
 * aparecia em Envios dizendo **"Sai em 12/09/2026, 16:10"**. O `not_before` dele
 * ficou com a hora que estava agendada, porque cancelar encerra o item sem
 * limpar a coluna — e um `failed` é pior ainda, porque `finish`
 * (lib/queue-drain.ts) EMPURRA `not_before` para `now() + retryInSeconds` sem
 * olhar o status, então todo item que falha por exceção nasce com a hora dois
 * minutos à frente.
 *
 * A pergunta ao relógio estava certa. O que faltava era perguntar antes se ainda
 * existe saída para prometer: `sent_at` respondia "já saiu", e nada respondia
 * "não vai sair". Ver `STATUS_TERMINAIS_DA_FILA`, logo acima.
 *
 * O `agora` É PARÂMETRO, com `Date.now()` por omissão, por um motivo de teste e
 * não de produção: sem ele, todo caso escrito com uma data fixa vira vermelho
 * no dia em que aquela data passa — e um teste que apodrece sozinho é um teste
 * que alguém apaga com raiva em vez de ler.
 *
 * `created_at` CONTINUA NA ASSINATURA como a rede do `not_before` ilegível (a
 * coluna é `not null` no banco, mas um `Invalid Date` vindo do driver viraria
 * "—" na tela ou, pior, uma comparação que é sempre falsa). O que ele deixou de
 * ser é a PRIMEIRA resposta.
 */
export function dataDaLinhaDeEnvio(
  item: { status: string; sent_at: Date | null; not_before: Date; created_at: Date },
  agora: number = Date.now()
): DataDaLinha {
  // QUEM JÁ SAIU NUNCA É FUTURO, e a pergunta ao relógio nem é feita: um item
  // com `sent_at` está no perfil público, e dizer "sai em" sobre ele seria
  // exatamente a mentira que esta entrega existe para apagar.
  if (item.sent_at && !Number.isNaN(item.sent_at.getTime())) {
    return { quando: item.sent_at, futuro: false, saiu: true, encerrado: false };
  }
  const marcado = item.not_before;
  const quando =
    marcado instanceof Date && !Number.isNaN(marcado.getTime()) ? marcado : item.created_at;
  // QUEM NÃO VAI SAIR NUNCA É FUTURO, e esta linha é a extensão do raciocínio
  // da de cima: lá a pergunta ao relógio não é feita porque o item JÁ SAIU;
  // aqui não é feita porque ele NÃO VAI SAIR. Nos dois casos "sai em" prometeria
  // um futuro que não existe — e a hora gravada em `not_before` continua ali,
  // parecendo promessa, justamente porque ninguém a limpa ao encerrar o item.
  // Ver `STATUS_TERMINAIS_DA_FILA`.
  if (STATUS_TERMINAIS_DA_FILA.has(item.status)) {
    return { quando, futuro: false, saiu: false, encerrado: true };
  }
  return { quando, futuro: quando.getTime() > agora, saiu: false, encerrado: false };
}

/**
 * A data de uma linha, e as duas perguntas que decidem a FRASE dela.
 *
 * `saiu` NÃO É `!futuro`, e é por isso que ele existe: "não é futuro" junta dois
 * fatos opostos — o post SAIU (e a data é a de quando saiu) e o post está
 * ATRASADO (a hora venceu e ele ainda está na fila). Ver `fraseDaDataDaLinha`.
 */
export type DataDaLinha = {
  quando: Date;
  futuro: boolean;
  saiu: boolean;
  /**
   * NÃO VAI SAIR MAIS: o dono cancelou (`skipped`) ou a Meta recusou
   * (`failed`). É o TERCEIRO fato, e ele existe pelo mesmo motivo que `saiu`
   * não é `!futuro`: "não é futuro" junta três situações diferentes — já
   * saiu, ainda vai sair mas está atrasado, e nunca vai sair.
   *
   * SEM ELE, UMA TELA MENTIU. Medido em 11/09/2026, por revisão: o detalhe de
   * um post CANCELADO para daqui a oito dias anunciava "A hora já passou e o
   * post ainda não saiu: ele sai na próxima drenagem, e a partir daí não dá
   * mais para cancelar" — sobre um post que o dono tinha acabado de cancelar,
   * cuja hora nem chegou. A mesma frase aparecia num post FALHADO, dizendo que
   * ele ainda sairia; o dono não reagendaria, e ele nunca sairia.
   */
  encerrado: boolean;
};

/**
 * O QUE VEM ANTES DA DATA NUMA LINHA — e as duas telas leem esta função.
 *
 * =============================================================================
 * POR QUE ELA EXISTE, medido em 09/09/2026
 *
 * A mesma pergunta estava respondida DUAS VEZES, dentro de dois JSX, com
 * palavras diferentes:
 *
 *   `app/publicar/agendados/page.tsx`: `quando.futuro ? "Sai em " : "Estava marcado para "`
 *   `app/eventos/page.tsx`:            `quando.futuro ? "sai em " : ""`
 *
 * DUAS TELAS ESCOLHENDO PALAVRAS DIFERENTES PARA O MESMO FATO é exatamente o
 * motivo pelo qual `rotuloDaForma` e `dataDaLinhaDeEnvio` foram extraídas nesta
 * mesma entrega — e a restrição do plano é explícita: "decisão em JSX ou em rota
 * é defeito". A suíte não testa componente, então o que fica decidido lá fica
 * sem rede nenhuma.
 *
 * =============================================================================
 * SÃO TRÊS FATOS, E NÃO DOIS, e é aqui que a segunda tela estava mais pobre
 *
 *   VAI SAIR      — a hora está à frente. "Sai em" é uma promessa, e é o único
 *                   caso em que ela pode ser feita.
 *   ATRASADO      — a hora venceu e o item ainda está na fila. Prometer "sai em"
 *                   aqui seria prometer uma saída que já devia ter acontecido; e
 *                   dizer só a data (o que Envios fazia) faz a mesma coluna
 *                   significar duas coisas na mesma tela.
 *   JÁ ACONTECEU  — o item tem `sent_at`. A data é a de quando saiu, e ela não
 *                   precisa de prefixo nenhum: é o que a coluna "Quando" da tela
 *                   do passado sempre quis dizer.
 */
export function fraseDaDataDaLinha(d: { futuro: boolean; saiu: boolean }): string {
  if (d.futuro) return "Sai em ";
  if (d.saiu) return "";
  return "Estava marcado para ";
}

/**
 * A LINHA DE AVISO DO ITEM ATRASADO na lista de agendados — ou `null` quando não
 * há aviso a dar.
 *
 * ELA MORAVA DENTRO DO JSX (`{!quando.futuro && <p>…</p>}`), e as duas metades
 * da decisão moravam com ela: QUANDO avisar e O QUE dizer. Nenhum portão via
 * nenhuma das duas.
 *
 * O AVISO É SOBRE O CANCELAMENTO, e não sobre a data: um item cuja hora já
 * venceu sai na próxima drenagem, e a partir daí `status = 'pending'` deixa de
 * valer e o botão de cancelar ao lado perde a corrida (ver `desfechoDaMudanca`).
 * Quem está olhando a lista precisa saber disso ANTES de contar com o botão.
 */
export function avisoDoAtrasoNaLista(d: {
  futuro: boolean;
  saiu: boolean;
  encerrado: boolean;
}): string | null {
  // O QUE NÃO VAI SAIR MAIS NÃO ESTÁ ATRASADO, e esta linha é a irmã da de
  // baixo. Elas fecham as duas portas do mesmo defeito: em 11/09/2026 esta
  // função olhava só `futuro`, e isso era seguro POR ACIDENTE porque a única
  // tela que a chamava filtrava `status = 'pending'`. O calendário passou a
  // chamá-la para QUALQUER status, e a garantia — que morava no `WHERE` de quem
  // chamava — caiu. `saiu` fechou a primeira porta; esta fecha a segunda.
  if (d.encerrado) return null;
  // O QUE JA SAIU NAO ESTA ATRASADO, e esta linha nasceu de um defeito visto na
  // tela em 11/09/2026. Ate ali a funcao olhava so `futuro`, e isso era seguro
  // POR ACIDENTE: a unica tela que a chamava filtrava `status = 'pending'` na
  // consulta, entao `saiu` era sempre falso. A garantia morava no WHERE de quem
  // chamava, e nada aqui dizia isso.
  //
  // O calendario passou a chamar a mesma funcao para item PUBLICADO, e a tela
  // anunciou "a hora ja passou e o post ainda nao saiu" sobre um post que
  // estava no perfil havia dois dias — prometendo que ainda dava para cancelar
  // o que ja era publico.
  if (d.saiu) return null;
  if (d.futuro) return null;
  return (
    "A hora já passou e o post ainda não saiu: ele sai na próxima drenagem, " +
    "e a partir daí não dá mais para cancelar."
  );
}

/**
 * O identificador de um item de fila, vindo do formulário.
 *
 * ESTE CAMPO É UM `<input type="hidden">`, E ELE É DO USUÁRIO — a mesma
 * desconfiança de `caminhosDoCampo`, por outra porta. O `id` de `queue` é uma
 * coluna `uuid`, e um texto qualquer não vira "zero linhas afetadas": ele faz o
 * POSTGRES estourar com "invalid input syntax for type uuid", exceção que sobe
 * pela ação e vira tela de erro em vez da frase de "não achei este post".
 *
 * A SAÍDA `null` VIRA `nao_encontrado`, e é a resposta certa: um identificador
 * que não tem forma de identificador não aponta para item nenhum.
 *
 * NÃO É DEFESA CONTRA INJEÇÃO — o valor entra como `$1`, sempre, como todo
 * valor deste projeto. É defesa contra o erro de TIPO, que é o que de fato
 * acontece.
 */
export function identificadorDaFila(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const limpo = bruto.trim();
  return FORMA_DO_IDENTIFICADOR.test(limpo) ? limpo : null;
}

/** O `uuid` como o Postgres o escreve, e como ele o aceita de volta —
 *  maiúscula inclusive. */
const FORMA_DO_IDENTIFICADOR =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * O motivo de `momentoDaPublicacao`, lido como desfecho de um remarcar.
 *
 * `quando_ilegivel` NÃO ALCANÇA O REMARCAR, e a tradução existe só porque o
 * compilador cobra a união inteira: aquele motivo nasce do par de rádios
 * "agora"/"em outra hora" da tela de compor, e remarcar é sempre "depois" — a
 * ação passa a palavra fixa. Se um dia ele chegar aqui, o que aconteceu é que o
 * campo não deu uma data, e é isso que a frase diz.
 *
 * ELA EXISTE PARA O `if` NÃO MORAR NA AÇÃO. Um `motivo === "quando_ilegivel" ? …`
 * escrito lá dentro seria uma decisão sem teste — a lição medida em
 * `enviarLote`, onde as três perguntas soltas no corpo da ação eram invisíveis
 * para os quatro portões.
 */
export function desfechoDaRecusaDaData(motivo: MotivoDoMomento): DesfechoDaMudanca {
  return motivo === "quando_ilegivel" ? "data_invalida" : motivo;
}

/**
 * O nome de cada forma na linguagem do painel.
 *
 * AS QUATRO PALAVRAS MORAVAM NO JSX de `app/publicar/enviador.tsx` — dentro do
 * `<select>`, num componente de cliente, que é justamente onde a suíte não
 * chega. A tela de agendados precisa das mesmas quatro, e uma segunda escrita é
 * o jeito conhecido de duas telas passarem a chamar a mesma coisa por nomes
 * diferentes. É a mesma mudança que `tiposQueOCampoAceita` e
 * `campoAceitaVariosArquivos` já fizeram, pelo mesmo motivo.
 *
 * O `switch` SEM `default` é o cobrador: uma forma nova na união obriga uma
 * palavra aqui, e o erro aparece no `tsc` — a mesma disciplina de `KIND`
 * (app/labels.ts), que é digitado por `QueueItem["kind"]`.
 */
export function rotuloDaForma(forma: FormaDePublicacao): string {
  switch (forma) {
    case "imagem":
      return "Imagem no feed";
    case "carrossel":
      return "Carrossel";
    case "reels":
      return "Reels";
    case "story":
      return "Story";
  }
}

/** Quantos caracteres de legenda cabem numa linha de lista. Constante nomeada
 *  para a tela de agendados e a de Envios cortarem pelo MESMO tamanho — um
 *  número solto no JSX vira dois números diferentes na segunda tela. */
/**
 * O NOME DA FORMA DE UM ITEM cujo payload pode não ter sido lido.
 *
 * `lerPayloadDaPublicacao` devolve `null` para um `jsonb` que não é item de
 * publicação — editado por fora, ou de uma versão que não existe mais —, e a
 * linha CONTINUA existindo, porque é dela que sai o botão de cancelar, que é
 * justamente o que se quer ter à mão num item que ninguém entende.
 *
 * A escolha entre o nome e a desculpa morava dentro do JSX
 * (`p ? rotuloDaForma(p.forma) : "Forma não reconhecida"`), fora do alcance de
 * qualquer portão. Ela é a mesma decisão de `rotuloDaForma`, com um caso a mais,
 * e mora do lado dela.
 */
export function rotuloDaFormaDoItem(p: { forma: FormaDePublicacao } | null): string {
  return p ? rotuloDaForma(p.forma) : "Forma não reconhecida";
}

export const LEGENDA_NA_LISTA = 80;

/**
 * O começo da legenda, como uma linha de lista o mostra.
 *
 * A QUEBRA DE LINHA VIRA ESPAÇO, e isto não é enfeite: a legenda de um post tem
 * parágrafo e lista, e jogada crua numa célula ela empurraria a linha para
 * cinco alturas — a lista deixaria de ser lista justamente na tela feita para
 * dar uma olhada rápida no que vai sair.
 *
 * "SEM LEGENDA" É UM FATO, e não uma célula vazia. Um post pode não ter legenda
 * de propósito (`payloadDaPublicacao` nem grava a chave nesse caso), e a
 * diferença entre "não tem" e "a tela não soube ler" precisa aparecer para quem
 * está conferindo um post que ainda dá para cancelar.
 *
 * O CORTE É DURO, e não por palavra: a reticência já avisa que há mais, e um
 * corte "inteligente" que perdesse a última palavra faria a pessoa procurar na
 * lista uma legenda que ela lembra ter escrito.
 */
export function resumoDaLegenda(legenda: unknown, teto: number): string {
  const texto = typeof legenda === "string" ? legenda.replace(/\s+/g, " ").trim() : "";
  if (!texto) return "Sem legenda";
  return texto.length > teto ? `${texto.slice(0, teto)}…` : texto;
}

/**
 * A confirmação do cancelamento veio marcada?
 *
 * O `required` DA CAIXA É DO NAVEGADOR, E SÓ DELE — ele não chega ao servidor.
 * Quem mandar o formulário por fora da página, ou de um navegador que ignore o
 * atributo, cancelaria sem confirmar. É a mesma lição que `enviarLote`
 * (app/contatos/actions.ts) já paga com `sem_confirmacao`: a confirmação que
 * mora só no HTML é enfeite.
 *
 * SÓ `"1"` CONFIRMA, e a rigidez é deliberada: `"on"` é o que um
 * `<input type="checkbox">` SEM `value` manda, e aceitar os dois faria esta
 * conferência continuar passando por acidente no dia em que alguém tirasse o
 * `value="1"` do JSX.
 */
export function confirmouOCancelamento(bruto: unknown): boolean {
  return bruto === "1";
}

/** A frase de quem clicou em cancelar sem marcar a caixa. Ela DIZ QUE NADA
 *  ACONTECEU, porque o pior desfecho aqui é a pessoa achar que cancelou. */
export const TEXTO_SEM_CONFIRMACAO_DO_CANCELAMENTO =
  "Marque a confirmação antes de cancelar. Nada foi cancelado, e o post continua agendado.";

/**
 * O MOTIVO QUE A AÇÃO DE CANCELAR GRAVA NA COLUNA `error`.
 *
 * =============================================================================
 * POR QUE ELE É CONSTANTE, e por que isso bastou no lugar de um estado novo
 * (auditoria de design de 10/09/2026, achado D1)
 *
 * `skipped` responde por DUAS coisas diferentes na fila: o sistema pulou (a
 * janela de 24h fechou, o lote venceu, um lote mais novo tomou o lugar) e o
 * DONO CANCELOU. O primeiro é um problema que aconteceu com ele; o segundo é
 * uma decisão que ele tomou. A tela chamava os dois de "Não enviada" e oferecia
 * aos dois a frase que promete nova tentativa.
 *
 * ESTE TEXTO É ESCRITO PELO NOSSO CÓDIGO, NUNCA PELO USUÁRIO, e é essa
 * propriedade que faz a constante bastar: `cancelarPublicacao`
 * (app/publicar/agendados/actions.ts) é o ÚNICO caminho do repositório que o
 * grava — medido, e os outros dois `update ... status = 'skipped'`
 * (lib/engine.ts, lib/queue-drain.ts) escrevem motivos próprios e diferentes.
 * Uma coluna que só o servidor preenche é tão confiável quanto um estado, e não
 * cobra migração, deploy em dois passos nem entrada nova em `app/labels.ts`.
 *
 * SEM ACENTO, e não por descuido: é o texto que já está gravado nas linhas de
 * produção. Mudá-lo aqui não reescreveria o histórico — faria as linhas antigas
 * voltarem a cair no rótulo de falha, que é exatamente o defeito.
 *
 * ELA MORA AQUI porque é aqui que moram as outras decisões puras do cancelar
 * (`confirmouOCancelamento`, `desfechoDaMudanca`, `textoDoDesfecho`), e porque
 * este arquivo NÃO TEM IMPORT: `app/labels.ts` pode lê-lo sem puxar servidor.
 */
export const MOTIVO_CANCELADO_PELO_DONO = "cancelado por voce";

// =============================================================================
// O QUE NÃO SAIU, E QUEM PRECISA SABER (09/09/2026)
//
// -----------------------------------------------------------------------------
// A MEDIÇÃO QUE OBRIGOU ESTAS DUAS FUNÇÕES
//
// O painel contava UM número de falhas — `failed24` — e escrevia sobre ele
// "mensagem não saiu", inclusive quando o item era uma PUBLICAÇÃO. E a tela de
// agendados filtra `status = 'pending'`: um post que falha não vira linha
// vermelha, ele DEIXA DE EXISTIR na única lista onde alguém iria procurá-lo.
//
// Enquanto era só o dono usando, uma DM que não saía era uma pessoa sem
// resposta, e ele estava olhando. Com o marketing agendando conteúdo real, um
// post que falha na sexta à noite é um lançamento que não aconteceu — e ninguém
// está de plantão.
//
// -----------------------------------------------------------------------------
// POR QUE ELAS MORAM AQUI, e não dentro das duas telas
//
// São as mesmas duas decisões de sempre: QUANDO avisar e O QUE dizer. Escritas
// no JSX, ficariam sem rede — a suíte não testa componente, e foi exatamente
// assim que "mensagem não saiu" passou meses valendo para post sem nenhum
// portão reclamar.
// =============================================================================

/**
 * Quantos dias uma publicação falhada continua valendo AVISO no painel.
 *
 * SETE, E O NÚMERO TEM MOTIVO. O modo de falha declarado pelo dono é "falha na
 * sexta à noite, ninguém vê até segunda": vinte e quatro horas não cobrem um
 * fim de semana, e sete dias cobrem com folga.
 *
 * "PARA SEMPRE" FOI RECUSADO. Um aviso vermelho por um post que falhou há três
 * meses e já foi republicado à mão é ruído — e ruído numa tela de diagnóstico é
 * pior do que nada, porque ensina a ignorá-la. É o argumento escrito em
 * `lib/webhook-messaging.ts` a propósito da confirmação de leitura, aplicado
 * aqui.
 *
 * O PRAZO É SÓ DO AVISO. A tela de agendados mostra a falha SEM RECORTE DE
 * TEMPO (`app/publicar/agendados/page.tsx`): é para lá que se vai procurar, e
 * uma falha antiga sumindo de lá seria o mesmo defeito por outro caminho.
 *
 * A CONSTANTE ENTRA NA CONSULTA COMO PARÂMETRO, e não é enfeite: um 7 escrito
 * no SQL e outro escrito na frase são duas fontes para o mesmo prazo, e a
 * segunda a mudar vira uma tela que conta sete dias e diz outra coisa.
 */
export const DIAS_DE_AVISO_DA_PUBLICACAO = 7;

/**
 * As horas em que uma MENSAGEM falhada vale aviso — as mesmas de sempre.
 *
 * ELA NÃO MUDA NESTA ENTREGA, e a constante existe pelo mesmo motivo que a de
 * cima: o número que a consulta usa e o número que a frase escreve têm de ser
 * um só.
 */
export const HORAS_DE_AVISO_DA_MENSAGEM = 24;

/** O aviso do painel: a frase e a tela onde a coisa se resolve. */
export type AvisoDeFalhas = { texto: string; href: string };

/**
 * O AVISO DE "PRECISA DE ATENÇÃO" DO PAINEL, ou `null` quando não há o que
 * avisar.
 *
 * SÃO DOIS FATOS, E NÃO UM. Uma publicação que não saiu é um post que o perfil
 * público não recebeu; uma mensagem que não saiu é uma pessoa sem resposta.
 * Chamar os dois de "mensagem" — o que esta tela fazia — não é só palavra
 * errada: MANDA PARA A TELA ERRADA. A publicação se resolve em
 * `/publicar/agendados`, a mensagem em `/eventos`, e um aviso que aponta para o
 * lugar onde o problema não está é um aviso que gasta a atenção de quem o leu.
 *
 * COM AS DUAS AO MESMO TEMPO, A FRASE DIZ AS DUAS e o destino é a PUBLICAÇÃO:
 * ela é a que ficou faltando no perfil público, e é a única das duas cuja tela
 * ainda não existia. Esconder metade seria repetir o defeito com o outro sinal.
 */
export function avisoDeFalhas(publicacoes: number, mensagens: number): AvisoDeFalhas | null {
  if (publicacoes <= 0 && mensagens <= 0) return null;
  const partes: string[] = [];
  if (publicacoes > 0) partes.push(fraseDasPublicacoes(publicacoes));
  if (mensagens > 0) partes.push(fraseDasMensagens(mensagens));
  return {
    texto: `${partes.join(", e ")}.`,
    href: publicacoes > 0 ? "/publicar" : "/eventos",
  };
}

/** "1 publicação não saiu nos últimos 7 dias" — e o plural inteiro, verbo
 *  incluído. Escrever `publicação(ões)` numa tela de diagnóstico é dizer a quem
 *  lê que ninguém olhou para o caso dele. */
function fraseDasPublicacoes(n: number): string {
  const quantas = n === 1 ? "1 publicação não saiu" : `${n} publicações não saíram`;
  return `${quantas} nos últimos ${DIAS_DE_AVISO_DA_PUBLICACAO} dias`;
}

/** A frase da mensagem, com as MESMAS palavras e as MESMAS 24 horas que esta
 *  tela já dizia — o comportamento de mensagem não muda nesta entrega. */
function fraseDasMensagens(n: number): string {
  const quantas = n === 1 ? "1 mensagem não saiu" : `${n} mensagens não saíram`;
  return `${quantas} nas últimas ${HORAS_DE_AVISO_DA_MENSAGEM}h`;
}

/** O que a seção "Não saíram" mostra para um item falhado. */
export type LinhaDaFalha = { quando: Date; motivo: string; forma: string; legenda: string };

/**
 * A LINHA DE UM POST QUE NÃO SAIU, na seção "Não saíram" dos agendados.
 *
 * A DATA É O `claimed_at`, e não o `not_before` — desde 10/09/2026, e a troca
 * saiu de uma medição.
 *
 * `finish` (lib/queue-drain.ts) grava `not_before = now() + retryInSeconds` SEM
 * olhar o status, e o `catch` genérico do dreno o chama com 120 segundos também
 * no ramo `failed`. Então todo post que falha por exceção nasce `failed` com o
 * `not_before` DOIS MINUTOS NO FUTURO, e o laço de espera empurra mais. Medido:
 * a linha imprimia "Estava marcado para 16:10" às 16:09, num post que já tinha
 * falhado — uma tela de diagnóstico prometendo uma saída que já foi recusada.
 *
 * `claimed_at` é o instante da tentativa que falhou: o dreno o grava a cada
 * reivindicação e `finish` nunca o limpa. É a MESMA coluna que o painel
 * (app/page.tsx) já escolheu para a janela de 7 dias, e pelo mesmo motivo — a
 * máquina de retentativa não a reescreve.
 *
 * O `??` É A REDE DO ITEM QUE NUNCA FOI REIVINDICADO, o mesmo `coalesce` da
 * consulta do painel: sem `claimed_at` não há instante de falha, e o
 * `not_before` é o que resta de mais próximo.
 *
 * `dataDaLinhaDeEnvio` não serve aqui: um item falhado não tem `sent_at`, e ela
 * responderia `futuro`/`saiu` sobre um item que não é nem um nem outro.
 *
 * A FORMA E A LEGENDA SAEM DAS MESMAS FUNÇÕES DA LISTA DE CIMA
 * (`rotuloDaFormaDoItem`, `resumoDaLegenda`). As duas seções moram na MESMA
 * tela: duas leituras diferentes do mesmo `jsonb`, lado a lado, chamariam a
 * mesma coisa por nomes diferentes a um centímetro de distância.
 *
 * O MOTIVO CHEGA INTEIRO, e sem tradução. `friendlyError` (app/labels.ts)
 * reescreve os erros de MENSAGEM que se repetem — a janela de 24h, a conta
 * desconectada — e nenhum deles é de publicação. O que o dreno grava aqui é a
 * resposta da Meta, que é a única pista de por que o post não saiu; trocá-la por
 * uma frase genérica seria apagar o diagnóstico para deixar a tela bonita.
 *
 * SEM MOTIVO ESCRITO A TELA AINDA DIZ ALGUMA COISA. A coluna `error` é opcional,
 * e um item `failed` sem ela é possível. Célula em branco parece defeito DA
 * TELA, e quem a vê procura o erro no lugar errado.
 */
export function linhaDaFalha(item: {
  not_before: Date;
  claimed_at: Date | null;
  error: string | null;
  payload: Record<string, unknown>;
}): LinhaDaFalha {
  const p = lerPayloadDaPublicacao(item.payload);
  const motivo = typeof item.error === "string" ? item.error.trim() : "";
  return {
    quando: item.claimed_at ?? item.not_before,
    motivo: motivo || MOTIVO_NAO_REGISTRADO,
    forma: rotuloDaFormaDoItem(p),
    legenda: resumoDaLegenda(p?.legenda, LEGENDA_NA_LISTA),
  };
}

/**
 * O que vem antes da data de um post que não saiu.
 *
 * ELA NÃO SAI DE `fraseDaDataDaLinha`, e desde 10/09/2026 isso é a decisão.
 * Aquela função responde "Sai em" / "Estava marcado para" sobre um item que
 * AINDA ESTÁ NA FILA, e as duas metades falam de uma saída que ainda pode
 * acontecer. Aqui não há saída nenhuma para prometer: o post falhou, e a data
 * ao lado é o `claimed_at`, o instante em que ele falhou. "Estava marcado para"
 * dito de um `claimed_at` seria a terceira coisa errada na mesma linha.
 */
export const FRASE_DA_FALHA = "Falhou em ";

/** A frase do item falhado que não trouxe motivo. Ela diz que o motivo é que
 *  falta — e não o post —, para ninguém procurar o defeito na tela. */
export const MOTIVO_NAO_REGISTRADO =
  "A fila não guardou o motivo desta falha. O post não saiu, e o arquivo continua no armazenamento.";

/**
 * O QUE DIZER SOBRE A MÍDIA DE UMA PUBLICAÇÃO, por estado — ou `null`.
 *
 * O DEFEITO QUE ISTO CONSERTA, achado por revisão em 11/09/2026: a tela de
 * detalhe decidia com `podeMexer = status === "pending"`, e tudo que caísse no
 * `else` recebia a frase *"Este post já saiu. A mídia foi apagada do
 * armazenamento depois da publicação"*.
 *
 * Para um post FALHADO ela é falsa duas vezes — ele não saiu, e o arquivo
 * continua no bucket. A própria seção "Não saíram", na tela irmã, afirma o
 * contrário: *"O arquivo continua no armazenamento"*. Duas telas do mesmo
 * produto dizendo coisas opostas sobre o mesmo arquivo.
 *
 * A MÍDIA SÓ É APAGADA DEPOIS DE PUBLICAR (`limparOBucket`, lib/queue-drain.ts),
 * e por isso a pergunta certa é `saiu`, e nunca "não é pending".
 */
export function fraseSobreAMidia(d: {
  saiu: boolean;
  encerrado: boolean;
}): string | null {
  if (d.saiu) {
    return (
      "Este post já saiu. A mídia foi apagada do armazenamento depois da " +
      "publicação — é por isso que ela não aparece aqui."
    );
  }
  if (d.encerrado) {
    // NÃO SAIU E NÃO VAI SAIR: cancelado ou recusado. O arquivo CONTINUA lá, e
    // dizer isso é o que permite ao dono agendar de novo sem subir tudo outra
    // vez. É a mesma frase da seção "Não saíram".
    return "Este post não saiu e não vai sair. O arquivo continua no armazenamento.";
  }
  // Ainda vai sair: não há nada a explicar sobre a mídia, e ela está ali do lado.
  return null;
}
