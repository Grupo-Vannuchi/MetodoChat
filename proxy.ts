import { NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

// Next 16: middleware.ts virou proxy.ts (roda em Node).
// Protege o painel com a sessão de senha; rotas públicas passam direto.
const PUBLIC_PREFIXES = [
  "/api/webhook",
  "/api/oauth",
  "/api/cron",
  "/api/queue/tick",
  "/privacidade",
  "/exclusao-de-dados",
  "/entrar",
  "/_next",
  "/favicon.ico",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  return NextResponse.redirect(url);
}

// O MATCHER TIRA DO PORTEIRO SÓ O QUE É ARQUIVO DO NEXT E O FAVICON. Até 26/10/2026 ele tirava qualquer
// endereço terminado em .svg, .png, .jpg ou .ico, inclusive o de uma tela de segmento dinâmico
// (`/conversas/x.png`), e uma Server Action chamada num caminho fora do matcher pula o porteiro junto
// (docs/specs/2026-10-26-sessao-conferida.md). tests/proxy-matcher.test.ts confere pelo verificador do Next.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico$).*)"],
};
