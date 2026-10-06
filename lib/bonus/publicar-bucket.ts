import "server-only";
import { apagarObjeto, pastaDaConta, urlAssinadaDeUpload, urlPublicaDoObjeto } from "@/lib/bucket";
import { caminhoDaImagem, type DestinoDaImagem } from "./publicar-regras";

// O BUCKET DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5). Só as chamadas que lib/bucket.ts já exporta
// e já mediu contra o projeto real (03/09/2026): assinar o upload, o GET público, o PUT na URL
// assinada e o DELETE. Nenhum endpoint novo do Supabase, e lib/bucket.ts não muda. A chave de
// serviço fica lá dentro: nada daqui a vê.
//
// A PASTA É SEMPRE A DA CONTA DO CARROSSEL, nunca a do cookie: quem chama passa a conta gravada no
// carrossel (arte-escolhas.ts), e a rota de assinar do /publicar, que usa o cookie, não é usada.

/** Um caminho novo no destino, na pasta da conta, e a URL assinada que vale só para ele. */
export async function assinarCaminho(
  conta: string,
  destino: DestinoDaImagem,
  uuid: string = crypto.randomUUID()
): Promise<{ caminho: string; url: string }> {
  const caminho = caminhoDaImagem(pastaDaConta(conta), destino, uuid);
  const { url } = await urlAssinadaDeUpload(caminho);
  return { caminho, url };
}

/** O teto da Meta para imagem (lib/publicacao.ts, `IMAGEM_BYTES_MAX`). Uma cópia maior não serviria. */
export const COPIA_MAX_BYTES = 8 * 1024 * 1024;

/**
 * COPIA UMA IMAGEM GUARDADA PARA A FILA, no servidor: baixa pelo endereço público (o mesmo que a Meta
 * busca, sem token), assina um caminho novo em `bonus-fila` e sobe os mesmos bytes. A fila leva a
 * cópia, e o dreno apaga só ela depois de publicar (lib/queue-drain.ts, `limparOBucket`): a guardada
 * fica no carrossel. Lança com a frase do que falhou; a URL assinada nunca entra na frase, porque o
 * token vai nela.
 */
export async function copiarParaAFila(origem: string, conta: string, uuid: string = crypto.randomUUID()): Promise<string> {
  const baixada = await fetch(urlPublicaDoObjeto(origem), { cache: "no-store" });
  if (!baixada.ok) throw new Error(`a imagem guardada não foi encontrada no armazenamento (HTTP ${baixada.status})`);
  const bytes = new Uint8Array(await baixada.arrayBuffer());
  if (bytes.length === 0 || bytes.length > COPIA_MAX_BYTES) {
    throw new Error(`a imagem guardada tem um tamanho que o Instagram não aceita (${bytes.length} bytes)`);
  }
  const { caminho, url } = await assinarCaminho(conta, "fila", uuid);
  const subida = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
  if (!subida.ok) throw new Error(`o armazenamento recusou a cópia (HTTP ${subida.status})`);
  return caminho;
}

/**
 * COPIA AS IMAGENS DE TODOS OS SLIDES COM ESPAÇO, ao mesmo tempo. Se uma falha, as que já foram
 * feitas saem do bucket, e a resposta diz qual slide falhou.
 */
export async function copiarTodasParaAFila(
  origens: { numero: number; caminho: string }[],
  conta: string
): Promise<{ ok: true; copias: Record<number, string> } | { ok: false; numero: number }> {
  const resultados = await Promise.allSettled(origens.map((o) => copiarParaAFila(o.caminho, conta)));
  const feitas = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const falhou = resultados.findIndex((r) => r.status === "rejected");
  if (falhou >= 0) {
    await apagarSemDerrubar(feitas);
    return { ok: false, numero: origens[falhou].numero };
  }
  return { ok: true, copias: Object.fromEntries(origens.map((o, i) => [o.numero, feitas[i]])) };
}

/**
 * APAGA SEM DERRUBAR quem chama: o que falhar ao apagar fica no bucket sem dono (spec, "O que fica no
 * bucket sem dono"), e a operação que importa já terminou ou já foi recusada. É o molde de
 * `limparOBucket` (lib/queue-drain.ts).
 */
export async function apagarSemDerrubar(caminhos: string[]): Promise<void> {
  for (const caminho of caminhos) {
    try {
      await apagarObjeto(caminho);
    } catch {
      // Um arquivo que fica no bucket não quebra nada hoje; a recusa ou o sucesso já foram decididos.
    }
  }
}
