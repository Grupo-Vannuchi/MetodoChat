import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Campo from "@/app/bonus/[id]/carrossel/[cid]/campo";

// O CAMPO DO CARROSSEL: o operador edita e copia para o Canva. O que vai para a área de
// transferência é o que está NO CAMPO agora, e não o que abriu na página.

const escrever = vi.fn(async (_texto: string) => {});

beforeEach(() => {
  escrever.mockReset();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
});

describe("o campo do carrossel", () => {
  it("copia o texto EDITADO, e não o que abriu na página", async () => {
    render(<Campo nome="gancho" rotulo="Gancho (slide 1)" valorInicial="O texto que veio da IA" max={120} linhas={2} />);
    fireEvent.change(screen.getByLabelText("Gancho (slide 1)"), { target: { value: "O texto que a pessoa editou" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    });
    expect(escrever).toHaveBeenCalledWith("O texto que a pessoa editou");
  });

  it("a contagem acompanha o que se digita", () => {
    render(<Campo nome="chamada" rotulo="Chamada (slide 5)" valorInicial="" max={200} linhas={3} />);
    fireEvent.change(screen.getByLabelText("Chamada (slide 5)"), { target: { value: "abcdef" } });
    expect(screen.getByText("6 de 200 caracteres")).toBeTruthy();
  });
});
