import "server-only";
import { NextResponse } from "next/server";
import { resolverConta } from "./arte-conta";
import { comEspaco, escolhasDaArte } from "./arte-escolhas";
import { fotoDoEspaco, fotosDaInstancia } from "./arte-foto";
import { respostaDaArte } from "./arte-resposta";
import type { SlideParaArte } from "./arte-slides";
import { cabecalhoDaConta, nomeDoArquivo } from "./arte-tela";
import { TEXTO_ARTE_SEM_CONTA, TEXTO_ARTE_SEM_DESENHO, TEXTO_ARTE_SEM_FONTE } from "./arte-textos";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { contasParaArte } from "./carrossel-repositorio";
import { fotosDaArte, versaoDoDesenho } from "./publicar-regras";

// O DESENHO DE UM SLIDE, COMUM ÀS DUAS ROTAS DA ARTE (spec da Etapa 7): a do carrossel de bônus
// (app/bonus/[id]/carrossel/[cid]/arte/route.tsx) e a do avulso (app/carrosseis/[cid]/arte/route.tsx).
// Cada rota confere a sessão, a origem e o slide (`conferirPedidoDaArte`), e chama isto; o que a arte
// desenha, e como (a conta, a foto da conta, a foto do espaço, a versão), mora num lugar só.
// tests/bonus-arte-paginas.test.ts confere as guardas das duas rotas e deste arquivo.

export function erroDaArte(status: number, texto: string): NextResponse {
  return NextResponse.json({ ok: false, erro: texto }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function desenharSlide(p: {
  linha: LinhaDoCarrossel;
  slides: SlideParaArte[];
  numero: number;
  /** A conta do cookie: a do cabeçalho quando o carrossel não tem conta gravada. */
  doCookie: string | undefined;
  baixar: boolean;
  /** O nome do arquivo baixado (`nomeDoArquivo`): o slug do bônus do Chat, ou o código do Labs. */
  slug: () => Promise<string | null>;
}): Promise<Response> {
  const { linha, slides, numero } = p;
  // A conta do cabeçalho é a do carrossel (arte-conta.ts): conectada, os dados atuais; desconectada,
  // o nome e o @ guardados, com as iniciais; sem conta gravada, a logada no Chat.
  const escolhas = escolhasDaArte(linha.arte, slides.length);
  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie);
  if (!conta) return erroDaArte(409, TEXTO_ARTE_SEM_CONTA);
  // A FOTO DO ESPAÇO (adendo da Etapa 5): só no slide com espaço, e só a do jeito "foto", que o
  // prefixo do caminho guardado diz (publicar-regras.ts). `fotoDoEspaco` confere o caminho na pasta da
  // conta do carrossel antes de buscar.
  const slide = slides[numero - 1];
  const espaco = comEspaco(escolhas, numero);
  const caminhoDaFoto = espaco ? (fotosDaArte(linha.arte, slides.length)[numero] ?? null) : null;
  // As fotos vêm da memória desta instância (arte-foto.ts): as miniaturas chegam juntas, e uma busca
  // só atende todas.
  const [foto, slug, daFoto] = await Promise.all([
    fotosDaInstancia.foto(conta.profile_picture_url),
    p.slug(),
    caminhoDaFoto ? fotoDoEspaco(caminhoDaFoto, escolhas.conta) : Promise.resolve(null),
  ]);

  // O PNG já sai lido inteiro (arte-resposta.tsx, achado 65): uma falha do desenho vira 500 com
  // frase, e não um 200 com o corpo quebrado. Emoji no texto faz o desenho buscar o emoji em
  // cdn.jsdelivr.net (achado 66); sem essa rede, o slide com emoji cai nesta frase.
  // A versão do desenho vai só no slide que sai com a arte do Chat: o "Só texto" e o com foto.
  const arte = await respostaDaArte({
    slide,
    comEspaco: espaco,
    cabecalho: cabecalhoDaConta(conta, foto),
    baixar: p.baixar,
    nomeDoArquivo: nomeDoArquivo(slug, numero),
    fotoDoEspaco: caminhoDaFoto ? { foto: daFoto } : null,
    versao: !espaco || caminhoDaFoto ? versaoDoDesenho(slide, caminhoDaFoto) : null,
  });
  if (!arte.ok) return erroDaArte(500, arte.falha === "fonte" ? TEXTO_ARTE_SEM_FONTE : TEXTO_ARTE_SEM_DESENHO);
  return arte.resposta;
}
