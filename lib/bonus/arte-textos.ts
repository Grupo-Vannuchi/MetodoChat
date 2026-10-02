import type { Aviso } from "@/lib/avisos";
import type { ContaDoCabecalho, OrigemDaConta } from "./arte-conta";
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
 * A resposta do salvar da arte (o "só texto") e do "Fixar nesta conta", que volta como ESTADO e não
 * por redirect: a seção da arte fica na página do editor, e recriar a página apagaria a edição
 * (achado 52). `em` muda a cada resposta, e é o que troca a versão das miniaturas depois de salvar.
 */
export type AvisoDaArte = Aviso & { em: number };

export const TEXTO_ARTE_SALVA = "Arte salva.";
export const TEXTO_CONTA_FIXADA = "Conta fixada neste carrossel.";

export function textoDaRecusaDaArte(motivo: RecusaDaArte): string {
  switch (motivo) {
    case "slide":
      return "Esse slide não existe neste carrossel. Recarregue a página.";
    case "ja_tem_conta":
      return "Este carrossel já tem conta, e a conta de um carrossel não muda.";
    case "sem_conta":
      return TEXTO_ARTE_SEM_CONTA;
  }
}

// O "não cabe", junto do campo do editor e embaixo da miniatura.
export function textoNaoCabeComEspaco(numero: number): string {
  return `O slide ${numero} não cabe com o espaço da imagem. Marque "só texto" nele, ou encurte.`;
}

export function textoNaoCabeNunca(numero: number): string {
  return `O slide ${numero} não cabe nem sem o espaço da imagem. Encurte o texto.`;
}

/** De onde veio a conta do cabeçalho (arte-conta.ts). A do carrossel, conectada, não precisa de aviso. */
export function textoDaOrigemDaConta(origem: OrigemDaConta, arroba: string): string | null {
  switch (origem) {
    case "gravada":
      return null;
    case "guardada":
      return `A conta deste carrossel (@${arroba}) foi desconectada do Chat. A arte segue com o nome dela, e as iniciais no lugar da foto.`;
    case "selecionada":
      return `Este carrossel é de antes de a conta ser gravada, e a arte usa a conta logada agora (@${arroba}). Use "Fixar nesta conta" para ele ficar com ela.`;
    case "gravada_saiu":
      return `A conta deste carrossel foi desconectada do Chat, e ele não guardou o nome dela. A arte usa a conta logada agora (@${arroba}).`;
  }
}

export function rotuloDaConta(c: ContaDoCabecalho): string {
  return c.name ? `${c.name} (@${c.username ?? ""})` : `@${c.username ?? ""}`;
}

/** Antes do "Baixar todos": o navegador costuma pedir permissão para vários downloads. */
export function textoDoBaixarTodos(total: number): string {
  return `O navegador pode pedir permissão para baixar vários arquivos de uma vez. Aceite para receber os ${total} slides.`;
}
