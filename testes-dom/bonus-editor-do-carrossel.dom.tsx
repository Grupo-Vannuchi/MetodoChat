import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { AcaoDaChamada } from "@/lib/bonus/acao-da-chamada";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";

// O EDITOR DO CARROSSEL, SLIDE A SLIDE (spec da Etapa 4): a conta do carrossel, um card por slide e o
// da legenda, o "só texto" de cada slide e o "Baixar todos". Nada usa redirect nem `router.refresh`
// (a lição dos achados 52 e 54: recriar a página apaga o que estava na tela). As actions entram por
// propriedade, e aqui são falsas.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};

afterEach(() => {
  vi.restoreAllMocks();
});

function renderizar({
  slide = [] as AvisoDoSlide[],
  arte = [] as AvisoDaArte[],
  conta = [] as AvisoDaArte[],
  podeFixar = false,
  avisoDaConta = null as string | null,
  palavra = "SUMIDO" as string | null,
  acaoDaChamada = null as AcaoDaChamada | null,
} = {}) {
  const recebidos = { slide: [] as FormData[], arte: [] as FormData[], conta: [] as FormData[] };
  render(
    <EditorDoCarrossel
      acaoDoSlide={async (_a, f) => {
        recebidos.slide.push(f);
        return slide.shift() ?? null;
      }}
      acaoDaArte={async (_a, f) => {
        recebidos.arte.push(f);
        return arte.shift() ?? null;
      }}
      acaoDaConta={async (_a, f) => {
        recebidos.conta.push(f);
        return conta.shift() ?? null;
      }}
      caminho={CAMINHO}
      carrosselId={CARROSSEL}
      palavra={palavra}
      acaoDaChamada={acaoDaChamada}
      total={3}
      campos={camposDoFormulario(3)}
      valores={VALORES}
      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
      avisoDaConta={avisoDaConta}
      podeFixar={podeFixar}
      soTextoInicial={[]}
      versoes={["a1", "b1", "c1"]}
      pausaMs={0}
    />
  );
  return recebidos;
}

const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
const soTexto = (n: number) => screen.getByLabelText(`Slide ${n}: só texto, sem o espaço da imagem`) as HTMLInputElement;
const cards = () => screen.getAllByRole("listitem");

describe("o editor do carrossel, slide a slide", () => {
  // O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): a dica diz a ação, e a chamada que abriu com uma
  // palavra gritada já avisa, pela regra sem palavra.
  it("sem palavra-chave, a dica diz a ação, e a chamada avisa a palavra gritada", () => {
    renderizar({ palavra: null, acaoDaChamada: "salvar" });
    expect(screen.getByText(/Este carrossel não tem palavra-chave: a chamada pede/).textContent).toBe(
      "Este carrossel não tem palavra-chave: a chamada pede salvar o post, e não pode ter palavra em maiúsculas."
    );
    expect(screen.queryByText(/A chamada pede a palavra/)).toBeNull();
    expect(
      screen.getByText("Tem SUMIDO em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada.")
    ).toBeTruthy();
  });

  it("um card por slide, na ordem, e o da legenda por último", () => {
    renderizar();
    expect(cards().map((c) => within(c).getByRole("heading").textContent)).toEqual(["Slide 1", "Slide 2", "Slide 3", "Legenda"]);
    expect([1, 2, 3].map((n) => miniatura(n).getAttribute("src"))).toEqual(
      ["a1", "b1", "c1"].map((v, i) => urlDaArte(CAMINHO, i + 1, v))
    );
  });

  it("a conta do carrossel aparece pelo nome, e não há seletor de conta", () => {
    renderizar();
    expect(screen.getByText("Thiago Vannuchi (@thiagovannuchi)")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("salvar o slide 2 troca só a miniatura 2", async () => {
    renderizar({ slide: [{ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "b2" }] });
    fireEvent.click(within(cards()[1]).getByRole("button", { name: "Editar" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
    });
    expect([1, 2, 3].map((n) => miniatura(n).getAttribute("src"))).toEqual(
      ["a1", "b2", "c1"].map((v, i) => urlDaArte(CAMINHO, i + 1, v))
    );
  });

  it("marcar só texto grava os slides marcados, e a miniatura troca pela versão devolvida", async () => {
    const recebidos = renderizar({ arte: [{ tom: "ok", texto: "Arte salva.", em: 7, versoes: ["a1", "b3", "c1"] }] });
    await act(async () => {
      fireEvent.click(soTexto(2));
    });
    expect(recebidos.arte.map((f) => [f.get("id"), f.getAll("so_texto"), f.get("conta")])).toEqual([[CARROSSEL, ["2"], null]]);
    expect(soTexto(2).checked).toBe(true);
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b3"));
  });

  // A miniatura e o "Baixar" seguem o que está gravado. A caixa e o "não cabe" seguem a tela, e não
  // podem mostrar uma escolha que o servidor recusou (achado 67): voltam para a última aceita.
  it("na recusa, o só texto volta para a última escolha aceita", async () => {
    renderizar({
      arte: [
        { tom: "ok", texto: "Arte salva.", em: 7, versoes: ["a1", "b3", "c1"] },
        { tom: "erro", texto: "Esse slide não existe neste carrossel. Recarregue a página.", em: 9 },
      ],
    });
    await act(async () => {
      fireEvent.click(soTexto(2));
    });
    await act(async () => {
      fireEvent.click(soTexto(1));
    });
    expect(screen.getByText("Esse slide não existe neste carrossel. Recarregue a página.")).toBeTruthy();
    expect([1, 2, 3].map((n) => soTexto(n).checked)).toEqual([false, true, false]);
  });

  it("Fixar nesta conta: aparece com o aviso, grava o id, e some quando fixa", async () => {
    const aviso = 'Este carrossel é de antes de a conta ser gravada. Use "Fixar nesta conta".';
    const recebidos = renderizar({ podeFixar: true, avisoDaConta: aviso, conta: [{ tom: "ok", texto: "Conta fixada neste carrossel.", em: 3 }] });
    expect(screen.getByText(aviso)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fixar nesta conta" }));
    });
    expect(recebidos.conta.map((f) => f.get("id"))).toEqual([CARROSSEL]);
    expect(screen.queryByRole("button", { name: "Fixar nesta conta" })).toBeNull();
    expect(screen.queryByText(aviso)).toBeNull();
    expect(screen.getByText("Conta fixada neste carrossel.")).toBeTruthy();
  });

  it("sem conta a fixar, o botão não aparece", () => {
    renderizar({ podeFixar: false, avisoDaConta: "A conta deste carrossel (@n8x) foi desconectada do Chat." });
    expect(screen.queryByRole("button", { name: "Fixar nesta conta" })).toBeNull();
  });

  it("baixar todos baixa um arquivo por slide, em ordem, com a versão de cada um", async () => {
    renderizar();
    expect(screen.getByText(/pode pedir permissão para baixar vários arquivos/)).toBeTruthy();
    const baixados: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push(`${this.getAttribute("href")}|${this.hasAttribute("download")}`);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Baixar todos" }));
    });
    await waitFor(() => expect(baixados).toHaveLength(3));
    expect(baixados).toEqual(["a1", "b1", "c1"].map((v, i) => `${urlDaArte(CAMINHO, i + 1, v, true)}|true`));
  });
});
