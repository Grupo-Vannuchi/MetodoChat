import Link from "next/link";
import { notFound } from "next/navigation";
import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
import { gerarCarrosselDeNovo, salvarRevisaoDoCarrossel } from "@/app/bonus/carrossel-actions";
import { avisoDaUrl, type Aviso } from "@/lib/avisos";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { camposDoFormulario, valoresPorCampo } from "@/lib/bonus/carrossel-texto";
import {
  TEXTO_CARROSSEL_SEM_TEXTO,
  TEXTO_TABELA_CARROSSEL_AUSENTE,
  avisoDePalavraTrocada,
  quadroDaSituacao,
} from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { situacaoNoLabs, type SituacaoNoLabs } from "@/lib/bonus/publicado";
import { lerLinha } from "@/lib/bonus/repositorio";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
import Acompanhar from "../../acompanhar";
import AvisoDoFormulario from "./aviso-do-formulario";
import Campo from "./campo";

// O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
// tests/bonus-carrossel-paginas.test.ts confere que é o mesmo número. O "Gerar de novo" desta
// página corre sob este teto.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };

export default async function PaginaDoCarrossel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; cid: string }>;
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const { id, cid } = await params;
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);

  let carrossel: LinhaDoCarrossel | null;
  try {
    carrossel = await lerCarrossel(cid);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  if (!carrossel || carrossel.bonus_id !== id) notFound();

  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const geracao = geracaoNaTela(carrossel.estado, carrossel.criado_em, agora);
  const texto = textoDaLinhaDoCarrossel(carrossel);

  // A SITUAÇÃO NO LABS É LIDA A CADA VEZ, menos durante a geração. A palavra do carrossel é a
  // que o Labs tinha na hora de GERAR; salvar confere contra ela e não relê o Labs (achado 51,
  // decisão do Eduardo). Depois de gerar, o bônus pode ser despublicado ou trocar de palavra no
  // /admin do Labs, e é esta leitura, feita também logo depois de salvar, que avisa. Durante a
  // geração a tela pergunta ao servidor a cada 2 s, e cada pergunta leria a lista inteira do
  // Labs de novo, sem nada a mostrar ainda.
  const situacao = geracao === "gerando" ? null : await situacaoDoBonus(carrossel.bonus_id);
  const quadro = situacao ? quadroDaSituacao(situacao) : null;
  const trocada =
    situacao?.tipo === "publicado" && situacao.bonus.palavra !== carrossel.palavra ? situacao.bonus.palavra : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/bonus/${id}`} className={link}>
          Voltar para o bônus
        </Link>
        <h1 className={`mt-2 ${pageTitle}`}>{texto?.titulo ?? descricaoDoCarrossel(carrossel)}</h1>
        <p className={pageSubtitle}>
          {descricaoDoCarrossel(carrossel)} · palavra {carrossel.palavra}
        </p>
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
          <form action={gerarCarrosselDeNovo}>
            <input type="hidden" name="id" value={carrossel.id} />
            <button type="submit" className={btnPrimary}>
              Gerar de novo
            </button>
          </form>
          <p className={hint}>Conta como uma das gerações de carrossel do dia.</p>
        </section>
      )}

      {geracao === "pronto" && <Revisao carrossel={carrossel} aviso={aviso} agora={agora} />}
    </div>
  );
}

async function situacaoDoBonus(bonusId: string): Promise<SituacaoNoLabs> {
  const bonus = await lerLinha(bonusId);
  return bonus?.slug ? situacaoNoLabs(process.env.LABS_URL, bonus.slug) : { tipo: "nao_publicado" };
}

function Revisao({ carrossel, aviso, agora }: { carrossel: LinhaDoCarrossel; aviso: Aviso | null; agora: number }) {
  const texto = textoDaLinhaDoCarrossel(carrossel);
  if (!texto) return <div className={alertError}>{TEXTO_CARROSSEL_SEM_TEXTO}</div>;
  const valores = valoresPorCampo(texto);

  return (
    <>
      <form action={salvarRevisaoDoCarrossel} className={`${card} space-y-4 p-6`}>
        <input type="hidden" name="id" value={carrossel.id} />
        <p className={hint}>
          A chamada pede a palavra <strong>{carrossel.palavra}</strong>. Ela vem do bônus e não se edita aqui.
        </p>
        {camposDoFormulario(carrossel.total_slides).map((c) => (
          <Campo
            key={c.nome}
            nome={c.nome}
            rotulo={c.rotulo}
            valorInicial={valores[c.nome] ?? ""}
            max={c.max}
            linhas={c.linhas}
            palavra={c.pedePalavra ? carrossel.palavra : undefined}
            soAPalavra={c.soAPalavra}
          />
        ))}
        {aviso && <AvisoDoFormulario key={agora} aviso={aviso} />}
        <button type="submit" className={btnPrimary}>
          Salvar revisão
        </button>
      </form>
    </>
  );
}
