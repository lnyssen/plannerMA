"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate, type AuthActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center bg-heading text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  );
}

export function ConnexionForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(authenticate, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Courriel
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="h-11 border-[1.5px] border-heading bg-paper px-3 text-sm text-ink outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 border-[1.5px] border-heading bg-paper px-3 text-sm text-ink outline-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
