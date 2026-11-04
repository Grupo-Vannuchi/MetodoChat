import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// AS REGRAS PURAS DOS LOGINS (docs/specs/2026-11-04-logins.md): o e-mail, o nome, a senha, o hash da senha e
// o código da sessão. Nada aqui toca o banco nem o cookie; quem faz isso é lib/logins-repositorio.ts e
// lib/sessao.ts.

/** A frase de toda entrada errada: o e-mail que não existe, a senha errada e o login desativado. */
export const FRASE_DA_ENTRADA_ERRADA = "E-mail ou senha incorretos.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O e-mail sem os espaços das pontas e em minúsculas, ou nulo se não for um e-mail de até 254 caracteres. */
export function normalizarEmail(bruto: string): string | null {
  const e = bruto.trim().toLowerCase();
  if (e.length > 254 || !EMAIL.test(e)) return null;
  return e;
}

/** O nome sem os espaços das pontas, de 1 a 60 caracteres, ou nulo. */
export function nomeValido(bruto: string): string | null {
  const n = bruto.trim();
  return n.length >= 1 && n.length <= 60 ? n : null;
}

/** A senha nova vai de 10 a 200 caracteres. */
export function senhaValida(senha: string): boolean {
  return senha.length >= 10 && senha.length <= 200;
}

// O SCRYPT (achado 172 da auditoria). O mínimo da OWASP é N=2^17, r=8, p=1; o padrão do Node é N=2^14.
// Medido em 04/11/2026 numa máquina de desenvolvimento: ~50 ms com 2^14 e ~480 ms com 2^17. A escolha
// final é a medida na Vercel, na prova (FASE do preview do plano). O N, o r e o p moram no próprio hash,
// então um hash feito com outros parâmetros continua conferindo, e dá para subir o N depois.
//
// O `maxmem` vai explícito: o scrypt usa 128 * N * r bytes, e com N=2^17 isso dá 128 MiB, acima dos
// 32 MiB do padrão do Node.
export const PARAMETROS_DO_SCRYPT = { N: 2 ** 17, r: 8, p: 1 } as const;
const TAMANHO_DO_HASH = 64;
const TAMANHO_DO_SAL = 16;

function scryptEmPromessa(senha: string, sal: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, sal, TAMANHO_DO_HASH, { N, r, p, maxmem: 256 * N * r }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave)
    );
  });
}

/** O hash da senha, no formato `scrypt$N$r$p$<sal base64>$<hash base64>`. */
export async function hashDaSenha(senha: string): Promise<string> {
  const { N, r, p } = PARAMETROS_DO_SCRYPT;
  const sal = randomBytes(TAMANHO_DO_SAL);
  const hash = await scryptEmPromessa(senha, sal, N, r, p);
  return `scrypt$${N}$${r}$${p}$${sal.toString("base64")}$${hash.toString("base64")}`;
}

/** A senha confere com o hash guardado? Um hash torto responde que não, sem estourar. */
export async function senhaConfere(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [N, r, p] = partes.slice(1, 4).map(Number);
  // O TETO DOS PARÂMETROS: o hash vem do banco, e não de quem entra, mas um N ou um r enorme pediria
  // memória sem fim ao scrypt. 2^20 e 32 sobram para qualquer subida razoável.
  const potenciaDeDois = Number.isSafeInteger(N) && N > 1 && N <= 2 ** 20 && (N & (N - 1)) === 0;
  const rOk = Number.isSafeInteger(r) && r >= 1 && r <= 32;
  const pOk = Number.isSafeInteger(p) && p >= 1 && p <= 16;
  if (!potenciaDeDois || !rOk || !pOk) return false;
  const sal = Buffer.from(partes[4], "base64");
  const esperado = Buffer.from(partes[5], "base64");
  if (sal.length === 0 || esperado.length !== TAMANHO_DO_HASH) return false;
  try {
    const hash = await scryptEmPromessa(senha, sal, N, r, p);
    return timingSafeEqual(hash, esperado);
  } catch {
    return false;
  }
}

// O CÓDIGO DA SESSÃO: 32 bytes sorteados, em base64url, que vão no cookie. O banco guarda só o SHA-256 dele.
const CODIGO_DE_SESSAO = /^[A-Za-z0-9_-]{43}$/;

export function novoCodigoDeSessao(): string {
  return randomBytes(32).toString("base64url");
}

/** O formato do código. O cookie v2 de antes de 04/11/2026 (`v2.<expira>.<assinatura>`) não passa. */
export function codigoDeSessaoBemFormado(codigo: string | undefined): codigo is string {
  return typeof codigo === "string" && CODIGO_DE_SESSAO.test(codigo);
}

export function hashDoCodigoDeSessao(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}
