import { describe, expect, it } from "vitest";
import { caminhoDoCarrossel, ehDaRota, type RotaDoCarrossel } from "@/lib/bonus/carrossel-caminho";
import type { OrigemDoCarrossel } from "@/lib/bonus/carrossel-linha";

// O ENDEREÇO DE CADA CARROSSEL VEM DA LINHA (spec da Etapa 7, "As rotas"): o carrossel de bônus mora
// na página de hoje, e o avulso, em /carrosseis. Cada rota serve só a sua origem.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const OUTRO_BONUS = "9f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

const linha = (origem: OrigemDoCarrossel, bonus_id: string | null = null) => ({ id: CARROSSEL, origem, bonus_id });

describe("o caminho da página do carrossel", () => {
  it("o de bônus mora embaixo do bônus, como hoje", () => {
    expect(caminhoDoCarrossel(linha("bonus", BONUS))).toBe(`/bonus/${BONUS}/carrossel/${CARROSSEL}`);
  });

  it.each(["labs", "livre"] as const)("o avulso (%s) mora em /carrosseis", (origem) => {
    expect(caminhoDoCarrossel(linha(origem))).toBe(`/carrosseis/${CARROSSEL}`);
  });
});

describe("cada rota serve só a sua origem", () => {
  const DO_BONUS: RotaDoCarrossel = { tipo: "bonus", bonusId: BONUS };
  const AVULSA: RotaDoCarrossel = { tipo: "avulso" };

  it("a rota do bônus serve o carrossel daquele bônus", () => {
    expect(ehDaRota(linha("bonus", BONUS), DO_BONUS)).toBe(true);
  });

  it("a rota do bônus recusa o carrossel de outro bônus e o avulso", () => {
    expect(ehDaRota(linha("bonus", OUTRO_BONUS), DO_BONUS)).toBe(false);
    expect(ehDaRota(linha("labs"), DO_BONUS)).toBe(false);
    expect(ehDaRota(linha("livre"), DO_BONUS)).toBe(false);
  });

  it("a rota dos avulsos serve os dois avulsos, e recusa o de bônus", () => {
    expect(ehDaRota(linha("labs"), AVULSA)).toBe(true);
    expect(ehDaRota(linha("livre"), AVULSA)).toBe(true);
    expect(ehDaRota(linha("bonus", BONUS), AVULSA)).toBe(false);
  });
});
