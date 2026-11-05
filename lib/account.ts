import "server-only";
import { cookies } from "next/headers";
import { type Account } from "./db";
import { contaEscolhida } from "./acesso";
import { sessaoAtual } from "./sessao";

// Conta atualmente selecionada no painel. O valor vive num cookie, e ele só desempata DENTRO das contas que o
// login da sessão vê (lib/acesso.ts, docs/specs/2026-11-05-contas-por-login.md, seção 2): ausente, ou de uma
// conta que o login não vê (ou que não existe mais), cai na primeira que ele vê. Sem login, não há conta.
//
// A ASSINATURA NÃO MUDOU com as contas por login, de propósito: os pontos que usam a conta escolhida, e que
// ligam o id do navegador a ela (`... and account_id = $n`), ficam presos às contas do login sem mudar uma
// linha deles (o achado 181, medido em testes-integracao/contas-por-login.integracao.ts).
export const ACCOUNT_COOKIE = "metodochat_account";

export async function getSelectedAccount(): Promise<Account | null> {
  const login = await sessaoAtual();
  if (!login) return null;
  return contaEscolhida(login, (await cookies()).get(ACCOUNT_COOKIE)?.value);
}

export async function getSelectedAccountId(): Promise<string | null> {
  return (await getSelectedAccount())?.ig_user_id ?? null;
}
