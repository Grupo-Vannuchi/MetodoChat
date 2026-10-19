import { apagarCarrosselDaPagina } from "@/app/bonus/apagar-actions";
import { podeApagarAgora } from "@/lib/bonus/apagar-carrossel";
import { apagarNaPagina } from "@/lib/bonus/apagar-textos";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { GeracaoNaTela } from "@/lib/bonus/tempos";
import BotaoDeApagar from "./botao-de-apagar";

// O FIM DA PÁGINA DO CARROSSEL (spec da Etapa 10), nas duas páginas e em todo estado da geração: o
// "Apagar carrossel", a frase de por que não pode, ou nada (o publicado fica como histórico). Quem decide
// é a regra do servidor (`podeApagarAgora`), a mesma que a action confere com a linha travada.
export default async function Apagar({ carrossel, geracao }: { carrossel: LinhaDoCarrossel; geracao: GeracaoNaTela }) {
  const tela = apagarNaPagina(await podeApagarAgora(carrossel, geracao));
  if (tela.tipo === "nada") return null;
  return <BotaoDeApagar id={carrossel.id} frase={tela.tipo === "frase" ? tela.texto : null} acao={apagarCarrosselDaPagina} />;
}
