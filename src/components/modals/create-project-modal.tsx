"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProject } from "@/lib/actions/projects";
import type { ClientSummary } from "@/lib/data/clients";
import type { StudioSummary } from "@/lib/data/studios";
import { ClientPicker } from "./client-picker";
import { FieldLabel, ModalShell, fieldInputClass } from "./modal-shell";

export function CreateProjectModal({
  studios,
  clients,
  onClose,
  onCreated,
}: {
  studios: StudioSummary[];
  clients: ClientSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string | null>(clients[0]?.id ?? null);
  const [newClientName, setNewClientName] = useState<string | null>(clients.length === 0 ? "" : null);
  const [type, setType] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL");
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProject({ name, clientId, newClientName, type, studioIds });
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

      <ClientPicker
        clients={clients}
        clientId={clientId}
        newClientName={newClientName}
        onChange={(p) => {
          setClientId(p.clientId);
          setNewClientName(p.newClientName);
        }}
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
