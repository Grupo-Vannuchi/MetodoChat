"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdministrador, exigirSessao } from "@/lib/exigir-sessao";
import { hashDaSenha, nomeValido, normalizarEmail, senhaValida } from "@/lib/logins";
import {
  criarLogin,
  definirContasDoLogin,
  definirPapelDoLogin,
  definirSenha,
  desativarLogin,
  reativarLogin,
  type ResultadoDasContas,
} from "@/lib/logins-repositorio";
import {
  FRASE_CONTAS_SALVAS,
  FRASE_DA_CONTA_QUE_NAO_EXISTE,
  FRASE_DA_SENHA,
  FRASE_DA_SENHA_NOVA_DEFINIDA,
  FRASE_DO_EMAIL,
  FRASE_DO_EMAIL_REPETIDO,
  FRASE_DO_LOGIN_ADMINISTRADOR,
  FRASE_DO_LOGIN_QUE_NAO_EXISTE,
  FRASE_DO_NOME,
} from "@/lib/logins-textos";

// AS AÇÕES DA PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4), só para administrador. Cada uma
// começa por `await exigirSessao();` (tests/sessao-nas-actions.test.ts) e, logo depois, confere o
// administrador no servidor: o menu esconder o item não basta, porque Server Action tem endereço próprio.
//
// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4): o papel de um login novo vem
// da caixinha "Administrador"; as contas de um login comum se trocam de uma vez; e o papel se troca com as
// mesmas travas do desativar. As travas moram no repositório (lib/logins-repositorio.ts).

export type EstadoDoFormulario = { erro?: string; ok?: string };

export async function criarLoginAction(
  _anterior: EstadoDoFormulario,
  formData: FormData
): Promise<EstadoDoFormulario> {
  await exigirSessao();
  await exigirAdministrador();
  const nome = nomeValido(String(formData.get("nome") ?? ""));
  const email = normalizarEmail(String(formData.get("email") ?? ""));
  const senha = String(formData.get("senha") ?? "");
  if (!nome) return { erro: FRASE_DO_NOME };
  if (!email) return { erro: FRASE_DO_EMAIL };
  if (!senhaValida(senha)) return { erro: FRASE_DA_SENHA };
  // O PAPEL VAI SEMPRE EXPLÍCITO, pela caixinha "Administrador", que nasce desmarcada: sem ela, o login é comum.
  const administrador = formData.get("administrador") === "on";
  const r = await criarLogin({ email, nome, senhaHash: await hashDaSenha(senha), administrador });
  if ("erro" in r) return { erro: FRASE_DO_EMAIL_REPETIDO };
  revalidatePath("/logins");
  return { ok: `Login de ${nome} criado. Passe a senha inicial a ${nome}.` };
}

export async function definirSenhaAction(
  _anterior: EstadoDoFormulario,
  formData: FormData
): Promise<EstadoDoFormulario> {
  await exigirSessao();
  await exigirAdministrador();
  const senha = String(formData.get("senha") ?? "");
  if (!senhaValida(senha)) return { erro: FRASE_DA_SENHA };
  const ok = await definirSenha(String(formData.get("id") ?? ""), await hashDaSenha(senha));
  if (!ok) return { erro: FRASE_DO_LOGIN_QUE_NAO_EXISTE };
  revalidatePath("/logins");
  return { ok: FRASE_DA_SENHA_NOVA_DEFINIDA };
}

export async function desativarLoginAction(formData: FormData): Promise<void> {
  await exigirSessao();
  const quem = await exigirAdministrador();
  const resultado = await desativarLogin(String(formData.get("id") ?? ""), quem.id);
  revalidatePath("/logins");
  redirect(`/logins?aviso=${resultado}`);
}

export async function reativarLoginAction(formData: FormData): Promise<void> {
  await exigirSessao();
  await exigirAdministrador();
  const ok = await reativarLogin(String(formData.get("id") ?? ""));
  revalidatePath("/logins");
  redirect(`/logins?aviso=${ok ? "reativado" : "nao_encontrado"}`);
}

/** A recusa de cada resultado do repositório que não é "ok". */
const RECUSA_DAS_CONTAS: Record<Exclude<ResultadoDasContas, "ok">, string> = {
  administrador: FRASE_DO_LOGIN_ADMINISTRADOR,
  nao_encontrado: FRASE_DO_LOGIN_QUE_NAO_EXISTE,
  conta_inexistente: FRASE_DA_CONTA_QUE_NAO_EXISTE,
};

/**
 * O "SALVAR CONTAS" DE UM LOGIN COMUM: as caixinhas marcadas trocam o conjunto de uma vez, numa transação do
 * repositório, que recusa o administrador (ele vê todas), o login que não existe e a conta que não existe, sem
 * mudar nada. A resposta volta como estado do formulário, como a senha nova.
 */
export async function definirContasDoLoginAction(
  _anterior: EstadoDoFormulario,
  formData: FormData
): Promise<EstadoDoFormulario> {
  await exigirSessao();
  await exigirAdministrador();
  const contas = formData.getAll("contas").map((c) => String(c));
  const resultado = await definirContasDoLogin(String(formData.get("id") ?? ""), contas);
  if (resultado !== "ok") return { erro: RECUSA_DAS_CONTAS[resultado] };
  revalidatePath("/logins");
  return { ok: FRASE_CONTAS_SALVAS };
}

/**
 * "TORNAR ADMINISTRADOR" E "TORNAR COMUM": o papel novo vem do campo `papel`, e as travas são as do desativar
 * (ninguém muda o próprio papel, e o último administrador ativo não vira comum). Um papel que não é dos dois
 * não chega ao repositório, e volta com o aviso de não achado, como um id torto.
 */
export async function definirPapelDoLoginAction(formData: FormData): Promise<void> {
  await exigirSessao();
  const quem = await exigirAdministrador();
  const papel = formData.get("papel");
  if (papel !== "administrador" && papel !== "comum") redirect("/logins?aviso=nao_encontrado");
  const virarAdministrador = papel === "administrador";
  const resultado = await definirPapelDoLogin(String(formData.get("id") ?? ""), virarAdministrador, quem.id);
  revalidatePath("/logins");
  const aviso =
    resultado === "ok"
      ? virarAdministrador
        ? "virou_administrador"
        : "virou_comum"
      : resultado === "proprio"
        ? "papel_proprio"
        : resultado;
  redirect(`/logins?aviso=${aviso}`);
}
