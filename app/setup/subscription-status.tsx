import { listAccounts } from "@/lib/db";
import { getSubscribedFields, CAMPOS_DE_WEBHOOK } from "@/lib/ig";
import { reassinarWebhooks } from "./actions";
import SubmitButton from "./submit-button";
import { btnPrimary, muted } from "../ui";

// Consulta na Meta o que cada conta está assinando. São chamadas HTTP externas
// (uma por conta): renderizadas direto na página, elas seguravam TODO o /setup
// até a Meta responder. Por isso este componente é isolado e carregado dentro
// de um <Suspense> — a página aparece na hora e o diagnóstico preenche depois.
export default async function SubscriptionStatus() {
  const accounts = await listAccounts();
  if (!accounts.length) return null;

  const assinaturas = await Promise.all(
    accounts.map(async (a) => ({
      ig_user_id: a.ig_user_id,
      username: a.username,
      fields: await getSubscribedFields(a.ig_user_id, a.access_token),
    }))
  );
  // A CONFERÊNCIA LÊ A MESMA LISTA QUE A INSCRIÇÃO ESCREVE (`CAMPOS_DE_WEBHOOK`,
  // lib/ig.ts). Antes ela citava "comments" e "messages" à mão: acrescentar um
  // campo à inscrição deixava esta tela dizendo "recebendo eventos ✓" para uma
  // conta que assinava só metade — a tela viraria a prova de que está tudo bem
  // justamente quando não está.
  const esperados = CAMPOS_DE_WEBHOOK.split(",");
  const faltando = (f: string[] | null) => (f ? esperados.filter((c) => !f.includes(c)) : esperados);

  return (
    <>
      <ul className="space-y-2">
        {assinaturas.map((s) => {
          const ausentes = faltando(s.fields);
          const ok = s.fields !== null && ausentes.length === 0;
          return (
            <li
              key={s.ig_user_id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <span className="font-medium">@{s.username ?? s.ig_user_id}</span>
              {s.fields === null ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                  não deu para consultar
                </span>
              ) : ok ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                  recebendo eventos ✓
                </span>
              ) : (
                // DIZ O QUE FALTA, e não só que falta: sem os nomes, o dono lê
                // "assinatura incompleta" e o único caminho é adivinhar. Com
                // eles, ele sabe se apertar "Reassinar webhooks" resolve.
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-950 dark:text-red-400">
                  falta assinar: {ausentes.join(", ")}
                </span>
              )}
              {s.fields && s.fields.length > 0 && (
                <span className={`text-xs ${muted}`}>({s.fields.join(", ")})</span>
              )}
            </li>
          );
        })}
      </ul>
      <form action={reassinarWebhooks} className="mt-3">
        <SubmitButton
          className={btnPrimary}
          etapas={["Falando com a Meta…", "Reassinando cada conta…"]}
        >
          Reassinar webhooks
        </SubmitButton>
      </form>
    </>
  );
}

export function SubscriptionStatusSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-10 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
      <div className="h-9 w-40 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
    </div>
  );
}
