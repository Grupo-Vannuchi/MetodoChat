import { describe, expect, it, vi } from "vitest";
import { LISTA_MAX_BYTES, situacaoNaLista, situacaoNoLabs } from "@/lib/bonus/publicado";

// O item como a lista pública do Labs o devolve (medido ao vivo em 30/09).
const ITEM = {
  codigo: "reativar-clientes-whatsapp",
  skillId: null,
  palavraChave: "SUMIDO",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  tema: "Vendas",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
};
const LISTA = { items: [{ ...ITEM, codigo: "outro-bonus", palavraChave: "OUTRO" }, ITEM] };
const LABS = "https://metodolabs.metodotia.com";

describe("a situação de um bônus na lista pública do Labs", () => {
  it("publicado: a palavra, o título, o tema e a descrição vêm do Labs", () => {
    expect(situacaoNaLista(LISTA, ITEM.codigo)).toEqual({
      tipo: "publicado",
      bonus: { palavra: "SUMIDO", titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
    });
  });

  it("não achar o slug é não publicado: oculto ou inexistente", () => {
    expect(situacaoNaLista(LISTA, "zz-teste-chat-3009")).toEqual({ tipo: "nao_publicado" });
  });

  it.each([null, {}, { items: "x" }, [], "texto"])("resposta sem lista de itens é formato estranho: %j", (corpo) => {
    expect(situacaoNaLista(corpo, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
  });

  it.each([
    ["palavra minúscula", { palavraChave: "sumido" }],
    ["palavra com espaço", { palavraChave: "SUMI DO" }],
    ["palavra longa demais", { palavraChave: "X".repeat(31) }],
    ["sem palavra", { palavraChave: undefined }],
    ["sem título", { titulo: "" }],
    ["tema longo demais", { tema: "x".repeat(81) }],
    ["descrição que não é texto", { descricao: 7 }],
  ])("%s é formato estranho, e nunca publicado", (_nome, troca) => {
    expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
  });
});

describe("a leitura da lista pelo Chat", () => {
  const resposta = (status: number, corpo: unknown) =>
    new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
  const buscador = (f: () => Promise<Response>) => vi.fn(f) as unknown as typeof fetch;

  it("lê {LABS_URL}/api/bonus sem seguir redirect e sem cache", async () => {
    const f = vi.fn(async () => resposta(200, LISTA));
    const s = await situacaoNoLabs(LABS, ITEM.codigo, f as unknown as typeof fetch);
    expect(s.tipo).toBe("publicado");
    expect(f).toHaveBeenCalledWith(
      `${LABS}/api/bonus`,
      expect.objectContaining({ method: "GET", redirect: "manual", cache: "no-store" })
    );
  });

  it("sem LABS_URL válida, nem tenta: sem configuração", async () => {
    const f = vi.fn();
    expect(await situacaoNoLabs(undefined, ITEM.codigo, f as unknown as typeof fetch)).toEqual({ tipo: "sem_config" });
    expect(await situacaoNoLabs("http://exemplo.com", ITEM.codigo, f as unknown as typeof fetch)).toEqual({
      tipo: "sem_config",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it.each([301, 404, 500, 503])("status %i é sem resposta", async (status) => {
    const f = buscador(async () => resposta(status, { ok: false }));
    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "sem_resposta" });
  });

  it("erro de rede ou tempo esgotado é sem resposta", async () => {
    const f = buscador(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "sem_resposta" });
  });

  it("corpo que não é JSON é formato estranho", async () => {
    const f = buscador(async () => resposta(200, "<html>fora do ar</html>"));
    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "formato_estranho" });
  });

  it("uma lista maior que a de hoje passa inteira: o teto de 16 KiB do envio a cortaria (achado 44)", async () => {
    // A de produção tinha 20 158 bytes em 30/09. Esta passa de 30 KB, e o bônus procurado é o
    // último item: um teto menor que a lista corta o JSON antes dele.
    const outros = Array.from({ length: 80 }, (_, i) => ({ ...ITEM, codigo: `bonus-${i}`, descricao: "d".repeat(300) }));
    const corpo = JSON.stringify({ items: [...outros, ITEM] });
    expect(corpo.length).toBeGreaterThan(30_000);
    const f = buscador(async () => resposta(200, corpo));
    expect((await situacaoNoLabs(LABS, ITEM.codigo, f)).tipo).toBe("publicado");
  });

  it("passar do teto próprio é formato estranho", async () => {
    const gorda = buscador(async () => resposta(200, "x".repeat(LISTA_MAX_BYTES + 1)));
    expect(await situacaoNoLabs(LABS, ITEM.codigo, gorda)).toEqual({ tipo: "formato_estranho" });
  });
});
