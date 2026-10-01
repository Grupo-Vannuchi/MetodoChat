import { describe, expect, it } from "vitest";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import type { TextoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import { TRAVADA_MS } from "@/lib/bonus/tempos";

const T0 = Date.parse("2026-09-30T12:00:00Z");
const GERADO: TextoDoCarrossel = {
  tipo: "post",
  titulo: "Gerado pela IA",
  texto: "T".repeat(80),
  chamada: "Comente SUMIDO e receba.",
  legenda: "L".repeat(100),
};

function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
  return {
    id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
    bonus_id: "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f",
    criado_em: new Date(T0),
    total_slides: 1,
    palavra: "SUMIDO",
    contexto: {},
    estado: "pronto",
    gerado: GERADO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(T0),
    revisado_em: null,
    ...troca,
  };
}

describe("o que a tela mostra de um carrossel", () => {
  it("o revisado vence o gerado", () => {
    const revisado = { ...GERADO, titulo: "Revisado pelo operador" };
    expect(textoDaLinhaDoCarrossel(linha({ revisado }))?.titulo).toBe("Revisado pelo operador");
    expect(textoDaLinhaDoCarrossel(linha({}))?.titulo).toBe("Gerado pela IA");
  });

  it("sem texto de forma válida, nada", () => {
    expect(textoDaLinhaDoCarrossel(linha({ gerado: { lixo: true } }))).toBeNull();
  });

  it("a descrição diz o tamanho", () => {
    expect(descricaoDoCarrossel({ total_slides: 1 })).toBe("Post de 1 imagem");
    expect(descricaoDoCarrossel({ total_slides: 10 })).toBe("Carrossel de 10 slides");
  });

  it.each([
    [{ estado: "pendente" as const }, T0 + 1000, { texto: "Gerando", tipo: "neutro" }],
    [{ estado: "gerando" as const }, T0 + TRAVADA_MS + 1, { texto: "Travou", tipo: "erro" }],
    [{ estado: "falhou" as const }, T0, { texto: "Falhou", tipo: "erro" }],
    [{}, T0, { texto: "Pronto para revisar", tipo: "neutro" }],
    [{ revisado_em: new Date(T0) }, T0, { texto: "Revisado", tipo: "ok" }],
  ])("rótulo de %j", (troca, agora, esperado) => {
    expect(rotuloDoCarrossel(linha(troca), agora)).toEqual(esperado);
  });
});
