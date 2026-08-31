"use client";

import { UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPerson, getPersonDetail, removeUserAccess, updatePerson } from "@/lib/actions/people";
import type { StudioSummary } from "@/lib/data/studios";
import { dangerOutlineButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { FieldLabel, fieldInputClass, ModalShell } from "./modal-shell";

export function PersonModal({
  personId,
  studios,
  onClose,
}: {
  personId: string | null; // null = création
  studios: StudioSummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!!personId);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [email, setEmail] = useState("");
  const [external, setExternal] = useState(false);
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [linkedUser, setLinkedUser] = useState<{ email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    getPersonDetail(personId).then((p) => {
      if (cancelled) return;
      if (p) {
        setName(p.name);
        setTeam(p.team ?? "");
        setEmail(p.email ?? "");
        setExternal(p.external);
        setStudioIds(p.studios.map((s) => s.studioId));
        setLinkedUser(p.user ? { email: p.user.email } : null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  function removeAccess() {
    if (!personId || !linkedUser) return;
    if (!confirm(`Retirer l’accès de connexion pour ${linkedUser.email} ? La fiche personne et son historique restent intacts.`)) return;
    startTransition(async () => {
      const result = await removeUserAccess(personId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLinkedUser(null);
      router.refresh();
    });
  }

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = personId
        ? await updatePerson(personId, { name, team, email, external, studioIds })
        : await createPerson({ name, team, email, external, studioIds });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell title={personId ? "Modifier la personne" : "Ajouter une personne"} onClose={onClose}>
      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <>
          <FieldLabel htmlFor="person-name">Prénom ou nom affiché</FieldLabel>
          <input
            id="person-name"
            className={`${fieldInputClass} mb-3`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <FieldLabel htmlFor="person-team">Équipe ou service</FieldLabel>
          <input
            id="person-team"
            className={`${fieldInputClass} mb-3`}
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="Studios, Formations, agence partenaire…"
          />

          <FieldLabel htmlFor="person-email">Courriel (facultatif)</FieldLabel>
          <input
            id="person-email"
            type="email"
            className={`${fieldInputClass} mb-1`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@media-animation.be"
          />
          <p className="mb-3 text-xs text-ink-muted">
            Sert aux alertes (attribution de tâche…) quand cette personne n’a pas de compte de connexion.
          </p>

          <FieldLabel>Studios de rattachement (facultatif)</FieldLabel>
          <div className="mb-3 flex flex-wrap gap-2">
            {studios.map((s) => {
              const checked = studioIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-1.5 px-2 py-1 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-heading/10"
                  style={{ border: `1.5px solid ${checked ? "var(--color-heading)" : "var(--color-line)"}` }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleStudio(s.id)} />
                  {s.name}
                </label>
              );
            })}
          </div>

          <label className="mb-4 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} />
            Personne extérieure à Média Animation
          </label>

          {personId && linkedUser && (
            <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-line p-3">
              <span className="text-sm text-ink">
                Compte de connexion : <span className="font-semibold">{linkedUser.email}</span>
              </span>
              <button
                type="button"
                onClick={removeAccess}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold ${dangerOutlineButtonClass}`}
              >
                <UserX size={13} /> Retirer l’accès
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mb-3 text-xs font-semibold text-alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
            >
              {pending ? "Enregistrement…" : personId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
