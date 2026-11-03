import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: as duas ações de mentira nascem no
// `vi.hoisted`, que sobe junto.
const { gerarConvite, cancelarConvite } = vi.hoisted(() => ({ gerarConvite: vi.fn(), cancelarConvite: vi.fn() }));
vi.mock("@/app/setup/actions", () => ({ gerarConvite, cancelarConvite }));

import Convites from "@/app/setup/convites";
import type { LinhaDoConvite } from "@/lib/convites";

// O BLOCO DO LINK DE CONVITE NA ETAPA 6 (docs/specs/2026-11-03-link-de-convite.md): o formulário, o link que
// aparece uma vez, com o copiar, e a lista com os quatro estados. As ações são de mentira: o que elas
// gravam é conferido em testes-integracao/convite.integracao.ts.
const LINHAS: LinhaDoConvite[] = [
  { id: "1", paraQuem: "Dr. Marcus", estado: "pendente", detalhe: "vence em 10/11/2026, 12:00", aviso: null, cancelavel: true },
  {
    id: "2",
    paraQuem: "N8X",
    estado: "usado",
    detalhe: "@n8xmarketing, em 04/11/2026, 10:12",
    aviso: 'conectada, mas a assinatura dos webhooks falhou: x. Use o botão "Reassinar webhooks" do passo 5.',
    cancelavel: false,
  },
  { id: "3", paraQuem: "Antigo", estado: "vencido", detalhe: "venceu em 01/11/2026, 09:00", aviso: null, cancelavel: false },
  {
    id: "4",
    paraQuem: "Desistiu",
    estado: "cancelado",
    detalhe: "cancelado em 02/11/2026, 08:00",
    aviso: "A última tentativa falhou (02/11/2026, 07:59): a Meta recusou",
    cancelavel: false,
  },
];

beforeEach(() => {
  gerarConvite.mockReset();
  cancelarConvite.mockReset();
});

describe("o bloco do link de convite", () => {
  it("mostra o link uma vez, com o copiar e o aviso de que ele não volta", async () => {
    gerarConvite.mockResolvedValue({ link: "https://painel.exemplo.com.br/convite/abc", paraQuem: "Dr. Marcus" });
    render(<Convites linhas={[]} metaOk />);
    fireEvent.change(screen.getByLabelText("Para quem"), { target: { value: "Dr. Marcus" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerar link de convite" }));
    });
    expect(gerarConvite).toHaveBeenCalledTimes(1);
    expect((gerarConvite.mock.calls[0][1] as FormData).get("para_quem")).toBe("Dr. Marcus");
    expect(screen.getByText("https://painel.exemplo.com.br/convite/abc")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
    expect(screen.getByText("Este link aparece só agora. Se ele se perder, cancele e gere outro.")).toBeTruthy();
  });

  it("mostra o erro da ação, sem link", async () => {
    gerarConvite.mockResolvedValue({ erro: "Diga para quem é o convite, em até 60 caracteres." });
    render(<Convites linhas={[]} metaOk />);
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Gerar link de convite" }).closest("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("Diga para quem é o convite, em até 60 caracteres.");
    expect(screen.queryByText(/Este link aparece só agora/)).toBeNull();
  });

  it("a lista mostra os quatro estados, o aviso de cada um e o cancelar só no pendente", () => {
    render(<Convites linhas={LINHAS} metaOk />);
    expect(screen.getByText(/vence em 10\/11\/2026, 12:00/)).toBeTruthy();
    expect(screen.getByText(/@n8xmarketing, em 04\/11\/2026, 10:12/)).toBeTruthy();
    expect(screen.getByText(/venceu em 01\/11\/2026, 09:00/)).toBeTruthy();
    expect(screen.getByText(/cancelado em 02\/11\/2026, 08:00/)).toBeTruthy();
    expect(screen.getByText(/Reassinar webhooks/)).toBeTruthy();
    expect(screen.getByText(/A última tentativa falhou/)).toBeTruthy();
    const cancelar = screen.getAllByRole("button", { name: "Cancelar" });
    expect(cancelar).toHaveLength(1);
    expect((cancelar[0].closest("form")!.querySelector('input[name="id"]') as HTMLInputElement).value).toBe("1");
  });

  it("sem o app da Meta configurado, o botão de gerar fica travado", () => {
    render(<Convites linhas={[]} metaOk={false} />);
    expect((screen.getByRole("button", { name: "Gerar link de convite" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
