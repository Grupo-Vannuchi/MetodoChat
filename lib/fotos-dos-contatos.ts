// AS FOTOS DOS CONTATOS QUE A ROTINA DIÁRIA RENOVA (app/api/cron/daily/route.ts), achado 135, decidido pelo
// Eduardo em 03/11/2026.
//
// A URL da foto que a Meta dá VENCE: o CDN do Instagram assina o endereço, e o parâmetro `oe` traz o fim da
// validade em hexadecimal de segundos unix. Medido em 03/11, a foto renovada vale de ~104 a 113 h (4,3 a
// 4,7 dias). A rotina renovava todo dia as MESMAS 20 mais recentes de cada conta, e as outras venciam: na
// …4337 eram 136 de 160 vencidas, e a tela mostrava a inicial do nome no lugar delas.
//
// AS 20 VAGAS CONTINUAM 20 (o teto de 60 s da rotina não foi medido, e subir o limite foi descartado), mas
// vão para quem precisa: as mais recentes cuja foto já venceu ou venceria antes da próxima passagem.
//
// A FOTO NULA FICA DE FORA, e anular é PERMANENTE: o motor só busca o perfil na 1ª mensagem
// (`fetchProfileFields` volta cedo para o contato que já tem username, lib/engine.ts), e o botão de
// /contatos só pega username nulo. Por isso só se anula a foto JÁ vencida, quando a Meta recusa de verdade e
// a conta provou, na mesma passagem, que o token vale.
import { IgError } from "./ig";

const HORA_MS = 3_600_000;

// 25 h É O MAIOR INTERVALO ENTRE DUAS PASSAGENS: o `vercel.json` marca "0 9 * * *", e o plano Hobby roda o
// cron em qualquer minuto da hora 9. Com a vida medida, a renovação cai no 4º dia (sobram 7 a 18 h) e nunca
// no 3º (sobram 31 a 42 h). Sem margem, a foto ficaria quebrada de 6 a 17 h a cada volta; com 2 dias, a
// renovação viria um dia antes, a um terço a mais de chamadas.
export const MARGEM_DA_FOTO_MS = 25 * HORA_MS;

/** As chamadas à Meta por conta e por passagem: as mesmas 20 de antes. */
export const RENOVACOES_POR_CONTA = 20;

// A LEITURA DO BANCO É LIMITADA, e não a conta inteira: ~500 bytes por URL, então 500 contatos são ~250 KB
// por conta. Com 20 renovações por dia e uma foto a cada 4 dias, uma conta mantém ~80 fotos válidas; a
// janela fica muito além disso.
export const JANELA_DAS_FOTOS = 500;

/** O fim da validade da URL, em ms, lido do `oe`. Sem `oe` legível, null: a data não é inventada. */
export function venceEm(url: string | null): number | null {
  if (!url) return null;
  let oe: string | null;
  try {
    oe = new URL(url).searchParams.get("oe");
  } catch {
    return null;
  }
  if (!oe || !/^[0-9a-f]+$/i.test(oe)) return null;
  return parseInt(oe, 16) * 1000;
}

// A URL SEM `oe` LEGÍVEL CONTA COMO VENCIDA: não há como saber se ela ainda vale, e renovar é o caminho
// seguro. Hoje (03/11) nenhuma das fotos guardadas está assim.
function vencida(url: string, agoraMs: number): boolean {
  const vence = venceEm(url);
  return vence === null || vence <= agoraMs;
}

function devida(url: string, agoraMs: number): boolean {
  const vence = venceEm(url);
  return vence === null || vence - agoraMs <= MARGEM_DA_FOTO_MS;
}

/**
 * Quem a rotina renova nesta passagem: das que chegam (já na ordem da recência), as que têm foto e estão
 * vencidas ou dentro da margem, até `RENOVACOES_POR_CONTA`. A ordem de chegada é mantida.
 */
export function escolherParaRenovar<T extends { profile_pic: string | null }>(contatos: T[], agoraMs: number): T[] {
  return contatos
    .filter((c) => !!c.profile_pic && devida(c.profile_pic, agoraMs))
    .slice(0, RENOVACOES_POR_CONTA);
}

/**
 * O que fazer com a foto quando a Meta FALHOU para este contato. Só anula com as três juntas:
 * - a foto já venceu (dentro da margem, ela ainda vale e não se apaga foto boa);
 * - a Meta respondeu com um 4xx que não é 429 (conta privada, apagada, ou quem só comentou): o 429, o 5xx,
 *   o teto de tempo (`IgTimeoutError`) e a rede são passageiros;
 * - a leitura do perfil da própria conta deu certo nesta passagem: com o token inválido, a Meta recusa todo
 *   mundo com 400, e anular ali apagaria 20 fotos por dia.
 */
export function fotoDepoisDaFalha(
  atual: string,
  erro: unknown,
  contaLida: boolean,
  agoraMs: number
): "anular" | "manter" {
  const recusa = erro instanceof IgError && erro.status >= 400 && erro.status < 500 && erro.status !== 429;
  return recusa && contaLida && vencida(atual, agoraMs) ? "anular" : "manter";
}

/**
 * A foto a gravar quando a Meta RESPONDEU: a nova, se veio. Sem foto na resposta, a vencida é anulada
 * (senão ela fica devida e toma uma vaga todo dia), e a que ainda vale fica.
 */
export function fotoDepoisDaResposta(atual: string, veio: string | null | undefined, agoraMs: number): string | null {
  if (veio) return veio;
  return vencida(atual, agoraMs) ? null : atual;
}
