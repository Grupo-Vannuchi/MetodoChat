// A ESCOLHA DA CONTA DE UM LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2). PURA: recebe as contas
// que o login pode ver e o cookie, e devolve uma delas. Quem monta a lista é lib/acesso.ts, o único lugar que
// sabe quem vê qual conta; esta função só escolhe nela.
//
// O COOKIE NUNCA ESCOLHE FORA DA LISTA. Antes desta entrega, a escolha (lib/account.ts, app/layout.tsx e
// lib/bonus/arte-conta.ts) procurava o cookie em TODAS as contas, e o cookie era a única coisa entre um login e
// a conta de outro. Agora o cookie só desempata dentro do que o login já pode ver.

/** A do cookie, se estiver entre as permitidas; senão, a primeira permitida; senão, nenhuma. */
export function escolherConta<T extends { ig_user_id: string }>(
  permitidas: T[],
  doCookie: string | null | undefined
): T | null {
  return permitidas.find((c) => c.ig_user_id === doCookie) ?? permitidas[0] ?? null;
}
