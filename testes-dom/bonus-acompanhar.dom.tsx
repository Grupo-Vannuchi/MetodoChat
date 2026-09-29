import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import Acompanhar from "@/app/bonus/[id]/acompanhar";
import { DESISTIR_MS, INTERVALO_CONSULTA_MS } from "@/lib/bonus/tempos";

// O ACOMPANHAMENTO DA GERAÇÃO: a tela pergunta ao servidor (router.refresh) até a
// linha sair de "gerando". Quando sai, a página deixa de desenhar este
// componente, e ele para por desmontagem.

const INICIO = Date.parse("2026-09-29T12:00:00Z");

async function passar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * UM INTERVALO POR VEZ, e cada um dentro do seu `act`. O próximo timer só existe depois
 * de o React re-renderizar, e ele re-renderiza ENTRE tarefas: avançar 244 s de uma vez
 * dispara um timer só, e o relógio nunca chega ao "desistir" (medido na execução).
 */
async function passarIntervalos(n: number) {
  for (let i = 0; i < n; i++) await passar(INTERVALO_CONSULTA_MS);
}

beforeEach(() => {
  vi.useFakeTimers({ now: INICIO });
  refresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Acompanhar", () => {
  it("pergunta ao servidor uma vez a cada intervalo", async () => {
    render(<Acompanhar criadoEmMs={INICIO} />);
    expect(refresh).not.toHaveBeenCalled();
    await passar(INTERVALO_CONSULTA_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    await passar(INTERVALO_CONSULTA_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("pergunta uma vez por intervalo, nem mais nem menos", async () => {
    render(<Acompanhar criadoEmMs={INICIO} />);
    await passarIntervalos(10);
    expect(refresh).toHaveBeenCalledTimes(10);
  });

  it("para de perguntar depois de DESISTIR_MS, e diz isso na tela", async () => {
    render(<Acompanhar criadoEmMs={INICIO} />);
    await passarIntervalos(DESISTIR_MS / INTERVALO_CONSULTA_MS + 2);
    const chamadas = refresh.mock.calls.length;
    expect(screen.getByText(/parei de conferir/i)).toBeTruthy();
    await passarIntervalos(5);
    expect(refresh.mock.calls.length).toBe(chamadas);
  });

  it("para quando sai da tela", async () => {
    const { unmount } = render(<Acompanhar criadoEmMs={INICIO} />);
    await passar(INTERVALO_CONSULTA_MS);
    unmount();
    await passarIntervalos(5);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
