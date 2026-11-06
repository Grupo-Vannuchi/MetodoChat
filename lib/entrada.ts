import "server-only";
import { hashDaSenha, normalizarEmail, senhaConfere } from "./logins";
import { loginParaEntrar } from "./logins-repositorio";

// A CONFERÊNCIA DA ENTRADA (docs/specs/2026-11-04-logins.md, seção 3): devolve o id do login que entrou, ou
// null. Toda entrada errada é a mesma para quem está do lado de fora: o e-mail que não existe, a senha
// errada, o login desativado e o login sem senha dão o mesmo null, e quem chama mostra uma frase só.
//
// O TEMPO TAMBÉM NÃO PODE CONTAR: o e-mail que não existe e o login sem senha pagam um scrypt de fachada,
// para a resposta não sair mais rápida que a de um login com senha.

// Um hash qualquer, feito uma vez por processo, só para gastar o tempo de uma conferência.
let hashDeFachada: Promise<string> | null = null;
async function gastarOTempoDeUmaConferencia(senha: string): Promise<void> {
  hashDeFachada ??= hashDaSenha("a senha de fachada da entrada");
  await senhaConfere(senha, await hashDeFachada);
}

export async function conferirEntrada(emailBruto: string, senha: string): Promise<string | null> {
  const email = normalizarEmail(emailBruto);
  const login = email ? await loginParaEntrar(email) : null;

  // O LOGIN SEM SENHA NÃO ENTRA (docs/specs/2026-11-05-contas-por-login.md, seção 5). Até a entrega 2, ele
  // entrava uma vez pela senha única do ambiente e gravava ali a senha própria (a passagem). Desde a entrega
  // 2, todo login tem senha própria, e o que não tem recebe a resposta de qualquer entrada errada: o mesmo
  // null, com o mesmo scrypt de fachada do e-mail que não existe.
  if (!login || login.senha_hash === null) {
    await gastarOTempoDeUmaConferencia(senha);
    return null;
  }

  const confere = await senhaConfere(senha, login.senha_hash);
  return confere && !login.desativado ? login.id : null;
}
