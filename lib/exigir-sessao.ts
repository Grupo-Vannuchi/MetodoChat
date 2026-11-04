import "server-only";
import { redirect } from "next/navigation";
import { sessaoAtual } from "./sessao";

// A CONFERÊNCIA DE SESSÃO DAS SERVER ACTIONS, para a primeira instrução de cada uma
// (docs/specs/2026-10-26-sessao-conferida.md). O proxy.ts não basta: uma Server Action é chamada por
// POST na rota em que é usada, e um caminho fora do matcher pula também a chamada dela.
//
// O CORPO É O MESMO DAS SEIS CÓPIAS LOCAIS de app/bonus/*-actions.ts, app/bonus/actions.ts e
// app/carrosseis/actions.ts, que ficaram como estavam. tests/sessao-nas-actions.test.ts cobra que
// toda ação de todo arquivo "use server" comece por `await exigirSessao();`.
//
// DESDE OS LOGINS (docs/specs/2026-11-04-logins.md) a sessão é conferida no banco, por `sessaoAtual()`
// (lib/sessao.ts): a sessão apagada pelo Sair, a de login desativado e a vencida não passam.
//
// ESTE ARQUIVO NÃO É "use server", de propósito: se fosse, `exigirSessao` seria ela mesma uma ação,
// chamável de fora.
export async function exigirSessao(): Promise<void> {
  if (!(await sessaoAtual())) redirect("/entrar");
}
