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

/** O aviso que volta à página Logins pela URL, depois de desativar ou reativar. A lista é fechada. */
export const AVISOS_DA_PAGINA = {
  desativado: "Login desativado. As sessões dele caíram.",
  reativado: "Login reativado. A pessoa já pode entrar de novo.",
  proprio: "Você não pode desativar o seu próprio login.",
  ultimo_administrador: "Esse é o último administrador ativo, e o painel não pode ficar sem nenhum.",
  nao_encontrado: "Esse login não existe, ou já estava desativado.",
} as const;

export type AvisoDaPagina = keyof typeof AVISOS_DA_PAGINA;

/** O aviso de um parâmetro da URL, ou nulo: o texto que veio na URL nunca aparece. */
export function avisoDaPagina(valor: string | string[] | undefined): string | null {
  return typeof valor === "string" && Object.hasOwn(AVISOS_DA_PAGINA, valor)
    ? AVISOS_DA_PAGINA[valor as AvisoDaPagina]
    : null;
}
