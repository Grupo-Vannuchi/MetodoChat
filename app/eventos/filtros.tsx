"use client";

import { useState } from "react";
import {
  SEARCH_MAX_LENGTH,
  PERIODS,
  NO_FILTERS,
  EVENT_TYPES,
  hasFilters,
  type EventFilters,
  type EventTypeKey,
} from "@/lib/event-filters";
import { useFiltros } from "./filtros-dono";
import { eventBadge } from "../labels";
import { subtle } from "../ui";

export type OpcaoPost = { id: string; total: number; thumb: string | null; caption: string | null };

// Só apresentação: mostra os valores que o dono da URL segura e devolve as
// mudanças para ele. Esta barra não lê a URL nem escreve nela, e por isso não
// precisa carregar nada da outra seção.
//
// Ela também não se apaga durante a navegação: com estado otimista, o botão já
// mostra o valor novo no clique, e quem espera é a lista.

const controle =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:border-zinc-600";

const ativo = "border-indigo-500 text-zinc-900 dark:border-indigo-500 dark:text-zinc-100";

export default function Filtros({ posts }: { posts: OpcaoPost[] }) {
  const { filtros: daPagina, atualizar } = useFiltros();
  const filtros = daPagina.eventos;
  const [abrirPosts, setAbrirPosts] = useState(false);
  const [busca, setBusca] = useState(filtros.q ?? "");

  // A caixa de busca é digitada, então guarda o próprio rascunho. Quando o termo
  // muda por fora dela — "Limpar filtros" daqui ou do estado vazio, ou o botão
  // voltar do navegador — o rascunho acompanha, senão a caixa continuaria
  // mostrando uma palavra que não está mais filtrando nada.
  const [ultimoQ, setUltimoQ] = useState(filtros.q);
  if (filtros.q !== ultimoQ) {
    setUltimoQ(filtros.q);
    setBusca(filtros.q ?? "");
  }

  function mudar(mudanca: Partial<EventFilters>) {
    setAbrirPosts(false);
    atualizar({ secao: "eventos", mudanca });
  }

  // O post filtrado pode estar fora da lista oferecida (é a dos mais recentes).
  // Nesse caso o botão continua marcado — só não tem capa para mostrar.
  const escolhido = filtros.post ? posts.find((p) => p.id === filtros.post) : undefined;
  const rotuloPost = filtros.post
    ? escolhido?.caption?.replace(/\s+/g, " ").trim() || "Post selecionado"
    : "Todos os posts";

  return (
    <div className={`mt-4 flex flex-wrap items-center gap-2 p-2.5 ${subtle}`}>
      {/* período */}
      <div className="inline-flex gap-0.5 rounded-xl border border-zinc-300 p-0.5 dark:border-zinc-700">
        {PERIODS.map((p) => {
          const marcado = filtros.period === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => mudar({ period: p.key })}
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

      {/* post */}
      {posts.length > 0 && (
        <div className="inline-flex items-center">
          <button
            type="button"
            onClick={() => setAbrirPosts((v) => !v)}
            aria-expanded={abrirPosts}
            className={`${controle} ${filtros.post ? ativo : ""}`}
          >
            {escolhido?.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={escolhido.thumb} alt="" className="h-4 w-4 flex-none rounded object-cover" />
            )}
            <span className="max-w-[10rem] truncate">{rotuloPost}</span>
            <span aria-hidden="true" className="text-[10px] text-zinc-500">
              {abrirPosts ? "▴" : "▾"}
            </span>
          </button>
          {filtros.post && (
            <button
              type="button"
              onClick={() => mudar({ post: null })}
              aria-label="Remover filtro de post"
              className="ml-1 rounded-lg px-1.5 py-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* tipo */}
      <select
        value={filtros.type ?? ""}
        onChange={(e) => mudar({ type: (e.target.value || null) as EventTypeKey | null })}
        aria-label="Tipo de interação"
        className={`${controle} ${filtros.type ? ativo : ""}`}
      >
        <option value="">Todos os tipos</option>
        {EVENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {eventBadge(t).label}
          </option>
        ))}
      </select>

      {/* busca */}
      <form
        className="flex min-w-[11rem] flex-1 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          mudar({ q: busca.trim() || null });
        }}
      >
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Buscar palavra ou @perfil…"
          aria-label="Buscar por palavra ou perfil"
          className={`w-full ${controle} ${filtros.q ? ativo : ""} placeholder:text-zinc-400 dark:placeholder:text-zinc-600`}
        />
      </form>

      {hasFilters(filtros) && (
        <button
          type="button"
          onClick={() => mudar(NO_FILTERS)}
          className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Limpar filtros
        </button>
      )}

      {/* grade de posts */}
      {abrirPosts && (
        <div className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-950/60">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-zinc-500">
            Posts com interação
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {posts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => mudar({ post: p.id })}
                title={p.caption ?? p.id}
                className="flex flex-col gap-1 focus-visible:outline-none"
              >
                <span
                  className={`block aspect-square overflow-hidden rounded-lg border ${
                    filtros.post === p.id
                      ? "border-indigo-500 ring-2 ring-indigo-500/30"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {p.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      ?
                    </span>
                  )}
                </span>
                <span className="text-center text-[9px] tabular-nums text-zinc-500">{p.total}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
