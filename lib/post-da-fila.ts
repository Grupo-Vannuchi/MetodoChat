import { avisoDoDesfecho, type Aviso } from "./avisos";
import {
  capaDoPost,
  ehVideoNoPost,
  fraseSobreAMidia,
  lerPayloadDaPublicacao,
  linhaDaFalha,
  resumoDaLegenda,
  rotuloDaFormaDoItem,
  LEGENDA_NA_LISTA,
  MOTIVO_NAO_REGISTRADO,
  type DesfechoDaMudanca,
  type LinhaDaFalha,
} from "./publicacao";
import { lerPayloadDoLinkedin, linkParaVerNoLinkedin, rotuloDoPostNoLinkedin } from "./linkedin-publicacao";

// O POST DA FILA, DE QUALQUER REDE (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a).
//
// As telas de Publicações (o calendário, "Não saíram" e a página do post) e as ações de cancelar e remarcar leem o
// post do Instagram (`publicacao`) e o do LinkedIn (`publicacao_linkedin`). O que muda por rede é decidido aqui,
// fora do JSX, e o post do Instagram continua saindo pelas mesmas funções de antes (lib/publicacao.ts), sem mudar
// uma letra do que a tela mostrava.
//
// SEM IMPORT DE SERVIDOR: o arquivo é puro, e tests/post-da-fila.test.ts o lê sem banco.

export function ehPostDoLinkedin(kind: string | null | undefined): boolean {
  return kind === "publicacao_linkedin";
}

/** O quadrado do calendário: o nome, a capa (o caminho no bucket, enquanto o post não saiu) e se ele é só vídeo. */
export function cartaoDoPost(
  item: { kind: string; payload: unknown },
  saiu: boolean
): { rotulo: string; capa: string | null; soVideo: boolean } {
  if (ehPostDoLinkedin(item.kind)) {
    const li = lerPayloadDoLinkedin(item.payload);
    // A CAPA É A IMAGEM, ou a primeira foto do carrossel (a parte 3a); o só texto não tem.
    return { rotulo: rotuloDoPostNoLinkedin(li), capa: !saiu && li && li.forma !== "texto" ? li.caminhos[0] : null, soVideo: false };
  }
  // O INSTAGRAM, como a célula decidia antes (app/publicar/page.tsx): a capa é a primeira imagem, e o post só de
  // vídeo fica sem capa e desenha o ícone dele.
  const p = lerPayloadDaPublicacao(item.payload);
  const capa = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;
  return { rotulo: rotuloDaFormaDoItem(p), capa, soVideo: !saiu && !!p && p.caminhos.length > 0 && capa === null };
}

/** A linha de "Não saíram". A do LinkedIn tem as mesmas quatro coisas da do Instagram (`linhaDaFalha`). */
export function linhaDaFalhaDoPost(item: {
  kind: string;
  not_before: Date;
  claimed_at: Date | null;
  error: string | null;
  payload: Record<string, unknown>;
}): LinhaDaFalha {
  if (!ehPostDoLinkedin(item.kind)) return linhaDaFalha(item);
  const li = lerPayloadDoLinkedin(item.payload);
  const motivo = typeof item.error === "string" ? item.error.trim() : "";
  return {
    quando: item.claimed_at ?? item.not_before,
    motivo: motivo || MOTIVO_NAO_REGISTRADO,
    forma: rotuloDoPostNoLinkedin(li),
    legenda: resumoDaLegenda(li?.texto, LEGENDA_NA_LISTA),
  };
}

/**
 * Os arquivos que o cancelar apaga do bucket, lidos do payload da rede da linha. O payload que não se lê não apaga
 * nada (null): um caminho de um `jsonb` que ninguém entende é a última coisa que se entrega a um `DELETE`.
 */
export function caminhosDoPostDaFila(kind: string, payload: unknown): string[] | null {
  if (ehPostDoLinkedin(kind)) return lerPayloadDoLinkedin(payload)?.caminhos ?? null;
  return lerPayloadDaPublicacao(payload)?.caminhos ?? null;
}

/** O que a página de um post mostra, decidido fora do JSX. */
export type PaginaDoPost = {
  titulo: string;
  tituloDoTexto: string;
  /** O texto inteiro, ou null quando não há (e aí a tela diz `semTexto`). */
  texto: string | null;
  semTexto: string;
  /** Os arquivos do post; a tela só os mostra enquanto ele pode ser mexido. */
  caminhos: string[];
  ehVideo: (caminho: string) => boolean;
  sobreAMidia: string | null;
  /** O id do post no Instagram, para a tela buscar o "Ver no Instagram"; null no LinkedIn. */
  mediaIdNoInstagram: string | null;
  /** O endereço do post no LinkedIn, depois que ele saiu; null no Instagram. */
  linkNoLinkedin: string | null;
  notaDoCancelar: string;
};

const NOTA_DO_CANCELAR_NO_INSTAGRAM =
  "Cancelar tira o post da fila e ele não sai. Se ele já tiver saído, só o aplicativo do Instagram apaga — a API não apaga mídia.";
const NOTA_DO_CANCELAR_NO_LINKEDIN =
  "Cancelar tira o post da fila e ele não sai. Se ele já tiver saído, apague pelo próprio LinkedIn.";

export function paginaDoPost(
  item: { kind: string; payload: unknown; error: string | null },
  quando: { saiu: boolean; encerrado: boolean }
): PaginaDoPost {
  if (ehPostDoLinkedin(item.kind)) {
    const li = lerPayloadDoLinkedin(item.payload);
    return {
      titulo: rotuloDoPostNoLinkedin(li),
      tituloDoTexto: "Texto",
      texto: li?.texto.trim() ? li.texto : null,
      semTexto: "Sem texto.",
      caminhos: li?.caminhos ?? [],
      ehVideo: () => false,
      // O SÓ TEXTO NÃO TEM MÍDIA, e a frase sobre a mídia apagada mentiria. A imagem e o carrossel (a parte 3a) têm.
      sobreAMidia: li && li.forma !== "texto" ? fraseSobreAMidia(quando, item.error) : null,
      mediaIdNoInstagram: null,
      linkNoLinkedin: quando.saiu ? linkParaVerNoLinkedin(li?.postUrn) : null,
      notaDoCancelar: NOTA_DO_CANCELAR_NO_LINKEDIN,
    };
  }
  const p = lerPayloadDaPublicacao(item.payload);
  return {
    titulo: rotuloDaFormaDoItem(p),
    tituloDoTexto: "Legenda",
    texto: p?.legenda?.trim() ? p.legenda : null,
    semTexto: "Sem legenda.",
    caminhos: p?.caminhos ?? [],
    ehVideo: (caminho) => !!p && ehVideoNoPost(p.forma, caminho),
    sobreAMidia: fraseSobreAMidia(quando, item.error),
    mediaIdNoInstagram: p?.mediaId ?? null,
    linkNoLinkedin: null,
    notaDoCancelar: NOTA_DO_CANCELAR_NO_INSTAGRAM,
  };
}

/**
 * O AVISO DO CANCELAR E DO REMARCAR (`avisoDoDesfecho`, lib/avisos.ts), com uma frase a mais: no LinkedIn, o "já
 * saiu" do cancelar não pode mandar apagar pelo aplicativo do Instagram. O resto é o aviso de sempre, nas duas
 * redes; sem a rede (o item não foi achado), também.
 */
export function avisoDoDesfechoDoPost(
  d: DesfechoDaMudanca,
  acao: "cancelar" | "remarcar",
  kind: string | null
): Aviso {
  if (ehPostDoLinkedin(kind) && d === "tarde_demais" && acao === "cancelar") {
    return {
      tom: "erro",
      texto: "Este post já saiu ou está saindo agora, e não deu para cancelar. Se ele já estiver no LinkedIn, apague por lá.",
    };
  }
  return avisoDoDesfecho(d, acao);
}

/**
 * O AVISO DO REMARCAR DE UM POST DO LINKEDIN DE FORMA NOVA (a preparação da parte 3 do LinkedIn;
 * docs/plans/2026-11-11-linkedin-forma-conhecida.md). Este código não publica a forma (`soAFormaConhecidaDoLinkedin`,
 * lib/linkedin-publicacao.ts), então o remarcar não grava a hora nova nem drena: "feito" seria fingir, porque a linha
 * ficaria parada, e "não encontrado" seria falso, porque o post está ali.
 */
export const AVISO_DO_REMARCAR_DA_FORMA_NOVA: Aviso = {
  tom: "erro",
  texto: "Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.",
};
