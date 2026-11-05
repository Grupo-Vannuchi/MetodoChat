import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./auth";
import { apagarSessao, criarSessao, sessaoPorCodigo, type LoginDaSessao } from "./logins-repositorio";

// A SESSÃO NO BANCO (docs/specs/2026-11-04-logins.md, seção 2). O cookie leva um código sorteado, e o banco
// guarda o SHA-256 dele, o login e o prazo. Todos os lugares que conferiam a assinatura do cookie v2 (o
// porteiro, o `exigirSessao`, as rotas e o layout) passam por aqui.
//
// SEM BANCO, SEM PAINEL: se a consulta falhar, a sessão não vale. O cookie v2 de antes de 04/11/2026 não
// tem o formato do código, e cai na primeira conferência, sem consulta.

export type { LoginDaSessao };

/** O login de um valor de cookie, ou null. Serve ao porteiro e às rotas, que leem o cookie do pedido. */
export async function sessaoDoCookie(valor: string | undefined): Promise<LoginDaSessao | null> {
  try {
    return await sessaoPorCodigo(valor);
  } catch {
    return null;
  }
}

/**
 * O login da sessão desta requisição, ou null. Memorizada por requisição com o `cache` do React, para a
 * página, o layout e as actions não repetirem a consulta.
 */
export const sessaoAtual = cache(async (): Promise<LoginDaSessao | null> => {
  return sessaoDoCookie((await cookies()).get(SESSION_COOKIE)?.value);
});

/** Abre a sessão do login e grava o cookie. */
export async function abrirSessao(loginId: string): Promise<void> {
  const codigo = await criarSessao(loginId);
  (await cookies()).set(SESSION_COOKIE, codigo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

/** O Sair: apaga a sessão no banco e o cookie. */
export async function fecharSessao(): Promise<void> {
  const jarra = await cookies();
  await apagarSessao(jarra.get(SESSION_COOKIE)?.value);
  jarra.delete(SESSION_COOKIE);
}
