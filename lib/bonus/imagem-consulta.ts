import "server-only";
import { resolverConta } from "./arte-conta";
import { escolhasDaArte } from "./arte-escolhas";
import { slidesDoTexto } from "./arte-slides";
import { cabecalhoParaVersao, versoesDosSlides } from "./arte-tela";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { contasParaArte } from "./carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
import { imagensNasUltimas24h, ultimasDoCarrossel } from "./imagem-repositorio";
import { estadoDaImagem } from "./imagem-regras";
import { TEXTO_IMAGEM_TRAVADA } from "./imagem-textos";
import { fotosDaArte, imagensDaArte } from "./publicar-regras";

// A CONSULTA DE UM SLIDE (spec da Etapa 6, "O acompanhar"), comum às duas rotas GET
// (app/bonus/[id]/carrossel/[cid]/imagem e app/carrosseis/[cid]/imagem), que só conferem a sessão e o
// carrossel e chamam daqui. O card pergunta a cada 2 s enquanto a imagem gera. SÓ LÊ.
//
// Pronta, a resposta traz a versão nova da miniatura, a mesma que a página desenharia ao recarregar
// (`versoesDosSlides`, com a foto do slide), e a versão do texto guardada com a imagem. A travada pelo
// prazo vira falha, com a frase dela.

export type ConsultaDaImagem =
  | { estado: "nenhuma" | "gerando"; hoje: number }
  | { estado: "pronta"; hoje: number; versao: string | null; versaoDaMiniatura: string }
  | { estado: "falhou"; hoje: number; texto: string };

export async function consultarImagem(p: { linha: LinhaDoCarrossel; numero: number; doCookie?: string }): Promise<ConsultaDaImagem> {
  const [{ agora, linhas }, hoje] = await Promise.all([ultimasDoCarrossel(p.linha.id), imagensNasUltimas24h()]);
  const estado = estadoDaImagem(linhas[p.numero] ?? null, agora);
  if (estado.tipo === "falhou") return { estado: "falhou", hoje, texto: estado.motivo };
  if (estado.tipo === "travada") return { estado: "falhou", hoje, texto: TEXTO_IMAGEM_TRAVADA };
  const texto = textoDaLinhaDoCarrossel(p.linha);
  if (estado.tipo !== "pronta" || !texto) return { estado: estado.tipo === "gerando" ? "gerando" : "nenhuma", hoje };
  const total = p.linha.total_slides;
  const escolhas = escolhasDaArte(p.linha.arte, total);
  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie);
  const versoes = versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(p.linha.arte, total));
  return {
    estado: "pronta",
    hoje,
    versao: imagensDaArte(p.linha.arte, total)[p.numero]?.versao ?? null,
    versaoDaMiniatura: versoes[p.numero - 1],
  };
}

/** A resposta da rota, em JSON e nunca em cache: o estado muda a cada geração. */
export function respostaDaConsulta(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store" } });
}
