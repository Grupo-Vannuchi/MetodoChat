import Link from "next/link";
import { notFound } from "next/navigation";
import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
import Acompanhar from "@/app/bonus/[id]/acompanhar";
import Revisao from "@/app/bonus/[id]/carrossel/[cid]/revisao";
import { avisoDaUrl } from "@/lib/avisos";
import { textoDaOrigem } from "@/lib/bonus/avulso-textos";
import { ehDaRota } from "@/lib/bonus/carrossel-caminho";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { TEXTO_TABELA_CARROSSEL_AUSENTE, avisoDePalavraTrocada, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { urlPublicaDoBonus } from "@/lib/bonus/labs";
import { situacaoNoLabs } from "@/lib/bonus/publicado";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
import { gerarAvulsoDeNovo } from "../actions";

// A PÁGINA DO CARROSSEL AVULSO (spec da Etapa 7): a mesma da Etapa 5, com a mesma parte de dentro
// (revisao.tsx: os cards, a legenda, o "Baixar todos", a foto, o slide pronto e o "Publicar"). Muda
// só o topo: a origem, a palavra e, no avulso do Labs, a situação do bônus lá.
//
// O teto de lib/bonus/tempos.ts (MAX_DURATION_S): o "Gerar de novo" desta página corre sob ele. O
// Next exige literal aqui, e tests/bonus-avulso-paginas.test.ts confere que é o mesmo número.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };

export default async function PaginaDoAvulso({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const { cid } = await params;
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);

  let carrossel: LinhaDoCarrossel | null;
  try {
    carrossel = await lerCarrossel(cid);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  if (!carrossel || !ehDaRota(carrossel, { tipo: "avulso" })) notFound();

  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const geracao = geracaoNaTela(carrossel.estado, carrossel.criado_em, agora);
  const texto = textoDaLinhaDoCarrossel(carrossel);

  // NO AVULSO DO LABS, A SITUAÇÃO DO BÔNUS É LIDA A CADA VEZ, como na página do carrossel de bônus, e
  // pelo mesmo motivo: o bônus pode ser despublicado ou trocar de palavra no /admin do Labs depois de
  // gerar. Durante a geração não, porque a tela pergunta ao servidor a cada 2 s.
  const codigo = carrossel.origem === "labs" ? carrossel.labs_codigo : null;
  const situacao = codigo && geracao !== "gerando" ? await situacaoNoLabs(process.env.LABS_URL, codigo) : null;
  const quadro = situacao ? quadroDaSituacao(situacao) : null;
  const trocada =
    situacao?.tipo === "publicado" && situacao.bonus.palavra !== carrossel.palavra ? situacao.bonus.palavra : null;
  const publico = codigo ? urlPublicaDoBonus(process.env.LABS_URL, codigo) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/carrosseis" className={link}>
          Voltar para os carrosséis
        </Link>
        <h1 className={`mt-2 ${pageTitle}`}>{texto?.titulo ?? descricaoDoCarrossel(carrossel)}</h1>
        <p className={pageSubtitle}>
          {textoDaOrigem(carrossel)} · {descricaoDoCarrossel(carrossel)} · palavra {carrossel.palavra}
        </p>
        {publico && (
          <a href={publico} target="_blank" rel="noreferrer" className={`mt-1 inline-block text-sm ${link}`}>
            Ver o bônus no Labs
          </a>
        )}
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}
      {quadro && <div className={QUADRO[quadro.tom]}>{quadro.texto}</div>}
      {trocada && <div className={alertWarn}>{avisoDePalavraTrocada(trocada, carrossel.palavra)}</div>}

      {geracao === "gerando" && (
        <section className={`${card} space-y-3 p-6`}>
          <div className={`h-4 w-2/3 ${skeleton}`} />
          <div className={`h-4 w-1/2 ${skeleton}`} />
          <div className={`h-24 ${skeleton}`} />
          <Acompanhar criadoEmMs={carrossel.criado_em.getTime()} />
        </section>
      )}

      {(geracao === "falhou" || geracao === "travou") && (
        <section className={`${card} space-y-4 p-6`}>
          <div className={alertError}>
            {geracao === "travou" ? TEXTO_TRAVOU : (carrossel.erro ?? "A geração falhou sem dizer o motivo.")}
          </div>
          <form action={gerarAvulsoDeNovo}>
            <input type="hidden" name="id" value={carrossel.id} />
            <button type="submit" className={btnPrimary}>
              Gerar de novo
            </button>
          </form>
          <p className={hint}>Conta como uma das gerações de carrossel do dia.</p>
        </section>
      )}

      {geracao === "pronto" && <Revisao carrossel={carrossel} />}
    </div>
  );
}
