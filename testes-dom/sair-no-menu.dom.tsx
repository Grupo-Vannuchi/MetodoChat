import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/setup",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/publicar/progresso", () => ({ default: () => null }));

import AppShell from "@/app/app-shell";

// A MINHA CONTA E O SAIR NO RODAPÉ DO MENU (docs/specs/2026-11-04-logins.md, seção 5). O SAIR É UM BOTÃO DE
// FORMULÁRIO, e nunca um link (achado 169): o Next pré-carrega os links, e um Sair por GET derrubaria a sessão
// de quem só passou o mouse. A action de verdade chega pelo layout; aqui é uma de mentira.
const CONTAS = [{ ig_user_id: "1", username: "conta_do_painel", profile_picture_url: null }];
const sair = vi.fn(async () => {});

function desenhar(login: { nome: string; administrador: boolean } | null) {
  return render(
    <AppShell accounts={CONTAS} selectedId="1" login={login} sair={sair}>
      <p>o conteúdo da página</p>
    </AppShell>
  );
}

describe("o rodapé do menu", () => {
  it("leva o nome à Minha conta, e o Sair é o botão de um formulário", () => {
    desenhar({ nome: "Eduardo", administrador: true });
    const conta = screen.getByRole("link", { name: "Eduardo" });
    expect(conta.getAttribute("href")).toBe("/minha-conta");
    const botao = screen.getByRole("button", { name: "Sair" });
    expect(botao.getAttribute("type")).toBe("submit");
    expect(botao.closest("form")).not.toBeNull();
    expect(screen.queryAllByRole("link").filter((a) => /sair/i.test(a.textContent ?? ""))).toHaveLength(0);
  });

  it("sem login, não há Minha conta nem Sair", () => {
    desenhar(null);
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
    expect(screen.queryAllByRole("link").filter((a) => a.getAttribute("href") === "/minha-conta")).toHaveLength(0);
  });
});
