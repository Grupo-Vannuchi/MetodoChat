import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A CAPA NA TELA (spec da Etapa 11, "A tela"): a caixa "Capa com imagem" só no slide 1 do carrossel de 2
// slides ou mais; ligar a capa tira o "Só texto" do slide 1, e o "Só texto" nele desliga a capa, gravados
// juntos e devolvidos juntos na recusa; com a capa, os botões da imagem são os da capa, a miniatura é a arte
// da capa, o aviso é o do gancho que não cabe nela, e o "Publicar" trava sem a imagem da capa. As actions
// são falsas; o `createImageBitmap`, o canvas e o `fetch` também.

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
const CAPA = "https://bucket/public/178/bonus-capa/guardada.jpg";
const PRONTO = "https://bucket/public/178/bonus/guardada.jpg";

let puts: string[];

beforeEach(() => {
  puts = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1080, height: 1350, close: () => {} })));
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
  total = 3,
  valores = VALORES as Record<string, string>,
  soTexto = [] as number[],
  capa = false,
  imagens = {} as PublicacaoNaTela["imagens"],
  arte = [] as AvisoDaArte[],
  gerando = [] as number[],
} = {}) {
  const recebidos = { arte: [] as FormData[], assinar: [] as unknown[] };
  const publicacao: PublicacaoNaTela = {
    acaoDaAssinatura: async (p: unknown): Promise<RespostaDaAssinatura> => {
      recebidos.assinar.push(p);
      return { ok: true, caminho: "178/bonus-capa/nova.jpg", url: "https://bucket/sign/178/bonus-capa/nova.jpg?token=t" };
    },
    acaoDaImagem: async (): Promise<AvisoDaImagem> => ({
      tom: "ok",
      texto: "Imagem guardada.",
      em: 1,
      versao: "t1",
      imagem: "https://bucket/public/178/bonus-capa/nova.jpg",
      jeito: "capa",
      versaoDaMiniatura: "a2-capa",
    }),
    acaoDaPublicacao: async () => ({ tom: "ok", texto: "Na fila.", em: 1 }),
    imagens,
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    imagemGerada: { acaoDoPedido: async () => ({ tom: "ok", texto: "Gerando.", em: 1, hoje: 1 }), hoje: 0, descricoes: {}, gerando },
  };
  render(
    <EditorDoCarrossel
      acaoDoSlide={async () => null}
      acaoDaArte={async (_a, f) => {
        recebidos.arte.push(f);
        return arte.shift() ?? null;
      }}
      acaoDaConta={async () => null}
      caminho={CAMINHO}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={total}
      campos={camposDoFormulario(total)}
      valores={valores}
      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
      avisoDaConta={null}
      podeFixar={false}
      soTextoInicial={soTexto}
      capaInicial={capa}
      versoes={Array.from({ length: total }, (_, i) => `v${i + 1}`)}
      pausaMs={0}
      intervaloDaConsultaMs={1}
      publicacao={publicacao}
    />
  );
  return recebidos;
}

const NOME_DA_CAPA = (n: number) => `Slide ${n}: capa com imagem, a imagem no slide inteiro e o gancho grande por cima`;
const caixaDaCapa = () => screen.getByLabelText(NOME_DA_CAPA(1)) as HTMLInputElement;
const soTexto1 = () => screen.getByLabelText("Slide 1: só texto, sem o espaço da imagem") as HTMLInputElement;
const card = (n: number) => screen.getAllByRole("listitem")[n - 1];
const ok = (versoes: string[]): AvisoDaArte => ({ tom: "ok", texto: "Arte salva.", em: 1, versoes });

describe("a caixa da capa", () => {
  it("só no slide 1 do carrossel", () => {
    renderizar();
    expect(caixaDaCapa().checked).toBe(false);
    expect(screen.queryByLabelText(NOME_DA_CAPA(2))).toBeNull();
    expect(screen.queryByLabelText(NOME_DA_CAPA(3))).toBeNull();
  });

  it("o post de uma imagem só não tem a capa (achado 98)", () => {
    renderizar({
      total: 1,
      valores: { texto: "Quem sumiu ainda pode voltar, se a mensagem certa chegar na hora certa.", chamada: "Comente SUMIDO.", legenda: VALORES.legenda },
    });
    expect(screen.queryByLabelText(NOME_DA_CAPA(1))).toBeNull();
  });

  it("ligar a capa grava a capa junto do só texto, e tira o Só texto do slide 1", async () => {
    const recebidos = renderizar({ soTexto: [1, 3], arte: [ok(["capa1", "v2", "v3"])] });
    await act(async () => {
      fireEvent.click(caixaDaCapa());
    });
    expect(recebidos.arte.map((f) => [f.getAll("so_texto"), f.get("capa")])).toEqual([[["3"], "1"]]);
    expect(caixaDaCapa().checked).toBe(true);
    expect(soTexto1().checked).toBe(false);
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "capa1"));
  });

  it("marcar o Só texto no slide 1 desliga a capa", async () => {
    const recebidos = renderizar({ capa: true, arte: [ok(["s1", "v2", "v3"])] });
    await act(async () => {
      fireEvent.click(soTexto1());
    });
    expect(recebidos.arte.map((f) => [f.getAll("so_texto"), f.get("capa")])).toEqual([[["1"], null]]);
    expect(caixaDaCapa().checked).toBe(false);
  });

  it("na recusa, a capa e o só texto voltam juntos para a última escolha aceita", async () => {
    renderizar({ soTexto: [1], arte: [{ tom: "erro", texto: "O post de uma imagem só não tem capa: ele não tem gancho.", em: 2 }] });
    await act(async () => {
      fireEvent.click(caixaDaCapa());
    });
    expect(caixaDaCapa().checked).toBe(false);
    expect(soTexto1().checked).toBe(true);
    expect(screen.getByText("O post de uma imagem só não tem capa: ele não tem gancho.")).toBeTruthy();
  });
});

describe("o card do slide 1 em capa", () => {
  it("os botões são os da capa; os do espaço ficam nos outros slides", () => {
    renderizar({ capa: true });
    expect(within(card(1)).getByText("Subir foto da capa")).toBeTruthy();
    expect(within(card(1)).getByText("Gerar com IA")).toBeTruthy();
    expect(within(card(1)).queryByText("Subir foto")).toBeNull();
    expect(within(card(1)).queryByText("Slide pronto do Canva")).toBeNull();
    expect(within(card(2)).getByText("Subir foto")).toBeTruthy();
    expect(within(card(2)).getByText("Gerar imagem")).toBeTruthy();
  });

  it("subir a foto da capa assina no destino da capa, e a miniatura troca pela versão devolvida", async () => {
    const recebidos = renderizar({ capa: true });
    const entrada = screen.getByLabelText("Slide 1: foto da capa") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(entrada, { target: { files: [new File(["x"], "capa.jpg", { type: "image/jpeg" })] } });
    });
    expect(recebidos.assinar).toMatchObject([{ id: CARROSSEL, numero: 1, destino: "capa" }]);
    expect(puts).toEqual(["https://bucket/sign/178/bonus-capa/nova.jpg?token=t"]);
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "a2-capa"));
    expect(within(card(1)).getByText("Trocar foto da capa")).toBeTruthy();
  });

  it("a imagem gerada por IA na capa entra como a da capa: o card passa a trocar a foto da capa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ estado: "pronta", hoje: 2, versao: "t1", versaoDaMiniatura: "a3-capa" }), { status: 200 }))
    );
    renderizar({ capa: true, gerando: [1] });
    await waitFor(() =>
      expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "a3-capa"))
    );
    expect(within(card(1)).getByText("Trocar foto da capa")).toBeTruthy();
  });

  it("a miniatura da capa é a arte, mesmo com um slide pronto guardado no slide 1", () => {
    renderizar({ capa: true, imagens: { 1: { url: PRONTO, versao: "t1", jeito: "slide" } } });
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "v1"));
  });

  it("sem a capa, a imagem da capa guardada não vira a miniatura nem a imagem do slide", () => {
    renderizar({ imagens: { 1: { url: CAPA, versao: "t1", jeito: "capa" } } });
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "v1"));
    expect(within(card(1)).getByText("Subir foto")).toBeTruthy();
  });

  it("o gancho que não cabe na capa avisa no card, e o Publicar trava", () => {
    renderizar({ capa: true, valores: { ...VALORES, gancho: "Desinconstitucionalissimamente proibido" } });
    expect(within(card(1)).getAllByText("O gancho não cabe na capa. Encurte o texto.").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a capa sem imagem trava o Publicar com a falta da imagem do slide 1", () => {
    renderizar({
      capa: true,
      imagens: { 2: { url: PRONTO, versao: "t2", jeito: "slide" }, 3: { url: PRONTO, versao: "t3", jeito: "slide" } },
    });
    expect(screen.getByText("Falta a imagem do slide 1.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("com a imagem da capa, nada falta", () => {
    renderizar({
      capa: true,
      imagens: {
        1: { url: CAPA, versao: "t1", jeito: "capa" },
        2: { url: PRONTO, versao: "t2", jeito: "slide" },
        3: { url: PRONTO, versao: "t3", jeito: "slide" },
      },
    });
    expect(screen.queryByText(/Falta a imagem/)).toBeNull();
    expect((screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
