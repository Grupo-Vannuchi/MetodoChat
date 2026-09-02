"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { oQueDispara } from "../labels";
import { toggleAutomation, deleteAutomation, duplicateAutomation } from "./actions";
import {
  card,
  cardHover,
  muted,
  badgeOk,
  badgeNeutral,
  input,
  btnPrimary,
  emptyWrap,
} from "../ui";
import { IconZap, IconComment, IconStory, IconSend, IconPorta } from "../icons";

export type AutomationRow = {
  id: string;
  name: string;
  active: boolean;
  triggers: string[];
  keywords: string[];
  match_type: string;
  created_at: string;
  thumb: string | null;
};

const TRIGGER_META: Record<
  string,
  { label: string; icon: (p: { className?: string }) => React.ReactNode }
> = {
  comment: { label: "Comentário", icon: IconComment },
  story: { label: "Story", icon: IconStory },
  dm: { label: "DM", icon: IconSend },
  // SEM ESTA LINHA A AUTOMAÇÃO DE ABERTURA APARECIA SEM CANAL NENHUM: o `if
  // (!meta) return null` lá embaixo apaga o gatilho que a tabela não conhece, e
  // a linha ficaria com o ponto separador e mais nada onde os outros três dizem
  // por onde a automação dispara.
  abertura: { label: "Abertura", icon: IconPorta },
};

type Filtro = "todas" | "ativas" | "pausadas";

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AutomationsList({ automations }: { automations: AutomationRow[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pendente, startTransition] = useTransition();
  // qual linha está em ação, para o retorno visual ficar na linha certa
  const [agindo, setAgindo] = useState<string | null>(null);
  // A RECUSA DE UMA AÇÃO DE LINHA — ativar, excluir ou duplicar —, por LINHA.
  // As três ações do arquivo `./actions` (`toggleAutomation`, `deleteAutomation`,
  // `duplicateAutomation`) podem recusar, e uma recusa sem lugar na tela é o
  // botão não fazendo nada — o modo de falhar que esta correção existe para
  // tirar. `acao` decide o texto e se o link para o editor aparece: abrir o
  // editor só faz sentido quando o motivo é um desenho que se conserta lá
  // (o caso de `ativar`); "Nenhuma conta conectada" ou "Automação não
  // encontrada" — os motivos de excluir e duplicar — não se resolvem nele.
  // Uma só de cada vez: a ação é um clique, e a seguinte apaga a anterior.
  const [recusa, setRecusa] = useState<{
    id: string;
    acao: "ativar" | "excluir" | "duplicar";
    mensagem: string;
  } | null>(null);

  const contagem = useMemo(
    () => ({
      todas: automations.length,
      ativas: automations.filter((a) => a.active).length,
      pausadas: automations.filter((a) => !a.active).length,
    }),
    [automations]
  );

  // Filtragem no cliente: a lista é pequena e assim o resultado é instantâneo,
  // sem ida ao servidor a cada tecla.
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return automations.filter((a) => {
      if (filtro === "ativas" && !a.active) return false;
      if (filtro === "pausadas" && a.active) return false;
      if (!termo) return true;
      return (
        a.name.toLowerCase().includes(termo) ||
        a.keywords.some((k) => k.toLowerCase().includes(termo))
      );
    });
  }, [automations, busca, filtro]);

  // `deleteAutomation` e `duplicateAutomation` (./actions) agora devolvem
  // `Resultado`, o mesmo tipo de `toggleAutomation` — e a recusa das duas
  // aparece na MESMA faixa vermelha por linha que `alternar`, abaixo, já
  // desenha. `acao` viaja junto para a faixa saber que frase e que link
  // mostrar (ver o comentário do `useState` de `recusa`, acima).
  function executar(
    id: string,
    acao: "excluir" | "duplicar",
    fn: () => Promise<{ ok: boolean; erro?: string }>
  ) {
    setAgindo(id);
    setRecusa(null);
    startTransition(async () => {
      const r = await fn();
      setAgindo(null);
      if (!r.ok) setRecusa({ id, acao, mensagem: r.erro ?? "Não deu certo." });
    });
  }

  // Ligar e desligar têm caminho próprio porque só este devolve recusa: ativar
  // uma automação que não entrega nada é o que `toggleAutomation` barra, e o
  // motivo vem do servidor na língua do dono (é a mesma frase de `conferirLista`
  // que o editor mostra no bloco culpado).
  function alternar(id: string, ativa: boolean) {
    setAgindo(id);
    setRecusa(null);
    startTransition(async () => {
      const r = await toggleAutomation(id, !ativa);
      setAgindo(null);
      if (!r.ok) setRecusa({ id, acao: "ativar", mensagem: r.erro });
    });
  }

  const FILTROS: { id: Filtro; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "ativas", label: "Ativas" },
    { id: "pausadas", label: "Pausadas" },
  ];

  return (
    <div className="space-y-4">
      {/* Barra de busca + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou palavra-chave…"
            className={`${input} pl-9`}
            aria-label="Buscar automações"
          />
        </div>
        <div
          role="tablist"
          aria-label="Filtrar por status"
          className="inline-flex shrink-0 rounded-xl border border-zinc-200 bg-zinc-100/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          {FILTROS.map((f) => {
            const ativo = filtro === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={ativo}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  ativo
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-[11px] text-zinc-400">{contagem[f.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resultado vazio da busca é diferente de "não tem automação": o texto
          precisa dizer o que fazer em cada caso. */}
      {visiveis.length === 0 ? (
        <div className={emptyWrap}>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nenhuma automação encontrada
          </p>
          <p className={`max-w-sm text-xs ${muted}`}>
            Nenhum resultado para os filtros atuais. Tente outro termo ou volte para “Todas”.
          </p>
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setFiltro("todas");
            }}
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visiveis.map((a) => {
            const ocupado = pendente && agindo === a.id;
            return (
              <li
                key={a.id}
                className={`${card} ${cardHover} group p-4 transition-opacity ${
                  ocupado ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {/* miniatura ou ícone */}
                  {a.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumb}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                      <IconZap className="h-5 w-5" />
                    </span>
                  )}

                  {/* identificação */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/automacoes/${a.id}`}
                        className="truncate text-[15px] font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                      >
                        {a.name}
                      </Link>
                      <span className={a.active ? badgeOk : badgeNeutral}>
                        <span
                          className={`mr-0.5 inline-block h-1.5 w-1.5 rounded-full ${
                            a.active ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                        />
                        {a.active ? "Ativa" : "Pausada"}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {/* canais (plataforma) */}
                      <span className="flex items-center gap-1.5">
                        {a.triggers.map((t) => {
                          const meta = TRIGGER_META[t];
                          if (!meta) return null;
                          const Icon = meta.icon;
                          return (
                            <span
                              key={t}
                              title={meta.label}
                              className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400"
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {meta.label}
                            </span>
                          );
                        })}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      {/* O QUE DISPARA — a frase inteira é `oQueDispara`
                          (`../labels`), e não esta linha. Ela decidia aqui, e
                          a revisão mediu o que isso valia: revertendo as duas
                          metades para o `some` que ESCOLHIA entre elas, a
                          suíte ficava com 722 verdes. O porquê de cada metade
                          está escrito junto da função, com teste. */}
                      <span className={`truncate ${muted}`}>{oQueDispara(a)}</span>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {formatarData(a.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* ações */}
                  <div className="flex shrink-0 items-center gap-1 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => alternar(a.id, a.active)}
                      title={a.active ? "Pausar automação" : "Ativar automação"}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {a.active ? "Pausar" : "Ativar"}
                    </button>
                    <Link
                      href={`/automacoes/${a.id}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => executar(a.id, "duplicar", () => duplicateAutomation(a.id))}
                      title="Criar uma cópia (nasce pausada)"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => {
                        // exclusão é irreversível: confirma antes
                        if (confirm(`Excluir “${a.name}”? Esta ação não pode ser desfeita.`)) {
                          executar(a.id, "excluir", () => deleteAutomation(a.id));
                        }
                      }}
                      title="Excluir automação"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {/* A RECUSA DA AÇÃO — ativar, excluir ou duplicar —, na própria
                    linha e com o motivo. O botão fica onde estava, porque
                    tentar de novo é o gesto natural. O link para o editor só
                    aparece para a recusa de ATIVAR: é a única cujo motivo se
                    conserta lá dentro (um bloco sem destino, um botão sem
                    texto); "Nenhuma conta conectada" ou "Automação não
                    encontrada" não têm o que fazer no quadro. */}
                {recusa?.id === a.id && (
                  <p className="mt-3 rounded-lg border-l-4 border-red-500 bg-red-50 p-2 text-xs leading-relaxed text-red-900 dark:bg-red-950/40 dark:text-red-100">
                    Não deu para{" "}
                    {recusa.acao === "ativar"
                      ? "ativar"
                      : recusa.acao === "excluir"
                        ? "excluir"
                        : "duplicar"}
                    : {recusa.mensagem}{" "}
                    {recusa.acao === "ativar" && (
                      <Link href={`/automacoes/${a.id}`} className="font-semibold underline">
                        Abrir o editor
                      </Link>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ListaVazia() {
  return (
    <div className={emptyWrap}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
        <IconZap className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Nenhuma automação ainda
        </p>
        <p className={`mx-auto mt-1 max-w-sm text-xs ${muted}`}>
          Escolha uma palavra-chave e o link que a pessoa recebe na DM. Em poucos minutos seu
          Instagram começa a responder sozinho.
        </p>
      </div>
      <Link href="/automacoes/nova" className={btnPrimary}>
        Criar primeira automação
      </Link>
    </div>
  );
}
