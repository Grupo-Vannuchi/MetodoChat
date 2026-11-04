import { FRASE_DO_MOTIVO, motivoDoErro, PECA_UM_NOVO_LINK } from "@/lib/convites";
import CartaoDoConvite from "../cartao";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu errado (docs/specs/2026-11-03-link-de-convite.md). É
// aberta, e o motivo vem de uma lista fechada: o que veio na URL nunca aparece, e o texto da Meta fica no
// `ultimo_erro` do convite, para o painel. Mora no mesmo cartão das outras páginas do convite.
export const metadata = { title: "Não deu certo", robots: { index: false, follow: false } };

export default async function ConviteErro({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string | string[] }>;
}) {
  const { motivo } = await searchParams;
  const qual = motivoDoErro(motivo);
  return (
    <CartaoDoConvite>
      <p>
        {FRASE_DO_MOTIVO[qual]} {PECA_UM_NOVO_LINK}
      </p>
    </CartaoDoConvite>
  );
}
