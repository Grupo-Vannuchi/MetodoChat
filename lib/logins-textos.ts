// AS FRASES DA PÁGINA LOGINS E DA MINHA CONTA (docs/specs/2026-11-04-logins.md, seções 4 e 5). Puras, para os
// testes lerem a mesma frase que a tela mostra.

export const FRASE_DO_NOME = "O nome vai de 1 a 60 caracteres.";
export const FRASE_DO_EMAIL = "Esse e-mail não parece um e-mail.";
export const FRASE_DA_SENHA = "A senha vai de 10 a 200 caracteres.";
export const FRASE_DO_EMAIL_REPETIDO = "Já existe um login com esse e-mail.";
export const FRASE_DA_CONFIRMACAO = "A senha nova e a confirmação não são iguais.";
export const FRASE_DA_SENHA_ATUAL = "A senha atual não confere.";
export const FRASE_DA_SENHA_NOVA_DEFINIDA = "Senha nova definida. As sessões abertas desse login caíram.";
export const FRASE_DA_SENHA_TROCADA = "Senha trocada. As suas sessões em outros aparelhos caíram.";
export const FRASE_DO_LOGIN_QUE_NAO_EXISTE = "Esse login não existe mais.";

// AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md). Uma frase para cada recusa, e a do comum
// sem conta, que não manda conectar conta, porque o comum não conecta.
export const FRASE_SEM_ACESSO_A_CONTA = "Você não tem acesso a essa conta.";
export const FRASE_CARROSSEL_DE_OUTRA_CONTA = "Esse carrossel é de uma conta que você não tem.";
export const FRASE_SEM_CONTAS = "Você ainda não tem contas. Peça ao administrador.";
export const FRASE_CONTAS_SALVAS = "Contas salvas. Valem já no próximo clique desse login.";
// As duas recusas do "Salvar contas" da página Logins (seção 4). O login que não existe usa a frase de sempre.
export const FRASE_DO_LOGIN_ADMINISTRADOR = "Esse login é administrador e já vê todas as contas.";
export const FRASE_DA_CONTA_QUE_NAO_EXISTE = "Uma das contas marcadas não existe mais. Recarregue a página.";

/**
 * O TEXTO DA PÁGINA SEM CONTA (seção 3): o administrador vê o de hoje, que manda conectar uma conta; o comum
 * vê a frase que manda pedir ao administrador.
 */
export function textoSemConta(administrador: boolean, deHoje: string): string {
  return administrador ? deHoje : FRASE_SEM_CONTAS;
}

/** O aviso que volta à página Logins pela URL, depois de desativar, reativar ou trocar o papel. A lista é fechada. */
export const AVISOS_DA_PAGINA = {
  desativado: "Login desativado. As sessões dele caíram.",
  reativado: "Login reativado. A pessoa já pode entrar de novo.",
  proprio: "Você não pode desativar o seu próprio login.",
  ultimo_administrador: "Esse é o último administrador ativo, e o painel não pode ficar sem nenhum.",
  nao_encontrado: "Esse login não existe, ou já estava desativado.",
  papel_proprio: "Você não pode mudar o seu próprio papel.",
  virou_administrador: "Login agora é administrador. Ele vê todas as contas.",
  virou_comum: "Login agora é comum. Ele vê só as contas marcadas.",
} as const;

export type AvisoDaPagina = keyof typeof AVISOS_DA_PAGINA;

/** O aviso de um parâmetro da URL, ou nulo: o texto que veio na URL nunca aparece. */
export function avisoDaPagina(valor: string | string[] | undefined): string | null {
  return typeof valor === "string" && Object.hasOwn(AVISOS_DA_PAGINA, valor)
    ? AVISOS_DA_PAGINA[valor as AvisoDaPagina]
    : null;
}
