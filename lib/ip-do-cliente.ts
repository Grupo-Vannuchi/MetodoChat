import "server-only";
import { headers } from "next/headers";

// Quem está tentando entrar. Atrás da Vercel, o IP real é o PRIMEIRO item de
// x-forwarded-for — os seguintes são os proxies do caminho, que o cliente pode
// forjar acrescentando itens à esquerda... por isso o primeiro é o que a borda
// escreveu, e é o único confiável aqui.
//
// Morava em app/entrar/actions.ts. Desde os logins (docs/specs/2026-11-04-logins.md) a troca da própria
// senha também passa pelo freio de tentativas, e as duas leem o IP daqui.
export async function ipDoCliente(): Promise<string> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || h.get("x-real-ip") || "desconhecido";
}
