import "server-only";
import { ImageResponse } from "next/og";
import { desenhoDoSlide } from "./arte-desenho";
import { fontesDaArte, FAMILIA_DA_ARTE, type FonteDaArte } from "./arte-fonte";
import { ALTURA, LARGURA } from "./arte-geometria";
import { tamanhoDoSlide, type SlideParaArte } from "./arte-slides";
import { CABECALHO_DA_FOTO, CABECALHO_DA_VERSAO, cabecalhosDaArte, type CabecalhoDaArte } from "./arte-tela";

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
//
// A FOTO DO ESPAÇO (adendo da Etapa 5) segue a mesma regra: a que quebra o desenho sai, e o espaço
// fica em branco. Ela é a última a sair: a foto da conta quebrada não a leva junto. E A RESPOSTA DIZ SE
// ELA VEIO (achado 78): no slide com foto, `X-Arte-Foto` é "sim" ou "faltou". O publicar recusa a arte
// com "faltou", porque o post sairia sem a foto, em público e sem volta; a miniatura só se refaz.

/** Por que o slide não saiu: a rota troca cada motivo por uma frase (arte-textos.ts). */
export type FalhaDaArte = "fonte" | "desenho";

export type ArteDoSlide = { ok: true; resposta: Response } | { ok: false; falha: FalhaDaArte };

export async function respostaDaArte({
  slide,
  comEspaco,
  cabecalho,
  baixar,
  nomeDoArquivo,
  fotoDoEspaco = null,
  versao = null,
}: {
  slide: SlideParaArte;
  comEspaco: boolean;
  cabecalho: CabecalhoDaArte;
  baixar: boolean;
  nomeDoArquivo: string;
  /**
   * A foto do espaço do slide: `null` quando o slide não tem foto guardada (e o cabeçalho da foto não
   * vai); `{ foto: null }` quando tem, e a busca falhou; `{ foto }` com o `data:` da foto.
   */
  fotoDoEspaco?: { foto: string | null } | null;
  /** A versão do desenho (`versaoDoDesenho`), que vai no cabeçalho para o publicar a devolver. */
  versao?: string | null;
}): Promise<ArteDoSlide> {
  let fontes: FonteDaArte[];
  try {
    fontes = await fontesDaArte();
  } catch {
    return { ok: false, falha: "fonte" };
  }
  const { fonte } = tamanhoDoSlide(slide, comEspaco);

  const desenhar = async (cab: CabecalhoDaArte, foto: string | null): Promise<Response | null> => {
    const desenho = desenhoDoSlide({ slide, fonte, comEspaco, cabecalho: cab, familia: FAMILIA_DA_ARTE, fotoDoEspaco: foto });
    const imagem = new ImageResponse(desenho, {
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

  // AS TENTATIVAS, em ordem: a foto do espaço fica enquanto puder. Sem foto em nenhuma das duas, são
  // as duas de antes do adendo (com a foto da conta, e sem ela).
  const foto = fotoDoEspaco?.foto ?? null;
  const semAConta = { ...cabecalho, foto: null };
  const tentativas: [CabecalhoDaArte, string | null][] = [[cabecalho, foto]];
  if (cabecalho.foto) tentativas.push([semAConta, foto]);
  if (foto) tentativas.push([cabecalho, null]);
  if (foto && cabecalho.foto) tentativas.push([semAConta, null]);

  for (const [cab, comFoto] of tentativas) {
    const resposta = await desenhar(cab, comFoto);
    if (!resposta) continue;
    if (fotoDoEspaco) resposta.headers.set(CABECALHO_DA_FOTO, comFoto ? "sim" : "faltou");
    if (versao) resposta.headers.set(CABECALHO_DA_VERSAO, versao);
    return { ok: true, resposta };
  }
  return { ok: false, falha: "desenho" };
}
