import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForShortToken,
  exchangeForLongLivedToken,
  getProfile,
  subscribeToWebhooks,
} from "@/lib/ig";
import { OAUTH_CONVITE_COOKIE, OAUTH_STATE_COOKIE, oauthStateConfere } from "@/lib/auth";
import { getConfig } from "@/lib/db";
import { logEvent } from "@/lib/engine";
import { canonicalAppUrl } from "@/lib/app-url";
import { estadoDoConvite, PREFIXO_DA_ASSINATURA, textoParaOPainel, type MotivoDoErro } from "@/lib/convites";
import { anotarErroDoConvite, conviteDoId, reivindicarEGravarConta } from "@/lib/convites-repositorio";

// A VOLTA DO INSTAGRAM PELO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). A rota da volta
// (./route.ts) chama esta função quando o cookie do convite veio junto, e o caminho de hoje fica intacto.
//
// QUEM CONECTOU É O CLIENTE, e não alguém do painel: o fim é uma das duas páginas abertas do convite
// (`/convite/pronto` ou `/convite/erro`), nunca o painel, e o cookie da conta selecionada não é gravado.
// Nada do texto da Meta chega ao cliente: ele vai, limpo e cortado, para o `ultimo_erro` do convite.
//
// A ORDEM É A DA SPEC:
// 1. o `state`, antes de qualquer escrita: sem ele, a volta não é de ninguém;
// 2. a recusa no Instagram;
// 3. o convite pendente, antes de chamar a Meta;
// 4. a troca do código, o token longo e o perfil, fora da transação, para ela não ficar aberta durante a rede;
// 5. a reivindicação e a conta, numa transação só (`reivindicarEGravarConta`);
// 6. a assinatura dos webhooks, que não desfaz a conexão (achado 158).
export async function voltaDoConvite(req: NextRequest, conviteId: string): Promise<NextResponse> {
  const appUrl = req.nextUrl.origin;
  const q = req.nextUrl.searchParams;

  // OS DOIS COOKIES SÃO APAGADOS EM TODA RESPOSTA, dê certo ou não: cada `state` e cada convite servem uma
  // tentativa.
  const fim = (caminho: string) => {
    const res = NextResponse.redirect(`${appUrl}${caminho}`);
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    res.cookies.set(OAUTH_CONVITE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    return res;
  };
  const erro = (motivo: MotivoDoErro) => fim(`/convite/erro?motivo=${motivo}`);
  // Anotar não pode derrubar a resposta: o cliente vê a frase do erro de qualquer jeito.
  const anotar = async (texto: string, estado: "pendente" | "usado") => {
    try {
      await anotarErroDoConvite(conviteId, texto, estado);
    } catch {
      // banco fora do ar: a frase do erro ainda chega ao cliente
    }
  };

  if (!oauthStateConfere(req.cookies.get(OAUTH_STATE_COOKIE)?.value, q.get("state"))) return erro("falhou");

  if (q.get("error")) {
    await anotar("autorização negada", "pendente");
    return erro("negado");
  }

  // SÓ O CONVITE DO INSTAGRAM (docs/specs/2026-11-06-linkedin-no-perfil.md, §3): o do LinkedIn grava os mesmos
  // cookies, e aqui ele não chama a Meta nem conecta conta nenhuma.
  const convite = await conviteDoId(conviteId);
  if (!convite || convite.rede !== "instagram" || estadoDoConvite(convite, Date.now()) !== "pendente") {
    return erro("vencido");
  }

  const code = q.get("code");
  if (!code) {
    await anotar("código ausente", "pendente");
    return erro("falhou");
  }
  const config = await getConfig();
  if (!config.instagram_app_id || !config.instagram_app_secret) {
    await anotar("App ID e chave secreta não cadastrados no /setup", "pendente");
    return erro("falhou");
  }

  // OS SEGREDOS DESTA VOLTA, que nunca vão para o `ultimo_erro` (achado 159).
  const segredos: (string | null | undefined)[] = [code, config.instagram_app_secret];
  const mensagem = (err: unknown) => (err instanceof Error ? err.message : "erro desconhecido");

  let conta: Parameters<typeof reivindicarEGravarConta>[1];
  try {
    const short = await exchangeCodeForShortToken({
      appId: config.instagram_app_id,
      appSecret: config.instagram_app_secret,
      // precisa ser IDÊNTICO ao usado no começo
      redirectUri: `${canonicalAppUrl(config.app_url, appUrl)}/api/oauth/callback`,
      code,
    });
    segredos.push(short.access_token);
    const long = await exchangeForLongLivedToken(config.instagram_app_secret, short.access_token);
    segredos.push(long.access_token);
    const profile = await getProfile(long.access_token);
    conta = {
      ig_user_id: String(profile.user_id ?? short.user_id),
      username: profile.username ?? null,
      name: profile.name ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
      access_token: long.access_token,
      token_expires_at: new Date(Date.now() + long.expires_in * 1000),
    };
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos), "pendente");
    return erro("falhou");
  }

  let conectou: boolean;
  try {
    conectou = await reivindicarEGravarConta(conviteId, conta);
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos), "pendente");
    return erro("falhou");
  }
  // Outra aba com o mesmo link, ou o convite cancelado no meio: a conta não foi gravada.
  if (!conectou) return erro("vencido");

  try {
    await subscribeToWebhooks(conta.ig_user_id, conta.access_token);
  } catch (err) {
    const aviso = textoParaOPainel(`${PREFIXO_DA_ASSINATURA}${mensagem(err)}`, segredos);
    await anotar(aviso, "usado");
    try {
      await logEvent(conta.ig_user_id, "subscribe_failed", { message: aviso });
    } catch {
      // banco fora do ar: o aviso já foi para o convite, se deu
    }
  }
  return fim("/convite/pronto");
}
