"use client";
import { useActionState } from "react";
import CopyField from "./copy-field";
import { cancelarConvite, gerarConvite } from "./actions";
import type { EstadoDoGerar, LinhaDoConvite } from "@/lib/convites";
import { alertError, btnPrimary, btnSecondary, input, label, muted } from "../ui";

// O LINK DE CONVITE NA ETAPA 6 (docs/specs/2026-11-03-link-de-convite.md): o cliente abre o link no
// computador e conecta a própria conta, sem a senha do painel. O link aparece UMA VEZ, no estado da ação,
// porque o banco guarda só o hash do código.
const ROTULO: Record<LinhaDoConvite["estado"], string> = {
  pendente: "pendente",
  usado: "usado",
  vencido: "vencido",
  cancelado: "cancelado",
};

export default function Convites({ linhas, metaOk }: { linhas: LinhaDoConvite[]; metaOk: boolean }) {
  const [estado, gerar, gerando] = useActionState<EstadoDoGerar, FormData>(gerarConvite, null);

  return (
    <div className="space-y-3 border-t border-traco pt-3 dark:border-traco-escuro">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">Ou mande um link de convite ao cliente</p>
      <p className={`text-xs ${muted}`}>
        O cliente abre o link no computador e conecta a própria conta, sem a senha do painel e sem passar a
        senha do Instagram a ninguém. O link vale 7 dias e serve para uma conexão. A conta dele precisa estar
        como <b>Testador do Instagram</b> no seu app da Meta (etapa 5) antes.
      </p>
      <form action={gerar} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="convite-para-quem" className={label}>
            Para quem
          </label>
          <input
            id="convite-para-quem"
            name="para_quem"
            maxLength={60}
            placeholder="Ex.: Dr. Marcus"
            className={input}
          />
        </div>
        <button type="submit" disabled={!metaOk || gerando} className={btnPrimary}>
          Gerar link de convite
        </button>
      </form>
      {estado && "erro" in estado && (
        <p role="alert" className={alertError}>
          {estado.erro}
        </p>
      )}
      {estado && "link" in estado && (
        <div className="space-y-1">
          <CopyField label={`Link de convite para ${estado.paraQuem}`} value={estado.link} />
          <p className={`text-xs ${muted}`}>Este link aparece só agora. Se ele se perder, cancele e gere outro.</p>
        </div>
      )}
      {linhas.length > 0 && (
        <ul className="space-y-2">
          {linhas.map((l) => (
            <li
              key={l.id}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0">
                  <b>{l.paraQuem}</b> · {ROTULO[l.estado]} · {l.detalhe}
                </p>
                {l.cancelavel && (
                  <form action={cancelarConvite}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className={btnSecondary}>
                      Cancelar
                    </button>
                  </form>
                )}
              </div>
              {l.aviso && <p className={`mt-1 text-xs ${muted}`}>{l.aviso}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
