import { ImageResponse } from "next/og";
import { desenhoDoIcone } from "@/lib/desenho-do-icone";

// O ÍCONE DA TELA DE INÍCIO DO IPHONE (docs/specs/2026-11-24-celular-onda-1.md): o mesmo desenho do app/icon.tsx,
// em 180x180, que é o tamanho que o iPhone usa. O Next põe o <link rel="apple-touch-icon"> no <head> sozinho
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md:49-59).
//
// ESTE ENDEREÇO TEM DE SER PÚBLICO NO PORTEIRO (proxy.ts): o iPhone busca o ícone sem o cookie da sessão.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(desenhoDoIcone(size.width), size);
}
