import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "./auth";

// A CONFERÊNCIA DE SESSÃO DAS SERVER ACTIONS, para a primeira instrução de cada uma
// (docs/specs/2026-10-26-sessao-conferida.md). O proxy.ts não basta: uma Server Action é chamada por
// POST na rota em que é usada, e um caminho fora do matcher pula também a chamada dela.
//
// O CORPO É O MESMO DAS SEIS CÓPIAS LOCAIS de app/bonus/*-actions.ts, app/bonus/actions.ts e
// app/carrosseis/actions.ts, que ficaram como estavam. tests/sessao-nas-actions.test.ts cobra que
// toda ação de todo arquivo "use server" comece por `await exigirSessao();`.
//
// ESTE ARQUIVO NÃO É "use server", de propósito: se fosse, `exigirSessao` seria ela mesma uma ação,
// chamável de fora.
export async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}
