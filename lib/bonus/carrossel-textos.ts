// AS FRASES DO CARROSSEL, fora do JSX (mesmo princípio de lib/bonus/textos.ts): uma saída muda
// é indistinguível de sucesso, e o texto de cada saída vem de função pura, com teste.
import type { Aviso } from "@/lib/avisos";
import { SLIDES_MAX, SLIDES_MIN, TETO_CARROSSEL_DIARIO, type RecusaDoPedidoDeCarrossel } from "./carrossel-pedido";
import { camposDoFormulario, type FalhaDaConferencia } from "./carrossel-texto";
import type { SituacaoNoLabs } from "./publicado";
import type { TomDoQuadro } from "./textos";

/**
 * A resposta do "Salvar revisão", que volta como ESTADO do formulário e não por redirect (achado
 * 52: todo redirect de Server Action recria a página no Next 16, e a edição na tela sumia).
 * `em` muda a cada resposta, para o aviso aparecer de novo mesmo com a mesma mensagem.
 */
export type AvisoDaRevisao = Aviso & { em: number };

/** A recusa do "Gerar carrossel", que também volta como estado do formulário. */
export type AvisoDoPedidoDeCarrossel = Aviso & { em: number };

/** O aviso vai pela URL com texto E tom: `avisoDaUrl` lê os dois, e sem tom tudo vira erro. */
export function urlDoCarrosselComAviso(bonusId: string, carrosselId: string, aviso: Aviso): string {
  return `/bonus/${bonusId}/carrossel/${carrosselId}?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
}

export function textoDaRecusaDoPedidoDeCarrossel(motivo: RecusaDoPedidoDeCarrossel): string {
  switch (motivo) {
    case "bonus_invalido":
      return "Esse bônus não existe, ou o endereço está errado.";
    case "total_invalido":
      return `Escolha de ${SLIDES_MIN} a ${SLIDES_MAX} slides.`;
  }
}

export function textoDoTetoDoCarrossel(): string {
  return `Você já gerou ${TETO_CARROSSEL_DIARIO} carrosséis nas últimas 24 horas, que é o limite. Ele volta a abrir quando o pedido mais antigo completar um dia.`;
}

export const TEXTO_SO_BONUS_CRIADO =
  "Só dá para gerar carrossel de um bônus que já foi criado no Labs e está publicado lá.";
export const TEXTO_CARROSSEL_NAO_ENCONTRADO = "Esse carrossel não existe, ou o endereço está errado.";
export const TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO =
  "Só dá para gerar de novo um carrossel cuja geração falhou ou travou.";
export const TEXTO_CARROSSEL_NAO_REVISAVEL = "Esse carrossel não está pronto para revisar.";
export const TEXTO_REVISAO_SALVA = "Revisão salva.";
export const TEXTO_TABELA_CARROSSEL_AUSENTE =
  "Falta a tabela dos carrosséis neste banco. Aplique a migração 014 (migrations/014-carrosseis-gerados.sql) e recarregue.";
export const TEXTO_CARROSSEL_SEM_TEXTO = "O texto deste carrossel não passou na conferência de formato. Gere de novo.";

/** A situação do bônus no Labs, lida agora. Só "publicado" é verde. */
export function quadroDaSituacao(s: SituacaoNoLabs): { tom: TomDoQuadro; texto: string } {
  switch (s.tipo) {
    case "publicado":
      return { tom: "ok", texto: `Publicado no Labs · palavra ${s.bonus.palavra}` };
    case "nao_publicado":
      return {
        tom: "atencao",
        texto: "Criado no Labs como oculto. Publique no /admin do Labs para gerar e usar carrossel.",
      };
    case "sem_resposta":
      return { tom: "atencao", texto: "Não consegui consultar o Labs agora. Recarregue a página em instantes." };
    case "formato_estranho":
      return {
        tom: "erro",
        texto: "O Labs respondeu num formato que o Chat não reconhece. Avise quem cuida do Labs.",
      };
    case "sem_config":
      return {
        tom: "erro",
        texto: "A LABS_URL deste servidor está ausente ou inválida, então o Chat não consegue consultar o Labs.",
      };
  }
}

export function textoDaConferencia(f: FalhaDaConferencia, palavra: string): string {
  switch (f.motivo) {
    case "tipo_errado":
      return "A IA devolveu um formato diferente do pedido. Gere de novo.";
    case "slides":
      return `Vieram ${f.vieram} slides de conteúdo, e o pedido era ${f.esperados}. Gere de novo.`;
    case "palavra":
      return `A IA não pôs a palavra ${palavra} na ${f.onde}. Gere de novo.`;
    case "outra_palavra":
      return `A chamada pede também ${f.palavras.join(", ")}, além de ${palavra}. Gere de novo.`;
  }
}

export function textoDosProblemasDoCarrossel(total: number, problemas: { campo: string; erro: string }[]): string {
  const rotulos = new Map(camposDoFormulario(total).map((c) => [c.nome, c.rotulo]));
  return `${problemas.map((p) => `${rotulos.get(p.campo) ?? p.campo}: ${p.erro}`).join(". ")}.`;
}

/** O aviso embaixo da chamada quando ela pede outra palavra gritada além da do bônus. */
export function textoDeOutrasPalavras(outras: string[], palavra: string): string {
  return `Pede também ${outras.join(", ")}: deixe só a palavra ${palavra}.`;
}

/** O aviso embaixo da chamada ou da legenda quando a palavra some (achado 53). */
export function textoDaFaltaDaPalavra(palavra: string): string {
  return `Falta a palavra ${palavra}: sem ela, quem comentar não recebe o bônus.`;
}

export function avisoDePalavraTrocada(noLabs: string, noCarrossel: string): string {
  return `No Labs, a palavra deste bônus agora é ${noLabs}, e este carrossel pede ${noCarrossel}. Gere outro carrossel para usar a palavra nova.`;
}
