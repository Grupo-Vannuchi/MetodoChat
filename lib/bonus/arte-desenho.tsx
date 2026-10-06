// O DESENHO DE UM SLIDE, em JSX para o Satori (o ImageResponse de next/og). PURO: recebe tudo
// pronto, e quem busca a foto e lê a fonte é a rota.
//
// VEIO DO MÉTODO LABS (site-ia, src/app/admin/carrossel/arte/route.tsx, em 45bc973). DOIS DONOS: o
// mesmo desenho nos dois projetos é conferido pelos vetores (tests/vetores-da-arte.json), que cada
// lado desenha no próprio Satori (spec da Etapa 4, "Dois donos"). O layout é o do manual
// de arte do perfil que o Eduardo levou ao Labs em 02/09: fundo branco, texto 100% preto, margem de
// 110, Carlito Regular e Bold, texto ancorado no topo, hierarquia por PESO e não por tamanho, e a
// linha de fechamento em negrito. As QUATRO diferenças, todas da spec:
// 1. sem ilustração: o espaço reservado sai EM BRANCO, sem a moldura tracejada nem o escrito do
//    Labs, para receber a imagem no Canva; ou com a FOTO do slide (adendo da Etapa 5), cortada para
//    preencher (`cover`), sem borda e sem canto. O Labs desenha a ilustração com `contain`: as duas
//    dão o mesmo resultado quando a imagem já vem na proporção do espaço, que é o caso das duas;
// 2. "só texto" é o `semIlustracao` do Labs: o bloco do espaço some;
// 3. sem tema escuro e sem selo de verificado;
// 4. o cabeçalho vem da conta do carrossel (arte-tela.ts), e não da foto do admin.
//
// ⚠️ DESENHA A COMPOSIÇÃO (arte-composicao.ts), linha a linha, e não o texto cru: é a mesma lista que
// a conta do "não cabe" mede (arte-medida.ts). O negrito, o espaçamento, a normalização e o espaço
// acima de cada linha saem de lá, e nada disso se decide aqui. Os espaços são os da geometria.
//
// ⚠️ O QUE NÃO SE MEXE, cada item com um defeito datado atrás no ROADMAP do Labs: uma caixa por
// LINHA, e nunca `whiteSpace: "pre-wrap"` (o Satori desenha o `\n` e não o conta na altura, e as
// linhas se sobrepunham: Etapa 38.1); `flexShrink: 0` no texto e no espaço da imagem (sem ele o
// corte fica escondido em vez de visível); e o espaçador DEPOIS do espaço da imagem, que põe a
// sobra na base (39.2).
//
// ⚠️ O Satori entende um subconjunto de flexbox com estilo em linha: todo `div` com mais de um
// filho precisa de `display: "flex"`. Por isso as cores estão escritas aqui.
import type { ReactElement } from "react";
import { composicaoDoSlide } from "./arte-composicao";
import {
  ALTURA_ILUSTRACAO,
  ENTRELINHA,
  espacoAntes,
  GAP_CABECALHO,
  GAP_ILUSTRACAO,
  LADO_DO_AVATAR,
  LARGURA_UTIL,
  MARGEM,
} from "./arte-geometria";
import type { SlideParaArte } from "./arte-slides";
import type { CabecalhoDaArte } from "./arte-tela";

/** O fundo das iniciais quando a foto não vem: o azul do Instagram, como no Labs. */
const AZUL_DAS_INICIAIS = "#3797F0";
/** A paleta clara do Labs, a única aqui: texto 100% preto em fundo branco. */
const FUNDO = "#FFFFFF";
const TEXTO = "#000000";

export function desenhoDoSlide({
  slide,
  fonte,
  comEspaco,
  cabecalho,
  familia,
  fotoDoEspaco = null,
}: {
  slide: SlideParaArte;
  fonte: number;
  comEspaco: boolean;
  cabecalho: CabecalhoDaArte;
  familia: string;
  /** A foto do espaço, como `data:` (a rota busca; arte-foto.ts). Sem ela, o espaço sai em branco. */
  fotoDoEspaco?: string | null;
}): ReactElement {
  const linhas = composicaoDoSlide(slide.titulo, slide.texto);
  const noPe = slide.assinaturaNoPe;

  const tag = (
    <div style={{ display: "flex", alignItems: "center" }}>
      {cabecalho.foto ? (
        /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
           página: `next/image` renderiza um componente que ele não sabe ler. */
        <img src={cabecalho.foto} width={LADO_DO_AVATAR} height={LADO_DO_AVATAR} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
      ) : (
        <div
          style={{
            display: "flex",
            width: LADO_DO_AVATAR,
            height: LADO_DO_AVATAR,
            borderRadius: 999,
            background: AZUL_DAS_INICIAIS,
            color: "#FFFFFF",
            fontSize: 48,
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {cabecalho.iniciais}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 26 }}>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, letterSpacing: -0.5 }}>{cabecalho.nome}</div>
        {cabecalho.arroba && <div style={{ display: "flex", fontSize: 34, marginTop: 4 }}>@{cabecalho.arroba}</div>}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: FUNDO,
        color: TEXTO,
        fontFamily: familia,
        padding: MARGEM,
      }}
    >
      {!noPe && tag}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          justifyContent: "flex-start",
          paddingTop: noPe ? 0 : GAP_CABECALHO,
          paddingBottom: noPe ? GAP_CABECALHO : 0,
        }}
      >
        {linhas.map((linha, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontSize: fonte,
              fontWeight: linha.negrito ? 700 : 400,
              lineHeight: ENTRELINHA,
              letterSpacing: linha.espacamento,
              marginTop: espacoAntes(linha.antes, fonte),
            }}
          >
            {linha.texto}
          </div>
        ))}
      </div>

      {/* O ESPAÇO DA IMAGEM: em branco, onde o operador põe a imagem no Canva, ou com a foto do slide,
          que o preenche até os cantos. Some no "só texto". */}
      {comEspaco && (
        <div style={{ display: "flex", marginTop: GAP_ILUSTRACAO, height: ALTURA_ILUSTRACAO, flexShrink: 0 }}>
          {fotoDoEspaco ? (
            /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
               página: `next/image` renderiza um componente que ele não sabe ler. */
            <img src={fotoDoEspaco} width={LARGURA_UTIL} height={ALTURA_ILUSTRACAO} style={{ objectFit: "cover" }} alt="" />
          ) : null}
        </div>
      )}

      {/* O ESPAÇADOR: cresce com o que sobra, e põe a folga na base (ou entre o espaço e a tag no pé). */}
      <div style={{ display: "flex", flex: 1 }} />

      {noPe && tag}
    </div>
  );
}
