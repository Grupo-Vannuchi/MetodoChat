// O QUE VAI NO PRÓXIMO ENVIO AO LABS, e o que o envio pode devolver.
import { assinar } from "./assinatura";
import { lerRevisado, montarCorpo, type ProblemaDoCampo, type Revisado } from "./contrato";
import type { Desfecho } from "./desfecho";

export type LinhaParaEnvio = {
  slug: string | null;
  corpo_enviado: string | null;
  incerto_pendente: boolean;
};

export type Preparo =
  | {
      ok: true;
      corpo: string;
      slug: string;
      cabecalho: string;
      corpoNovo: boolean;
      revisado: Revisado | null;
    }
  | { ok: false; problemas: ProblemaDoCampo[] };

export type FaltaNoEnvio = "sem_segredo" | "sem_url" | "url_invalida";

/**
 * `superado`: outra reserva assumiu o envio enquanto este esperava (a ficha em
 * `tentativas` mudou). O desfecho deste envio NÃO foi gravado, de propósito: gravar
 * por cima apagaria o do envio mais novo.
 */
export type ResultadoDoEnvio =
  | { tipo: "sem_config"; motivo: FaltaNoEnvio }
  | { tipo: "nao_encontrado" }
  | { tipo: "invalido"; problemas: ProblemaDoCampo[] }
  | { tipo: "ocupado" }
  | { tipo: "superado" }
  | { tipo: "enviado"; desfecho: Desfecho; slug: string };

/**
 * COM `incerto_pendente`, uma tentativa anterior pode ter criado o bônus: vai o
 * corpo GRAVADO, byte por byte, e o formulário é ignorado. O Labs reconhece
 * reenvio só pelo slug (site-ia, route.ts:184-190); um corpo diferente com o mesmo
 * slug voltaria "duplicate", e o Chat acreditaria ter gravado o que não gravou.
 *
 * A exceção é incerteza SEM corpo gravado: o processo morreu entre reivindicar o
 * envio e gravar o corpo, e a gravação vem antes do POST. Nada saiu, e o corpo
 * pode nascer de novo. Isso só é verdade porque a reserva APAGA o corpo antigo
 * quando ele está liberado (`reivindicarEnvio`, lib/bonus/repositorio.ts): sem
 * isso, um corpo que o operador abandonou depois de uma recusa voltaria no envio
 * seguinte (achado do auditor na revisão do plano).
 *
 * A ASSINATURA É REFEITA A CADA CHAMADA, com `t` = agora, e nunca é guardada. O
 * `t` entra no HMAC e a janela do Labs é de ±5 minutos: um cabeçalho guardado faria
 * o reenvio de amanhã voltar `401 timestamp_fora_da_janela`, que parece relógio
 * errado e é assinatura velha.
 */
export function prepararEnvio(
  linha: LinhaParaEnvio,
  revisadoBruto: Record<string, unknown>,
  segredo: string,
  agoraMs: number
): Preparo {
  if (linha.incerto_pendente && linha.corpo_enviado !== null && linha.slug !== null) {
    return {
      ok: true,
      corpo: linha.corpo_enviado,
      slug: linha.slug,
      cabecalho: assinar(linha.corpo_enviado, segredo, agoraMs),
      corpoNovo: false,
      revisado: null,
    };
  }
  const lido = lerRevisado(revisadoBruto);
  if (!lido.ok) return lido;
  const corpo = montarCorpo(lido.revisado);
  return {
    ok: true,
    corpo,
    slug: lido.revisado.slug,
    cabecalho: assinar(corpo, segredo, agoraMs),
    corpoNovo: true,
    revisado: lido.revisado,
  };
}
