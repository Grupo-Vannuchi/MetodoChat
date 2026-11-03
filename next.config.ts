import type { NextConfig } from "next";

// AS ROTAS DO LINK DE CONVITE (achado 157, docs/specs/2026-11-03-link-de-convite.md): o código do convite
// viaja no caminho da URL, então ele não pode ir no Referer, ficar num cache nem entrar num buscador.
const FECHADO = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Robots-Tag", value: "noindex" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/convite/:path*", headers: FECHADO },
      { source: "/api/oauth/convite/:path*", headers: FECHADO },
    ];
  },
  async redirects() {
    return [
      // A página deixou de ser loja (com preço e checkout) e virou vitrine dos
      // produtos da casa, então a rota acompanhou o nome. Ela esteve no menu
      // como "Loja" por um bom tempo, e link salvo de cliente não deve virar
      // 404.
      { source: "/loja", destination: "/produtos", permanent: true },
    ];
  },
};

export default nextConfig;
