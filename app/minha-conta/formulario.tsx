"use client";
import { useActionState } from "react";
import { trocarMinhaSenha, type EstadoDaTroca } from "./actions";
import { alertError, alertOk, btnPrimary, input, label } from "../ui";

// A TROCA DA PRÓPRIA SENHA (docs/specs/2026-11-04-logins.md, seção 5): a senha atual, a nova e a confirmação.
export default function TrocarSenha() {
  const [estado, trocar, trocando] = useActionState<EstadoDaTroca, FormData>(trocarMinhaSenha, {});
  return (
    <form action={trocar} className="space-y-3">
      <div>
        <label htmlFor="senha-atual" className={label}>
          Senha atual
        </label>
        <input id="senha-atual" name="atual" type="password" required autoComplete="current-password" className={input} />
      </div>
      <div>
        <label htmlFor="senha-nova" className={label}>
          Senha nova
        </label>
        <input
          id="senha-nova"
          name="nova"
          type="password"
          required
          minLength={10}
          maxLength={200}
          autoComplete="new-password"
          className={input}
        />
      </div>
      <div>
        <label htmlFor="senha-confirmacao" className={label}>
          Senha nova de novo
        </label>
        <input
          id="senha-confirmacao"
          name="confirmacao"
          type="password"
          required
          minLength={10}
          maxLength={200}
          autoComplete="new-password"
          className={input}
        />
      </div>
      <button type="submit" disabled={trocando} className={btnPrimary}>
        Trocar a senha
      </button>
      {estado.erro && (
        <p role="alert" className={alertError}>
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p role="status" className={alertOk}>
          {estado.ok}
        </p>
      )}
    </form>
  );
}
