import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A IMAGEM NO CARD DE CADA SLIDE (spec da Etapa 5, "A página", e o adendo da foto no espaço): os dois
// jeitos, subir e trocar, a miniatura (a imagem guardada no slide pronto, a arte da rota no slide com
// foto), o aviso do texto que mudou (só no slide pronto), e a página travada quando o carrossel está
// na fila. As actions são falsas; o `createImageBitmap`, o canvas e o `fetch` também (o jsdom não tem
// os dois primeiros, e o terceiro sairia para a rede).

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
const IMAGEM = "https://bucket/public/178/bonus/guardada.jpg";
const FOTO = "https://bucket/public/178/bonus-foto/guardada.jpg";

let medidas: { width: number; height: number };
let puts: string[];

beforeEach(() => {
  medidas = { width: 1080, height: 1350 };
  puts = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: medidas.width, height: medidas.height, close: () => {} })));
  // A foto passa sempre pelo canvas (o recorte), que o jsdom não tem.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ fillStyle: "", fillRect: () => {}, drawImage: () => {} }) as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((fn) => fn(new Blob(["jpeg"], { type: "image/jpeg" })));
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
      const prefixo = (p as { destino: string }).destino === "foto" ? "bonus-foto" : "bonus";
      return { ok: true, caminho: `178/${prefixo}/nova.jpg`, url: `https://bucket/sign/178/${prefixo}/nova.jpg?token=t` };
    },
    acaoDaImagem: async (p: unknown) => {
      recebidos.guardar.push(p);
      const caminho = (p as { caminho: string }).caminho;
      const jeito = caminho.includes("/bonus-foto/") ? ("foto" as const) : ("slide" as const);
      return (
        guardar.shift() ?? {
          tom: "ok",
          texto: "Imagem guardada.",
          em: 1,
          versao: "t2",
          imagem: `https://bucket/public/${caminho}`,
          jeito,
          versaoDaMiniatura: `b2-${jeito}`,
        }
      );
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
      caminho={CAMINHO}
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
const subirFoto = (n: number) => screen.getByLabelText(`Slide ${n}: foto para o espaço da arte`) as HTMLInputElement;
const subirPronto = (n: number) => screen.getByLabelText(`Slide ${n}: slide pronto do Canva`) as HTMLInputElement;
const arquivo = () => new File(["x"], "slide.jpg", { type: "image/jpeg" });

describe("a imagem no card", () => {
  it("o slide com espaço tem os dois jeitos; o com slide pronto o mostra; o só texto não tem upload", () => {
    renderizar({ publicacao: { imagens: { 3: { url: IMAGEM, versao: "t3", jeito: "slide" } } } });
    expect(within(card(2)).getByText("Subir foto")).toBeTruthy();
    expect(within(card(2)).getByText("Slide pronto do Canva")).toBeTruthy();
    expect(within(card(3)).getByText("Subir foto")).toBeTruthy();
    expect(within(card(3)).getByText("Trocar slide pronto")).toBeTruthy();
    expect(miniatura(3).getAttribute("src")).toBe(IMAGEM);
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
    expect(screen.queryByLabelText("Slide 1: foto para o espaço da arte")).toBeNull();
    expect(screen.queryByLabelText("Slide 1: slide pronto do Canva")).toBeNull();
    expect(miniatura(1).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "a1"));
  });

  // A miniatura do slide com foto é a própria arte da rota, com a foto no espaço, e não a foto do bucket.
  it("com foto: o Trocar foto, e a miniatura é a arte da rota", () => {
    renderizar({ publicacao: { imagens: { 2: { url: FOTO, versao: "t2", jeito: "foto" } } } });
    expect(within(card(2)).getByText("Trocar foto")).toBeTruthy();
    expect(within(card(2)).getByText("Slide pronto do Canva")).toBeTruthy();
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
  });

  // Pedido do Eduardo na prova de 07/10: os três botões da imagem numa linha só, embaixo do card, na
  // ordem foto, slide pronto e "Baixar". Até ali, a foto ficava ao lado do "Baixar" e o slide pronto
  // embaixo, na coluna de 224px da miniatura (pedido de 05/10), e o card ficava alto.
  it("os três botões da imagem ficam numa linha só, na ordem foto, slide pronto e Baixar", () => {
    renderizar({ publicacao: { imagens: { 3: { url: FOTO, versao: "t3", jeito: "foto" } } } });
    for (const [n, rotulo] of [
      [2, "Subir foto"],
      [3, "Trocar foto"],
    ] as const) {
      const foto = within(card(n)).getByText(rotulo).closest("label");
      const pronto = within(card(n)).getByText("Slide pronto do Canva").closest("label");
      const baixar = within(card(n)).getByRole("link", { name: `Baixar o slide ${n}` });
      expect(baixar.textContent).toBe("Baixar");
      expect([...(baixar.parentElement?.children ?? [])].slice(0, 3)).toEqual([foto, pronto, baixar]);
    }
  });

  it("subir o slide pronto: assina com as medidas, sobe pelo PUT, guarda, e a miniatura passa a ser a imagem guardada", async () => {
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subirPronto(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([
      { id: CARROSSEL, numero: 2, destino: "slide", arquivo: { nome: "slide-2.jpg", mime: "image/jpeg", bytes: 1, largura: 1080, altura: 1350 } },
    ]);
    expect(puts).toEqual(["https://bucket/sign/178/bonus/nova.jpg?token=t"]);
    expect(recebidos.guardar).toEqual([{ id: CARROSSEL, numero: 2, caminho: "178/bonus/nova.jpg" }]);
    expect(miniatura(2).getAttribute("src")).toBe("https://bucket/public/178/bonus/nova.jpg");
    expect(within(card(2)).getByText("Imagem guardada.")).toBeTruthy();
    expect(within(card(2)).getByText("Trocar slide pronto")).toBeTruthy();
    // O aviso do upload fica na linha dos botões (prova de 07/10), e não solto embaixo deles.
    expect(within(card(2)).getByText("Imagem guardada.").parentElement).toBe(
      within(card(2)).getByRole("link", { name: "Baixar o slide 2" }).parentElement
    );
  });

  it("subir a foto: recorta, assina no destino da foto, guarda, e a miniatura é a arte com a versão nova", async () => {
    medidas = { width: 1720, height: 1146 };
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subirFoto(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([
      { id: CARROSSEL, numero: 2, destino: "foto", arquivo: { nome: "foto-2.jpg", mime: "image/jpeg", bytes: 4, largura: 1720, altura: 1146 } },
    ]);
    expect(recebidos.guardar).toEqual([{ id: CARROSSEL, numero: 2, caminho: "178/bonus-foto/nova.jpg" }]);
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b2-foto"));
    expect(within(card(2)).getByText("Trocar foto")).toBeTruthy();
    expect(within(card(2)).getByText("Slide pronto do Canva")).toBeTruthy();
  });

  // Subir um jeito troca o outro: o servidor apaga a anterior, e o card mostra o jeito novo.
  it("trocar a foto pelo slide pronto troca o card inteiro", async () => {
    renderizar({ publicacao: { imagens: { 2: { url: FOTO, versao: "t2", jeito: "foto" } } } });
    await act(async () => {
      fireEvent.change(subirPronto(2), { target: { files: [arquivo()] } });
    });
    expect(within(card(2)).getByText("Subir foto")).toBeTruthy();
    expect(within(card(2)).getByText("Trocar slide pronto")).toBeTruthy();
    expect(miniatura(2).getAttribute("src")).toBe("https://bucket/public/178/bonus/nova.jpg");
  });

  it("o slide pronto que não é 4:5 é recusado no card, sem pedir assinatura", async () => {
    medidas = { width: 1080, height: 1080 };
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subirPronto(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([]);
    expect(within(card(2)).getByText("A imagem do slide tem de ser 4:5, como a arte (1080×1350).")).toBeTruthy();
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
  });

  it("a foto pequena é recusada no card, sem pedir assinatura", async () => {
    medidas = { width: 800, height: 600 };
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subirFoto(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([]);
    expect(within(card(2)).getByText("A foto é pequena para o espaço da arte: o mínimo é 860×573.")).toBeTruthy();
  });

  it("o texto que mudou depois do slide pronto tem aviso, e ele some com a imagem nova", async () => {
    renderizar({ publicacao: { imagens: { 2: { url: IMAGEM, versao: "velha", jeito: "slide" } } } });
    expect(within(card(2)).getByText("O texto mudou depois desta imagem.")).toBeTruthy();
    await act(async () => {
      fireEvent.change(subirPronto(2), { target: { files: [arquivo()] } });
    });
    expect(within(card(2)).queryByText("O texto mudou depois desta imagem.")).toBeNull();
  });

  // Com a foto no espaço, a arte se redesenha com o texto novo: não há o que avisar.
  it("com foto, o texto que mudou não tem aviso", () => {
    renderizar({ publicacao: { imagens: { 2: { url: FOTO, versao: "velha", jeito: "foto" } } } });
    expect(within(card(2)).queryByText("O texto mudou depois desta imagem.")).toBeNull();
  });

  it("salvar o texto de um slide com slide pronto traz a versão nova do texto, e o aviso aparece", async () => {
    renderizar({
      publicacao: { imagens: { 2: { url: IMAGEM, versao: "t2", jeito: "slide" } } },
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
    renderizar({ publicacao: { imagens: { 2: { url: IMAGEM, versao: "t2", jeito: "slide" } } }, soTexto: [2] });
    expect(screen.queryByLabelText("Slide 2: foto para o espaço da arte")).toBeNull();
    expect(screen.queryByLabelText("Slide 2: slide pronto do Canva")).toBeNull();
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
  });
});

describe("a página travada", () => {
  it("com o carrossel na fila: o aviso no topo, sem Editar, sem upload, e o só texto desligado", () => {
    renderizar({ publicacao: { travado: "Agendado: para mudar, cancele no calendário." } });
    expect(screen.getByText("Agendado: para mudar, cancele no calendário.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByLabelText("Slide 2: foto para o espaço da arte")).toBeNull();
    expect(screen.queryByLabelText("Slide 2: slide pronto do Canva")).toBeNull();
    expect((screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem") as HTMLInputElement).disabled).toBe(true);
  });
});
