import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A CÓPIA DA IMAGEM PARA O POST DO LINKEDIN NAS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a
// parte 2b). A linha do LinkedIn leva uma cópia própria, porque o dreno do Instagram apaga o original depois de
// publicar. Ela usa só o que lib/bucket.ts já exporta (o GET público, a URL assinada e o PUT), como a cópia do
// gerador, e grava no caminho do /publicar (`<pasta>/<id>.jpg`), e não no do gerador. O `fetch` é falso: nada sai
// desta máquina, e cada chamada fica anotada.

process.env.SUPABASE_URL = "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
process.env.SUPABASE_BUCKET = "MetodoChat";

const { copiarImagemParaOLinkedin, TETO_DA_COPIA_BYTES, TETO_DA_COPIA_MS } = await import("@/lib/linkedin-copia");

const CONTA = "17841400000000001";
const OUTRA = "17841400000000002";
const BASE = "https://exemplo.supabase.co/storage/v1";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const ORIGEM = `${CONTA}/foto-do-post.jpg`;

type Chamada = { metodo: string; url: string; cabecalhos: Record<string, string>; corpo: unknown; signal?: AbortSignal };
let chamadas: Chamada[];
let responder: (c: Chamada) => Response | Promise<Response>;

beforeEach(() => {
  chamadas = [];
  responder = (c) => {
    if (c.metodo === "POST" && c.url.includes("/object/upload/sign/")) {
      const caminho = c.url.split("/object/upload/sign/MetodoChat/")[1];
      return Response.json({ url: `/object/upload/sign/MetodoChat/${caminho}?token=t`, token: "t" });
    }
    if (c.metodo === "GET") return new Response(JPEG, { status: 200, headers: { "content-type": "image/jpeg" } });
    return new Response("{}", { status: 200 });
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const c: Chamada = {
        metodo: init.method ?? "GET",
        url: String(url),
        cabecalhos: Object.fromEntries(new Headers(init.headers).entries()),
        corpo: init.body,
        signal: init.signal ?? undefined,
      };
      chamadas.push(c);
      return responder(c);
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("copiar a imagem do post para a linha do LinkedIn", () => {
  it("baixa pelo endereço público, sobe os mesmos bytes em JPEG num caminho novo da mesma pasta, e devolve o caminho", async () => {
    const copia = await copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9));
    expect(copia).toBe(`${CONTA}/${uuid(9)}.jpg`);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST", "PUT"]);
    expect(chamadas[0].url).toBe(`${BASE}/object/public/MetodoChat/${ORIGEM}`);
    // O GET público não leva a chave: é o mesmo endereço que a Meta e o dreno do LinkedIn buscam.
    expect(chamadas[0].cabecalhos.apikey).toBeUndefined();
    expect(chamadas[1].url).toBe(`${BASE}/object/upload/sign/MetodoChat/${copia}`);
    expect(chamadas[2].url).toBe(`${BASE}/object/upload/sign/MetodoChat/${copia}?token=t`);
    expect(chamadas[2].cabecalhos["content-type"]).toBe("image/jpeg");
    expect(Array.from(chamadas[2].corpo as Uint8Array)).toEqual(Array.from(JPEG));
  });

  it("o caminho da cópia tem a forma dos caminhos do /publicar, e nunca a do gerador", async () => {
    const copia = await copiarImagemParaOLinkedin(ORIGEM, CONTA);
    expect(copia).toMatch(new RegExp(`^${CONTA}/[0-9a-f-]{36}\\.jpg$`));
    expect(copia).not.toContain("bonus");
  });

  it("a imagem de outra conta é recusada antes de qualquer chamada", async () => {
    await expect(copiarImagemParaOLinkedin(`${OUTRA}/foto-do-post.jpg`, CONTA, uuid(9))).rejects.toThrow(/não é desta conta/);
    expect(chamadas).toEqual([]);
  });

  it("o caminho torto (subpasta, volta de pasta, duas linhas) é recusado antes de qualquer chamada", async () => {
    for (const torto of [`${CONTA}/bonus-fila/${uuid(1)}.jpg`, `${CONTA}/../${OUTRA}/x.jpg`, `${ORIGEM}\n${CONTA}/outra.jpg`, ""]) {
      await expect(copiarImagemParaOLinkedin(torto, CONTA, uuid(9))).rejects.toThrow(/não é desta conta/);
    }
    expect(chamadas).toEqual([]);
  });

  it("a imagem que não existe mais é recusada, sem assinar nada", async () => {
    responder = () => new Response("not found", { status: 400 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/HTTP 400/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET"]);
  });

  it("vazia, ou maior que 8 MB, é recusada sem assinar nada", async () => {
    expect(TETO_DA_COPIA_BYTES).toBe(8 * 1024 * 1024);
    responder = () => new Response(new Uint8Array(0), { status: 200 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
    responder = () => new Response(new Uint8Array(TETO_DA_COPIA_BYTES + 1), { status: 200 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "GET"]);
  });

  it("no teto de 8 MB, a cópia passa", async () => {
    responder = (c) =>
      c.metodo === "POST"
        ? Response.json({ url: `/object/upload/sign/MetodoChat/x?token=t`, token: "t" })
        : c.metodo === "GET"
          ? new Response(new Uint8Array(TETO_DA_COPIA_BYTES), { status: 200 })
          : new Response("{}", { status: 200 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).resolves.toBe(`${CONTA}/${uuid(9)}.jpg`);
  });

  it("o armazenamento que recusa a subida faz a cópia lançar, sem o endereço assinado na frase", async () => {
    responder = (c) =>
      c.metodo === "POST"
        ? Response.json({ url: `/object/upload/sign/MetodoChat/x?token=segredo`, token: "segredo" })
        : c.metodo === "GET"
          ? new Response(JPEG, { status: 200 })
          : new Response("{}", { status: 403 });
    const erro = await copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toMatch(/recusou a cópia \(HTTP 403\)/);
    expect((erro as Error).message).not.toContain("segredo");
  });

  it("o armazenamento que não responde: o download desiste no teto de 10 s, e a cópia lança", async () => {
    expect(TETO_DA_COPIA_MS).toBe(10_000);
    vi.useFakeTimers();
    responder = (c) =>
      new Promise<Response>((_, falhar) => {
        c.signal?.addEventListener("abort", () => falhar(new DOMException("abortado", "AbortError")));
      });
    const copia = copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(TETO_DA_COPIA_MS - 1);
    expect(chamadas[0].signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const erro = await copia;
    expect((erro as Error).message).toMatch(/não respondeu em 10 s/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET"]);
  });

  it("a assinatura que não responde também desiste no teto de 10 s, sem subir nada (o teto é de quem chama)", async () => {
    vi.useFakeTimers();
    responder = (c) => (c.metodo === "GET" ? new Response(JPEG, { status: 200 }) : new Promise<Response>(() => {}));
    const copia = copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(TETO_DA_COPIA_MS - 1);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST"]);
    await vi.advanceTimersByTimeAsync(1);
    const erro = await copia;
    expect((erro as Error).message).toMatch(/não respondeu em 10 s/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST"]);
  });

  it("a subida que não responde também desiste no teto de 10 s", async () => {
    vi.useFakeTimers();
    responder = (c) => {
      if (c.metodo === "POST") return Response.json({ url: `/object/upload/sign/MetodoChat/x?token=t`, token: "t" });
      if (c.metodo === "GET") return new Response(JPEG, { status: 200 });
      return new Promise<Response>((_, falhar) => {
        c.signal?.addEventListener("abort", () => falhar(new DOMException("abortado", "AbortError")));
      });
    };
    const copia = copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(TETO_DA_COPIA_MS);
    const erro = await copia;
    expect((erro as Error).message).toMatch(/não respondeu em 10 s/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST", "PUT"]);
  });
});
