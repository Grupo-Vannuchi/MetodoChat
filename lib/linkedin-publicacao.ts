// AS DECISÕES PURAS DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5), SEM IMPORT DE SERVIDOR: a
// tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), o vencimento; na parte 2a (só
// texto e imagem, uma rede por post), as formas, o texto, o payload da fila, o corpo do post e os erros. O
// carrossel em PDF e o vídeo vêm na parte 3.

/** O aviso de que a autorização vai vencer começa a 7 dias. */
export const AVISO_DO_VENCIMENTO_DIAS = 7;

const DIA_MS = 86_400_000;

export type Vencimento = { estado: "valido" | "perto" | "vencido"; dias: number; frase: string };

/**
 * O VENCIMENTO DA AUTORIZAÇÃO DO LINKEDIN: 60 dias, sem renovação automática (renovar é mandar um convite
 * novo). Um pedaço de dia conta como um dia inteiro, e o prazo vence no próprio instante, como o do convite
 * (`estadoDoConvite`, lib/convites.ts). A data pode chegar como texto, de um componente de cliente.
 */
export function vencimentoDoLinkedin(expiraEm: Date | string, agoraMs: number): Vencimento {
  const falta = new Date(expiraEm).getTime() - agoraMs;
  if (!(falta > 0)) return { estado: "vencido", dias: 0, frase: "venceu" };
  const dias = Math.ceil(falta / DIA_MS);
  return {
    estado: dias <= AVISO_DO_VENCIMENTO_DIAS ? "perto" : "valido",
    dias,
    frase: dias === 1 ? "vence em 1 dia" : `vence em ${dias} dias`,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// AS FORMAS DA PARTE 2a
// ---------------------------------------------------------------------------------------------------------------

export type FormaNoLinkedin = "texto" | "imagem";
const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem"];

/** A forma que veio do formulário, de uma lista fechada. */
export function formaNoLinkedinDoCampo(bruto: unknown): FormaNoLinkedin | null {
  return (FORMAS_NO_LINKEDIN as readonly unknown[]).includes(bruto) ? (bruto as FormaNoLinkedin) : null;
}

export function rotuloDaFormaNoLinkedin(forma: FormaNoLinkedin): string {
  return forma === "texto" ? "Só texto" : "Imagem";
}

// ---------------------------------------------------------------------------------------------------------------
// O TEXTO
// ---------------------------------------------------------------------------------------------------------------

/**
 * O LIMITE DO TEXTO: "Posts can contain up to 3,000 characters." (Central de Ajuda do LinkedIn, a528176). A API
 * não diz o número nem como conta, então o limite é contado no texto QUE VAI AO LINKEDIN, depois das hashtags e
 * dos escapes (achado 212): um texto que cabe aqui cabe lá, e a tela e o servidor contam pela mesma função.
 */
export const LIMITE_DO_TEXTO_DO_LINKEDIN = 3000;

// OS 15 CARACTERES RESERVADOS DO "little text" (a página Little Text Format do LinkedIn): "All reserved
// characters need to be escaped with a backslash, even if those characters are not used in one of the supported
// elements or templates."
const RESERVADOS = /[|{}@[\]()<>#\\*_~]/g;
const escapar = (texto: string) => texto.replace(RESERVADOS, (c) => `\\${c}`);

// A HASHTAG CLICÁVEL (decisão do Eduardo, 09/11: "Virar hashtag clicável"): o # no começo de uma palavra,
// seguido de letras, números ou "_", vira o modelo `{hashtag|\#|palavra}` (Little Text Format). Letra é \p{L},
// e não \w, que no JavaScript só pega ASCII ("#educação" viraria "#educa"). O # no meio de uma palavra ("abc#d")
// ou sem palavra depois ("C#") continua texto, escapado.
const HASHTAG = /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;

/** O texto como vai no `commentary` do post: as hashtags no modelo clicável e o resto escapado. */
export function textoParaOLinkedin(texto: string): string {
  let saida = "";
  let desde = 0;
  for (const achado of texto.matchAll(HASHTAG)) {
    const onde = achado.index ?? 0;
    saida += escapar(texto.slice(desde, onde)) + `{hashtag|\\#|${escapar(achado[1])}}`;
    desde = onde + achado[0].length;
  }
  return saida + escapar(texto.slice(desde));
}

/** O tamanho que conta para o limite: caracteres (e não pedaços de UTF-16) do texto que vai ao LinkedIn. */
export function tamanhoDoTextoNoLinkedin(texto: string): number {
  return Array.from(textoParaOLinkedin(texto)).length;
}

export type ProblemaDoTextoDoLinkedin = "vazio" | "longo";

/** O texto é obrigatório nas duas formas (o `commentary` é "required" no Post Schema), e cabe nos 3.000. */
export function problemaDoTextoDoLinkedin(texto: string, _forma: FormaNoLinkedin): ProblemaDoTextoDoLinkedin | null {
  if (!texto.trim()) return "vazio";
  if (tamanhoDoTextoNoLinkedin(texto.trim()) > LIMITE_DO_TEXTO_DO_LINKEDIN) return "longo";
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// O PAYLOAD DA LINHA `publicacao_linkedin` NA FILA
// ---------------------------------------------------------------------------------------------------------------

/**
 * As chaves do `jsonb`. Os passos são marcados ANTES do seguinte, para a passada repetida não refazer o que já
 * foi feito (spec, §6): `imagem_urn` depois do envio da imagem; `post_tentado_em` ANTES do POST do post (achado
 * 210: o POST não tem chave contra repetição, e uma resposta perdida não pode virar um segundo post); e
 * `post_urn` com o id que o LinkedIn devolveu.
 */
export type PayloadDoLinkedin = {
  forma: FormaNoLinkedin;
  caminhos: string[];
  texto: string;
  imagem_urn?: string;
  post_tentado_em?: string;
  post_urn?: string;
};

export function payloadDoLinkedin(pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string }): PayloadDoLinkedin {
  return { forma: pedido.forma, caminhos: [...pedido.caminhos], texto: pedido.texto.trim() };
}

export type LeituraDoPayloadDoLinkedin = {
  forma: FormaNoLinkedin;
  caminhos: string[];
  texto: string;
  imagemUrn: string | null;
  postTentadoEm: string | null;
  postUrn: string | null;
};

/** Lê o payload, ou null: a forma tem de ser da lista, o texto tem de ser texto, e a quantidade de arquivos a da forma. */
export function lerPayloadDoLinkedin(bruto: unknown): LeituraDoPayloadDoLinkedin | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const forma = formaNoLinkedinDoCampo(p.forma);
  if (!forma || typeof p.texto !== "string") return null;
  const caminhos = Array.isArray(p.caminhos) && p.caminhos.every((c) => typeof c === "string") ? (p.caminhos as string[]) : null;
  if (!caminhos || caminhos.length !== (forma === "imagem" ? 1 : 0)) return null;
  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    forma,
    caminhos,
    texto: p.texto,
    imagemUrn: texto(p.imagem_urn),
    postTentadoEm: texto(p.post_tentado_em),
    postUrn: texto(p.post_urn),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// O CORPO DO POST E O LINK PARA VER
// ---------------------------------------------------------------------------------------------------------------

/**
 * O corpo do `POST /rest/posts` (Posts API): o autor é a pessoa, o texto já transformado, PÚBLICO (fixo nesta
 * entrega; não há escolha de visibilidade na tela), no feed, publicado, e a imagem quando há.
 */
export function corpoDoPost(p: { pessoaId: string; texto: string; imagemUrn?: string }): Record<string, unknown> {
  return {
    author: `urn:li:person:${p.pessoaId}`,
    commentary: textoParaOLinkedin(p.texto),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(p.imagemUrn ? { content: { media: { id: p.imagemUrn } } } : {}),
  };
}

const URN_DE_POST = /^urn:li:(?:share|ugcPost):\d+$/;

/** "Ver no LinkedIn": o endereço do feed, só para um URN de post (Posts API: `/feed/update/<urn>/`). */
export function linkParaVerNoLinkedin(postUrn: string | null | undefined): string | null {
  return postUrn && URN_DE_POST.test(postUrn) ? `https://www.linkedin.com/feed/update/${postUrn}/` : null;
}

// ---------------------------------------------------------------------------------------------------------------
// OS ERROS
// ---------------------------------------------------------------------------------------------------------------

export type DesfechoDoErroDoLinkedin = "autorizacao" | "permanente" | "passageiro";

/**
 * O 401 é a autorização que não vale mais (venceu ou foi retirada); o 429, o 409 ("Retry the request"), os 5xx
 * e a rede (status 0) passam; o 403 e os outros 4xx não passam sozinhos (Posts API, "API Error Details").
 */
export function desfechoDoErroDoLinkedin(status: number): DesfechoDoErroDoLinkedin {
  if (status === 401) return "autorizacao";
  if (status === 0 || status === 409 || status === 429 || status >= 500) return "passageiro";
  return "permanente";
}

export function motivoDaAutorizacaoRecusada(nome: string): string {
  return `o LinkedIn de ${nome} não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo`;
}

/**
 * DEPOIS DO POST, O POST PODE TER SAÍDO? (achado 210). O `POST /rest/posts` não tem chave contra repetição, então
 * só uma resposta 4xx prova que o LinkedIn não criou nada. A rede (0), o 5xx e o 2xx sem o `x-restli-id` deixam a
 * dúvida, e a linha não pode ser tentada de novo: o dono confere no LinkedIn.
 */
export function oPostPodeTerSaido(status: number): boolean {
  return !(status >= 400 && status < 500);
}
