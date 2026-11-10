import "server-only";
import { apagarObjeto, caminhoDoObjeto, pastaDaConta, urlAssinadaDeUpload, urlPublicaDoObjeto } from "./bucket";
import { caminhosDoCampo } from "./publicacao";

// A CÓPIA DA IMAGEM PARA A LINHA DO LINKEDIN, NO POST DAS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §6;
// a parte 2b). O dreno do Instagram apaga o arquivo da linha dele depois de publicar (`limparOBucket`,
// lib/queue-drain.ts), e o do LinkedIn também: com o mesmo arquivo nas duas linhas, quem saísse primeiro apagaria o
// do outro. Então a linha do LinkedIn leva uma cópia própria.
//
// É A IRMÃ DO `copiarParaAFila` DO GERADOR (lib/bonus/publicar-bucket.ts): as mesmas chamadas que lib/bucket.ts já
// exporta e já mediu (o GET público, a URL assinada e o PUT), sem endpoint novo do Supabase. Ela é outra função
// porque o caminho é outro: a do gerador grava em `<pasta>/bonus-fila/<uuid>.jpg`, e o /publicar lê só
// `<pasta>/<id>.<ext>` (`caminhosDoCampo`, lib/publicacao.ts).

/** O teto da imagem do Instagram (lib/publicacao.ts, `IMAGEM_BYTES_MAX`), o mesmo da cópia do gerador. */
export const TETO_DA_COPIA_BYTES = 8 * 1024 * 1024;

/**
 * O TETO DE TEMPO DE CADA CHAMADA DA CÓPIA, o mesmo do download do bucket no ramo do LinkedIn
 * (`TETO_DO_BUCKET_MS`, lib/linkedin-fila.ts): a cópia roda dentro da action de publicar, e um bucket que não
 * responde não pode prender a tela. Ele vale também para a assinatura, que é do lib/bucket.ts e não tem teto
 * próprio: o teto é de quem chama (nota da auditoria sobre a F2).
 */
export const TETO_DA_COPIA_MS = 10_000;

/**
 * UMA CHAMADA COM TETO, pelo relógio da função (e não pelo `AbortSignal.timeout`, que o teste não consegue
 * adiantar). Estourado o teto, a cópia lança na hora, e o sinal desiste da chamada que ainda estiver pendurada.
 */
function comTeto<T>(fazer: (sinal: AbortSignal) => Promise<T>, oQue: string): Promise<T> {
  const controle = new AbortController();
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, falhar) => {
    relogio = setTimeout(() => {
      falhar(new Error(`o armazenamento não respondeu em ${TETO_DA_COPIA_MS / 1000} s ${oQue}`));
      controle.abort();
    }, TETO_DA_COPIA_MS);
  });
  return Promise.race([fazer(controle.signal), estouro]).finally(() => clearTimeout(relogio));
}

/**
 * COPIA A IMAGEM DO POST PARA UM CAMINHO NOVO NA MESMA PASTA, e devolve o caminho da cópia.
 *
 * A ORIGEM TEM DE SER DA CONTA QUE PUBLICA, na forma dos caminhos do /publicar, e isso é conferido ANTES de
 * qualquer chamada: a action já filtrou o caminho pela pasta da conta do cookie, e esta é a segunda barreira, para
 * a cópia nunca ler o arquivo de outra conta. Lança com a frase do que falhou; a URL assinada nunca entra na
 * frase, porque o token vai nela.
 */
export async function copiarImagemParaOLinkedin(origem: string, conta: string, uuid: string = crypto.randomUUID()): Promise<string> {
  const pasta = pastaDaConta(conta);
  const conferidos = caminhosDoCampo(origem, pasta);
  if (conferidos.length !== 1 || conferidos[0] !== origem) throw new Error("a imagem não é desta conta");

  const bytes = await comTeto(async (sinal) => {
    const baixada = await fetch(urlPublicaDoObjeto(origem), { cache: "no-store", signal: sinal });
    if (!baixada.ok) throw new Error(`a imagem não foi encontrada no armazenamento (HTTP ${baixada.status})`);
    return new Uint8Array(await baixada.arrayBuffer());
  }, "ao baixar a imagem");
  if (bytes.length === 0 || bytes.length > TETO_DA_COPIA_BYTES) {
    throw new Error(`a imagem tem um tamanho que não dá para copiar (${bytes.length} bytes)`);
  }

  const destino = caminhoDoObjeto(conta, "copia.jpg", uuid, "image/jpeg");
  const { url } = await comTeto(() => urlAssinadaDeUpload(destino), "ao assinar a cópia");
  await comTeto(async (sinal) => {
    const subida = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes, signal: sinal });
    if (!subida.ok) throw new Error(`o armazenamento recusou a cópia (HTTP ${subida.status})`);
  }, "ao subir a cópia");
  return destino;
}

/**
 * APAGA A CÓPIA QUE NÃO VAI SER USADA (a nota 2 da auditoria sobre a F2): a linha do LinkedIn não entrou, ou foi
 * desfeita. Sem derrubar quem chama, como o `apagarSemDerrubar` do gerador: a recusa ou o desfecho já foram
 * decididos, e uma cópia que fica no bucket não quebra nada.
 */
export async function apagarACopiaSemDerrubar(caminho: string): Promise<void> {
  try {
    await apagarObjeto(caminho);
  } catch {
    // Fica no bucket sem dono; o aviso da tela já diz o que aconteceu com o post.
  }
}
