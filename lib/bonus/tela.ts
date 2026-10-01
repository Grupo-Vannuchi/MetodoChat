// O QUE A TELA MOSTRA PARA CADA LINHA, decidido fora do JSX, com teste.
import type { Revisado } from "./contrato";
import { detalheDe, MOTIVOS_DO_ENVIO, type Detalhe, type EstadoDoEnvio, type MotivoDoEnvio } from "./desfecho";
import type { LinhaDoBonus } from "./linha";
import { palavraFinal } from "./pedido";
import { BonusGeradoSchema } from "./schema";
import { ENVIO_PARADO_MS, geracaoNaTela } from "./tempos";
import { QUADRO_DO_ENVIO_PARADO, QUADRO_ENVIANDO, quadroDoEnvio, type Quadro } from "./textos";

export type EnvioNaTela = "nao_enviado" | "enviando" | EstadoDoEnvio;

export function envioNaTela(l: LinhaDoBonus, agoraMs: number): EnvioNaTela {
  if (l.envio_estado === null) return "nao_enviado";
  if (l.envio_estado === "enviando") {
    const inicio = l.envio_iniciado_em?.getTime() ?? 0;
    return agoraMs - inicio > ENVIO_PARADO_MS ? "incerto" : "enviando";
  }
  return l.envio_estado;
}

/**
 * Os campos ficam travados quando o próximo envio TEM de levar o corpo gravado. O
 * `enviando` entra junto: se ele estiver preso, a próxima reserva o grava como
 * incerto (`reivindicarEnvio`), e a tela não pode deixar editar antes disso.
 */
export function corpoCongelado(l: LinhaDoBonus): boolean {
  return l.incerto_pendente || l.envio_estado === "enviando";
}

export function motivoGravado(l: LinhaDoBonus): MotivoDoEnvio | null {
  const m = (l.envio_resposta as { motivo?: unknown } | null)?.motivo;
  return typeof m === "string" && (MOTIVOS_DO_ENVIO as readonly string[]).includes(m)
    ? (m as MotivoDoEnvio)
    : null;
}

export function detalheGravado(l: LinhaDoBonus): Detalhe {
  return detalheDe(l.envio_resposta);
}

export function quadroDaLinha(l: LinhaDoBonus, agoraMs: number): Quadro | null {
  const envio = envioNaTela(l, agoraMs);
  if (envio === "nao_enviado") return null;
  if (envio === "enviando") return QUADRO_ENVIANDO;
  if (l.envio_estado === "enviando") return QUADRO_DO_ENVIO_PARADO;
  const motivo = motivoGravado(l);
  return motivo === null ? null : quadroDoEnvio(motivo, detalheGravado(l), l.slug);
}

function revisadoGravado(v: unknown): Revisado | null {
  if (v === null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const campos = ["titulo", "slug", "palavra", "descricao", "intro", "prompt", "tema"] as const;
  if (!campos.every((c) => typeof o[c] === "string")) return null;
  return {
    titulo: o.titulo as string,
    slug: o.slug as string,
    palavra: o.palavra as string,
    descricao: o.descricao as string,
    intro: o.intro as string,
    prompt: o.prompt as string,
    tema: o.tema as string,
  };
}

/** O que abre no formulário: o último revisado, ou o gerado com a palavra digitada vencendo. */
export function valoresDoFormulario(l: LinhaDoBonus): Revisado | null {
  const revisado = revisadoGravado(l.revisado);
  if (revisado) return revisado;
  const gerado = BonusGeradoSchema.safeParse(l.gerado);
  if (!gerado.success) return null;
  const g = gerado.data;
  return {
    titulo: g.titulo,
    slug: g.slug,
    palavra: palavraFinal(l.palavra_digitada, g.palavraChave),
    descricao: g.descricao,
    intro: g.intro,
    prompt: g.prompt,
    tema: l.tema,
  };
}

export function tituloDaLinha(l: LinhaDoBonus): string {
  const revisado = revisadoGravado(l.revisado);
  if (revisado) return revisado.titulo;
  const gerado = BonusGeradoSchema.safeParse(l.gerado);
  return gerado.success ? gerado.data.titulo : l.tema;
}

export type TipoDoRotulo = "neutro" | "ok" | "atencao" | "erro";

export function rotuloDaLinha(l: LinhaDoBonus, agoraMs: number): { texto: string; tipo: TipoDoRotulo } {
  const geracao = geracaoNaTela(l.estado, l.criado_em, agoraMs);
  if (geracao === "gerando") return { texto: "Gerando", tipo: "neutro" };
  if (geracao === "travou") return { texto: "Travou", tipo: "erro" };
  if (geracao === "falhou") return { texto: "Falhou", tipo: "erro" };
  switch (envioNaTela(l, agoraMs)) {
    case "nao_enviado":
      return { texto: "Pronto para revisar", tipo: "neutro" };
    case "enviando":
      return { texto: "Enviando", tipo: "neutro" };
    case "criado":
      return { texto: "Criado no Labs", tipo: "ok" };
    case "conferir":
      return { texto: "Conferir no Labs", tipo: "atencao" };
    case "incerto":
      return { texto: "Envio incerto", tipo: "atencao" };
    case "esperar":
      return { texto: "Esperando o Labs", tipo: "atencao" };
    case "porta_desligada":
      return { texto: "Porta do Labs desligada", tipo: "atencao" };
    case "colisao":
      return { texto: "Endereço ocupado", tipo: "erro" };
    case "recusado":
      return { texto: "Precisa de ajuste", tipo: "erro" };
  }
}
