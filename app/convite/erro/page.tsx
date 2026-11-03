import { FRASE_DO_MOTIVO, motivoDoErro, PECA_UM_NOVO_LINK } from "@/lib/convites";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu errado (docs/specs/2026-11-03-link-de-convite.md). É
// aberta, e o motivo vem de uma lista fechada: o que veio na URL nunca aparece, e o texto da Meta fica no
// `ultimo_erro` do convite, para o painel.
export const metadata = { title: "Não deu certo", robots: { index: false, follow: false } };

export default async function ConviteErro({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string | string[] }>;
}) {
  const { motivo } = await searchParams;
  const qual = motivoDoErro(motivo);
  return (
    <article className="mx-auto max-w-xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conectar seu Instagram</h1>
      <p>
        {FRASE_DO_MOTIVO[qual]} {PECA_UM_NOVO_LINK}
      </p>
    </article>
  );
}
