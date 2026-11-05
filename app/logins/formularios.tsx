"use client";
import { useActionState } from "react";
import { criarLoginAction, definirContasDoLoginAction, definirSenhaAction, type EstadoDoFormulario } from "./actions";
import { alertError, alertOk, btnPrimary, btnSecondary, input, label, muted } from "../ui";

// OS FORMULÁRIOS DA PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4): criar um login e definir a
// senha nova de quem esqueceu. A senha é digitada pelo administrador, que a passa à pessoa; nenhum e-mail
// sai daqui.
//
// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4): o criar tem a caixinha
// "Administrador", desmarcada (o login novo nasce comum), e cada login comum tem as contas dele, uma caixinha
// por conta conectada.

function Resposta({ estado }: { estado: EstadoDoFormulario }) {
  if (estado.erro)
    return (
      <p role="alert" className={alertError}>
        {estado.erro}
      </p>
    );
  if (estado.ok)
    return (
      <p role="status" className={alertOk}>
        {estado.ok}
      </p>
    );
  return null;
}

export function CriarLogin() {
  const [estado, criar, criando] = useActionState<EstadoDoFormulario, FormData>(criarLoginAction, {});
  return (
    <form action={criar} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="login-nome" className={label}>
            Nome
          </label>
          <input id="login-nome" name="nome" required maxLength={60} autoComplete="off" className={input} />
        </div>
        <div>
          <label htmlFor="login-email" className={label}>
            E-mail
          </label>
          <input id="login-email" name="email" type="email" required maxLength={254} autoComplete="off" className={input} />
        </div>
        <div>
          <label htmlFor="login-senha" className={label}>
            Senha inicial
          </label>
          <input
            id="login-senha"
            name="senha"
            type="password"
            required
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            className={input}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="administrador" />
        Administrador
      </label>
      <p className={`text-xs ${muted}`}>
        Desmarcada, o login é comum: vê só as contas que você der a ele, e não entra na Configuração nem nos Logins.
      </p>
      <button type="submit" disabled={criando} className={btnPrimary}>
        Criar login
      </button>
      <Resposta estado={estado} />
    </form>
  );
}

/** Uma conta como a caixinha a mostra: o id, o @ e o nome, e nunca o token. */
export type ContaDaCaixinha = { ig_user_id: string; username: string | null; name: string | null };

/**
 * AS CONTAS DE UM LOGIN COMUM: uma caixinha por conta conectada, marcada se o login já a recebeu, e o "Salvar
 * contas", que troca o conjunto de uma vez. A resposta volta como estado, como a senha nova.
 */
export function ContasDoLogin({
  id,
  nome,
  contas,
  marcadas,
}: {
  id: string;
  nome: string;
  contas: ContaDaCaixinha[];
  marcadas: string[];
}) {
  const [estado, salvar, salvando] = useActionState<EstadoDoFormulario, FormData>(definirContasDoLoginAction, {});
  if (!contas.length) return <p className={`text-xs ${muted}`}>Ainda não há contas no painel.</p>;
  return (
    <form action={salvar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <p className={label}>Contas de {nome}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {contas.map((c) => (
          <label key={c.ig_user_id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="contas" value={c.ig_user_id} defaultChecked={marcadas.includes(c.ig_user_id)} />
            {c.username ? `@${c.username}` : c.ig_user_id}
            {c.name && <span className={muted}>{c.name}</span>}
          </label>
        ))}
      </div>
      <button type="submit" disabled={salvando} className={btnSecondary}>
        Salvar contas
      </button>
      <Resposta estado={estado} />
    </form>
  );
}

export function DefinirSenha({ id, nome }: { id: string; nome: string }) {
  const [estado, definir, definindo] = useActionState<EstadoDoFormulario, FormData>(definirSenhaAction, {});
  return (
    <form action={definir} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`senha-${id}`} className={label}>
            Senha nova para {nome}
          </label>
          <input
            id={`senha-${id}`}
            name="senha"
            type="password"
            required
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            className={input}
          />
        </div>
        <button type="submit" disabled={definindo} className={btnSecondary}>
          Definir senha nova
        </button>
      </div>
      <Resposta estado={estado} />
    </form>
  );
}
