import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import { textoNaoCabeComEspaco } from "@/lib/bonus/arte-textos";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";

// O EDITOR E A ARTE NUM COMPONENTE SÓ (spec da Etapa 3): o aviso "não cabe" acompanha o que se
// digita, e a miniatura troca depois de "Revisão salva.", sem redirect nem `router.refresh` (a
// lição dos achados 52 e 54: recriar a página apaga o que estava na tela).

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
/** Cabe sozinho, e não cabe com a manchete e o espaço da imagem (arte-slides). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");

function renderizar({ revisao = [] as AvisoDaRevisao[], arte = [] as AvisoDaArte[] } = {}) {
  render(
    <EditorDoCarrossel
      acaoDaRevisao={async () => revisao.shift() ?? null}
      acaoDaArte={async () => arte.shift() ?? null}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      campos={camposDoFormulario(3)}
      valores={VALORES}
      contas={[{ id: "1001", rotulo: "Thiago Vannuchi (@thiagovannuchi)" }]}
      contaInicial="1001"
      avisoDaConta={null}
      soTextoInicial={[]}
      versaoBase="abcd1234"
    />
  );
}

const textoDoSlide2 = () => screen.getByLabelText("Slide 2: texto") as HTMLTextAreaElement;
const miniatura2 = () => screen.getByAltText("Slide 2 de 3") as HTMLImageElement;

describe("o editor do carrossel", () => {
  it("o não cabe aparece enquanto se digita, junto do campo e embaixo da miniatura", () => {
    renderizar();
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
    fireEvent.input(textoDoSlide2(), { target: { value: OITO_LINHAS } });
    expect(screen.getAllByText(textoNaoCabeComEspaco(2))).toHaveLength(2);
  });

  it("marcado só texto, o mesmo slide cabe, e o aviso some", async () => {
    renderizar({ arte: [{ tom: "ok", texto: "Arte salva.", em: 5 }] });
    fireEvent.input(textoDoSlide2(), { target: { value: OITO_LINHAS } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem"));
    });
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
  });

  it("depois de Revisão salva., as miniaturas trocam de versão, sem a página ser recriada", async () => {
    renderizar({ revisao: [{ tom: "ok", texto: "Revisão salva.", em: 42 }] });
    const antes = miniatura2().getAttribute("src");
    fireEvent.input(textoDoSlide2(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
    });
    expect(miniatura2().getAttribute("src")).not.toBe(antes);
    expect(miniatura2().getAttribute("src")).toContain("v=abcd1234-42-0");
    expect(textoDoSlide2().value).toBe("Um texto revisado do slide dois, mais curto.");
  });

  it("a recusa da revisão não troca a miniatura", async () => {
    renderizar({ revisao: [{ tom: "erro", texto: "Corrija antes de salvar.", em: 43 }] });
    const antes = miniatura2().getAttribute("src");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
    });
    expect(miniatura2().getAttribute("src")).toBe(antes);
  });
});
