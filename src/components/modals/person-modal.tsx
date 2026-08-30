"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPerson, getPersonDetail, updatePerson } from "@/lib/actions/people";
import type { StudioSummary } from "@/lib/data/studios";
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
  const [external, setExternal] = useState(false);
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    getPersonDetail(personId).then((p) => {
      if (cancelled) return;
      if (p) {
        setName(p.name);
        setTeam(p.team ?? "");
        setExternal(p.external);
        setStudioIds(p.studios.map((s) => s.studioId));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = personId
        ? await updatePerson(personId, { name, team, external, studioIds })
        : await createPerson({ name, team, external, studioIds });
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

          <FieldLabel>Studios de rattachement (facultatif)</FieldLabel>
          <div className="mb-3 flex flex-wrap gap-2">
            {studios.map((s) => {
              const checked = studioIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-1.5 px-2 py-1 text-sm text-ink"
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

          {error && (
            <p role="alert" className="mb-3 text-xs font-semibold text-alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="border-[1.5px] border-heading px-4 py-2 text-sm font-semibold text-heading"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="bg-heading px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : personId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
