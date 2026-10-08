import Link from "next/link";
import { alertError, card, link, pageSubtitle, pageTitle } from "@/app/ui";
import { restamCarrosseisHoje } from "@/lib/bonus/carrossel-pedido";
import { carrosseisNasUltimas24h } from "@/lib/bonus/carrossel-repositorio";
import { textoDosBonusDeFora } from "@/lib/bonus/avulso-textos";
import { TEXTO_TABELA_CARROSSEL_AUSENTE, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { listaDoLabs } from "@/lib/bonus/publicado";
import { pedirCarrosselAvulso } from "../actions";
import FormularioDoAvulso from "./formulario-do-avulso";

// O "NOVO CARROSSEL" (spec da Etapa 7). A lista do Labs é lida a cada vez, como a situação do bônus na
// página dele, e a falha mostra a frase, e não uma lista vazia. A lista está no contrato do Labs desde
// 01/10, com a palavra e o tema opcionais (achado 83): o bônus que fica de fora é contado na tela.
//
// O teto de lib/bonus/tempos.ts (MAX_DURATION_S): a geração pela IA roda no `after()` da action desta
// página. O Next exige literal aqui, e tests/bonus-avulso-paginas.test.ts confere que é o mesmo número.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export default async function NovoCarrossel() {
  let usadas: number;
  try {
    usadas = await carrosseisNasUltimas24h();
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  const lista = await listaDoLabs(process.env.LABS_URL);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/carrosseis" className={link}>
          Voltar para os carrosséis
        </Link>
        <h1 className={`mt-2 ${pageTitle}`}>Novo carrossel</h1>
        <p className={pageSubtitle}>De um bônus que já está no Labs, ou de um texto livre. A IA escreve, ou você escreve à mão.</p>
      </div>
      <section className={`${card} p-6`}>
        <FormularioDoAvulso
          acao={pedirCarrosselAvulso}
          bonus={lista.ok ? lista.bonus : []}
          falhaDaLista={lista.ok ? null : quadroDaSituacao({ tipo: lista.tipo }).texto}
          deFora={lista.ok ? textoDosBonusDeFora(lista.deFora) : null}
          restam={restamCarrosseisHoje(usadas)}
        />
      </section>
    </div>
  );
}
