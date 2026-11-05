import "server-only";
import { senhaUnicaConfere } from "./auth";
import { hashDaSenha, normalizarEmail, senhaConfere } from "./logins";
import { gravarSenhaDaPassagem, loginParaEntrar } from "./logins-repositorio";

// A CONFERÊNCIA DA ENTRADA (docs/specs/2026-11-04-logins.md, seção 3): devolve o id do login que entrou, ou
// null. Toda entrada errada é a mesma para quem está do lado de fora: o e-mail que não existe, a senha
// errada e o login desativado dão o mesmo null, e quem chama mostra uma frase só.
//
// O TEMPO TAMBÉM NÃO PODE CONTAR: o e-mail que não existe paga um scrypt de fachada, para a resposta não
// sair mais rápida que a de um e-mail que existe.

// Um hash qualquer, feito uma vez por processo, só para gastar o tempo de uma conferência.
let hashDeFachada: Promise<string> | null = null;
async function gastarOTempoDeUmaConferencia(senha: string): Promise<void> {
  hashDeFachada ??= hashDaSenha("a senha de fachada da entrada");
  await senhaConfere(senha, await hashDeFachada);
}

export async function conferirEntrada(emailBruto: string, senha: string): Promise<string | null> {
  const email = normalizarEmail(emailBruto);
  const login = email ? await loginParaEntrar(email) : null;
  if (!login) {
    await gastarOTempoDeUmaConferencia(senha);
    return null;
  }

  // A PASSAGEM (seção 6): só um login sem senha aceita a senha única, e só enquanto não tiver senha. O hash
  // é feito ANTES de conferir, para o tempo ser o de uma conferência mesmo quando ela não bate.
  if (login.senha_hash === null) {
    const hash = await hashDaSenha(senha);
    if (login.desativado || !senhaUnicaConfere(senha)) return null;
    return (await gravarSenhaDaPassagem(login.id, hash)) ? login.id : null;
  }

  const confere = await senhaConfere(senha, login.senha_hash);
  return confere && !login.desativado ? login.id : null;
}
