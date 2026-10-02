import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArteDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/arte-do-carrossel";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";

// A SEÇÃO DA ARTE (spec da Etapa 3, "As telas"): a conta do cabeçalho, as miniaturas com o "só
// texto" e o "Baixar" de cada slide, e o "Baixar todos". As escolhas se gravam na hora, pela
// action, e a resposta volta como ESTADO (nunca redirect: achado 52). A action entra por
// propriedade, e aqui é uma falsa.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const CONTAS = [
  { id: "1001", rotulo: "Thiago Vannuchi (@thiagovannuchi)" },
  { id: "1002", rotulo: "@outraconta" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

/** A seção como a página a usa: o pai guarda a conta e o "só texto". */
function Secao({
  acao,
  avisos = {},
  avisoDaConta = null,
}: {
  acao: (a: AvisoDaArte | null, f: FormData) => Promise<AvisoDaArte | null>;
  avisos?: Record<number, string>;
  avisoDaConta?: string | null;
}) {
  const [conta, setConta] = useState<string | null>("1001");
  const [soTexto, setSoTexto] = useState<number[]>([]);
  return (
    <ArteDoCarrossel
      acao={acao}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      total={3}
      contas={CONTAS}
      conta={conta}
      aoMudarConta={setConta}
      soTexto={soTexto}
      aoMudarSoTexto={setSoTexto}
      avisoDaConta={avisoDaConta}
      avisos={avisos}
      versaoBase="abcd1234-0"
      pausaMs={0}
    />
  );
}

function renderizar(respostas: AvisoDaArte[], extra: { avisos?: Record<number, string>; avisoDaConta?: string | null } = {}) {
  const recebidos: FormData[] = [];
  const acao = async (_a: AvisoDaArte | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(<Secao acao={acao} {...extra} />);
  return recebidos;
}

const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
const soTexto = (n: number) => screen.getByLabelText(`Slide ${n}: só texto, sem o espaço da imagem`) as HTMLInputElement;
const caminhoDe = (img: HTMLImageElement) => img.getAttribute("src");

describe("a seção da arte", () => {
  it("mostra cada slide pela rota da arte, com a versão, e um baixar por slide", () => {
    renderizar([]);
    for (const n of [1, 2, 3]) {
      expect(caminhoDe(miniatura(n))).toBe(`${urlDaArte(BONUS, CARROSSEL, n, "abcd1234-0")}-0`);
      const baixar = screen.getByRole("link", { name: `Baixar o slide ${n}` });
      expect(baixar.getAttribute("href")).toBe(`${urlDaArte(BONUS, CARROSSEL, n, "abcd1234-0")}-0&baixar=1`);
      expect(baixar.hasAttribute("download")).toBe(true);
    }
  });

  it("marcar só texto grava na hora a conta e os slides marcados", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Arte salva.", em: 7 }]);
    await act(async () => {
      fireEvent.click(soTexto(2));
    });
    expect(recebidos.map((f) => [f.get("id"), f.get("conta"), f.getAll("so_texto")])).toEqual([[CARROSSEL, "1001", ["2"]]]);
    expect(soTexto(2).checked).toBe(true);
  });

  it("depois de gravar, as miniaturas trocam de versão e são pedidas de novo", async () => {
    renderizar([{ tom: "ok", texto: "Arte salva.", em: 7 }]);
    const antes = caminhoDe(miniatura(1));
    await act(async () => {
      fireEvent.click(soTexto(2));
    });
    expect(caminhoDe(miniatura(1))).not.toBe(antes);
    expect(caminhoDe(miniatura(1))).toContain("abcd1234-0-7");
  });

  it("trocar a conta grava a conta nova", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Arte salva.", em: 8 }]);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Conta do cabeçalho"), { target: { value: "1002" } });
    });
    expect(recebidos.map((f) => f.get("conta"))).toEqual(["1002"]);
  });

  it("a recusa aparece na seção, e a miniatura não troca", async () => {
    renderizar([{ tom: "erro", texto: "Essa conta não está conectada no Chat.", em: 9 }]);
    const antes = caminhoDe(miniatura(1));
    await act(async () => {
      fireEvent.click(soTexto(1));
    });
    expect(screen.getByRole("status").textContent).toBe("Essa conta não está conectada no Chat.");
    expect(caminhoDe(miniatura(1))).toBe(antes);
  });

  // A miniatura e o "Baixar" seguem o que está gravado. A caixa, o seletor e o "não cabe" seguem a
  // tela, e não podem mostrar uma escolha que o servidor recusou (achado 67): voltam para a última
  // aceita.
  it("na recusa, o só texto volta para a última escolha gravada", async () => {
    renderizar([
      { tom: "ok", texto: "Arte salva.", em: 7 },
      { tom: "erro", texto: "Esse slide não existe neste carrossel. Recarregue a página.", em: 9 },
    ]);
    await act(async () => {
      fireEvent.click(soTexto(2));
    });
    await act(async () => {
      fireEvent.click(soTexto(1));
    });
    expect(screen.getByRole("status").textContent).toBe("Esse slide não existe neste carrossel. Recarregue a página.");
    expect([1, 2, 3].map((n) => soTexto(n).checked)).toEqual([false, true, false]);
  });

  it("na recusa, o seletor volta para a conta que estava", async () => {
    renderizar([{ tom: "erro", texto: "Essa conta não está conectada no Chat.", em: 9 }]);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Conta do cabeçalho"), { target: { value: "1002" } });
    });
    expect(screen.getByRole("status").textContent).toBe("Essa conta não está conectada no Chat.");
    expect((screen.getByLabelText("Conta do cabeçalho") as HTMLSelectElement).value).toBe("1001");
  });

  it("o aviso de cabimento aparece embaixo do slide dele, e o da conta embaixo do seletor", () => {
    renderizar([], {
      avisos: { 2: "O slide 2 não cabe com o espaço da imagem." },
      avisoDaConta: "A arte usa a conta selecionada no Chat agora (@thiagovannuchi).",
    });
    expect(screen.getByText("O slide 2 não cabe com o espaço da imagem.")).toBeTruthy();
    expect(screen.getByText("A arte usa a conta selecionada no Chat agora (@thiagovannuchi).")).toBeTruthy();
  });

  it("baixar todos baixa um arquivo por slide, em ordem, com o aviso de permissão antes", async () => {
    renderizar([]);
    expect(screen.getByText(/pode pedir permissão para baixar vários arquivos/)).toBeTruthy();
    const baixados: { href: string; download: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push({ href: this.getAttribute("href") ?? "", download: this.hasAttribute("download") });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Baixar todos" }));
    });
    // Um download por vez, com uma pausa entre eles: espera o último.
    await waitFor(() => expect(baixados).toHaveLength(3));
    expect(baixados).toEqual(
      [1, 2, 3].map((n) => ({ href: `${urlDaArte(BONUS, CARROSSEL, n, "abcd1234-0")}-0&baixar=1`, download: true }))
    );
  });
});
