import "server-only";
import { resumoDoErroDaMeta, type ResumoDoErroDaMeta } from "./steps";

// API "Instagram com Login do Instagram" — não precisa de página do Facebook.
//
// ESTE É O VALOR REAL, E ELE CONTINUA SENDO O PADRÃO. Quem lê a base é
// `baseDoGraph()`, logo abaixo, e ela só devolve outra coisa quando as DUAS
// travas de lá cedem ao mesmo tempo.
export const GRAPH = "https://graph.instagram.com";

// ---------- A base do Graph, e a única coisa neste arquivo que um teste move ----------
//
// POR QUE ISTO EXISTE. O portão de follow (`resolverFollow`, lib/engine.ts)
// pergunta à Meta se a pessoa segue, e a resposta decide se a recompensa sai. Um
// teste que prove essa promessa precisa das TRÊS respostas — segue, não segue, e
// "a Meta não informou" —, e nenhuma delas pode vir da Meta de verdade.
//
// O QUE FOI RECUSADO, e por medição, não por gosto:
//
//   MOCK do `fetch` (`vi.mock`, `vi.stubGlobal`) — troca a chamada por uma cópia
//     da cola. O `fetch`, o parsing da resposta e o tratamento de erro de
//     `checkFollowsAccount` deixariam de ser exercitados, que é justamente o que
//     o teste precisa exercitar.
//   DESVIAR O DNS por um dispatcher do undici (`setGlobalDispatcher` com
//     `connect.lookup`) — mantém o `fetch` real, mas custa: `undici` NÃO está
//     instalado neste projeto (medido: `require("undici")` dá MODULE_NOT_FOUND),
//     então seria dependência nova; e como a URL é `https`, exigiria um
//     certificado auto-assinado de fixture mais `rejectUnauthorized: false`. Pior
//     que o preço: ele sequestra um HOSTNAME REAL no processo inteiro, sem nome
//     nenhum no código dizendo que isso aconteceu.
//   DEIXAR A CHAMADA FALHAR — é o pior de todos, e é o que parece inofensivo:
//     `checkFollowsAccount` engole o erro e devolve `null`, que `resolverFollow`
//     trata como PASSOU. O teste exercitaria exatamente o ramo que não prova a
//     promessa. E, de quebra, teria disparado uma requisição de verdade contra a
//     Meta com um token inventado.
//
// O QUE SOBROU é uma variável de ambiente lida NO MOMENTO DA CHAMADA, com o
// valor real como padrão. O teste sobe um servidor HTTP na própria máquina e
// aponta a base para ele: o `fetch` é real, o parsing é real, o motor é real — o
// que muda é só a outra ponta do fio.
//
// POR QUE PRODUÇÃO NÃO CAI NISSO POR ACIDENTE. São duas travas independentes, e
// as duas precisam ceder juntas:
//
//   1. `VITEST === "true"`. Medido no processo do vitest deste projeto:
//      `VITEST=true`, `NODE_ENV=test`. `next dev`, `next build` e a Vercel não
//      definem `VITEST` — quem quiser derrubar esta trava em produção precisa
//      declarar, num painel de deploy, uma variável chamada VITEST.
//   2. LOOPBACK, e só. O `access_token` viaja na QUERY destas chamadas, então uma
//      base apontando para fora seria exfiltração de credencial por variável de
//      ambiente. Com esta trava, o pior que a variável consegue fazer é falar com
//      um servidor da própria máquina.
//
// E não é inlining de build: `IG_GRAPH_BASE` não tem prefixo `NEXT_PUBLIC_`,
// então o Next a mantém como leitura de runtime no servidor e nunca a embute em
// bundle (node_modules/next/dist/docs/01-app/02-guides/environment-variables.md).
//
// As duas travas são medidas por teste, e não só afirmadas aqui:
// `testes-integracao/portao-link.integracao.ts`, caso "a base do Graph só se move
// sob as duas travas".
const BASE_DE_TESTE = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/;

export function baseDoGraph(): string {
  const pedida = process.env.IG_GRAPH_BASE;
  if (!pedida) return GRAPH;
  if (process.env.VITEST !== "true") return GRAPH;
  if (!BASE_DE_TESTE.test(pedida)) return GRAPH;
  return pedida;
}
// A configuração de webhook do APP (subscriptions) vive no Facebook Graph,
// não no graph.instagram.com — é uma operação de nível de app.
export const FB_GRAPH = "https://graph.facebook.com";
export const API_VERSION = "v25.0";

type Json = Record<string, unknown>;

export class IgError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Instagram API ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

async function graphFetch(path: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(`${baseDoGraph()}/${API_VERSION}${path}`, init);
  const text = await res.text();
  if (!res.ok) throw new IgError(res.status, text);
  return text ? (JSON.parse(text) as Json) : {};
}

// ---------- OAuth ----------

export function authorizeUrl(appId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
    ].join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
}

export async function exchangeCodeForShortToken(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; user_id: string }> {
  const body = new URLSearchParams({
    client_id: opts.appId,
    client_secret: opts.appSecret,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new IgError(res.status, text);
  const json = JSON.parse(text);
  return { access_token: json.access_token, user_id: String(json.user_id) };
}

export async function exchangeForLongLivedToken(
  appSecret: string,
  shortToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const p = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortToken,
  });
  const res = await fetch(`${baseDoGraph()}/access_token?${p.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new IgError(res.status, text);
  return JSON.parse(text);
}

export async function refreshLongLivedToken(
  token: string
): Promise<{ access_token: string; expires_in: number }> {
  const p = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const res = await fetch(`${baseDoGraph()}/refresh_access_token?${p.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new IgError(res.status, text);
  return JSON.parse(text);
}

// ---------- Perfil / mídia ----------

// A resposta da Meta é JSON solto: nada garante que os campos vieram, nem que
// vieram como texto. Ler `json.username` direto e confiar é o que transforma
// mudança de contrato da Meta em `undefined` silencioso lá na frente, longe
// daqui. Estas duas funções são a fronteira onde isso para.
function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

export type IgProfile = {
  user_id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
};

export async function getProfile(token: string): Promise<IgProfile> {
  const json = await graphFetch(
    `/me?fields=user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(token)}`
  );
  const user_id = texto(json.user_id);
  const username = texto(json.username);
  // Sem id não dá para conectar a conta, e falhar aqui, com a resposta em mãos,
  // é muito mais fácil de diagnosticar do que um id vazio salvo no banco.
  if (!user_id || !username) {
    throw new IgError(502, `perfil sem user_id ou username: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return {
    user_id,
    username,
    name: texto(json.name),
    profile_picture_url: texto(json.profile_picture_url),
  };
}

// OS CAMPOS DE WEBHOOK QUE ESTE APP ASSINA, num lugar só.
//
// Estavam escritos duas vezes — aqui e no padrão de `configureAppWebhook`, logo
// abaixo —, e as duas assinaturas são de NÍVEIS DIFERENTES: esta é por CONTA
// (`/{ig_user_id}/subscribed_apps`), a outra é do APP inteiro
// (`/{app_id}/subscriptions`, no Graph do Facebook). As duas precisam listar o
// mesmo campo para o evento chegar; com a lista escrita em dois lugares, mexer
// num e esquecer o outro dá um webhook que não entrega e não acusa.
//
// `messaging_postbacks` e `messaging_referral` entraram para o EXPERIMENTO DE
// PRIMEIRO CONTATO (docs/experimentos/2026-08-26-primeiro-contato.md). A razão
// está medida na documentação da Meta, e não deduzida:
//
//   - `messaging_referral` só chega "when an ig.me link with a referral
//     parameter is clicked by a customer in an existing conversation" — o tipo
//     `OPEN_THREAD` é anotado lá como "Only supported for existing
//     conversations".
//   - No PRIMEIRO contato, quem carrega o marcador é outro evento: quem toca
//     numa pergunta de abertura cai em `messaging_postbacks` (com o `referral`
//     dentro do `postback`), e quem digita direto cai em `messages`.
//
// As permissões são as MESMAS de `messages` (`instagram_business_basic` e
// `instagram_business_manage_messages`, tabela de permissões da página de
// webhooks da Instagram Platform), então assinar os dois campos novos não pede
// revisão nova da Meta — medido, porque essa era a dúvida.
//
// ESTA LINHA É A MORTE NA ORIGEM, e agora ela tem rede. Apagar um campo daqui é
// um token, passa por tsc, eslint, testes puros, varredura e integração — e a
// Meta PARA DE ENTREGAR o evento, antes de qualquer linha deste repositório
// rodar. E o conferidor de /setup (`app/setup/subscription-status.tsx`) lê ESTA
// MESMA string, então ele diria "recebendo eventos ✓" enquanto nada chega: a
// tela vira a prova de que está tudo bem justamente quando não está.
//
// Quem segura é `tests/campos-de-webhook.test.ts`, e ele não pergunta de novo a
// esta linha: ele parte de `FORMAS_DO_MOTOR` (lib/webhook-messaging.ts) — as
// formas de `entry.messaging[]` que o motor trata — e exige, para cada uma, o
// campo que a entrega. Dois arquivos, e não um.
//
// MUDAR ESTA LISTA NÃO REASSINA NINGUÉM. A inscrição por conta acontece uma vez,
// no OAuth (app/api/oauth/callback/route.ts). Quem já está conectado só passa a
// receber o campo novo depois que alguém apertar "Reassinar webhooks" no
// /setup — que é `reassinarWebhooks()`, em app/setup/actions.ts, e não
// desconecta nada.
export const CAMPOS_DE_WEBHOOK = "comments,messages,messaging_postbacks,messaging_referral";

export async function subscribeToWebhooks(igUserId: string, token: string): Promise<Json> {
  return graphFetch(
    `/${igUserId}/subscribed_apps?subscribed_fields=${CAMPOS_DE_WEBHOOK}&access_token=${encodeURIComponent(token)}`,
    { method: "POST" }
  );
}

// Configura o webhook do APP direto pela API (callback + verify token + campos),
// no lugar de o usuário colar isso no painel da Meta. Usa o app access token
// (app_id|app_secret) — não precisa de OAuth. A Meta faz o handshake GET no
// callback na hora desta chamada, então o /api/webhook já tem que estar no ar
// respondendo ao verify token (ele responde: config.webhook_verify_token).
export async function configureAppWebhook(opts: {
  appId: string;
  appSecret: string;
  callbackUrl: string;
  verifyToken: string;
  fields?: string;
}): Promise<Json> {
  const body = new URLSearchParams({
    object: "instagram",
    callback_url: opts.callbackUrl,
    verify_token: opts.verifyToken,
    fields: opts.fields ?? CAMPOS_DE_WEBHOOK,
    access_token: `${opts.appId}|${opts.appSecret}`,
  });
  const res = await fetch(`${FB_GRAPH}/${API_VERSION}/${opts.appId}/subscriptions`, {
    method: "POST",
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new IgError(res.status, text);
  return text ? (JSON.parse(text) as Json) : {};
}

// Quais campos esta conta está assinando hoje. Serve de diagnóstico: se a
// assinatura falhou lá no OAuth, nada chega e não há aviso nenhum.
// null = não deu para consultar.
export async function getSubscribedFields(
  igUserId: string,
  token: string
): Promise<string[] | null> {
  try {
    const json = await graphFetch(
      `/${igUserId}/subscribed_apps?access_token=${encodeURIComponent(token)}`
    );
    const data = (json.data as { subscribed_fields?: string[] }[]) ?? [];
    return data.flatMap((d) => d.subscribed_fields ?? []);
  } catch {
    return null;
  }
}

export async function getMedia(igUserId: string, token: string, limit = 30): Promise<Json[]> {
  const json = await graphFetch(
    `/${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,caption,permalink&limit=${limit}&access_token=${encodeURIComponent(token)}`
  );
  return (json.data as Json[]) ?? [];
}

// Um post específico, pelo id. Serve para o comentário que veio de um post
// antigo, fora da janela que getMedia() devolve.
export async function getMediaById(mediaId: string, token: string): Promise<Json> {
  return graphFetch(
    `/${mediaId}?fields=id,media_type,media_url,thumbnail_url,caption,permalink&access_token=${encodeURIComponent(token)}`
  );
}

// Stories ativos (últimas 24h) — vivem em outro edge, não em /media.
export async function getStories(igUserId: string, token: string): Promise<Json[]> {
  const json = await graphFetch(
    `/${igUserId}/stories?fields=id,media_type,media_url,thumbnail_url,caption,permalink&access_token=${encodeURIComponent(token)}`
  );
  return (json.data as Json[]) ?? [];
}

// Perfil de quem mandou DM (User Profile API). O webhook só entrega o IGSID;
// sem esta chamada o contato fica salvo apenas como número.
export async function getUserProfile(
  igsid: string,
  token: string
): Promise<{ username?: string; name?: string; profile_pic?: string }> {
  const json = await graphFetch(
    `/${igsid}?fields=username,name,profile_pic&access_token=${encodeURIComponent(token)}`
  );
  // Aqui nada é obrigatório: conta privada ou apagada devolve resposta magra, e
  // quem chama já trata isso guardando só o que veio.
  return {
    username: texto(json.username),
    name: texto(json.name),
    profile_pic: texto(json.profile_pic),
  };
}

// A Meta informa se a pessoa segue a conta conectada. Fica numa chamada
// SEPARADA de propósito: se este campo exigir permissão extra e falhar, os
// nomes e fotos dos contatos continuam funcionando normalmente.
//
// `segue: null` = não deu para saber (NUNCA tratar como "não segue"), e `erro`
// diz por quê.
//
// A DEVOLUÇÃO DEIXOU DE SER `boolean | null` E O MOTIVO ESTÁ MEDIDO. Aqui havia
// `catch { return null }`: o erro da Meta morria dentro deste bloco, e o motor
// registrava `follow_check_unavailable` sem uma palavra sobre a causa. Em
// 28/08/2026 esse registro tinha 6 linhas e ninguém sabia dizer por quê — o chat
// de monitoramento leu o sintoma e chutou "400 code 190". Perguntando à Meta em
// leitura, com controle pareado, o número real era **230** (falta de
// consentimento do perfil), e o token estava bom.
//
// As DUAS formas de não saber continuam distintas de propósito, e é por isso
// que `erro` pode ser `null` com `segue: null`:
//   - a chamada FALHOU        → `erro` preenchido
//   - a Meta respondeu SEM o campo → `erro: null`
// Quem registra separa as duas na tela; juntá-las devolveria o silêncio pela
// porta dos fundos.
export async function checkFollowsAccount(
  igsid: string,
  token: string
): Promise<{ segue: boolean | null; erro: ResumoDoErroDaMeta | null }> {
  try {
    const json = await graphFetch(
      `/${igsid}?fields=is_user_follow_business&access_token=${encodeURIComponent(token)}`
    );
    const v = (json as { is_user_follow_business?: boolean }).is_user_follow_business;
    return { segue: typeof v === "boolean" ? v : null, erro: null };
  } catch (e) {
    // `resumoDoErroDaMeta` apaga o token antes de devolver, e isso importa
    // NESTA chamada em particular: o endereço acima leva o `access_token` na
    // query, então um erro de rede que carregue a URL chegaria com o segredo
    // dentro — e daqui ele iria direto para uma tela que o dono abre.
    return { segue: null, erro: resumoDoErroDaMeta(e) };
  }
}

// Reage a uma mensagem recebida (o coraçãozinho da DM).
export async function sendReaction(
  igUserId: string,
  token: string,
  recipientIgsid: string,
  messageId: string,
  emoji: string
): Promise<Json> {
  return graphFetch(`/${igUserId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      sender_action: "react",
      payload: { message_id: messageId, reaction: emoji },
    }),
  });
}

// ---------- Envio de mensagens ----------

export type Recipient = { comment_id: string } | { id: string };

export type OutgoingMessage =
  | { text: string; quick_replies?: { content_type: "text"; title: string; payload: string }[] }
  | {
      attachment: {
        type: "template";
        payload: {
          template_type: "button";
          text: string;
          buttons: { type: "web_url"; url: string; title: string }[];
        };
      };
    };

export type SendResult = { message_id: string | null; recipient_id: string | null };

export async function sendMessage(
  igUserId: string,
  token: string,
  recipient: Recipient,
  message: OutgoingMessage
): Promise<SendResult> {
  const json = await graphFetch(`/${igUserId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recipient, message }),
  });
  // A Meta devolve message_id e recipient_id. Campo ausente vira null em vez de
  // undefined, para o banco receber sempre algo gravável.
  return {
    message_id: texto(json.message_id) ?? null,
    recipient_id: texto(json.recipient_id) ?? null,
  };
}

export async function replyToComment(
  commentId: string,
  token: string,
  text: string
): Promise<Json> {
  const body = new URLSearchParams({ message: text });
  return graphFetch(`/${commentId}/replies?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    body,
  });
}

// Texto com botão de link (template de botão) ou só texto, se não houver URL.
export function linkMessage(text: string, buttonLabel: string, url: string): OutgoingMessage {
  if (!url) return { text };
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text,
        buttons: [{ type: "web_url", url, title: buttonLabel || "Abrir link" }],
      },
    },
  };
}
