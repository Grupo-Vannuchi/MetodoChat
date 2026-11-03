import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let caminho = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => caminho,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/publicar/progresso", () => ({ default: () => null }));

import AppShell from "@/app/app-shell";

// A PÁGINA DO CONVITE NÃO TEM O MENU DO PAINEL (docs/specs/2026-11-03-link-de-convite.md): quem a abre é
// o cliente, e ela não mostra nada do painel, nem as contas. O layout raiz já só lista as contas com a
// sessão; este caso confere a casca, que desenha o menu e o seletor de conta.
const CONTAS = [{ ig_user_id: "1", username: "conta_do_painel", profile_picture_url: null }];

function desenhar(rota: string) {
  caminho = rota;
  return render(
    <AppShell accounts={CONTAS} selectedId="1">
      <p>o conteúdo da página</p>
    </AppShell>
  );
}

describe("a casca do painel na página do convite", () => {
  it.each(["/convite/abc", "/convite/pronto", "/convite/erro"])("%s não tem menu nem conta", (rota) => {
    desenhar(rota);
    expect(screen.getByText("o conteúdo da página")).toBeTruthy();
    expect(screen.queryByText("Conversas")).toBeNull();
    expect(screen.queryByText(/conta_do_painel/)).toBeNull();
  });

  it("a configuração, para comparar, tem o menu", () => {
    desenhar("/setup");
    expect(screen.getAllByText("Conversas").length).toBeGreaterThan(0);
  });
});
