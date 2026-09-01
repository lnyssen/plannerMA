"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { primaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { authenticate, type AuthActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex h-11 w-full items-center justify-center text-sm font-semibold ${primaryButtonClass}`}
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
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="h-11 rounded-md border-[1.5px] border-heading bg-paper px-3 text-sm text-ink outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Mot de passe
          </label>
          <Link href="/connexion/mot-de-passe-oublie" className={`text-xs font-semibold text-heading ${textButtonClass}`}>
            Mot de passe oublié ?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 rounded-md border-[1.5px] border-heading bg-paper px-3 text-sm text-ink outline-none"
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
