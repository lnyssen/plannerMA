"use client";

import { useMemo, useState, useTransition } from "react";
import { TaskDetailModal } from "@/components/modals/task-detail-modal";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { StudioBadge } from "@/components/ui/studio-badge";
import { updateTaskStatus } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskListItem, TaskOption } from "@/lib/data/tasks";
import { formatShortFr, toIsoDate } from "@/lib/planning/dates";

function TaskCard({ task, onOpen }: { task: TaskListItem; onOpen: (id: string) => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(task.id)}
      className="cursor-grab rounded-lg border border-line bg-paper p-2.5 text-left transition-colors duration-100 hover:border-heading active:cursor-grabbing"
    >
      <p className="mb-1.5 text-sm font-bold text-heading">{task.title}</p>
      {task.project && (
        <p className="mb-1.5 truncate text-2xs text-ink-muted">
          {task.project.client.name} — {task.project.name}
        </p>
      )}
      <div className="mb-1.5">
        <StudioBadge name={task.studio.name} fillHex={task.studio.fillHex} colorHex={task.studio.colorHex} />
      </div>
      <div className="flex items-center justify-between text-2xs text-ink-muted">
        <span>{task.assignee?.name ?? "Non attribué"}</span>
        <span className="tabular-nums">{formatShortFr(toIsoDate(task.startDate))}</span>
      </div>
    </div>
  );
}

export function KanbanView({
  tasks: initialTasks,
  studios,
  people,
  projects,
  statuses,
  dependencyOptions,
}: {
  tasks: TaskListItem[];
  studios: StudioSummary[];
  people: PersonSummary[];
  projects: ProjectOption[];
  statuses: TaskStatusSummary[];
  dependencyOptions: TaskOption[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [syncedInitial, setSyncedInitial] = useState(initialTasks);
  if (initialTasks !== syncedInitial) {
    setSyncedInitial(initialTasks);
    setTasks(initialTasks);
  }

  const [search, setSearch] = useState("");
  const [studioFilter, setStudioFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (studioFilter && t.studioId !== studioFilter) return false;
      if (personFilter && t.assigneeId !== personFilter) return false;
      if (!q) return true;
      return [t.title, t.project?.name, t.studio.name, t.assignee?.name].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [tasks, search, studioFilter, personFilter]);

  const columns = useMemo(
    () => statuses.map((status) => ({ status, tasks: filtered.filter((t) => t.statusId === status.id) })),
    [filtered, statuses],
  );

  function moveTask(taskId: string, statusId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.statusId === statusId) return;
    setError(null);
    const previousStatusId = task.statusId;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, statusId } : t)));
    startTransition(async () => {
      const result = await updateTaskStatus({ taskId, statusId, expectedVersion: task.version });
      if (result.error) {
        setError(result.error);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, statusId: previousStatusId } : t)));
      } else if (result.version != null) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, version: result.version! } : t)));
      }
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md flex-1 rounded-md border-[1.5px] border-heading px-3 py-2.5 text-sm text-ink outline-none"
        />
        <select
          value={studioFilter}
          onChange={(e) => setStudioFilter(e.target.value)}
          aria-label="Filtrer par studio"
          className="rounded-md border-[1.5px] border-heading px-2.5 py-2.5 text-sm text-ink"
        >
          <option value="">Tous les studios</option>
          {studios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          aria-label="Filtrer par personne"
          className="rounded-md border-[1.5px] border-heading px-2.5 py-2.5 text-sm text-ink"
        >
          <option value="">Toutes les personnes</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mb-3 border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}

      {/* Colonnes en ligne, largeur fixe (jamais de retour à la ligne, comme
          un tableau Kanban classique) : si elles ne tiennent pas toutes,
          la rangée défile horizontalement plutôt que d'empiler les colonnes
          les unes sous les autres. */}
      <ScrollFade className="flex gap-4 pb-2">
        {columns.map(({ status, tasks: colTasks }) => (
          <div
            key={status.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatusId(status.id);
            }}
            onDragLeave={() => setDragOverStatusId((s) => (s === status.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverStatusId(null);
              const taskId = e.dataTransfer.getData("text/plain");
              if (taskId) moveTask(taskId, status.id);
            }}
            className="flex min-h-[200px] w-72 flex-shrink-0 flex-col gap-2 rounded-lg border border-line bg-wash p-2.5"
            style={{ outline: dragOverStatusId === status.id ? "2px solid var(--color-heading)" : undefined, outlineOffset: -2 }}
          >
            <div
              className="flex items-center justify-between px-1.5 py-1 text-xs font-bold tracking-wide uppercase"
              style={{ background: status.fillHex, color: status.colorHex }}
            >
              <span>{status.name}</span>
              <span className="tabular-nums">{colTasks.length}</span>
            </div>
            {colTasks.map((t) => (
              <TaskCard key={t.id} task={t} onOpen={setOpenTaskId} />
            ))}
          </div>
        ))}
      </ScrollFade>

      <p className="mt-4 text-xs text-ink-muted">
        Glissez une carte vers une autre colonne pour changer son statut (ordinateur uniquement) — sur mobile, ouvrez
        la tâche pour changer son statut depuis la fiche.
      </p>

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          studios={studios}
          projects={projects}
          people={people}
          statuses={statuses}
          tasks={dependencyOptions}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}
