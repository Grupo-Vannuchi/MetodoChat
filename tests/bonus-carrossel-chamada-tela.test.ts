import { describe, expect, it } from "vitest";
import { avisoDaPalavraNoLabs, avisoDePalavraTrocada, textoDoPedidoDaChamada } from "@/lib/bonus/carrossel-textos";

// O TOPO DA PÁGINA E OS AVISOS DA PALAVRA NO LABS (spec da Etapa 8, "A página do carrossel"): com
// palavra, a página diz a palavra, como hoje; sem palavra, diz a ação que a chamada pede.

describe("o que a chamada pede, no topo da página", () => {
  it("com palavra, a palavra", () => {
    expect(textoDoPedidoDaChamada({ palavra: "BRUTAL", acao_da_chamada: null })).toBe("palavra BRUTAL");
  });

  it.each([
    ["salvar", "sem palavra-chave · a chamada pede: salvar o post"],
    ["compartilhar", "sem palavra-chave · a chamada pede: compartilhar"],
    ["seguir", "sem palavra-chave · a chamada pede: seguir o perfil"],
    ["comentar", "sem palavra-chave · a chamada pede: comentar a opinião"],
  ])("sem palavra, a ação (%s)", (acao, texto) => {
    expect(textoDoPedidoDaChamada({ palavra: null, acao_da_chamada: acao })).toBe(texto);
  });

  it("sem palavra e com a ação fora das quatro, só diz que não tem palavra", () => {
    expect(textoDoPedidoDaChamada({ palavra: null, acao_da_chamada: "curtir" })).toBe("sem palavra-chave");
  });
});

describe("a palavra do bônus no Labs, comparada com a do carrossel", () => {
  it("igual, nada a avisar", () => {
    expect(avisoDaPalavraNoLabs("BRUTAL", "BRUTAL")).toBeNull();
    expect(avisoDaPalavraNoLabs(null, null)).toBeNull();
  });

  it("trocada, o aviso de hoje", () => {
    expect(avisoDaPalavraNoLabs("SUMIDO", "ZZTESTECHAT")).toBe(avisoDePalavraTrocada("SUMIDO", "ZZTESTECHAT"));
  });

  it("feito sem palavra, e o bônus agora tem palavra no Labs", () => {
    expect(avisoDaPalavraNoLabs("BRUTAL", null)).toBe(
      "No Labs, este bônus agora tem a palavra BRUTAL. Este carrossel foi feito sem palavra-chave; para usar a palavra, crie um carrossel novo."
    );
  });

  it("feito com palavra, e o bônus perdeu a palavra no Labs", () => {
    expect(avisoDaPalavraNoLabs(null, "BRUTAL")).toBe(
      "No Labs, este bônus não tem mais palavra-chave. Este carrossel pede a palavra BRUTAL: confira se a automação dela ainda existe."
    );
  });
});
