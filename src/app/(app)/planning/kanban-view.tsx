"use client";

import { GripVertical, MoveRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MultiSelectField } from "@/components/ui/multi-select-field";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SearchField } from "@/components/ui/search-field";
import { StudioBadge } from "@/components/ui/studio-badge";
import { PersonLabel } from "@/components/ui/person-avatar";
import { useCreateModals } from "@/components/shell/create-modals-context";
import { useCardDrag } from "@/components/planning/use-card-drag";
import { updateTaskStatus } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/data/people";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskListItem } from "@/lib/data/tasks";
import { formatShortFr, toIsoDate } from "@/lib/planning/dates";

function TaskCard({
  task,
  onOpen,
  onGrab,
  onMove,
  statuses,
  dragging,
}: {
  task: TaskListItem;
  onOpen: (id: string) => void;
  onGrab: (e: React.PointerEvent) => void;
  onMove: (statusId: string) => void;
  statuses: TaskStatusSummary[];
  dragging: boolean;
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  return (
    <div
      onClick={() => onOpen(task.id)}
      style={{ opacity: dragging ? 0.4 : 1 }}
      className="relative cursor-pointer rounded-lg border border-line bg-paper p-2.5 pr-7 text-left transition-colors duration-100 hover:border-heading"
    >
      {/* Grand écran : poignée de glissement. Seule elle coupe le défilement
          tactile, si bien que la colonne continue de défiler au doigt et
          qu'un appui sur la carte ouvre la tâche. */}
      <button
        type="button"
        aria-label={`Déplacer ${task.title}`}
        title="Glisser vers une autre colonne"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation();
          onGrab(e);
        }}
        className="absolute top-1.5 right-1 hidden h-6 w-5 cursor-grab touch-none items-center justify-center rounded text-ink-muted transition-colors duration-100 hover:text-heading active:cursor-grabbing sm:flex"
      >
        <GripVertical size={14} />
      </button>

      {/* Téléphone : le glisser n'a pas de sens ici — il faudrait traîner la
          carte jusqu'en haut de l'écran à travers une liste qui défile. Un
          menu tapable fait le même travail, sûrement, et permet aussi de
          reculer d'un statut, ce que le glisser vers l'avant ne donnait pas. */}
      <button
        type="button"
        aria-label={`Changer le statut de ${task.title}`}
        aria-expanded={menuOuvert}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOuvert((v) => !v);
        }}
        className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full text-ink-muted sm:hidden"
      >
        <MoveRight size={15} />
      </button>
      {menuOuvert && (
        <div
          className="absolute top-8 right-1 z-20 w-44 overflow-hidden rounded-lg border-[1.5px] border-heading bg-paper shadow-lg sm:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-2.5 pt-2 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Déplacer vers</p>
          {statuses.map((st) => (
            <button
              key={st.id}
              type="button"
              disabled={st.id === task.statusId}
              onClick={() => {
                setMenuOuvert(false);
                onMove(st.id);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-ink disabled:opacity-40"
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: st.fillHex, outline: `1.5px solid ${st.colorHex}` }}
              />
              {st.name}
            </button>
          ))}
        </div>
      )}
      <p className="mb-1.5 text-sm font-bold text-heading">{task.title}</p>
      {task.project && (
        <p className="mb-1.5 truncate text-2xs text-ink-muted">
          <strong className="font-bold text-ink">{task.project.client.name}</strong> — {task.project.name}
        </p>
      )}
      <div className="mb-1.5 flex flex-wrap gap-1">
        {task.studios.map(({ studio }) => (
          <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
        ))}
      </div>
      <div className="flex items-center justify-between text-2xs text-ink-muted">
        <PersonLabel name={task.assignee?.name ?? null} />
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
  const openCreate = useCreateModals();
  const [tasks, setTasks] = useState(initialTasks);
  const [syncedInitial, setSyncedInitial] = useState(initialTasks);
  if (initialTasks !== syncedInitial) {
    setSyncedInitial(initialTasks);
    setTasks(initialTasks);
  }

  const [search, setSearch] = useState("");
  // Sur téléphone, un tableau à colonnes fixes de 288 px n'en laisse voir
  // qu'une seule : il fallait faire défiler toutes les cartes d'une colonne
  // avant de pouvoir glisser vers la suivante. On y montre donc une colonne
  // à la fois, choisie dans une rangée de pastilles.
  const [colonneMobile, setColonneMobile] = useState<string | null>(null);
  const [studioFilter, setStudioFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (studioFilter.length > 0 && !t.studios.some((s) => studioFilter.includes(s.studioId))) return false;
      if (personFilter.length > 0 && (!t.assigneeId || !personFilter.includes(t.assigneeId))) return false;
      if (!q) return true;
      return [t.title, t.project?.name, ...t.studios.map((s) => s.studio.name), t.assignee?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
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

  // Déclaré après moveTask : le glissement s'appuie dessus.
  const cardDrag = useCardDrag((taskId, statusId) => moveTask(taskId, statusId));

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
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
        <span className="flex-1" />
        <SearchField value={search} onChange={setSearch} placeholder="Filtrer ces tâches…" className="max-w-md" />
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
      {/* Rangée de choix de colonne — téléphone uniquement. */}
      <div className="mb-3 flex flex-wrap gap-1.5 sm:hidden">
        {columns.map(({ status, tasks: colTasks }) => {
          const actif = (colonneMobile ?? columns[0]?.status.id) === status.id;
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => setColonneMobile(status.id)}
              aria-pressed={actif}
              // La pastille est aussi une zone de dépôt : une seule colonne
              // étant visible sur téléphone, le glisser n'aurait sinon aucune
              // cible et la tâche ne pourrait plus changer de statut au doigt.
              {...cardDrag.zoneAttrs(status.id)}
              className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold whitespace-nowrap"
              style={
                cardDrag.drag?.over === status.id
                  ? { background: status.fillHex, color: status.colorHex, outline: "2px solid var(--color-heading)" }
                  : actif
                    ? { background: status.fillHex, color: status.colorHex, outline: `1.5px solid ${status.colorHex}` }
                    : { background: "var(--color-wash)", color: "var(--color-ink-muted)" }
              }
            >
              {status.name}
              <span className="tabular-nums">{colTasks.length}</span>
            </button>
          );
        })}
      </div>

      <ScrollFade className="flex gap-4 pb-2">
        {columns.map(({ status, tasks: colTasks }) => (
          <div
            key={status.id}
            {...cardDrag.zoneAttrs(status.id)}
            className={`min-h-[200px] w-full flex-col gap-2 p-0 sm:flex sm:w-72 sm:flex-shrink-0 sm:rounded-lg sm:border sm:border-line sm:bg-wash sm:p-2.5 ${
              (colonneMobile ?? columns[0]?.status.id) === status.id ? "flex" : "hidden"
            }`}
            style={{ outline: cardDrag.drag?.over === status.id ? "2px solid var(--color-heading)" : undefined, outlineOffset: -2 }}
          >
            <div
              className="hidden items-center justify-between px-1.5 py-1 text-xs font-bold tracking-wide uppercase sm:flex"
              style={{ background: status.fillHex, color: status.colorHex }}
            >
              <span>{status.name}</span>
              <span className="tabular-nums">{colTasks.length}</span>
            </div>
            {colTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                statuses={statuses}
                dragging={cardDrag.drag?.id === t.id}
                onGrab={(e) => cardDrag.start(t.id, t.title, e)}
                onMove={(statusId) => moveTask(t.id, statusId)}
                onOpen={(id) => router.push(`/taches/${id}`)}
              />
            ))}
            {/* Le Kanban savait déplacer une tâche d'une colonne à l'autre
                mais pas en créer : il fallait passer par le bouton global
                puis rouvrir la fiche pour poser le bon statut. Ici la
                colonne le désigne déjà. */}
            <button
              type="button"
              onClick={() => openCreate("task", { statusId: status.id })}
              className="order-first flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-xs font-semibold text-ink-muted transition-colors duration-100 hover:border-heading hover:text-heading sm:order-last sm:mt-auto"
            >
              <Plus size={14} aria-hidden="true" /> Nouvelle tâche
            </button>
          </div>
        ))}
      </ScrollFade>

      {cardDrag.drag && (
        <div
          aria-hidden="true"
          style={{ top: cardDrag.drag.y + 12, left: cardDrag.drag.x + 12 }}
          className="pointer-events-none fixed z-50 max-w-[16rem] truncate rounded-lg border-[1.5px] border-heading bg-paper px-2.5 py-1.5 text-sm font-bold text-heading shadow-lg"
        >
          {cardDrag.drag.label}
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Attrapez la poignée d’une carte et glissez-la vers une autre colonne pour changer son statut — à la souris
        comme au doigt. Un appui sur la carte ouvre la tâche.
      </p>
    </div>
  );
}
