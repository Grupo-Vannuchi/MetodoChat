import { describe, expect, it } from "vitest";
import {
  avisoDePalavraTrocada,
  textoDaFaltaDaPalavra,
  textoDeOutrasPalavras,
  quadroDaSituacao,
  textoDaConferencia,
  textoDaRecusaDoPedidoDeCarrossel,
  textoDosProblemasDoCarrossel,
  textoDoTetoDoCarrossel,
  urlDoCarrosselComAviso,
} from "@/lib/bonus/carrossel-textos";
import type { SituacaoNoLabs } from "@/lib/bonus/publicado";

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("as frases do carrossel", () => {
  it("a URL de volta leva texto E tom", () => {
    expect(urlDoCarrosselComAviso(BONUS, CARROSSEL, { tom: "ok", texto: "salvo & pronto" })).toBe(
      `/bonus/${BONUS}/carrossel/${CARROSSEL}?aviso=salvo%20%26%20pronto&tom=ok`
    );
  });

  it("cada situação no Labs tem frase, e só a publicada é verde e diz a palavra", () => {
    const situacoes: SituacaoNoLabs[] = [
      { tipo: "publicado", bonus: { palavra: "SUMIDO", titulo: "t", descricao: "d", tema: "Vendas" } },
      { tipo: "nao_publicado" },
      { tipo: "sem_palavra" },
      { tipo: "sem_tema" },
      { tipo: "palavra_fora_do_padrao", palavra: "SEM DOR" },
      { tipo: "sem_resposta" },
      { tipo: "formato_estranho" },
      { tipo: "sem_config" },
    ];
    for (const s of situacoes) {
      const q = quadroDaSituacao(s);
      expect(q.texto.length, s.tipo).toBeGreaterThan(10);
      expect(q.tom === "ok", s.tipo).toBe(s.tipo === "publicado");
    }
    expect(quadroDaSituacao(situacoes[0]).texto).toContain("SUMIDO");
  });

  // ACHADOS 57 E 58: o Labs respondeu no formato do contrato, e quem resolve é o operador, no
  // /admin do Labs. A frase diz ONDE agir, e não "avise quem cuida do Labs".
  it("o bônus sem palavra, sem tema ou com palavra fora do padrão diz o que fazer no /admin do Labs", () => {
    expect(quadroDaSituacao({ tipo: "sem_palavra" })).toEqual({
      tom: "atencao",
      texto: "Este bônus está publicado no Labs sem palavra-chave. Cadastre uma no /admin do Labs para gerar carrossel.",
    });
    expect(quadroDaSituacao({ tipo: "sem_tema" })).toEqual({
      tom: "atencao",
      texto: "Este bônus está publicado no Labs sem tema. Cadastre um no /admin do Labs para gerar carrossel.",
    });
    expect(quadroDaSituacao({ tipo: "palavra_fora_do_padrao", palavra: "SEM DOR" })).toEqual({
      tom: "atencao",
      texto:
        "A palavra-chave deste bônus no Labs é SEM DOR, e o Chat só aceita letras e números, sem espaço, de 3 a 30. Troque no /admin do Labs para gerar carrossel.",
    });
  });

  it("cada falha da conferência diz o que fazer", () => {
    expect(textoDaConferencia({ motivo: "slides", vieram: 7, esperados: 8 }, "SUMIDO")).toContain(
      "Vieram 7 slides de conteúdo, e o pedido era 8"
    );
    expect(textoDaConferencia({ motivo: "palavra", onde: "legenda" }, "SUMIDO")).toContain("palavra SUMIDO na legenda");
    expect(textoDaConferencia({ motivo: "outra_palavra", palavras: ["GUIA"] }, "SUMIDO")).toContain("GUIA");
    expect(textoDaConferencia({ motivo: "tipo_errado" }, "SUMIDO")).toContain("Gere de novo");
  });

  it("recusas e teto têm frase", () => {
    expect(textoDaRecusaDoPedidoDeCarrossel("total_invalido")).toContain("de 1 a 10");
    expect(textoDaRecusaDoPedidoDeCarrossel("bonus_invalido").length).toBeGreaterThan(10);
    expect(textoDoTetoDoCarrossel()).toContain("10 carrosséis");
  });

  it("os problemas da revisão usam o rótulo da tela", () => {
    expect(textoDosProblemasDoCarrossel(5, [{ campo: "slide_2_texto", erro: "passa de 300 caracteres" }])).toBe(
      "Slide 3: texto: passa de 300 caracteres."
    );
  });

  it("a palavra trocada no Labs diz as duas", () => {
    const t = avisoDePalavraTrocada("SUMIDO", "ZZTESTECHAT");
    expect(t).toContain("SUMIDO");
    expect(t).toContain("ZZTESTECHAT");
  });

  it("a palavra a mais na chamada diz quais são e qual deve ficar", () => {
    expect(textoDeOutrasPalavras(["GUIA", "EBOOK"], "SUMIDO")).toBe("Pede também GUIA, EBOOK: deixe só a palavra SUMIDO.");
  });

  it("a falta da palavra no campo diz qual é e o que acontece sem ela (achado 53)", () => {
    const t = textoDaFaltaDaPalavra("SUMIDO");
    expect(t).toContain("palavra SUMIDO");
    expect(t).toMatch(/não recebe o bônus/);
  });
});
