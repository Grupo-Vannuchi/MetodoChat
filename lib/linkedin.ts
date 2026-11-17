import "server-only";

// O CLIENTE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §4). NA PARTE 1 (a conexão), o que o
// convite usa: a autorização, a troca do código pela autorização e o `userinfo`. NA PARTE 2a (só texto e imagem),
// as chamadas versionadas de `/rest`: a reserva da imagem, o envio dela e o post.
//
// AS CHAVES DO APP (`LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET`) FICAM SÓ NAS VARIÁVEIS DA VERCEL, nunca no
// código nem no banco, porque o repositório é público (§8). Sem as duas, o LinkedIn fica desligado no painel.

import { aMidiaAindaNaoEstaPronta, oProcessamentoFalhou } from "./linkedin-publicacao";

const OAUTH = "https://www.linkedin.com";
const API = "https://api.linkedin.com";

/** O escopo de todo convite. Um escopo diferente invalidaria a autorização de antes (a documentação, §3). */
export const ESCOPO_DO_LINKEDIN = "openid profile w_member_social";

/** O caminho da volta do LinkedIn no painel (app/api/oauth/linkedin/callback/route.ts). */
export const CAMINHO_DA_VOLTA_DO_LINKEDIN = "/api/oauth/linkedin/callback";

/** O teto de tempo de cada chamada ao LinkedIn, como o da Graph (lib/ig.ts): para ela terminar algum dia. */
export const TETO_DO_LINKEDIN_MS = 10_000;

/**
 * O teto do envio da imagem, que leva até 8 MB (~4,3 Mbit/s em 15 s). A soma do ramo da imagem (o bucket, a
 * reserva, este envio e o post) cabe nos 60 s da função com folga, e o ramo confere o tempo que resta antes de
 * começar (lib/linkedin-fila.ts). tests/linkedin-rest.test.ts mede o teto que cada chamada pede.
 */
export const TETO_DO_ENVIO_DA_IMAGEM_MS = 15_000;

/**
 * O teto do envio do documento do carrossel (a parte 3a), que leva até os 15 MB do carrossel
 * (`TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES`, ~4,8 Mbit/s em 25 s). A passada da mídia do carrossel (o bucket, a montagem
 * do PDF, a reserva e este envio) soma 52 s com a folga, e só começa no início de uma função (lib/linkedin-fila.ts).
 */
export const TETO_DO_ENVIO_DO_DOCUMENTO_MS = 25_000;

// AS BASES SÓ SE MOVEM NOS TESTES, sob as mesmas duas travas da `baseDoGraph` (lib/ig.ts): `VITEST=true`, que
// `next build` e a Vercel não definem, e o loopback, e só ele (a autorização viaja nestas chamadas, e uma base
// apontando para fora seria vazar a autorização por variável de ambiente). As duas bases vão juntas para o
// mesmo servidor falso. tests/linkedin.test.ts confere as duas travas.
const BASE_DE_TESTE = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/;

export function basesDoLinkedin(): { oauth: string; api: string } {
  const pedida = process.env.LINKEDIN_API_BASE;
  if (pedida && process.env.VITEST === "true" && BASE_DE_TESTE.test(pedida)) return { oauth: pedida, api: pedida };
  return { oauth: OAUTH, api: API };
}

/** As chaves do app, das variáveis da Vercel; sem uma das duas, nenhuma. */
export function credenciaisDoLinkedin(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.LINKEDIN_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET ?? "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * O ENDEREÇO DO PAINEL PARA O LINKEDIN: a base do link do convite do LinkedIn e do `redirect_uri` do começo e
 * da volta (§3, medido no plano da parte 1).
 *
 * NA PRODUÇÃO, o canônico, o cadastrado no app do LinkedIn. NO PREVIEW, o endereço da branch
 * (`VERCEL_BRANCH_URL`, "Available at both build and runtime", sem o `https://`, na documentação da Vercel):
 * ele não muda a cada deploy da branch, e é o que o Eduardo cadastra no app só para a prova. Assim o link, o
 * começo, os cookies e a volta ficam todos no mesmo endereço, e o cookie do `state` volta junto (achado 136).
 * O convite do Instagram não passa por aqui.
 */
export function baseDoPainelParaOLinkedin(ambiente: { vercelEnv?: string; urlDaBranch?: string }, canonica: string): string {
  const branch = (ambiente.urlDaBranch ?? "").trim().replace(/\/+$/, "");
  if (ambiente.vercelEnv === "preview" && branch) return /^https?:\/\//i.test(branch) ? branch : `https://${branch}`;
  return canonica;
}

/** O ambiente da Vercel, lido do processo, para `baseDoPainelParaOLinkedin`. */
export function ambienteDaVercel(): { vercelEnv?: string; urlDaBranch?: string } {
  return { vercelEnv: process.env.VERCEL_ENV, urlDaBranch: process.env.VERCEL_BRANCH_URL };
}

export function urlDeAutorizacaoDoLinkedin(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: ESCOPO_DO_LINKEDIN,
  });
  return `${OAUTH}/oauth/v2/authorization?${p.toString()}`;
}

/**
 * O scope devolvido tem a permissão de publicar? MEDIDO NA TROCA DE 09/11/2026: ele veio separado por VÍRGULA
 * ("openid,profile,w_member_social"), e a documentação diz espaço; os dois servem.
 */
export function temPermissaoDePublicar(scope: unknown): boolean {
  return typeof scope === "string" && scope.split(/[\s,]+/).includes("w_member_social");
}

export class LinkedinError extends Error {
  status: number;
  texto: string;
  /**
   * O POST RECUSADO PORQUE O LINKEDIN AINDA PROCESSA A MÍDIA (a parte 3a), decidido na resposta INTEIRA dentro do
   * `criarPost` (`aMidiaAindaNaoEstaPronta`): o `texto` guarda só o começo dela, para a mensagem, e o código do
   * LinkedIn pode vir depois (nota da auditoria sobre a F3).
   */
  midiaNaoPronta: boolean;
  /**
   * O POST RECUSADO PORQUE O LINKEDIN NÃO CONSEGUIU PROCESSAR O VÍDEO (`MEDIA_ASSET_PROCESSING_FAILED`, a parte 3b),
   * decidido também na resposta inteira.
   */
  processamentoFalhou: boolean;
  constructor(status: number, texto: string, midiaNaoPronta = false, processamentoFalhou = false) {
    super(`LinkedIn ${status}: ${texto}`);
    this.name = "LinkedinError";
    this.status = status;
    this.texto = texto;
    this.midiaNaoPronta = midiaNaoPronta;
    this.processamentoFalhou = processamentoFalhou;
  }
}

/**
 * O PEDIDO QUE O PAINEL RECUSOU SEM CHEGAR AO LINKEDIN, e que repetir não conserta (a nota da auditoria sobre a F2 da
 * 3b): o redirecionamento recusado, e o endereço de uma parte do vídeo fora da regra do domínio. Não é um status de
 * HTTP: `desfechoDoErroDoLinkedin` o trata como permanente, e não como a rede (status 0), que passa.
 */
export const STATUS_RECUSADO_PELO_PAINEL = -1;

/**
 * TODA CHAMADA AO LINKEDIN PASSA POR AQUI, com o teto de tempo e SEM SEGUIR REDIRECIONAMENTO (o 234, a parte 3b): a
 * regra do domínio (`enderecoDeEnvioConfiavel`) confere só o primeiro endereço, e um 3xx para fora do LinkedIn
 * levaria junto o token, ou a parte do vídeo do cliente. O redirecionamento recusado é permanente
 * (`STATUS_RECUSADO_PELO_PAINEL`).
 */
async function chamar(
  url: string,
  init: RequestInit,
  tetoMs: number = TETO_DO_LINKEDIN_MS
): Promise<{ status: number; texto: string; restliId: string | null; etag: string | null }> {
  try {
    const res = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(tetoMs) });
    return { status: res.status, texto: await res.text(), restliId: res.headers.get("x-restli-id"), etag: res.headers.get("etag") };
  } catch (err) {
    // O endereço vai sem a query: nenhuma destas chamadas leva segredo nela, e assim continua.
    const onde = url.split("?")[0];
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new LinkedinError(0, `${onde} não respondeu em ${tetoMs}ms`);
    }
    // O `fetch` do Node recusa o 3xx com um erro de rede cuja causa fala do redirecionamento.
    const causa = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
    if (causa instanceof Error && /redirect/i.test(causa.message)) {
      throw new LinkedinError(STATUS_RECUSADO_PELO_PAINEL, `${onde} redirecionou, e a chamada não seguiu`);
    }
    throw new LinkedinError(0, `${onde} falhou na rede`);
  }
}

function json(texto: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(texto) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * A TROCA DO CÓDIGO PELA AUTORIZAÇÃO (`POST /oauth/v2/accessToken`, form urlencoded). DA RESPOSTA, SÓ TRÊS
 * CAMPOS SAEM DAQUI: a autorização, o prazo e o scope. O `id_token` (que veio na troca de 09/11) e o resto são
 * descartados aqui mesmo, e não chegam ao banco nem ao texto de erro.
 */
export async function trocarCodigoDoLinkedin(p: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string; expiraEmSegundos: number; scope: string }> {
  const r = await chamar(`${basesDoLinkedin().oauth}/oauth/v2/accessToken`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: p.code,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      redirect_uri: p.redirectUri,
    }).toString(),
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const corpo = json(r.texto);
  const accessToken = corpo?.access_token;
  const expira = corpo?.expires_in;
  if (typeof accessToken !== "string" || !accessToken || typeof expira !== "number" || !(expira > 0)) {
    throw new LinkedinError(r.status, "a troca não devolveu a autorização e o prazo");
  }
  return { accessToken, expiraEmSegundos: expira, scope: typeof corpo?.scope === "string" ? corpo.scope : "" };
}

/** QUEM É A PESSOA (`GET /v2/userinfo`, do OpenID Connect): o `sub`, que vira o autor dos posts, e o nome. */
export async function pessoaDoLinkedin(accessToken: string): Promise<{ sub: string; nome: string }> {
  const r = await chamar(`${basesDoLinkedin().api}/v2/userinfo`, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const corpo = json(r.texto);
  const sub = corpo?.sub;
  if (typeof sub !== "string" || !sub) throw new LinkedinError(r.status, "o userinfo veio sem o sub");
  const texto = (v: unknown) => (typeof v === "string" ? nomeLimpo(v) : "");
  const nome = texto(corpo?.name) || [texto(corpo?.given_name), texto(corpo?.family_name)].filter(Boolean).join(" ");
  return { sub, nome: nome || "sem nome no LinkedIn" };
}

/** O nome com os espaços juntados e as pontas aparadas: a prova de 09/11 trouxe dois espaços no meio. */
export function nomeLimpo(nome: string): string {
  return nome.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------------------------------------------
// A PARTE 2a: AS CHAMADAS VERSIONADAS DE PUBLICAR
// ---------------------------------------------------------------------------------------------------------------

/**
 * A VERSÃO DA API (`Linkedin-Version`, formato AAAAMM). A 202610 é a mais nova na página de versões, e toda
 * versão tem suporte por pelo menos um ano ("supported and stable for a minimum of one year before sunset"); a
 * spec registrou o fim em 15/10/2027. tests/linkedin-rest.test.ts fica vermelho a partir de 01/09/2027, de
 * propósito, para a troca ser lembrada antes.
 */
export const LINKEDIN_VERSION = "202610";

function cabecalhosDoRest(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "linkedin-version": LINKEDIN_VERSION,
    "x-restli-protocol-version": "2.0.0",
    "content-type": "application/json",
  };
}

/**
 * A RESERVA DA IMAGEM (`POST /rest/images?action=initializeUpload`, Images API), com a pessoa como dona.
 * Devolve o endereço de envio e o URN da imagem.
 */
export async function reservarImagem(token: string, pessoaId: string): Promise<{ uploadUrl: string; imagemUrn: string }> {
  const r = await chamar(`${basesDoLinkedin().api}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: cabecalhosDoRest(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: `urn:li:person:${pessoaId}` } }),
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const valor = json(r.texto)?.value as Record<string, unknown> | undefined;
  const uploadUrl = valor?.uploadUrl;
  const imagemUrn = valor?.image;
  if (typeof uploadUrl !== "string" || typeof imagemUrn !== "string" || !imagemUrn.startsWith("urn:li:image:")) {
    throw new LinkedinError(r.status, "a reserva da imagem não devolveu o endereço e o URN");
  }
  return { uploadUrl, imagemUrn };
}

/**
 * O ENDEREÇO DE ENVIO RECEBE A AUTORIZAÇÃO (o upload da imagem "requires a valid OAuth token in the
 * 'Authorization' header", na página da Assets API), então ele só é usado se for https de um domínio do
 * LinkedIn. Nos testes, o loopback, sob a trava do vitest.
 */
export function enderecoDeEnvioConfiavel(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (process.env.VITEST === "true" && BASE_DE_TESTE.test(u.origin)) return true;
  return u.protocol === "https:" && (u.hostname === "linkedin.com" || u.hostname.endsWith(".linkedin.com"));
}

/** O ENVIO DA IMAGEM: `PUT` dos bytes no endereço da reserva, com a autorização (a página da Assets API). */
export async function enviarImagem(uploadUrl: string, token: string, bytes: ArrayBuffer, mime: string): Promise<void> {
  if (!enderecoDeEnvioConfiavel(uploadUrl)) {
    throw new LinkedinError(0, "o endereço de envio da imagem não é do LinkedIn");
  }
  const r = await chamar(
    uploadUrl,
    { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": mime }, body: bytes },
    TETO_DO_ENVIO_DA_IMAGEM_MS
  );
  if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
}

/**
 * A RESERVA DO DOCUMENTO DO CARROSSEL (`POST /rest/documents?action=initializeUpload`, Documents API; a parte 3a),
 * com a pessoa como dona ("For documents with person URN owners, the caller must match the document owner"). A sonda
 * de 09/11 deu 200 nela. Devolve o endereço de envio e o URN do documento.
 */
export async function reservarDocumento(token: string, pessoaId: string): Promise<{ uploadUrl: string; documentoUrn: string }> {
  const r = await chamar(`${basesDoLinkedin().api}/rest/documents?action=initializeUpload`, {
    method: "POST",
    headers: cabecalhosDoRest(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: `urn:li:person:${pessoaId}` } }),
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const valor = json(r.texto)?.value as Record<string, unknown> | undefined;
  const uploadUrl = valor?.uploadUrl;
  const documentoUrn = valor?.document;
  if (typeof uploadUrl !== "string" || typeof documentoUrn !== "string" || !documentoUrn.startsWith("urn:li:document:")) {
    throw new LinkedinError(r.status, "a reserva do documento não devolveu o endereço e o URN");
  }
  return { uploadUrl, documentoUrn };
}

/**
 * O ENVIO DO DOCUMENTO: um `PUT` só, dos bytes do PDF, com a autorização, como o exemplo da Documents API ("curl
 * --upload-file" com o "Authorization: Bearer"). O endereço passa pela mesma regra do da imagem: só https de um
 * domínio do LinkedIn recebe a autorização (os exemplos trazem `https://www.linkedin.com/dms-uploads/...`).
 */
export async function enviarDocumento(uploadUrl: string, token: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  if (!enderecoDeEnvioConfiavel(uploadUrl)) {
    throw new LinkedinError(0, "o endereço de envio do documento não é do LinkedIn");
  }
  const r = await chamar(uploadUrl, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: bytes }, TETO_DO_ENVIO_DO_DOCUMENTO_MS);
  if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
}

// ---------------------------------------------------------------------------------------------------------------
// O VÍDEO EM PARTES (a parte 3b; scratchpad/desenho-li3b.md, v3; a Videos API, lida em 11/11)
// ---------------------------------------------------------------------------------------------------------------

/**
 * O teto do envio de UMA parte do vídeo: as partes são de 4 MiB nos exemplos da Videos API (~2,2 Mbit/s em 15 s), e
 * a parte inteira (a faixa do bucket e este envio) só começa se terminar antes da hora de parar (o 231,
 * lib/linkedin-fila.ts).
 */
export const TETO_DO_ENVIO_DA_PARTE_MS = 15_000;

/** Uma parte do vídeo: o primeiro e o último byte, inclusivos, e o endereço de envio dela. */
export type ParteDoVideo = { inicio: number; fim: number; url: string };

/**
 * AS PARTES DA RESERVA, conferidas antes de qualquer gravação: cada endereço pela regra do domínio, e os intervalos
 * cobrindo o arquivo inteiro, de 0 ao tamanho − 1, em ordem, sem buraco nem sobra. Uma reserva torta não vira um
 * envio pela metade.
 */
function partesConferidas(instrucoes: unknown, tamanho: number): ParteDoVideo[] | null {
  if (!Array.isArray(instrucoes) || instrucoes.length === 0) return null;
  const partes: ParteDoVideo[] = [];
  let esperado = 0;
  for (const i of instrucoes) {
    if (!i || typeof i !== "object") return null;
    const { uploadUrl, firstByte, lastByte } = i as Record<string, unknown>;
    if (typeof uploadUrl !== "string" || !enderecoDeEnvioConfiavel(uploadUrl)) return null;
    if (!Number.isSafeInteger(firstByte) || !Number.isSafeInteger(lastByte)) return null;
    const inicio = firstByte as number;
    const fim = lastByte as number;
    if (inicio !== esperado || fim < inicio) return null;
    partes.push({ inicio, fim, url: uploadUrl });
    esperado = fim + 1;
  }
  return esperado === tamanho ? partes : null;
}

/**
 * A RESERVA DO VÍDEO (`POST /rest/videos?action=initializeUpload`, Videos API), com a pessoa como dona ("For videos
 * with member URN owners, the caller needs to match the video owner") e o tamanho, que decide quantas partes
 * vêm. Sem legenda e sem capa. Devolve o URN, o token do envio (que pode vir vazio no vídeo de uma parte só) e as
 * partes conferidas.
 */
export async function reservarVideo(
  token: string,
  pessoaId: string,
  tamanho: number
): Promise<{ videoUrn: string; uploadToken: string; partes: ParteDoVideo[] }> {
  const r = await chamar(`${basesDoLinkedin().api}/rest/videos?action=initializeUpload`, {
    method: "POST",
    headers: cabecalhosDoRest(token),
    body: JSON.stringify({
      initializeUploadRequest: { owner: `urn:li:person:${pessoaId}`, fileSizeBytes: tamanho, uploadCaptions: false, uploadThumbnail: false },
    }),
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const valor = json(r.texto)?.value as Record<string, unknown> | undefined;
  const videoUrn = valor?.video;
  const uploadToken = valor?.uploadToken;
  const partes = partesConferidas(valor?.uploadInstructions, tamanho);
  if (typeof videoUrn !== "string" || !videoUrn.startsWith("urn:li:video:") || typeof uploadToken !== "string" || !partes) {
    throw new LinkedinError(r.status, "a reserva do vídeo não devolveu o URN, o token do envio e as partes do arquivo inteiro");
  }
  return { videoUrn, uploadToken, partes };
}

/**
 * O ENVIO DE UMA PARTE (o 234): um `PUT` dos bytes da parte, com o tipo binário e SEM a autorização, como o exemplo
 * da Videos API, que traz o endereço já assinado. O endereço passa pela regra do domínio mesmo assim: o vídeo é do
 * cliente e não sai do LinkedIn. Devolve o `ETag` da resposta, que é o id da parte; sem ele, ou vazio, é erro. O
 * erro leva só o status, e não a resposta (o 236): a tela mostra a coluna `error`.
 */
export async function enviarParteDoVideo(uploadUrl: string, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!enderecoDeEnvioConfiavel(uploadUrl)) {
    throw new LinkedinError(STATUS_RECUSADO_PELO_PAINEL, "o endereço de envio do vídeo não é do LinkedIn");
  }
  const r = await chamar(uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes }, TETO_DO_ENVIO_DA_PARTE_MS);
  if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, `o LinkedIn recusou a parte do vídeo (${r.status})`);
  if (!r.etag) throw new LinkedinError(r.status, "o LinkedIn aceitou a parte do vídeo sem o ETag");
  return r.etag;
}

/**
 * O FIM DO ENVIO (`POST /rest/videos?action=finalizeUpload`): o vídeo, o token do envio e os ETags "na mesma ordem
 * das partes nas instruções".
 */
export async function finalizarVideo(token: string, videoUrn: string, uploadToken: string, etags: readonly string[]): Promise<void> {
  const r = await chamar(`${basesDoLinkedin().api}/rest/videos?action=finalizeUpload`, {
    method: "POST",
    headers: cabecalhosDoRest(token),
    body: JSON.stringify({ finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds: [...etags] } }),
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
}

/**
 * O ESTADO DO VÍDEO (`GET /rest/videos/{urn}`): PROCESSING, PROCESSING_FAILED, AVAILABLE ou WAITING_UPLOAD. Ele só é
 * lido no fim perdido (o 233). Se a consulta funciona só com o `w_member_social` não está medido: a prova mede.
 */
export async function estadoDoVideo(token: string, videoUrn: string): Promise<string | null> {
  const r = await chamar(`${basesDoLinkedin().api}/rest/videos/${encodeURIComponent(videoUrn)}`, {
    method: "GET",
    headers: cabecalhosDoRest(token),
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const status = json(r.texto)?.status;
  return typeof status === "string" && status ? status : null;
}

/**
 * O POST (`POST /rest/posts`, Posts API): "You should get a 201 response and the response header x-restli-id
 * contains the Post ID". Devolve o URN do post.
 */
export async function criarPost(token: string, corpo: Record<string, unknown>): Promise<string> {
  const r = await chamar(`${basesDoLinkedin().api}/rest/posts`, {
    method: "POST",
    headers: cabecalhosDoRest(token),
    body: JSON.stringify(corpo),
  });
  if (r.status !== 201) {
    throw new LinkedinError(r.status, r.texto.slice(0, 300), aMidiaAindaNaoEstaPronta(r.status, r.texto), oProcessamentoFalhou(r.status, r.texto));
  }
  if (!r.restliId) throw new LinkedinError(r.status, "o post saiu sem o x-restli-id");
  return r.restliId;
}
