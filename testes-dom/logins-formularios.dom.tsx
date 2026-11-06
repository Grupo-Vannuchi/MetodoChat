import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: as ações de mentira nascem no
// `vi.hoisted`, que sobe junto (o molde é testes-dom/convites-no-setup.dom.tsx).
const acoes = vi.hoisted(() => ({
  criarLoginAction: vi.fn(async () => ({})),
  definirSenhaAction: vi.fn(async () => ({})),
  definirContasDoLoginAction: vi.fn(async () => ({})),
}));
vi.mock("@/app/logins/actions", () => acoes);

import { ContasDoLogin, CriarLogin } from "@/app/logins/formularios";

// OS FORMULÁRIOS DA PÁGINA LOGINS (docs/specs/2026-11-05-contas-por-login.md, seção 4): a caixinha
// "Administrador" do criar, desmarcada (o login novo nasce comum), e as contas de um login comum, uma caixinha
// por conta. As ações são de mentira: o que elas gravam é conferido em testes-integracao/logins-acoes.integracao.ts.
const CONTAS = [
  { ig_user_id: "17800000000061001", username: "conta_a", name: "Conta A" },
  { ig_user_id: "17800000000061002", username: "conta_b", name: null },
  { ig_user_id: "17800000000061003", username: null, name: "Conta C" },
];

describe("o criar login", () => {
  it("tem a caixinha Administrador, com o rótulo, desmarcada", () => {
    render(<CriarLogin />);
    const caixa = screen.getByLabelText("Administrador") as HTMLInputElement;
    expect(caixa.type).toBe("checkbox");
    expect(caixa.name).toBe("administrador");
    expect(caixa.checked).toBe(false);
  });
});

describe("as contas de um login comum", () => {
  it("tem uma caixinha por conta, com o @ e o nome, e as marcadas vêm marcadas", () => {
    render(<ContasDoLogin id="login-1" nome="Fulano" contas={CONTAS} marcadas={["17800000000061002"]} />);
    const caixas = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(caixas.map((c) => [c.name, c.value, c.checked])).toEqual([
      ["contas", "17800000000061001", false],
      ["contas", "17800000000061002", true],
      ["contas", "17800000000061003", false],
    ]);
    const rotulo = (n: number) => caixas[n].closest("label")?.textContent ?? "";
    expect(rotulo(0)).toContain("@conta_a");
    expect(rotulo(0)).toContain("Conta A");
    expect(rotulo(1)).toContain("@conta_b");
    // Sem o @, o rótulo leva o nome.
    expect(rotulo(2)).toContain("Conta C");
  });

  it("leva o id do login escondido e tem o botão Salvar contas", () => {
    const { container } = render(<ContasDoLogin id="login-1" nome="Fulano" contas={CONTAS} marcadas={[]} />);
    const id = container.querySelector('input[type="hidden"][name="id"]') as HTMLInputElement | null;
    expect(id?.value).toBe("login-1");
    const botao = screen.getByRole("button", { name: "Salvar contas" });
    expect(botao.getAttribute("type")).toBe("submit");
    expect(within(botao.closest("form")!).getAllByRole("checkbox")).toHaveLength(3);
  });

  it("sem conta nenhuma no painel, diz isso e não mostra caixinha", () => {
    render(<ContasDoLogin id="login-1" nome="Fulano" contas={[]} marcadas={[]} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText("Ainda não há contas no painel.")).toBeTruthy();
  });
});
