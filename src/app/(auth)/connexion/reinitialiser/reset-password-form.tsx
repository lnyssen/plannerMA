"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetPasswordWithToken } from "@/lib/actions/password-reset";
import { primaryButtonClass } from "@/components/ui/buttons";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    startTransition(async () => {
      const result = await resetPasswordWithToken({ token, password });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/connexion?reinitialise=1");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Nouveau mot de passe
        </label>
        <input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-md border-[1.5px] border-heading bg-paper px-3 text-sm text-ink outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm-password" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Confirmer le mot de passe
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11 rounded-md border-[1.5px] border-heading bg-paper px-3 text-sm text-ink outline-none"
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
        {pending ? "Enregistrement…" : "Choisir ce mot de passe"}
      </button>
    </form>
  );
}
