import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormularioDaRevisao from "@/app/bonus/[id]/carrossel/[cid]/formulario-da-revisao";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";

// O FORMULÁRIO DA REVISÃO DO CARROSSEL (achado 52, causa medida em 01/10 num navegador de
// verdade): todo redirect de Server Action recria a página no Next 16, e o que o operador tinha
// digitado sumia, voltando o texto com que a página abriu. A resposta do "Salvar revisão" agora
// volta como ESTADO do formulário (useActionState), sem redirect, e aparece junto do botão.
// A action entra por propriedade, e aqui é uma falsa que só guarda o que recebeu.

const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "Título do slide 1",
  slide_1_texto: "Texto do slide 1, com mais de trinta caracteres.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};

function renderizar(respostas: AvisoDaRevisao[]) {
  const recebidos: FormData[] = [];
  const acao = async (_anterior: AvisoDaRevisao | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(
    <FormularioDaRevisao
      acao={acao}
      carrosselId="1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d"
      palavra="SUMIDO"
      campos={camposDoFormulario(3)}
      valores={VALORES}
    />
  );
  return recebidos;
}

const chamada = () => screen.getByLabelText("Chamada (slide 3)") as HTMLTextAreaElement;

async function salvar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
  });
}

describe("o formulário da revisão do carrossel", () => {
  it("numa recusa, a edição fica na tela e o motivo aparece junto do botão", async () => {
    const recebidos = renderizar([{ tom: "erro", texto: "Corrija antes de salvar. Chamada (slide 3): precisa pedir a palavra SUMIDO.", em: 1 }]);
    fireEvent.change(chamada(), { target: { value: "Comente e receba as mensagens prontas." } });
    await salvar();
    expect(recebidos.map((f) => [f.get("id"), f.get("chamada")])).toEqual([
      ["1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d", "Comente e receba as mensagens prontas."],
    ]);
    expect(chamada().value).toBe("Comente e receba as mensagens prontas.");
    expect(screen.getByRole("status").textContent).toMatch(/precisa pedir a palavra SUMIDO/);
  });

  it("o aviso some quando se volta a editar", async () => {
    renderizar([{ tom: "erro", texto: "Corrija antes de salvar.", em: 1 }]);
    await salvar();
    expect(screen.getByRole("status").hidden).toBe(false);
    fireEvent.input(chamada(), { target: { value: "Comente SUMIDO de novo e receba." } });
    expect(screen.getByRole("status", { hidden: true }).hidden).toBe(true);
  });

  it("dois salvamentos com a mesma mensagem mostram o aviso as duas vezes", async () => {
    renderizar([
      { tom: "ok", texto: "Revisão salva.", em: 1 },
      { tom: "ok", texto: "Revisão salva.", em: 2 },
    ]);
    await salvar();
    fireEvent.input(chamada(), { target: { value: "Comente SUMIDO agora e receba." } });
    expect(screen.getByRole("status", { hidden: true }).hidden).toBe(true);
    await salvar();
    expect(screen.getByRole("status").hidden).toBe(false);
  });

  it("liga os avisos de palavra: a falta na chamada e na legenda, a palavra a mais só na chamada", () => {
    renderizar([]);
    fireEvent.change(chamada(), { target: { value: "Comente SUMIDO ou GUIA e receba." } });
    expect(screen.getByText("Pede também GUIA: deixe só a palavra SUMIDO.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Legenda do post"), { target: { value: "Uma legenda longa que esqueceu a palavra." } });
    expect(screen.getByText(/Falta a palavra SUMIDO/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Gancho (slide 1)"), { target: { value: "Um gancho sem palavra nenhuma." } });
    expect(screen.getAllByText(/Falta a palavra SUMIDO/)).toHaveLength(1);
  });
});
