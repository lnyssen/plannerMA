"use client";

import type { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "@/lib/actions/account";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { ModalShell } from "./modal-shell";

export function NotificationPrefsModal({
  initialNotifyOnAssignment,
  initialNotifyDailyDigest,
  initialNotifyOnMention,
  initialNotifyOnRequest,
  role,
  onClose,
}: {
  initialNotifyOnAssignment: boolean;
  initialNotifyDailyDigest: boolean;
  initialNotifyOnMention: boolean;
  initialNotifyOnRequest: boolean;
  role: Role;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notifyOnAssignment, setNotifyOnAssignment] = useState(initialNotifyOnAssignment);
  const [notifyDailyDigest, setNotifyDailyDigest] = useState(initialNotifyDailyDigest);
  const [notifyOnMention, setNotifyOnMention] = useState(initialNotifyOnMention);
  const [notifyOnRequest, setNotifyOnRequest] = useState(initialNotifyOnRequest);

  function save() {
    startTransition(async () => {
      await updateNotificationPrefs({ notifyOnAssignment, notifyDailyDigest, notifyOnMention, notifyOnRequest });
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
      <div className="mb-5 flex flex-col gap-3">
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={notifyOnAssignment}
            onChange={(e) => setNotifyOnAssignment(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold text-heading">Alerte d’attribution</span>
            <br />
            Un courriel quand une tâche vous est attribuée.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={notifyDailyDigest}
            onChange={(e) => setNotifyDailyDigest(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold text-heading">Récap quotidien</span>
            <br />
            Vos tâches en cours ou à venir sous sept jours, chaque jour ouvré.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={notifyOnMention}
            onChange={(e) => setNotifyOnMention(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold text-heading">Mention en commentaire</span>
            <br />
            Un courriel quand quelqu’un vous mentionne (« @Nom ») dans un commentaire.
          </span>
        </label>
        {role === "ADMIN" && (
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={notifyOnRequest}
              onChange={(e) => setNotifyOnRequest(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold text-heading">Nouvelle demande</span>
              <br />
              Un courriel à chaque nouvelle demande déposée (réservé aux administrateurs, seuls destinataires).
            </span>
          </label>
        )}
      </div>

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
