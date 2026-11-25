import type { MetadataRoute } from "next";
import { COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";

// O MANIFESTO DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md). É ele que deixa pôr o painel na tela inicial
// e abri-lo sem a barra do navegador (o `display: "standalone"`). O Next o serve em /manifest.webmanifest
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md:20-47).
//
// ESTE ENDEREÇO TEM DE SER PÚBLICO NO PORTEIRO (proxy.ts): o navegador o busca sozinho, sem o cookie da sessão,
// e sem ele o celular não instala o ícone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOME_DO_PAINEL,
    short_name: NOME_DO_PAINEL,
    description: DESCRICAO_DO_PAINEL,
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    // A TELA DE ABERTURA DO ANDROID (o fundo atrás do ícone) e a barra ficam no preto do ícone, pela decisão do
    // Victor de 25/11 (docs/specs/2026-11-24-celular-onda-1.md). No iPhone, essa tela não aparece.
    background_color: COR_DO_PAPEL_ESCURO,
    theme_color: COR_DO_PAPEL_ESCURO,
    // OS ÍCONES DA TELA INICIAL são os de 192 e 512 do app/icon.tsx (os lados de lib/desenho-do-icone.tsx). O de
    // 512 vale também como "maskable": o desenho fica nos 80% do meio, e o Android pode recortá-lo em círculo.
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
