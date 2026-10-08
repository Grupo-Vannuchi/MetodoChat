import { describe, expect, it } from "vitest";
import {
  contextoGravado,
  mensagemDoCarrossel,
  parametrosDoCarrossel,
  parametrosDoPost,
  pedidoExtra,
  type PedidoParaIA,
} from "@/lib/bonus/carrossel-ia-parametros";
import { BETA_DO_FALLBACK, MODELO, parametrosDaGeracao } from "@/lib/bonus/ia-parametros";
import { INSTRUCAO_CARROSSEL } from "@/lib/bonus/instrucao-carrossel";
import { INSTRUCAO_POST } from "@/lib/bonus/instrucao-post";

const CONTEXTO = {
  tema: "Vendas",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
  oQueResolve: "Reativar clientes que pararam de comprar pelo WhatsApp.",
};
const PEDIDO: PedidoParaIA = { total: 10, palavra: "SUMIDO", contexto: CONTEXTO };

describe("a mensagem do carrossel", () => {
  it("segue o formato do Labs e leva o contexto do bônus", () => {
    const m = mensagemDoCarrossel(PEDIDO);
    expect(m.startsWith("Tema: Vendas\n\nO que deve resolver:\nReativar clientes")).toBe(true);
    expect(m).toContain(`O bônus que este post divulga: "${CONTEXTO.titulo}". ${CONTEXTO.descricao}`);
    expect(m.endsWith(pedidoExtra(10, "SUMIDO"))).toBe(true);
  });

  it("o total vira slides de conteúdo e substitui a faixa da instrução", () => {
    const e = pedidoExtra(10, "SUMIDO");
    expect(e).toContain("10 slides no total");
    expect(e).toContain("8 slides de conteúdo");
    expect(e).toContain("substitui a faixa de 6 a 9");
  });

  it("com 2 slides, nenhum de conteúdo", () => {
    expect(pedidoExtra(2, "SUMIDO")).toContain("nenhum slide de conteúdo");
  });

  it("a palavra vai exatamente como no Labs, e só ela", () => {
    for (const total of [1, 2, 10]) {
      const e = pedidoExtra(total, "SUMIDO");
      expect(e, String(total)).toContain("palavra SUMIDO");
      expect(e, String(total)).toContain("nenhuma outra palavra vai toda em maiúsculas");
    }
  });

  it("o post de 1 imagem pede a chamada, diz o teto do texto e não fala em slides", () => {
    // A instrução do post fala em "~350" caracteres, e o formato corta em 300 (achado 47 do auditor).
    const e = pedidoExtra(1, "SUMIDO");
    expect(e).toContain("chamadaParaAcao");
    expect(e).toContain("no máximo 300 caracteres");
    expect(e).not.toContain("slides");
  });
});

// O TEXTO LIVRE (Etapa 7): o carrossel avulso sem bônus. A mensagem leva o tema e o conteúdo, e não
// fala de um bônus nem do que ele resolve, que não existem.
describe("a mensagem do carrossel do texto livre", () => {
  const LIVRE = { tipo: "livre" as const, tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó." };

  it("leva o tema e o conteúdo, e o mesmo pedido extra", () => {
    const m = mensagemDoCarrossel({ total: 4, palavra: "BRUTAL", contexto: LIVRE });
    expect(m).toBe(`Tema: Produtividade\n\nO conteúdo que este post divulga:\n${LIVRE.conteudo}\n\n${pedidoExtra(4, "BRUTAL")}`);
  });

  it("não fala de bônus nem do que deve resolver", () => {
    const m = mensagemDoCarrossel({ total: 1, palavra: "BRUTAL", contexto: LIVRE });
    expect(m).not.toContain("O bônus que");
    expect(m).not.toContain("O que deve resolver");
  });
});

describe("os parâmetros da chamada", () => {
  it("de 2 a 10: a instrução do carrossel, intacta, com a política do bônus", () => {
    const p = parametrosDoCarrossel(PEDIDO);
    const b = parametrosDaGeracao({ tema: "x", oQueResolve: "y", palavraDigitada: null });
    expect(p.system).toBe(INSTRUCAO_CARROSSEL);
    expect([p.model, p.max_tokens, p.betas, p.fallbacks, p.output_config.effort]).toEqual([
      b.model,
      b.max_tokens,
      b.betas,
      b.fallbacks,
      b.output_config.effort,
    ]);
    expect(p.messages).toEqual([{ role: "user", content: mensagemDoCarrossel(PEDIDO) }]);
  });

  it("1: a instrução do post", () => {
    expect(parametrosDoPost({ ...PEDIDO, total: 1 }).system).toBe(INSTRUCAO_POST);
  });

  it("a palavra não entra na instrução: o que muda a cada pedido vai na mensagem", () => {
    expect(parametrosDoCarrossel(PEDIDO).system).not.toContain("SUMIDO");
    expect(JSON.stringify(parametrosDoCarrossel(PEDIDO).messages)).toContain("SUMIDO");
  });

  it("sem cache_control, e o modelo do bônus", () => {
    const p = parametrosDoCarrossel(PEDIDO);
    expect(JSON.stringify(p)).not.toContain("cache_control");
    expect(p.model).toBe(MODELO);
    expect(p.betas).toEqual([BETA_DO_FALLBACK]);
  });
});

describe("o contexto gravado na linha", () => {
  it("aceita o que a action grava", () => {
    expect(contextoGravado(CONTEXTO)).toEqual(CONTEXTO);
  });

  // As linhas de antes da Etapa 7 não têm `tipo`, e continuam valendo como estão.
  it("aceita o texto livre do avulso, e devolve só os campos dele", () => {
    const livre = { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt que critica o seu plano." };
    expect(contextoGravado(livre)).toEqual(livre);
    expect(contextoGravado({ ...livre, oQueResolve: "a mais" })).toEqual(livre);
  });

  it.each([
    null,
    {},
    { ...CONTEXTO, tema: 1 },
    "x",
    { tipo: "livre", tema: "Produtividade" },
    { tipo: "livre", conteudo: "sem tema" },
    { ...CONTEXTO, tipo: "outro" },
  ])("recusa o que não tem a forma: %j", (v) => {
    expect(contextoGravado(v)).toBeNull();
  });
});

// SEM PALAVRA-CHAVE (spec da Etapa 8, "O pedido à IA"): a instrução do Labs não muda, e o pedido extra
// do Chat pede a ação escolhida no lugar da palavra, e manda não pedir palavra nenhuma.
describe("o pedido sem palavra-chave", () => {
  const LIVRE = { tipo: "livre" as const, tema: "Vendas", conteudo: "Como vender sem parecer chato, em cinco passos." };

  it.each([1, 2, 10])("pede a ação e proíbe a palavra (%i slide(s))", (total) => {
    const e = pedidoExtra(total, { acao: "salvar" });
    expect(e).toContain("Na chamada para ação, peça para salvar o post.");
    expect(e).toContain("Este post não tem palavra-chave: não peça para comentar uma palavra.");
    expect(e).toContain("Na chamada, nenhuma palavra vai toda em maiúsculas, fora VENCE do bordão.");
    expect(e).toContain("Termine a legenda no mesmo pedido.");
    expect(e).not.toMatch(/comentar a palavra [A-Z]/);
  });

  it("cada ação vai com a frase dela", () => {
    expect(pedidoExtra(4, { acao: "compartilhar" })).toContain("peça para compartilhar o post com quem precisa ver.");
    expect(pedidoExtra(4, { acao: "seguir" })).toContain("peça para seguir o perfil.");
    expect(pedidoExtra(4, { acao: "comentar" })).toContain("peça para comentar a opinião, sem palavra-chave.");
  });

  it("o total e o teto do post continuam os de hoje", () => {
    expect(pedidoExtra(10, { acao: "salvar" })).toContain("8 slides de conteúdo");
    expect(pedidoExtra(1, { acao: "salvar" })).toContain("no máximo 300 caracteres");
  });

  it("a mensagem leva o pedido da ação, no texto livre e no bônus do Labs", () => {
    const livre: PedidoParaIA = { total: 4, palavra: null, acao: "seguir", contexto: LIVRE };
    expect(mensagemDoCarrossel(livre).endsWith(pedidoExtra(4, { acao: "seguir" }))).toBe(true);
    const labs: PedidoParaIA = { total: 1, palavra: null, acao: "comentar", contexto: CONTEXTO };
    expect(mensagemDoCarrossel(labs).endsWith(pedidoExtra(1, { acao: "comentar" }))).toBe(true);
  });

  it("a instrução do sistema é a mesma, com ou sem palavra", () => {
    const sem: PedidoParaIA = { total: 4, palavra: null, acao: "salvar", contexto: LIVRE };
    expect(parametrosDoCarrossel(sem).system).toBe(INSTRUCAO_CARROSSEL);
    expect(parametrosDoPost({ ...sem, total: 1 }).system).toBe(INSTRUCAO_POST);
  });
});
