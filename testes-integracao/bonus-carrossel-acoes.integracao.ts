// AS TRÊS ACTIONS DO CARROSSEL RECUSAM SEM SESSÃO, dentro do contexto de requisição do Next
// (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. O molde é
// bonus-acoes.integracao.ts. O caminho com sessão é medido uma camada abaixo, em
// bonus-carrossel-processo.integracao.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/bonus/carrossel-actions");

const banco = bancoDescartavel();
let acoes: ModuloAcoes;

beforeAll(async () => {
  acoes = await import("@/app/bonus/carrossel-actions");
});

/** A URL do redirect que a action lançou, lida do `digest`. */
async function destinoDe(acao: (f: FormData) => Promise<void>, form: FormData): Promise<string | null> {
  const { valor } = await comoNumaRequisicao("/bonus", async () => {
    try {
      await acao(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return null;
  return valor.split(";").slice(2, -2).join(";");
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("sem sessão, nenhuma action do carrossel age", () => {
  it("pedirCarrossel vai para /entrar e não insere nada, mesmo com pedido válido e chave de IA", async () => {
    const antes = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "chave-inventada-para-o-teste";
    try {
      const destino = await destinoDe(
        acoes.pedirCarrossel,
        formulario({ bonus_id: "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f", total: "10" })
      );
      expect(destino).toBe("/entrar");
    } finally {
      if (antes === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = antes;
    }
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as {
      n: number;
    }[];
    expect(n).toBe(0);
  });

  it.each(["gerarCarrosselDeNovo", "salvarRevisaoDoCarrossel"] as const)("%s vai para /entrar", async (nome) => {
    const destino = await destinoDe(acoes[nome], formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d" }));
    expect(destino).toBe("/entrar");
  });
});
