// A CONTA DO CARROSSEL, que assina os slides no cabeçalho da arte. PURO.
//
// A regra é do Eduardo (02/10, spec da Etapa 4): o carrossel é da conta logada quando ele nasceu,
// e NUNCA vira de outra. Ele guarda o id, o nome e o @ dela. Conectada, a arte usa os dados atuais
// (com a foto); desconectada, os guardados (com as iniciais, porque o Chat apaga a linha da conta).
// A "conta logada" é a selecionada no painel (lib/account.ts, `getSelectedAccount`): a do cookie,
// e sem ela a primeira conectada. Estas funções não leem o cookie nem o banco: recebem os dois.

/** Só as colunas que o cabeçalho usa, e nunca o token (achado 60). */
export type ContaDoCabecalho = {
  ig_user_id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
};

/** O que o carrossel guarda da conta dele (a coluna `arte`). */
export type ContaGuardada = { conta: string | null; nome: string | null; arroba: string | null };

/**
 * - `gravada`: a conta do carrossel, conectada;
 * - `guardada`: a conta do carrossel, desconectada, com o nome e o @ guardados;
 * - `gravada_saiu`: a conta do carrossel, desconectada, sem o nome guardado (gravada na Etapa 3):
 *   a arte cai na logada, e a página avisa;
 * - `selecionada`: o carrossel é de antes de a conta ser gravada: a arte usa a logada, e a página
 *   oferece "Fixar nesta conta".
 */
export type OrigemDaConta = "gravada" | "guardada" | "selecionada" | "gravada_saiu";

/** A conta logada: a do cookie, senão a primeira conectada, senão nenhuma. */
export function contaSelecionada(contas: ContaDoCabecalho[], doCookie: string | undefined): ContaDoCabecalho | null {
  return contas.find((c) => c.ig_user_id === doCookie) ?? contas[0] ?? null;
}

export function contaParaGuardar(c: ContaDoCabecalho): ContaGuardada {
  return { conta: c.ig_user_id, nome: c.name, arroba: c.username };
}

export function resolverConta(
  contas: ContaDoCabecalho[],
  guardada: ContaGuardada,
  doCookie: string | undefined
): { conta: ContaDoCabecalho | null; origem: OrigemDaConta } {
  if (guardada.conta) {
    const achada = contas.find((c) => c.ig_user_id === guardada.conta);
    if (achada) return { conta: achada, origem: "gravada" };
    if (guardada.nome || guardada.arroba) {
      return {
        conta: { ig_user_id: guardada.conta, username: guardada.arroba, name: guardada.nome, profile_picture_url: null },
        origem: "guardada",
      };
    }
    return { conta: contaSelecionada(contas, doCookie), origem: "gravada_saiu" };
  }
  return { conta: contaSelecionada(contas, doCookie), origem: "selecionada" };
}

/**
 * A CONTA DO "GERAR DE NOVO": a do carrossel original, mesmo desconectada (decisão do Eduardo em
 * 02/10). Sem o nome guardado e com a conta conectada, o nome e o @ vêm da tabela de contas. Só o
 * original sem conta usa a logada agora.
 */
export function contaParaGerarDeNovo(
  contas: ContaDoCabecalho[],
  original: ContaGuardada,
  doCookie: string | undefined
): ContaGuardada | null {
  if (original.conta) {
    const falta = nomeQueFalta(contas, original);
    return falta ? { conta: original.conta, ...falta } : original;
  }
  const logada = contaSelecionada(contas, doCookie);
  return logada ? contaParaGuardar(logada) : null;
}

/**
 * O NOME QUE FALTA: o carrossel tem conta, ela está conectada, e o nome não foi guardado (a Etapa 3
 * gravava só o id). As actions que já gravam no carrossel completam o nome e o @ com isto.
 */
export function nomeQueFalta(contas: ContaDoCabecalho[], g: ContaGuardada): { nome: string | null; arroba: string | null } | null {
  if (!g.conta || g.nome || g.arroba) return null;
  const achada = contas.find((c) => c.ig_user_id === g.conta);
  return achada ? { nome: achada.name, arroba: achada.username } : null;
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
