import { btnPrimary, link, muted } from "@/app/ui";
import { estadoDoConvite, FRASE_DO_LINK_QUE_NAO_VALE } from "@/lib/convites";
import { conviteDoCodigo } from "@/lib/convites-repositorio";

// A PÁGINA DO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). É aberta: quem a vê é o cliente,
// sem a senha do painel, e por isso ela não mostra nada do painel, nem o "para quem" nem as contas.
//
// SEM O CONVITE PENDENTE, a mesma frase para o vencido, o usado, o cancelado e o que não existe: a página
// não diz qual é o caso.
//
// O CÓDIGO VIAJA NO CAMINHO DA URL, e os cabeçalhos do `next.config.ts` fecham o resto (achado 157). O link
// de fora vai com `rel="noreferrer"`, para o endereço com o código não ir junto.
export const metadata = { title: "Conectar seu Instagram", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MANAGE_ACCESS = "https://www.instagram.com/accounts/manage_access/";

export default async function ConvitePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const convite = await conviteDoCodigo(codigo);
  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o relógio aqui é o
  // comportamento pedido. A regra trata todo arquivo como cliente; o dono silencia do mesmo jeito, com o
  // motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const pendente = !!convite && estadoDoConvite(convite, agora) === "pendente";

  return (
    <article className="mx-auto max-w-xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conectar seu Instagram</h1>
      {pendente ? (
        <>
          <p>Siga os três passos abaixo, pelo navegador do computador.</p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              A sua conta do Instagram precisa ser <b>Profissional</b> (Comercial ou Criador).
            </li>
            <li>
              Aceite o convite de testador: abra{" "}
              <a href={MANAGE_ACCESS} target="_blank" rel="noreferrer" className={link}>
                instagram.com/accounts/manage_access
              </a>
              , entre com a sua conta, vá em <b>Apps e sites</b> → aba <b>Convites de testador</b> e clique em{" "}
              <b>Aceitar</b>.
              <span className={`mt-1 block text-xs ${muted}`}>
                O convite não aparece no aplicativo do Instagram no celular, só na versão web.
              </span>
            </li>
            <li>
              Clique no botão abaixo e autorize na tela do Instagram.
              <a href={`/api/oauth/convite/${encodeURIComponent(codigo)}`} className={`mt-2 block w-fit ${btnPrimary}`}>
                Conectar meu Instagram
              </a>
            </li>
          </ol>
        </>
      ) : (
        <p>{FRASE_DO_LINK_QUE_NAO_VALE}</p>
      )}
    </article>
  );
}
