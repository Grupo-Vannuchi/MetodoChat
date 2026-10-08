// AS ACTIONS DO CARROSSEL AVULSO RECUSAM SEM SESSÃO, dentro do contexto de requisição do Next
// (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. O molde é
// bonus-carrossel-acoes.integracao.ts. O caminho com sessão é medido uma camada abaixo, em
// bonus-avulso-processo.integracao.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/carrosseis/actions");

const banco = bancoDescartavel();
let acoes: ModuloAcoes;

beforeAll(async () => {
  acoes = await import("@/app/carrosseis/actions");
});

/** A URL do redirect que a action lançou, lida do `digest`. */
async function destinoDe(acao: (f: FormData) => Promise<void>, form: FormData): Promise<string | null> {
  const { valor } = await comoNumaRequisicao("/carrosseis", async () => {
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

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as { n: number }[];
  return n;
}

describe("sem sessão, nenhuma action do carrossel avulso age", () => {
  it("pedirCarrosselAvulso vai para /entrar e não insere nada, mesmo com pedido válido e chave de IA", async () => {
    const antes = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "chave-inventada-para-o-teste";
    try {
      const destino = await destinoDe(
        async (f) => {
          await acoes.pedirCarrosselAvulso(null, f);
        },
        formulario({
          origem: "livre",
          tema: "Produtividade",
          palavra: "BRUTAL",
          conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
          total: "5",
          jeito: "ia",
        })
      );
      expect(destino).toBe("/entrar");
    } finally {
      if (antes === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = antes;
    }
    expect(await contar()).toBe(0);
  });

  it("gerarAvulsoDeNovo vai para /entrar e não insere nada", async () => {
    const destino = await destinoDe(acoes.gerarAvulsoDeNovo, formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d" }));
    expect(destino).toBe("/entrar");
    expect(await contar()).toBe(0);
  });
});
