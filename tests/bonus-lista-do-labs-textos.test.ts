import { describe, expect, it } from "vitest";
import { textoDosBonusDeFora } from "@/lib/bonus/avulso-textos";
import { quadroDaSituacao } from "@/lib/bonus/carrossel-textos";

// AS FRASES DA LISTA DO LABS NO AVULSO (spec da Etapa 8, achado 84): o bônus publicado sem palavra é
// verde e diz que não tem palavra; os que ficam de fora da escolha são contados, com o motivo.

describe("o bônus publicado sem palavra-chave", () => {
  it("é verde e diz que não tem palavra", () => {
    expect(
      quadroDaSituacao({ tipo: "publicado", bonus: { palavra: null, titulo: "t", descricao: "d", tema: "Vendas" } })
    ).toEqual({ tom: "ok", texto: "Publicado no Labs · sem palavra-chave" });
  });

  it("com palavra, a frase de hoje", () => {
    expect(
      quadroDaSituacao({ tipo: "publicado", bonus: { palavra: "BRUTAL", titulo: "t", descricao: "d", tema: "Vendas" } })
    ).toEqual({ tom: "ok", texto: "Publicado no Labs · palavra BRUTAL" });
  });
});

describe("os bônus do Labs que ficam de fora da escolha", () => {
  it("nenhum de fora, nada a dizer", () => {
    expect(textoDosBonusDeFora({ semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 })).toBeNull();
  });

  it("um só, no singular", () => {
    expect(textoDosBonusDeFora({ semTema: 1, palavraForaDoPadrao: 0, formatoEstranho: 0 })).toBe(
      "1 bônus do Labs não aparece: 1 sem tema."
    );
  });

  it("os três motivos, com o padrão da palavra", () => {
    expect(textoDosBonusDeFora({ semTema: 2, palavraForaDoPadrao: 1, formatoEstranho: 3 })).toBe(
      "6 bônus do Labs não aparecem: 2 sem tema, 1 com a palavra fora do padrão do Chat (de 3 a 30 letras maiúsculas ou números) e 3 num formato que o Chat não lê."
    );
  });

  it("só as partes que existem", () => {
    expect(textoDosBonusDeFora({ semTema: 0, palavraForaDoPadrao: 2, formatoEstranho: 1 })).toBe(
      "3 bônus do Labs não aparecem: 2 com a palavra fora do padrão do Chat (de 3 a 30 letras maiúsculas ou números) e 1 num formato que o Chat não lê."
    );
  });
});
