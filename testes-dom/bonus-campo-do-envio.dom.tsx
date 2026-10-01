import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import CampoDoEnvio from "@/app/bonus/[id]/campo-do-envio";

// O CAMPO DO ENVIO AO LABS (achado 54, 01/10). Depois que a action do formulário termina, o
// React 19 reinicia o formulário. Com campo não controlado, uma recusa feita pelo próprio Chat
// (`invalido`, que não grava nada) fazia a edição sumir da tela, e o "Enviar ao Labs" seguinte
// mandava o texto anterior. É o mesmo mecanismo do achado 52, medido no carrossel.

/** O formulário com uma action que só guarda o que recebeu. */
function renderizar(campo: ReactNode): FormData[] {
  const recebidos: FormData[] = [];
  render(
    <form
      action={async (f: FormData) => {
        recebidos.push(f);
      }}
    >
      {campo}
      <button type="submit">Enviar ao Labs</button>
    </form>
  );
  return recebidos;
}

async function enviar(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Enviar ao Labs" }));
  });
}

describe("o campo do envio ao Labs", () => {
  it("a edição de um campo de linha única continua depois que a action termina", async () => {
    const recebidos = renderizar(
      <>
        <label htmlFor="titulo">Título</label>
        <CampoDoEnvio nome="titulo" valorInicial="Título que veio da IA" max={220} travado={false} />
      </>
    );
    const campo = screen.getByLabelText("Título") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "Título editado" } });
    await enviar();
    expect(recebidos.map((f) => f.get("titulo"))).toEqual(["Título editado"]);
    expect(campo.value).toBe("Título editado");
  });

  it("a edição de um campo de várias linhas continua depois que a action termina", async () => {
    const recebidos = renderizar(
      <>
        <label htmlFor="descricao">Descrição</label>
        <CampoDoEnvio nome="descricao" valorInicial="Descrição que veio da IA" max={1200} linhas={4} travado={false} />
      </>
    );
    const campo = screen.getByLabelText("Descrição") as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: "Descrição editada" } });
    await enviar();
    expect(recebidos.map((f) => f.get("descricao"))).toEqual(["Descrição editada"]);
    expect(campo.value).toBe("Descrição editada");
  });

  it("travado, o campo não aceita edição e vai como abriu", async () => {
    const recebidos = renderizar(
      <>
        <label htmlFor="titulo">Título</label>
        <CampoDoEnvio nome="titulo" valorInicial="O corpo congelado" max={220} travado />
      </>
    );
    expect((screen.getByLabelText("Título") as HTMLInputElement).readOnly).toBe(true);
    await enviar();
    expect(recebidos.map((f) => f.get("titulo"))).toEqual(["O corpo congelado"]);
  });
});
