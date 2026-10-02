import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import CardDaParte from "@/app/bonus/[id]/carrossel/[cid]/card-da-parte";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { textoNaoCabeComEspaco } from "@/lib/bonus/arte-textos";
import { camposDaParte, camposDoFormulario, type ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";

// O CARD DE UMA PARTE DO CARROSSEL (spec da Etapa 4): a miniatura do slide e, ao lado, o editor dele,
// que abre no "Editar" e grava só ele no "Salvar slide N". A resposta volta como ESTADO do card
// (achado 52): numa recusa a edição fica, e salvo, a miniatura troca pela versão que a action devolve.
// A action entra por propriedade, e aqui é uma falsa.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
/** Não cabe com a manchete e o espaço da imagem; cabe no só texto (arte-slides). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
const SLIDE_2: ParteDoCarrossel = { tipo: "slide", numero: 2 };

/** O card como o editor o usa: o pai guarda a versão da miniatura e o "só texto". */
function Card({ acao, parte, soTextoInicial = false }: { acao: (a: AvisoDoSlide | null, f: FormData) => Promise<AvisoDoSlide | null>; parte: ParteDoCarrossel; soTextoInicial?: boolean }) {
  const [versao, setVersao] = useState("v1");
  const [soTexto, setSoTexto] = useState(soTextoInicial);
  return (
    <CardDaParte
      acao={acao}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      parte={parte}
      campos={camposDoFormulario(3).filter((c) => camposDaParte(3, parte).includes(c.nome))}
      valores={VALORES}
      versao={parte.tipo === "slide" ? versao : null}
      aoNovaVersao={setVersao}
      soTexto={soTexto}
      aoMudarSoTexto={setSoTexto}
      soTextoPendente={false}
    />
  );
}

function renderizar(respostas: AvisoDoSlide[], parte: ParteDoCarrossel = SLIDE_2) {
  const recebidos: FormData[] = [];
  render(
    <Card
      parte={parte}
      acao={async (_a, f) => {
        recebidos.push(f);
        return respostas.shift() ?? null;
      }}
    />
  );
  return recebidos;
}

const miniatura = () => screen.getByAltText("Slide 2 de 3") as HTMLImageElement;
const texto = () => screen.getByLabelText("Slide 2: texto") as HTMLTextAreaElement;
const editar = () => fireEvent.click(screen.getByRole("button", { name: "Editar" }));
async function salvar(nome = "Salvar slide 2") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nome }));
  });
}

describe("o card de um slide", () => {
  it("mostra a miniatura pela rota da arte, com a versão, e o baixar do slide", () => {
    renderizar([]);
    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1"));
    const baixar = screen.getByRole("link", { name: "Baixar o slide 2" });
    expect(baixar.getAttribute("href")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1", true));
    expect(baixar.hasAttribute("download")).toBe(true);
  });

  it("os campos do slide ficam fechados; o Editar abre só os dele", () => {
    renderizar([]);
    expect(texto().closest("[hidden]")).not.toBeNull();
    editar();
    expect(texto().closest("[hidden]")).toBeNull();
    expect(screen.getByLabelText("Slide 2: título")).toBeTruthy();
    expect(screen.queryByLabelText("Gancho (slide 1)")).toBeNull();
  });

  it("salvar manda o id, a parte e os campos dela", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "v2" }]);
    editar();
    fireEvent.change(texto(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    await salvar();
    expect(recebidos.map((f) => [f.get("id"), f.get("parte"), f.get("slide_1_titulo"), f.get("slide_1_texto")])).toEqual([
      [CARROSSEL, "slide_2", "O que fazer primeiro", "Um texto revisado do slide dois, mais curto."],
    ]);
  });

  it("salvo, a miniatura troca pela versão que a action devolveu, e a edição fica", async () => {
    renderizar([{ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "v2" }]);
    editar();
    fireEvent.change(texto(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    await salvar();
    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v2"));
    expect(texto().value).toBe("Um texto revisado do slide dois, mais curto.");
    expect(screen.getByRole("status").textContent).toBe("Slide 2 salvo.");
  });

  it("numa recusa, a edição fica, o motivo aparece junto do botão, e a miniatura não troca", async () => {
    renderizar([{ tom: "erro", texto: "Corrija antes de salvar. Slide 2: texto: precisa de pelo menos 30 caracteres.", em: 1, versao: null }]);
    editar();
    fireEvent.change(texto(), { target: { value: "curto" } });
    await salvar();
    expect(texto().value).toBe("curto");
    expect(screen.getByRole("status").textContent).toMatch(/precisa de pelo menos 30/);
    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1"));
  });

  it("não salvo aparece ao editar, some ao salvar, e fica na recusa", async () => {
    renderizar([
      { tom: "erro", texto: "Corrija antes de salvar.", em: 1, versao: null },
      { tom: "ok", texto: "Slide 2 salvo.", em: 2, versao: "v2" },
    ]);
    expect(screen.queryByText("não salvo")).toBeNull();
    editar();
    fireEvent.input(texto(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    expect(screen.getByText("não salvo")).toBeTruthy();
    await salvar();
    expect(screen.getByText("não salvo")).toBeTruthy();
    await salvar();
    expect(screen.queryByText("não salvo")).toBeNull();
  });

  it("fechar não apaga o que se digitou", () => {
    renderizar([]);
    editar();
    fireEvent.input(texto(), { target: { value: "Um texto que ainda não foi salvo, e não some." } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    editar();
    expect(texto().value).toBe("Um texto que ainda não foi salvo, e não some.");
    expect(screen.getByText("não salvo")).toBeTruthy();
  });

  it("o não cabe aparece enquanto se digita, junto do campo e embaixo da miniatura", () => {
    renderizar([]);
    editar();
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
    fireEvent.input(texto(), { target: { value: OITO_LINHAS } });
    expect(screen.getAllByText(textoNaoCabeComEspaco(2))).toHaveLength(2);
  });

  it("marcado só texto, o mesmo slide cabe, e o aviso some", () => {
    renderizar([]);
    editar();
    fireEvent.input(texto(), { target: { value: OITO_LINHAS } });
    fireEvent.click(screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem"));
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
  });
});

describe("o card da legenda", () => {
  it("não tem miniatura, e salva a parte legenda", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Legenda salva.", em: 1, versao: null }], { tipo: "legenda" });
    expect(screen.queryByRole("img")).toBeNull();
    editar();
    fireEvent.change(screen.getByLabelText("Legenda do post"), { target: { value: `${VALORES.legenda} E vale para quem sumiu há meses.` } });
    await salvar("Salvar legenda");
    expect(recebidos.map((f) => [f.get("parte"), f.get("legenda")])).toEqual([
      ["legenda", `${VALORES.legenda} E vale para quem sumiu há meses.`],
    ]);
    expect(screen.getByRole("status").textContent).toBe("Legenda salva.");
  });
});
