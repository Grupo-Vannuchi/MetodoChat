// O DESENHO DA CAPA (spec da Etapa 11, "O desenho da capa", o modelo A), em JSX para o Satori, no molde
// de arte-desenho.tsx. PURO: recebe tudo pronto, e quem busca a imagem e lê a fonte é a rota.
//
// A imagem ocupa o slide inteiro, recortada ao centro (`cover`); uma sombra sobe do pé e outra, leve,
// desce do topo; a conta vai pequena no topo, e o gancho, grande, embaixo, alinhado à esquerda, acima da
// margem do pé. Sem imagem, o fundo é escuro e liso, para o desenho e o "não cabe" aparecerem antes.
//
// ⚠️ DESENHA A COMPOSIÇÃO DA CAPA (capa-medida.ts), linha a linha, e não o texto cru: é a mesma lista que
// a conta do "não cabe" mede, já em maiúscula. Uma caixa por LINHA, e nunca `whiteSpace: "pre-wrap"`
// (arte-desenho.tsx, o que não se mexe), e `flexShrink: 0` no bloco do gancho.
//
// ⚠️ O Satori entende um subconjunto de flexbox com estilo em linha: todo `div` com mais de um filho
// precisa de `display: "flex"`. As camadas são `position: "absolute"`, uma sobre a outra.
import type { ReactElement } from "react";
import { ALTURA, espacoAntes, LARGURA, MARGEM } from "./arte-geometria";
import type { SlideParaArte } from "./arte-slides";
import type { CabecalhoDaArte } from "./arte-tela";
import {
  ENTRELINHA_DA_CAPA,
  FONTE_DO_ARROBA_NA_CAPA,
  FONTE_DO_NOME_NA_CAPA,
  FUNDO_DA_CAPA_SEM_IMAGEM,
  LADO_DA_CONTA_NA_CAPA,
  SOMBRA_DO_PE,
  SOMBRA_DO_TOPO,
  TEXTO_DA_CAPA,
} from "./capa-geometria";
import { composicaoDaCapa } from "./capa-medida";

/** O fundo das iniciais quando a foto da conta não vem: o azul do Instagram, como na arte de hoje. */
const AZUL_DAS_INICIAIS = "#3797F0";

const CAMADA = { position: "absolute", top: 0, left: 0, width: LARGURA, height: ALTURA, display: "flex" } as const;

const sombra = (direcao: "to top" | "to bottom", opacidade: number, ate: number) =>
  `linear-gradient(${direcao}, rgba(0, 0, 0, ${opacidade}) 0%, rgba(0, 0, 0, 0) ${Math.round(ate * 100)}%)`;

export function desenhoDaCapa({
  slide,
  fonte,
  cabecalho,
  familia,
  imagem = null,
}: {
  slide: SlideParaArte;
  fonte: number;
  cabecalho: CabecalhoDaArte;
  familia: string;
  /** A imagem da capa, como `data:` (a rota busca; arte-foto.ts). Sem ela, o fundo escuro liso. */
  imagem?: string | null;
}): ReactElement {
  const linhas = composicaoDaCapa(slide.texto);

  const conta = (
    <div style={{ display: "flex", alignItems: "center" }}>
      {cabecalho.foto ? (
        /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
           página: `next/image` renderiza um componente que ele não sabe ler. */
        <img
          src={cabecalho.foto}
          width={LADO_DA_CONTA_NA_CAPA}
          height={LADO_DA_CONTA_NA_CAPA}
          style={{ borderRadius: 999, objectFit: "cover" }}
          alt=""
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: LADO_DA_CONTA_NA_CAPA,
            height: LADO_DA_CONTA_NA_CAPA,
            borderRadius: 999,
            background: AZUL_DAS_INICIAIS,
            fontSize: 28,
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {cabecalho.iniciais}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 18 }}>
        <div style={{ display: "flex", fontSize: FONTE_DO_NOME_NA_CAPA, fontWeight: 700 }}>{cabecalho.nome}</div>
        {cabecalho.arroba && <div style={{ display: "flex", fontSize: FONTE_DO_ARROBA_NA_CAPA }}>@{cabecalho.arroba}</div>}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: FUNDO_DA_CAPA_SEM_IMAGEM,
        color: TEXTO_DA_CAPA,
        fontFamily: familia,
      }}
    >
      {imagem ? (
        /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
           página: `next/image` renderiza um componente que ele não sabe ler. */
        <img src={imagem} width={LARGURA} height={ALTURA} style={{ ...CAMADA, objectFit: "cover" }} alt="" />
      ) : null}
      <div style={{ ...CAMADA, backgroundImage: sombra("to top", SOMBRA_DO_PE.opacidade, SOMBRA_DO_PE.ate) }} />
      <div style={{ ...CAMADA, backgroundImage: sombra("to bottom", SOMBRA_DO_TOPO.opacidade, SOMBRA_DO_TOPO.ate) }} />
      <div style={{ ...CAMADA, flexDirection: "column", padding: MARGEM }}>
        {conta}
        {/* O ESPAÇADOR: empurra o gancho para baixo, até a margem do pé. */}
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {linhas.map((linha, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                fontSize: fonte,
                fontWeight: 700,
                lineHeight: ENTRELINHA_DA_CAPA,
                letterSpacing: linha.espacamento,
                marginTop: espacoAntes(linha.antes, fonte),
              }}
            >
              {linha.texto}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
