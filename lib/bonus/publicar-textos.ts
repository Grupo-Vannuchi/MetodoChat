import type { Aviso } from "@/lib/avisos";
import { fmtDate } from "@/lib/format";
import type { EstadoDaPublicacao, FaltaParaPublicar } from "./publicar-estado";
import type { ProblemaDaFoto, ProblemaDaProporcao } from "./publicar-regras";
import type { TomDoQuadro } from "./textos";

// AS FRASES DA PUBLICAÇÃO DO CARROSSEL, fora do JSX e das actions (o princípio de
// lib/bonus/textos.ts): uma saída muda é indistinguível de sucesso, e cada saída tem frase, testada.

/** "o slide 2", "os slides 2 e 5", "os slides 2, 3 e 5". */
export function listaDeSlides(numeros: number[]): string {
  if (numeros.length === 1) return `o slide ${numeros[0]}`;
  return `os slides ${numeros.slice(0, -1).join(", ")} e ${numeros[numeros.length - 1]}`;
}

const doSlides = (numeros: number[]) => listaDeSlides(numeros).replace(/^os /, "dos ").replace(/^o /, "do ");

/** O estado no lugar do botão "Publicar". `null` quando o carrossel nunca foi mandado. */
export function textoDoEstadoDaPublicacao(e: EstadoDaPublicacao): string | null {
  switch (e.tipo) {
    case "livre":
      return null;
    case "agendado":
      return `Agendado para ${fmtDate(e.quando)} (horário de Brasília).`;
    case "publicando":
      return "Publicando. O Instagram leva até um minuto: recarregue a página para ver.";
    case "publicado":
      return e.em ? `Publicado em ${fmtDate(e.em)}.` : "Publicado.";
    case "falhou":
      return e.motivo
        ? `Não publicou: ${e.motivo.replace(/\.$/, "")}. Dá para publicar de novo.`
        : "Não publicou, e a fila não disse o motivo. Dá para publicar de novo.";
    case "cancelado":
      return "Cancelado no calendário. Dá para publicar de novo.";
    case "nao_entrou":
      return "A última tentativa não entrou na fila. Dá para publicar de novo.";
    case "saiu_da_fila":
      return "O registro deste post saiu da fila. A conta foi desconectada? O carrossel segue travado, para não publicar duas vezes.";
    case "desconhecido":
      return "O post deste carrossel está num estado que o Chat não reconhece. O carrossel segue travado: avise quem cuida do Chat.";
  }
}

/** A cor do estado na página: verde quando deu certo, amarelo quando espera, vermelho quando falhou. */
export function tomDoEstadoDaPublicacao(e: EstadoDaPublicacao): TomDoQuadro | null {
  switch (e.tipo) {
    case "livre":
      return null;
    case "agendado":
    case "publicado":
      return "ok";
    case "publicando":
    case "cancelado":
    case "nao_entrou":
      return "atencao";
    default:
      return "erro";
  }
}

/** Por que uma edição foi recusada: o carrossel está na fila, ou já saiu. */
export function textoDaTrava(e: EstadoDaPublicacao): string {
  switch (e.tipo) {
    case "agendado":
      return "Agendado: para mudar, cancele no calendário.";
    case "publicando":
      return "Publicando: o carrossel não muda até o post sair.";
    case "publicado":
      return "Este carrossel já foi publicado, e fica só para leitura.";
    default:
      return textoDoEstadoDaPublicacao(e) ?? "";
  }
}

/** O calendário do /publicar mostra só a conta selecionada no menu. */
export function textoDoCalendario(rotuloDaConta: string): string {
  return `Para ver no calendário, selecione ${rotuloDaConta} no menu.`;
}

export const TEXTO_SEM_CONTA_PARA_PUBLICAR =
  'Este carrossel é de antes de a conta ser gravada. Use "Fixar nesta conta" antes de publicar.';
export const TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR = "A conta deste carrossel foi desconectada do Chat. Conecte de novo para publicar.";
export const TEXTO_TEXTO_MUDOU = "O texto mudou depois desta imagem.";
export const TEXTO_IMAGEM_GUARDADA = "Imagem guardada.";

// O que o navegador recusa antes de subir (app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts).
export const TEXTO_IMAGEM_ILEGIVEL = "Não consegui abrir esta imagem. Exporte de novo do Canva, em JPEG ou PNG.";
export const TEXTO_FORMATO_DA_IMAGEM = "Envie a imagem do Canva em JPEG, PNG ou WEBP.";

export function textoDaArteQueNaoVeio(numero: number): string {
  return `Não consegui preparar a arte do slide ${numero}. Recarregue a página e publique de novo.`;
}

export function textoDaFalta(f: FaltaParaPublicar): string {
  switch (f.tipo) {
    case "sem_conta":
      return TEXTO_SEM_CONTA_PARA_PUBLICAR;
    case "conta_desconectada":
      return TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR;
    case "imagens":
      return `Falta a imagem ${doSlides(f.slides)}.`;
    case "nao_salvo": {
      const partes = [...(f.slides.length ? [listaDeSlides(f.slides)] : []), ...(f.legenda ? ["a legenda"] : [])];
      return `Salve ${partes.join(" e ")} antes de publicar.`;
    }
  }
}

export function textoDaProporcao(p: ProblemaDaProporcao): string {
  return p === "proporcao"
    ? "A imagem do slide tem de ser 4:5, como a arte (1080×1350)."
    : "Não consegui ler o tamanho da imagem. Exporte de novo do Canva e tente outra vez.";
}

/**
 * A FOTO DO ESPAÇO DA ARTE que não serve (adendo de 05/10). O navegador recorta e reduz antes de
 * subir: a proporção e o "grande" só aparecem num pedido montado à mão ou numa página velha.
 */
export function textoDoProblemaDaFoto(p: ProblemaDaFoto): string {
  switch (p) {
    case "sem_medida":
      return "Não consegui ler o tamanho da foto. Tente outra foto.";
    case "proporcao":
      return "A foto tem de chegar cortada no formato do espaço da arte (860×573). Recarregue a página e tente de novo.";
    case "pequena":
      return "A foto é pequena para o espaço da arte: o mínimo é 860×573.";
    case "grande":
      return "A foto tem de chegar reduzida a no máximo 1720×1146. Recarregue a página e tente de novo.";
    case "pesada":
      return "A foto passou de 2 MB mesmo reduzida. Tente outra foto, ou exporte esta com menos qualidade.";
  }
}

/** As recusas de assinar, guardar e publicar (publicar-processo.ts). */
export type RecusaDaPublicacaoDoCarrossel =
  | { motivo: "nao_pronto" }
  | { motivo: "sem_conta" }
  | { motivo: "conta_desconectada" }
  | { motivo: "travado"; estado: EstadoDaPublicacao }
  | { motivo: "slide" }
  | { motivo: "sem_espaco"; numero: number }
  | { motivo: "nao_e_so_texto"; numero: number }
  | { motivo: "tipo" }
  | { motivo: "proporcao"; problema: ProblemaDaProporcao }
  | { motivo: "arquivo"; texto: string }
  | { motivo: "caminho" }
  | { motivo: "faltam_imagens"; slides: number[] }
  | { motivo: "arte_so_texto"; numero: number }
  | { motivo: "arte_velha"; numero: number }
  | { motivo: "caminho_na_fila" }
  | { motivo: "legenda"; texto: string }
  | { motivo: "quantidade"; texto: string }
  | { motivo: "copia"; numero: number }
  | { motivo: "mudou" }
  | { motivo: "fila" }
  | { motivo: "armazenamento"; texto: string };

export function textoDaRecusaDaPublicacaoDoCarrossel(r: RecusaDaPublicacaoDoCarrossel): string {
  switch (r.motivo) {
    case "nao_pronto":
      return "A publicação só existe para carrossel pronto, com o texto conferido.";
    case "sem_conta":
      return TEXTO_SEM_CONTA_PARA_PUBLICAR;
    case "conta_desconectada":
      return TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR;
    case "travado":
      return textoDaTrava(r.estado);
    case "slide":
      return "Esse slide não existe neste carrossel. Recarregue a página.";
    case "sem_espaco":
      return `O slide ${r.numero} está marcado como "só texto": ele sai com a arte do Chat, sem imagem do Canva.`;
    case "nao_e_so_texto":
      return `O slide ${r.numero} tem espaço de imagem: ele sai com a imagem do Canva, e não com a arte do Chat.`;
    case "tipo":
      return "A imagem tem de chegar em JPEG. Recarregue a página e tente de novo.";
    case "proporcao":
      return textoDaProporcao(r.problema);
    case "arquivo":
      return r.texto;
    case "caminho":
      return "O endereço da imagem não é deste carrossel. Recarregue a página e suba de novo.";
    case "faltam_imagens":
      return `Falta a imagem ${doSlides(r.slides)}.`;
    case "arte_so_texto":
      return `A arte do slide ${r.numero} não chegou. Recarregue a página e publique de novo.`;
    case "arte_velha":
      return `O texto do slide ${r.numero} mudou enquanto a arte era preparada. Publique de novo.`;
    case "caminho_na_fila":
      return "Uma das imagens já está na fila de outro post. Recarregue a página e publique de novo.";
    case "legenda":
    case "quantidade":
      return r.texto;
    case "copia":
      return `Não consegui preparar a imagem do slide ${r.numero} para a fila. Nada foi publicado; tente de novo em instantes.`;
    case "mudou":
      return "O carrossel mudou enquanto a publicação era preparada. Confira e publique de novo.";
    case "fila":
      return "Não consegui pôr o post na fila. Nada foi publicado; tente de novo.";
    case "armazenamento":
      return `Não consegui falar com o armazenamento das imagens: ${r.texto.replace(/\.$/, "")}.`;
  }
}

/** O pedido que chegou à action sem a forma que a tela manda: página velha, ou montado à mão. */
export const TEXTO_PEDIDO_INVALIDO = "O pedido chegou incompleto. Recarregue a página e tente de novo.";

/** O "Publicar" deu certo: o post está na fila, e não publicado ainda. */
export function textoDaPublicacaoMandada(agendada: boolean): string {
  return agendada
    ? "Agendado. O post está no calendário do /publicar."
    : "Na fila do /publicar. O Instagram leva até um minuto para mostrar o post.";
}

/** A resposta de assinar: o caminho e a URL assinada, ou a frase da recusa. */
export type RespostaDaAssinatura = { ok: true; caminho: string; url: string } | { ok: false; texto: string };

/**
 * A resposta de guardar a imagem de um slide, como ESTADO (achado 52): com a versão do texto, para o
 * aviso "o texto mudou", e o endereço público da imagem, para a miniatura do card.
 */
export type AvisoDaImagem = Aviso & { em: number; versao?: string; imagem?: string | null };

/** A resposta do "Publicar", como ESTADO. */
export type AvisoDaPublicacao = Aviso & { em: number };
