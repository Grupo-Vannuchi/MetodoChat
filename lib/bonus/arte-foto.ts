// A FOTO DA CONTA NO CABEÇALHO DA ARTE, buscada pela própria rota da arte.
//
// A URL vem de `accounts.profile_picture_url` (a Meta a dá, e o cron diário a renova), e NUNCA do
// formulário. Mesmo assim, a rota é um servidor buscando um endereço, e as travas são o que impede
// essa busca de ir a outro lugar (spec da Etapa 3, "O cabeçalho e a foto"):
// - só `https`, sem usuário nem senha na URL, na porta padrão;
// - só os domínios do CDN da Meta. Medido em 01/10, só leitura: as 4 contas conectadas têm a foto
//   em `scontent-*.cdninstagram.com`. O `fbcdn.net` é o outro CDN de imagem da Meta;
// - sem seguir redirect, com prazo de 3 s e teto de 512 KiB;
// - só JPEG e PNG, reconhecidos pelos BYTES, e não pelo Content-Type, que quem responde escolhe. O
//   Satori derruba a peça inteira com formato que não desenha (o WebP, no Labs, em 03/09).
//
// A IMAGEM ENTRA NO SATORI COMO `data:` URI, DEPOIS desta busca. Com a URL no `<img>`, o Satori
// buscaria sozinho, por fora das travas.
//
// Toda falha devolve null, e o cabeçalho sai com as iniciais: perder o rosto é pequeno, perder a
// peça é perder o trabalho (a regra do Labs, src/lib/foto-de-perfil.ts).

export const FOTO_MAX_BYTES = 512 * 1024;
export const FOTO_TEMPO_MS = 3_000;

const DOMINIOS_DA_META = ["cdninstagram.com", "fbcdn.net"];

/** A URL, se ela for de foto aceita; null em qualquer outro caso. */
export function urlDeFotoAceita(bruta: string): URL | null {
  let u: URL;
  try {
    u = new URL(bruta);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const host = u.hostname.toLowerCase();
  return DOMINIOS_DA_META.some((d) => host === d || host.endsWith(`.${d}`)) ? u : null;
}

/** JPEG ou PNG pelos bytes iniciais, que o formato define e o remetente não escolhe. */
function tipoDaFoto(b: Uint8Array): "jpeg" | "png" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return "png";
  return null;
}

/** Lê o corpo inteiro, ou null se ele passar do teto (o leitor é cancelado). */
async function bytesAteOTeto(res: Response, teto: number): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array();
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
  return new Uint8Array(Buffer.concat(partes));
}

export async function fotoDaConta(url: string | null, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const aceita = url ? urlDeFotoAceita(url) : null;
  if (!aceita) return null;
  let res: Response;
  try {
    res = await fetchImpl(aceita.toString(), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FOTO_TEMPO_MS),
    });
  } catch {
    return null;
  }
  if (res.status !== 200) return null;
  let bytes: Uint8Array | null;
  try {
    bytes = await bytesAteOTeto(res, FOTO_MAX_BYTES);
  } catch {
    return null;
  }
  const tipo = bytes ? tipoDaFoto(bytes) : null;
  if (!bytes || !tipo) return null;
  return `data:image/${tipo};base64,${Buffer.from(bytes).toString("base64")}`;
}
