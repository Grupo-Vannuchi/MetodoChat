import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A ORDEM DO PORTEIRO (docs/specs/2026-11-04-logins.md, seção 2). Desde os logins o proxy confere a sessão
// no banco, e os caminhos públicos passam ANTES dela: o webhook da Meta, o cron, a fila, o OAuth e o convite
// não podem pagar a consulta. A conferência da sessão é trocada por uma de mentira, que conta as chamadas e
// responde o que o caso pedir; o banco não entra aqui.

const conferencia = vi.hoisted(() => ({ chamadas: 0, resposta: null as null | { id: string } }));
vi.mock("@/lib/sessao", () => ({
  sessaoDoCookie: async () => {
    conferencia.chamadas++;
    return conferencia.resposta;
  },
}));

const { proxy } = await import("@/proxy");

const pedido = (caminho: string, cookie?: string) =>
  new NextRequest(`https://painel.exemplo.invalid${caminho}`, {
    headers: cookie ? { cookie: `metodochat_session=${cookie}` } : {},
  });

const SESSAO = "a".repeat(43);

beforeEach(() => {
  conferencia.chamadas = 0;
  conferencia.resposta = null;
});

describe("o porteiro", () => {
  it("deixa os caminhos públicos passarem sem consultar a sessão", async () => {
    for (const caminho of ["/api/webhook", "/api/cron/daily", "/api/queue/tick", "/api/oauth/callback", "/convite/x", "/entrar"]) {
      const r = await proxy(pedido(caminho, SESSAO));
      expect(r.headers.get("location"), caminho).toBeNull();
    }
    expect(conferencia.chamadas).toBe(0);
  });

  it("confere a sessão no resto, e manda para /entrar quando ela não vale", async () => {
    const sem = await proxy(pedido("/setup"));
    expect(new URL(sem.headers.get("location")!).pathname).toBe("/entrar");
    expect(conferencia.chamadas).toBe(1);

    conferencia.resposta = { id: "login" };
    const com = await proxy(pedido("/setup", SESSAO));
    expect(com.headers.get("location")).toBeNull();
    expect(conferencia.chamadas).toBe(2);
  });
});
