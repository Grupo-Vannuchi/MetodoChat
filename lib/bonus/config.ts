// AS VARIÁVEIS DO GERADOR, com FALHA FECHADA: sem credencial, a ação é recusada.
// Nenhuma libera por omissão, e nenhum valor sai daqui para log ou tela.
import type { FaltaNoEnvio } from "./envio";
import { urlDaPorta } from "./labs";

export type Ambiente = Record<string, string | undefined>;

export function configDoEnvio(
  env: Ambiente
): { ok: true; url: string; segredo: string } | { ok: false; motivo: FaltaNoEnvio } {
  const segredo = env.BONUS_INTAKE_SECRET ?? "";
  if (!segredo) return { ok: false, motivo: "sem_segredo" };
  if (!env.LABS_URL) return { ok: false, motivo: "sem_url" };
  const url = urlDaPorta(env.LABS_URL);
  return url === null ? { ok: false, motivo: "url_invalida" } : { ok: true, url, segredo };
}

export function temChaveDaIA(env: Ambiente): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}
