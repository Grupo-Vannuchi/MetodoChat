import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/setup",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/publicar/progresso", () => ({ default: () => null }));

import AppShell from "@/app/app-shell";

// O ITEM LOGINS NO MENU, SÓ PARA ADMINISTRADOR (docs/specs/2026-11-04-logins.md, seção 4). O menu esconder o
// item é conforto; quem confere é a página e as actions, no servidor (testes-integracao/
// logins-acoes.integracao.ts). O menu aparece duas vezes (a barra fixa e a gaveta do celular só abre no
// clique), então o caso conta pelo link, e não pelo texto solto.
const CONTAS = [{ ig_user_id: "1", username: "conta_do_painel", profile_picture_url: null }];

function desenhar(login: { nome: string; administrador: boolean } | null) {
  return render(
    <AppShell accounts={CONTAS} selectedId="1" login={login}>
      <p>o conteúdo da página</p>
    </AppShell>
  );
}

const linksDosLogins = () => screen.queryAllByRole("link").filter((a) => a.getAttribute("href") === "/logins");

describe("o item Logins no menu", () => {
  it("aparece para o administrador, no grupo Sistema", () => {
    desenhar({ nome: "Eduardo", administrador: true });
    expect(linksDosLogins()).toHaveLength(1);
    expect(linksDosLogins()[0].textContent).toBe("Logins");
  });

  it("não aparece para quem não é administrador", () => {
    desenhar({ nome: "Fulano", administrador: false });
    expect(linksDosLogins()).toHaveLength(0);
  });

  it("não aparece sem login", () => {
    desenhar(null);
    expect(linksDosLogins()).toHaveLength(0);
  });
});
