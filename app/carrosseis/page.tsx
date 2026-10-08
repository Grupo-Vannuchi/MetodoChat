import Link from "next/link";
import {
  alertError,
  alertOk,
  badgeErr,
  badgeNeutral,
  badgeOk,
  badgeWarn,
  btnPrimary,
  card,
  emptyWrap,
  muted,
  pageSubtitle,
  pageTitle,
  rowDivide,
  rowHover,
} from "@/app/ui";
import { avisoDaUrl } from "@/lib/avisos";
import { itemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { listarCarrosseis } from "@/lib/bonus/carrossel-repositorio";
import { TEXTO_TABELA_CARROSSEL_AUSENTE } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { publicacaoDaArte } from "@/lib/bonus/publicar-regras";
import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
import type { TipoDoRotulo } from "@/lib/bonus/tela";
import { fmtDate } from "@/lib/format";

// O MENU "CARROSSÉIS" (spec da Etapa 7): todos os carrosséis, os dos bônus e os avulsos, do mais novo
// para o mais velho, e o botão "Novo carrossel". Cada linha leva à página do carrossel (a de bônus, ou
// a do avulso), e o que ela mostra é decidido fora do JSX (carrosseis-tela.ts).
//
// O ESTADO DA PUBLICAÇÃO é lido da fila só para o carrossel que tem publicação guardada: os outros
// não pagam a consulta.

export const dynamic = "force-dynamic";

const SELO: Record<TipoDoRotulo, string> = { neutro: badgeNeutral, ok: badgeOk, atencao: badgeWarn, erro: badgeErr };

export default async function Carrosseis({ searchParams }: { searchParams: Promise<{ aviso?: string; tom?: string }> }) {
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);

  let linhas: LinhaDoCarrossel[];
  try {
    linhas = await listarCarrosseis();
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return (
      <div className="space-y-6">
        <h1 className={pageTitle}>Carrosséis</h1>
        <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>
      </div>
    );
  }
  const estados = await Promise.all(linhas.map((l) => (publicacaoDaArte(l.arte) === null ? null : estadoDoCarrossel(l.arte))));
  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Carrosséis</h1>
          <p className={pageSubtitle}>Os carrosséis dos bônus e os avulsos, de um bônus do Labs ou de um texto livre.</p>
        </div>
        <Link href="/carrosseis/novo" className={btnPrimary}>
          Novo carrossel
        </Link>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      <section className={card}>
        {linhas.length === 0 ? (
          <div className={emptyWrap}>
            <p className={muted}>Nenhum carrossel ainda.</p>
          </div>
        ) : (
          <ul className={rowDivide}>
            {linhas.map((l, i) => {
              const item = itemDaListaDeCarrosseis(l, estados[i], agora);
              return (
                <li key={item.id}>
                  <Link href={item.href} className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.titulo}</span>
                      <span className={`block truncate text-xs ${muted}`}>
                        {item.origem} · {item.detalhe} · {fmtDate(l.criado_em)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {item.publicacao && <span className={SELO[item.publicacao.tipo]}>{item.publicacao.texto}</span>}
                      <span className={SELO[item.geracao.tipo]}>{item.geracao.texto}</span>
                    </span>
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
