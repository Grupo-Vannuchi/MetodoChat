"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdministrador, exigirSessao } from "@/lib/exigir-sessao";
import { hashDaSenha, nomeValido, normalizarEmail, senhaValida } from "@/lib/logins";
import { criarLogin, definirSenha, desativarLogin, reativarLogin } from "@/lib/logins-repositorio";
import {
  FRASE_DA_SENHA,
  FRASE_DA_SENHA_NOVA_DEFINIDA,
  FRASE_DO_EMAIL,
  FRASE_DO_EMAIL_REPETIDO,
  FRASE_DO_LOGIN_QUE_NAO_EXISTE,
  FRASE_DO_NOME,
} from "@/lib/logins-textos";

// AS AÇÕES DA PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4), só para administrador. Cada uma
// começa por `await exigirSessao();` (tests/sessao-nas-actions.test.ts) e, logo depois, confere o
// administrador no servidor: o menu esconder o item não basta, porque Server Action tem endereço próprio.

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
  const r = await criarLogin({ email, nome, senhaHash: await hashDaSenha(senha) });
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
