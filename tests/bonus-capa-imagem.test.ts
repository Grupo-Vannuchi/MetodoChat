import { describe, expect, it, vi } from "vitest";
import { CORPO_DA_CAPA, CORPO_FIXO, ENDERECO_DA_OPENAI, gerarCapaNaOpenAI, gerarNaOpenAI } from "@/lib/bonus/imagem-openai";
import { problemaDaCapaGerada } from "@/lib/bonus/imagem-regras";
import { ESPACO_DO_GANCHO, FUNDO, PROIBICAO_DE_TEXTO, montarPrompt, montarPromptDaCapa, textoExato } from "@/lib/bonus/prompt-ilustracao";
import { FOTO_DO_ESPACO_MAX_BYTES } from "@/lib/bonus/publicar-regras";

// A IMAGEM DA CAPA POR IA (spec da Etapa 11, "Gerada por IA"): o mesmo criador da Etapa 6 (o modelo fixo, a
// qualidade, as regras de estilo), só que em pé, 1024×1536, e com uma frase a mais no pedido: o terço de
// baixo livre, porque o gancho vai por cima. Os pedidos e o corpo da Etapa 6 continuam iguais, byte a byte
// (tests/bonus-prompt-ilustracao.test.ts e tests/bonus-imagem-openai.test.ts, sem mudança).

const CENA = "/cinema uma pessoa olhando o celular numa loja de roupas";
const AMBIENTE = { OPENAI_API_KEY: "sk-inventada-para-o-teste" };

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];
/** O começo de um JPEG com as medidas no SOF, e o fim. */
function jpeg(largura: number, altura: number, extra = 0): Uint8Array {
  const sof = segmento(0xc0, [8, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return new Uint8Array([0xff, 0xd8, ...segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), ...sof, ...segmento(0xda, [0]), ...Array(extra).fill(0x55), 0xff, 0xd9]);
}

describe("o pedido da capa", () => {
  it("é o pedido de hoje, com a frase da capa logo depois do fundo", () => {
    expect(montarPromptDaCapa(CENA)).toBe(montarPrompt(CENA).replace(FUNDO, `${FUNDO} ${ESPACO_DO_GANCHO}`));
  });

  it("a regra do texto continua a última coisa do pedido, com e sem aspas", () => {
    expect(montarPromptDaCapa(CENA).endsWith(PROIBICAO_DE_TEXTO)).toBe(true);
    expect(montarPromptDaCapa('/cinema uma vitrine com a placa "ABERTO"').endsWith(textoExato(["ABERTO"]))).toBe(true);
  });

  it("a frase da capa não fala em título nem em texto, para o modelo não escrever no terço de baixo", () => {
    expect(ESPACO_DO_GANCHO).not.toMatch(/t[íi]tulo|texto|escrev|letra|palavra/i);
    expect(ESPACO_DO_GANCHO).toContain("terço de baixo");
  });

  it("o pedido de hoje não leva a frase da capa", () => {
    expect(montarPrompt(CENA)).not.toContain(ESPACO_DO_GANCHO);
  });
});

describe("a chamada da capa à OpenAI", () => {
  const respostaOk = () =>
    new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(jpeg(1024, 1536)).toString("base64") }] }), { status: 200 });

  it("o corpo da capa é o de hoje, em pé: 1024×1536", () => {
    expect(CORPO_DA_CAPA).toEqual({ ...CORPO_FIXO, size: "1024x1536" });
    expect(CORPO_FIXO.size).toBe("1536x1024");
  });

  it("manda o corpo em pé e o pedido da capa, no mesmo endereço e com a chave só no cabeçalho", async () => {
    const buscar = vi.fn(async () => respostaOk());
    const r = await gerarCapaNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDERECO_DA_OPENAI);
    expect(JSON.parse(String(init.body))).toEqual({ ...CORPO_DA_CAPA, prompt: montarPromptDaCapa(CENA) });
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${AMBIENTE.OPENAI_API_KEY}`);
    expect(String(init.body)).not.toContain(AMBIENTE.OPENAI_API_KEY);
  });

  it("a chamada de hoje continua deitada, com o pedido de hoje", async () => {
    const buscar = vi.fn(async () => respostaOk());
    await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ ...CORPO_FIXO, prompt: montarPrompt(CENA) });
  });
});

describe("a imagem da capa que voltou", () => {
  it("o JPEG em pé de 1024×1536 passa", () => {
    expect(problemaDaCapaGerada(jpeg(1024, 1536))).toBeNull();
  });

  it("a deitada, que serve ao espaço, não serve à capa", () => {
    expect(problemaDaCapaGerada(jpeg(1536, 1024))).toBe("proporcao");
  });

  it("o que não é JPEG não tem medida, e acima de 2 MB é pesada", () => {
    expect(problemaDaCapaGerada(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("formato");
    expect(problemaDaCapaGerada(jpeg(1024, 1536, FOTO_DO_ESPACO_MAX_BYTES))).toBe("pesada");
  });
});
