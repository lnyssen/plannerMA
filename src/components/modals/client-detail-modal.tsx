"use client";

import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useEffect, useState, useTransition } from "react";
import { createClient, deleteClient, getClientDetail, updateClientDetail } from "@/lib/actions/clients";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { FieldLabel, fieldInputClass, ModalShell } from "./modal-shell";

export function ClientDetailModal({
  clientId,
  onClose,
  isAdmin,
}: {
  clientId: string | null; // null = création
  onClose: () => void;
  /** Créer/modifier/supprimer est réservé aux administrateurs — voir src/lib/actions/clients.ts. Les autres consultent en lecture seule. */
  isAdmin: boolean;
}) {
  const router = useRouter();
  const ask = useConfirm();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!!clientId);
  const [projectCount, setProjectCount] = useState(0);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    getClientDetail(clientId).then((c) => {
      if (cancelled) return;
      if (c) {
        setName(c.name);
        setContactName(c.contactName ?? "");
        setContactEmail(c.contactEmail ?? "");
        setContactPhone(c.contactPhone ?? "");
        setWebsite(c.website ?? "");
        setNotes(c.notes ?? "");
        setType(c.type);
        setProjectCount(c._count.projects);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function submit() {
    setError(null);
    startTransition(async () => {
      if (clientId) {
        const result = await updateClientDetail(clientId, { name, contactName, contactEmail, contactPhone, website, notes, type });
        if (result.error) {
          setError(result.error);
          return;
        }
      } else {
        const created = await createClient(name);
        if (created.error) {
          setError(created.error);
          return;
        }
        if (created.id && (contactName || contactEmail || contactPhone || website || notes)) {
          await updateClientDetail(created.id, { name, contactName, contactEmail, contactPhone, website, notes, type });
        }
      }
      router.refresh();
      onClose();
    });
  }

  async function remove() {
    if (!clientId) return;
    const ok = await ask({
      title: `Retirer « ${name} » ?`,
      body: "Le retrait est refusé si ce client porte encore des projets.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteClient(clientId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell title={loading ? "Chargement…" : clientId ? name : "Nouveau client"} onClose={onClose}>
      {loading ? (
        <DetailSkeleton />
      ) : (
        <>
          {/* Le caractère interne/externe se saisit ici : c'est une propriété
              du client. Il était auparavant porté par chaque projet, si bien
              que deux projets d'un même client pouvaient se contredire. */}
          <FieldLabel>Type de client</FieldLabel>
          <div className="mb-3 flex gap-4">
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input type="radio" checked={type === "INTERNAL"} onChange={() => setType("INTERNAL")} /> Interne (collègues)
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input type="radio" checked={type === "EXTERNAL"} onChange={() => setType("EXTERNAL")} /> Externe
            </label>
          </div>

          <FieldLabel htmlFor="client-name">Nom</FieldLabel>
          <input
            id="client-name"
            disabled={!isAdmin}
            className={`${fieldInputClass} mb-3 disabled:opacity-70`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Oxfam Belgique"
            autoFocus
          />

          <div className="mb-3 flex gap-3">
            <div className="flex-1">
              <FieldLabel htmlFor="client-contact-name">Personne de contact</FieldLabel>
              <input
                id="client-contact-name"
                disabled={!isAdmin}
                className={`${fieldInputClass} disabled:opacity-70`}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <FieldLabel htmlFor="client-contact-phone">Téléphone</FieldLabel>
              <input
                id="client-contact-phone"
                type="tel"
                disabled={!isAdmin}
                className={`${fieldInputClass} disabled:opacity-70`}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          <FieldLabel htmlFor="client-contact-email">Email</FieldLabel>
          <input
            id="client-contact-email"
            type="email"
            disabled={!isAdmin}
            className={`${fieldInputClass} mb-3 disabled:opacity-70`}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />

          <FieldLabel htmlFor="client-website">Site web</FieldLabel>
          <input
            id="client-website"
            disabled={!isAdmin}
            className={`${fieldInputClass} mb-3 disabled:opacity-70`}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="oxfam.be"
          />

          <FieldLabel htmlFor="client-notes">Notes</FieldLabel>
          <textarea
            id="client-notes"
            rows={3}
            disabled={!isAdmin}
            className={`${fieldInputClass} mb-3 h-auto! resize-y disabled:opacity-70`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexte, préférences, historique de la relation…"
          />

          {clientId && (
            <p className="mb-3 text-xs text-ink-muted">
              {projectCount} projet{projectCount === 1 ? "" : "s"}
            </p>
          )}

          {error && (
            <p role="alert" className="mb-3 text-xs font-semibold text-alert">
              {error}
            </p>
          )}

          {isAdmin ? (
            <div className="flex items-center justify-between gap-2.5">
              {clientId ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={projectCount > 0}
                  className={`px-2 py-1 text-sm font-semibold ${dangerButtonClass} disabled:opacity-40`}
                  title={projectCount > 0 ? "Utilisé par au moins un projet" : undefined}
                >
                  Retirer
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={pending || !name.trim()}
                  onClick={submit}
                  className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
                >
                  {pending ? "Enregistrement…" : clientId ? "Enregistrer" : "Créer"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
                Fermer
              </button>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
