import { describe, expect, it } from "vitest";
import { avisosDeCabimento, campoDoAviso, textoDosCampos } from "@/lib/bonus/arte-cabimento";
import {
  rotuloDaConta,
  textoDaOrigemDaConta,
  textoDaRecusaDaArte,
  textoDoBaixarTodos,
  textoNaoCabeComEspaco,
  textoNaoCabeNunca,
} from "@/lib/bonus/arte-textos";

// O "NÃO CABE" ENQUANTO SE DIGITA (spec da Etapa 3, "A prévia e o não cabe"): a mesma conta da arte
// (arte-slides.ts), feita sobre o que está nos campos AGORA, e não sobre o texto salvo. Avisa,
// nunca impede: a previsão é uma estimativa (a regra do Labs).

const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};
/** Um corpo que cabe sozinho e não cabe com a manchete e o espaço da imagem (arte-slides). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
/** Um corpo que não cabe nem sem o espaço da imagem. */
const TRINTA_LINHAS = Array(30).fill("x".repeat(17)).join("\n");

describe("o texto montado com o que está nos campos", () => {
  it("carrossel: o gancho, os slides e a chamada, sem o \\r\\n do textarea e sem as pontas em branco", () => {
    expect(textoDosCampos(3, { ...VALORES, slide_1_texto: "  linha um\r\nlinha dois  " })).toEqual({
      tipo: "carrossel",
      titulo: "",
      gancho: VALORES.gancho,
      slides: [{ titulo: VALORES.slide_1_titulo, texto: "linha um\nlinha dois" }],
      chamada: VALORES.chamada,
      legenda: VALORES.legenda,
    });
  });

  it("post: o texto e a chamada", () => {
    expect(textoDosCampos(1, { texto: "O texto do post.", chamada: VALORES.chamada, legenda: VALORES.legenda })).toEqual({
      tipo: "post",
      titulo: "",
      texto: "O texto do post.",
      chamada: VALORES.chamada,
      legenda: VALORES.legenda,
    });
  });
});

describe("o campo onde aparece o aviso de cada slide", () => {
  it.each([
    [1, 5, "gancho"],
    [2, 5, "slide_1_texto"],
    [4, 5, "slide_3_texto"],
    [5, 5, "chamada"],
    [1, 1, "texto"],
  ])("slide %i de %i: %s", (numero, total, campo) => {
    expect(campoDoAviso(numero, total)).toBe(campo);
  });
});

describe("os avisos de cabimento", () => {
  it("cala quando tudo cabe", () => {
    expect(avisosDeCabimento(3, VALORES, [])).toEqual({});
  });

  it("com o espaço da imagem, diz para marcar só texto ou encurtar", () => {
    expect(avisosDeCabimento(3, { ...VALORES, slide_1_texto: OITO_LINHAS }, [])).toEqual({
      slide_1_texto: textoNaoCabeComEspaco(2),
    });
  });

  it("marcado só texto, o mesmo slide cabe, e o aviso cala", () => {
    expect(avisosDeCabimento(3, { ...VALORES, slide_1_texto: OITO_LINHAS }, [2])).toEqual({});
  });

  it("o que não cabe nem sem o espaço diz para encurtar, nos dois modos", () => {
    const valores = { ...VALORES, slide_1_texto: TRINTA_LINHAS };
    expect(avisosDeCabimento(3, valores, [])).toEqual({ slide_1_texto: textoNaoCabeNunca(2) });
    expect(avisosDeCabimento(3, valores, [2])).toEqual({ slide_1_texto: textoNaoCabeNunca(2) });
  });

  it("no post, o aviso vai no texto", () => {
    expect(avisosDeCabimento(1, { texto: TRINTA_LINHAS, chamada: VALORES.chamada, legenda: VALORES.legenda }, [])).toEqual({
      texto: textoNaoCabeNunca(1),
    });
  });
});

describe("as frases da tela da arte", () => {
  it("o não cabe diz o slide e o que fazer", () => {
    expect(textoNaoCabeComEspaco(2)).toBe('O slide 2 não cabe com o espaço da imagem. Marque "só texto" nele, ou encurte.');
    expect(textoNaoCabeNunca(2)).toBe("O slide 2 não cabe nem sem o espaço da imagem. Encurte o texto.");
  });

  it("a conta diz de onde veio, e cala quando é a gravada", () => {
    expect(textoDaOrigemDaConta("gravada", "thiagovannuchi")).toBeNull();
    expect(textoDaOrigemDaConta("selecionada", "thiagovannuchi")).toBe(
      "A arte usa a conta selecionada no Chat agora (@thiagovannuchi). Escolha uma conta acima para gravar neste carrossel."
    );
    expect(textoDaOrigemDaConta("gravada_saiu", "thiagovannuchi")).toBe(
      "A conta gravada neste carrossel foi desconectada do Chat. A arte usa a selecionada agora (@thiagovannuchi)."
    );
  });

  it("o rótulo da conta no seletor tem o nome e o @", () => {
    expect(rotuloDaConta({ ig_user_id: "1", username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: null })).toBe(
      "Thiago Vannuchi (@thiagovannuchi)"
    );
    expect(rotuloDaConta({ ig_user_id: "1", username: "thiagovannuchi", name: null, profile_picture_url: null })).toBe(
      "@thiagovannuchi"
    );
  });

  it("o baixar todos avisa a permissão do navegador antes", () => {
    expect(textoDoBaixarTodos(10)).toBe(
      "O navegador pode pedir permissão para baixar vários arquivos de uma vez. Aceite para receber os 10 slides."
    );
  });

  it("cada recusa do salvar da arte tem frase", () => {
    expect(textoDaRecusaDaArte("conta")).toContain("não está conectada");
    expect(textoDaRecusaDaArte("slide")).toContain("não existe");
  });
});
