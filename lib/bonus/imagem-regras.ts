// AS REGRAS DO CRIADOR DE IMAGEM (spec da Etapa 6). PURO: o processo, o repositório, a consulta e a
// tela leem daqui.
import { medidasDoJpeg } from "./imagem-jpeg";
import { problemaDaFotoDoEspaco, type ProblemaDaFoto } from "./publicar-regras";

/**
 * O TETO: 10 imagens nas últimas 24 horas, somando todos os carrosséis (decisão do Eduardo em 09/10, o
 * mesmo número do Labs). Cada uma custa ~US$ 0,063 na qualidade usada (medido pelo Labs em 21/09).
 */
export const TETO_IMAGEM_DIARIO = 10;

/**
 * O PRAZO DA CHAMADA À OPENAI: o `TIMEOUT_API_MS` do Labs. A qualidade usada leva ~34 s; o `high`, que
 * não foi adotado, levou 92 s e ainda caberia.
 */
export const TIMEOUT_IMAGEM_MS = 180_000;

/**
 * A LINHA `gerando` MAIS VELHA QUE ISTO NÃO TERMINA MAIS: a geração morreu sem marcar a linha (a função
 * da Vercel parou, por exemplo). Ela aparece como falha, libera o slide para outro pedido e continua
 * contando no teto. É o "travada" do Labs: o prazo da chamada com uma folga para subir e guardar.
 */
export const TRAVADA_IMAGEM_MS = 210_000;

/**
 * O NÍVEL DO JPEG PEDIDO À OPENAI (`output_compression`, de 0 a 100; o padrão dela é 100). A foto do
 * espaço é lida até 2 MB (`FOTO_DO_ESPACO_MAX_BYTES`), e um JPEG de 1536×1024 neste nível fica bem
 * abaixo disso. A prova mede os bytes da primeira imagem; a conferência abaixo recusa a que passar.
 */
export const COMPRESSAO_DA_IMAGEM = 90;

/** O que impede guardar a imagem gerada: não é JPEG, ou não passa na regra da foto do espaço. */
export type ProblemaDaImagem = "formato" | ProblemaDaFoto;

/**
 * A IMAGEM QUE VOLTOU, CONFERIDA ANTES DE QUALQUER GRAVAÇÃO: os bytes de um JPEG, as medidas do
 * cabeçalho dele e o tamanho, pela mesma regra da foto subida (a proporção do espaço, de 860×573 a
 * 1720×1146, e até 2 MB). O 1536×1024 da OpenAI passa.
 */
export function problemaDaImagemGerada(bytes: Uint8Array): ProblemaDaImagem | null {
  const medidas = medidasDoJpeg(bytes);
  if (!medidas) return "formato";
  return problemaDaFotoDoEspaco(medidas.largura, medidas.altura, bytes.length);
}
