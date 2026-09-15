import Link from "next/link";
import FormNovaAutomacao from "./form-nova";
import { pageTitle, pageSubtitle, link } from "../../ui";

export const dynamic = "force-dynamic";

// ESTA PÁGINA NÃO MONTA O QUADRO, e a decisão está escrita em `./form-nova`:
// `salvarAutomacao` precisa de um id, e automação nova não tem. Aqui se cria a
// automação com o mínimo; o quadro abre em `/automacoes/<id>`, para onde
// `criarAutomacao` (app/automacoes/actions.ts) redireciona.
//
// A CONTA CONECTADA NÃO É MAIS LIDA AQUI. Ela existia para abastecer o cabeçalho
// da pré-visualização em celular do formulário antigo (`phone-preview.tsx`), que
// saiu junto com ele. A prévia nova (`editor/previa.tsx`) desenha a moldura sem
// a conta, e quem recusa a criação sem conta conectada é o próprio
// `criarAutomacao`, no servidor — que é onde a recusa vale.
export default async function NovaAutomacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <header>
        {/* "← Automações", E NÃO UMA TRILHA — o achado D10.

            Esta tela era a ÚNICA do painel com trilha de navegação
            ("Automações / Nova"), e as outras quatro telas aninhadas usam link
            de volta: `/automacoes/[id]` já dizia "← Automações", e
            `/publicar/novo` e `/publicar/post/[id]` dizem "← Publicações".

            O LINK DE VOLTA VENCE A TRILHA AQUI porque o painel tem DOIS níveis,
            nunca três. Uma trilha de dois itens gasta o segundo repetindo o
            título que está logo abaixo dela — "Nova" em cima de "Nova
            automação" —, e o primeiro item é a única parte clicável. Ou seja: é
            um link de volta com uma palavra a mais e um separador. */}
        <Link
          href="/automacoes"
          className={`mb-2 inline-block text-sm ${link}`}
        >
          ← Automações
        </Link>
        <h1 className={pageTitle}>Nova automação</h1>
        <p className={pageSubtitle}>
          Comece pelo que dispara a automação. Em seguida você monta o fluxo no quadro, arrastando
          os blocos na ordem em que eles devem acontecer.
        </p>
      </header>
      <FormNovaAutomacao post={sp.post ?? null} />
    </div>
  );
}
