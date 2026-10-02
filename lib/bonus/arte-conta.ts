// A CONTA DO CABEÇALHO DA ARTE: qual conta do Instagram assina os slides. PURO.
//
// A regra é do Eduardo (01/10): a conta gravada no carrossel; sem ela, a selecionada no Chat agora;
// e a gravada que foi desconectada cai na selecionada, com aviso na tela (achado 61). A
// selecionada segue a regra do painel (lib/account.ts, `getSelectedAccount`): a do cookie, e sem
// ela a primeira conectada. Esta função não lê o cookie nem o banco: recebe os dois.

/** Só as colunas que o cabeçalho usa, e nunca o token (achado 60). */
export type ContaDoCabecalho = {
  ig_user_id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
};

export type OrigemDaConta = "gravada" | "selecionada" | "gravada_saiu";

export function resolverConta(
  contas: ContaDoCabecalho[],
  gravada: string | null,
  doCookie: string | undefined
): { conta: ContaDoCabecalho | null; origem: OrigemDaConta } {
  const achada = gravada ? contas.find((c) => c.ig_user_id === gravada) : undefined;
  if (achada) return { conta: achada, origem: "gravada" };
  const selecionada = contas.find((c) => c.ig_user_id === doCookie) ?? contas[0] ?? null;
  return { conta: selecionada, origem: gravada ? "gravada_saiu" : "selecionada" };
}

/**
 * As iniciais no lugar da foto, com a regra do Labs (site-ia, src/lib/foto-de-perfil.ts): duas
 * letras do nome de uma palavra, ou a primeira e a última de duas ou mais. `padrao` é o que sai
 * sem nome nenhum.
 */
export function iniciais(nome: string | null | undefined, padrao: string): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return padrao;
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
