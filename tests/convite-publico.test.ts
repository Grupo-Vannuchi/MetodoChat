import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "@/next.config";
import { proxy } from "@/proxy";

// O LINK DE CONVITE É ABERTO (docs/specs/2026-11-03-link-de-convite.md): quem o abre é o cliente, sem a
// senha do painel. Este arquivo confere as duas portas que deixam ele passar e os cabeçalhos que fecham o
// código do link (achado 157).

// Desde os logins (docs/specs/2026-11-04-logins.md) o porteiro é assíncrono: ele confere a sessão no banco.
// Sem cookie, a conferência responde que não vale sem consultar nada.
const passa = (caminho: string) => proxy(new NextRequest(`https://painel.exemplo.com.br${caminho}`));

describe("o porteiro do painel e o convite", () => {
  it.each(["/convite/abc", "/convite/pronto", "/convite/erro", "/api/oauth/convite/abc"])(
    "%s passa sem a sessão",
    async (caminho) => {
      expect((await passa(caminho)).headers.get("location")).toBeNull();
    }
  );

  it.each(["/convites", "/convite-x", "/setup"])("%s continua pedindo a sessão", async (caminho) => {
    expect(new URL((await passa(caminho)).headers.get("location") ?? "").pathname).toBe("/entrar");
  });
});

describe("os cabeçalhos das rotas do convite (achado 157)", () => {
  const FECHADO = [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "no-store" },
    { key: "X-Robots-Tag", value: "noindex" },
  ];

  it("a página e o começo levam os três, e nenhuma outra rota leva cabeçalho do next.config", async () => {
    const regras = (await nextConfig.headers?.()) ?? [];
    expect(regras).toEqual([
      { source: "/convite/:path*", headers: FECHADO },
      { source: "/api/oauth/convite/:path*", headers: FECHADO },
    ]);
  });
});
