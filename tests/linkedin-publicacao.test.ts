import { describe, expect, it } from "vitest";
import { AVISO_DO_VENCIMENTO_DIAS, vencimentoDoLinkedin } from "@/lib/linkedin-publicacao";

// O VENCIMENTO DA AUTORIZAÇÃO DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5): 60 dias, sem
// renovação automática. "Vence em N dias", o aviso a partir de 7 dias e o vencido saem desta função só, para a
// Configuração (parte 1) e, na parte 2, para a tela de publicar e o dreno.

const AGORA = Date.parse("2026-11-09T12:00:00Z");
const DIA = 86_400_000;

describe("o vencimento do LinkedIn", () => {
  it("o aviso começa a 7 dias", () => {
    expect(AVISO_DO_VENCIMENTO_DIAS).toBe(7);
  });

  it("longe do fim, diz os dias que faltam, sem aviso", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA + 60 * DIA), AGORA)).toEqual({ estado: "valido", dias: 60, frase: "vence em 60 dias" });
    expect(vencimentoDoLinkedin(new Date(AGORA + 8 * DIA), AGORA)).toEqual({ estado: "valido", dias: 8, frase: "vence em 8 dias" });
  });

  it("a 7 dias ou menos, avisa; um pedaço de dia conta como um dia inteiro", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA + 7 * DIA), AGORA)).toEqual({ estado: "perto", dias: 7, frase: "vence em 7 dias" });
    expect(vencimentoDoLinkedin(new Date(AGORA + 7 * DIA + 1), AGORA).estado).toBe("valido");
    expect(vencimentoDoLinkedin(new Date(AGORA + 3 * 3_600_000), AGORA)).toEqual({ estado: "perto", dias: 1, frase: "vence em 1 dia" });
  });

  it("no próprio instante, e depois, venceu", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA), AGORA)).toEqual({ estado: "vencido", dias: 0, frase: "venceu" });
    expect(vencimentoDoLinkedin(new Date(AGORA - DIA), AGORA)).toEqual({ estado: "vencido", dias: 0, frase: "venceu" });
  });

  it("aceita a data como texto, como ela chega de um componente de cliente", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA + 30 * DIA).toISOString(), AGORA).dias).toBe(30);
  });
});
