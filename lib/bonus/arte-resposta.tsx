import "server-only";
import { ImageResponse } from "next/og";
import { desenhoDoSlide } from "./arte-desenho";
import { fontesDaArte, FAMILIA_DA_ARTE, type FonteDaArte } from "./arte-fonte";
import { ALTURA, LARGURA } from "./arte-geometria";
import { tamanhoDoSlide, type SlideParaArte } from "./arte-slides";
import { cabecalhosDaArte, type CabecalhoDaArte } from "./arte-tela";

// O PNG DE UM SLIDE: o desenho, a fonte e os cabeçalhos da resposta, juntos. A rota decide o que
// desenhar; isto desenha. Separado da rota para o teste desenhar de verdade sem sessão nem banco
// (tests/bonus-arte-resposta.test.ts).
//
// A FONTE DO TEXTO É ESCOLHIDA SOBRE A COMPOSIÇÃO DO SLIDE (arte-composicao.ts), a mesma que o desenho
// desenha e que o aviso "não cabe" mede (arte-slides.ts, `tamanhoDoSlide`). `comEspaco` é o
// `!semIlustracao` do Labs.
//
// O PNG É LIDO INTEIRO AQUI, antes de a rota responder (achado 65). O ImageResponse fixa o status
// 200 antes de desenhar, porque o desenho roda dentro do stream do corpo: uma falha no meio sairia
// como 200 com o corpo quebrado, e a miniatura, quebrada sem frase. Lido aqui, o erro aparece, e
// volta como motivo. As falhas conhecidas: a foto que passa pelos bytes iniciais e não é imagem
// (então o slide sai de novo com as iniciais, como uma conta sem foto), e o emoji, cujo desenho o
// next/og busca em cdn.jsdelivr.net no meio do desenho (achado 66; sem opção para desligar).

/** Por que o slide não saiu: a rota troca cada motivo por uma frase (arte-textos.ts). */
export type FalhaDaArte = "fonte" | "desenho";

export type ArteDoSlide = { ok: true; resposta: Response } | { ok: false; falha: FalhaDaArte };

export async function respostaDaArte({
  slide,
  comEspaco,
  cabecalho,
  baixar,
  nomeDoArquivo,
}: {
  slide: SlideParaArte;
  comEspaco: boolean;
  cabecalho: CabecalhoDaArte;
  baixar: boolean;
  nomeDoArquivo: string;
}): Promise<ArteDoSlide> {
  let fontes: FonteDaArte[];
  try {
    fontes = await fontesDaArte();
  } catch {
    return { ok: false, falha: "fonte" };
  }
  const { fonte } = tamanhoDoSlide(slide, comEspaco);

  const desenhar = async (cab: CabecalhoDaArte): Promise<Response | null> => {
    const imagem = new ImageResponse(desenhoDoSlide({ slide, fonte, comEspaco, cabecalho: cab, familia: FAMILIA_DA_ARTE }), {
      width: LARGURA,
      height: ALTURA,
      fonts: fontes,
      headers: cabecalhosDaArte(baixar, nomeDoArquivo),
    });
    try {
      const png = await imagem.arrayBuffer();
      return new Response(png, { status: imagem.status, headers: imagem.headers });
    } catch {
      return null;
    }
  };

  const resposta = (await desenhar(cabecalho)) ?? (cabecalho.foto ? await desenhar({ ...cabecalho, foto: null }) : null);
  return resposta ? { ok: true, resposta } : { ok: false, falha: "desenho" };
}
