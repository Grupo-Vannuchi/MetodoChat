import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A IMAGEM DO CANVA NO CARD DE CADA SLIDE (spec da Etapa 5, "A página"): subir, trocar, a miniatura
// passando a ser a imagem guardada, o aviso do texto que mudou, e a página travada quando o carrossel
// está na fila. As actions são falsas; o `createImageBitmap` e o `fetch` também (o jsdom não tem o
// primeiro, e o segundo sairia para a rede).

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
const IMAGEM = "https://bucket/public/178/bonus/guardada.jpg";

let medidas: { width: number; height: number };
let puts: string[];

beforeEach(() => {
  medidas = { width: 1080, height: 1350 };
  puts = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: medidas.width, height: medidas.height, close: () => {} })));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      puts.push(url);
      return new Response("{}", { status: 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderizar({
  publicacao = {} as Partial<PublicacaoNaTela>,
  slide = [] as AvisoDoSlide[],
  guardar = [] as AvisoDaImagem[],
  soTexto = [1] as number[],
} = {}) {
  const recebidos = { assinar: [] as unknown[], guardar: [] as unknown[] };
  const completa: PublicacaoNaTela = {
    acaoDaAssinatura: async (p: unknown): Promise<RespostaDaAssinatura> => {
      recebidos.assinar.push(p);
      return { ok: true, caminho: "178/bonus/nova.jpg", url: "https://bucket/sign/178/bonus/nova.jpg?token=t" };
    },
    acaoDaImagem: async (p: unknown) => {
      recebidos.guardar.push(p);
      return guardar.shift() ?? { tom: "ok", texto: "Imagem guardada.", em: 1, versao: "t2", imagem: "https://bucket/public/178/bonus/nova.jpg" };
    },
    acaoDaPublicacao: async () => ({ tom: "ok", texto: "Na fila.", em: 1 }),
    imagens: {},
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    ...publicacao,
  };
  render(
    <EditorDoCarrossel
      acaoDoSlide={async () => slide.shift() ?? null}
      acaoDaArte={async () => null}
      acaoDaConta={async () => null}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      campos={camposDoFormulario(3)}
      valores={VALORES}
      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
      avisoDaConta={null}
      podeFixar={false}
      soTextoInicial={soTexto}
      versoes={["a1", "b1", "c1"]}
      pausaMs={0}
      publicacao={completa}
    />
  );
  return recebidos;
}

const card = (n: number) => screen.getAllByRole("listitem")[n - 1];
const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
const subir = (n: number) => screen.getByLabelText(`Slide ${n}: imagem do Canva`) as HTMLInputElement;
const arquivo = () => new File(["x"], "slide.jpg", { type: "image/jpeg" });

describe("a imagem do Canva no card", () => {
  it("o slide com espaço pede a imagem; o com imagem a mostra; o só texto não tem upload", () => {
    renderizar({ publicacao: { imagens: { 3: { url: IMAGEM, versao: "t3" } } } });
    expect(within(card(2)).getByText("Subir imagem do Canva")).toBeTruthy();
    expect(within(card(3)).getByText("Trocar imagem")).toBeTruthy();
    expect(miniatura(3).getAttribute("src")).toBe(IMAGEM);
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
    expect(screen.queryByLabelText("Slide 1: imagem do Canva")).toBeNull();
    expect(miniatura(1).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 1, "a1"));
  });

  it("subir: assina com as medidas, sobe pelo PUT, guarda, e a miniatura passa a ser a imagem guardada", async () => {
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subir(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([
      { id: CARROSSEL, numero: 2, destino: "slide", arquivo: { nome: "slide-2.jpg", mime: "image/jpeg", bytes: 1, largura: 1080, altura: 1350 } },
    ]);
    expect(puts).toEqual(["https://bucket/sign/178/bonus/nova.jpg?token=t"]);
    expect(recebidos.guardar).toEqual([{ id: CARROSSEL, numero: 2, caminho: "178/bonus/nova.jpg" }]);
    expect(miniatura(2).getAttribute("src")).toBe("https://bucket/public/178/bonus/nova.jpg");
    expect(within(card(2)).getByText("Imagem guardada.")).toBeTruthy();
    expect(within(card(2)).getByText("Trocar imagem")).toBeTruthy();
  });

  it("a imagem que não é 4:5 é recusada no card, sem pedir assinatura", async () => {
    medidas = { width: 1080, height: 1080 };
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subir(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([]);
    expect(within(card(2)).getByText("A imagem do slide tem de ser 4:5, como a arte (1080×1350).")).toBeTruthy();
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
  });

  it("o texto que mudou depois da imagem tem aviso, e ele some com a imagem nova", async () => {
    renderizar({ publicacao: { imagens: { 2: { url: IMAGEM, versao: "velha" } } } });
    expect(within(card(2)).getByText("O texto mudou depois desta imagem.")).toBeTruthy();
    await act(async () => {
      fireEvent.change(subir(2), { target: { files: [arquivo()] } });
    });
    expect(within(card(2)).queryByText("O texto mudou depois desta imagem.")).toBeNull();
  });

  it("salvar o texto de um slide com imagem traz a versão nova do texto, e o aviso aparece", async () => {
    renderizar({
      publicacao: { imagens: { 2: { url: IMAGEM, versao: "t2" } } },
      slide: [{ tom: "ok", texto: "Slide 2 salvo.", em: 2, versao: "b2", versaoDoTexto: "t2-novo" }],
    });
    expect(within(card(2)).queryByText("O texto mudou depois desta imagem.")).toBeNull();
    fireEvent.click(within(card(2)).getByRole("button", { name: "Editar" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
    });
    expect(within(card(2)).getByText("O texto mudou depois desta imagem.")).toBeTruthy();
  });

  it("marcado só texto, o slide sai com a arte do Chat: sem upload e sem a imagem guardada", () => {
    renderizar({ publicacao: { imagens: { 2: { url: IMAGEM, versao: "t2" } } }, soTexto: [2] });
    expect(screen.queryByLabelText("Slide 2: imagem do Canva")).toBeNull();
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
  });
});

describe("a página travada", () => {
  it("com o carrossel na fila: o aviso no topo, sem Editar, sem upload, e o só texto desligado", () => {
    renderizar({ publicacao: { travado: "Agendado: para mudar, cancele no calendário." } });
    expect(screen.getByText("Agendado: para mudar, cancele no calendário.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByLabelText("Slide 2: imagem do Canva")).toBeNull();
    expect((screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem") as HTMLInputElement).disabled).toBe(true);
  });
});
