import type { Aviso } from "@/lib/avisos";
import type { RecusaDaArte } from "./arte-escolhas";

// AS FRASES DA ARTE DO CARROSSEL, fora do JSX e da rota (o princípio de lib/bonus/textos.ts): uma
// saída muda é indistinguível de sucesso, e cada saída tem frase, testada.

// As recusas da rota. Elas aparecem no lugar da miniatura, e na aba quando se abre o endereço.
export const TEXTO_ARTE_SEM_SESSAO = "Entre no painel para ver a arte.";
export const TEXTO_ARTE_NAO_ENCONTRADA = "Esse carrossel não existe, ou o endereço está errado.";
export const TEXTO_ARTE_NAO_PRONTA = "A arte só existe para carrossel pronto, com o texto conferido.";
export const TEXTO_ARTE_SLIDE_INVALIDO = "Esse slide não existe neste carrossel.";
export const TEXTO_ARTE_SEM_CONTA =
  "Nenhuma conta do Instagram está conectada no Chat, e o cabeçalho da arte precisa de uma.";
export const TEXTO_ARTE_SEM_FONTE =
  "A arte não pôde ser desenhada: a fonte Carlito não foi encontrada no servidor. Avise quem cuida do Chat.";
export const TEXTO_ARTE_SEM_DESENHO =
  "A arte deste slide não pôde ser desenhada. Se o texto tem emoji, tente de novo em instantes: o desenho do emoji vem de fora do Chat. Se continuar, avise quem cuida do Chat.";

/**
 * A resposta do salvar da arte (a conta e o "só texto"), que volta como ESTADO e não por redirect:
 * a seção da arte fica na página do editor, e recriar a página apagaria a edição (achado 52). `em`
 * muda a cada resposta, e é o que troca a versão das miniaturas depois de salvar.
 */
export type AvisoDaArte = Aviso & { em: number };

export const TEXTO_ARTE_SALVA = "Arte salva.";

export function textoDaRecusaDaArte(motivo: RecusaDaArte): string {
  switch (motivo) {
    case "conta":
      return "Essa conta não está conectada no Chat. Escolha uma das contas da lista.";
    case "slide":
      return "Esse slide não existe neste carrossel. Recarregue a página.";
  }
}
