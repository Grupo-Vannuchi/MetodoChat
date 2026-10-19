// AS REGRAS PURAS DO APAGAR (spec da Etapa 10, "Quem pode ser apagado" e "O apagar no servidor"). PURO:
// a página e o servidor decidem por aqui, e nenhuma regra mora no JSX nem no SQL.
import { publicacaoLivre, type EstadoDaPublicacao } from "./publicar-estado";
import { ehCaminhoDoDestino, imagensDaArte, jeitoDoCaminho, publicacaoDaArte } from "./publicar-regras";
import type { GeracaoNaTela } from "./tempos";

export type MotivoDoApagar = "agendado" | "publicado" | "desconhecido" | "geracao" | "imagem" | "nao_existe";

export type PodeApagar = { ok: true } | { ok: false; motivo: MotivoDoApagar };

/**
 * QUEM PODE SER APAGADO: a publicação livre pela regra do publicar (`publicacaoLivre`: a trava do
 * publicar e a do apagar são uma só), a geração do texto fora de andamento, e nenhuma imagem do
 * carrossel sendo gerada (achado 95: a imagem já paga à OpenAI não vai fora). A publicação decide
 * primeiro: o que está na fila diz o do calendário, mesmo com uma imagem gerando.
 */
export function podeApagar(p: { publicacao: EstadoDaPublicacao; geracao: GeracaoNaTela; imagemGerando: boolean }): PodeApagar {
  if (!publicacaoLivre(p.publicacao)) {
    switch (p.publicacao.tipo) {
      case "publicado":
        return { ok: false, motivo: "publicado" };
      case "agendado":
      case "publicando":
        return { ok: false, motivo: "agendado" };
      default:
        return { ok: false, motivo: "desconhecido" };
    }
  }
  if (p.geracao === "gerando") return { ok: false, motivo: "geracao" };
  if (p.imagemGerando) return { ok: false, motivo: "imagem" };
  return { ok: true };
}

/**
 * OS ARQUIVOS DO CARROSSEL NO BUCKET, que saem depois do commit: as imagens guardadas nos slides (as
 * fotos e as imagens geradas em `bonus-foto/`, os slides prontos em `bonus/`) e as cópias da fila que
 * tenham sobrado (`arte.publicacao.caminhos`, em `bonus-fila/`). Só os da pasta da conta do carrossel, na
 * forma exata do destino (`ehCaminhoDoDestino`): apagar não tem volta, e um caminho estranho guardado
 * na linha não leva junto o arquivo de outro post.
 */
export function caminhosDoCarrossel(arte: unknown, total: number, pasta: string | null): string[] {
  if (pasta === null) return [];
  const imagens = Object.values(imagensDaArte(arte, total))
    .map((i) => i.caminho)
    .filter((c) => {
      const jeito = jeitoDoCaminho(c);
      return jeito !== null && ehCaminhoDoDestino(c, pasta, jeito);
    });
  const publicacao = publicacaoDaArte(arte);
  const daFila = publicacao && publicacao !== "estranha" ? publicacao.caminhos.filter((c) => ehCaminhoDoDestino(c, pasta, "fila")) : [];
  const todos = [...imagens, ...daFila];
  return todos.filter((c, i) => todos.indexOf(c) === i);
}
