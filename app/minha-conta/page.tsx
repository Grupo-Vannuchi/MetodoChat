import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { card, muted, pageSubtitle, pageTitle } from "../ui";
import TrocarSenha from "./formulario";

// A MINHA CONTA (docs/specs/2026-11-04-logins.md, seção 5), para qualquer login: o nome, o e-mail e a troca
// da própria senha. Abrir esta página (um GET) não muda nada; o Sair mora no menu e é uma action.
export const metadata = { title: "Minha conta" };
export const dynamic = "force-dynamic";

export default async function MinhaContaPage() {
  const login = await sessaoAtual();
  if (!login) redirect("/entrar");
  return (
    <div className="space-y-6">
      <header>
        <h1 className={pageTitle}>Minha conta</h1>
        <p className={pageSubtitle}>
          {login.nome} · {login.email}
        </p>
      </header>
      <section className={`max-w-md space-y-3 p-5 ${card}`}>
        <h2 className="text-sm font-semibold">Trocar a senha</h2>
        <p className={`text-xs ${muted}`}>
          A senha nova tem de 10 a 200 caracteres. As suas sessões em outros aparelhos caem; esta continua.
        </p>
        <TrocarSenha />
      </section>
    </div>
  );
}
