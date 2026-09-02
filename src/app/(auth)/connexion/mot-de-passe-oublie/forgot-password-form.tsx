"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { primaryButtonClass, textButtonClass } from "@/components/ui/buttons";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="border border-heading bg-wash px-3 py-3 text-sm text-ink">
          Si un compte existe pour <strong>{email}</strong>, un courriel avec un lien de réinitialisation vient de
          lui être envoyé. Le lien expire dans une heure.
        </p>
        <p className="text-xs text-ink-muted">
          Rien reçu après quelques minutes ? Le courriel de l’équipe n’est peut-être pas encore configuré pour cet
          outil — demandez à un administrateur de réinitialiser votre accès depuis Équipe.
        </p>
        <Link href="/connexion" className={`text-sm font-semibold text-heading ${textButtonClass}`}>
          ← Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-md border-[1.5px] border-heading bg-paper px-2.5 text-sm text-ink"
        />
      </div>

      {error && (
        <p role="alert" className="border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`flex h-11 w-full items-center justify-center text-sm font-semibold ${primaryButtonClass}`}
      >
        {pending ? "Envoi…" : "Envoyer le lien"}
      </button>

      <Link href="/connexion" className={`text-center text-sm font-semibold text-heading ${textButtonClass}`}>
        ← Retour à la connexion
      </Link>
    </form>
  );
}
