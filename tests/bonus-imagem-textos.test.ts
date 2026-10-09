import { describe, expect, it } from "vitest";
import { TETO_IMAGEM_DIARIO } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_GERANDO_A_IMAGEM,
  TEXTO_IMAGEM_FALHOU_SEM_MOTIVO,
  TEXTO_IMAGEM_GERADA,
  TEXTO_IMAGEM_NAO_SUBIU,
  TEXTO_IMAGEM_TRAVADA,
  TEXTO_SEM_CHAVE_DA_IMAGEM,
  textoDaRecusaDaImagem,
  textoDoContador,
  textoDoProblemaDaImagem,
  type RecusaDaImagem,
} from "@/lib/bonus/imagem-textos";
import { textoDaRecusaDaPublicacaoDoCarrossel } from "@/lib/bonus/publicar-textos";

// AS FRASES DO CRIADOR DE IMAGEM (spec da Etapa 6, "A tela"): toda recusa tem frase própria, e a do
// carrossel (na fila, sem conta, só texto…) é a mesma do publicar.

describe("as recusas de pedir uma imagem", () => {
  const proprias: RecusaDaImagem[] = [
    { motivo: "descricao", texto: "Descreva o que a ilustração deve mostrar." },
    { motivo: "sem_chave" },
    { motivo: "teto" },
    { motivo: "gerando" },
  ];

  it("cada uma tem frase própria, terminada em ponto", () => {
    const frases = proprias.map(textoDaRecusaDaImagem);
    for (const f of frases) expect(f).toMatch(/\.$/);
    expect(new Set(frases).size).toBe(frases.length);
  });

  it("a descrição usa a frase do Labs; a chave, a do servidor; o teto diz o número", () => {
    expect(textoDaRecusaDaImagem({ motivo: "descricao", texto: "Descreva o que a ilustração deve mostrar." })).toBe(
      "Descreva o que a ilustração deve mostrar."
    );
    expect(textoDaRecusaDaImagem({ motivo: "sem_chave" })).toBe(TEXTO_SEM_CHAVE_DA_IMAGEM);
    expect(textoDaRecusaDaImagem({ motivo: "teto" })).toContain(`${TETO_IMAGEM_DIARIO} imagens`);
  });

  it("as do carrossel são as do publicar", () => {
    const deCarrossel: RecusaDaImagem[] = [{ motivo: "sem_conta" }, { motivo: "sem_espaco", numero: 2 }, { motivo: "slide" }];
    for (const r of deCarrossel) {
      expect(textoDaRecusaDaImagem(r)).toBe(textoDaRecusaDaPublicacaoDoCarrossel(r as Parameters<typeof textoDaRecusaDaPublicacaoDoCarrossel>[0]));
    }
  });
});

describe("as outras frases da imagem", () => {
  it("o contador do dia, que não passa do teto", () => {
    expect(textoDoContador(3)).toBe("Hoje: 3 de 10 imagens.");
    expect(textoDoContador(12)).toBe("Hoje: 10 de 10 imagens.");
  });

  it("a imagem que não serve, e a pesada à parte", () => {
    expect(textoDoProblemaDaImagem("formato")).toMatch(/não serve para o espaço da arte/);
    expect(textoDoProblemaDaImagem("proporcao")).toBe(textoDoProblemaDaImagem("formato"));
    expect(textoDoProblemaDaImagem("pesada")).toContain("2 MB");
  });

  it("gerando, pronta, travada e as falhas têm frase, cada uma diferente", () => {
    const frases = [TEXTO_GERANDO_A_IMAGEM, TEXTO_IMAGEM_GERADA, TEXTO_IMAGEM_TRAVADA, TEXTO_IMAGEM_NAO_SUBIU, TEXTO_IMAGEM_FALHOU_SEM_MOTIVO];
    for (const f of frases) expect(f).toMatch(/[.…]$/);
    expect(new Set(frases).size).toBe(frases.length);
    expect(TEXTO_GERANDO_A_IMAGEM).toBe("Gerando a imagem… leva uns 30 segundos.");
  });
});
