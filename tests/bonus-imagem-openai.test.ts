import { describe, expect, it, vi } from "vitest";
import { CORPO_FIXO, ENDERECO_DA_OPENAI, gerarNaOpenAI } from "@/lib/bonus/imagem-openai";
import { MAX_DURATION_S } from "@/lib/bonus/tempos";
import { TETO_IMAGEM_DIARIO, TIMEOUT_IMAGEM_MS, TRAVADA_IMAGEM_MS } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_OPENAI_DEMOROU,
  TEXTO_OPENAI_SEM_IMAGEM,
  TEXTO_SEM_CHAVE_DA_IMAGEM,
  TEXTO_SEM_REDE_DA_OPENAI,
  tirarChave,
} from "@/lib/bonus/imagem-textos";
import { montarPrompt } from "@/lib/bonus/prompt-ilustracao";

// A CHAMADA À OPENAI (spec da Etapa 6, "A chamada à OpenAI"), com um `fetch` falso: nada sai desta
// máquina. O corpo é o do Labs (lib/bonus/prompt-ilustracao.ts embrulha a cena), com uma diferença: o
// JPEG, porque a foto do espaço do Chat é JPEG de até 2 MB.
//
// A CHAVE DESTES TESTES É INVENTADA, e não começa por "sk-" de propósito: a varredura da etapa procura
// esse começo em todo arquivo novo. Onde o teste precisa de um "sk-", ele é montado em partes.

const AMBIENTE = { OPENAI_API_KEY: "chave-inventada-para-o-teste" };
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";
const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status });

describe("os prazos e o teto", () => {
  it("a chamada termina antes de a linha contar como travada, e as duas cabem nos 300 s da página", () => {
    expect(TIMEOUT_IMAGEM_MS).toBe(180_000);
    expect(TIMEOUT_IMAGEM_MS).toBeLessThan(TRAVADA_IMAGEM_MS);
    expect(TRAVADA_IMAGEM_MS).toBeLessThan(MAX_DURATION_S * 1000);
  });

  it("o teto é de 10 por dia, como o Labs", () => {
    expect(TETO_IMAGEM_DIARIO).toBe(10);
  });
});

describe("a chamada à OpenAI", () => {
  it("sem a chave, recusa sem chamar", async () => {
    const buscar = vi.fn();
    expect(await gerarNaOpenAI(CENA, {}, buscar)).toEqual({ ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM });
    expect(await gerarNaOpenAI(CENA, { OPENAI_API_KEY: "   " }, buscar)).toEqual({ ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("o corpo é o do Labs em JPEG, com a cena embrulhada nas regras, e com prazo", async () => {
    const buscar = vi.fn(async (_url: string, _init: RequestInit) => resposta(200, { data: [{ b64_json: "AQID" }] }));
    await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    const [url, init] = buscar.mock.calls[0];
    expect(url).toBe(ENDERECO_DA_OPENAI);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer chave-inventada-para-o-teste");
    expect(JSON.parse(String(init.body))).toEqual({ ...CORPO_FIXO, prompt: montarPrompt(CENA) });
    expect(CORPO_FIXO).toMatchObject({
      model: "gpt-image-1",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      background: "opaque",
      output_format: "jpeg",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("a imagem volta em bytes, lida de data[0].b64_json", async () => {
    const buscar = async () => resposta(200, { data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff, 1]).toString("base64") }] });
    expect(await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch)).toEqual({
      ok: true,
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 1]),
    });
  });

  it("sem a imagem no corpo, a frase própria", async () => {
    const buscar = async () => resposta(200, { data: [{}] });
    expect(await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch)).toEqual({ ok: false, erro: TEXTO_OPENAI_SEM_IMAGEM });
  });

  it("a recusa da OpenAI vira a frase do Labs", async () => {
    const buscar = async () => resposta(429, { error: { message: "Rate limit reached" } });
    const r = await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    expect(r.ok ? null : r.erro).toMatch(/^A OpenAI recusou por limite de requisições/);
  });

  // O 401 DA OPENAI TRAZ UM PEDAÇO DA CHAVE ("Incorrect API key provided: sk-proj-…wxyz"), e a frase do
  // Labs repassa a mensagem dela. Aqui nada disso chega à tela nem ao banco.
  it("a chave nunca vai para a frase: nem o pedaço que a OpenAI devolve, nem a chave inteira", async () => {
    const pedaco = ["sk", "proj", "********************wxyz"].join("-");
    const buscar = async () =>
      resposta(401, { error: { message: `Incorrect API key provided: ${pedaco}. Key chave-inventada-para-o-teste.` } });
    const r = await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    const erro = r.ok ? "" : r.erro;
    expect(erro).toMatch(/^A OpenAI não reconheceu a chave/);
    expect(erro).not.toContain(["sk", "proj"].join("-"));
    expect(erro).not.toContain("wxyz");
    expect(erro).not.toContain("chave-inventada-para-o-teste");
  });

  it("a demora e a rede que cai têm frase própria", async () => {
    const demora = async () => {
      throw Object.assign(new Error("tempo"), { name: "TimeoutError" });
    };
    const rede = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await gerarNaOpenAI(CENA, AMBIENTE, demora as unknown as typeof fetch)).toEqual({ ok: false, erro: TEXTO_OPENAI_DEMOROU });
    expect(await gerarNaOpenAI(CENA, AMBIENTE, rede as unknown as typeof fetch)).toEqual({ ok: false, erro: TEXTO_SEM_REDE_DA_OPENAI });
  });
});

describe("tirar a chave de uma frase", () => {
  it("troca todo pedaço que começa por sk- e a chave inteira", () => {
    const pedaco = ["sk", "abc123", "XYZ"].join("-");
    expect(tirarChave(`a chave ${pedaco} e a chave-inventada.`, "chave-inventada")).toBe("a chave sk-… e a ….");
  });

  it("deixa a frase sem chave como está", () => {
    expect(tirarChave("A OpenAI respondeu 500.", "chave-inventada")).toBe("A OpenAI respondeu 500.");
  });
});
