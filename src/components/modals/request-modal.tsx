"use client";

import { useState, useTransition } from "react";
import { createRequest } from "@/lib/actions/requests";
import type { StudioSummary } from "@/lib/data/studios";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { FieldLabel, fieldInputClass } from "./modal-shell";
import { SidePanel } from "./side-panel";

/**
 * Dépôt rapide d'une demande non planifiée — pas encore d'écran de gestion
 * dédié (backlog) : elle alerte simplement les administrateurs, qui la
 * planifient à la main pour l'instant en créant une tâche.
 */
export function RequestModal({ studios, onClose }: { studios: StudioSummary[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [studioId, setStudioId] = useState(studios[0]?.id ?? "");
  const [requester, setRequester] = useState("");
  const [wantedFor, setWantedFor] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createRequest({
        subject,
        studioId,
        requester: requester || null,
        wantedFor: wantedFor || null,
        detail: detail || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <SidePanel title="Nouvelle demande" onClose={onClose}>
      {done ? (
        <>
          <p className="mb-4 text-sm text-ink">Demande envoyée — les administrateurs ont été notifiés.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}>
              Fermer
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3">
            <FieldLabel htmlFor="req-subject">Objet</FieldLabel>
            <input
              id="req-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={fieldInputClass}
              placeholder="Ex. Bannière pour la newsletter de mars"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="req-studio">Studio concerné</FieldLabel>
            <select
              id="req-studio"
              value={studioId}
              onChange={(e) => setStudioId(e.target.value)}
              className={fieldInputClass}
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="req-requester">Demandeur (facultatif)</FieldLabel>
            <input
              id="req-requester"
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
              className={fieldInputClass}
              placeholder="Nom ou service"
            />
          </div>
          <div className="mb-3">
            <FieldLabel htmlFor="req-wanted">Souhaité pour (facultatif)</FieldLabel>
            <input
              id="req-wanted"
              type="date"
              value={wantedFor}
              onChange={(e) => setWantedFor(e.target.value)}
              className={fieldInputClass}
            />
          </div>
          <div className="mb-4">
            <FieldLabel htmlFor="req-detail">Détail (facultatif)</FieldLabel>
            <textarea
              id="req-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              className={fieldInputClass}
            />
          </div>

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
              disabled={pending || !subject.trim()}
              onClick={submit}
              className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
            >
              {pending ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </>
      )}
    </SidePanel>
  );
}
