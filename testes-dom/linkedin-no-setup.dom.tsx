import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: as duas ações de mentira nascem no
// `vi.hoisted`, que sobe junto.
const { gerarConviteDoLinkedin, desconectarLinkedin } = vi.hoisted(() => ({
  gerarConviteDoLinkedin: vi.fn(),
  desconectarLinkedin: vi.fn(),
}));
vi.mock("@/app/setup/actions", () => ({ gerarConviteDoLinkedin, desconectarLinkedin }));

import LinkedinDasContas, { type LinhaDoLinkedin } from "@/app/setup/linkedin-das-contas";

// O LINKEDIN DAS CONTAS NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 1, a
// conexão): cada conta com o LinkedIn conectado, perto de vencer, vencido ou ausente; o convite, cujo link
// aparece uma vez; e o "Desconectar", que diz o que ele faz e o que ele não faz (achado 206). As ações são de
// mentira: o que elas gravam é conferido em testes-integracao/linkedin-acoes.integracao.ts.
const LINHAS: LinhaDoLinkedin[] = [
  { contaId: "1", arroba: "@conta_valida", conexao: { nome: "Dra. Ana Souza", estado: "valido", frase: "vence em 45 dias" } },
  { contaId: "2", arroba: "@conta_perto", conexao: { nome: "Dr. Bruno Lima", estado: "perto", frase: "vence em 3 dias" } },
  { contaId: "3", arroba: "@conta_vencida", conexao: { nome: "Dra. Carla", estado: "vencido", frase: "venceu" } },
  { contaId: "4", arroba: "@conta_sem", conexao: null },
];

const linhaDa = (arroba: string) => screen.getByText(arroba).closest("li")! as HTMLElement;

beforeEach(() => {
  gerarConviteDoLinkedin.mockReset();
  desconectarLinkedin.mockReset();
});

describe("o LinkedIn de cada conta", () => {
  it("diz como cada conta está: conectada, perto de vencer, vencida ou sem LinkedIn", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    expect(linhaDa("@conta_valida").textContent).toContain("LinkedIn conectado como Dra. Ana Souza, vence em 45 dias.");
    expect(linhaDa("@conta_valida").textContent).not.toContain("Falta pouco");
    expect(linhaDa("@conta_perto").textContent).toContain("LinkedIn conectado como Dr. Bruno Lima, vence em 3 dias.");
    expect(linhaDa("@conta_perto").textContent).toContain("Falta pouco para vencer: mande um convite novo.");
    expect(linhaDa("@conta_vencida").textContent).toContain("O LinkedIn de Dra. Carla venceu. Mande um convite novo.");
    expect(linhaDa("@conta_sem").textContent).toContain("Sem LinkedIn.");
  });

  it("o Desconectar só aparece na conta que tem LinkedIn", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    for (const arroba of ["@conta_valida", "@conta_perto", "@conta_vencida"]) {
      expect(within(linhaDa(arroba)).getByRole("button", { name: "Desconectar" })).toBeTruthy();
    }
    expect(within(linhaDa("@conta_sem")).queryByRole("button", { name: "Desconectar" })).toBeNull();
  });

  it("o convite mostra o link uma vez, com o copiar e o aviso de que ele não volta", async () => {
    gerarConviteDoLinkedin.mockResolvedValue({ link: "https://painel.exemplo.com.br/convite/xyz", paraQuem: "@conta_sem" });
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    await act(async () => {
      fireEvent.click(within(linhaDa("@conta_sem")).getByRole("button", { name: "Convidar a conectar o LinkedIn" }));
    });
    expect(gerarConviteDoLinkedin).toHaveBeenCalledTimes(1);
    expect((gerarConviteDoLinkedin.mock.calls[0][1] as FormData).get("conta")).toBe("4");
    const linha = linhaDa("@conta_sem");
    expect(within(linha).getByText("https://painel.exemplo.com.br/convite/xyz")).toBeTruthy();
    expect(within(linha).getByRole("button", { name: "Copiar" })).toBeTruthy();
    expect(linha.textContent).toContain("Este link aparece só agora. Se ele se perder, gere outro.");
    // Só na linha que pediu.
    expect(linhaDa("@conta_valida").textContent).not.toContain("convite/xyz");
  });

  it("mostra o erro da ação, sem link", async () => {
    gerarConviteDoLinkedin.mockResolvedValue({ erro: "Esta conta não está conectada neste painel." });
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    await act(async () => {
      fireEvent.click(within(linhaDa("@conta_valida")).getByRole("button", { name: "Convidar a conectar o LinkedIn" }));
    });
    expect(within(linhaDa("@conta_valida")).getByRole("alert").textContent).toBe("Esta conta não está conectada neste painel.");
  });

  it("sem as chaves do app, diz o motivo e desliga o convite, e o Desconectar continua", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk={false} />);
    expect(screen.getByText(/O LinkedIn está desligado: faltam as chaves do app do LinkedIn/)).toBeTruthy();
    for (const botao of screen.getAllByRole("button", { name: "Convidar a conectar o LinkedIn" })) {
      expect((botao as HTMLButtonElement).disabled).toBe(true);
    }
    expect((within(linhaDa("@conta_valida")).getByRole("button", { name: "Desconectar" }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });
});

describe("o Desconectar (achado 206)", () => {
  it("pede confirmação, dizendo que o painel apaga a autorização e que, no LinkedIn, ela vence sozinha", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    const linha = linhaDa("@conta_valida");
    fireEvent.click(within(linha).getByRole("button", { name: "Desconectar" }));
    expect(linha.textContent).toContain(
      "O painel apaga a autorização do LinkedIn de Dra. Ana Souza e para de usá-la. No LinkedIn, ela vence sozinha em até 60 dias."
    );
    expect(desconectarLinkedin).not.toHaveBeenCalled();
    fireEvent.click(within(linha).getByRole("button", { name: "Cancelar" }));
    expect(linha.textContent).not.toContain("O painel apaga a autorização");
  });

  it("o \"Sim, desconectar\" manda a conta da linha", async () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    const linha = linhaDa("@conta_perto");
    fireEvent.click(within(linha).getByRole("button", { name: "Desconectar" }));
    await act(async () => {
      fireEvent.click(within(linha).getByRole("button", { name: "Sim, desconectar" }));
    });
    expect(desconectarLinkedin).toHaveBeenCalledTimes(1);
    expect((desconectarLinkedin.mock.calls[0][0] as FormData).get("conta")).toBe("2");
  });
});
