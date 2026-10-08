import { describe, expect, it } from "vitest";
import {
  CONTEUDO_MAX,
  CONTEUDO_MIN,
  DESTAQUE_MAX,
  contextoDoLabs,
  contextoLivre,
  lerPedidoAvulso,
  tituloInterno,
} from "@/lib/bonus/avulso-pedido";
import { textoDaOrigem, textoDaRecusaDoPedidoAvulso } from "@/lib/bonus/avulso-textos";
import { lerTotalDeSlides } from "@/lib/bonus/carrossel-pedido";

// O PEDIDO DE UM CARROSSEL AVULSO (spec da Etapa 7): de um bônus do Labs ou de um texto livre, pela IA
// ou escrito à mão. Quem decide o que é pedido válido é a função pura, e não a action.

const DO_LABS = {
  origem: "labs",
  codigo: "conselheiro-brutalmente-honesto",
  destaque: "",
  tema: "",
  palavra: "",
  conteudo: "",
  total: "5",
  jeito: "ia",
};
const LIVRE = {
  origem: "livre",
  codigo: "",
  destaque: "",
  tema: "Produtividade",
  palavra: "brutal",
  conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
  total: "4",
  jeito: "mao",
};

describe("o pedido do carrossel avulso", () => {
  it("do Labs: o código, o destaque, o total e o jeito", () => {
    expect(lerPedidoAvulso(DO_LABS)).toEqual({
      ok: true,
      pedido: { origem: "labs", codigo: "conselheiro-brutalmente-honesto", destaque: "", total: 5, jeito: "ia", acao: null },
    });
  });

  it("o código e o destaque chegam aparados, com a quebra do textarea em \\n", () => {
    const r = lerPedidoAvulso({ ...DO_LABS, codigo: "  conselheiro-brutalmente-honesto ", destaque: " Mostre o antes\r\ne o depois. " });
    expect(r.ok && r.pedido).toEqual({
      origem: "labs",
      codigo: "conselheiro-brutalmente-honesto",
      destaque: "Mostre o antes\ne o depois.",
      total: 5,
      jeito: "ia",
      acao: null,
    });
  });

  it("do texto livre: a palavra na forma que o Labs grava, sem acento e em maiúscula", () => {
    expect(lerPedidoAvulso(LIVRE)).toEqual({
      ok: true,
      pedido: { origem: "livre", tema: "Produtividade", palavra: "BRUTAL", acao: null, conteudo: LIVRE.conteudo, total: 4, jeito: "mao" },
    });
    const r = lerPedidoAvulso({ ...LIVRE, palavra: " Brútal " });
    expect(r.ok && r.pedido.origem === "livre" && r.pedido.palavra).toBe("BRUTAL");
  });

  it("os campos da outra origem não entram no pedido", () => {
    const r = lerPedidoAvulso({ ...DO_LABS, tema: "Vendas", palavra: "OUTRA", conteudo: "x".repeat(50) });
    expect(r.ok && r.pedido).toEqual({ origem: "labs", codigo: DO_LABS.codigo, destaque: "", total: 5, jeito: "ia", acao: null });
  });

  it("o conteúdo nos limites passa", () => {
    expect(lerPedidoAvulso({ ...LIVRE, conteudo: "x".repeat(CONTEUDO_MIN) }).ok).toBe(true);
    expect(lerPedidoAvulso({ ...LIVRE, conteudo: "x".repeat(CONTEUDO_MAX) }).ok).toBe(true);
    expect(lerPedidoAvulso({ ...DO_LABS, destaque: "x".repeat(DESTAQUE_MAX) }).ok).toBe(true);
  });

  it.each([
    ["a origem desconhecida", { ...DO_LABS, origem: "notion" }, "origem_invalida"],
    ["a origem ausente", { ...DO_LABS, origem: null }, "origem_invalida"],
    ["o jeito desconhecido", { ...DO_LABS, jeito: "copiar" }, "jeito_invalido"],
    ["0 slides", { ...DO_LABS, total: "0" }, "total_invalido"],
    ["11 slides", { ...LIVRE, total: "11" }, "total_invalido"],
    ["o total que não é número", { ...LIVRE, total: "dez" }, "total_invalido"],
    ["o Labs sem bônus escolhido", { ...DO_LABS, codigo: "  " }, "sem_bonus"],
    ["o código que não é texto", { ...DO_LABS, codigo: null }, "sem_bonus"],
    ["o código comprido demais", { ...DO_LABS, codigo: "x".repeat(201) }, "sem_bonus"],
    ["o destaque comprido", { ...DO_LABS, destaque: "x".repeat(DESTAQUE_MAX + 1) }, "destaque_longo"],
    ["o tema vazio", { ...LIVRE, tema: "   " }, "tema_vazio"],
    ["o tema comprido", { ...LIVRE, tema: "x".repeat(81) }, "tema_longo"],
    ["a palavra vazia", { ...LIVRE, palavra: "" }, "palavra_invalida"],
    ["a palavra com espaço", { ...LIVRE, palavra: "SEM DOR" }, "palavra_invalida"],
    ["a palavra curta", { ...LIVRE, palavra: "AB" }, "palavra_invalida"],
    ["o conteúdo curto", { ...LIVRE, conteudo: "x".repeat(CONTEUDO_MIN - 1) }, "conteudo_curto"],
    ["o conteúdo comprido", { ...LIVRE, conteudo: "x".repeat(CONTEUDO_MAX + 1) }, "conteudo_longo"],
  ])("recusa %s", (_nome, bruto, motivo) => {
    expect(lerPedidoAvulso(bruto)).toEqual({ ok: false, motivo });
  });

  it("cada recusa tem frase", () => {
    for (const motivo of [
      "origem_invalida",
      "jeito_invalido",
      "total_invalido",
      "sem_bonus",
      "destaque_longo",
      "tema_vazio",
      "tema_longo",
      "palavra_invalida",
      "conteudo_curto",
      "conteudo_longo",
    ] as const) {
      expect(textoDaRecusaDoPedidoAvulso(motivo), motivo).toMatch(/\.$/);
    }
    expect(textoDaRecusaDoPedidoAvulso("conteudo_curto")).toContain(String(CONTEUDO_MIN));
  });

  it("o total segue a regra do pedido de carrossel de bônus", () => {
    expect([lerTotalDeSlides(" 10 "), lerTotalDeSlides("1"), lerTotalDeSlides("0"), lerTotalDeSlides("5.5"), lerTotalDeSlides(null)]).toEqual([
      10,
      1,
      null,
      null,
      null,
    ]);
  });
});

describe("o contexto do carrossel avulso", () => {
  const BONUS = {
    codigo: "conselheiro-brutalmente-honesto",
    palavra: "BRUTAL",
    titulo: "Conselheiro brutalmente honesto",
    tema: "Produtividade",
    descricao: "Um prompt que critica o seu plano sem dó.",
  };

  it("do Labs: o título, a descrição e o tema de lá, e o destaque no lugar do que resolve", () => {
    expect(contextoDoLabs(BONUS, "Mostre o antes e o depois.")).toEqual({
      tema: "Produtividade",
      titulo: BONUS.titulo,
      descricao: BONUS.descricao,
      oQueResolve: "Mostre o antes e o depois.",
    });
  });

  it("do Labs sem destaque: a própria descrição", () => {
    expect(contextoDoLabs(BONUS, "").oQueResolve).toBe(BONUS.descricao);
  });

  it("do texto livre: o tema e o conteúdo", () => {
    expect(contextoLivre({ tema: "Produtividade", conteudo: "Um prompt." })).toEqual({ tipo: "livre", tema: "Produtividade", conteudo: "Um prompt." });
  });

  it("o título interno do escrito à mão: o do bônus do Labs, ou o tema", () => {
    expect(tituloInterno(contextoDoLabs(BONUS, ""))).toBe(BONUS.titulo);
    expect(tituloInterno(contextoLivre({ tema: "Produtividade", conteudo: "Um prompt." }))).toBe("Produtividade");
  });
});

describe("a origem na tela", () => {
  it("as três origens, com o título do Labs e o tema do livre", () => {
    expect(textoDaOrigem({ origem: "bonus", contexto: {} })).toBe("Bônus do Chat");
    expect(textoDaOrigem({ origem: "labs", contexto: { tema: "t", titulo: "Conselheiro", descricao: "d", oQueResolve: "o" } })).toBe(
      "Bônus do Labs: Conselheiro"
    );
    expect(textoDaOrigem({ origem: "livre", contexto: { tipo: "livre", tema: "Produtividade", conteudo: "c" } })).toBe(
      "Texto livre: Produtividade"
    );
  });

  it("com o contexto fora da forma, só a origem", () => {
    expect(textoDaOrigem({ origem: "labs", contexto: null })).toBe("Bônus do Labs");
    expect(textoDaOrigem({ origem: "livre", contexto: { tema: "t", titulo: "x", descricao: "d", oQueResolve: "o" } })).toBe("Texto livre");
  });
});

// SEM PALAVRA-CHAVE (spec da Etapa 8): no texto livre, a caixa "Sem palavra-chave" troca a palavra pela
// ação da chamada; no bônus do Labs, a ação vem do formulário e só vale se o bônus não tiver palavra,
// o que só o processo sabe, depois de ler o Labs.
describe("o pedido sem palavra-chave", () => {
  it("texto livre com a caixa marcada: a palavra nula e a ação", () => {
    expect(lerPedidoAvulso({ ...LIVRE, semPalavra: "1", acao: "salvar" })).toEqual({
      ok: true,
      pedido: { origem: "livre", tema: "Produtividade", palavra: null, acao: "salvar", conteudo: LIVRE.conteudo, total: 4, jeito: "mao" },
    });
  });

  it("com a caixa marcada, o que estava no campo da palavra não entra, nem inválido", () => {
    const r = lerPedidoAvulso({ ...LIVRE, palavra: "duas palavras", semPalavra: "1", acao: "seguir" });
    expect(r.ok && r.pedido.origem === "livre" && [r.pedido.palavra, r.pedido.acao]).toEqual([null, "seguir"]);
  });

  it.each([[undefined], [""], ["curtir"], ["Salvar"]])("com a caixa marcada, sem uma das quatro ações (%j), é recusado", (acao) => {
    expect(lerPedidoAvulso({ ...LIVRE, semPalavra: "1", acao })).toEqual({ ok: false, motivo: "sem_acao" });
  });

  it("sem a caixa, a palavra de hoje, e a ação do formulário não entra", () => {
    const r = lerPedidoAvulso({ ...LIVRE, acao: "salvar" });
    expect(r.ok && r.pedido.origem === "livre" && [r.pedido.palavra, r.pedido.acao]).toEqual(["BRUTAL", null]);
    expect(lerPedidoAvulso({ ...LIVRE, palavra: "" })).toEqual({ ok: false, motivo: "palavra_invalida" });
  });

  it("do Labs: a ação do formulário vai junto, e a que não é uma das quatro vira nula", () => {
    const r = lerPedidoAvulso({ ...DO_LABS, acao: "comentar" });
    expect(r.ok && r.pedido.acao).toBe("comentar");
    const outra = lerPedidoAvulso({ ...DO_LABS, acao: "curtir" });
    expect(outra.ok && outra.pedido.acao).toBeNull();
  });

  it("a recusa diz o que fazer", () => {
    expect(textoDaRecusaDoPedidoAvulso("sem_acao")).toBe("Escolha o que a chamada pede.");
  });
});
