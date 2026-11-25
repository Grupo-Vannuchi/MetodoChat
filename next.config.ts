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
      // O FAVICON ANTIGO LEVA AO ÍCONE NOVO (docs/specs/2026-11-24-celular-onda-1.md, o achado 352). O
      // app/favicon.ico (o logotipo da Vercel) saiu, e o /_not-found deste app é dinâmico: sem este redirect,
      // cada pedido ao /favicon.ico rodaria o layout, que lê a sessão no banco. O redirect do next.config roda
      // antes do porteiro e antes dos arquivos (node_modules/next/dist/docs/01-app/03-api-reference/
      // 03-file-conventions/proxy.md:243-246 e 05-config/01-next-config-js/redirects.md:39). O 307
      // (permanent: false) não fica em cache (redirects.md:30). tests/favicon.test.ts confere este redirect.
      { source: "/favicon.ico", destination: "/icon/32", permanent: false },
    ];
  },
};

export default nextConfig;
