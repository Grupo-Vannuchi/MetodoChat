import { FRASE_DO_PRONTO } from "@/lib/convites";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu certo (docs/specs/2026-11-03-link-de-convite.md). É
// aberta e fixa: o cliente não entra no painel.
export const metadata = { title: "Conta conectada", robots: { index: false, follow: false } };

export default async function ConvitePronto() {
  return (
    <article className="mx-auto max-w-xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conectar seu Instagram</h1>
      <p>{FRASE_DO_PRONTO}</p>
    </article>
  );
}
