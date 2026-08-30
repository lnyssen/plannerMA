"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "@/lib/actions/account";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { ModalShell } from "./modal-shell";

export function NotificationPrefsModal({
  initialNotifyOnAssignment,
  initialNotifyDailyDigest,
  onClose,
}: {
  initialNotifyOnAssignment: boolean;
  initialNotifyDailyDigest: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notifyOnAssignment, setNotifyOnAssignment] = useState(initialNotifyOnAssignment);
  const [notifyDailyDigest, setNotifyDailyDigest] = useState(initialNotifyDailyDigest);

  function save() {
    startTransition(async () => {
      await updateNotificationPrefs({ notifyOnAssignment, notifyDailyDigest });
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell title="Mes notifications par courriel" onClose={onClose}>
      <p className="mb-4 text-sm text-ink">
        Les notifications dans l’application (cloche) restent toujours actives. Choisissez ici ce que vous recevez
        aussi par courriel.
      </p>
      <label className="mb-3 flex items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={notifyOnAssignment}
          onChange={(e) => setNotifyOnAssignment(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-semibold text-rail">Alerte d’attribution</span>
          <br />
          Un courriel quand une tâche vous est attribuée.
        </span>
      </label>
      <label className="mb-5 flex items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={notifyDailyDigest}
          onChange={(e) => setNotifyDailyDigest(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-semibold text-rail">Récap quotidien</span>
          <br />
          Vos tâches en cours ou à venir sous sept jours, chaque jour ouvré.
        </span>
      </label>

      <div className="flex justify-end gap-2.5">
        <button type="button" onClick={onClose} className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
          Annuler
        </button>
        <button type="button" disabled={pending} onClick={save} className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </ModalShell>
  );
}
