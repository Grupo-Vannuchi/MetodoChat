import Link from "next/link";
import { avisoDaUrl } from "@/lib/avisos";
import { fmtDate } from "@/lib/format";
import {
  alertError,
  alertOk,
  badgeErr,
  badgeNeutral,
  badgeOk,
  badgeWarn,
  card,
  emptyWrap,
  hint,
  muted,
  pageSubtitle,
  pageTitle,
  rowDivide,
  rowHover,
} from "@/app/ui";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import type { LinhaDoBonus } from "@/lib/bonus/linha";
import { TETO_DIARIO, restamHoje } from "@/lib/bonus/pedido";
import { listarRecentes, usadasNasUltimas24h } from "@/lib/bonus/repositorio";
import { rotuloDaLinha, tituloDaLinha, type TipoDoRotulo } from "@/lib/bonus/tela";
import { temasSugeridos } from "@/lib/bonus/temas";
import { TEXTO_TABELA_AUSENTE } from "@/lib/bonus/textos";
import { pedirBonus } from "./actions";
import FormularioDoPedido from "./formulario-do-pedido";

// O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
// tests/bonus-paginas.test.ts confere que é o mesmo número.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SELO: Record<TipoDoRotulo, string> = {
  neutro: badgeNeutral,
  ok: badgeOk,
  atencao: badgeWarn,
  erro: badgeErr,
};

export default async function Bonus({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const params = await searchParams;
  const aviso = avisoDaUrl(params.aviso, params.tom);

  let linhas: LinhaDoBonus[];
  let usadas: number;
  try {
    [linhas, usadas] = await Promise.all([listarRecentes(20), usadasNasUltimas24h()]);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return (
      <div className="space-y-6">
        <h1 className={pageTitle}>Bônus</h1>
        <div className={alertError}>{TEXTO_TABELA_AUSENTE}</div>
      </div>
    );
  }
  const temas = await temasSugeridos(process.env.LABS_URL);
  const restam = restamHoje(usadas);
  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitle}>Bônus</h1>
        <p className={pageSubtitle}>A IA escreve o bônus, você revisa e ele vai oculto para o Método Labs.</p>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      <section className={`${card} p-6`}>
        <h2 className="text-base font-semibold">Gerar um bônus</h2>
        <p className={hint}>
          Restam {restam} de {TETO_DIARIO} gerações nas últimas 24 horas.
        </p>
        <FormularioDoPedido acao={pedirBonus} temas={temas} restam={restam} />
      </section>

      <section className={card}>
        <h2 className="border-b border-traco px-4 py-3 text-sm font-semibold dark:border-traco-escuro">
          Últimas gerações
        </h2>
        {linhas.length === 0 ? (
          <div className={emptyWrap}>
            <p className={muted}>Nenhum bônus gerado ainda.</p>
          </div>
        ) : (
          <ul className={rowDivide}>
            {linhas.map((l) => {
              const rotulo = rotuloDaLinha(l, agora);
              return (
                <li key={l.id}>
                  <Link
                    href={`/bonus/${l.id}`}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{tituloDaLinha(l)}</span>
                      <span className={`block text-xs ${muted}`}>{fmtDate(l.criado_em)}</span>
                    </span>
                    <span className={SELO[rotulo.tipo]}>{rotulo.texto}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
