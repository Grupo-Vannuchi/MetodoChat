import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/ig";
import {
  isValidSession,
  novoOauthState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  SESSION_COOKIE,
} from "@/lib/auth";
import { getConfig, updateConfig } from "@/lib/db";
import { canonicalAppUrl, isEphemeralUrl } from "@/lib/app-url";

export async function GET(req: NextRequest) {
  // A CONEXÃO SÓ COMEÇA COM A SESSÃO DO PAINEL. `/api/oauth` está na PUBLIC_PREFIXES do proxy.ts (a volta
  // do Instagram tem de passar), então quem confere é esta rota. Sem sessão, nenhum state é entregue
  // (docs/specs/2026-10-27-cron-e-oauth.md).
  if (!isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.redirect(`${req.nextUrl.origin}/entrar`);
  }
  const config = await getConfig();
  if (!config.instagram_app_id) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/setup?erro=${encodeURIComponent("Cadastre o App ID no passo 2 antes de conectar.")}`
    );
  }
  // O redirect_uri precisa bater EXATAMENTE com o cadastrado na Meta. Usamos a
  // URL canônica (estável) em vez da origem do navegador: se o usuário abrir o
  // painel por uma URL de deployment da Vercel, a origem muda a cada deploy e o
  // OAuth passa a falhar com "Invalid redirect_uri".
  const appUrl = canonicalAppUrl(config.app_url, req.nextUrl.origin);
  if (appUrl !== config.app_url && !isEphemeralUrl(appUrl)) {
    await updateConfig({ app_url: appUrl });
  }
  const redirectUri = `${appUrl}/api/oauth/callback`;
  // UM STATE NOVO POR CONEXÃO, guardado num cookie só das rotas do OAuth e por 10 minutos. O sameSite lax
  // deixa ele ir junto quando o Instagram devolve o navegador à volta, que é uma navegação de topo.
  const state = novoOauthState();
  const res = NextResponse.redirect(authorizeUrl(config.instagram_app_id, redirectUri, state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
  return res;
}
