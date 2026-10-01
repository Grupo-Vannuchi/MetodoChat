import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PedidoDeCarrossel from "@/app/bonus/[id]/pedido-de-carrossel";
import type { AvisoDoPedidoDeCarrossel } from "@/lib/bonus/carrossel-textos";

// O PEDIDO DE UM CARROSSEL (pelo mesmo motivo dos achados 52 e 54, medidos em 01/10 num navegador
// de verdade): todo redirect de Server Action recria a página no Next 16, e o "Quantos slides?"
// voltava para 10 numa recusa. A recusa volta como ESTADO (useActionState) e aparece junto do
// botão. A action entra por propriedade, e aqui é uma falsa.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";

function renderizar(respostas: AvisoDoPedidoDeCarrossel[], { publicado = true, restam = 10 } = {}) {
  const recebidos: FormData[] = [];
  const acao = async (_anterior: AvisoDoPedidoDeCarrossel | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(<PedidoDeCarrossel acao={acao} bonusId={BONUS} publicado={publicado} restam={restam} />);
  return recebidos;
}

const slides = () => screen.getByLabelText("Quantos slides?") as HTMLSelectElement;

async function gerar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Gerar carrossel" }));
  });
}

describe("o pedido de carrossel", () => {
  it("começa em 10 slides", () => {
    renderizar([]);
    expect(slides().value).toBe("10");
  });

  it("numa recusa, o número escolhido fica e o motivo aparece junto do botão", async () => {
    const recebidos = renderizar([{ tom: "erro", texto: "O limite de hoje acabou.", em: 1 }]);
    fireEvent.change(slides(), { target: { value: "3" } });
    await gerar();
    expect(recebidos.map((f) => [f.get("bonus_id"), f.get("total")])).toEqual([[BONUS, "3"]]);
    expect(slides().value).toBe("3");
    expect(screen.getByRole("status").textContent).toBe("O limite de hoje acabou.");
  });

  it("a segunda tentativa leva o número escolhido, e não o 10 do começo", async () => {
    const recebidos = renderizar([
      { tom: "erro", texto: "Não consegui consultar o Labs agora.", em: 1 },
      { tom: "erro", texto: "O limite de hoje acabou.", em: 2 },
    ]);
    fireEvent.change(slides(), { target: { value: "4" } });
    await gerar();
    await gerar();
    expect(recebidos.map((f) => f.get("total"))).toEqual(["4", "4"]);
  });

  it("o aviso some quando se troca o número", async () => {
    renderizar([{ tom: "erro", texto: "O limite de hoje acabou.", em: 1 }]);
    await gerar();
    fireEvent.input(slides(), { target: { value: "2" } });
    expect(screen.getByRole("status", { hidden: true }).hidden).toBe(true);
  });

  it.each([
    { publicado: false, restam: 10 },
    { publicado: true, restam: 0 },
  ])("o botão não pede com publicado=$publicado e restam=$restam", ({ publicado, restam }) => {
    renderizar([], { publicado, restam });
    expect((screen.getByRole("button", { name: "Gerar carrossel" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
