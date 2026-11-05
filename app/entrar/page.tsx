"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { card, input, muted } from "../ui";

export default function EntrarPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className={`p-6 ${card}`}>
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tinta text-base font-bold text-papel dark:bg-tinta-escuro dark:text-papel-escuro">
            M
          </span>
          <div>
            <h1 className="titulo text-lg font-bold leading-tight">Entrar no painel</h1>
            <p className={`text-xs ${muted}`}>Use o seu e-mail e a sua senha.</p>
          </div>
        </div>
        <form action={action} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="username"
            placeholder="E-mail"
            aria-label="E-mail"
            className={input}
          />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="Senha"
            aria-label="Senha"
            className={input}
          />
          {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
          <button
            disabled={pending}
            className="w-full rounded-lg bg-acao px-3 py-2 text-sm font-semibold text-papel transition-colors hover:bg-acao/90 disabled:opacity-50 dark:bg-acao-escuro dark:text-papel-escuro dark:hover:bg-acao-escuro/90"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
