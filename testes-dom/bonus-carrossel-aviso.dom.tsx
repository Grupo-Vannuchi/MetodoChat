import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
import Campo from "@/app/bonus/[id]/carrossel/[cid]/campo";

// O RESULTADO DO "SALVAR REVISÃO" JUNTO DO BOTÃO (decisão do Eduardo, 01/10). Na prova real de
// 30/09 o aviso só aparecia no topo, longe do botão, e o verde "Revisão salva." continuava na
// tela enquanto se editava de novo: um salvamento antigo parecia novo. Aqui ele some no
// primeiro caractere digitado no formulário.

function renderizar(tom: "ok" | "erro", texto: string) {
  render(
    <form>
      <Campo nome="gancho" rotulo="Gancho (slide 1)" valorInicial="O gancho salvo." max={120} linhas={2} />
      <AvisoDoFormulario aviso={{ tom, texto }} />
      <button type="submit">Salvar revisão</button>
    </form>
  );
}

describe("o aviso junto do botão de salvar", () => {
  it("mostra o resultado do salvamento", () => {
    renderizar("ok", "Revisão salva.");
    expect(screen.getByText("Revisão salva.").hidden).toBe(false);
  });

  it("some quando se volta a editar, para um salvamento antigo não parecer novo", () => {
    renderizar("ok", "Revisão salva.");
    fireEvent.input(screen.getByLabelText("Gancho (slide 1)"), { target: { value: "O gancho editado de novo." } });
    expect(screen.getByText("Revisão salva.").hidden).toBe(true);
  });

  it("a recusa também some quando se corrige o campo", () => {
    renderizar("erro", "Corrija antes de salvar. Chamada (slide 3): precisa pedir a palavra SUMIDO.");
    expect(screen.getByText(/Corrija antes de salvar/).hidden).toBe(false);
    fireEvent.input(screen.getByLabelText("Gancho (slide 1)"), { target: { value: "Outro gancho." } });
    expect(screen.getByText(/Corrija antes de salvar/).hidden).toBe(true);
  });
});
