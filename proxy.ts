import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { sessaoDoCookie } from "@/lib/sessao";

// Next 16: middleware.ts virou proxy.ts (roda em Node).
// Protege o painel com a sessão do login; rotas públicas passam direto.
//
// A SESSÃO É CONFERIDA NO BANCO desde os logins (docs/specs/2026-11-04-logins.md, seção 2). A documentação
// do Next 16 desaconselha consultar o banco no proxy, por desempenho (o proxy roda também nas pré-cargas);
// o desenho aprovado mantém o porteiro como a porta das páginas, e a prova mede o custo antes do PR.
//
// A ORDEM IMPORTA: os caminhos públicos passam ANTES da sessão. O webhook da Meta, o cron, a fila, o OAuth
// e o convite não pagam a consulta, e tests/proxy-ordem.test.ts segura isso.
const PUBLIC_PREFIXES = [
  "/api/webhook",
  "/api/oauth",
  "/api/cron",
  "/api/queue/tick",
  "/privacidade",
  "/exclusao-de-dados",
  // O link de convite, que o cliente abre sem a senha do painel (docs/specs/2026-11-03-link-de-convite.md).
  "/convite",
  "/entrar",
  "/_next",
  "/favicon.ico",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (await sessaoDoCookie(req.cookies.get(SESSION_COOKIE)?.value)) {
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
