import { describe, expect, it } from "vitest";
import { estadoDaImagem, TRAVADA_IMAGEM_MS } from "@/lib/bonus/imagem-regras";

// O ESTADO DA IMAGEM DE UM SLIDE, lido da última linha dele em `imagens_geradas` (spec da Etapa 6, "O
// acompanhar"). A linha `gerando` que passou do prazo não termina mais: aparece como travada, libera o
// slide e continua contando no teto. O relógio é o do banco, que a consulta lê junto.

const AGORA = new Date("2026-10-09T15:00:00Z");
const antes = (ms: number) => new Date(AGORA.getTime() - ms);
const linha = (p: Partial<{ estado: "gerando" | "pronta" | "falhou"; motivo: string | null; caminho: string | null; criado_em: Date }>) => ({
  estado: "gerando" as const,
  motivo: null,
  caminho: null,
  criado_em: antes(5_000),
  ...p,
});

describe("o estado da imagem de um slide", () => {
  it("sem linha, nenhuma", () => {
    expect(estadoDaImagem(null, AGORA)).toEqual({ tipo: "nenhuma" });
  });

  it("gerando dentro do prazo", () => {
    expect(estadoDaImagem(linha({ criado_em: antes(TRAVADA_IMAGEM_MS - 1) }), AGORA)).toEqual({ tipo: "gerando" });
  });

  it("gerando depois do prazo é travada", () => {
    expect(estadoDaImagem(linha({ criado_em: antes(TRAVADA_IMAGEM_MS) }), AGORA)).toEqual({ tipo: "travada" });
  });

  it("pronta leva o caminho, e falhou leva o motivo", () => {
    expect(estadoDaImagem(linha({ estado: "pronta", caminho: "p/bonus-foto/x.jpg" }), AGORA)).toEqual({
      tipo: "pronta",
      caminho: "p/bonus-foto/x.jpg",
    });
    expect(estadoDaImagem(linha({ estado: "falhou", motivo: "A OpenAI recusou o pedido." }), AGORA)).toEqual({
      tipo: "falhou",
      motivo: "A OpenAI recusou o pedido.",
    });
  });
});
