"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProjectType } from "@prisma/client";
import { createProject } from "@/lib/actions/projects";
import type { ClientSummary } from "@/lib/data/clients";
import type { StudioSummary } from "@/lib/data/studios";
import { PROJECT_TYPE_LABELS } from "@/lib/planning/labels";
import { ClientPicker } from "./client-picker";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
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
  onCreated: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [clientId, setClientId] = useState<string | null>(clients[0]?.id ?? null);
  const [newClientName, setNewClientName] = useState<string | null>(clients.length === 0 ? "" : null);
  const [type, setType] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL");
  const [projectType, setProjectType] = useState<ProjectType>("EXTERNE");
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProject({ name, code: code.trim() || null, clientId, newClientName, type, projectType, studioIds });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated(result.id!);
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

      <FieldLabel htmlFor="project-code">Code (facultatif)</FieldLabel>
      <input
        id="project-code"
        className={`${fieldInputClass} mb-3`}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="BETTER-3, ONE-6…"
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

      <FieldLabel htmlFor="project-type">Type de projet (suivi de temps)</FieldLabel>
      <select
        id="project-type"
        className={`${fieldInputClass} mb-3`}
        value={projectType}
        onChange={(e) => setProjectType(e.target.value as ProjectType)}
      >
        {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <FieldLabel>Studios concernés</FieldLabel>
      <div className="mb-4 flex flex-wrap gap-2">
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
          {pending ? "Création…" : "Créer"}
        </button>
      </div>
    </ModalShell>
  );
}
