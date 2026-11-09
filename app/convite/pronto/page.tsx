import { FRASE_DO_PRONTO_DA_REDE, redeDoParametro } from "@/lib/convites";
import CartaoDoConvite from "../cartao";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu certo (docs/specs/2026-11-03-link-de-convite.md). É
// aberta e fixa: o cliente não entra no painel. Mora no mesmo cartão das outras páginas do convite.
//
// A REDE VEM DA URL (`?rede=linkedin`, a volta do LinkedIn, docs/specs/2026-11-06-linkedin-no-perfil.md, §3),
// de uma lista fechada: fora dela, é o Instagram de sempre.
export const metadata = { title: "Conta conectada", robots: { index: false, follow: false } };

export default async function ConvitePronto({
  searchParams,
}: {
  searchParams?: Promise<{ rede?: string | string[] }>;
} = {}) {
  const rede = redeDoParametro((await searchParams)?.rede);
  return (
    <CartaoDoConvite rede={rede}>
      <p>{FRASE_DO_PRONTO_DA_REDE[rede]}</p>
    </CartaoDoConvite>
  );
}
