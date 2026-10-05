import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O BUCKET DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Publicar", passo 3). A cópia usa só o que
// lib/bucket.ts já exporta e já mediu: o GET público e o PUT na URL assinada. Nenhum endpoint novo do
// Supabase. O `fetch` é falso: nada sai desta máquina, e cada chamada fica anotada.

process.env.SUPABASE_URL = "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
process.env.SUPABASE_BUCKET = "MetodoChat";

const { apagarSemDerrubar, assinarCaminho, copiarParaAFila, copiarTodasParaAFila, COPIA_MAX_BYTES } = await import(
  "@/lib/bonus/publicar-bucket"
);

const CONTA = "17841400000000001";
const BASE = "https://exemplo.supabase.co/storage/v1";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

type Chamada = { metodo: string; url: string; cabecalhos: Record<string, string>; corpo: unknown };
let chamadas: Chamada[];
let responder: (c: Chamada) => Response;

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
      };
      chamadas.push(c);
      return responder(c);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assinar o caminho", () => {
  it("assina na pasta da conta do carrossel, no prefixo do destino, e devolve a URL inteira", async () => {
    const r = await assinarCaminho(CONTA, "slide", uuid(1));
    expect(r.caminho).toBe(`${CONTA}/bonus/${uuid(1)}.jpg`);
    expect(r.url).toBe(`${BASE}/object/upload/sign/MetodoChat/${CONTA}/bonus/${uuid(1)}.jpg?token=t`);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].metodo).toBe("POST");
    expect(chamadas[0].cabecalhos.apikey).toBe("chave-de-teste-que-nao-vale-nada");
    expect((await assinarCaminho(CONTA, "fila", uuid(2))).caminho).toBe(`${CONTA}/bonus-fila/${uuid(2)}.jpg`);
  });
});

describe("copiar uma imagem guardada para a fila", () => {
  const ORIGEM = `${CONTA}/bonus/${uuid(1)}.jpg`;

  it("baixa pelo endereço público, assina um caminho novo em bonus-fila e sobe os mesmos bytes", async () => {
    const copia = await copiarParaAFila(ORIGEM, CONTA, uuid(9));
    expect(copia).toBe(`${CONTA}/bonus-fila/${uuid(9)}.jpg`);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST", "PUT"]);
    expect(chamadas[0].url).toBe(`${BASE}/object/public/MetodoChat/${ORIGEM}`);
    // O GET público não leva a chave: é o mesmo endereço que a Meta busca sem token.
    expect(chamadas[0].cabecalhos.apikey).toBeUndefined();
    expect(chamadas[2].url).toBe(`${BASE}/object/upload/sign/MetodoChat/${copia}?token=t`);
    expect(chamadas[2].cabecalhos["content-type"]).toBe("image/jpeg");
    expect(chamadas[2].cabecalhos.authorization).toBeUndefined();
    expect(Array.from(chamadas[2].corpo as Uint8Array)).toEqual(Array.from(JPEG));
  });

  it("a guardada que não existe mais é recusada, sem assinar nada", async () => {
    responder = () => new Response("not found", { status: 400 });
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/HTTP 400/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET"]);
  });

  it("vazia, ou maior que o teto da Meta para imagem, é recusada", async () => {
    responder = () => new Response(new Uint8Array(0), { status: 200 });
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
    expect(COPIA_MAX_BYTES).toBe(8 * 1024 * 1024);
    responder = () => new Response(new Uint8Array(COPIA_MAX_BYTES + 1), { status: 200 });
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
  });

  it("o PUT recusado é recusa da cópia", async () => {
    const original = responder;
    responder = (c) => (c.metodo === "PUT" ? new Response("{}", { status: 403 }) : original(c));
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/HTTP 403/);
  });
});

describe("copiar todas", () => {
  const origens = [2, 3, 4].map((n) => ({ numero: n, caminho: `${CONTA}/bonus/${uuid(n)}.jpg` }));

  it("devolve a cópia de cada slide", async () => {
    const r = await copiarTodasParaAFila(origens, CONTA);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.copias)).toEqual(["2", "3", "4"]);
      for (const c of Object.values(r.copias)) expect(c).toMatch(new RegExp(`^${CONTA}/bonus-fila/[0-9a-f-]{36}\\.jpg$`));
      expect(new Set(Object.values(r.copias)).size).toBe(3);
    }
  });

  it("se uma falha, as que já foram feitas saem do bucket, e a resposta diz qual slide falhou", async () => {
    const original = responder;
    responder = (c) => (c.metodo === "GET" && c.url.endsWith(`${uuid(3)}.jpg`) ? new Response("x", { status: 400 }) : original(c));
    const r = await copiarTodasParaAFila(origens, CONTA);
    expect(r).toEqual({ ok: false, numero: 3 });
    const feitas = chamadas.filter((c) => c.metodo === "PUT").map((c) => c.url.split("MetodoChat/")[1].split("?")[0]);
    const apagadas = chamadas.filter((c) => c.metodo === "DELETE").map((c) => c.url.split("MetodoChat/")[1]);
    expect(feitas).toHaveLength(2);
    expect(apagadas.sort()).toEqual(feitas.sort());
  });
});

describe("apagar sem derrubar", () => {
  it("tenta todos, e a falha de um não lança nem impede os outros", async () => {
    responder = (c) => (c.url.endsWith(`${uuid(1)}.jpg`) ? new Response("{}", { status: 500 }) : new Response("{}", { status: 200 }));
    await expect(apagarSemDerrubar([`${CONTA}/bonus/${uuid(1)}.jpg`, `${CONTA}/bonus/${uuid(2)}.jpg`])).resolves.toBeUndefined();
    expect(chamadas.map((c) => `${c.metodo} ${c.url.split("MetodoChat/")[1]}`)).toEqual([
      `DELETE ${CONTA}/bonus/${uuid(1)}.jpg`,
      `DELETE ${CONTA}/bonus/${uuid(2)}.jpg`,
    ]);
  });
});
