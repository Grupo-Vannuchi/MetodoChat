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

  // ACHADO 52 (01/10): depois que a action do formulário termina, o React 19 reinicia o
  // formulário, e um campo não controlado volta ao texto com que a página abriu. Numa recusa,
  // a edição sumia da tela, e o clique seguinte gravava o texto velho como "Revisão salva."
  // (medido na prova real, com o servidor recebendo o texto original no segundo clique).
  it("a edição continua no campo depois que a action do formulário termina", async () => {
    const recebidos: unknown[] = [];
    render(
      <form
        action={async (f: FormData) => {
          recebidos.push(f.get("chamada"));
        }}
      >
        <Campo nome="chamada" rotulo="Chamada (slide 3)" valorInicial="Comente SUMIDO e receba." max={200} linhas={3} />
        <button type="submit">Salvar revisão</button>
      </form>
    );
    const campo = screen.getByLabelText("Chamada (slide 3)") as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: "Comente e receba." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
    });
    expect(recebidos).toEqual(["Comente e receba."]);
    expect(campo.value).toBe("Comente e receba.");
    expect(screen.getByText("17 de 200 caracteres")).toBeTruthy();
  });

  // ACHADO 53 (01/10): o "Copiar" leva o texto como está, e a conferência da palavra só acontecia
  // no "Salvar revisão". Decisão do Eduardo: copiar continua, mas o campo avisa NA HORA quando a
  // palavra some da chamada ou da legenda.
  it("avisa na hora quando a palavra some, e o copiar continua", async () => {
    render(
      <Campo
        nome="chamada"
        rotulo="Chamada (slide 3)"
        valorInicial="Comente SUMIDO e receba."
        max={200}
        linhas={3}
        palavra="SUMIDO"
      />
    );
    expect(screen.queryByText(/Falta a palavra SUMIDO/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Chamada (slide 3)"), { target: { value: "Comente SUMIDOS e receba." } });
    expect(screen.getByText(/Falta a palavra SUMIDO/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    });
    expect(escrever).toHaveBeenCalledWith("Comente SUMIDOS e receba.");
    fireEvent.change(screen.getByLabelText("Chamada (slide 3)"), { target: { value: "Comente SUMIDO, agora." } });
    expect(screen.queryByText(/Falta a palavra SUMIDO/)).toBeNull();
  });

  it("abre já avisando quando o texto salvo está sem a palavra", () => {
    render(
      <Campo
        nome="legenda"
        rotulo="Legenda do post"
        valorInicial="Uma legenda que esqueceu de pedir a palavra."
        max={900}
        linhas={8}
        palavra="SUMIDO"
      />
    );
    expect(screen.getByText(/Falta a palavra SUMIDO/)).toBeTruthy();
  });

  it("campo que não pede a palavra nunca avisa", () => {
    render(<Campo nome="gancho" rotulo="Gancho (slide 1)" valorInicial="Sem palavra nenhuma." max={120} linhas={2} />);
    expect(screen.queryByText(/Falta a palavra/)).toBeNull();
  });

  it("a contagem acompanha o que se digita", () => {
    render(<Campo nome="chamada" rotulo="Chamada (slide 5)" valorInicial="" max={200} linhas={3} />);
    fireEvent.change(screen.getByLabelText("Chamada (slide 5)"), { target: { value: "abcdef" } });
    expect(screen.getByText("6 de 200 caracteres")).toBeTruthy();
  });
});
