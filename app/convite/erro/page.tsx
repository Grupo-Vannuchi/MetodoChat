import { fraseDoMotivo, motivoDoErro, PECA_UM_NOVO_LINK, redeDoParametro } from "@/lib/convites";
import CartaoDoConvite from "../cartao";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu errado (docs/specs/2026-11-03-link-de-convite.md). É
// aberta, e o motivo vem de uma lista fechada: o que veio na URL nunca aparece, e o texto da Meta fica no
// `ultimo_erro` do convite, para o painel. Mora no mesmo cartão das outras páginas do convite.
//
// A REDE VEM DA URL (`?rede=linkedin`, docs/specs/2026-11-06-linkedin-no-perfil.md, §3), de uma lista fechada,
// como o motivo.
export const metadata = { title: "Não deu certo", robots: { index: false, follow: false } };

export default async function ConviteErro({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string | string[]; rede?: string | string[] }>;
}) {
  const { motivo, rede: redeDaUrl } = await searchParams;
  const qual = motivoDoErro(motivo);
  const rede = redeDoParametro(redeDaUrl);
  return (
    <CartaoDoConvite rede={rede}>
      <p>
        {fraseDoMotivo(qual, rede)} {PECA_UM_NOVO_LINK}
      </p>
    </CartaoDoConvite>
  );
}
