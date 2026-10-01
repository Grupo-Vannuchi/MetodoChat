import Link from "next/link";
import CopyField from "@/app/setup/copy-field";
import {
  alertError,
  alertOk,
  alertWarn,
  badgeErr,
  badgeNeutral,
  badgeOk,
  badgeWarn,
  card,
  muted,
  rowDivide,
  rowHover,
} from "@/app/ui";
import { pedirCarrossel } from "@/app/bonus/carrossel-actions";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { restamCarrosseisHoje } from "@/lib/bonus/carrossel-pedido";
import { carrosseisNasUltimas24h, listarCarrosseisDoBonus } from "@/lib/bonus/carrossel-repositorio";
import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { TEXTO_TABELA_CARROSSEL_AUSENTE, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import type { LinhaDoBonus } from "@/lib/bonus/linha";
import { situacaoNoLabs, type SituacaoNoLabs } from "@/lib/bonus/publicado";
import type { TipoDoRotulo } from "@/lib/bonus/tela";
import type { TomDoQuadro } from "@/lib/bonus/textos";
import { fmtDate } from "@/lib/format";
import PedidoDeCarrossel from "./pedido-de-carrossel";

// O BÔNUS DEPOIS DE CRIADO NO LABS: a situação lida de lá, o link e os carrosséis.
//
// A SITUAÇÃO É LIDA A CADA VEZ (lib/bonus/publicado.ts), e nunca afirmada de memória: o bônus
// nasce oculto, e o operador o publica no /admin do Labs (achado 43 do auditor). Só "publicado"
// libera o pedido de carrossel; a action confere de novo no servidor.

const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };
const SELO: Record<TipoDoRotulo, string> = { neutro: badgeNeutral, ok: badgeOk, atencao: badgeWarn, erro: badgeErr };

export default async function NoLabs({
  linha,
  publico,
  agora,
}: {
  linha: LinhaDoBonus;
  publico: string | null;
  agora: number;
}) {
  const situacao: SituacaoNoLabs = linha.slug
    ? await situacaoNoLabs(process.env.LABS_URL, linha.slug)
    : { tipo: "nao_publicado" };
  const quadro = quadroDaSituacao(situacao);
  const publicado = situacao.tipo === "publicado";

  let carrosseis: LinhaDoCarrossel[];
  let usadas: number;
  try {
    [carrosseis, usadas] = await Promise.all([listarCarrosseisDoBonus(linha.id), carrosseisNasUltimas24h()]);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  const restam = restamCarrosseisHoje(usadas);

  return (
    <>
      <div className={QUADRO[quadro.tom]}>{quadro.texto}</div>

      {publico ? (
        <section className={`${card} p-6`}>
          <CopyField
            label={publicado ? "O link do bônus" : "O link, que só funciona depois de publicado"}
            value={publico}
          />
        </section>
      ) : (
        <p className={`text-sm ${muted}`}>Endereço no Labs: /bonus/{linha.slug}</p>
      )}

      <section className={card}>
        <h2 className="border-b border-traco px-4 py-3 text-sm font-semibold dark:border-traco-escuro">
          Carrosséis deste bônus
        </h2>
        {carrosseis.length === 0 ? (
          <p className={`px-4 py-3 text-sm ${muted}`}>Nenhum carrossel ainda.</p>
        ) : (
          <ul className={rowDivide}>
            {carrosseis.map((c) => {
              const rotulo = rotuloDoCarrossel(c, agora);
              return (
                <li key={c.id}>
                  <Link
                    href={`/bonus/${linha.id}/carrossel/${c.id}`}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {textoDaLinhaDoCarrossel(c)?.titulo ?? descricaoDoCarrossel(c)}
                      </span>
                      <span className={`block text-xs ${muted}`}>
                        {descricaoDoCarrossel(c)} · {fmtDate(c.criado_em)}
                      </span>
                    </span>
                    <span className={SELO[rotulo.tipo]}>{rotulo.texto}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <PedidoDeCarrossel acao={pedirCarrossel} bonusId={linha.id} publicado={publicado} restam={restam} />
      </section>
    </>
  );
}
