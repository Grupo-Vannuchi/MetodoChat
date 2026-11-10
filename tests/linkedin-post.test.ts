import { describe, expect, it } from "vitest";
import {
  corpoDoPost,
  desfechoDoErroDoLinkedin,
  formaNoLinkedinDoCampo,
  LIMITE_DO_TEXTO_DO_LINKEDIN,
  lerPayloadDoLinkedin,
  linkParaVerNoLinkedin,
  motivoDaAutorizacaoRecusada,
  oPostPodeTerSaido,
  payloadDoLinkedin,
  problemaDoTextoDoLinkedin,
  rotuloDaFormaNoLinkedin,
  tamanhoDoTextoNoLinkedin,
  textoParaOLinkedin,
} from "@/lib/linkedin-publicacao";

// AS REGRAS PURAS DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5; a parte 2a: só texto e
// imagem, uma rede por post). A tela de publicar e o servidor leem as mesmas funções.

describe("as formas do LinkedIn na 2a", () => {
  it("são só texto e imagem; o resto, inclusive o que é do Instagram, não vale", () => {
    expect(formaNoLinkedinDoCampo("texto")).toBe("texto");
    expect(formaNoLinkedinDoCampo("imagem")).toBe("imagem");
    for (const outra of ["carrossel", "reels", "story", "", null, undefined, ["texto"]]) {
      expect(formaNoLinkedinDoCampo(outra)).toBeNull();
    }
    expect(rotuloDaFormaNoLinkedin("texto")).toBe("Só texto");
    expect(rotuloDaFormaNoLinkedin("imagem")).toBe("Imagem");
  });
});

describe("o texto que vai ao LinkedIn", () => {
  it("escapa com a barra os 15 caracteres reservados do little text", () => {
    expect(textoParaOLinkedin("a|b{c}d@e[f]g(h)i<j>k\\l*m_n~o")).toBe(
      "a\\|b\\{c\\}d\\@e\\[f\\]g\\(h\\)i\\<j\\>k\\\\l\\*m\\_n\\~o"
    );
  });

  it("transforma o #palavra em hashtag clicável, inteira, com acento", () => {
    expect(textoParaOLinkedin("#educação e #ação")).toBe("{hashtag|\\#|educação} e {hashtag|\\#|ação}");
    expect(textoParaOLinkedin("#marketing_2026")).toBe("{hashtag|\\#|marketing\\_2026}");
  });

  it("o # sem palavra, ou no meio de uma palavra, continua texto", () => {
    expect(textoParaOLinkedin("eu uso C# no trabalho")).toBe("eu uso C\\# no trabalho");
    expect(textoParaOLinkedin("um # sozinho")).toBe("um \\# sozinho");
    expect(textoParaOLinkedin("abc#def")).toBe("abc\\#def");
  });

  it("a pontuação logo depois da hashtag fica de fora dela", () => {
    expect(textoParaOLinkedin("fim com #tag.")).toBe("fim com {hashtag|\\#|tag}.");
    expect(textoParaOLinkedin("#um, #dois!")).toBe("{hashtag|\\#|um}, {hashtag|\\#|dois}!");
  });

  it("o texto comum e as quebras de linha passam como vieram", () => {
    expect(textoParaOLinkedin("Olá, mundo.\nSegunda linha.")).toBe("Olá, mundo.\nSegunda linha.");
  });
});

describe("o tamanho e os problemas do texto", () => {
  it("o limite é 3.000, contado no texto que vai ao LinkedIn (depois das hashtags e dos escapes)", () => {
    expect(LIMITE_DO_TEXTO_DO_LINKEDIN).toBe(3000);
    expect(tamanhoDoTextoNoLinkedin("abc")).toBe(3);
    expect(tamanhoDoTextoNoLinkedin("#tag")).toBe("{hashtag|\\#|tag}".length);
    expect(tamanhoDoTextoNoLinkedin("a_b")).toBe(4);
    // Conta caractere, e não pedaço de UTF-16.
    expect(tamanhoDoTextoNoLinkedin("😀😀")).toBe(2);
  });

  it("recusa o texto vazio, nas duas formas, e o longo demais", () => {
    expect(problemaDoTextoDoLinkedin("", "texto")).toBe("vazio");
    expect(problemaDoTextoDoLinkedin("   \n ", "imagem")).toBe("vazio");
    expect(problemaDoTextoDoLinkedin("a".repeat(3000), "texto")).toBeNull();
    expect(problemaDoTextoDoLinkedin("a".repeat(3001), "texto")).toBe("longo");
    // 2.990 letras, um espaço e um # sozinho fazem 2.993 caracteres no LinkedIn (o # ganha a barra): ainda cabe.
    expect(problemaDoTextoDoLinkedin(`${"a".repeat(2990)} #`, "texto")).toBeNull();
    // 2.951 caracteres na tela, mas 3.071 no LinkedIn: as 10 hashtags viram o modelo clicável, e não cabe.
    expect(problemaDoTextoDoLinkedin(`${"a".repeat(2900)} ${"#tag ".repeat(10)}`, "texto")).toBe("longo");
  });
});

describe("o erro do LinkedIn", () => {
  it("o 401 é a autorização que não vale mais; o 403 e os outros 4xx são permanentes", () => {
    expect(desfechoDoErroDoLinkedin(401)).toBe("autorizacao");
    for (const s of [400, 403, 404, 413, 422]) expect(desfechoDoErroDoLinkedin(s)).toBe("permanente");
  });

  it("o 429, o 409, os 5xx e a rede (0) são passageiros", () => {
    for (const s of [0, 409, 429, 500, 502, 503, 504]) expect(desfechoDoErroDoLinkedin(s)).toBe("passageiro");
  });

  it("a frase da autorização recusada diz as duas causas e o que fazer", () => {
    expect(motivoDaAutorizacaoRecusada("Dra. Ana")).toBe(
      "o LinkedIn de Dra. Ana não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo"
    );
  });

  // O ACHADO 210: o POST /rest/posts não tem chave contra repetição. Só uma resposta 4xx prova que o post não foi
  // criado; a rede (0), o 5xx e o 2xx sem o id deixam a dúvida, e a linha não pode ser tentada de novo.
  it("depois do POST, só o 4xx prova que o post não saiu; a rede, o 5xx e o 2xx sem id deixam a dúvida", () => {
    for (const s of [0, 200, 201, 500, 502, 503, 504]) expect(oPostPodeTerSaido(s), String(s)).toBe(true);
    for (const s of [400, 401, 403, 404, 409, 422, 429]) expect(oPostPodeTerSaido(s), String(s)).toBe(false);
  });
});

describe("o payload da linha do LinkedIn na fila", () => {
  it("grava a forma, os caminhos e o texto, e lê de volta com as marcas dos passos", () => {
    const p = payloadDoLinkedin({ forma: "imagem", caminhos: ["conta/a.jpg"], texto: "  Olá  " });
    expect(p).toEqual({ forma: "imagem", caminhos: ["conta/a.jpg"], texto: "Olá" });
    expect(
      lerPayloadDoLinkedin({ ...p, imagem_urn: "urn:li:image:X", post_tentado_em: "2026-11-09T19:00:00Z", post_urn: "urn:li:share:1" })
    ).toEqual({
      forma: "imagem",
      caminhos: ["conta/a.jpg"],
      texto: "Olá",
      imagemUrn: "urn:li:image:X",
      postTentadoEm: "2026-11-09T19:00:00Z",
      postUrn: "urn:li:share:1",
    });
  });

  it("recusa a forma desconhecida, o texto com arquivo e a imagem sem arquivo, ou com dois", () => {
    expect(lerPayloadDoLinkedin({ forma: "reels", caminhos: ["a/b.mp4"], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: ["a/b.jpg"], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: [], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: ["a/b.jpg", "a/c.jpg"], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: [], texto: 3 })).toBeNull();
    expect(lerPayloadDoLinkedin(null)).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: [], texto: "x" })).toMatchObject({
      imagemUrn: null,
      postTentadoEm: null,
      postUrn: null,
    });
  });
});

describe("o corpo do POST /rest/posts", () => {
  const BASE = {
    author: "urn:li:person:abc",
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  it("só texto: o autor é a pessoa, o texto já transformado, público, no feed, sem conteúdo", () => {
    expect(corpoDoPost({ pessoaId: "abc", texto: "Olá #mundo" })).toEqual({
      ...BASE,
      commentary: "Olá {hashtag|\\#|mundo}",
    });
  });

  it("com imagem: o conteúdo leva a imagem reservada", () => {
    expect(corpoDoPost({ pessoaId: "abc", texto: "x", imagemUrn: "urn:li:image:Y" })).toEqual({
      ...BASE,
      commentary: "x",
      content: { media: { id: "urn:li:image:Y" } },
    });
  });
});

describe("o link para ver o post no LinkedIn", () => {
  it("só para um URN de post, no endereço do feed", () => {
    expect(linkParaVerNoLinkedin("urn:li:share:6844785523593134080")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:6844785523593134080/"
    );
    expect(linkParaVerNoLinkedin("urn:li:ugcPost:68447855235931240")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:68447855235931240/"
    );
    for (const outro of [null, "", "urn:li:image:X", "javascript:alert(1)", "urn:li:share:1/../x"]) {
      expect(linkParaVerNoLinkedin(outro)).toBeNull();
    }
  });
});
