import { describe, expect, it, vi } from "vitest";
import {
  LISTA_MAX_BYTES,
  bonusDaLista,
  listaDoLabs,
  situacaoDoAvulsoNoLabs,
  situacaoNaLista,
  situacaoNaListaDoAvulso,
  situacaoNoLabs,
} from "@/lib/bonus/publicado";

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

// A LISTA DE ESCOLHA DO "NOVO CARROSSEL" (spec da Etapa 7): a mesma leitura, com as mesmas regras por
// item. O bônus que o Chat não consegue usar não aparece, e a falha da leitura tem o motivo, e não
// uma lista vazia.
describe("a lista de escolha do carrossel avulso", () => {
  const resposta = (status: number, corpo: unknown) =>
    new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
  const buscador = (f: () => Promise<Response>) => vi.fn(f) as unknown as typeof fetch;
  const BRUTAL = {
    ...ITEM,
    codigo: "conselheiro-brutalmente-honesto",
    palavraChave: "BRUTAL",
    titulo: "Conselheiro brutalmente honesto",
    tema: "Produtividade",
  };

  // Desde a Etapa 8, o bônus sem palavra entra (com a palavra nula), e os que ficam de fora são
  // contados por motivo, para a tela dizer quantos e por quê (achado 84).
  it("traz os bônus que o Chat consegue usar, do mais novo para o mais velho, e conta os de fora", () => {
    const lista = {
      items: [
        ITEM,
        { ...ITEM, codigo: "sem-palavra", palavraChave: undefined },
        { ...ITEM, codigo: "palavra-de-fora", palavraChave: "SEM-DOR" },
        { ...ITEM, codigo: "sem-tema", tema: "" },
        { ...ITEM, codigo: "sem-palavra-nem-tema", palavraChave: undefined, tema: undefined },
        { ...ITEM, codigo: 7 },
        { ...ITEM, codigo: "" },
        BRUTAL,
      ],
    };
    expect(bonusDaLista(lista)).toEqual({
      bonus: [
        { codigo: BRUTAL.codigo, palavra: "BRUTAL", titulo: BRUTAL.titulo, tema: "Produtividade", descricao: ITEM.descricao },
        { codigo: "sem-palavra", palavra: null, titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
        { codigo: ITEM.codigo, palavra: "SUMIDO", titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
      ],
      deFora: { semTema: 2, palavraForaDoPadrao: 1, formatoEstranho: 2 },
    });
  });

  it("sem nenhum de fora, a contagem é zero", () => {
    expect(bonusDaLista({ items: [ITEM, BRUTAL] })?.deFora).toEqual({ semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 });
  });

  it.each([null, {}, { items: "x" }, [], "texto"])("resposta sem lista de itens não é lista: %j", (corpo) => {
    expect(bonusDaLista(corpo)).toBeNull();
  });

  it("a leitura devolve a lista inteira", async () => {
    const f = buscador(async () => resposta(200, { items: [ITEM, BRUTAL] }));
    const r = await listaDoLabs(LABS, f);
    expect(r.ok && r.bonus.map((b) => b.codigo)).toEqual([BRUTAL.codigo, ITEM.codigo]);
    expect(r.ok && r.deFora).toEqual({ semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 });
  });

  it("a falha da leitura diz o motivo", async () => {
    expect(await listaDoLabs(undefined, buscador(async () => resposta(200, LISTA)))).toEqual({ ok: false, tipo: "sem_config" });
    expect(await listaDoLabs(LABS, buscador(async () => resposta(503, {})))).toEqual({ ok: false, tipo: "sem_resposta" });
    expect(await listaDoLabs(LABS, buscador(async () => resposta(200, "<html>")))).toEqual({ ok: false, tipo: "formato_estranho" });
    expect(await listaDoLabs(LABS, buscador(async () => resposta(200, { items: 1 })))).toEqual({ ok: false, tipo: "formato_estranho" });
  });
});

// AS DUAS REGRAS DO LABS (spec da Etapa 8, achado 85): a do bônus do Chat continua a de hoje (o sem
// palavra é "sem_palavra", acima); a do avulso aceita o bônus sem palavra e com tema, com a palavra
// nula. Com palavra, as duas dizem o mesmo.
describe("a regra do avulso do Labs", () => {
  const avulso = (troca: Record<string, unknown>) => situacaoNaListaDoAvulso({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo);

  it.each([
    ["chave ausente", { palavraChave: undefined }],
    ["texto vazio", { palavraChave: "" }],
    ["só espaço", { palavraChave: "   " }],
  ])("sem palavra (%s) e com tema, é publicado com a palavra nula", (_nome, troca) => {
    expect(avulso(troca)).toEqual({
      tipo: "publicado",
      bonus: { palavra: null, titulo: ITEM.titulo, descricao: ITEM.descricao, tema: "Vendas" },
    });
  });

  it("sem palavra e sem tema, fica de fora pelo tema", () => {
    expect(avulso({ palavraChave: undefined, tema: undefined })).toEqual({ tipo: "sem_tema" });
  });

  it("sem palavra e com o título fora do formato, é formato estranho", () => {
    expect(avulso({ palavraChave: undefined, titulo: "" })).toEqual({ tipo: "formato_estranho" });
  });

  it.each([
    ["publicado", {}],
    ["palavra fora do padrão", { palavraChave: "SEM-DOR" }],
    ["palavra que não é texto", { palavraChave: null }],
    ["sem tema", { tema: "" }],
  ])("com palavra, diz o mesmo que a regra do bônus do Chat (%s)", (_nome, troca) => {
    const corpo = { items: [{ ...ITEM, ...troca }] };
    expect(situacaoNaListaDoAvulso(corpo, ITEM.codigo)).toEqual(situacaoNaLista(corpo, ITEM.codigo));
  });

  it("fora da lista e lista estranha, como a regra do Chat", () => {
    expect(situacaoNaListaDoAvulso(LISTA, "zz-teste")).toEqual({ tipo: "nao_publicado" });
    expect(situacaoNaListaDoAvulso({ items: "x" }, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
  });

  it("a leitura do avulso pergunta ao Labs e usa a regra dele", async () => {
    const corpo = { items: [{ ...ITEM, palavraChave: undefined }] };
    const f = vi.fn(async () => new Response(JSON.stringify(corpo), { status: 200 })) as unknown as typeof fetch;
    expect(await situacaoDoAvulsoNoLabs(LABS, ITEM.codigo, f)).toMatchObject({ tipo: "publicado", bonus: { palavra: null } });
    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "sem_palavra" });
    expect(await situacaoDoAvulsoNoLabs(undefined, ITEM.codigo, f)).toEqual({ tipo: "sem_config" });
  });
});
