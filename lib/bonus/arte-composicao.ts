// A COMPOSIÇÃO DO SLIDE: as linhas que o desenho desenha (arte-desenho.tsx) e a conta do "não cabe"
// mede (arte-medida.ts), cada uma com o texto, o peso, o espaçamento e o espaço acima. PURA, e roda
// no navegador. É a mesma função nos dois, e não duas leituras da mesma regra: antes, a regra do
// negrito vivia no desenho, e a conta media um texto montado à parte, que já divergiu do desenho no
// Labs (o aviso de 1254847). A 48.1 e a 48.4 do Labs fazem o mesmo do lado de lá.
//
// ⚠️ A NORMALIZAÇÃO MORA AQUI E RODA UMA VEZ, combinada com o Labs em 02/10 (spec da Etapa 4, "Dois
// donos"). O desenho e a conta recebem o texto pronto e não normalizam por conta própria:
// - NFC: o Satori põe o espaçamento do negrito por glifo, e o acento em NFD é um glifo a mais;
// - as sete quebras obrigatórias do quebrador do Satori (\r\n, \r, \v, \f, NEL, U+2028, U+2029)
//   viram \n: sem isso, ele quebraria a linha sem a conta ver;
// - em cada linha, espaços e tabs seguidos viram um espaço e as pontas saem (`trim`), que é o que o
//   Satori faria de qualquer jeito;
// - parágrafo é a linha vazia, contada DEPOIS disso: a linha só de espaços também separa;
// - a manchete perde as quebras (o Satori as trocaria por espaço), e só de espaços não é manchete.
import { ESPACAMENTO_DO_NEGRITO, type EspacoAntes } from "./arte-geometria";

/** Uma linha da arte, já normalizada: o Satori a quebra na largura, mas não muda o texto. */
export type LinhaDaArte = { texto: string; negrito: boolean; espacamento: number; antes: EspacoAntes };

const QUEBRAS = /\r\n|[\r\n\u000B\u000C\u0085\u2028\u2029]/g;

function normalizarLinha(linha: string): string {
  return linha.replace(/[ \t]+/g, " ").trim();
}

/** Os parágrafos do corpo: linhas não vazias seguidas, separadas por uma ou mais linhas vazias. */
function paragrafos(texto: string): string[][] {
  const blocos: string[][] = [];
  let atual: string[] = [];
  for (const linha of texto.normalize("NFC").replace(QUEBRAS, "\n").split("\n").map(normalizarLinha)) {
    if (linha) atual.push(linha);
    else if (atual.length) {
      blocos.push(atual);
      atual = [];
    }
  }
  if (atual.length) blocos.push(atual);
  return blocos;
}

export function composicaoDoSlide(titulo: string | null, texto: string): LinhaDaArte[] {
  const manchete = normalizarLinha((titulo ?? "").normalize("NFC").replace(QUEBRAS, " "));
  const blocos = paragrafos(texto);
  const linha = (t: string, negrito: boolean, antes: EspacoAntes): LinhaDaArte => ({
    texto: t,
    negrito,
    espacamento: negrito ? ESPACAMENTO_DO_NEGRITO : 0,
    antes,
  });

  const linhas: LinhaDaArte[] = manchete ? [linha(manchete, true, "nada")] : [];
  blocos.forEach((bloco, i) => {
    // O negrito vai no ÚLTIMO bloco quando há fechamento (mais de um bloco), e no bloco único sem
    // manchete: o gancho e a chamada, em que o texto É a peça.
    const negrito = i === blocos.length - 1 && (blocos.length > 1 || !manchete);
    bloco.forEach((t, j) => {
      const antes: EspacoAntes = j > 0 ? "nada" : i > 0 ? "paragrafo" : manchete ? "manchete" : "nada";
      linhas.push(linha(t, negrito, antes));
    });
  });
  return linhas;
}
