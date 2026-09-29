import "server-only";
import { configDoEnvio, type Ambiente } from "./config";
import { lerRevisado } from "./contrato";
import { lerResposta } from "./desfecho";
import { prepararEnvio, type ResultadoDoEnvio } from "./envio";
import { mensagemDeFalhaInesperada } from "./erros";
import { gerarBonus, type ResultadoDaGeracao } from "./ia";
import { postarNoLabs } from "./labs";
import type { Pedido } from "./pedido";
import {
  devolverEnvio,
  gravarCorpo,
  gravarDesfecho,
  gravarFalha,
  gravarGerado,
  lerLinha,
  reivindicarEnvio,
  reivindicarGeracao,
} from "./repositorio";
import { TIMEOUT_ENVIO_MS } from "./tempos";

// GERAR E ENVIAR, DE PONTA A PONTA. As decisões moram nas funções puras; aqui
// só se costura a ordem, e a ordem é a proteção.

export type Gerador = (p: Pedido) => Promise<ResultadoDaGeracao>;

/** Roda no `after()` da action. Nunca lança: toda saída vira linha gravada. */
export async function processarGeracao(id: string, gerar: Gerador = gerarBonus): Promise<void> {
  try {
    const linha = await reivindicarGeracao(id);
    if (!linha) return;
    const r = await gerar({
      tema: linha.tema,
      oQueResolve: linha.o_que_resolve,
      palavraDigitada: linha.palavra_digitada,
    });
    if (r.ok) await gravarGerado(id, r.dados, r.medicao);
    else await gravarFalha(id, r.erro, r.medicao);
  } catch (e) {
    try {
      await gravarFalha(id, mensagemDeFalhaInesperada(e), null);
    } catch {
      // Sem banco não há o que gravar: a linha aparece como "travou" pelo relógio.
    }
  }
}

export type DependenciasDoEnvio = {
  env?: Ambiente;
  agoraMs?: () => number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * A ORDEM: configuração → validação (só sem incerteza) → reserva → corpo → corpo
 * GRAVADO → POST → desfecho gravado. O corpo é gravado antes do POST para que um
 * processo que morra no meio deixe o corpo exato para o reenvio.
 *
 * A FICHA (`linha.tentativas`, devolvida pela reserva) vai em toda escrita. Se a
 * gravação do corpo não achar a linha, outra reserva assumiu e NADA é postado. Se a
 * do desfecho não achar, o desfecho deste envio fica de fora, de propósito, e a
 * resposta é `superado`.
 */
export async function enviarLinha(
  id: string,
  revisadoBruto: Record<string, unknown>,
  deps: DependenciasDoEnvio = {}
): Promise<ResultadoDoEnvio> {
  const config = configDoEnvio(deps.env ?? process.env);
  if (!config.ok) return { tipo: "sem_config", motivo: config.motivo };

  const antes = await lerLinha(id);
  if (!antes || antes.estado !== "pronto") return { tipo: "nao_encontrado" };
  if (!antes.incerto_pendente) {
    const lido = lerRevisado(revisadoBruto);
    if (!lido.ok) return { tipo: "invalido", problemas: lido.problemas };
  }

  const linha = await reivindicarEnvio(id);
  if (!linha) return { tipo: "ocupado" };
  const ficha = linha.tentativas;

  const prep = prepararEnvio(linha, revisadoBruto, config.segredo, (deps.agoraMs ?? Date.now)());
  if (!prep.ok) {
    await devolverEnvio(id, ficha, antes.envio_estado);
    return { tipo: "invalido", problemas: prep.problemas };
  }
  if (prep.corpoNovo && prep.revisado) {
    const gravou = await gravarCorpo(id, ficha, prep.slug, prep.corpo, prep.revisado);
    if (!gravou) return { tipo: "superado" };
  }

  const resposta = await postarNoLabs({
    url: config.url,
    corpo: prep.corpo,
    cabecalho: prep.cabecalho,
    timeoutMs: deps.timeoutMs ?? TIMEOUT_ENVIO_MS,
    fetchImpl: deps.fetchImpl,
  });
  const desfecho = lerResposta(resposta, { incertoAntes: linha.incerto_pendente, nossoSlug: prep.slug });
  const gravou = await gravarDesfecho(id, ficha, desfecho);
  if (!gravou) return { tipo: "superado" };
  return { tipo: "enviado", desfecho, slug: prep.slug };
}
