import { FRASE_DO_PRONTO } from "@/lib/convites";
import CartaoDoConvite from "../cartao";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu certo (docs/specs/2026-11-03-link-de-convite.md). É
// aberta e fixa: o cliente não entra no painel. Mora no mesmo cartão das outras páginas do convite.
export const metadata = { title: "Conta conectada", robots: { index: false, follow: false } };

export default async function ConvitePronto() {
  return (
    <CartaoDoConvite>
      <p>{FRASE_DO_PRONTO}</p>
    </CartaoDoConvite>
  );
}
