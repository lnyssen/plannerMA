"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MultiSelectField } from "@/components/ui/multi-select-field";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SearchField } from "@/components/ui/search-field";
import { StudioBadge } from "@/components/ui/studio-badge";
import { updateTaskStatus } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/data/people";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskListItem } from "@/lib/data/tasks";
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
          <strong className="font-bold text-ink">{task.project.client.name}</strong> — {task.project.name}
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
  statuses,
}: {
  tasks: TaskListItem[];
  studios: StudioSummary[];
  people: PersonSummary[];
  statuses: TaskStatusSummary[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [syncedInitial, setSyncedInitial] = useState(initialTasks);
  if (initialTasks !== syncedInitial) {
    setSyncedInitial(initialTasks);
    setTasks(initialTasks);
  }

  const [search, setSearch] = useState("");
  const [studioFilter, setStudioFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (studioFilter.length > 0 && !studioFilter.includes(t.studioId)) return false;
      if (personFilter.length > 0 && (!t.assigneeId || !personFilter.includes(t.assigneeId))) return false;
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
        <SearchField value={search} onChange={setSearch} className="max-w-md" />
        <MultiSelectField
          label="Tous les studios"
          selected={studioFilter}
          onChange={setStudioFilter}
          options={studios.map((s) => ({ id: s.id, label: s.name }))}
          className="max-w-[180px]"
        />
        <MultiSelectField
          label="Toutes les personnes"
          selected={personFilter}
          onChange={setPersonFilter}
          options={people.map((p) => ({ id: p.id, label: p.name }))}
          className="max-w-[200px]"
        />
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
              <TaskCard key={t.id} task={t} onOpen={(id) => router.push(`/taches/${id}`)} />
            ))}
          </div>
        ))}
      </ScrollFade>

      <p className="mt-4 text-xs text-ink-muted">
        Glissez une carte vers une autre colonne pour changer son statut (ordinateur uniquement) — sur mobile, ouvrez
        la tâche pour changer son statut depuis la fiche.
      </p>
    </div>
  );
}
