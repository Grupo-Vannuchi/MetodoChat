import type { ReactNode } from "react";
import { btnPrimary, link, muted } from "@/app/ui";
import { estadoDoConvite, FRASE_DO_LINK_QUE_NAO_VALE } from "@/lib/convites";
import { conviteDoCodigo } from "@/lib/convites-repositorio";
import CartaoDoConvite from "../cartao";

// A PÁGINA DO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). É aberta: quem a vê é o cliente,
// sem a senha do painel, e por isso ela não mostra nada do painel, nem o "para quem" nem as contas.
//
// SEM O CONVITE PENDENTE, a mesma frase para o vencido, o usado, o cancelado e o que não existe: a página
// não diz qual é o caso.
//
// O CÓDIGO VIAJA NO CAMINHO DA URL, e os cabeçalhos do `next.config.ts` fecham o resto (achado 157). O link
// de fora vai com `rel="noreferrer"`, para o endereço com o código não ir junto.
//
// O CONVITE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3) tem os passos dele, no mesmo
// cartão. O título da aba é o mesmo para as duas redes: ele é fixo, e a rede só se sabe depois de ler o
// convite.
export const metadata = { title: "Conectar sua conta", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MANAGE_ACCESS = "https://www.instagram.com/accounts/manage_access/";

// UM PASSO DA LISTA: o número num círculo e o texto ao lado. O número é só desenho (`aria-hidden`), porque o
// `<ol>` já diz a ordem a quem lê com leitor de tela.
function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-traco text-xs font-semibold dark:border-traco-escuro"
      >
        {n}
      </span>
      <div>{children}</div>
    </li>
  );
}

export default async function ConvitePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const convite = await conviteDoCodigo(codigo);
  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o relógio aqui é o
  // comportamento pedido. A regra trata todo arquivo como cliente; o dono silencia do mesmo jeito, com o
  // motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const pendente = !!convite && estadoDoConvite(convite, agora) === "pendente";

  if (!pendente) {
    return (
      <CartaoDoConvite>
        <p>{FRASE_DO_LINK_QUE_NAO_VALE}</p>
      </CartaoDoConvite>
    );
  }

  // O LINKEDIN: o cliente entra com o login dele e autoriza. Se ele já autorizou antes e está logado, o
  // LinkedIn pula a tela de autorização e volta direto (a documentação, spec §3, "Renovar").
  if (convite.rede === "linkedin") {
    return (
      <CartaoDoConvite rede="linkedin" subtitulo="Pelo navegador, em dois passos.">
        <ol className="space-y-4">
          <Passo n={1}>
            Clique no botão abaixo e entre no LinkedIn com o <b>seu login</b>, o do seu perfil pessoal.
          </Passo>
          <Passo n={2}>
            Na tela do LinkedIn, clique em <b>Permitir</b>. Com isso, o painel pode publicar no seu perfil o que for
            agendado para ele.
            <span className={`mt-1 block text-xs ${muted}`}>
              Se você já autorizou antes, o LinkedIn pode pular esta tela e voltar direto.
            </span>
          </Passo>
        </ol>
        <div className="pt-2">
          <a href={`/api/oauth/convite/${encodeURIComponent(codigo)}`} className={`${btnPrimary} w-full`}>
            Conectar meu LinkedIn
          </a>
        </div>
      </CartaoDoConvite>
    );
  }

  // O BOTÃO MORA FORA DA LISTA, numa linha só dele (o print do Eduardo, 04/11/2026). Dentro do passo 3, com
  // `block` e o `inline-flex` do btnPrimary na mesma classe, ele saiu grudado no texto: entre duas utilidades
  // de display, ganha a ordem das regras no CSS gerado. Aqui a classe leva uma só, a do btnPrimary.
  return (
    <CartaoDoConvite subtitulo="Pelo navegador do computador, em três passos.">
      <ol className="space-y-4">
        <Passo n={1}>
          A sua conta do Instagram precisa ser <b>Profissional</b> (Comercial ou Criador).
        </Passo>
        <Passo n={2}>
          Aceite o convite de testador: abra{" "}
          <a href={MANAGE_ACCESS} target="_blank" rel="noreferrer" className={link}>
            instagram.com/accounts/manage_access
          </a>
          , entre com a sua conta, vá em <b>Apps e sites</b> → aba <b>Convites de testador</b> e clique em{" "}
          <b>Aceitar</b>.
          <span className={`mt-1 block text-xs ${muted}`}>
            O convite não aparece no aplicativo do Instagram no celular, só na versão web.
          </span>
        </Passo>
        <Passo n={3}>Clique no botão abaixo e autorize na tela do Instagram.</Passo>
      </ol>
      <div className="pt-2">
        <a href={`/api/oauth/convite/${encodeURIComponent(codigo)}`} className={`${btnPrimary} w-full`}>
          Conectar meu Instagram
        </a>
      </div>
    </CartaoDoConvite>
  );
}
