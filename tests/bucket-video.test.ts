import { afterEach, describe, expect, it, vi } from "vitest";

// O BUCKET PARA O VÍDEO DO LINKEDIN (a parte 3b; scratchpad/desenho-li3b.md, v3, §3.3, §3.6 e §4): o tamanho do
// vídeo, a faixa de uma parte, conferida (o 236), e a cópia no servidor do Storage (o vídeo nas duas redes).
// As chamadas vão a um `fetch` trocado: o que se prova aqui é o pedido que sai e a conferência da resposta. A faixa e
// a cópia de verdade foram medidas em 16/11 (a faixa pela auditoria, só lendo; a cópia pela sonda, com a caixa do
// Eduardo), e a prova mede de novo.

process.env.SUPABASE_URL = "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
process.env.SUPABASE_BUCKET = "MetodoChat";

const { copiarObjeto, faixaDoObjeto, tamanhoDoObjeto } = await import("@/lib/bucket");

const CAMINHO = "17841400000000001/v.mp4";
const PUBLICO = "https://exemplo.supabase.co/storage/v1/object/public/MetodoChat/17841400000000001/v.mp4";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function gravar(resposta: () => Response) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    return resposta();
  });
  return pedidos;
}

function medirOsTetos() {
  const tetos: number[] = [];
  const original = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    tetos.push(ms);
    return original(ms);
  });
  return tetos;
}

describe("o tamanho do vídeo no bucket", () => {
  it("vem do HEAD do endereço público, sem cache, com o teto pedido", async () => {
    const tetos = medirOsTetos();
    const pedidos = gravar(() => new Response(null, { status: 200, headers: { "content-length": "5000001" } }));
    expect(await tamanhoDoObjeto(CAMINHO, 10_000)).toBe(5000001);
    expect(pedidos[0].url).toBe(PUBLICO);
    expect(pedidos[0].init.method).toBe("HEAD");
    expect(pedidos[0].init.cache).toBe("no-store");
    expect(tetos).toEqual([10_000]);
  });

  it("o arquivo que não está lá, ou a resposta sem o tamanho, é erro, e o erro não leva o endereço", async () => {
    gravar(() => new Response(null, { status: 404 }));
    const erro = await tamanhoDoObjeto(CAMINHO, 10_000).catch((e: unknown) => e);
    expect(String((erro as Error).message)).toContain("404");
    expect(String((erro as Error).message)).not.toContain("supabase");
    gravar(() => new Response(null, { status: 200 }));
    await expect(tamanhoDoObjeto(CAMINHO, 10_000)).rejects.toThrow();
  });
});

describe("a faixa de uma parte do vídeo (o 236)", () => {
  it("é um GET com o Range dos bytes inclusivos, sem cache, e devolve os bytes da faixa", async () => {
    const tetos = medirOsTetos();
    const pedidos = gravar(
      () => new Response(new Uint8Array([7, 8, 9, 10]), { status: 206, headers: { "content-range": "bytes 4-7/20", "content-length": "4" } })
    );
    expect(Array.from(await faixaDoObjeto(CAMINHO, 4, 7, 10_000))).toEqual([7, 8, 9, 10]);
    expect(pedidos[0].url).toBe(PUBLICO);
    expect((pedidos[0].init.headers as Record<string, string>).range).toBe("bytes=4-7");
    expect(pedidos[0].init.cache).toBe("no-store");
    expect(tetos).toEqual([10_000]);
  });

  it("o 200 com o arquivo inteiro é erro: a faixa não foi respeitada", async () => {
    gravar(() => new Response(new Uint8Array(20), { status: 200 }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
  });

  it("o Content-Range diferente do pedido, ou ausente, é erro", async () => {
    gravar(() => new Response(new Uint8Array(4), { status: 206, headers: { "content-range": "bytes 0-3/20" } }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
    gravar(() => new Response(new Uint8Array(4), { status: 206 }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
  });

  it("o corpo menor ou maior que a faixa é erro", async () => {
    gravar(() => new Response(new Uint8Array(3), { status: 206, headers: { "content-range": "bytes 4-7/20" } }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
    gravar(() => new Response(new Uint8Array(5), { status: 206, headers: { "content-range": "bytes 4-7/20" } }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
  });

  it("o arquivo que não está lá é erro com o status, sem o endereço", async () => {
    gravar(() => new Response(null, { status: 404 }));
    const erro = await faixaDoObjeto(CAMINHO, 4, 7, 10_000).catch((e: unknown) => e);
    expect(String((erro as Error).message)).toContain("404");
    expect(String((erro as Error).message)).not.toContain("supabase");
  });
});

describe("a cópia no servidor do Storage (o vídeo nas duas redes)", () => {
  it("é um POST ao /object/copy, com as duas chaves de serviço e o bucket, a origem e o destino", async () => {
    const tetos = medirOsTetos();
    const pedidos = gravar(() => new Response(JSON.stringify({ Key: "MetodoChat/x" }), { status: 200 }));
    await copiarObjeto(CAMINHO, "17841400000000001/linkedin-v.mp4", 10_000);
    expect(pedidos[0].url).toBe("https://exemplo.supabase.co/storage/v1/object/copy");
    expect(pedidos[0].init.method).toBe("POST");
    const cabecalhos = pedidos[0].init.headers as Record<string, string>;
    expect(cabecalhos.Authorization).toBe("Bearer chave-de-teste-que-nao-vale-nada");
    expect(cabecalhos.apikey).toBe("chave-de-teste-que-nao-vale-nada");
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({
      bucketId: "MetodoChat",
      sourceKey: CAMINHO,
      destinationKey: "17841400000000001/linkedin-v.mp4",
    });
    expect(tetos).toEqual([10_000]);
  });

  it("a cópia recusada é erro com o status", async () => {
    gravar(() => new Response("The resource already exists", { status: 409 }));
    await expect(copiarObjeto(CAMINHO, "17841400000000001/linkedin-v.mp4", 10_000)).rejects.toThrow(/409/);
  });
});
