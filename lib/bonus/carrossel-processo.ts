import "server-only";
import { gerarTextoDoCarrossel, type ResultadoDoCarrossel } from "./carrossel-ia";
import { contextoGravado, type PedidoParaIA } from "./carrossel-ia-parametros";
import { gravarCarrosselPronto, gravarFalhaDoCarrossel, reivindicarCarrossel } from "./carrossel-repositorio";
import { conferirGerado } from "./carrossel-texto";
import { textoDaConferencia } from "./carrossel-textos";
import { mensagemDeFalhaInesperada } from "./erros";

// GERAR O CARROSSEL, DE PONTA A PONTA. As decisões moram nas funções puras; aqui só se costura a
// ordem: reivindicar → gerar → conferir → gravar.

export type GeradorDeCarrossel = (p: PedidoParaIA) => Promise<ResultadoDoCarrossel>;

/** Roda no `after()` da action. Nunca lança: toda saída vira linha gravada. */
export async function processarCarrossel(id: string, gerar: GeradorDeCarrossel = gerarTextoDoCarrossel): Promise<void> {
  try {
    const linha = await reivindicarCarrossel(id);
    if (!linha) return;
    const contexto = contextoGravado(linha.contexto);
    if (!contexto) {
      await gravarFalhaDoCarrossel(id, "O pedido deste carrossel foi gravado sem o contexto do bônus. Gere de novo.", null);
      return;
    }
    const r = await gerar({ total: linha.total_slides, palavra: linha.palavra, contexto });
    if (!r.ok) {
      await gravarFalhaDoCarrossel(id, r.erro, r.medicao);
      return;
    }
    const falha = conferirGerado(linha.total_slides, linha.palavra, r.texto);
    if (falha) await gravarFalhaDoCarrossel(id, textoDaConferencia(falha, linha.palavra), r.medicao);
    else await gravarCarrosselPronto(id, r.texto, r.medicao);
  } catch (e) {
    try {
      await gravarFalhaDoCarrossel(id, mensagemDeFalhaInesperada(e), null);
    } catch {
      // Sem banco não há o que gravar: a linha aparece como "travou" pelo relógio.
    }
  }
}
