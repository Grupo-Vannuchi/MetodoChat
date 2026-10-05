import { describe, expect, it, vi } from "vitest";
import {
  FALHA_GUARDADA_MS,
  FOTO_GUARDADA_MS,
  FOTO_MAX_BYTES,
  FOTO_TEMPO_MS,
  fotoDaConta,
  memoriaDasFotos,
  urlDeFotoAceita,
} from "@/lib/bonus/arte-foto";

// A FOTO DA CONTA NO CABEÇALHO DA ARTE, buscada pela própria rota. A URL vem do banco (a Meta a dá),
// e a rota é um servidor buscando um endereço: as travas são o que impede essa busca de ir a outro
// lugar (spec da Etapa 3, "O cabeçalho e a foto"). Toda falha devolve null: o cabeçalho sai com as
// iniciais, e a peça sai.

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48]);
const FOTO = "https://scontent-gru2-1.cdninstagram.com/v/t51.2885-19/foto.jpg?stp=dst-jpg";

const resposta = (status: number, corpo: Uint8Array | string = new Uint8Array()) =>
  new Response(typeof corpo === "string" ? corpo : Buffer.from(corpo), { status });
const buscador = (f: () => Promise<Response>) => vi.fn(f) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

describe("a URL da foto aceita", () => {
  it.each([
    FOTO,
    "https://scontent-gru1-2.cdninstagram.com/v/foto.jpg",
    "https://instagram.fgru5-1.fna.fbcdn.net/v/foto.jpg",
  ])("aceita o CDN da Meta em https: %s", (url) => {
    expect(urlDeFotoAceita(url)?.toString()).toBe(new URL(url).toString());
  });

  it.each([
    ["http, sem o s", "http://scontent-gru2-1.cdninstagram.com/v/foto.jpg"],
    ["o domínio de outro, com o da Meta no começo", "https://cdninstagram.com.exemplo.com/foto.jpg"],
    ["o domínio de outro, colado no da Meta", "https://falsocdninstagram.com/foto.jpg"],
    ["usuário e senha na URL", "https://usuario:senha@scontent-gru2-1.cdninstagram.com/foto.jpg"],
    ["outra porta", "https://scontent-gru2-1.cdninstagram.com:8443/foto.jpg"],
    ["endereço interno", "https://169.254.169.254/latest/meta-data"],
    ["outro esquema", "file:///etc/passwd"],
    ["não é URL", "foto.jpg"],
  ])("recusa %s", (_nome, url) => {
    expect(urlDeFotoAceita(url)).toBeNull();
  });
});

describe("a busca da foto", () => {
  it("JPEG vira data: URI, buscado sem seguir redirect, sem cache e com prazo", async () => {
    const f = buscador(async () => resposta(200, JPEG));
    expect(await fotoDaConta(FOTO, f)).toBe(`data:image/jpeg;base64,${Buffer.from(JPEG).toString("base64")}`);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, opcoes] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(new URL(FOTO).toString());
    expect(opcoes).toMatchObject({ method: "GET", redirect: "manual", cache: "no-store" });
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });

  it("PNG também", async () => {
    expect(await fotoDaConta(FOTO, buscador(async () => resposta(200, PNG)))).toBe(
      `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`
    );
  });

  it("sem URL, ou com URL recusada, nem busca", async () => {
    const f = buscador(async () => resposta(200, JPEG));
    expect(await fotoDaConta(null, f)).toBeNull();
    expect(await fotoDaConta("https://exemplo.com/foto.jpg", f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it.each([301, 302, 404, 500])("status %i é sem foto, e o redirect não é seguido", async (status) => {
    const f = buscador(async () => resposta(status, JPEG));
    expect(await fotoDaConta(FOTO, f)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("erro de rede ou prazo esgotado é sem foto", async () => {
    const f = buscador(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect(await fotoDaConta(FOTO, f)).toBeNull();
  });

  it("passar do teto de bytes é sem foto", async () => {
    const gorda = new Uint8Array(FOTO_MAX_BYTES + 1);
    gorda.set(JPEG);
    expect(await fotoDaConta(FOTO, buscador(async () => resposta(200, gorda)))).toBeNull();
  });

  // O formato vem dos BYTES, e não do Content-Type, que quem responde escolhe. O Satori derruba a
  // peça inteira com formato que não desenha (a lição do WebP no Labs, 03/09).
  it.each([
    ["WebP", "RIFF\u0000\u0000\u0000\u0000WEBPVP8 "],
    ["SVG", "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"],
    ["GIF", "GIF89a\u0001\u0000\u0001\u0000"],
    ["HTML", "<html>não é foto</html>"],
  ])("%s é sem foto", async (_nome, corpo) => {
    expect(await fotoDaConta(FOTO, buscador(async () => resposta(200, corpo)))).toBeNull();
  });

  it("o prazo e o teto são os da spec", () => {
    expect(FOTO_TEMPO_MS).toBe(3_000);
    expect(FOTO_MAX_BYTES).toBe(512 * 1024);
  });
});

// A FOTO EM MEMÓRIA (spec da Etapa 4, "A foto da conta em memória"). As miniaturas de um carrossel
// chegam juntas, e cada uma buscava a foto de novo na Meta, até 3 s cada. A memória guarda a PROMESSA
// por URL: chamadas juntas esperam a mesma busca. O relógio e a busca entram por parâmetro.
describe("a foto em memória", () => {
  const DATA = "data:image/jpeg;base64,/9j/";
  const memoria = (resultados: (string | null)[]) => {
    let agora = 1_000_000;
    const buscar = vi.fn(async (): Promise<string | null> => (resultados.length ? (resultados.shift() as string | null) : DATA));
    const m = memoriaDasFotos(buscar, () => agora);
    return { m, buscar, andar: (ms: number) => (agora += ms) };
  };

  it("as miniaturas que chegam juntas fazem uma busca só", async () => {
    const { m, buscar } = memoria([DATA]);
    const fotos = await Promise.all(Array.from({ length: 10 }, () => m.foto(FOTO)));
    expect(fotos).toEqual(Array(10).fill(DATA));
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("a foto achada fica guardada 10 minutos, e depois é buscada de novo", async () => {
    const { m, buscar, andar } = memoria([DATA, DATA]);
    await m.foto(FOTO);
    andar(FOTO_GUARDADA_MS - 1);
    await m.foto(FOTO);
    expect(buscar).toHaveBeenCalledTimes(1);
    andar(1);
    await m.foto(FOTO);
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(FOTO_GUARDADA_MS).toBe(10 * 60_000);
  });

  it("a falha fica guardada só 30 segundos, para uma queda da Meta não grudar", async () => {
    const { m, buscar, andar } = memoria([null, DATA]);
    expect(await m.foto(FOTO)).toBeNull();
    andar(FALHA_GUARDADA_MS - 1);
    expect(await m.foto(FOTO)).toBeNull();
    andar(1);
    expect(await m.foto(FOTO)).toBe(DATA);
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(FALHA_GUARDADA_MS).toBe(30_000);
  });

  it("as fotos vencidas saem da memória (a URL muda quando o cron renova a conta)", async () => {
    const { m, andar } = memoria([DATA, DATA, DATA]);
    await m.foto(`${FOTO}&v=1`);
    await m.foto(`${FOTO}&v=2`);
    expect(m.quantas()).toBe(2);
    andar(FOTO_GUARDADA_MS);
    await m.foto(`${FOTO}&v=3`);
    expect(m.quantas()).toBe(1);
  });

  it("sem URL não busca nem guarda", async () => {
    const { m, buscar } = memoria([]);
    expect(await m.foto(null)).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
    expect(m.quantas()).toBe(0);
  });
});
