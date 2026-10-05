// O ESTADO DA PUBLICAÇÃO DO CARROSSEL E O QUE FALTA PARA PUBLICAR (spec da Etapa 5). PURO: o
// repositório lê a linha da fila e o relógio do banco, e esta função decide.
import type { OrigemDaConta } from "./arte-conta";
import type { ImagemGuardada, PublicacaoGuardada } from "./publicar-regras";

/** A linha da fila do /publicar, lida pela `dedupe_key` exata que o carrossel guardou. */
export type LinhaDaFila = { id: string; status: string; not_before: Date; sent_at: Date | null; error: string | null };

/**
 * QUANTO A RESERVA SEM LINHA NA FILA ESPERA ATÉ CONTAR COMO "NÃO ENTROU". A reserva vem antes da fila
 * (spec, "Por que a reserva vem antes da fila"), e a fila é gravada logo depois, na mesma requisição:
 * em 10 minutos sem linha, ela não vai mais aparecer. Contados no relógio do banco.
 */
export const ESPERA_DA_RESERVA_MS = 10 * 60_000;

export type EstadoDaPublicacao =
  | { tipo: "livre" }
  | { tipo: "agendado"; quando: Date; filaId: string }
  | { tipo: "publicando"; filaId: string | null }
  | { tipo: "publicado"; em: Date | null; filaId: string }
  | { tipo: "falhou"; motivo: string | null; filaId: string }
  | { tipo: "cancelado"; filaId: string }
  | { tipo: "nao_entrou" }
  | { tipo: "saiu_da_fila" }
  | { tipo: "desconhecido"; status?: string };

export function estadoDaPublicacao(
  publicacao: PublicacaoGuardada | null | "estranha",
  linha: LinhaDaFila | null,
  agora: Date
): EstadoDaPublicacao {
  if (publicacao === null) return { tipo: "livre" };
  if (publicacao === "estranha") return { tipo: "desconhecido" };
  if (linha) {
    switch (linha.status) {
      case "pending":
        return linha.not_before.getTime() > agora.getTime()
          ? { tipo: "agendado", quando: linha.not_before, filaId: linha.id }
          : { tipo: "publicando", filaId: linha.id };
      case "sending":
        return { tipo: "publicando", filaId: linha.id };
      case "sent":
        return { tipo: "publicado", em: linha.sent_at, filaId: linha.id };
      case "failed":
        return { tipo: "falhou", motivo: linha.error, filaId: linha.id };
      case "skipped":
        return { tipo: "cancelado", filaId: linha.id };
      default:
        return { tipo: "desconhecido", status: linha.status };
    }
  }
  // SEM LINHA. Enfileirada e sem linha é a linha apagada pelo `deleteAccount` (lib/db.ts:469-474,
  // achado 75): trava para sempre, para um clique não publicar o mesmo post de novo.
  if (publicacao.enfileiradaEm) return { tipo: "saiu_da_fila" };
  return agora.getTime() - publicacao.reservadaEm.getTime() >= ESPERA_DA_RESERVA_MS ? { tipo: "nao_entrou" } : { tipo: "publicando", filaId: null };
}

/**
 * A TRAVA SE ESCREVE PELO QUE LIBERA, e todo o resto trava: agendado, publicando, publicado, a que
 * saiu da fila, e qualquer estado que a fila venha a ter (spec, "A trava no servidor").
 */
export function publicacaoLivre(e: EstadoDaPublicacao): boolean {
  return e.tipo === "livre" || e.tipo === "falhou" || e.tipo === "cancelado" || e.tipo === "nao_entrou";
}

export type FaltaParaPublicar =
  | { tipo: "sem_conta" }
  | { tipo: "conta_desconectada" }
  | { tipo: "imagens"; slides: number[] }
  | { tipo: "nao_salvo"; slides: number[]; legenda: boolean };

/**
 * O QUE TRAVA O BOTÃO "PUBLICAR" NA TELA, na ordem em que se resolve: a conta, as imagens dos slides
 * com espaço, e o que está "não salvo" (o que sai é o texto salvo, e não o que está nos campos).
 */
export function faltasParaPublicar(p: {
  total: number;
  soTexto: number[];
  imagens: Record<number, ImagemGuardada>;
  origem: OrigemDaConta;
  slidesNaoSalvos: number[];
  legendaNaoSalva: boolean;
}): FaltaParaPublicar[] {
  const faltas: FaltaParaPublicar[] = [];
  if (p.origem === "selecionada") faltas.push({ tipo: "sem_conta" });
  if (p.origem === "guardada" || p.origem === "gravada_saiu") faltas.push({ tipo: "conta_desconectada" });
  const semImagem: number[] = [];
  for (let n = 1; n <= p.total; n++) if (!p.soTexto.includes(n) && !p.imagens[n]) semImagem.push(n);
  if (semImagem.length) faltas.push({ tipo: "imagens", slides: semImagem });
  if (p.slidesNaoSalvos.length || p.legendaNaoSalva) {
    faltas.push({ tipo: "nao_salvo", slides: [...p.slidesNaoSalvos].sort((a, b) => a - b), legenda: p.legendaNaoSalva });
  }
  return faltas;
}
