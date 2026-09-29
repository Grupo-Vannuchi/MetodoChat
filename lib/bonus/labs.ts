// O CLIENTE DA PORTA DO LABS: um POST, com teto de tempo e de tamanho.
//
// Sem `server-only`: nada aqui é segredo (o cabeçalho chega pronto), e o `fetch`
// entra por parâmetro para os testes não precisarem de rede.
import type { RespostaCrua } from "./desfecho";

/** A resposta do Labs é lida até aqui. Mais que isso não é resposta do contrato. */
export const RESPOSTA_MAX_BYTES = 16 * 1024;

/**
 * A base do Labs, conferida. Só `https`, exceto `localhost` e `127.0.0.1`, que são a
 * prova local (spec, "A prova real"). Sem usuário, sem parâmetro e sem âncora: a
 * base vem de variável de ambiente e vira URL de POST.
 */
function baseValidada(base: string | undefined): string | null {
  if (!base) return null;
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    return null;
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  if (u.username || u.password || u.search || u.hash) return null;
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

export function urlDaPorta(base: string | undefined): string | null {
  const b = baseValidada(base);
  return b === null ? null : `${b}/api/bonus`;
}

export function urlPublicaDoBonus(base: string | undefined, slug: string): string | null {
  const b = baseValidada(base);
  return b === null ? null : `${b}/bonus/${slug}`;
}

async function lerAteOTeto(res: Response, teto: number): Promise<string | null> {
  if (!res.body) return "";
  const leitor = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > teto) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(partes));
}

/**
 * Envia a string pronta. `corpo` e `cabecalho` saem de `prepararEnvio`
 * (lib/bonus/envio.ts), que assina a MESMA string que chega aqui.
 *
 * `redirect: "manual"`: um 3xx não é resposta do contrato, e seguir o redirect
 * mandaria o bônus para um endereço que ninguém escolheu. Ele cai em "fora do
 * contrato", o lado seguro.
 */
export async function postarNoLabs(p: {
  url: string;
  corpo: string;
  cabecalho: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<RespostaCrua> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), p.timeoutMs);
  try {
    const res = await (p.fetchImpl ?? fetch)(p.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-metodolabs-signature": p.cabecalho },
      body: p.corpo,
      signal: controle.signal,
      redirect: "manual",
      cache: "no-store",
    });
    const texto = await lerAteOTeto(res, RESPOSTA_MAX_BYTES);
    if (texto === null) return { tipo: "falha", motivo: "grande" };
    return { tipo: "http", status: res.status, texto };
  } catch {
    return { tipo: "falha", motivo: controle.signal.aborted ? "timeout" : "rede" };
  } finally {
    clearTimeout(relogio);
  }
}
