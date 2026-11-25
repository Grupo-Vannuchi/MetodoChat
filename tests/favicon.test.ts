import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

// O FAVICON ANTIGO LEVA AO ÍCONE NOVO (docs/specs/2026-11-24-celular-onda-1.md, o achado 352).
//
// O app/favicon.ico (o logotipo da Vercel) saiu, e o /_not-found deste app é dinâmico, porque o layout lê cookies.
// Sem o redirect, cada pedido ao /favicon.ico rodaria o layout, que, com o cookie da sessão, consulta o banco duas
// vezes. O redirect é temporário (307), para não ficar em cache no navegador de ninguém.
describe("o favicon antigo", () => {
  it("leva ao ícone novo de 32 px, por um redirect temporário", async () => {
    const lista = await nextConfig.redirects!();
    expect(lista).toContainEqual({ source: "/favicon.ico", destination: "/icon/32", permanent: false });
  });
});
