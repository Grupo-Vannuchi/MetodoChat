import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  converterParaJpeg,
  enviarImagemDoSlide,
  prepararArtes,
  prepararImagem,
  publicarDaTela,
} from "@/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { FOTO_DO_ESPACO_MAX_BYTES } from "@/lib/bonus/publicar-regras";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A IMAGEM NO NAVEGADOR (spec da Etapa 5): a conversão para JPEG, a conferência do 4:5 antes de
// subir, o PUT direto ao bucket e as artes "Só texto" na hora de publicar. O jsdom não tem `canvas`
// nem `createImageBitmap`: os dois são falsos aqui, e cada pincelada fica anotada. O que se prova é a
// ORDEM e os NÚMEROS (o branco antes do desenho, as medidas do plano, o JPEG a 0,9), e não o pixel.
//
// Do adendo da foto no espaço: o recorte da foto (o `drawImage` de nove números), e as artes que a
// rota responde com a versão do desenho e, no slide com foto, com o "sim" ou o "faltou" (achado 78).

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

let medidas: { width: number; height: number };
let pinceladas: string[];
let toBlob: { tipo: string; qualidade: number; largura: number; altura: number }[];
let puts: { url: string; tipo: string | null; corpo: unknown }[];
let artesPedidas: string[];
/** O tamanho do JPEG que o canvas falso grava; sem ele, 4 bytes. */
let bytesDoJpeg: number | null;
/** O que a rota falsa diz da foto de cada slide (`X-Arte-Foto`); sem entrada, nada. */
let fotoNaArte: Record<number, string>;

const slideDaUrl = (url: string) => Number(new URL(url, "http://x").searchParams.get("slide"));

beforeEach(() => {
  medidas = { width: 1080, height: 1350 };
  pinceladas = [];
  toBlob = [];
  puts = [];
  artesPedidas = [];
  bytesDoJpeg = null;
  fotoNaArte = {};
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
      drawImage: (...a: unknown[]) =>
        pinceladas.push(a.length === 9 ? `recortou ${a[1]},${a[2]} ${a[3]}x${a[4]} em ${a[7]}x${a[8]}` : `desenhou ${a[3]}x${a[4]}`),
    };
    return ctx as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, fn, tipo, qualidade) {
    toBlob.push({ tipo: tipo ?? "", qualidade: qualidade as number, largura: this.width, altura: this.height });
    fn(new Blob([bytesDoJpeg === null ? "jpeg" : new Uint8Array(bytesDoJpeg)], { type: "image/jpeg" }));
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (init.method === "PUT") {
        puts.push({ url, tipo: new Headers(init.headers).get("content-type"), corpo: init.body });
        return new Response("{}", { status: 200 });
      }
      artesPedidas.push(url);
      const n = slideDaUrl(url);
      const cabecalhos: Record<string, string> = { "content-type": "image/png", "x-arte-versao": `desenho-${n}` };
      if (fotoNaArte[n]) cabecalhos["x-arte-foto"] = fotoNaArte[n];
      return new Response("png", { status: 200, headers: cabecalhos });
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
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, jeito: "slide", arquivo: arquivo("image/png"), assinar: assinarOk, guardar });
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
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, jeito: "slide", arquivo: arquivo("image/jpeg"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "A imagem do slide tem de ser 4:5, como a arte (1080×1350)." });
    expect(assinar).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  it("o formato que o canvas não converte é recusado antes de pedir a assinatura", async () => {
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, jeito: "slide", arquivo: arquivo("image/gif"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "Envie a imagem do Canva em JPEG, PNG ou WEBP." });
    expect(assinar).not.toHaveBeenCalled();
  });

  it("a recusa da assinatura volta como aviso, sem subir nem guardar", async () => {
    const guardar = vi.fn();
    const r = await enviarImagemDoSlide({
      carrosselId: CARROSSEL,
      numero: 3,
      jeito: "slide",
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
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, jeito: "slide", arquivo: arquivo("image/jpeg"), assinar: assinarOk, guardar });
    expect(r).toMatchObject({ tom: "erro", texto: "O armazenamento recusou a imagem (HTTP 403)." });
    expect(guardar).not.toHaveBeenCalled();
  });
});

// A FOTO NO ESPAÇO (adendo da Etapa 5): cortada ao centro na proporção do espaço (860:573), reduzida
// até 1720×1146, em JPEG a 0,9. O que sobe já tem a forma do espaço. A pequena é recusada antes de
// assinar, e a que passa de 2 MB também (achado 79).
describe("enviar a foto do espaço de um slide", () => {
  const assinarOk = vi.fn(
    async (): Promise<RespostaDaAssinatura> => ({ ok: true, caminho: "178/bonus-foto/u.jpg", url: "https://bucket/sign/178/bonus-foto/u.jpg?token=t" })
  );
  const guardado: AvisoDaImagem = { tom: "ok", texto: "Imagem guardada.", em: 1, versao: "0a1b2c3d", jeito: "foto", versaoDaMiniatura: "m2-foto" };

  it("recorta ao centro, reduz ao dobro do espaço, assina no destino da foto, sobe e guarda", async () => {
    medidas = { width: 4032, height: 3024 };
    const guardar = vi.fn(async () => guardado);
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 2, jeito: "foto", arquivo: arquivo("image/jpeg"), assinar: assinarOk, guardar });
    expect(r).toBe(guardado);
    expect(pinceladas).toEqual(["cor #ffffff", "pintou 1720x1146", "recortou 0,169 4032x2686 em 1720x1146", "fechou"]);
    expect(toBlob).toEqual([{ tipo: "image/jpeg", qualidade: 0.9, largura: 1720, altura: 1146 }]);
    expect(assinarOk).toHaveBeenCalledWith({
      id: CARROSSEL,
      numero: 2,
      destino: "foto",
      arquivo: { nome: "foto-2.jpg", mime: "image/jpeg", bytes: 4, largura: 1720, altura: 1146 },
    });
    expect(puts).toEqual([{ url: "https://bucket/sign/178/bonus-foto/u.jpg?token=t", tipo: "image/jpeg", corpo: expect.any(Blob) }]);
    expect(guardar).toHaveBeenCalledWith({ id: CARROSSEL, numero: 2, caminho: "178/bonus-foto/u.jpg" });
  });

  it("a foto em pé também serve: perde o alto e o baixo", async () => {
    medidas = { width: 1080, height: 1350 };
    await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 2, jeito: "foto", arquivo: arquivo("image/jpeg"), assinar: assinarOk, guardar: vi.fn() });
    expect(pinceladas).toContain("recortou 0,315 1080x720 em 1080x720");
  });

  it("a foto cujo recorte fica menor que o espaço é recusada antes de assinar", async () => {
    medidas = { width: 800, height: 600 };
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 2, jeito: "foto", arquivo: arquivo("image/jpeg"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "A foto é pequena para o espaço da arte: o mínimo é 860×573." });
    expect(assinar).not.toHaveBeenCalled();
    expect(toBlob).toEqual([]);
  });

  it("a foto que passa de 2 MB depois de reduzida é recusada antes de assinar (achado 79)", async () => {
    medidas = { width: 1720, height: 1146 };
    bytesDoJpeg = FOTO_DO_ESPACO_MAX_BYTES + 1;
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 2, jeito: "foto", arquivo: arquivo("image/jpeg"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro" });
    expect((r as { texto: string }).texto).toContain("2 MB");
    expect(assinar).not.toHaveBeenCalled();
  });

  it("a foto que o navegador não abre é recusada com a frase da foto", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("formato"))));
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 2, jeito: "foto", arquivo: arquivo("image/heic"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "Não consegui abrir esta foto. Envie em JPEG, PNG ou WEBP." });
    expect(assinar).not.toHaveBeenCalled();
  });
});

describe("as artes do Chat, na hora de publicar", () => {
  const assinar = vi.fn(async (p: unknown): Promise<RespostaDaAssinatura> => {
    const n = (p as { numero: number }).numero;
    return { ok: true, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
  });
  const pedido = (desenhados: { numero: number; comFoto: boolean }[], a = assinar) => ({
    bonusId: BONUS,
    carrosselId: CARROSSEL,
    desenhados,
    versoesDaMiniatura: ["m1", "m2", "m3", "m4", "m5"],
    assinar: a,
  });

  // A VERSÃO É A DO QUE A ROTA DESENHOU (`X-Arte-Versao`), e não a que a página tinha: depois de salvar
  // um slide sem recarregar, a da página era a velha, e o publicar recusava sempre (achado no ensaio).
  it("baixa a arte de cada slide, converte, assina no destino da fila, sobe, e manda a versão da rota", async () => {
    fotoNaArte = { 2: "sim" };
    const r = await prepararArtes(
      pedido([
        { numero: 1, comFoto: false },
        { numero: 2, comFoto: true },
        { numero: 5, comFoto: false },
      ])
    );
    expect(r).toEqual({
      ok: true,
      artes: [
        { numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "desenho-1" },
        { numero: 2, caminho: "178/bonus-fila/2.jpg", versao: "desenho-2" },
        { numero: 5, caminho: "178/bonus-fila/5.jpg", versao: "desenho-5" },
      ],
    });
    expect(artesPedidas).toEqual([urlDaArte(BONUS, CARROSSEL, 1, "m1"), urlDaArte(BONUS, CARROSSEL, 2, "m2"), urlDaArte(BONUS, CARROSSEL, 5, "m5")]);
    expect(assinar.mock.calls.map((c) => (c[0] as { destino: string }).destino)).toEqual(["fila", "fila", "fila"]);
    expect(puts.map((p) => p.tipo)).toEqual(["image/jpeg", "image/jpeg", "image/jpeg"]);
    expect(toBlob).toHaveLength(3);
  });

  // ACHADO 78: a arte com o espaço em branco iria ao post, em público e sem volta.
  it.each([
    ["faltou", { 2: "faltou" }],
    ["sem o cabeçalho", {}],
  ])("a arte do slide com foto que veio %s não assina nem sobe", async (_nome, foto) => {
    fotoNaArte = foto;
    const a = vi.fn();
    const r = await prepararArtes(pedido([{ numero: 2, comFoto: true }], a));
    expect(r).toEqual({ ok: false, texto: "A foto do slide 2 não carregou. Espere um instante e publique de novo." });
    expect(a).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  // ACHADO 81: a página pode estar velha (o slide ganhou a foto noutra aba, sem recarregar esta). A
  // rota decide pelo banco, e só manda o cabeçalho da foto no slide que tem foto: o que ela diz vale.
  it("a arte que veio com faltou não sobe, mesmo que a página ache o slide sem foto", async () => {
    fotoNaArte = { 1: "faltou" };
    const a = vi.fn();
    const r = await prepararArtes(pedido([{ numero: 1, comFoto: false }], a));
    expect(r).toEqual({ ok: false, texto: "A foto do slide 1 não carregou. Espere um instante e publique de novo." });
    expect(a).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  it("a arte que veio com a foto desenhada sobe, mesmo que a página ache o slide sem foto", async () => {
    fotoNaArte = { 1: "sim" };
    const r = await prepararArtes(pedido([{ numero: 1, comFoto: false }]));
    expect(r).toEqual({ ok: true, artes: [{ numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "desenho-1" }] });
  });

  it("a arte sem a versão do desenho não sobe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("png", { status: 200, headers: { "content-type": "image/png" } })));
    const a = vi.fn();
    const r = await prepararArtes(pedido([{ numero: 1, comFoto: false }], a));
    expect(r).toEqual({ ok: false, texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(a).not.toHaveBeenCalled();
  });

  // Medido no ensaio: sem esta conferência, uma resposta que não fosse PNG (nem JPEG) subia crua,
  // declarada como JPEG, e o servidor não vê os bytes para conferir.
  it("a arte que não vira JPEG não sobe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("texto", { status: 200, headers: { "content-type": "text/plain", "x-arte-versao": "desenho-1" } }))
    );
    const a = vi.fn();
    const r = await prepararArtes(pedido([{ numero: 1, comFoto: false }], a));
    expect(r).toEqual({ ok: false, texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(a).not.toHaveBeenCalled();
  });

  it("a arte que não vem para tudo, dizendo qual slide", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    const a = vi.fn();
    const r = await prepararArtes(pedido([{ numero: 1, comFoto: false }], a));
    expect(r).toEqual({ ok: false, texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(a).not.toHaveBeenCalled();
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
    desenhados: [{ numero: 1, comFoto: false }],
    versoesDaMiniatura: ["m1", "m2"],
    assinar,
  };

  it("prepara as artes e manda junto, com a hora e o fuso do navegador", async () => {
    const publicar = vi.fn(async () => ({ tom: "ok" as const, texto: "Na fila do /publicar.", em: 1 }));
    const r = await publicarDaTela({ ...base, quando: "depois", dataHora: "2026-10-06T18:00", publicar });
    expect(r).toMatchObject({ tom: "ok" });
    expect(publicar).toHaveBeenCalledWith({
      id: CARROSSEL,
      quando: "depois",
      dataHora: "2026-10-06T18:00",
      fuso: String(new Date().getTimezoneOffset()),
      artes: [{ numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "desenho-1" }],
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
