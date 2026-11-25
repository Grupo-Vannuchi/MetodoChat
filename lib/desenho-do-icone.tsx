import { COR_DA_ACAO_ESCURA, COR_DO_PAPEL, COR_DO_PAPEL_ESCURO } from "@/lib/marca";

// O DESENHO DO ÍCONE, num lugar só (docs/specs/2026-11-24-celular-onda-1.md, "O ícone e o manifesto"). O
// app/icon.tsx (a aba e a tela inicial do Android) e o app/apple-icon.tsx (a tela de início do iPhone) desenham
// isto, cada um no seu tamanho. Quando vier um logo de verdade, troca-se só este arquivo: os endereços liberados
// no porteiro (proxy.ts) continuam os mesmos.
//
// O "M." É UM DESENHO, E NÃO UMA LETRA, pela decisão do Victor de 25/11 ("Desenhar o M."): o ImageResponse só traz
// a fonte Geist, e a da marca (a IBM Plex Sans 600) pediria um arquivo de fonte no repositório (o achado 336). Ele
// fica parecido com a marca "MetodoChat." da tela (app/app-shell.tsx:183), mas não idêntico.
//
// AS MEDIDAS ESTÃO NUM QUADRADO DE 100. O "M." ocupa de 18 a 80 na largura e de 30 a 70 na altura: fica dentro dos
// 80% do meio (de 10 a 90), que é o que o Android não corta quando recorta o ícone em círculo (o `maskable` do
// manifesto). O fundo é cheio, sem borda nem canto arredondado: quem arredonda é o sistema do celular.
export const DESENHO_DO_M =
  "M18 70 V30 H28 L42 52 L56 30 H66 V70 H56 V46 L45 63 H39 L28 46 V70 Z";
export const PONTO = { cx: 75, cy: 65, r: 5 };

/** O ícone inteiro, no lado pedido (em px), para o `ImageResponse`. */
export function desenhoDoIcone(lado: number) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COR_DO_PAPEL_ESCURO,
      }}
    >
      <svg width={lado} height={lado} viewBox="0 0 100 100">
        <path d={DESENHO_DO_M} fill={COR_DO_PAPEL} />
        <circle cx={PONTO.cx} cy={PONTO.cy} r={PONTO.r} fill={COR_DA_ACAO_ESCURA} />
      </svg>
    </div>
  );
}
