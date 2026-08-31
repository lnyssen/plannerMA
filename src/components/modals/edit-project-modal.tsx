"use client";

import { Archive, Flag, ListChecks, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createMilestone, deleteMilestone, setMilestoneDone } from "@/lib/actions/milestones";
import { getProjectDetail, setProjectArchived, updateProject, type ProjectDetail } from "@/lib/actions/projects";
import type { ClientSummary } from "@/lib/data/clients";
import type { StudioSummary } from "@/lib/data/studios";
import { formatShortFr, toIsoDate, today } from "@/lib/planning/dates";
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
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState(today());
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  async function loadProject() {
    const p = await getProjectDetail(projectId);
    if (p) {
      setProject(p);
      setName(p.name);
      setClientId(p.clientId);
      setType(p.type);
      setStudioIds(p.studios.map((s) => s.studioId));
    }
    return p;
  }

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

  function addMilestone() {
    if (!newMilestoneTitle.trim()) return;
    setMilestoneError(null);
    startTransition(async () => {
      const result = await createMilestone({ projectId, title: newMilestoneTitle.trim(), dueDate: newMilestoneDue });
      if (result.error) {
        setMilestoneError(result.error);
        return;
      }
      setNewMilestoneTitle("");
      await loadProject();
      router.refresh();
    });
  }

  function toggleMilestone(id: string, isDone: boolean) {
    startTransition(async () => {
      await setMilestoneDone(id, isDone);
      await loadProject();
      router.refresh();
    });
  }

  function removeMilestone(id: string) {
    startTransition(async () => {
      await deleteMilestone(id);
      await loadProject();
      router.refresh();
    });
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

          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
            <ListChecks size={13} /> Tâches ({project.tasks.length})
          </h3>
          <div className="mb-4 flex flex-col gap-1.5">
            {project.tasks.length === 0 && <p className="text-xs text-ink-muted">Aucune tâche.</p>}
            {project.tasks.map((t) => (
              <a
                key={t.id}
                href={`/taches?open=${t.id}`}
                className="flex items-center gap-2 border border-line px-2.5 py-1.5 text-sm transition-colors duration-100 hover:border-heading"
              >
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 text-2xs font-semibold"
                  style={{ background: t.status.fillHex, color: t.status.colorHex }}
                >
                  {t.status.name}
                </span>
                <span className="flex-1 truncate text-ink">{t.title}</span>
                {t.assignee && <span className="flex-shrink-0 text-2xs text-ink-muted">{t.assignee.name}</span>}
                <span className="flex-shrink-0 text-2xs text-ink-muted tabular-nums">
                  {formatShortFr(toIsoDate(t.startDate))}
                </span>
              </a>
            ))}
          </div>

          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Flag size={13} /> Jalons ({project.milestones.length})
          </h3>
          <div className="mb-3 flex flex-col gap-1.5">
            {project.milestones.length === 0 && <p className="text-xs text-ink-muted">Aucun jalon.</p>}
            {project.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-2 border border-line px-2.5 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={m.isDone}
                  onChange={(e) => toggleMilestone(m.id, e.target.checked)}
                  aria-label={`${m.title} — ${m.isDone ? "atteint" : "à venir"}`}
                />
                <span className={`flex-1 ${m.isDone ? "text-ink-muted line-through" : "text-ink"}`}>{m.title}</span>
                <span className="text-2xs text-ink-muted tabular-nums">{formatShortFr(toIsoDate(m.dueDate))}</span>
                <button
                  type="button"
                  onClick={() => removeMilestone(m.id)}
                  aria-label={`Retirer ${m.title}`}
                  className={`flex-shrink-0 p-0.5 text-ink-muted hover:text-alert ${textButtonClass}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Nouveau jalon"
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              className={`${fieldInputClass} min-w-[160px] flex-1`}
            />
            <input
              type="date"
              value={newMilestoneDue}
              onChange={(e) => setNewMilestoneDue(e.target.value)}
              aria-label="Échéance du jalon"
              className={fieldInputClass}
            />
            <button
              type="button"
              disabled={!newMilestoneTitle.trim()}
              onClick={addMilestone}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
          {milestoneError && (
            <p role="alert" className="mb-3 text-xs font-semibold text-alert">
              {milestoneError}
            </p>
          )}

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
