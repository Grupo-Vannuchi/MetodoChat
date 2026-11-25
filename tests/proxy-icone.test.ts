import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LADOS_DO_ICONE } from "@/lib/desenho-do-icone";

// O PORTEIRO E O ÍCONE DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, "O porteiro").
//
// O navegador busca o manifesto e os ícones sozinho, sem o cookie da sessão, e sem eles o celular não instala o
// ícone. Por isso, os endereços que o build serve para eles passam pelo porteiro sem sessão. A conferência é de
// IGUALDADE (a lista PUBLIC_EXATOS de proxy.ts), e não de prefixo nem de extensão
// (docs/specs/2026-10-26-sessao-conferida.md): um vizinho parecido continua pedindo sessão.
//
// A conferência da sessão é trocada por uma de mentira que conta as chamadas e responde "sem sessão", como em
// tests/proxy-ordem.test.ts. O banco não entra aqui.

const conferencia = vi.hoisted(() => ({ chamadas: 0 }));
vi.mock("@/lib/sessao", () => ({
  sessaoDoCookie: async () => {
    conferencia.chamadas++;
    return null;
  },
}));

const { proxy } = await import("@/proxy");

const pedido = (caminho: string) => new NextRequest(`https://painel.exemplo.invalid${caminho}`);
const vaiParaEntrar = (r: Response) => {
  const destino = r.headers.get("location");
  return destino !== null && new URL(destino).pathname === "/entrar";
};

// Os caminhos da lista de rotas do build (o manifesto, um /icon por lado de lib/desenho-do-icone.tsx e o ícone do
// iPhone). Montados a partir dos lados, um lado novo sem o endereço no porteiro cai aqui.
const PUBLICOS = ["/manifest.webmanifest", ...LADOS_DO_ICONE.map((lado) => `/icon/${lado}`), "/apple-icon"];

beforeEach(() => {
  conferencia.chamadas = 0;
});

describe("o porteiro e o ícone do celular", () => {
  it.each(PUBLICOS)("%s passa sem sessão, e sem consultar a sessão", async (caminho) => {
    const r = await proxy(pedido(caminho));
    expect(r.headers.get("location"), caminho).toBeNull();
    expect(conferencia.chamadas).toBe(0);
  });

  it("confere o caminho sem a query que o Next põe no <link> do ícone", async () => {
    const r = await proxy(pedido("/icon/32?a1b2c3d4"));
    expect(r.headers.get("location")).toBeNull();
    expect(conferencia.chamadas).toBe(0);
  });

  it.each([
    "/manifest.webmanifest/x",
    "/icon/32/x",
    "/icon/64",
    "/icon",
    "/icon-qualquer-coisa",
    "/iconx",
    "/apple-icon/x",
    "/apple-icon.png",
    "/manifest.json",
    "/conversas/x.png",
  ])("%s continua pedindo sessão", async (caminho) => {
    const r = await proxy(pedido(caminho));
    expect(vaiParaEntrar(r), caminho).toBe(true);
    expect(conferencia.chamadas).toBe(1);
  });
});
