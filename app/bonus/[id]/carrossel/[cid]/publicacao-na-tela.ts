import type { OrigemDaConta } from "@/lib/bonus/arte-conta";
import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
import type { AvisoDaImagem, AvisoDaPublicacao, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";
import type { TomDoQuadro } from "@/lib/bonus/textos";

// O QUE A PÁGINA ENTREGA AO EDITOR PARA PUBLICAR (spec da Etapa 5). Tudo decidido no servidor
// (page.tsx): a tela só desenha. As actions entram por aqui para o teste de tela usar falsas.

/**
 * A imagem guardada num slide: o endereço público, a versão do texto e o jeito (adendo de 05/10). No
 * slide pronto, a miniatura é o endereço; no slide com foto, é a arte da rota, com a foto no espaço.
 */
export type ImagemNaTela = { url: string | null; versao: string; jeito: JeitoDaImagem };

export type PublicacaoNaTela = {
  acaoDaAssinatura: (pedido: unknown) => Promise<RespostaDaAssinatura>;
  acaoDaImagem: (pedido: unknown) => Promise<AvisoDaImagem>;
  acaoDaPublicacao: (pedido: unknown) => Promise<AvisoDaPublicacao>;
  imagens: Record<number, ImagemNaTela>;
  /**
   * A versão do texto salvo de cada slide (`versaoDoTextoDoSlide`), na ordem: o card a compara com a
   * do slide pronto, para o aviso "o texto mudou". O publicar não a usa: a versão que vai é a da rota.
   */
  versoesDoTexto: string[];
  /** A frase da trava, quando o carrossel está na fila ou publicado; `null` quando está livre. */
  travado: string | null;
  origem: OrigemDaConta;
  arroba: string | null;
  estado: { texto: string | null; tom: TomDoQuadro | null; filaId: string | null; livre: boolean };
  /** "Para ver no calendário, selecione … no menu", quando a conta do menu é outra. */
  avisoDoCalendario: string | null;
};
