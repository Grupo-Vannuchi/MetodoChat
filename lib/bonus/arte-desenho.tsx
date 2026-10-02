// O DESENHO DE UM SLIDE, em JSX para o Satori (o ImageResponse de next/og). PURO: recebe tudo
// pronto, e quem busca a foto e lê a fonte é a rota.
//
// TRAZIDO DO MÉTODO LABS (site-ia, src/app/admin/carrossel/arte/route.tsx, mudado por último em
// 19d25be, igual em 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de lá se
// traz para cá (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). O layout é o do manual
// de arte do perfil que o Eduardo levou ao Labs em 02/09: fundo branco, texto 100% preto, margem de
// 110, Carlito Regular e Bold, texto ancorado no topo, hierarquia por PESO e não por tamanho, e a
// linha de fechamento em negrito. As QUATRO diferenças, todas da spec:
// 1. sem ilustração: o espaço reservado sai EM BRANCO, sem a moldura tracejada nem o escrito do
//    Labs, para receber a imagem no Canva;
// 2. "só texto" é o `semIlustracao` do Labs: o bloco do espaço some;
// 3. sem tema escuro e sem selo de verificado;
// 4. o cabeçalho vem da conta do carrossel (arte-tela.ts), e não da foto do admin.
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
import { ALTURA_ILUSTRACAO, ENTRELINHA, MARGEM } from "./arte-geometria";
import type { SlideParaArte } from "./arte-slides";
import type { CabecalhoDaArte } from "./arte-tela";

/** Do fim do cabeçalho até a primeira linha de texto. Número do Labs. */
const GAP_CABECALHO = 48;
/** Da manchete ao corpo, medido como AVANÇO TOTAL, e não como espaço extra. Número do Labs. */
const AVANCO_MANCHETE = 77;
/** Entre parágrafos do corpo, inclusive antes da linha de fechamento. Número do Labs. */
const GAP_PARAGRAFO = 41;
/** Do fim do texto até o topo do espaço da imagem: o mesmo do cabeçalho, pela simetria (Labs, 39.2). */
const GAP_ILUSTRACAO = 48;
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
}: {
  slide: SlideParaArte;
  fonte: number;
  comEspaco: boolean;
  cabecalho: CabecalhoDaArte;
  familia: string;
}): ReactElement {
  // OS BLOCOS do corpo: a linha em branco separa o parágrafo, e o último bloco é a linha de
  // fechamento, em negrito, quando há mais de um.
  const blocos = slide.texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const noPe = slide.assinaturaNoPe;

  const tag = (
    <div style={{ display: "flex", alignItems: "center" }}>
      {cabecalho.foto ? (
        /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
           página: `next/image` renderiza um componente que ele não sabe ler. */
        <img src={cabecalho.foto} width={127} height={127} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
      ) : (
        <div
          style={{
            display: "flex",
            width: 127,
            height: 127,
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
        {slide.titulo && (
          <div
            style={{
              display: "flex",
              fontSize: fonte,
              fontWeight: 700,
              lineHeight: ENTRELINHA,
              letterSpacing: -0.4,
              marginBottom: Math.max(0, AVANCO_MANCHETE - Math.round(fonte * ENTRELINHA)),
            }}
          >
            {slide.titulo}
          </div>
        )}

        {blocos.map((bloco, i) => {
          const ultimo = i === blocos.length - 1;
          // Negrito no ÚLTIMO bloco quando há fechamento (mais de um bloco), e no bloco único sem
          // manchete acima: o gancho e a chamada, em que o texto É a peça.
          const negrito = ultimo && (blocos.length > 1 || !slide.titulo);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: fonte,
                fontWeight: negrito ? 700 : 400,
                lineHeight: ENTRELINHA,
                letterSpacing: negrito ? -0.4 : 0,
                marginBottom: ultimo ? 0 : GAP_PARAGRAFO,
              }}
            >
              {bloco.split("\n").map((linha, j) => (
                <div key={j} style={{ display: "flex" }}>
                  {linha}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* O ESPAÇO DA IMAGEM, EM BRANCO: é onde o operador põe a imagem no Canva. Some no "só texto". */}
      {comEspaco && <div style={{ display: "flex", marginTop: GAP_ILUSTRACAO, height: ALTURA_ILUSTRACAO, flexShrink: 0 }} />}

      {/* O ESPAÇADOR: cresce com o que sobra, e põe a folga na base (ou entre o espaço e a tag no pé). */}
      <div style={{ display: "flex", flex: 1 }} />

      {noPe && tag}
    </div>
  );
}
