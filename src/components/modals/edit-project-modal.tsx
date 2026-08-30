"use client";

import { Archive, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getProjectDetail, setProjectArchived, updateProject, type ProjectDetail } from "@/lib/actions/projects";
import type { ClientSummary } from "@/lib/data/clients";
import type { StudioSummary } from "@/lib/data/studios";
import { ClientPicker } from "./client-picker";
import { primaryButtonClass, secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { FieldLabel, fieldInputClass, ModalShell } from "./modal-shell";

export function EditProjectModal({
  projectId,
  studios,
  clients,
  onClose,
}: {
  projectId: string;
  studios: StudioSummary[];
  clients: ClientSummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [type, setType] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL");
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProjectDetail(projectId).then((p) => {
      if (cancelled) return;
      if (p) {
        setProject(p);
        setName(p.name);
        setClientId(p.clientId);
        setType(p.type);
        setStudioIds(p.studios.map((s) => s.studioId));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateProject({ projectId, name, clientId, newClientName, type, studioIds });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function toggleArchived() {
    if (!project) return;
    startTransition(async () => {
      await setProjectArchived({ projectId, archived: !project.archived });
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell title={loading ? "Chargement…" : (project?.name ?? "Projet introuvable")} onClose={onClose}>
      {loading && <p className="text-sm text-ink-muted">Chargement…</p>}
      {!loading && !project && <p className="text-sm text-ink-muted">Ce projet n’existe plus.</p>}

      {project && (
        <>
          <FieldLabel htmlFor="edit-project-name">Nom du projet</FieldLabel>
          <input
            id="edit-project-name"
            className={`${fieldInputClass} mb-3`}
            value={name}
            onChange={(e) => setName(e.target.value)}
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
                  className="flex cursor-pointer items-center gap-1.5 px-2 py-1 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-heading/10"
                  style={{ border: `1.5px solid ${checked ? "var(--color-heading)" : "var(--color-line)"}` }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleStudio(s.id)} />
                  {s.name}
                </label>
              );
            })}
          </div>

          {project.archived && (
            <p className="mb-3 border border-line bg-wash px-3 py-2 text-xs text-ink-muted">Ce projet est archivé.</p>
          )}

          {error && (
            <p role="alert" className="mb-3 text-xs font-semibold text-alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={toggleArchived}
              className={`flex items-center gap-1.5 text-sm font-semibold text-heading ${textButtonClass}`}
            >
              {project.archived ? (
                <>
                  <RotateCcw size={14} /> Réactiver
                </>
              ) : (
                <>
                  <Archive size={14} /> Archiver
                </>
              )}
            </button>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={save}
                className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}
