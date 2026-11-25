import { ImageResponse } from "next/og";
import { desenhoDoIcone, LADOS_DO_ICONE } from "@/lib/desenho-do-icone";

// O ÍCONE DA ABA E DA TELA INICIAL (docs/specs/2026-11-24-celular-onda-1.md, "O ícone e o manifesto"). Ele toma o
// lugar do app/favicon.ico, que era o logotipo da Vercel, vindo com o create-next-app.
//
// TRÊS TAMANHOS NUM ARQUIVO SÓ, pelo `generateImageMetadata`
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-image-metadata.md): 32 para a aba do
// navegador, e 192 e 512 para a tela inicial do Android, que o manifesto (app/manifest.ts) aponta. Desde o Next
// 16, o `id` chega como uma promessa (o mesmo guia, "Version History").
//
// ESTES ENDEREÇOS TÊM DE SER PÚBLICOS NO PORTEIRO (proxy.ts): o navegador busca o ícone sozinho, sem o cookie da
// sessão.
export function generateImageMetadata() {
  return LADOS_DO_ICONE.map((lado) => ({
    id: String(lado),
    size: { width: lado, height: lado },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const lado = Number(await id);
  return new ImageResponse(desenhoDoIcone(lado), { width: lado, height: lado });
}
