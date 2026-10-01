import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormularioDoPedido from "@/app/bonus/formulario-do-pedido";
import type { AvisoDoPedido } from "@/lib/bonus/textos";

// O PEDIDO DE UM BÔNUS (achados 52 e 54, causa medida em 01/10 num navegador de verdade): todo
// redirect de Server Action recria a página no Next 16, e o tema, o "O que o bônus resolve" e a
// palavra digitados sumiam numa recusa. A recusa volta como ESTADO (useActionState) e aparece
// junto do botão. A action entra por propriedade, e aqui é uma falsa. Este teste prova o
// formulário; a recriação do Next só aparece num navegador de verdade.

function renderizar(respostas: AvisoDoPedido[], restam = 5) {
  const recebidos: FormData[] = [];
  const acao = async (_anterior: AvisoDoPedido | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(<FormularioDoPedido acao={acao} temas={["Vendas", "Marketing"]} restam={restam} />);
  return recebidos;
}

function digitar(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

async function gerar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Gerar bônus" }));
  });
}

describe("o formulário do pedido de bônus", () => {
  it("numa recusa, o que foi digitado fica na tela e o motivo aparece junto do botão", async () => {
    const recebidos = renderizar([{ tom: "erro", texto: "A palavra-chave precisa de pelo menos 3 caracteres.", em: 1 }]);
    digitar("Tema", "Vendas");
    digitar("O que o bônus resolve", "Reativar clientes que sumiram há meses pelo WhatsApp");
    digitar("Palavra-chave (opcional)", "AB");
    await gerar();
    expect(recebidos.map((f) => [f.get("tema"), f.get("o_que_resolve"), f.get("palavra")])).toEqual([
      ["Vendas", "Reativar clientes que sumiram há meses pelo WhatsApp", "AB"],
    ]);
    expect((screen.getByLabelText("Tema") as HTMLInputElement).value).toBe("Vendas");
    expect((screen.getByLabelText("O que o bônus resolve") as HTMLTextAreaElement).value).toBe(
      "Reativar clientes que sumiram há meses pelo WhatsApp"
    );
    expect((screen.getByLabelText("Palavra-chave (opcional)") as HTMLInputElement).value).toBe("AB");
    expect(screen.getByRole("status").textContent).toBe("A palavra-chave precisa de pelo menos 3 caracteres.");
  });

  // Quem corrige só a palavra não redigita o resto: a segunda tentativa tem de levar o tema e o
  // "O que o bônus resolve" da primeira, e não campos vazios.
  it("a segunda tentativa leva a correção e o resto do que foi digitado", async () => {
    const recebidos = renderizar([
      { tom: "erro", texto: "A palavra-chave precisa de pelo menos 3 caracteres.", em: 1 },
      { tom: "erro", texto: "O limite de hoje acabou.", em: 2 },
    ]);
    digitar("Tema", "Vendas");
    digitar("O que o bônus resolve", "Reativar clientes que sumiram há meses pelo WhatsApp");
    digitar("Palavra-chave (opcional)", "AB");
    await gerar();
    digitar("Palavra-chave (opcional)", "SUMIDO");
    await gerar();
    expect(recebidos.map((f) => [f.get("tema"), f.get("o_que_resolve"), f.get("palavra")])).toEqual([
      ["Vendas", "Reativar clientes que sumiram há meses pelo WhatsApp", "AB"],
      ["Vendas", "Reativar clientes que sumiram há meses pelo WhatsApp", "SUMIDO"],
    ]);
    expect(screen.getByRole("status").textContent).toBe("O limite de hoje acabou.");
  });

  it("o aviso some quando se volta a editar", async () => {
    renderizar([{ tom: "erro", texto: "A chave da IA não está configurada.", em: 1 }]);
    digitar("Tema", "Vendas");
    digitar("O que o bônus resolve", "Reativar clientes que sumiram há meses pelo WhatsApp");
    await gerar();
    fireEvent.input(screen.getByLabelText("Tema"), { target: { value: "Marketing" } });
    expect(screen.getByRole("status", { hidden: true }).hidden).toBe(true);
  });

  it("as sugestões de tema vêm do Labs", () => {
    renderizar([]);
    const opcoes = [...document.querySelectorAll("datalist#temas-do-labs option")].map((o) => o.getAttribute("value"));
    expect(opcoes).toEqual(["Vendas", "Marketing"]);
  });

  it("sem geração restante no dia, o botão não pede", () => {
    renderizar([], 0);
    expect((screen.getByRole("button", { name: "Gerar bônus" }) as HTMLButtonElement).disabled).toBe(true);
  });

  // O CLIQUE DUPLO criaria dois pedidos e gastaria duas gerações do dia (decisão do Eduardo, 01/10,
  // achado 64 do auditor): enquanto o pedido roda, o botão fica desligado.
  it("enquanto o pedido roda, o botão fica desligado e um segundo clique não pede de novo", async () => {
    const recebidos: FormData[] = [];
    let terminar: (a: AvisoDoPedido) => void = () => {};
    const acao = (_anterior: AvisoDoPedido | null, f: FormData) => {
      recebidos.push(f);
      return new Promise<AvisoDoPedido>((r) => (terminar = r));
    };
    render(<FormularioDoPedido acao={acao} temas={[]} restam={5} />);
    digitar("Tema", "Vendas");
    digitar("O que o bônus resolve", "Reativar clientes que sumiram há meses pelo WhatsApp");
    const botao = screen.getByRole("button", { name: "Gerar bônus" }) as HTMLButtonElement;
    await gerar();
    expect(botao.disabled).toBe(true);
    await gerar();
    expect(recebidos).toHaveLength(1);
    await act(async () => {
      terminar({ tom: "erro", texto: "O limite de hoje acabou.", em: 1 });
    });
    expect(botao.disabled).toBe(false);
  });
});
