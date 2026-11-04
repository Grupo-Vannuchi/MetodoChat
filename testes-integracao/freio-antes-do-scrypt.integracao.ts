// O FREIO CONTA A TENTATIVA ANTES DO SCRYPT (achado 173, docs/specs/2026-11-04-logins.md). Com o freio que
// olhava antes e só gravava a falha depois, uma rajada de pedidos em paralelo do mesmo IP passava inteira pela
// olhada, e cada pedido pagava um scrypt (com N=2^17, ~480 ms e ~128 MiB). Agora a tentativa é reservada antes
// da conferência, com uma trava por IP, e acima de 8 na janela a resposta é o freio, sem scrypt.
//
// AS CONFERÊNCIAS SÃO CONTADAS por um invólucro do `senhaConfere` (o de verdade roda por dentro): ele é o
// scrypt que pesa, inclusive o de fachada do e-mail que não existe. A rajada é de 20 pedidos em paralelo, e
// no máximo 8 chegam ao scrypt.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao, comoNumaRequisicaoComSessao, EMAIL_DE_TESTE } from "./semear-requisicao";

const conferencias = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/logins", async (original) => {
  const m = await original<typeof import("@/lib/logins")>();
  return {
    ...m,
    senhaConfere: async (senha: string, guardado: string) => {
      conferencias.n++;
      return m.senhaConfere(senha, guardado);
    },
  };
});

type ModuloEntrar = typeof import("@/app/entrar/actions");
type ModuloConta = typeof import("@/app/minha-conta/actions");
type ModuloThrottle = typeof import("@/lib/login-throttle");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

let entrarMod: ModuloEntrar;
let conta: ModuloConta;
let freio: ModuloThrottle;

beforeAll(async () => {
  entrarMod = await import("@/app/entrar/actions");
  conta = await import("@/app/minha-conta/actions");
  freio = await import("@/lib/login-throttle");
});

beforeEach(async () => {
  await q(`delete from login_attempts`);
  await q(`delete from logins where email <> $1`, [EMAIL_DE_TESTE]);
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

const RAJADA = 20;

describe("a rajada do mesmo IP", () => {
  it("na entrada, roda no máximo 8 conferências, e o resto ouve o freio", async () => {
    conferencias.n = 0;
    const respostas = await Promise.all(
      Array.from({ length: RAJADA }, () =>
        comoNumaRequisicao("/entrar", () =>
          entrarMod.login(undefined, form({ email: "ninguem@exemplo.invalid", password: "uma senha qualquer" }))
        )
      )
    );
    const erros = respostas.map((r) => r.valor.error);
    expect(conferencias.n).toBeLessThanOrEqual(8);
    expect(erros.filter((e) => e === freio.LOCKOUT_MESSAGE)).toHaveLength(RAJADA - 8);
    expect(erros.filter((e) => e === "E-mail ou senha incorretos.")).toHaveLength(8);
    expect(Number((await q(`select count(*)::int as n from login_attempts`))[0].n)).toBe(8);
  });

  it("na troca da senha atual, roda no máximo 8 conferências, e o resto ouve o freio", async () => {
    await comoNumaRequisicaoComSessao("/minha-conta", async () => null); // a entrada do harness limpa o freio
    conferencias.n = 0;
    const respostas = await Promise.all(
      Array.from({ length: RAJADA }, () =>
        comoNumaRequisicaoComSessao("/minha-conta", () =>
          conta.trocarMinhaSenha(
            {},
            form({ atual: "nao e a senha atual", nova: "uma senha nova qualquer", confirmacao: "uma senha nova qualquer" })
          )
        )
      )
    );
    const erros = respostas.map((r) => r.valor.erro);
    expect(conferencias.n).toBeLessThanOrEqual(8);
    expect(erros.filter((e) => e === freio.LOCKOUT_MESSAGE)).toHaveLength(RAJADA - 8);
    expect(erros.filter((e) => e === "A senha atual não confere.")).toHaveLength(8);
  });

  it("o acerto limpa as tentativas, como antes", async () => {
    expect(await freio.reservarTentativa("203.0.113.9")).toBe(true);
    expect(Number((await q(`select count(*)::int as n from login_attempts where ip = '203.0.113.9'`))[0].n)).toBe(1);
    await freio.clearAttempts("203.0.113.9");
    expect(Number((await q(`select count(*)::int as n from login_attempts where ip = '203.0.113.9'`))[0].n)).toBe(0);
  });
});
