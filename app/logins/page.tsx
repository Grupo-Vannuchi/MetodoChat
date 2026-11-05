import Link from "next/link";
import { redirect } from "next/navigation";
import { listarLogins } from "@/lib/logins-repositorio";
import { avisoDaPagina } from "@/lib/logins-textos";
import { sessaoAtual } from "@/lib/sessao";
import { alertInfo, badgeNeutral, badgeWarn, btnGhost, card, link, muted, pageSubtitle, pageTitle } from "../ui";
import { desativarLoginAction, reativarLoginAction } from "./actions";
import { CriarLogin, DefinirSenha } from "./formularios";

// A PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4), só para administrador. A página confere o
// administrador no servidor, e as actions dela conferem de novo: esconder o item do menu não basta.
//
// AS DUAS TRAVAS MORAM NO REPOSITÓRIO (lib/logins-repositorio.ts, `desativarLogin`): ninguém desativa o
// próprio login, e o último administrador ativo fica. A página só não mostra o botão no próprio login.
export const metadata = { title: "Logins" };
export const dynamic = "force-dynamic";

const quando = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);

export default async function LoginsPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string | string[] }>;
}) {
  const quem = await sessaoAtual();
  if (!quem) redirect("/entrar");
  if (!quem.administrador) redirect("/");
  const aviso = avisoDaPagina((await searchParams).aviso);
  const logins = await listarLogins();

  return (
    <div className="space-y-6">
      <header>
        <h1 className={pageTitle}>Logins</h1>
        <p className={pageSubtitle}>
          Cada pessoa entra com o próprio e-mail e a própria senha. Nesta versão, todo login é administrador.
        </p>
      </header>

      {aviso && (
        <p role="status" className={alertInfo}>
          {aviso}
        </p>
      )}

      <section className={`space-y-3 p-5 ${card}`}>
        <h2 className="text-sm font-semibold">Criar um login</h2>
        <p className={`text-xs ${muted}`}>
          A senha inicial tem de 10 a 200 caracteres. Passe-a à pessoa; ela pode trocar depois em Minha conta.
        </p>
        <CriarLogin />
      </section>

      <ul className="space-y-3">
        {logins.map((l) => {
          const souEu = l.id === quem.id;
          const desativado = l.desativado_em !== null;
          return (
            <li key={l.id} className={`space-y-3 p-5 ${card}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{l.nome}</span>
                <span className={`text-sm ${muted}`}>{l.email}</span>
                {souEu && <span className={badgeNeutral}>você</span>}
                {desativado && <span className={badgeWarn}>desativado</span>}
                <span className={`ml-auto text-xs ${muted}`}>criado em {quando(l.criado_em)}</span>
              </div>
              {/* A SENHA NOVA NÃO APARECE NA PRÓPRIA LINHA: ela derruba TODAS as sessões do login, e quem a
                  usasse em si mesmo se derrubaria (nota da auditoria ao plano, 04/11/2026). A própria senha
                  se troca na Minha conta, que mantém a sessão de quem troca. */}
              {souEu ? (
                <p className={`text-xs ${muted}`}>
                  Para trocar a sua senha, use a{" "}
                  <Link href="/minha-conta" className={link}>
                    Minha conta
                  </Link>
                  .
                </p>
              ) : (
                !desativado && <DefinirSenha id={l.id} nome={l.nome} />
              )}
              {!souEu && (
                <form action={desativado ? reativarLoginAction : desativarLoginAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <button type="submit" className={btnGhost}>
                    {desativado ? "Reativar" : "Desativar"}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
