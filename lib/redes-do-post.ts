// AS DUAS REDES NO MESMO POST (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b), SEM IMPORT DE
// SERVIDOR: a tela de compor e a action leem as mesmas regras. O que cada rede aceita, as caixinhas, o texto que vai
// ao LinkedIn quando o post é das duas, e o aviso das duas. As regras de cada rede continuam onde estavam: as do
// Instagram em lib/publicacao.ts, e as do LinkedIn em lib/linkedin-publicacao.ts.
import { avisoDaPublicacaoEnfileirada, type Aviso } from "@/lib/avisos";
import { avisoDoPostNoLinkedin, type DisponibilidadeDoLinkedin } from "@/lib/linkedin-publicacao";
import { textoDaRecusaDaPublicacao, type FormaDePublicacao } from "@/lib/publicacao";

export type Rede = "instagram" | "linkedin";

/** As formas da tela de compor: as quatro do Instagram e o só texto, que é só do LinkedIn. */
export type FormaDaTela = FormaDePublicacao | "texto";

const FORMAS_DO_INSTAGRAM: readonly FormaDePublicacao[] = ["imagem", "carrossel", "reels", "story"];

/**
 * POR QUE UMA REDE NÃO ACEITA A FORMA, ou null quando aceita. Nesta entrega o LinkedIn recebe só texto e imagem: o
 * carrossel (em PDF) e o vídeo chegam na próxima (a parte 3), e o story não existe lá.
 */
export function redeAceitaAForma(rede: Rede, forma: FormaDaTela): string | null {
  if (rede === "instagram") return forma === "texto" ? "O Instagram não publica post só de texto." : null;
  switch (forma) {
    case "texto":
    case "imagem":
      return null;
    case "carrossel":
      return "O LinkedIn recebe carrossel na próxima entrega.";
    case "reels":
      return "O LinkedIn recebe vídeo na próxima entrega.";
    case "story":
      return "O LinkedIn não tem story.";
  }
}

/**
 * AS FORMAS DA TELA, na ordem da tela: o só texto só aparece com o LinkedIn disponível, porque nenhuma outra rede o
 * aceita. Sem o LinkedIn na página (`null`), a tela é a do Instagram de antes.
 */
export function formasDaTela(linkedin: DisponibilidadeDoLinkedin | null): FormaDaTela[] {
  return linkedin?.disponivel ? [...FORMAS_DO_INSTAGRAM, "texto"] : [...FORMAS_DO_INSTAGRAM];
}

/**
 * AS CAIXINHAS DE PARTIDA (a decisão do Eduardo pela caixa, em 10/11, 17:16:36Z: "Só o Instagram marcado"). O
 * LinkedIn é o perfil PESSOAL do dono da conta, e o post sai PÚBLICO: ele só vai quando alguém marca.
 */
export const CAIXINHAS_DE_PARTIDA: Readonly<Record<Rede, boolean>> = { instagram: true, linkedin: false };

export type EstadoDaCaixinha = { ligada: boolean; marcada: boolean; motivo: string | null };

/**
 * O ESTADO DE CADA CAIXINHA: ligada quando a rede aceita a forma (e, no LinkedIn, quando a conexão vale); marcada só
 * se ligada E marcada por quem compõe; e o motivo quando desligada. A caixinha desligada nunca conta como marcada,
 * mesmo que o formulário a mande. Sem o LinkedIn na página, não há caixinha do LinkedIn (`null`).
 */
export function estadoDasCaixinhas(p: {
  forma: FormaDaTela;
  marcadas: Readonly<Record<Rede, boolean>>;
  linkedin: DisponibilidadeDoLinkedin | null;
}): { instagram: EstadoDaCaixinha; linkedin: EstadoDaCaixinha | null } {
  const motivoDoInstagram = redeAceitaAForma("instagram", p.forma);
  const instagram = { ligada: !motivoDoInstagram, marcada: !motivoDoInstagram && p.marcadas.instagram, motivo: motivoDoInstagram };
  if (!p.linkedin) return { instagram, linkedin: null };
  const motivoDoLinkedin = p.linkedin.disponivel ? redeAceitaAForma("linkedin", p.forma) : p.linkedin.motivo;
  return {
    instagram,
    linkedin: { ligada: !motivoDoLinkedin, marcada: !motivoDoLinkedin && p.marcadas.linkedin, motivo: motivoDoLinkedin },
  };
}

/** A recusa da tela quando nenhuma caixinha está marcada: não há para onde publicar. */
export const TEXTO_SEM_REDE = "Marque ao menos uma rede: Instagram ou LinkedIn.";

/** As redes que o formulário marcou: só o valor "1" marca, como os outros campos de marcar desta tela. */
export function redesDoPedido(campos: { instagram: unknown; linkedin: unknown }): Record<Rede, boolean> {
  return { instagram: campos.instagram === "1", linkedin: campos.linkedin === "1" };
}

/**
 * O TEXTO QUE VAI AO LINKEDIN NO POST DAS DUAS REDES (spec, §7): o "Texto para o LinkedIn", quando há; sem ele, a
 * legenda. O vazio que sobra é recusado pela `recusaDoPedidoNoLinkedin` (texto_vazio), que conta pela mesma função
 * do contador (achado 212).
 */
export function textoQueVaiAoLinkedin(p: { legenda: string; textoProprio: string }): string {
  return p.textoProprio.trim() || p.legenda.trim();
}

/**
 * A NOTA DA LEGENDA QUE VAI AO LINKEDIN (a nota 3 da auditoria sobre o desenho da 2b): lá, a menção do Instagram não
 * é menção (o "@" vai escapado, como texto), e as hashtags viram o modelo clicável (lib/linkedin-publicacao.ts).
 */
export const NOTA_DA_LEGENDA_NO_LINKEDIN =
  "Sem texto próprio, o LinkedIn leva a legenda: lá, a menção com @ vira texto comum, e as hashtags viram clicáveis.";

// ---------------------------------------------------------------------------------------------------------------
// O AVISO DAS DUAS REDES
// ---------------------------------------------------------------------------------------------------------------

type Campos = { dia: number; mes: number; hora: number; minuto: number };

/** O lado do Instagram: entrou (já valendo ou agendado), ou a chave já existia. */
export type LadoDoInstagram = { entrou: true; jaVale: boolean } | { entrou: false };

/** O lado do LinkedIn: entrou, com o desfecho do "agora" quando já valia, ou a chave já existia. */
export type LadoDoLinkedin =
  | { entrou: true; jaVale: boolean; desfecho: "publicado" | "aguardando" | "falhou" | null; motivo?: string | null }
  | { entrou: false };

/**
 * O QUE ACONTECEU NO ENFILEIRAR DAS DUAS REDES (spec, §6; achados 192 e 199):
 *   - "entrou": as duas linhas foram tentadas, e cada lado diz o seu;
 *   - "instagram_nao_entrou": o enfileirar do Instagram lançou, e o LinkedIn foi desfeito (estava pendente), ou
 *     seguiu (um dreno já o tinha pego), ou já estava na fila antes deste envio (e não foi mexido);
 *   - "linkedin_nao_entrou": a cópia da imagem ou o enfileirar do LinkedIn falhou, antes de a linha do Instagram
 *     ser tentada. Nada foi gravado, e a cópia que chegou a existir saiu do bucket.
 */
export type DesfechoDasDuasRedes =
  | { tipo: "entrou"; campos: Campos | null; instagram: LadoDoInstagram; linkedin: LadoDoLinkedin }
  | { tipo: "instagram_nao_entrou"; linkedin: "desfeito" | "seguiu" | "ja_existia" }
  | { tipo: "linkedin_nao_entrou"; motivo: string };

const JA_EXISTIA_NO_LINKEDIN = "O post do LinkedIn já estava na fila. Nada foi duplicado.";

/**
 * O AVISO DEPOIS DE PUBLICAR NAS DUAS REDES: uma frase por rede, tirada da função de cada uma (a do Instagram, a do
 * LinkedIn e a da chave que já existia), para a mesma situação ter a mesma frase com uma rede ou com duas. O tom é
 * de erro quando o LinkedIn não saiu, quando nada de novo entrou, e em toda saída em que o Instagram não entrou.
 */
export function avisoDasDuasRedes(d: DesfechoDasDuasRedes): Aviso {
  if (d.tipo === "linkedin_nao_entrou") {
    return { tom: "erro", texto: `Nada foi agendado: o post não pôde ser preparado para o LinkedIn (${d.motivo}). Tente de novo.` };
  }
  if (d.tipo === "instagram_nao_entrou") {
    switch (d.linkedin) {
      case "desfeito":
        return {
          tom: "erro",
          texto: "Nada foi agendado: o post não entrou na fila do Instagram, e o do LinkedIn foi desfeito. Tente de novo.",
        };
      case "seguiu":
        return {
          tom: "erro",
          texto:
            "O post não entrou na fila do Instagram. O do LinkedIn já tinha começado a sair e segue: acompanhe em Publicações. Para o Instagram, tente de novo.",
        };
      case "ja_existia":
        return {
          tom: "erro",
          texto:
            "O post não entrou na fila do Instagram. O do LinkedIn já estava na fila antes e segue: acompanhe em Publicações.",
        };
    }
  }

  const doInstagram = d.instagram.entrou
    ? avisoDaPublicacaoEnfileirada(d.instagram.jaVale ? null : d.campos).texto
    : textoDaRecusaDaPublicacao("ja_enfileirado");
  const doLinkedin = d.linkedin.entrou
    ? avisoDoPostNoLinkedin({
        desfecho: d.linkedin.desfecho,
        motivo: d.linkedin.motivo,
        agendadoPara: d.linkedin.jaVale ? null : d.campos,
      })
    : { tom: "ok" as const, texto: JA_EXISTIA_NO_LINKEDIN };
  const nadaNovo = !d.instagram.entrou && !d.linkedin.entrou;
  return {
    tom: nadaNovo || doLinkedin.tom === "erro" ? "erro" : "ok",
    texto: `Instagram: ${doInstagram} LinkedIn: ${doLinkedin.texto}`,
  };
}
