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
const TODAS = { 1: { url: "u1", versao: "t1" }, 2: { url: "u2", versao: "t2" }, 3: { url: "u3", versao: "t3" } };

beforeEach(() => {
  refresh.mockReset();
});

afterEach(() => {
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
