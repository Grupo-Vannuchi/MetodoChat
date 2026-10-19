import Link from "next/link";
import { badgeErr, badgeNeutral, badgeOk, badgeWarn, card, emptyWrap, muted, rowDivide, rowHover } from "@/app/ui";
import { ABAS, urlDaAba, type AbaDosCarrosseis, type ItemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
import type { TipoDoRotulo } from "@/lib/bonus/tela";

// A LISTA "CARROSSÉIS", O DESENHO (spec da Etapa 10, "A lista"): as três abas, com a contagem e a aberta
// marcada; a capa à esquerda de cada linha, ou o quadro vazio; e o selo da aba à direita. Sem estado e
// sem efeito: a página (de servidor) lê e decide, e este componente só desenha, com teste de tela.
//
// AS ABAS SÃO `<Link>`, como a barra do calendário do /publicar: a aba vive no endereço, então o voltar do
// navegador e um link levam à mesma aba.

const SELO: Record<TipoDoRotulo, string> = { neutro: badgeNeutral, ok: badgeOk, atencao: badgeWarn, erro: badgeErr };

/** Uma linha: o que ela diz, e a capa (null: o quadro vazio). */
export type LinhaDaLista = { item: ItemDaListaDeCarrosseis; capa: string | null };

export default function ListaDeCarrosseis({
  aba,
  contagem,
  linhas,
}: {
  aba: AbaDosCarrosseis;
  contagem: Record<AbaDosCarrosseis, number>;
  linhas: LinhaDaLista[];
}) {
  const vazia = ABAS.find((a) => a.aba === aba)?.vazia;
  return (
    <section className={card}>
      <nav aria-label="Abas dos carrosséis" className="border-b border-traco px-4 py-3 dark:border-traco-escuro">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-traco p-0.5 dark:border-traco-escuro">
          {ABAS.map((a) => (
            <Link
              key={a.aba}
              href={urlDaAba(a.aba)}
              aria-current={aba === a.aba ? "page" : undefined}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                aba === a.aba
                  ? "bg-acao text-papel dark:bg-acao-escuro dark:text-papel-escuro"
                  : "text-quieto hover:text-tinta dark:text-quieto-escuro dark:hover:text-tinta-escuro"
              }`}
            >
              {a.rotulo} ({contagem[a.aba]})
            </Link>
          ))}
        </div>
      </nav>

      {linhas.length === 0 ? (
        <div className={emptyWrap}>
          <p className={muted}>{vazia}</p>
        </div>
      ) : (
        <ul className={rowDivide}>
          {linhas.map(({ item, capa }) => (
            <li key={item.id}>
              <Link href={item.href} className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}>
                <span className="flex min-w-0 items-center gap-3">
                  {capa ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                       otimizador de imagem do Next buscaria a URL sem o cookie: a capa voltaria 401. */
                    <img
                      src={capa}
                      alt=""
                      width={48}
                      height={60}
                      loading="lazy"
                      className="aspect-[4/5] w-12 shrink-0 rounded-lg border border-traco object-cover dark:border-traco-escuro"
                    />
                  ) : (
                    <span
                      data-capa="vazia"
                      aria-hidden="true"
                      className="block aspect-[4/5] w-12 shrink-0 rounded-lg border border-dashed border-traco dark:border-traco-escuro"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.titulo}</span>
                    <span className={`block truncate text-xs ${muted}`}>
                      {item.origem} · {item.detalhe} · {item.criado}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {item.selos.map((s) => (
                    <span key={s.texto} className={SELO[s.tipo]}>
                      {s.texto}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
