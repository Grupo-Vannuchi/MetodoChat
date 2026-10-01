// AS QUATRO ACTIONS DO BÔNUS RECUSAM SEM SESSÃO, dentro do contexto de requisição
// do Next (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. Nenhum
// cookie é forjado: a sessão ausente é o caso medido. O caminho com sessão é
// medido uma camada abaixo, em bonus-processo.integracao.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/bonus/actions");

const banco = bancoDescartavel();
let acoes: ModuloAcoes;

beforeAll(async () => {
  acoes = await import("@/app/bonus/actions");
});

/** A URL do redirect que a action lançou, lida do `digest`, como em publicar-fala.integracao.ts. */
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

describe("sem sessão, nenhuma action do bônus age", () => {
  // O pedido recebe o estado anterior do formulário (useActionState), como o envio.
  it("pedirBonus vai para /entrar e não insere nada, mesmo com pedido válido e chave de IA", async () => {
    const antes = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "chave-inventada-para-o-teste";
    try {
      const destino = await destinoDe(
        async (f) => {
          await acoes.pedirBonus(null, f);
        },
        formulario({ tema: "Marketing", o_que_resolve: "Montar um cronograma de lançamento em 7 dias", palavra: "" })
      );
      expect(destino).toBe("/entrar");
    } finally {
      if (antes === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = antes;
    }
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from bonus_gerados`)) as { n: number }[];
    expect(n).toBe(0);
  });

  it.each(["gerarDeNovo", "conferirNoLabs"] as const)("%s vai para /entrar", async (nome) => {
    const destino = await destinoDe(
      acoes[nome],
      formulario({ id: "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f", existe: "sim" })
    );
    expect(destino).toBe("/entrar");
  });

  // O envio recebe o estado anterior do formulário (useActionState, achado 54).
  it("enviarAoLabs vai para /entrar", async () => {
    const destino = await destinoDe(
      async (f) => {
        await acoes.enviarAoLabs(null, f);
      },
      formulario({ id: "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f" })
    );
    expect(destino).toBe("/entrar");
  });
});
