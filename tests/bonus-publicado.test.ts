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
    ["palavra que não é texto", { palavraChave: 7 }],
    ["palavra além do teto do Labs (80)", { palavraChave: "X".repeat(81) }],
    ["sem título", { titulo: "" }],
    ["tema além do teto do Labs (120)", { tema: "x".repeat(121) }],
    ["tema que não é texto", { tema: 7 }],
    ["descrição que não é texto", { descricao: 7 }],
  ])("%s é formato estranho, e nunca publicado", (_nome, troca) => {
    expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
  });
});

// O LABS PUBLICA BÔNUS SEM PALAVRA OU SEM TEMA (achado 57): os dois campos são opcionais no
// contrato e vêm como chave AUSENTE (site-ia 7971720). E aceita palavra de até 80 caracteres, com
// espaço ou hífen, que o Chat recusa (achado 58). Quem resolve é o operador, no /admin do Labs, e
// a tela diz isso em vez de "formato estranho". Nenhum dos três libera o carrossel.
describe("o bônus publicado que o Chat não consegue usar", () => {
  it.each([
    ["chave ausente", { palavraChave: undefined }],
    ["texto vazio", { palavraChave: "" }],
    ["só espaço", { palavraChave: "   " }],
    ["sem palavra E sem tema", { palavraChave: undefined, tema: undefined }],
  ])("sem palavra-chave (%s)", (_nome, troca) => {
    expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "sem_palavra" });
  });

  it.each([
    ["chave ausente", { tema: undefined }],
    ["texto vazio", { tema: "" }],
  ])("sem tema (%s)", (_nome, troca) => {
    expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "sem_tema" });
  });

  it.each(["SUMI DO", "SEM-DOR", "X".repeat(31), "sumido", "AB"])("palavra fora do padrão do Chat: %s", (palavra) => {
    expect(situacaoNaLista({ items: [{ ...ITEM, palavraChave: palavra }] }, ITEM.codigo)).toEqual({
      tipo: "palavra_fora_do_padrao",
      palavra,
    });
  });

  it("o tema de 120 caracteres, o teto do Labs, passa: no carrossel ele só vai para a mensagem à IA", () => {
    const tema = "t".repeat(120);
    expect(situacaoNaLista({ items: [{ ...ITEM, tema }] }, ITEM.codigo)).toEqual({
      tipo: "publicado",
      bonus: { palavra: "SUMIDO", titulo: ITEM.titulo, tema, descricao: ITEM.descricao },
    });
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
