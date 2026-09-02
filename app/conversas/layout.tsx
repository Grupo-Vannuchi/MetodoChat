import { getSelectedAccount } from "@/lib/account";
import { categoriasDasConversas, listConversations } from "@/lib/conversations";
import { quantasSemCategoria } from "@/lib/categorias";
import { card, muted, pageTitle } from "../ui";
import Lista from "./lista";
import { ColunaLista, ColunaConversa } from "./painel";
import Atualizador from "./atualizador";

export const dynamic = "force-dynamic";

// A lista mora no LAYOUT, não na página, e essa é a mudança inteira.
//
// Layout do App Router não re-renderiza ao navegar entre rotas irmãs. Com a
// lista aqui, trocar de conversa não a desmonta: a rolagem fica onde estava e só
// a coluna da direita muda. Era isso que obrigava a voltar de tela toda vez.
//
// Quem mantém essa lista em dia é outra coisa: o `Atualizador` (abaixo) refaz
// a rota a cada 30s com a aba visível, e `marcarVisto` dispara
// `revalidatePath("/conversas", "layout")` assim que a conversa é aberta — daí
// o segundo argumento "layout", já que é este arquivo, e não a página, quem
// desenha a lista. As duas coisas juntas é que fazem o badge sumir sem F5.
export default async function ConversasLayout({ children }: { children: React.ReactNode }) {
  const account = await getSelectedAccount();
  // DUAS consultas, e nao uma: a lista e uma PAGINA (as 50 mais recentes) e o
  // contador e sobre a CONTA INTEIRA. Contar sobre a pagina fazia o cabecalho
  // sumir assim que o topo ficasse marcado, com o resto por marcar abaixo do
  // corte — o porque inteiro esta em `categoriasDasConversas`.
  //
  // As duas saem juntas porque uma nao depende da outra: em serie, a segunda
  // esperaria a primeira sem motivo.
  const [conversas, categorias] = account
    ? await Promise.all([
        listConversations(account.ig_user_id),
        categoriasDasConversas(account.ig_user_id),
      ])
    : [[], []];
  const semCategoriaCount = quantasSemCategoria(categorias);

  return (
    <div className="space-y-4">
      {/* Mantém lista e conversa em dia sem F5; só com a aba visível. */}
      <Atualizador />
      <header>
        <h1 className={pageTitle}>Conversas</h1>
        <p className={`mt-1 text-sm ${muted}`}>
          Responder só é possível dentro de 24h desde a última mensagem da pessoa — regra da Meta.
        </p>
        {/* Zero não vira linha: quando não falta nenhuma marcação, o contador
            some em vez de anunciar que não há nada a fazer. */}
        {semCategoriaCount > 0 && (
          <p className={`mt-1 text-sm ${muted}`}>
            {semCategoriaCount} {semCategoriaCount === 1 ? "conversa" : "conversas"} sem categoria.
          </p>
        )}
      </header>

      {/* Altura fixa para cada coluna rolar por conta própria, em vez de a
          página inteira crescer e levar as duas junto. */}
      <div className={`flex h-[calc(100vh-13rem)] overflow-hidden ${card}`}>
        <ColunaLista>
          <Lista conversas={conversas} semConta={!account} />
        </ColunaLista>
        <ColunaConversa>{children}</ColunaConversa>
      </div>
    </div>
  );
}
