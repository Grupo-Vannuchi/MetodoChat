// A ROTA DA ARTE RECUSA SEM SESSÃO, dentro do contexto de requisição do Next
// (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. Nenhum cookie é forjado: a sessão
// ausente é o caso medido. O desenho com sessão é medido uma camada abaixo, em
// tests/bonus-arte-resposta.test.ts, e de ponta a ponta na prova real.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloRota = typeof import("@/app/bonus/[id]/carrossel/[cid]/arte/route");

bancoDescartavel();
let rota: ModuloRota;

beforeAll(async () => {
  rota = await import("@/app/bonus/[id]/carrossel/[cid]/arte/route");
});

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("sem sessão, a arte não desenha", () => {
  it("responde 401 sem cache, antes de olhar o carrossel, o slide ou o banco", async () => {
    const caminho = `/bonus/${BONUS}/carrossel/${CARROSSEL}/arte`;
    const { valor } = await comoNumaRequisicao(caminho, async () => {
      const r = await rota.GET(new Request(`http://127.0.0.1${caminho}?slide=1`), {
        params: Promise.resolve({ id: BONUS, cid: CARROSSEL }),
      });
      return { status: r.status, cache: r.headers.get("cache-control"), corpo: await r.json() };
    });
    expect(valor).toEqual({
      status: 401,
      cache: "private, no-store",
      corpo: { ok: false, erro: "Entre no painel para ver a arte." },
    });
  });
});
