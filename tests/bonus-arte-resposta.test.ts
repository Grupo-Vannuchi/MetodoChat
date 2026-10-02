import { afterEach, describe, expect, it, vi } from "vitest";
import { respostaDaArte } from "@/lib/bonus/arte-resposta";
import { slidesDoTexto, type SlideParaArte } from "@/lib/bonus/arte-slides";
import type { CabecalhoDaArte } from "@/lib/bonus/arte-tela";
import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";

// O PNG DE VERDADE: o desenho passa pelo Satori e pelo Resvg, com a Carlito lida do disco. Os
// cabeçalhos conferidos são os que SAEM da resposta, e não os que o código pede (achado 59: o
// next/og tem um padrão próprio, e só os `headers` passados o sobrescrevem). Se o desenho tiver um
// `div` de vários filhos sem `display: flex`, o Satori recusa, e o caso cai aqui.

// A LEITURA DA FONTE PODE SER FEITA FALHAR, um caso de cada vez: a troca é parcial (`importOriginal`
// e espalha), e fora do caso que liga a chave a fonte é a de verdade, lida do disco.
const fonteFalha = vi.hoisted(() => ({ agora: false }));
vi.mock("@/lib/bonus/arte-fonte", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/bonus/arte-fonte")>();
  return {
    ...real,
    fontesDaArte: () => (fonteFalha.agora ? Promise.reject(new Error("ENOENT")) : real.fontesDaArte()),
  };
});

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const CABECALHO: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: null, iniciais: "TV" };

const CARROSSEL: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Nome interno",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [
    { titulo: "O que fazer primeiro", texto: "- Mande uma mensagem curta\n- Lembre do que ele comprou\n\nE espere a resposta." },
  ],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: "Nome interno",
  texto: "Quem sumiu ainda pode voltar, se a mensagem certa chegar na hora certa.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};

/** A largura e a altura gravadas no IHDR do PNG, depois da assinatura de 8 bytes. */
function tamanhoDoPng(b: Buffer): { assinatura: string; largura: number; altura: number } {
  return { assinatura: b.subarray(0, 8).toString("hex"), largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

const pedir = (slide: SlideParaArte, extra: Partial<Parameters<typeof respostaDaArte>[0]> = {}) =>
  respostaDaArte({
    slide,
    comEspaco: true,
    cabecalho: CABECALHO,
    baixar: false,
    nomeDoArquivo: "reativar-clientes-whatsapp-slide-01.png",
    ...extra,
  });

async function desenhar(slide: SlideParaArte, extra: Partial<Parameters<typeof respostaDaArte>[0]> = {}) {
  const arte = await pedir(slide, extra);
  if (!arte.ok) throw new Error(`o desenho falhou: ${arte.falha}`);
  return { r: arte.resposta, png: Buffer.from(await arte.resposta.arrayBuffer()) };
}

const [GANCHO, CONTEUDO, CHAMADA] = slidesDoTexto(CARROSSEL);
const [UNICO] = slidesDoTexto(POST);

describe("o PNG de um slide", () => {
  it("sai 1080×1350, em PNG, aberto no navegador e sem cache", async () => {
    const { r, png } = await desenhar(CONTEUDO);
    expect(tamanhoDoPng(png)).toEqual({ assinatura: "89504e470d0a1a0a", largura: 1080, altura: 1350 });
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("content-disposition")).toBe("inline");
  }, 60_000);

  it("o baixar sai como arquivo, com o nome", async () => {
    const { r } = await desenhar(CONTEUDO, { baixar: true });
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="reativar-clientes-whatsapp-slide-01.png"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  }, 60_000);

  it.each([
    ["o gancho", GANCHO],
    ["a chamada, com a tag no pé", CHAMADA],
    ["o post de uma imagem", UNICO],
  ])("%s também desenha", async (_nome, slide) => {
    expect(tamanhoDoPng((await desenhar(slide)).png)).toMatchObject({ largura: 1080, altura: 1350 });
  }, 60_000);

  it("com a foto da conta, e só texto, também desenha", async () => {
    const { png } = await desenhar(CONTEUDO, { comEspaco: false, cabecalho: { ...CABECALHO, foto: PNG_1X1 } });
    expect(tamanhoDoPng(png)).toMatchObject({ largura: 1080, altura: 1350 });
  }, 60_000);

  it("com o espaço da imagem e só texto, a peça sai diferente", async () => {
    const com = (await desenhar(CONTEUDO, { comEspaco: true })).png;
    const sem = (await desenhar(CONTEUDO, { comEspaco: false })).png;
    expect(com.equals(sem)).toBe(false);
  }, 60_000);
});

// QUANDO O DESENHO FALHA (achado 65): o ImageResponse fixa o status 200 ANTES de desenhar, porque o
// desenho roda dentro do stream do corpo. Uma falha no meio sairia como 200 com o corpo quebrado, e
// a miniatura, quebrada sem frase. Por isso respostaDaArte lê o PNG inteiro antes de responder.
describe("quando o desenho falha", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fonteFalha.agora = false;
  });

  // FF D8 FF é o começo de todo JPEG, e é só o começo que arte-foto.ts confere. Com o resto em lixo,
  // o Satori recusa no meio do desenho ("Invalid JPEG").
  it("a foto que começa como JPEG e não é: o slide sai com as iniciais, igual ao sem foto", async () => {
    const jpegFalso = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2000, 0x41)]);
    const foto = `data:image/jpeg;base64,${jpegFalso.toString("base64")}`;
    const comFoto = await desenhar(CONTEUDO, { cabecalho: { ...CABECALHO, foto } });
    const semFoto = await desenhar(CONTEUDO);
    expect(comFoto.r.status).toBe(200);
    expect(comFoto.r.headers.get("cache-control")).toBe("private, no-store");
    expect(comFoto.png.equals(semFoto.png)).toBe(true);
  }, 60_000);

  // Emoji faz o next/og buscar o desenho do emoji em cdn.jsdelivr.net no meio do desenho (achado
  // 66), sem opção para desligar. Aqui a rede recusa, e nada sai da máquina.
  it("sem foto para tirar, a falha volta como motivo, e não como 200 quebrado", async () => {
    const pedidos: string[] = [];
    vi.stubGlobal("fetch", async (url: string | URL | Request) => {
      pedidos.push(new URL(url instanceof Request ? url.url : url).host);
      throw new Error("rede recusada pelo teste");
    });
    const comEmoji = { ...CONTEUDO, texto: `Comente SUMIDO ${String.fromCodePoint(0x1f447)}` };
    expect(await pedir(comEmoji)).toEqual({ ok: false, falha: "desenho" });
    expect(pedidos).toContain("cdn.jsdelivr.net");
  }, 60_000);

  it("a fonte que não se lê volta como motivo próprio", async () => {
    fonteFalha.agora = true;
    expect(await pedir(CONTEUDO)).toEqual({ ok: false, falha: "fonte" });
  });
});
