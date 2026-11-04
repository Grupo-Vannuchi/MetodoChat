"use server";
import { redirect } from "next/navigation";
import { conferirEntrada } from "@/lib/entrada";
import { ipDoCliente } from "@/lib/ip-do-cliente";
import { FRASE_DA_ENTRADA_ERRADA } from "@/lib/logins";
import { isLockedOut, recordFailure, clearAttempts, LOCKOUT_MESSAGE } from "@/lib/login-throttle";
import { abrirSessao } from "@/lib/sessao";

// A ENTRADA COM E-MAIL E SENHA (docs/specs/2026-11-04-logins.md, seção 3). Até 04/11/2026 era só a senha
// única. Toda entrada errada dá a mesma frase, e conta no freio de tentativas do IP, que é o de sempre.
export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const ip = await ipDoCliente();

  if (await isLockedOut(ip)) {
    return { error: LOCKOUT_MESSAGE };
  }

  const loginId = await conferirEntrada(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!loginId) {
    await recordFailure(ip);
    return { error: FRASE_DA_ENTRADA_ERRADA };
  }

  await clearAttempts(ip);
  await abrirSessao(loginId);
  redirect("/");
}
