// O "NÃO CABE" ENQUANTO SE DIGITA: a mesma conta da arte (arte-slides.ts), feita sobre o que está
// nos campos do editor AGORA, e não sobre o texto salvo (spec da Etapa 3, "A prévia e o não cabe").
//
// PURO, e roda no navegador. AVISA, NUNCA IMPEDE (a regra do Labs, `slidesQueNaoCabem`). A conta é a
// exata da Etapa 4 (arte-medida.ts), conferida contra o desenho pelos vetores combinados com o Labs
// (tests/vetores-da-arte.json); onde o Satori também quebra dentro da palavra, ela só erra para o lado
// seguro.
import { slidesDoTexto, slidesQueNaoCabem } from "./arte-slides";
import { textoNaoCabeComEspaco, textoNaoCabeNunca } from "./arte-textos";
import { slidesDeConteudo } from "./carrossel-pedido";
import type { TextoDoCarrossel } from "./carrossel-texto";

/** O \r\n do textarea volta a ser \n, e as pontas em branco saem: é como a revisão grava. */
function limpo(v: string | undefined): string {
  return (v ?? "").replace(/\r\n?/g, "\n").trim();
}

/** O texto do carrossel montado com os campos (os nomes de `camposDoFormulario`). */
export function textoDosCampos(total: number, valores: Record<string, string>): TextoDoCarrossel {
  if (total === 1) {
    return {
      tipo: "post",
      titulo: "",
      texto: limpo(valores.texto),
      chamada: limpo(valores.chamada),
      legenda: limpo(valores.legenda),
    };
  }
  return {
    tipo: "carrossel",
    titulo: "",
    gancho: limpo(valores.gancho),
    slides: Array.from({ length: slidesDeConteudo(total) }, (_, i) => ({
      titulo: limpo(valores[`slide_${i + 1}_titulo`]),
      texto: limpo(valores[`slide_${i + 1}_texto`]),
    })),
    chamada: limpo(valores.chamada),
    legenda: limpo(valores.legenda),
  };
}

/** O campo do editor onde aparece o aviso do slide: o corpo dele. */
export function campoDoAviso(numero: number, total: number): string {
  if (total === 1) return "texto";
  if (numero === 1) return "gancho";
  if (numero === total) return "chamada";
  return `slide_${numero - 1}_texto`;
}

/**
 * Os avisos, por campo. Com o espaço da imagem, o slide que não cabe pede "só texto" ou um texto
 * menor; o que não cabe nem sem o espaço pede um texto menor; o "só texto" que cabe cala.
 */
export function avisosDeCabimento(total: number, valores: Record<string, string>, soTexto: number[]): Record<string, string> {
  const avisos: Record<string, string> = {};
  for (const f of slidesQueNaoCabem(slidesDoTexto(textoDosCampos(total, valores)))) {
    if (f.cortaSempre) avisos[campoDoAviso(f.numero, total)] = textoNaoCabeNunca(f.numero);
    else if (!soTexto.includes(f.numero)) avisos[campoDoAviso(f.numero, total)] = textoNaoCabeComEspaco(f.numero);
  }
  return avisos;
}
