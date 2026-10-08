// O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87). PURO: o card de cada slide, o card
// "Publicar" e o servidor contam aqui, pela mesma regra.
//
// A REGRA QUE VEIO DO LABS, "AVISA, NUNCA IMPEDE" (`slidesQueNaoCabem`, arte-slides.ts), continua
// valendo no editor: o card avisa, e salvar um slide que não cabe continua permitido. No publicar e no
// agendar ela deixa de valer (decisão do Eduardo em 08/10): ali o aviso vira uma imagem cortada na rede
// social, e um post não se desfaz. O arte-slides.ts não muda: a conta é a combinada com o Labs.
//
// A CONTA É A MESMA DO AVISO (`tamanhoDoSlide`), feita no modo em que o slide sai: o "Só texto" sem o
// espaço da imagem, e o com foto com o espaço. O slide pronto do Canva sai com a imagem dele, e não com
// a arte: nunca conta. O slide com espaço e sem imagem também não, porque o publicar já o recusa pela
// imagem que falta. Por isso o slide que o botão barra é sempre um slide que o card avisa.
import { textoDosCampos } from "./arte-cabimento";
import { slidesDoTexto, tamanhoDoSlide, type SlideParaArte } from "./arte-slides";
import { artesParaPublicar } from "./publicar-estado";
import type { JeitoDaImagem } from "./publicar-regras";

/**
 * COMO UM SLIDE SAI CORTADO: só encurtar resolve, ou marcar "Só texto" também resolve (o slide com foto
 * cujo texto cabe sem o espaço). A frase muda com isso: no "Só texto" a caixa já está marcada, e no
 * slide que não cabe nem sem o espaço ela não resolve.
 */
export type Corte = "encurtar" | "so_texto_resolve";

/** Um slide que sai com a arte do Chat (`artesParaPublicar`): o "Só texto" e o com foto no espaço. */
export type ArteQueSai = { numero: number; comFoto: boolean };

/** O corte de um slide no modo em que ele sai. Sem arte (o slide pronto, ou ainda sem imagem): nunca. */
export function corteDoSlide(s: SlideParaArte, arte: { comFoto: boolean } | null): Corte | null {
  if (arte === null || tamanhoDoSlide(s, arte.comFoto).cabe) return null;
  return arte.comFoto && tamanhoDoSlide(s, false).cabe ? "so_texto_resolve" : "encurtar";
}

/** Os slides que sairiam cortados, em ordem, e os que "Só texto" resolve: a forma da falta e da recusa. */
export type SlidesCortados = { slides: number[]; soTextoResolve: number[] };

/** Os cortes por número do slide, juntados na forma da falta. O `null` é o slide que não corta. */
export function juntarCortes(cortes: Record<number, Corte | null>): SlidesCortados {
  const slides = Object.keys(cortes)
    .map(Number)
    .filter((n) => cortes[n])
    .sort((a, b) => a - b);
  return { slides, soTextoResolve: slides.filter((n) => cortes[n] === "so_texto_resolve") };
}

/** NO SERVIDOR: os slides do texto salvo, e as artes que saem, como o publicar as conta. */
export function slidesQueSaemCortados(slides: SlideParaArte[], artes: ArteQueSai[]): SlidesCortados {
  const cortes: Record<number, Corte | null> = {};
  for (const a of artes) {
    const s = slides[a.numero - 1];
    cortes[a.numero] = s ? corteDoSlide(s, a) : null;
  }
  return juntarCortes(cortes);
}

/**
 * NA TELA: o corte do slide de um card, com o texto que está nos campos dele agora, o "Só texto" e o
 * jeito da imagem guardada. O botão "Publicar" já trava com qualquer card "não salvo": quando ele está
 * livre, o texto dos campos é o salvo, e a tela conta sobre o mesmo texto que o servidor.
 */
export function corteDoCard(p: {
  total: number;
  numero: number;
  valores: Record<string, string>;
  soTexto: boolean;
  jeito: JeitoDaImagem | null;
}): Corte | null {
  const s = slidesDoTexto(textoDosCampos(p.total, p.valores))[p.numero - 1];
  const arte = artesParaPublicar({
    total: p.total,
    soTexto: p.soTexto ? [p.numero] : [],
    imagens: p.jeito ? { [p.numero]: { jeito: p.jeito } } : {},
  }).find((a) => a.numero === p.numero);
  return s ? corteDoSlide(s, arte ?? null) : null;
}
