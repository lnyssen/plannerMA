"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProject } from "@/lib/actions/projects";
import type { StudioSummary } from "@/lib/data/studios";
import { FieldLabel, ModalShell, fieldInputClass } from "./modal-shell";

export function CreateProjectModal({
  studios,
  onClose,
  onCreated,
}: {
  studios: StudioSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL");
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProject({ name, client, type, studioIds });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated();
    });
  }

  return (
    <ModalShell title="Nouveau projet" onClose={onClose}>
      <FieldLabel htmlFor="project-name">Nom du projet</FieldLabel>
      <input
        id="project-name"
        className={`${fieldInputClass} mb-3`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />

      <FieldLabel htmlFor="project-client">Client</FieldLabel>
      <input
        id="project-client"
        className={`${fieldInputClass} mb-3`}
        value={client}
        onChange={(e) => setClient(e.target.value)}
        placeholder="Direction, CSEM, Oxfam…"
      />

      <FieldLabel>Type de client</FieldLabel>
      <div className="mb-3 flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="radio" checked={type === "INTERNAL"} onChange={() => setType("INTERNAL")} /> Interne
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="radio" checked={type === "EXTERNAL"} onChange={() => setType("EXTERNAL")} /> Externe
        </label>
      </div>

      <FieldLabel>Studios concernés</FieldLabel>
      <div className="mb-4 flex flex-wrap gap-2">
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
          {pending ? "Création…" : "Créer"}
        </button>
      </div>
    </ModalShell>
  );
}
