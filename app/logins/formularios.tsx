"use client";
import { useActionState } from "react";
import { criarLoginAction, definirSenhaAction, type EstadoDoFormulario } from "./actions";
import { alertError, alertOk, btnPrimary, btnSecondary, input, label } from "../ui";

// OS FORMULÁRIOS DA PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4): criar um login e definir a
// senha nova de quem esqueceu. A senha é digitada pelo administrador, que a passa à pessoa; nenhum e-mail
// sai daqui.

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
      <button type="submit" disabled={criando} className={btnPrimary}>
        Criar login
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
