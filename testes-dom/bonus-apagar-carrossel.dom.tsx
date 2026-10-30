import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BotaoDeApagar from "@/app/bonus/[id]/carrossel/[cid]/botao-de-apagar";
import {
  TEXTO_APAGAR_CARROSSEL,
  TEXTO_CANCELAR_APAGAR,
  TEXTO_CONFIRMAR_APAGAR,
  TEXTO_SIM_APAGAR,
  textoDoApagar,
  type AvisoDoApagar,
} from "@/lib/bonus/apagar-textos";

// O "APAGAR CARROSSEL" NA TELA (spec da Etapa 10, "A página do carrossel"): nada é apagado no primeiro
// clique; o segundo pergunta, com "Sim, apagar" e "Cancelar"; quando não pode, a frase fica no lugar do
// botão; e a recusa do servidor aparece no próprio botão, como estado (achado 52). A action entra por
// propriedade, e aqui é uma falsa: o sucesso, que sai por redirect, não volta para a tela.

const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

/**
 * `segurar` prende a resposta da action até o caso soltar. O caso tem de soltar antes de acabar: o React
 * 19 enreda as transições seguintes na action que ainda não respondeu, e os casos de depois esperariam.
 */
function renderizar(p: { frase?: string | null; respostas?: AvisoDoApagar[]; segurar?: Promise<void> } = {}) {
  const recebidos: FormData[] = [];
  const respostas = p.respostas ?? [];
  const acao = async (_anterior: AvisoDoApagar | null, f: FormData) => {
    recebidos.push(f);
    await p.segurar;
    return respostas.shift() ?? null;
  };
  render(<BotaoDeApagar id={CARROSSEL} frase={p.frase ?? null} acao={acao} />);
  return recebidos;
}

const botao = (nome: string) => screen.getByRole("button", { name: nome }) as HTMLButtonElement;
const semBotao = (nome: string) => expect(screen.queryByRole("button", { name: nome })).toBeNull();

async function clicar(nome: string) {
  await act(async () => {
    fireEvent.click(botao(nome));
  });
}

describe("o Apagar carrossel", () => {
  it("o primeiro clique não apaga: pergunta, com Sim, apagar e Cancelar", async () => {
    const recebidos = renderizar();
    await clicar(TEXTO_APAGAR_CARROSSEL);
    expect(screen.getByText(TEXTO_CONFIRMAR_APAGAR)).toBeTruthy();
    expect(botao(TEXTO_SIM_APAGAR)).toBeTruthy();
    expect(botao(TEXTO_CANCELAR_APAGAR)).toBeTruthy();
    semBotao(TEXTO_APAGAR_CARROSSEL);
    expect(recebidos).toEqual([]);
  });

  it("o Cancelar volta ao botão, sem chamar a action", async () => {
    const recebidos = renderizar();
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_CANCELAR_APAGAR);
    expect(botao(TEXTO_APAGAR_CARROSSEL)).toBeTruthy();
    expect(screen.queryByText(TEXTO_CONFIRMAR_APAGAR)).toBeNull();
    expect(recebidos).toEqual([]);
  });

  it("o Sim, apagar manda o id do carrossel, uma vez", async () => {
    const recebidos = renderizar();
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_SIM_APAGAR);
    expect(recebidos.map((f) => Object.fromEntries(f.entries()))).toEqual([{ id: CARROSSEL }]);
  });

  it("enquanto o servidor apaga, o botão fica desligado e diz Apagando…", async () => {
    let soltar!: () => void;
    renderizar({ segurar: new Promise<void>((f) => (soltar = f)) });
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_SIM_APAGAR);
    expect(botao("Apagando…").disabled).toBe(true);
    semBotao(TEXTO_SIM_APAGAR);
    await act(async () => soltar());
  });

  it("a recusa do servidor aparece no lugar, e o botão volta (achado 52)", async () => {
    const texto = textoDoApagar("agendado");
    renderizar({ respostas: [{ tom: "erro", texto, em: 1 }] });
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_SIM_APAGAR);
    expect(screen.getByRole("status").textContent).toBe(texto);
    expect(botao(TEXTO_APAGAR_CARROSSEL).disabled).toBe(false);
  });

  it("quando não pode, a frase fica no lugar do botão", () => {
    renderizar({ frase: textoDoApagar("imagem") });
    expect(screen.getByText("Espere a imagem terminar para apagar.")).toBeTruthy();
    semBotao(TEXTO_APAGAR_CARROSSEL);
  });
});
