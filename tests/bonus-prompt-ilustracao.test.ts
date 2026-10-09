import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ATALHOS,
  ESTILOS,
  ESTILO_PADRAO,
  FUNDO,
  MAX_DESCRICAO,
  MAX_TEXTO_ENTRE_ASPAS,
  MIN_DESCRICAO,
  PROIBICAO_DE_PESSOA_REAL,
  PROIBICAO_DE_TEXTO,
  comEstilo,
  lerDescricao,
  montarPrompt,
  pedeTextoNaImagem,
  separarEstiloDaDescricao,
  textoExato,
  trechosEntreAspas,
  validarDescricao,
} from "@/lib/bonus/prompt-ilustracao";

// AS REGRAS DA IMAGEM DO CHAT (spec da Etapa 6, adendo de 09/10). Até o adendo, este arquivo era a cópia
// do teste do Labs; com as regras próprias, os casos são do Chat. Os do aviso de texto (`pedeTextoNaImagem`)
// vêm do Labs, porque a lista de termos é a de lá.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const SPEC = readFileSync(`${RAIZ}/docs/specs/2026-10-09-criador-de-imagem.md`, "utf8").replace(/\r\n/g, "\n");

/** A cerca dos blocos de código, escrita assim para este arquivo caber num bloco do plano. */
const CERCA = "`".repeat(3);

/** O bloco de código logo depois de um rótulo do apêndice "Os pedidos da medição". */
function doApendice(rotulo: string): string {
  const i = SPEC.indexOf(rotulo, SPEC.indexOf("## Apêndice: os pedidos da medição"));
  if (i < 0) throw new Error(`${rotulo} não está no apêndice da spec`);
  const abre = `${CERCA}text\n`;
  const a = SPEC.indexOf(abre, i) + abre.length;
  return SPEC.slice(a, SPEC.indexOf(`\n${CERCA}`, a));
}

const estilo = (chave: string) => ESTILOS.find((e) => e.chave === chave)!;
const atalho = (chave: string) => ATALHOS.find((a) => a.chave === chave)!;

describe("o que foi medido é o que vai ao ar", () => {
  // ⚠️ O PEDIDO DA MEDIÇÃO DOS MODELOS (09/10) SAIU DESTAS REGRAS, e o Eduardo escolheu o modelo olhando
  // as imagens dele. Se o montarPrompt mudar uma letra, o que vai à OpenAI deixa de ser o medido.
  it.each([
    ["A", "**A descrição A**", "**O pedido A**"],
    ["B", "**A descrição B**", "**O pedido B**"],
  ])("o pedido %s do apêndice da spec sai byte a byte", (_, descricao, pedido) => {
    expect(montarPrompt(doApendice(descricao))).toBe(doApendice(pedido));
  });
});

describe("montarPrompt", () => {
  it("a ordem: estilo, atalho, cena, fundo, pessoa real e, por último, o texto", () => {
    const p = montarPrompt('/ilustracao /passo três etapas de um atendimento, com o post-it "FIM"');
    const posicoes = [
      p.indexOf(estilo("ilustracao").texto),
      p.indexOf(atalho("passo").texto),
      p.indexOf("três etapas de um atendimento"),
      p.indexOf(FUNDO),
      p.indexOf(PROIBICAO_DE_PESSOA_REAL),
      p.indexOf("Escreva na imagem exatamente"),
    ];
    expect(posicoes.every((x) => x >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it("sem estilo na descrição, vale o /cinema", () => {
    expect(ESTILO_PADRAO).toBe("cinema");
    expect(montarPrompt("uma reunião de equipe ao fim da tarde").startsWith(estilo("cinema").texto)).toBe(true);
  });

  it.each(["cinema", "ilustracao", "comercial"])("o estilo /%s entra com o seu trecho, no começo", (chave) => {
    const p = montarPrompt(`/${chave} uma reunião de equipe ao fim da tarde`);
    expect(p.startsWith(estilo(chave).texto)).toBe(true);
    for (const outro of ESTILOS.filter((e) => e.chave !== chave)) expect(p).not.toContain(outro.texto);
  });

  it("sem aspas, a proibição de texto do Labs é a última coisa", () => {
    const p = montarPrompt("/cinema uma lousa numa sala de reunião vazia");
    expect(p.endsWith(PROIBICAO_DE_TEXTO)).toBe(true);
    expect(p).not.toContain("Escreva na imagem");
  });

  it("com aspas retas ou curvas, pede exatamente aqueles trechos, por último, com aspas retas", () => {
    const p = montarPrompt("/cinema um quadro com “AÇÕES” e um post-it \"META\" na parede");
    expect(p.endsWith(textoExato(["AÇÕES", "META"]))).toBe(true);
    expect(p).toContain('entre aspas: "AÇÕES"; "META". Cada um aparece uma vez');
    expect(p).not.toContain(PROIBICAO_DE_TEXTO);
  });

  it("o nome de marca entre aspas sai em letra simples, sem logo", () => {
    expect(textoExato(["ChatGPT"])).toContain(
      "Se um deles for o nome de uma marca ou de um produto, escreva-o em letras simples e comuns, sem o logotipo"
    );
    expect(textoExato(["ChatGPT"]).endsWith("Nenhum outro texto, letra, número ou logotipo em nenhuma parte da imagem.")).toBe(true);
  });

  it("a pessoa real e o fundo entram sempre, com aspas e sem aspas", () => {
    for (const d of ["/comercial uma vitrine à noite", '/comercial uma vitrine à noite com a placa "ABERTO"']) {
      expect(montarPrompt(d)).toContain(PROIBICAO_DE_PESSOA_REAL);
      expect(montarPrompt(d)).toContain(FUNDO);
    }
  });

  it("fecha a cena com ponto, sem duplicar, e junta os espaços", () => {
    expect(montarPrompt("uma mesa   de\n trabalho")).toContain(" uma mesa de trabalho. ");
    expect(montarPrompt("uma mesa de trabalho!")).toContain(" uma mesa de trabalho! ");
  });
});

describe("as regras que ficaram do Labs, sem mudar uma letra", () => {
  it("a proibição de texto", () => {
    expect(PROIBICAO_DE_TEXTO).toBe(
      "Toda superfície que poderia conter escrita — lousa, quadro branco, flip chart, projetor, " +
        "tela, cartaz, placa, papel — aparece EM BRANCO, ou apenas com linhas, barras e setas " +
        "desenhadas à mão, sem rótulo. Sem nenhum texto, sem letras, sem palavras, sem números e " +
        "sem logotipos em nenhuma parte da imagem."
    );
  });

  it("os atalhos do Labs, menos o /grafico", () => {
    expect(ATALHOS.map((a) => a.chave)).toEqual(["showcase", "marketing", "grafico", "passo", "antes-depois"]);
    expect(atalho("showcase").texto).toBe(
      "Composição de vitrine: o objeto principal centralizado e em destaque, visto de leve " +
        "perspectiva, com bastante ar em volta e nenhum elemento competindo com ele."
    );
    expect(atalho("marketing").texto).toBe(
      "Composição de campanha: uma pessoa em ação junto do objeto principal, gestos claros e " +
        "legíveis em miniatura, sugerindo uso e movimento."
    );
    expect(atalho("passo").texto).toBe(
      "Composição de fluxo: três ou quatro elementos na horizontal, ligados por setas " +
        "simples, lidos da esquerda para a direita como etapas de um processo."
    );
  });

  it("o /grafico aceita só os números e rótulos que estiverem entre aspas", () => {
    expect(atalho("grafico").texto).toBe(
      "Composição de dado: barras, setas ou blocos de tamanhos diferentes representando " +
        "comparação ou crescimento, sem eixos nem escala; números e rótulos, só os que estiverem " +
        "entre aspas na descrição."
    );
  });
});

describe("lerDescricao", () => {
  it("lê um estilo e um atalho no começo, em qualquer ordem e em maiúscula", () => {
    for (const d of ["/cinema /grafico três barras", "/GRAFICO /Cinema três barras"]) {
      const l = lerDescricao(d);
      expect([l.estilo.chave, l.atalho?.chave, l.cena, l.desconhecido, l.repetido]).toEqual(["cinema", "grafico", "três barras", null, null]);
    }
  });

  it("sem barra, a descrição inteira é a cena, com o estilo padrão", () => {
    const l = lerDescricao("  uma loja /cinema no meio  ");
    expect([l.estilo.chave, l.atalho, l.cena]).toEqual(["cinema", null, "uma loja /cinema no meio"]);
  });

  it("o que não existe e o que se repete ficam marcados", () => {
    expect(lerDescricao("/showkase uma caixa").desconhecido).toBe("showkase");
    expect(lerDescricao("/cinema /comercial uma loja").repetido).toBe("estilo");
    expect(lerDescricao("/passo /grafico uma tabela").repetido).toBe("atalho");
  });
});

describe("o estilo no começo da descrição, para a tela", () => {
  // A tela guarda o estilo como o primeiro atalho da descrição: o "Gerar de novo" o lê de volta, e a
  // tabela 018 não precisa de coluna nova.
  it("comEstilo põe o estilo na frente da descrição", () => {
    expect(comEstilo("ilustracao", "  /antes-depois dois cérebros  ")).toBe("/ilustracao /antes-depois dois cérebros");
  });

  it("separarEstiloDaDescricao devolve o estilo e o resto, com o atalho ainda nele", () => {
    expect(separarEstiloDaDescricao("/comercial /showcase uma vitrine")).toEqual({ estilo: "comercial", resto: "/showcase uma vitrine" });
    expect(separarEstiloDaDescricao("/CINEMA")).toEqual({ estilo: "cinema", resto: "" });
  });

  it("sem estilo no começo, o padrão e a descrição inteira", () => {
    expect(separarEstiloDaDescricao("/marketing uma pessoa na loja")).toEqual({ estilo: "cinema", resto: "/marketing uma pessoa na loja" });
    expect(separarEstiloDaDescricao("uma pessoa na loja")).toEqual({ estilo: "cinema", resto: "uma pessoa na loja" });
  });
});

describe("trechosEntreAspas", () => {
  it("lê aspas retas e curvas, na ordem, e ignora o vazio", () => {
    expect(trechosEntreAspas('um "A", um “B” e um ""')).toEqual({ trechos: ["A", "B"], semPar: false });
  });

  it("acusa a aspa sem par", () => {
    expect(trechosEntreAspas('um "A').semPar).toBe(true);
    expect(trechosEntreAspas("um A” solto").semPar).toBe(true);
    expect(trechosEntreAspas("um “A “B”").semPar).toBe(true);
  });
});

describe("validarDescricao", () => {
  const ok = { ok: true };

  it("recusa a cena vazia e a curta, contadas sem os atalhos e sem o texto entre aspas", () => {
    expect(validarDescricao("/cinema /grafico")).toEqual({ ok: false, mensagem: "Descreva o que a imagem deve mostrar." });
    expect(validarDescricao('/cinema "UM TEXTO BEM LONGO AQUI" ok').ok).toBe(false);
    expect(validarDescricao(`/cinema ${"x".repeat(MIN_DESCRICAO - 1)}`).ok).toBe(false);
    expect(validarDescricao(`/cinema ${"x".repeat(MIN_DESCRICAO)}`)).toEqual(ok);
  });

  it("recusa a descrição inteira acima do máximo e aceita exatamente nele", () => {
    expect(validarDescricao("x".repeat(MAX_DESCRICAO + 1)).ok).toBe(false);
    expect(validarDescricao("x".repeat(MAX_DESCRICAO))).toEqual(ok);
  });

  it("recusa o texto entre aspas acima de 120 e aceita exatamente nele", () => {
    const cena = "uma parede de escritório com um quadro";
    expect(validarDescricao(`${cena} "${"A".repeat(MAX_TEXTO_ENTRE_ASPAS + 1)}"`).ok).toBe(false);
    expect(validarDescricao(`${cena} "${"A".repeat(60)}" e "${"B".repeat(60)}"`)).toEqual(ok);
    expect(validarDescricao(`${cena} "${"A".repeat(61)}" e "${"B".repeat(60)}"`).ok).toBe(false);
  });

  it("recusa a aspa sem par, com a frase dela", () => {
    expect(validarDescricao('uma parede de escritório com "VENDAS')).toEqual({
      ok: false,
      mensagem: "Feche as aspas do texto que deve aparecer na imagem.",
    });
  });

  it("recusa o atalho que não existe, com os estilos e os atalhos que existem", () => {
    const r = validarDescricao("/showkase uma caixa em destaque na mesa");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.mensagem).toBe(
      "Não existe o atalho /showkase. Os estilos: /cinema, /ilustracao, /comercial. " +
        "Os atalhos: /showcase, /marketing, /grafico, /passo, /antes-depois."
    );
  });

  it("recusa dois estilos e dois atalhos", () => {
    expect(validarDescricao("/cinema /comercial uma loja iluminada à noite")).toEqual({ ok: false, mensagem: "Escolha um estilo só para a imagem." });
    expect(validarDescricao("/passo /grafico uma tabela de vendas")).toEqual({ ok: false, mensagem: "Use um atalho de composição só." });
  });
});

describe("pedeTextoNaImagem (a lista de termos do Labs)", () => {
  it("reconhece a descrição REAL que produziu a imagem torta no Labs", () => {
    const real =
      "Uma reunião de marketing discutindo sobre a queda da vendas organicas, uma pessoa triste por isso \n" +
      "na lousa/ projetor (uma dessas opções, estar escrito, Analise queda ORGANICA)";
    expect(pedeTextoNaImagem(real)).toBe("escrito");
  });

  it("NÃO dispara em escritório, que contém 'escrito'", () => {
    expect(pedeTextoNaImagem("uma reuniao num escritorio com quatro pessoas")).toBeNull();
    expect(pedeTextoNaImagem("uma reunião num escritório com quatro pessoas")).toBeNull();
  });

  it("mede a cena, e não os atalhos", () => {
    expect(pedeTextoNaImagem("/cinema /grafico tres barras subindo lado a lado")).toBeNull();
  });

  it("dispara em todos os termos da lista, um a um", () => {
    for (const t of ["escrito", "escreva", "texto", "letras", "palavra", "frase", "placa", "legenda"]) {
      expect(pedeTextoNaImagem(`uma cena com ${t} no meio`), `${t} deveria disparar`).not.toBeNull();
    }
  });
});
