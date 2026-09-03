"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ProjectPole } from "@prisma/client";
import { createProject, duplicateProject, listProjectTemplates, type ProjectTemplate } from "@/lib/actions/projects";
import type { ClientSummary } from "@/lib/data/clients";
import type { StudioSummary } from "@/lib/data/studios";
import { PROJECT_POLE_LABELS } from "@/lib/planning/labels";
import { ClientPicker } from "./client-picker";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { FieldLabel, fieldInputClass } from "./modal-shell";
import { SidePanel } from "./side-panel";

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
  const [pole, setPole] = useState<ProjectPole | "">("");
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Les modèles ne sont chargés qu'à l'ouverture du panneau : c'est une aide
  // ponctuelle, pas une donnée dont la page a besoin pour s'afficher.
  const [modeles, setModeles] = useState<ProjectTemplate[]>([]);
  useEffect(() => {
    void listProjectTemplates().then(setModeles);
  }, []);

  function partirDuModele(id: string) {
    startTransition(async () => {
      const result = await duplicateProject(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated(result.id!);
    });
  }

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProject({ name, code: code.trim() || null, clientId, newClientName, pole: pole || null, studioIds });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated(result.id!);
    });
  }

  return (
    <SidePanel title="Nouveau projet" onClose={onClose}>
      {modeles.length > 0 && (
        <div className="mb-4 rounded-lg border border-line p-3">
          <p className="mb-2 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Partir d’un modèle</p>
          <div className="flex flex-col gap-1.5">
            {modeles.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={pending}
                onClick={() => partirDuModele(m.id)}
                className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-sm transition-colors duration-100 hover:border-heading disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-heading">{m.name}</span>
                  <span className="text-ink-muted"> — {m.client.name}</span>
                </span>
                <span className="flex-shrink-0 text-2xs text-ink-muted tabular-nums">
                  {m._count.tasks} tâche{m._count.tasks === 1 ? "" : "s"}
                  {m._count.milestones > 0 && ` · ${m._count.milestones} jalon${m._count.milestones === 1 ? "" : "s"}`}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-2xs text-ink-muted">
            Copie les tâches, sous-tâches, dépendances et jalons, décalés pour démarrer aujourd’hui. Statuts remis à
            zéro. Vous pourrez tout ajuster ensuite.
          </p>
        </div>
      )}

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

      {/* Interne/externe ne se demande plus ici : c'est une propriété du
          client, saisie sur sa fiche. Reste la seule question propre au
          projet — quel pôle interne le porte. */}
      <FieldLabel htmlFor="project-pole">Pôle</FieldLabel>
      <select
        id="project-pole"
        className={`${fieldInputClass} mb-3`}
        value={pole}
        onChange={(e) => setPole(e.target.value as ProjectPole | "")}
      >
        <option value="">Aucun pôle particulier</option>
        {Object.entries(PROJECT_POLE_LABELS).map(([value, label]) => (
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
    </SidePanel>
  );
}
