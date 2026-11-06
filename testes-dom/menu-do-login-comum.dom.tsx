import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/publicar/progresso", () => ({ default: () => null }));
// O SELETOR IMPORTA A ACTION DE TROCAR DE CONTA, que é de servidor. Nenhum caso daqui troca de conta: os
// casos só abrem o menu do seletor e leem o que está nele.
vi.mock("@/app/account-actions", () => ({ selectAccount: vi.fn(async () => {}) }));

import AppShell from "@/app/app-shell";

// O MENU E O SELETOR DO LOGIN COMUM (docs/specs/2026-11-05-contas-por-login.md, seção 3). A Configuração e a
// página Logins são do administrador, e conectar conta também: o "+ Conectar outra conta" do seletor e o
// "Conectar Instagram" do seletor sem contas só aparecem para ele. Esconder é conforto; quem confere é o
// servidor (a página e as actions da Configuração, e o `/api/oauth/login`), medido em
// testes-integracao/contas-por-login.integracao.ts.
//
// O menu aparece uma vez na barra fixa (a gaveta do celular só abre no clique), e os casos contam pelo
// link, como testes-dom/logins-no-menu.dom.tsx.
const CONTAS = [{ ig_user_id: "1", username: "conta_do_painel", profile_picture_url: null }];
const ADMINISTRADOR = { nome: "Eduardo", administrador: true };
const COMUM = { nome: "Fulano", administrador: false };

function desenhar(login: { nome: string; administrador: boolean }, contas = CONTAS) {
  return render(
    <AppShell accounts={contas} selectedId={contas[0]?.ig_user_id ?? null} login={login}>
      <p>o conteúdo da página</p>
    </AppShell>
  );
}

const linksPara = (href: string) => screen.queryAllByRole("link").filter((a) => a.getAttribute("href") === href);

/** Abre o menu do seletor de conta, clicando nele, como a pessoa faz. */
function abrirOSeletor() {
  fireEvent.click(screen.getByRole("button", { name: /@conta_do_painel/ }));
}

describe("o menu do login comum", () => {
  it("o comum não vê a Configuração nem os Logins", () => {
    desenhar(COMUM);
    expect(linksPara("/setup")).toHaveLength(0);
    expect(linksPara("/logins")).toHaveLength(0);
    // O resto do menu continua: o caso não passa por um menu que sumiu inteiro.
    expect(linksPara("/conversas")).toHaveLength(1);
  });

  it("o administrador vê os dois, no grupo Sistema", () => {
    desenhar(ADMINISTRADOR);
    expect(linksPara("/setup")).toHaveLength(1);
    expect(linksPara("/setup")[0].textContent).toBe("Configuração");
    expect(linksPara("/logins")).toHaveLength(1);
  });
});

describe("o seletor de conta do login comum", () => {
  it("o comum abre o seletor e não acha o + Conectar outra conta", () => {
    desenhar(COMUM);
    abrirOSeletor();
    // O menu do seletor abriu de verdade: a conta aparece duas vezes (no botão e na lista).
    expect(screen.getAllByText("@conta_do_painel")).toHaveLength(2);
    expect(screen.queryByText("+ Conectar outra conta")).toBeNull();
    expect(linksPara("/api/oauth/login")).toHaveLength(0);
  });

  it("o administrador abre o seletor e acha o + Conectar outra conta", () => {
    desenhar(ADMINISTRADOR);
    abrirOSeletor();
    expect(linksPara("/api/oauth/login")).toHaveLength(1);
    expect(linksPara("/api/oauth/login")[0].textContent).toBe("+ Conectar outra conta");
  });

  it("o comum sem contas não vê o Conectar Instagram", () => {
    desenhar(COMUM, []);
    expect(screen.queryByText("Conectar Instagram")).toBeNull();
  });

  it("o administrador sem contas vê o Conectar Instagram", () => {
    desenhar(ADMINISTRADOR, []);
    expect(screen.getByText("Conectar Instagram")).toBeTruthy();
  });
});
