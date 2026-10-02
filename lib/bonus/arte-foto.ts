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

// A FOTO EM MEMÓRIA, por instância do servidor e por URL (spec da Etapa 4). As miniaturas de um
// carrossel chegam juntas, e cada uma buscava a foto de novo na Meta, até 3 s cada: trocar a conta,
// na Etapa 3, pedia 10 buscas e pareceu lento no preview.
// - Guarda a PROMESSA, e não só o resultado: as chamadas que chegam juntas, com a memória vazia,
//   esperam a mesma busca.
// - A foto achada vale 10 minutos; a falha (null) vale 30 s, para uma queda da Meta não grudar.
// - As vencidas saem a cada chamada: a URL muda quando o cron renova a conta, e as chaves velhas se
//   acumulariam.
// As travas da busca são as de `fotoDaConta`, que continua sendo quem busca.

export const FOTO_GUARDADA_MS = 10 * 60_000;
export const FALHA_GUARDADA_MS = 30_000;

export type MemoriaDasFotos = {
  foto: (url: string | null) => Promise<string | null>;
  /** Quantas URLs estão guardadas agora (para o teste da limpeza). */
  quantas: () => number;
};

export function memoriaDasFotos(
  buscar: (url: string) => Promise<string | null> = (url) => fotoDaConta(url),
  agora: () => number = Date.now
): MemoriaDasFotos {
  const guardadas = new Map<string, { promessa: Promise<string | null>; vence: number }>();
  return {
    foto(url) {
      if (!url) return Promise.resolve(null);
      const t = agora();
      for (const [chave, g] of guardadas) if (g.vence <= t) guardadas.delete(chave);
      const achada = guardadas.get(url);
      if (achada) return achada.promessa;
      const guardada = { promessa: buscar(url), vence: t + FOTO_GUARDADA_MS };
      guardadas.set(url, guardada);
      guardada.promessa.then(
        (foto) => {
          if (foto === null) guardada.vence = agora() + FALHA_GUARDADA_MS;
        },
        () => guardadas.delete(url)
      );
      return guardada.promessa;
    },
    quantas: () => guardadas.size,
  };
}

/** A memória desta instância do servidor, que a rota da arte usa. */
export const fotosDaInstancia = memoriaDasFotos();
