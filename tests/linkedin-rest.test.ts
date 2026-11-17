import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  criarPost,
  enderecoDeEnvioConfiavel,
  enviarDocumento,
  enviarImagem,
  enviarParteDoVideo,
  estadoDoVideo,
  finalizarVideo,
  LINKEDIN_VERSION,
  nomeLimpo,
  reservarDocumento,
  reservarVideo,
  STATUS_RECUSADO_PELO_PAINEL,
  TETO_DO_ENVIO_DA_IMAGEM_MS,
  TETO_DO_ENVIO_DA_PARTE_MS,
  TETO_DO_ENVIO_DO_DOCUMENTO_MS,
  TETO_DO_LINKEDIN_MS,
} from "@/lib/linkedin";
import { chaveDaPublicacaoNoLinkedin, publicacaoKey } from "@/lib/dedupe";

// O QUE É PURO NAS CHAMADAS DE PUBLICAR NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §4 e §6; a
// parte 2a). As chamadas de rede (a reserva, o envio da imagem e o post) são provadas contra um LinkedIn falso no
// loopback, em testes-integracao/linkedin-publicacao.integracao.ts.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// O TETO DE TEMPO DE CADA CHAMADA (notas da auditoria sobre a F2): o envio da imagem leva até 8 MB e tem teto
// próprio, de 15 s (~4,3 Mbit/s); as outras chamadas ficam nos 10 s. A soma do ramo da imagem (o bucket, a reserva,
// o envio e o post) cabe nos 60 s da função com folga, e o ramo confere o tempo que resta antes de começar
// (lib/linkedin-fila.ts). Os casos trocam o `fetch` por um que responde na hora e leem o teto que cada chamada
// pediu ao `AbortSignal.timeout`.
describe("o teto de tempo das chamadas de publicar", () => {
  function medirOsTetos(resposta: () => Response) {
    const tetos: number[] = [];
    const original = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      tetos.push(ms);
      return original(ms);
    });
    vi.stubGlobal("fetch", async () => resposta());
    return tetos;
  }

  it("o envio da imagem tem 15 s", async () => {
    expect(TETO_DO_ENVIO_DA_IMAGEM_MS).toBe(15_000);
    const tetos = medirOsTetos(() => new Response("", { status: 201 }));
    await enviarImagem("https://www.linkedin.com/dms-uploads/C4E10AQ/x", "token-de-teste", new ArrayBuffer(4), "image/jpeg");
    expect(tetos).toEqual([TETO_DO_ENVIO_DA_IMAGEM_MS]);
  });

  it("o post continua com os 10 s de toda chamada", async () => {
    const tetos = medirOsTetos(() => new Response("", { status: 201, headers: { "x-restli-id": "urn:li:share:1" } }));
    await criarPost("token-de-teste", { author: "urn:li:person:x" });
    expect(tetos).toEqual([TETO_DO_LINKEDIN_MS]);
    expect(TETO_DO_LINKEDIN_MS).toBe(10_000);
  });
});

describe("a versão da API do LinkedIn", () => {
  it("é a 202610", () => {
    expect(LINKEDIN_VERSION).toBe("202610");
  });

  // DE PROPÓSITO, ESTE CASO FICA VERMELHO a partir de 01/09/2027, e com ele todo `npm test`, até a versão ser
  // trocada: a 202610 tem suporte por pelo menos um ano (a página de versões do LinkedIn), e a troca é lembrada
  // seis semanas antes de 15/10/2027, e não por um post que falha em produção (spec, §4).
  it("ainda não chegou a hora de trocar a versão (01/09/2027)", () => {
    expect(Date.now()).toBeLessThan(Date.parse("2027-09-01T00:00:00Z"));
  });
});

describe("o endereço de envio da imagem que o LinkedIn devolve", () => {
  it("só um endereço https do LinkedIn recebe a autorização", () => {
    expect(enderecoDeEnvioConfiavel("https://www.linkedin.com/dms-uploads/C4E10AQ/uploaded-image/0?ca=x")).toBe(true);
    expect(enderecoDeEnvioConfiavel("https://api.linkedin.com/mediaUpload/x")).toBe(true);
    for (const outro of [
      "http://www.linkedin.com/dms-uploads/x",
      "https://linkedin.com.exemplo.com/x",
      "https://www.exemplo.com/x",
      "https://xlinkedin.com/x",
      "nao é endereço",
    ]) {
      expect(enderecoDeEnvioConfiavel(outro)).toBe(false);
    }
  });

  it("o loopback só vale nos testes, sob a trava do vitest", () => {
    expect(enderecoDeEnvioConfiavel("http://127.0.0.1:4567/envio")).toBe(true);
    vi.stubEnv("VITEST", "");
    expect(enderecoDeEnvioConfiavel("http://127.0.0.1:4567/envio")).toBe(false);
  });
});

describe("o nome que o LinkedIn devolve", () => {
  it("tem os espaços juntados e as pontas aparadas (a prova de 09/11 trouxe dois espaços no meio)", () => {
    expect(nomeLimpo("  Thiago  Vannuchi ")).toBe("Thiago Vannuchi");
    expect(nomeLimpo("Ana\tSouza")).toBe("Ana Souza");
  });
});

describe("a chave da linha do LinkedIn na fila", () => {
  it("tem prefixo próprio e nunca é igual à do Instagram", () => {
    const chave = chaveDaPublicacaoNoLinkedin("17800000000000001", "imagem", ["17800000000000001/a.jpg"], "x");
    expect(chave).toBe("pub-linkedin:17800000000000001:imagem:17800000000000001/a.jpg");
    expect(chave).not.toBe(publicacaoKey("17800000000000001", "imagem", ["17800000000000001/a.jpg"]));
  });

  it("na forma só texto, que não tem arquivo, é a do envio da tela: o mesmo envio não entra duas vezes", () => {
    const envio = "9f1c2e3d-0000-4000-8000-000000000001";
    expect(chaveDaPublicacaoNoLinkedin("17800000000000001", "texto", [], envio)).toBe(
      `pub-linkedin:17800000000000001:texto:${envio}`
    );
  });
});

// O DOCUMENTO DO CARROSSEL (a parte 3a; scratchpad/desenho-li3.md, §6). A Documents API: a reserva com a pessoa dona
// devolve o endereço de envio e o URN do documento; o envio é um PUT só, com a autorização, como o exemplo da página
// ("curl --upload-file" com o "Authorization: Bearer"), e o mesmo cuidado do domínio da imagem. O envio leva até os
// 15 MB do carrossel, e o teto dele é de 25 s.
describe("a reserva e o envio do documento do carrossel", () => {
  function gravarOsPedidos(resposta: () => Response) {
    const pedidos: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return resposta();
    });
    return pedidos;
  }

  it("a reserva pede o documento com a pessoa dona, e devolve o endereço e o URN", async () => {
    const pedidos = gravarOsPedidos(
      () =>
        new Response(
          JSON.stringify({ value: { uploadUrl: "https://www.linkedin.com/dms-uploads/D5510/doc/0?ca=x", document: "urn:li:document:D5510X" } }),
          { status: 200 }
        )
    );
    expect(await reservarDocumento("token-de-teste", "pessoaX")).toEqual({
      uploadUrl: "https://www.linkedin.com/dms-uploads/D5510/doc/0?ca=x",
      documentoUrn: "urn:li:document:D5510X",
    });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].url.endsWith("/rest/documents?action=initializeUpload")).toBe(true);
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({ initializeUploadRequest: { owner: "urn:li:person:pessoaX" } });
    expect((pedidos[0].init.headers as Record<string, string>)["linkedin-version"]).toBe(LINKEDIN_VERSION);
  });

  it("a reserva que não devolve o URN de documento é um erro do LinkedIn", async () => {
    gravarOsPedidos(() => new Response(JSON.stringify({ value: { uploadUrl: "https://www.linkedin.com/x", document: "urn:li:image:Y" } }), { status: 200 }));
    await expect(reservarDocumento("token-de-teste", "pessoaX")).rejects.toMatchObject({ name: "LinkedinError", status: 200 });
    gravarOsPedidos(() => new Response("{}", { status: 403 }));
    await expect(reservarDocumento("token-de-teste", "pessoaX")).rejects.toMatchObject({ name: "LinkedinError", status: 403 });
  });

  it("o envio é um PUT com a autorização e os bytes do PDF, com o teto de 25 s", async () => {
    expect(TETO_DO_ENVIO_DO_DOCUMENTO_MS).toBe(25_000);
    const tetos: number[] = [];
    const original = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      tetos.push(ms);
      return original(ms);
    });
    const pedidos = gravarOsPedidos(() => new Response("", { status: 201 }));
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await enviarDocumento("https://www.linkedin.com/dms-uploads/D5510/doc/0?ca=x", "token-de-teste", pdf);
    expect(tetos).toEqual([TETO_DO_ENVIO_DO_DOCUMENTO_MS]);
    expect(pedidos[0].init.method).toBe("PUT");
    expect((pedidos[0].init.headers as Record<string, string>).authorization).toBe("Bearer token-de-teste");
    expect(pedidos[0].init.body).toBe(pdf);
  });

  it("o envio para um endereço que não é do LinkedIn não sai, e a autorização não vai", async () => {
    const pedidos = gravarOsPedidos(() => new Response("", { status: 201 }));
    await expect(enviarDocumento("https://www.exemplo.com/doc", "token-de-teste", new Uint8Array(4))).rejects.toMatchObject({
      name: "LinkedinError",
      status: 0,
    });
    expect(pedidos).toHaveLength(0);
  });

  it("o envio recusado pelo LinkedIn é um erro com o status", async () => {
    gravarOsPedidos(() => new Response("negado", { status: 400 }));
    await expect(enviarDocumento("https://www.linkedin.com/dms-uploads/D5510/doc/0", "token-de-teste", new Uint8Array(4))).rejects.toMatchObject({
      name: "LinkedinError",
      status: 400,
    });
  });
});

// A MÍDIA NÃO PRONTA É DECIDIDA NA RESPOSTA INTEIRA (nota da auditoria sobre a F3 da 3a). O erro guarda só os
// primeiros 300 caracteres da resposta, para a mensagem; o código do LinkedIn pode vir depois deles, e a decisão
// tem de ver o texto todo, dentro do `criarPost`.
describe("o post recusado pela mídia que o LinkedIn ainda processa", () => {
  it("o código depois dos 300 primeiros caracteres ainda conta, e o erro diz que a mídia não está pronta", async () => {
    const longo = JSON.stringify({ message: "x".repeat(400), code: "MEDIA_ASSET_WAITING_UPLOAD" });
    vi.stubGlobal("fetch", async () => new Response(longo, { status: 400 }));
    await expect(criarPost("token-de-teste", { author: "urn:li:person:x" })).rejects.toMatchObject({
      name: "LinkedinError",
      status: 400,
      midiaNaoPronta: true,
    });
  });

  it("o outro 400, e o post que deu certo, não", async () => {
    vi.stubGlobal("fetch", async () => new Response('{"code":"INVALID_URN_TYPE"}', { status: 400 }));
    await expect(criarPost("token-de-teste", { author: "urn:li:person:x" })).rejects.toMatchObject({ status: 400, midiaNaoPronta: false });
  });
});

// O VÍDEO EM PARTES (a parte 3b; scratchpad/desenho-li3b.md, v3): a reserva com o tamanho, as partes conferidas, o
// envio de cada parte SEM o token (o 234), o fim com os ETags na ordem, e o estado do vídeo (o 233).
describe("a reserva do vídeo", () => {
  function responderUmaVez(corpo: unknown, status = 200) {
    const pedidos: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
    });
    return pedidos;
  }
  const instrucao = (firstByte: number, lastByte: number, n: number) => ({
    uploadUrl: `https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=${n}`,
    firstByte,
    lastByte,
  });

  it("pede o vídeo com a pessoa dona e o tamanho, sem legenda nem capa, e devolve as partes, o URN e o token", async () => {
    const pedidos = responderUmaVez({
      value: {
        uploadInstructions: [instrucao(0, 4194303, 1), instrucao(4194304, 5000000, 2)],
        video: "urn:li:video:V77",
        uploadToken: "token-do-envio",
        uploadUrlsExpireAt: 1999999999999,
      },
    });
    expect(await reservarVideo("token-de-teste", "pessoaX", 5000001)).toEqual({
      videoUrn: "urn:li:video:V77",
      uploadToken: "token-do-envio",
      partes: [
        { inicio: 0, fim: 4194303, url: "https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=1" },
        { inicio: 4194304, fim: 5000000, url: "https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=2" },
      ],
    });
    expect(pedidos[0].url.endsWith("/rest/videos?action=initializeUpload")).toBe(true);
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({
      initializeUploadRequest: { owner: "urn:li:person:pessoaX", fileSizeBytes: 5000001, uploadCaptions: false, uploadThumbnail: false },
    });
    expect(pedidos[0].init.redirect).toBe("error");
  });

  it("o token do envio vazio é aceito (o vídeo de uma parte só)", async () => {
    responderUmaVez({ value: { uploadInstructions: [instrucao(0, 99999, 1)], video: "urn:li:video:V1", uploadToken: "" } });
    expect((await reservarVideo("token-de-teste", "pessoaX", 100000)).uploadToken).toBe("");
  });

  it("recusa a reserva sem o URN de vídeo, sem instruções, ou com um endereço que não é do LinkedIn", async () => {
    const ok = { uploadInstructions: [instrucao(0, 99, 1)], video: "urn:li:video:V1", uploadToken: "t" };
    responderUmaVez({ value: { ...ok, video: "urn:li:image:I" } });
    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError" });
    responderUmaVez({ value: { ...ok, uploadInstructions: [] } });
    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError" });
    responderUmaVez({ value: { ...ok, uploadInstructions: [{ ...instrucao(0, 99, 1), uploadUrl: "https://www.exemplo.com/x" }] } });
    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError" });
  });

  it("recusa as partes que não cobrem o arquivo inteiro, em ordem, sem buraco nem sobra", async () => {
    const reserva = (instrucoes: unknown[], tamanho: number) => {
      responderUmaVez({ value: { uploadInstructions: instrucoes, video: "urn:li:video:V1", uploadToken: "t" } });
      return reservarVideo("token-de-teste", "pessoaX", tamanho);
    };
    await expect(reserva([instrucao(0, 49, 1), instrucao(51, 99, 2)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
    await expect(reserva([instrucao(0, 49, 1), instrucao(40, 99, 2)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
    await expect(reserva([instrucao(0, 98, 1)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
    await expect(reserva([instrucao(0, 100, 1)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
    await expect(reserva([instrucao(1, 99, 1)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
    await expect(reserva([{ ...instrucao(0, 99, 1), lastByte: "99" }], 100)).rejects.toMatchObject({ name: "LinkedinError" });
  });

  it("a reserva recusada pelo LinkedIn é um erro com o status", async () => {
    responderUmaVez("{}", 403);
    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError", status: 403 });
  });
});

describe("o envio de uma parte do vídeo (o 234)", () => {
  function gravar(resposta: () => Response) {
    const pedidos: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return resposta();
    });
    return pedidos;
  }
  const ENDERECO = "https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=1";

  it("é um PUT SEM a autorização, com os bytes, o tipo binário e o teto de 15 s, e devolve o ETag", async () => {
    expect(TETO_DO_ENVIO_DA_PARTE_MS).toBe(15_000);
    const tetos: number[] = [];
    const original = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      tetos.push(ms);
      return original(ms);
    });
    const pedidos = gravar(() => new Response("", { status: 200, headers: { etag: '"etag-da-parte-1"' } }));
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await enviarParteDoVideo(ENDERECO, bytes)).toBe('"etag-da-parte-1"');
    expect(tetos).toEqual([TETO_DO_ENVIO_DA_PARTE_MS]);
    expect(pedidos[0].init.method).toBe("PUT");
    const cabecalhos = pedidos[0].init.headers as Record<string, string>;
    expect(Object.keys(cabecalhos).map((k) => k.toLowerCase())).not.toContain("authorization");
    expect(cabecalhos["content-type"]).toBe("application/octet-stream");
    expect(pedidos[0].init.body).toBe(bytes);
    expect(pedidos[0].init.redirect).toBe("error");
  });

  it("a parte aceita sem o ETag, ou com ele vazio, é um erro", async () => {
    gravar(() => new Response("", { status: 200 }));
    await expect(enviarParteDoVideo(ENDERECO, new Uint8Array(3))).rejects.toMatchObject({ name: "LinkedinError", status: 200 });
    gravar(() => new Response("", { status: 201, headers: { etag: "" } }));
    await expect(enviarParteDoVideo(ENDERECO, new Uint8Array(3))).rejects.toMatchObject({ name: "LinkedinError", status: 201 });
  });

  it("o endereço que não é do LinkedIn não recebe a parte: o vídeo é do cliente", async () => {
    const pedidos = gravar(() => new Response("", { status: 200, headers: { etag: "e" } }));
    await expect(enviarParteDoVideo("https://www.exemplo.com/x", new Uint8Array(3))).rejects.toMatchObject({
      name: "LinkedinError",
      status: STATUS_RECUSADO_PELO_PAINEL,
    });
    expect(pedidos).toHaveLength(0);
  });

  it("a parte recusada é um erro com o status, e o texto não leva a resposta do LinkedIn (o 236)", async () => {
    gravar(() => new Response("um texto longo do LinkedIn que a tela não deve mostrar", { status: 403 }));
    const erro = await enviarParteDoVideo(ENDERECO, new Uint8Array(3)).catch((e: unknown) => e);
    expect(erro).toMatchObject({ name: "LinkedinError", status: 403 });
    expect(String((erro as Error).message)).not.toContain("um texto longo");
  });
});

describe("o fim do envio e o estado do vídeo", () => {
  function gravar(resposta: () => Response) {
    const pedidos: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return resposta();
    });
    return pedidos;
  }

  it("o fim leva o vídeo, o token do envio e os ETags na ordem das partes", async () => {
    const pedidos = gravar(() => new Response("", { status: 200 }));
    await finalizarVideo("token-de-teste", "urn:li:video:V77", "token-do-envio", ['"e1"', '"e2"', '"e3"']);
    expect(pedidos[0].url.endsWith("/rest/videos?action=finalizeUpload")).toBe(true);
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({
      finalizeUploadRequest: { video: "urn:li:video:V77", uploadToken: "token-do-envio", uploadedPartIds: ['"e1"', '"e2"', '"e3"'] },
    });
    expect((pedidos[0].init.headers as Record<string, string>).authorization).toBe("Bearer token-de-teste");
    expect(pedidos[0].init.redirect).toBe("error");
  });

  it("o fim recusado é um erro com o status", async () => {
    gravar(() => new Response("{}", { status: 400 }));
    await expect(finalizarVideo("token-de-teste", "urn:li:video:V77", "t", ["e"])).rejects.toMatchObject({ name: "LinkedinError", status: 400 });
  });

  it("o estado do vídeo vem do GET com o URN codificado no caminho", async () => {
    const pedidos = gravar(() => new Response(JSON.stringify({ status: "AVAILABLE", id: "urn:li:video:V77" }), { status: 200 }));
    expect(await estadoDoVideo("token-de-teste", "urn:li:video:V77")).toBe("AVAILABLE");
    expect(pedidos[0].url.endsWith("/rest/videos/urn%3Ali%3Avideo%3AV77")).toBe(true);
    expect(pedidos[0].init.method ?? "GET").toBe("GET");
  });

  it("o estado que não veio, ou a consulta recusada, é null ou erro", async () => {
    gravar(() => new Response("{}", { status: 200 }));
    expect(await estadoDoVideo("token-de-teste", "urn:li:video:V77")).toBeNull();
    gravar(() => new Response("{}", { status: 403 }));
    await expect(estadoDoVideo("token-de-teste", "urn:li:video:V77")).rejects.toMatchObject({ name: "LinkedinError", status: 403 });
  });
});

// O REDIRECIONAMENTO NÃO É SEGUIDO (o 234). A regra do domínio confere só o primeiro endereço; um 3xx para fora do
// LinkedIn levaria o token (ou a parte do vídeo) junto. Este caso usa dois servidores de verdade no loopback, sem
// trocar o `fetch`, para medir o que o `fetch` do Node faz com o `redirect: "error"`.
describe("o redirecionamento não é seguido", () => {
  it("a parte que recebe um 307 não vai ao endereço do redirecionamento", async () => {
    const recebidos: string[] = [];
    const destino: Server = createServer((req, res) => {
      recebidos.push(req.url ?? "");
      res.writeHead(200, { etag: "nao-devia-chegar" });
      res.end();
    });
    await new Promise<void>((pronto) => destino.listen(0, "127.0.0.1", pronto));
    const portaDestino = (destino.address() as AddressInfo).port;
    const origem: Server = createServer((_req, res) => {
      res.writeHead(307, { location: `http://127.0.0.1:${portaDestino}/capturado` });
      res.end();
    });
    await new Promise<void>((pronto) => origem.listen(0, "127.0.0.1", pronto));
    const portaOrigem = (origem.address() as AddressInfo).port;
    try {
      await expect(enviarParteDoVideo(`http://127.0.0.1:${portaOrigem}/envio`, new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
        name: "LinkedinError",
        status: STATUS_RECUSADO_PELO_PAINEL,
      });
      expect(recebidos).toEqual([]);
    } finally {
      await new Promise((pronto) => origem.close(pronto));
      await new Promise((pronto) => destino.close(pronto));
    }
  });
});
