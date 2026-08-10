import Link from "next/link";
import FormNovaAutomacao from "./form-nova";
import { pageTitle, pageSubtitle, muted } from "../../ui";

export const dynamic = "force-dynamic";

// ESTA PÁGINA NÃO MONTA O QUADRO, e a decisão está escrita em `./form-nova`:
// `salvarPassos` precisa de um id, e automação nova não tem. Aqui se cria a
// automação com o mínimo; o quadro abre em `/automacoes/<id>`, para onde
// `criarAutomacao` (app/automacoes/actions.ts) redireciona.
//
// A CONTA CONECTADA NÃO É MAIS LIDA AQUI. Ela existia para abastecer o cabeçalho
// da pré-visualização em celular do formulário antigo (`phone-preview.tsx`), que
// saiu junto com ele. A prévia nova (`editor/previa.tsx`) desenha a moldura sem
// a conta, e quem recusa a criação sem conta conectada é o próprio
// `criarAutomacao`, no servidor — que é onde a recusa vale.
export default function NovaAutomacaoPage() {
  return (
    <div className="space-y-6">
      <header>
        <nav className={`mb-2 text-xs ${muted}`}>
          <Link href="/automacoes" className="transition-colors hover:text-indigo-600">
            Automações
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Nova</span>
        </nav>
        <h1 className={pageTitle}>Nova automação</h1>
        <p className={pageSubtitle}>
          Comece pelo que dispara a automação. Em seguida você monta o fluxo no quadro, arrastando
          os blocos na ordem em que eles devem acontecer.
        </p>
      </header>
      <FormNovaAutomacao />
    </div>
  );
}
