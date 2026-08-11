"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PERIODS } from "@/lib/event-filters";
import {
  ORIGENS,
  SITUACOES,
  NO_ENVIO_FILTERS,
  hasEnvioFilters,
  toEnvioQueryString,
  juntarQuery,
  type EnvioFilters,
  type OrigemKey,
  type SituacaoKey,
} from "@/lib/envio-filters";
import { origemLabel, statusBadge } from "../labels";
import { subtle } from "../ui";

// Mesmo desenho da barra da lista de interações: os filtros chegam prontos do
// servidor, que já validou tudo. A barra não lê a URL — só escreve nela. Isso
// mantém uma única fonte da verdade e dispensa o Suspense que useSearchParams
// exigiria.
//
// `preservar` são os parâmetros da OUTRA seção da página, já montados no
// servidor. Sem eles, mexer num filtro daqui apagaria o recorte de lá, porque as
// duas seções dividem a mesma barra de endereço.

const controle =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:border-zinc-600";

const ativo = "border-indigo-500 text-zinc-900 dark:border-indigo-500 dark:text-zinc-100";

export default function FiltrosEnvios({
  filtros,
  preservar,
}: {
  filtros: EnvioFilters;
  preservar: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();

  function navigate(mudanca: Partial<EnvioFilters>) {
    const qs = juntarQuery(preservar, toEnvioQueryString({ ...filtros, ...mudanca }));
    // Sem rolar para o topo: esta seção JÁ está no topo, e forçar o scroll
    // arrancaria de lá quem estivesse conferindo a lista de baixo.
    iniciar(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div
      className={`mt-3 flex flex-wrap items-center gap-2 p-2 ${subtle} ${pendente ? "opacity-60" : ""}`}
      aria-busy={pendente}
    >
      {/* período */}
      <div className="inline-flex gap-0.5 rounded-xl border border-zinc-300 p-0.5 dark:border-zinc-700">
        {PERIODS.map((p) => {
          const marcado = filtros.period === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => navigate({ period: p.key })}
              aria-pressed={marcado}
              className={`rounded-[9px] px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
                marcado
                  ? "bg-indigo-500 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* origem: o robô × você */}
      <select
        value={filtros.origem ?? ""}
        onChange={(e) => navigate({ origem: (e.target.value || null) as OrigemKey | null })}
        aria-label="Quem enviou"
        className={`${controle} ${filtros.origem ? ativo : ""}`}
      >
        <option value="">Todas as origens</option>
        {ORIGENS.map((o) => (
          <option key={o} value={o}>
            {origemLabel(o)}
          </option>
        ))}
      </select>

      {/* situação: virou filtro porque como coluna dizia "Entregue" 28 vezes */}
      <select
        value={filtros.situacao ?? ""}
        onChange={(e) => navigate({ situacao: (e.target.value || null) as SituacaoKey | null })}
        aria-label="Situação do envio"
        className={`${controle} ${filtros.situacao ? ativo : ""}`}
      >
        <option value="">Todas as situações</option>
        {SITUACOES.map((s) => (
          <option key={s.key} value={s.key}>
            {statusBadge(s.key).label}
          </option>
        ))}
      </select>

      {hasEnvioFilters(filtros) && (
        <button
          type="button"
          onClick={() => navigate(NO_ENVIO_FILTERS)}
          className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
