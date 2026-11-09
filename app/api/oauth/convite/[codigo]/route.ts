import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/ig";
import {
  novoOauthState,
  OAUTH_CONVITE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { getConfig } from "@/lib/db";
import { canonicalAppUrl } from "@/lib/app-url";
import { estadoDoConvite } from "@/lib/convites";
import { conviteDoCodigo } from "@/lib/convites-repositorio";
import {
  ambienteDaVercel,
  baseDoPainelParaOLinkedin,
  CAMINHO_DA_VOLTA_DO_LINKEDIN,
  credenciaisDoLinkedin,
  urlDeAutorizacaoDoLinkedin,
} from "@/lib/linkedin";

// O COMEÇO DA CONEXÃO PELO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). É pública, porque
// `/api/oauth` está na PUBLIC_PREFIXES do proxy.ts: quem abre é o cliente, sem a senha do painel, e quem
// confere é o código do link.
//
// COM O CONVITE PENDENTE, faz o mesmo que `/api/oauth/login` faz depois da sessão, e grava também o id do
// convite num segundo cookie, para a volta saber que a conexão é do cliente. Sem o convite pendente, volta
// para a página do link, que mostra a frase do link que não vale, sem `state` nenhum.
//
// NÃO GRAVA O `app_url`, ao contrário do começo de hoje: uma rota aberta não escreve na configuração.
//
// O CONVITE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3) vai à autorização do LinkedIn, com
// os mesmos dois cookies, e volta pela rota dele (app/api/oauth/linkedin/callback). As chaves do app vêm das
// variáveis da Vercel, e a volta é a do endereço do painel para o LinkedIn (`baseDoPainelParaOLinkedin`): o
// canônico na produção, o da branch no preview.
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const convite = await conviteDoCodigo(codigo);
  if (!convite || estadoDoConvite(convite, Date.now()) !== "pendente") {
    return NextResponse.redirect(`${req.nextUrl.origin}/convite/${encodeURIComponent(codigo)}`);
  }
  const config = await getConfig();
  const state = novoOauthState();
  let destino: string;
  if (convite.rede === "linkedin") {
    const chaves = credenciaisDoLinkedin();
    if (!chaves) {
      return NextResponse.redirect(`${req.nextUrl.origin}/convite/erro?motivo=falhou&rede=linkedin`);
    }
    const base = baseDoPainelParaOLinkedin(ambienteDaVercel(), canonicalAppUrl(config.app_url, req.nextUrl.origin));
    destino = urlDeAutorizacaoDoLinkedin(chaves.clientId, `${base}${CAMINHO_DA_VOLTA_DO_LINKEDIN}`, state);
  } else {
    if (!config.instagram_app_id) {
      return NextResponse.redirect(`${req.nextUrl.origin}/convite/erro?motivo=falhou`);
    }
    // O MESMO `redirect_uri` canônico do começo de hoje: ele tem de bater com o cadastrado na Meta, e o
    // cookie do `state` só volta junto se o começo acontecer no endereço da volta (achado 136).
    const redirectUri = `${canonicalAppUrl(config.app_url, req.nextUrl.origin)}/api/oauth/callback`;
    destino = authorizeUrl(config.instagram_app_id, redirectUri, state);
  }
  const res = NextResponse.redirect(destino);
  const opcoes = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/oauth",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  };
  res.cookies.set(OAUTH_STATE_COOKIE, state, opcoes);
  res.cookies.set(OAUTH_CONVITE_COOKIE, convite.id, opcoes);
  return res;
}
