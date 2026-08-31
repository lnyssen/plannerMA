"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/lib/actions/account";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { FieldLabel, fieldInputClass, ModalShell } from "./modal-shell";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    startTransition(async () => {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <ModalShell title="Changer mon mot de passe" onClose={onClose}>
      {done ? (
        <>
          <p className="mb-4 text-sm text-ink">Mot de passe changé. Vous restez connecté·e.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}>
              Fermer
            </button>
          </div>
        </>
      ) : (
        <>
          <FieldLabel htmlFor="current-password">Mot de passe actuel</FieldLabel>
          <input
            id="current-password"
            type="password"
            className={`${fieldInputClass} mb-3`}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
          />

          <FieldLabel htmlFor="new-password">Nouveau mot de passe (8 caractères minimum)</FieldLabel>
          <input
            id="new-password"
            type="password"
            className={`${fieldInputClass} mb-3`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <FieldLabel htmlFor="confirm-password">Confirmer le nouveau mot de passe</FieldLabel>
          <input
            id="confirm-password"
            type="password"
            className={`${fieldInputClass} mb-4`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && (
            <p role="alert" className="mb-3 text-xs font-semibold text-alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
              Annuler
            </button>
            <button
              type="button"
              disabled={pending || !currentPassword || !newPassword}
              onClick={submit}
              className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
            >
              {pending ? "Enregistrement…" : "Changer"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
