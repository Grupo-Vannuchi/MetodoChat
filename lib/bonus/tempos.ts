// OS RELÓGIOS DO GERADOR DE BÔNUS, num lugar só.
//
// Molde: site-ia/src/lib/ia/tempos.ts. Lá eles moravam em três arquivos, e a
// ordem entre eles quebrou calada em 27/08. A ORDEM É O INVARIANTE, e quem a
// guarda é tests/bonus-tempos.test.ts, e não este comentário.
//
// `MAX_DURATION_S` é o teto que as duas páginas de app/bonus/ declaram. O Next
// exige que `export const maxDuration` seja um literal, então as páginas repetem
// o número, e tests/bonus-paginas.test.ts confere que é o mesmo daqui.

/** O teto das páginas de app/bonus/, em segundos. No plano Hobby, exige Fluid Compute. */
export const MAX_DURATION_S = 300;

/** Teto da chamada à IA. Uma geração leva de 30 a 60 s (medido no Labs). */
export const TIMEOUT_IA_MS = 150_000;

/** A partir de quando uma geração parada é dada como morta. Maior que o timeout da IA. */
export const TRAVADA_MS = 200_000;

/** Quando a tela para de perguntar. Maior que TRAVADA_MS, senão "travou" nunca aparece. */
export const DESISTIR_MS = 240_000;

/** Intervalo entre duas perguntas da tela ao servidor. */
export const INTERVALO_CONSULTA_MS = 2_000;

/** Teto do POST ao Labs. A rota de lá responde em segundos. */
export const TIMEOUT_ENVIO_MS = 15_000;

/**
 * O `connect_timeout` de lib/db.ts (10 s), em ms. Repetido aqui porque lá é literal
 * num arquivo do dono; tests/bonus-tempos.test.ts lê o arquivo e confere.
 */
export const CONEXAO_MAX_MS = 10_000;

/**
 * Um envio iniciado há mais que isto e ainda `enviando` morreu no meio. Tem de ser
 * maior que o pior caminho VIVO da action: conexão para gravar o corpo, o POST,
 * conexão para gravar o desfecho. A ficha (`tentativas`) protege o resto.
 */
export const ENVIO_PARADO_MS = 60_000;

export type EstadoDaGeracao = "pendente" | "gerando" | "pronto" | "falhou";
export type GeracaoNaTela = "gerando" | "travou" | "pronto" | "falhou";

/**
 * O estado que a tela mostra. A linha travada é julgada NA LEITURA, pelo relógio,
 * sem cron: o cron diário deste projeto está aberto e não é desta feature.
 */
export function geracaoNaTela(
  estado: EstadoDaGeracao,
  criadoEm: Date,
  agoraMs: number
): GeracaoNaTela {
  if (estado === "pronto" || estado === "falhou") return estado;
  return agoraMs - criadoEm.getTime() > TRAVADA_MS ? "travou" : "gerando";
}
