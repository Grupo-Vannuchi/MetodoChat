import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormularioDoEnvio from "@/app/bonus/[id]/formulario-do-envio";
import type { AvisoDoEnvio } from "@/lib/bonus/textos";

// O FORMULÁRIO DO ENVIO AO LABS (achado 54, causa medida em 01/10 num navegador de verdade):
// todo redirect de Server Action recria a página no Next 16, e o que o operador tinha editado
// voltava ao texto com que a página abriu. A recusa que não grava nada volta como ESTADO
// (useActionState) e aparece junto do botão. A action entra por propriedade, e aqui é uma falsa.
// Este teste prova o formulário; a recriação do Next só aparece num navegador de verdade.

const CAMPOS = [
  { nome: "titulo" as const, rotulo: "Título", max: 220 },
  { nome: "slug" as const, rotulo: "Endereço (slug)", max: 90 },
  { nome: "descricao" as const, rotulo: "Descrição", max: 1200, linhas: 3 },
];
const VALORES = {
  titulo: "Título que veio da IA",
  slug: "titulo-que-veio-da-ia",
  palavra: "SUMIDO",
  tema: "Vendas",
  descricao: "Descrição que veio da IA, com o tamanho mínimo.",
  intro: "",
  prompt: "Um prompt qualquer com mais de vinte letras.",
};

function renderizar(respostas: AvisoDoEnvio[], congelado = false) {
  const recebidos: FormData[] = [];
  const acao = async (_anterior: AvisoDoEnvio | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(
    <FormularioDoEnvio
      acao={acao}
      id="0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f"
      campos={CAMPOS}
      valores={VALORES}
      congelado={congelado}
      temas={["Vendas", "Marketing"]}
    />
  );
  return recebidos;
}

async function enviar(nome = "Enviar ao Labs") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nome }));
  });
}

describe("o formulário do envio ao Labs", () => {
  it("numa recusa local, a edição fica na tela e o motivo aparece junto do botão", async () => {
    const recebidos = renderizar([{ tom: "erro", texto: "Corrija antes de enviar. Endereço (slug): curto.", em: 1 }]);
    const slug = screen.getByLabelText("Endereço (slug)") as HTMLInputElement;
    fireEvent.change(slug, { target: { value: "ab" } });
    await enviar();
    expect(recebidos.map((f) => [f.get("id"), f.get("slug")])).toEqual([["0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f", "ab"]]);
    expect(slug.value).toBe("ab");
    expect(screen.getByRole("status").textContent).toBe("Corrija antes de enviar. Endereço (slug): curto.");
  });

  it("o aviso some quando se volta a editar", async () => {
    renderizar([{ tom: "erro", texto: "Corrija antes de enviar.", em: 1 }]);
    await enviar();
    fireEvent.input(screen.getByLabelText("Título"), { target: { value: "Título corrigido" } });
    expect(screen.getByRole("status", { hidden: true }).hidden).toBe(true);
  });

  it("congelado, os campos não se editam e o botão diz que vai o mesmo conteúdo", () => {
    renderizar([], true);
    expect((screen.getByLabelText("Título") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByRole("button", { name: "Enviar de novo, com o mesmo conteúdo" })).toBeTruthy();
  });
});
