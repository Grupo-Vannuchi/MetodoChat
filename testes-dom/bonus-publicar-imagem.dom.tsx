import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  converterParaJpeg,
  enviarImagemDoSlide,
  prepararArtesSoTexto,
  prepararImagem,
  publicarDaTela,
} from "@/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A IMAGEM NO NAVEGADOR (spec da Etapa 5): a conversão para JPEG, a conferência do 4:5 antes de
// subir, o PUT direto ao bucket e as artes "Só texto" na hora de publicar. O jsdom não tem `canvas`
// nem `createImageBitmap`: os dois são falsos aqui, e cada pincelada fica anotada. O que se prova é a
// ORDEM e os NÚMEROS (o branco antes do desenho, as medidas do plano, o JPEG a 0,9), e não o pixel.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

let medidas: { width: number; height: number };
let pinceladas: string[];
let toBlob: { tipo: string; qualidade: number; largura: number; altura: number }[];
let puts: { url: string; tipo: string | null; corpo: unknown }[];
let artesPedidas: string[];

beforeEach(() => {
  medidas = { width: 1080, height: 1350 };
  pinceladas = [];
  toBlob = [];
  puts = [];
  artesPedidas = [];
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: medidas.width, height: medidas.height, close: () => pinceladas.push("fechou") }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    const ctx = {
      set fillStyle(v: string) {
        pinceladas.push(`cor ${v}`);
      },
      fillRect: (_x: number, _y: number, l: number, a: number) => pinceladas.push(`pintou ${l}x${a}`),
      drawImage: (_b: unknown, _x: number, _y: number, l: number, a: number) => pinceladas.push(`desenhou ${l}x${a}`),
    };
    return ctx as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, fn, tipo, qualidade) {
    toBlob.push({ tipo: tipo ?? "", qualidade: qualidade as number, largura: this.width, altura: this.height });
    fn(new Blob(["jpeg"], { type: "image/jpeg" }));
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (init.method === "PUT") {
        puts.push({ url, tipo: new Headers(init.headers).get("content-type"), corpo: init.body });
        return new Response("{}", { status: 200 });
      }
      artesPedidas.push(url);
      return new Response("png", { status: 200, headers: { "content-type": "image/png" } });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const arquivo = (tipo: string) => new File(["x"], "slide.png", { type: tipo });

describe("a conversão para JPEG, copiada do enviador do /publicar", () => {
  // A ARMADILHA Nº 1 (app/publicar/enviador.tsx:537-544): o canvas nasce transparente, e o PNG com
  // fundo transparente viraria JPEG de fundo preto.
  it("pinta de branco antes de desenhar, nas medidas do plano, e grava JPEG a 0,9", async () => {
    const jpeg = await converterParaJpeg(arquivo("image/png"), { largura: 1080, altura: 1350, qualidade: 0.9 });
    expect(pinceladas).toEqual(["cor #ffffff", "pintou 1080x1350", "desenhou 1080x1350", "fechou"]);
    expect(toBlob).toEqual([{ tipo: "image/jpeg", qualidade: 0.9, largura: 1080, altura: 1350 }]);
    expect(jpeg.type).toBe("image/jpeg");
  });

  it("o plano sem medida usa a da imagem", async () => {
    await converterParaJpeg(arquivo("image/png"), { largura: 0, altura: 0, qualidade: 0.9 });
    expect(toBlob[0]).toMatchObject({ largura: 1080, altura: 1350 });
  });
});

describe("preparar a imagem", () => {
  it("o JPEG que já serve vai cru, sem passar pelo canvas", async () => {
    const original = arquivo("image/jpeg");
    const pronta = await prepararImagem(original);
    expect(pronta).toEqual({ jpeg: original, largura: 1080, altura: 1350 });
    expect(toBlob).toEqual([]);
  });

  it("o PNG vira JPEG nas mesmas medidas", async () => {
    const pronta = await prepararImagem(arquivo("image/png"));
    expect(pronta.jpeg.type).toBe("image/jpeg");
    expect(pronta).toMatchObject({ largura: 1080, altura: 1350 });
  });

  it("acima de 1440 de largura, encolhe até 1440, mantendo a proporção", async () => {
    medidas = { width: 2160, height: 2700 };
    const pronta = await prepararImagem(arquivo("image/jpeg"));
    expect(pronta).toMatchObject({ largura: 1440, altura: 1800 });
    expect(toBlob[0]).toMatchObject({ largura: 1440, altura: 1800 });
  });
});

describe("enviar a imagem do Canva de um slide", () => {
  const assinarOk = vi.fn(
    async (): Promise<RespostaDaAssinatura> => ({ ok: true, caminho: "178/bonus/u.jpg", url: "https://bucket/sign/178/bonus/u.jpg?token=t" })
  );
  const guardado: AvisoDaImagem = { tom: "ok", texto: "Imagem guardada.", em: 1, versao: "0a1b2c3d", imagem: "https://bucket/public/u.jpg" };

  it("assina com as medidas do JPEG, sobe pelo PUT e guarda", async () => {
    const guardar = vi.fn(async () => guardado);
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/png"), assinar: assinarOk, guardar });
    expect(r).toBe(guardado);
    expect(assinarOk).toHaveBeenCalledWith({
      id: CARROSSEL,
      numero: 3,
      destino: "slide",
      arquivo: { nome: "slide-3.jpg", mime: "image/jpeg", bytes: 4, largura: 1080, altura: 1350 },
    });
    expect(puts).toEqual([{ url: "https://bucket/sign/178/bonus/u.jpg?token=t", tipo: "image/jpeg", corpo: expect.any(Blob) }]);
    expect(guardar).toHaveBeenCalledWith({ id: CARROSSEL, numero: 3, caminho: "178/bonus/u.jpg" });
  });

  it("a imagem que não é 4:5 é recusada antes de pedir a assinatura", async () => {
    medidas = { width: 1080, height: 1080 };
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/jpeg"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "A imagem do slide tem de ser 4:5, como a arte (1080×1350)." });
    expect(assinar).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  it("o formato que o canvas não converte é recusado antes de pedir a assinatura", async () => {
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/gif"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "Envie a imagem do Canva em JPEG, PNG ou WEBP." });
    expect(assinar).not.toHaveBeenCalled();
  });

  it("a recusa da assinatura volta como aviso, sem subir nem guardar", async () => {
    const guardar = vi.fn();
    const r = await enviarImagemDoSlide({
      carrosselId: CARROSSEL,
      numero: 3,
      arquivo: arquivo("image/jpeg"),
      assinar: async () => ({ ok: false, texto: "Agendado: para mudar, cancele no calendário." }),
      guardar,
    });
    expect(r).toMatchObject({ tom: "erro", texto: "Agendado: para mudar, cancele no calendário." });
    expect(puts).toEqual([]);
    expect(guardar).not.toHaveBeenCalled();
  });

  it("o PUT recusado volta como aviso, sem guardar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    const guardar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/jpeg"), assinar: assinarOk, guardar });
    expect(r).toMatchObject({ tom: "erro", texto: "O armazenamento recusou a imagem (HTTP 403)." });
    expect(guardar).not.toHaveBeenCalled();
  });
});

describe("as artes Só texto, na hora de publicar", () => {
  it("baixa a arte de cada slide só texto, converte, assina no destino da fila e sobe", async () => {
    const assinar = vi.fn(async (p: unknown): Promise<RespostaDaAssinatura> => {
      const n = (p as { numero: number }).numero;
      return { ok: true, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
    });
    const r = await prepararArtesSoTexto({
      bonusId: BONUS,
      carrosselId: CARROSSEL,
      soTexto: [1, 5],
      versoesDaMiniatura: ["m1", "m2", "m3", "m4", "m5"],
      versoesDoTexto: ["t1", "t2", "t3", "t4", "t5"],
      assinar,
    });
    expect(r).toEqual({
      ok: true,
      artes: [
        { numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "t1" },
        { numero: 5, caminho: "178/bonus-fila/5.jpg", versao: "t5" },
      ],
    });
    expect(artesPedidas).toEqual([urlDaArte(BONUS, CARROSSEL, 1, "m1"), urlDaArte(BONUS, CARROSSEL, 5, "m5")]);
    expect(assinar.mock.calls.map((c) => (c[0] as { destino: string }).destino)).toEqual(["fila", "fila"]);
    expect(puts.map((p) => p.tipo)).toEqual(["image/jpeg", "image/jpeg"]);
    expect(toBlob).toHaveLength(2);
  });

  // Medido no ensaio: sem esta conferência, uma resposta que não fosse PNG (nem JPEG) subia crua,
  // declarada como JPEG, e o servidor não vê os bytes para conferir.
  it("a arte que não vira JPEG não sobe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("texto", { status: 200, headers: { "content-type": "text/plain" } })));
    const assinar = vi.fn();
    const r = await prepararArtesSoTexto({
      bonusId: BONUS,
      carrosselId: CARROSSEL,
      soTexto: [1],
      versoesDaMiniatura: ["m1"],
      versoesDoTexto: ["t1"],
      assinar,
    });
    expect(r).toEqual({ ok: false, texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(assinar).not.toHaveBeenCalled();
  });

  it("a arte que não vem para tudo, dizendo qual slide", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    const assinar = vi.fn();
    const r = await prepararArtesSoTexto({
      bonusId: BONUS,
      carrosselId: CARROSSEL,
      soTexto: [1],
      versoesDaMiniatura: ["m1"],
      versoesDoTexto: ["t1"],
      assinar,
    });
    expect(r).toEqual({ ok: false, texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(assinar).not.toHaveBeenCalled();
  });
});

describe("publicar da tela", () => {
  const assinar = vi.fn(async (p: unknown): Promise<RespostaDaAssinatura> => {
    const n = (p as { numero: number }).numero;
    return { ok: true, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
  });
  const base = {
    bonusId: BONUS,
    carrosselId: CARROSSEL,
    soTexto: [1],
    versoesDaMiniatura: ["m1", "m2"],
    versoesDoTexto: ["t1", "t2"],
    assinar,
  };

  it("prepara as artes só texto e manda junto, com a hora e o fuso do navegador", async () => {
    const publicar = vi.fn(async () => ({ tom: "ok" as const, texto: "Na fila do /publicar.", em: 1 }));
    const r = await publicarDaTela({ ...base, quando: "depois", dataHora: "2026-10-06T18:00", publicar });
    expect(r).toMatchObject({ tom: "ok" });
    expect(publicar).toHaveBeenCalledWith({
      id: CARROSSEL,
      quando: "depois",
      dataHora: "2026-10-06T18:00",
      fuso: String(new Date().getTimezoneOffset()),
      artes: [{ numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "t1" }],
    });
  });

  it("a arte que não vem vira o aviso de erro, e o pedido não sai", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    const publicar = vi.fn();
    const r = await publicarDaTela({ ...base, quando: "agora", dataHora: "", publicar });
    expect(r).toMatchObject({ tom: "erro", texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(publicar).not.toHaveBeenCalled();
  });
});
