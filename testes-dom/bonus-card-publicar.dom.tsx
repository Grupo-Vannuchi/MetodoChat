import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardPublicar from "@/app/bonus/[id]/carrossel/[cid]/card-publicar";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaPublicacao } from "@/lib/bonus/publicar-textos";

// O CARD "PUBLICAR" (spec da Etapa 5, "A página"): a conta, o "Agora" ou o "Agendar", o botão travado
// com a frase de cada falta, o estado depois de mandar, e a página recarregada no sucesso. As actions e
// o roteador são falsos.

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const TODAS = {
  1: { url: "u1", versao: "t1", jeito: "slide" as const },
  2: { url: "u2", versao: "t2", jeito: "slide" as const },
  3: { url: "u3", versao: "t3", jeito: "slide" as const },
};

beforeEach(() => {
  refresh.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function publicacao(p: Partial<PublicacaoNaTela> = {}, respostas: AvisoDaPublicacao[] = []) {
  const pedidos: unknown[] = [];
  const completa: PublicacaoNaTela = {
    acaoDaAssinatura: async () => ({ ok: false, texto: "não devia assinar" }),
    acaoDaImagem: async () => ({ tom: "erro", texto: "não devia guardar", em: 1 }),
    acaoDaPublicacao: async (pedido: unknown) => {
      pedidos.push(pedido);
      return respostas.shift() ?? { tom: "ok", texto: "Na fila do /publicar.", em: 1 };
    },
    imagens: TODAS,
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    ...p,
  };
  return { completa, pedidos };
}

function renderizar(p: Partial<PublicacaoNaTela> = {}, extra: { naoSalvos?: number[]; legenda?: boolean; respostas?: AvisoDaPublicacao[] } = {}) {
  const { completa, pedidos } = publicacao(p, extra.respostas);
  render(
    <CardPublicar
      publicacao={completa}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      total={3}
      soTexto={[]}
      imagens={completa.imagens}
      versoesDaMiniatura={["a1", "b1", "c1"]}
      slidesNaoSalvos={extra.naoSalvos ?? []}
      legendaNaoSalva={extra.legenda ?? false}
    />
  );
  return pedidos;
}

const botao = () => screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement;

describe("o card Publicar, com o carrossel livre", () => {
  it("diz a conta, e Agora publica: manda o pedido e recarrega a página", async () => {
    const pedidos = renderizar();
    expect(screen.getByText("@thiagovannuchi")).toBeTruthy();
    expect(botao().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(pedidos).toEqual([{ id: CARROSSEL, quando: "agora", dataHora: "", fuso: String(new Date().getTimezoneOffset()), artes: [] }]);
    expect(screen.getByText("Na fila do /publicar.")).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("Agendar pede a data e a hora, e manda o depois", async () => {
    const pedidos = renderizar();
    fireEvent.click(screen.getByLabelText("Agendar"));
    expect(botao().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2026-10-06T18:00" } });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(pedidos).toEqual([
      { id: CARROSSEL, quando: "depois", dataHora: "2026-10-06T18:00", fuso: String(new Date().getTimezoneOffset()), artes: [] },
    ]);
  });

  it("a recusa aparece junto do botão, e a página não recarrega", async () => {
    renderizar({}, { respostas: [{ tom: "erro", texto: "O carrossel mudou enquanto a publicação era preparada. Confira e publique de novo.", em: 2 }] });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(screen.getByText("O carrossel mudou enquanto a publicação era preparada. Confira e publique de novo.")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("as faltas travam o botão, com a frase de cada uma", () => {
    renderizar({ imagens: { 1: TODAS[1] } }, { naoSalvos: [2], legenda: true });
    expect(botao().disabled).toBe(true);
    expect(screen.getByText("Falta a imagem dos slides 2 e 3.")).toBeTruthy();
    expect(screen.getByText("Salve o slide 2 e a legenda antes de publicar.")).toBeTruthy();
  });

  it("sem conta gravada, ou com ela desconectada, o botão trava com a frase da conta", () => {
    renderizar({ origem: "selecionada" });
    expect(botao().disabled).toBe(true);
    expect(screen.getByText('Este carrossel é de antes de a conta ser gravada. Use "Fixar nesta conta" antes de publicar.')).toBeTruthy();
  });

  it("depois de falhar, mostra o estado e o botão volta", () => {
    renderizar({ estado: { texto: "Não publicou: a Meta recusou. Dá para publicar de novo.", tom: "erro", filaId: "f1", livre: true } });
    expect(screen.getByText("Não publicou: a Meta recusou. Dá para publicar de novo.")).toBeTruthy();
    expect(botao().disabled).toBe(false);
  });
});

describe("o card Publicar, com o carrossel na fila", () => {
  it("agendado: o estado, o post no /publicar e o aviso do calendário, sem o botão", () => {
    renderizar({
      estado: { texto: "Agendado para 06/10/2026, 18:00 (horário de Brasília).", tom: "ok", filaId: "f1", livre: false },
      avisoDoCalendario: "Para ver no calendário, selecione thiagovannuchi no menu.",
    });
    expect(screen.getByText("Agendado para 06/10/2026, 18:00 (horário de Brasília).")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver no /publicar" }).getAttribute("href")).toBe("/publicar/post/f1");
    expect(screen.getByText("Para ver no calendário, selecione thiagovannuchi no menu.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
  });
});

describe("o não salvo, pelo editor", () => {
  it("editar um slide sem salvar trava o Publicar, e salvar destrava", async () => {
    const { completa } = publicacao();
    render(
      <EditorDoCarrossel
        acaoDoSlide={async () => ({ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "b2", versaoDoTexto: "t2" })}
        acaoDaArte={async () => null}
        acaoDaConta={async () => null}
        bonusId={BONUS}
        carrosselId={CARROSSEL}
        palavra="SUMIDO"
        total={3}
        campos={camposDoFormulario(3)}
        valores={{
          gancho: "Seu cliente sumiu? Não é culpa dele.",
          slide_1_titulo: "O que fazer primeiro",
          slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
          chamada: "Comente SUMIDO e receba as mensagens prontas.",
          legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
        }}
        rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
        avisoDaConta={null}
        podeFixar={false}
        soTextoInicial={[]}
        versoes={["a1", "b1", "c1"]}
        pausaMs={0}
        publicacao={completa}
      />
    );
    expect(botao().disabled).toBe(false);
    const card2 = screen.getAllByRole("listitem")[1];
    fireEvent.click(within(card2).getByRole("button", { name: "Editar" }));
    fireEvent.input(screen.getByLabelText("Slide 2: texto"), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    expect(screen.getByText("Salve o slide 2 antes de publicar.")).toBeTruthy();
    expect(botao().disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
    });
    expect(screen.queryByText("Salve o slide 2 antes de publicar.")).toBeNull();
    expect(botao().disabled).toBe(false);
  });
});

// AS ARTES QUE VÃO COM O PEDIDO (adendo da Etapa 5): o "Só texto" e o slide com foto saem com a arte da
// rota, convertida e subida. A versão que vai é a que a rota mandou com a arte (`X-Arte-Versao`), e não
// a que a página tinha; e a arte do slide com foto só sobe com a foto desenhada (achado 78).
describe("as artes que vão com o pedido", () => {
  /** A rota, o bucket e o canvas falsos. `foto` é o `X-Arte-Foto` de cada slide. */
  function artesFalsas(foto: Record<number, string>) {
    const puts: string[] = [];
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1080, height: 1350, close: () => {} })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ fillStyle: "", fillRect: () => {}, drawImage: () => {} }) as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((fn) => fn(new Blob(["jpeg"], { type: "image/jpeg" })));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method === "PUT") {
          puts.push(url);
          return new Response("{}", { status: 200 });
        }
        const n = Number(new URL(url, "http://x").searchParams.get("slide"));
        const cabecalhos: Record<string, string> = { "content-type": "image/png", "x-arte-versao": `desenho-${n}` };
        if (foto[n]) cabecalhos["x-arte-foto"] = foto[n];
        return new Response("png", { status: 200, headers: cabecalhos });
      })
    );
    return puts;
  }
  const assinarNaFila = async (p: unknown) => {
    const n = (p as { numero: number }).numero;
    return { ok: true as const, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
  };
  const COM_FOTO = { 1: TODAS[1], 2: { url: "f2", versao: "t2", jeito: "foto" as const } };

  function comArtes(foto: Record<number, string>) {
    const puts = artesFalsas(foto);
    const { completa, pedidos } = publicacao({ imagens: COM_FOTO, acaoDaAssinatura: assinarNaFila });
    render(
      <CardPublicar
        publicacao={completa}
        bonusId={BONUS}
        carrosselId={CARROSSEL}
        total={3}
        soTexto={[3]}
        imagens={completa.imagens}
        versoesDaMiniatura={["a1", "b1", "c1"]}
        slidesNaoSalvos={[]}
        legendaNaoSalva={false}
      />
    );
    return { puts, pedidos };
  }

  it("o slide com foto e o só texto vão com a arte da rota, e com a versão do que ela desenhou", async () => {
    const { pedidos } = comArtes({ 2: "sim" });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(pedidos).toEqual([
      {
        id: CARROSSEL,
        quando: "agora",
        dataHora: "",
        fuso: String(new Date().getTimezoneOffset()),
        artes: [
          { numero: 2, caminho: "178/bonus-fila/2.jpg", versao: "desenho-2" },
          { numero: 3, caminho: "178/bonus-fila/3.jpg", versao: "desenho-3" },
        ],
      },
    ]);
  });

  it("a foto que faltou na arte trava o pedido, com a frase, e nada sobe (achado 78)", async () => {
    const { puts, pedidos } = comArtes({ 2: "faltou" });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(pedidos).toEqual([]);
    expect(puts).toEqual([]);
    expect(screen.getByText("A foto do slide 2 não carregou. Espere um instante e publique de novo.")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  // ACHADO NO ENSAIO DO ADENDO: a página guardava a versão do texto de quando abriu, e depois de salvar
  // um slide "Só texto" sem recarregar, o publicar mandava a velha e era recusado sempre.
  it("depois de salvar o slide só texto sem recarregar, vai a versão que a rota desenhou", async () => {
    artesFalsas({});
    const { completa, pedidos } = publicacao({ imagens: { 2: TODAS[2], 3: TODAS[3] }, acaoDaAssinatura: assinarNaFila });
    render(
      <EditorDoCarrossel
        acaoDoSlide={async () => ({ tom: "ok", texto: "Slide 1 salvo.", em: 1, versao: "a2", versaoDoTexto: "t1-novo" })}
        acaoDaArte={async () => null}
        acaoDaConta={async () => null}
        bonusId={BONUS}
        carrosselId={CARROSSEL}
        palavra="SUMIDO"
        total={3}
        campos={camposDoFormulario(3)}
        valores={{
          gancho: "Seu cliente sumiu? Não é culpa dele.",
          slide_1_titulo: "O que fazer primeiro",
          slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
          chamada: "Comente SUMIDO e receba as mensagens prontas.",
          legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
        }}
        rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
        avisoDaConta={null}
        podeFixar={false}
        soTextoInicial={[1]}
        versoes={["a1", "b1", "c1"]}
        pausaMs={0}
        publicacao={completa}
      />
    );
    const card1 = screen.getAllByRole("listitem")[0];
    fireEvent.click(within(card1).getByRole("button", { name: "Editar" }));
    fireEvent.input(screen.getByLabelText("Gancho (slide 1)"), { target: { value: "Seu cliente sumiu? A culpa não é dele." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 1" }));
    });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect((pedidos[0] as { artes: unknown[] }).artes).toEqual([{ numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "desenho-1" }]);
  });
});
