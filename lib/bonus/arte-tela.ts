// O QUE A ROTA DA ARTE E A TELA DECIDEM, fora do JSX e da rota. PURO.
import { iniciais, type ContaDoCabecalho } from "./arte-conta";
import { slidesDoTexto, type SlideParaArte } from "./arte-slides";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVALIDO } from "./arte-textos";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";

/** O cabeçalho da peça: a "tag" do manual de arte (foto redonda, nome e @). */
export type CabecalhoDaArte = { nome: string; arroba: string; foto: string | null; iniciais: string };

/** O número do slide pedido na URL: só dígitos, sem zero à esquerda, de 1 ao total. */
export function numeroDoSlide(v: string | null, total: number): number | null {
  if (!v || !/^[1-9]\d*$/.test(v)) return null;
  const n = Number(v);
  return n <= total ? n : null;
}

/**
 * O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é do
 * bônus da URL; está pronto, com texto de forma válida (o revisado, ou o gerado); e o slide pedido
 * existe nele. Fora da rota para cada recusa ter teste: a integração só alcança a rota sem sessão.
 */
export function conferirPedidoDaArte(
  linha: LinhaDoCarrossel | null,
  bonusId: string,
  slide: string | null
):
  | { ok: true; linha: LinhaDoCarrossel; slides: SlideParaArte[]; numero: number }
  | { ok: false; status: 400 | 404 | 409; texto: string } {
  if (!linha || linha.bonus_id !== bonusId) return { ok: false, status: 404, texto: TEXTO_ARTE_NAO_ENCONTRADA };
  const texto = linha.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
  if (!texto) return { ok: false, status: 409, texto: TEXTO_ARTE_NAO_PRONTA };
  const slides = slidesDoTexto(texto);
  const numero = numeroDoSlide(slide, slides.length);
  if (!numero) return { ok: false, status: 400, texto: TEXTO_ARTE_SLIDE_INVALIDO };
  return { ok: true, linha, slides, numero };
}

/**
 * O nome do arquivo baixado: o endereço do bônus e o número do slide com dois dígitos, para os
 * arquivos ficarem em ordem na pasta. Ele vai para dentro de um cabeçalho HTTP, então só passam
 * letras minúsculas, números e hífen.
 */
export function nomeDoArquivo(slug: string | null, numero: number): string {
  const limpo = (slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${limpo || "carrossel"}-slide-${String(numero).padStart(2, "0")}.png`;
}

/**
 * ⚠️ NUNCA `public` (achado 59): fora do desenvolvimento, o ImageResponse de next/og responde
 * `public, max-age=0, must-revalidate`, e os `headers` passados a ele sobrescrevem esse padrão.
 * A imagem tem texto do painel e está atrás de sessão: não fica em cache nenhum.
 */
export function cabecalhosDaArte(baixar: boolean, nome: string): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    "Content-Disposition": baixar ? `attachment; filename="${nome}"` : "inline",
  };
}

/** Sem nome, o @ faz as vezes de nome. As iniciais saem do que estiver no nome. */
export function cabecalhoDaConta(c: ContaDoCabecalho, foto: string | null): CabecalhoDaArte {
  const nome = c.name?.trim() || c.username || "";
  return { nome, arroba: c.username ?? "", foto, iniciais: iniciais(nome, "IG") };
}

/**
 * O cabeçalho que a versão das miniaturas resume: o da conta, com a URL da foto no lugar do `data:`
 * que só a rota tem. A página e a action de salvar o usam, para as duas darem a mesma versão.
 */
export function cabecalhoParaVersao(conta: ContaDoCabecalho | null): CabecalhoDaArte {
  return conta ? cabecalhoDaConta(conta, conta.profile_picture_url) : { nome: "", arroba: "", foto: null, iniciais: "IG" };
}

/**
 * A VERSÃO DA PRÉVIA: um resumo curto (FNV-1a de 32 bits) de TUDO o que muda a imagem. A `<img>` só
 * pede de novo quando a URL muda, e a rota responde `no-store`, então é esta versão que decide se a
 * miniatura troca. A rota ignora o parâmetro.
 */
export function versaoDaArte(partes: (string | number | null)[]): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(partes)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * A VERSÃO DE CADA MINIATURA (spec da Etapa 4): o resumo de tudo o que a rota desenha NAQUELE slide
 * (o slide inteiro, com número, total, tipo, manchete e texto; se ele é só texto) e do cabeçalho, que é
 * de todos. Salvar o slide 2 muda só a versão 2, e só a miniatura 2 é pedida de novo. Até a Etapa 3
 * a versão era uma só, e qualquer gravação pedia as miniaturas todas.
 *
 * O `foto` do cabeçalho, aqui, é a URL da foto (a página não tem o `data:` que a rota desenha): a
 * miniatura troca quando a Meta troca a foto.
 */
export function versoesDosSlides(slides: SlideParaArte[], soTexto: number[], cabecalho: CabecalhoDaArte): string[] {
  return slides.map((s) =>
    versaoDaArte([
      JSON.stringify(s),
      soTexto.includes(s.numero) ? "so_texto" : "com_espaco",
      cabecalho.nome,
      cabecalho.arroba,
      cabecalho.foto,
      cabecalho.iniciais,
    ])
  );
}

export function urlDaArte(bonusId: string, carrosselId: string, numero: number, versao: string, baixar = false): string {
  return `/bonus/${bonusId}/carrossel/${carrosselId}/arte?slide=${numero}&v=${versao}${baixar ? "&baixar=1" : ""}`;
}
