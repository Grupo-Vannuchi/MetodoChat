import { describe, expect, it } from "vitest";
import {
  TEXTO_DO_CONVITE_SEM_CONFIRMACAO,
  oConvitePedeConfirmacao,
  textoDaConfirmacaoDoConvite,
} from "@/lib/linkedin-publicacao";

// O CONVITE NUMA CONTA QUE JÁ TEM O LINKEDIN (a decisão do Eduardo pela caixa, 10/11, 17:16:36Z: "Pede confirmação
// antes"; o achado 209: dois convites a mais apareceram numa conta já conectada). A tela pede a confirmação, e o
// servidor recusa o convite sem ela, pela mesma regra: o duplo clique sem confirmar não gera nada.

describe("quando o convite do LinkedIn pede confirmação", () => {
  it("a conta com o LinkedIn válido, ou perto de vencer, pede: um convite usado troca a conexão que existe", () => {
    expect(oConvitePedeConfirmacao("valido")).toBe(true);
    expect(oConvitePedeConfirmacao("perto")).toBe(true);
  });

  it("a conta sem LinkedIn, ou com ele vencido, não pede: não há conexão para trocar", () => {
    expect(oConvitePedeConfirmacao(null)).toBe(false);
    expect(oConvitePedeConfirmacao("vencido")).toBe(false);
  });

  it("a confirmação diz de quem é o LinkedIn conectado e o que o convite novo faz", () => {
    const texto = textoDaConfirmacaoDoConvite("Dra. Ana Souza");
    expect(texto).toContain("Dra. Ana Souza");
    expect(texto).toContain("troca");
  });

  it("a recusa do servidor sem a confirmação diz o que fazer", () => {
    expect(TEXTO_DO_CONVITE_SEM_CONFIRMACAO).toContain("confirme");
  });
});
