import { cookies } from "next/headers";
import { alertError } from "@/app/ui";
import { fixarContaDoCarrossel, salvarArteDoCarrossel, salvarSlideDoCarrossel } from "@/app/bonus/carrossel-actions";
import { assinarImagemDoCarrossel, guardarImagemDoSlide, publicarCarrossel } from "@/app/bonus/publicar-actions";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
import { contaSelecionada, resolverConta } from "@/lib/bonus/arte-conta";
import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
import { caminhoDoCarrossel } from "@/lib/bonus/carrossel-caminho";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { camposDoFormulario, valoresPorCampo } from "@/lib/bonus/carrossel-texto";
import { TEXTO_CARROSSEL_SEM_TEXTO } from "@/lib/bonus/carrossel-textos";
import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
import { fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
import {
  textoDaTrava,
  textoDoCalendario,
  textoDoEstadoDaPublicacao,
  textoDoFunil,
  tomDoEstadoDaPublicacao,
} from "@/lib/bonus/publicar-textos";
import EditorDoCarrossel from "./editor-do-carrossel";
import type { PublicacaoNaTela } from "./publicacao-na-tela";

// A PARTE DE DENTRO DA PÁGINA DO CARROSSEL, quando ele está pronto (a revisão slide a slide, a arte e a
// publicação). Até a Etapa 5 ela morava em page.tsx; na Etapa 7 veio para cá, sem mudar o que faz,
// para servir também à página do carrossel avulso (app/carrosseis/[cid]/page.tsx).

/**
 * O CARROSSEL PRONTO, SLIDE A SLIDE (editor-do-carrossel.tsx, spec da Etapa 4). A conta é a do
 * carrossel (arte-conta.ts): a página mostra qual é, avisa quando ela saiu do Chat, e oferece "Fixar
 * nesta conta" ao carrossel de antes de a conta ser gravada. Cada miniatura tem a sua versão, o resumo
 * de tudo o que a rota desenha naquele slide (arte-tela.ts, `versoesDosSlides`).
 *
 * A PUBLICAÇÃO (spec da Etapa 5) é decidida aqui, no servidor: as imagens do Canva guardadas, com o
 * endereço público delas; a versão do texto de cada slide; o estado lido da fila pela chave exata; a
 * trava; e o aviso do calendário, que só mostra a conta selecionada no menu.
 *
 * O AVISO DO FUNIL (spec da Etapa 7) também: depois de agendar ou publicar, a página lembra de ligar a
 * automação da palavra no post novo, no /automacoes. Vale para o carrossel de bônus e para o avulso.
 */
export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
  const texto = textoDaLinhaDoCarrossel(carrossel);
  if (!texto) return <div className={alertError}>{TEXTO_CARROSSEL_SEM_TEXTO}</div>;

  const contas = await contasParaArte();
  const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  const { conta, origem } = resolverConta(contas, escolhas, doCookie);

  const estado = await estadoDoCarrossel(carrossel.arte);
  const filaId = "filaId" in estado ? estado.filaId : null;
  const noMenu = contaSelecionada(contas, doCookie);
  // O jeito de cada imagem é o prefixo do caminho (adendo da Etapa 5): as fotos são as de `bonus-foto`.
  const fotos = fotosDaArte(carrossel.arte, carrossel.total_slides);
  const publicacao: PublicacaoNaTela = {
    acaoDaAssinatura: assinarImagemDoCarrossel,
    acaoDaImagem: guardarImagemDoSlide,
    acaoDaPublicacao: publicarCarrossel,
    imagens: Object.fromEntries(
      Object.entries(imagensDaArte(carrossel.arte, carrossel.total_slides)).map(([n, i]) => [
        n,
        { url: urlPublicaSeDerParaMontar(i.caminho), versao: i.versao, jeito: Number(n) in fotos ? "foto" : "slide" },
      ])
    ),
    versoesDoTexto: slidesDoTexto(texto).map(versaoDoTextoDoSlide),
    travado: publicacaoLivre(estado) ? null : textoDaTrava(estado),
    origem,
    arroba: origem === "gravada" ? (conta?.username ?? null) : null,
    estado: { texto: textoDoEstadoDaPublicacao(estado), tom: tomDoEstadoDaPublicacao(estado), filaId, livre: publicacaoLivre(estado) },
    avisoDoCalendario:
      filaId && conta && escolhas.conta && noMenu?.ig_user_id !== escolhas.conta ? textoDoCalendario(rotuloDaConta(conta)) : null,
    avisoDoFunil: textoDoFunil(estado, carrossel.palavra),
  };

  return (
    <EditorDoCarrossel
      acaoDoSlide={salvarSlideDoCarrossel}
      acaoDaArte={salvarArteDoCarrossel}
      acaoDaConta={fixarContaDoCarrossel}
      caminho={caminhoDoCarrossel(carrossel)}
      carrosselId={carrossel.id}
      palavra={carrossel.palavra}
      total={carrossel.total_slides}
      campos={camposDoFormulario(carrossel.total_slides)}
      valores={valoresPorCampo(texto)}
      rotuloDaConta={conta ? rotuloDaConta(conta) : null}
      avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
      podeFixar={origem === "selecionada" && conta !== null}
      soTextoInicial={escolhas.soTexto}
      versoes={versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotos)}
      publicacao={publicacao}
    />
  );
}
