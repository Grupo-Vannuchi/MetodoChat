"use server";
import { redirect } from "next/navigation";
import { exigirSessao } from "@/lib/exigir-sessao";
import { ipDoCliente } from "@/lib/ip-do-cliente";
import { hashDaSenha, senhaConfere, senhaValida } from "@/lib/logins";
import { senhaHashDoLogin, trocarPropriaSenha } from "@/lib/logins-repositorio";
import {
  FRASE_DA_CONFIRMACAO,
  FRASE_DA_SENHA,
  FRASE_DA_SENHA_ATUAL,
  FRASE_DA_SENHA_TROCADA,
  FRASE_DO_LOGIN_QUE_NAO_EXISTE,
} from "@/lib/logins-textos";
import { clearAttempts, isLockedOut, LOCKOUT_MESSAGE, recordFailure } from "@/lib/login-throttle";
import { fecharSessao, sessaoAtual } from "@/lib/sessao";

// A MINHA CONTA E O SAIR (docs/specs/2026-11-04-logins.md, seção 5), para qualquer login.

export type EstadoDaTroca = { erro?: string; ok?: string };

/**
 * A TROCA DA PRÓPRIA SENHA. A senha atual passa pelo MESMO FREIO da entrada (achado 171): ela é conferida
 * pelo scrypt, e sem freio uma sessão roubada testaria senhas à vontade e, achando, trocaria a senha e
 * trancaria o dono. A troca derruba as OUTRAS sessões do login e mantém a de quem trocou.
 */
export async function trocarMinhaSenha(_anterior: EstadoDaTroca, formData: FormData): Promise<EstadoDaTroca> {
  await exigirSessao();
  const login = await sessaoAtual();
  if (!login) redirect("/entrar");
  const ip = await ipDoCliente();
  if (await isLockedOut(ip)) return { erro: LOCKOUT_MESSAGE };

  const hash = await senhaHashDoLogin(login.id);
  if (!hash || !(await senhaConfere(String(formData.get("atual") ?? ""), hash))) {
    await recordFailure(ip);
    return { erro: FRASE_DA_SENHA_ATUAL };
  }
  await clearAttempts(ip);

  const nova = String(formData.get("nova") ?? "");
  if (!senhaValida(nova)) return { erro: FRASE_DA_SENHA };
  if (nova !== String(formData.get("confirmacao") ?? "")) return { erro: FRASE_DA_CONFIRMACAO };
  const ok = await trocarPropriaSenha(login.id, await hashDaSenha(nova), login.sessao_id);
  return ok ? { ok: FRASE_DA_SENHA_TROCADA } : { erro: FRASE_DO_LOGIN_QUE_NAO_EXISTE };
}

/**
 * O SAIR: apaga a sessão no banco e o cookie, e volta para a tela de entrar. É uma action, chamada por um
 * formulário (POST), e nunca um GET nem um link (achado 169): o Next pré-carrega os links e as rotas GET, e
 * um Sair por GET derrubaria a sessão de quem só passou o mouse.
 */
export async function sair(): Promise<void> {
  await exigirSessao();
  await fecharSessao();
  redirect("/entrar");
}
