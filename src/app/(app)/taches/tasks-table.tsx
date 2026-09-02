"use client";

import { AlertTriangle, MessageSquare, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useMemo, useState, useTransition } from "react";
import { checkBulkReassignCapacity } from "@/lib/actions/capacity";
import { bulkUpdateTasks } from "@/lib/actions/tasks";
import { textButtonClass } from "@/components/ui/buttons";
import { ClientTypeBadge } from "@/components/ui/client-type-badge";
import { PersonLabel } from "@/components/ui/person-avatar";
import { MultiSelectField } from "@/components/ui/multi-select-field";
import { DataTable } from "@/components/ui/data-table";
import { SearchField } from "@/components/ui/search-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskListItem } from "@/lib/data/tasks";
import { formatShortFr, toIsoDate, today } from "@/lib/planning/dates";
import { EmptyState } from "@/components/ui/empty-state";

/** En retard : échéance dépassée, pas encore terminée — même règle que la puce de nav "Tâches" (voir (app)/layout.tsx). */
function isTaskLate(t: TaskListItem): boolean {
  return !t.status.isDone && toIsoDate(t.endDate) < today();
}

/** Indication rapide d'activité — n'affiche une puce que s'il y a quelque chose à voir, pour ne pas alourdir chaque ligne de zéros. */
function ActivityBadges({ comments, attachments }: { comments: number; attachments: number }) {
  if (comments === 0 && attachments === 0) return null;
  return (
    <span className="flex flex-shrink-0 items-center gap-2 text-ink-muted">
      {comments > 0 && (
        <span className="flex items-center gap-0.5 text-2xs tabular-nums" title={`${comments} commentaire${comments === 1 ? "" : "s"}`}>
          <MessageSquare size={11} className="flex-shrink-0" /> {comments}
        </span>
      )}
      {attachments > 0 && (
        <span className="flex items-center gap-0.5 text-2xs tabular-nums" title={`${attachments} pièce${attachments === 1 ? "" : "s"} jointe${attachments === 1 ? "" : "s"}`}>
          <Paperclip size={11} className="flex-shrink-0" /> {attachments}
        </span>
      )}
    </span>
  );
}


// Ordre des colonnes : nomenclature Client — Projet — Tâche partout dans
// l'appli, du plus général au plus précis.

/**
 * Plage de dates d'une tâche.
 *
 * « 09/07 → 10/07 » ne disait ni de quelle année il s'agissait, ni lequel des
 * deux nombres était l'échéance. L'année n'apparaît que lorsqu'elle sort de
 * l'année en cours — la répéter partout noierait l'information utile — et le
 * libellé de colonne porte désormais le sens des deux bornes.
 */
function formatRange(start: Date, end: Date) {
  const a = toIsoDate(start);
  const b = toIsoDate(end);
  const anneeCourante = today().slice(0, 4);
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return y === anneeCourante ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
  };
  return a === b ? fmt(a) : `${fmt(a)} → ${fmt(b)}`;
}

/** Échéance dépassée sur une tâche non terminée. */
function estEnRetard(t: { endDate: Date; status: { isDone: boolean } }) {
  return !t.status.isDone && toIsoDate(t.endDate) < today();
}

export function TasksTable({
  tasks,
  studios,
  people,
  projects,
  statuses,
  hidePersonFilter = false,
  initialProjectFilter = [],
  hidePersonColumn = false,
}: {
  tasks: TaskListItem[];
  studios: StudioSummary[];
  people: PersonSummary[];
  projects: ProjectOption[];
  statuses: TaskStatusSummary[];
  /** Vue "Mes tâches" : filtrer/afficher par personne n'a pas de sens quand tout appartient déjà à la même personne. */
  hidePersonFilter?: boolean;
  /** Filtre projet posé par l'URL — voir le compte de tâches cliquable dans la liste Projets. */
  initialProjectFilter?: string[];
  hidePersonColumn?: boolean;
}) {
  const router = useRouter();
  const ask = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [studioFilter, setStudioFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>(initialProjectFilter);
  // Filtre à part des quatre autres : ce n'est pas une valeur à choisir dans
  // une liste mais un état calculé, et c'est la question la plus fréquente
  // devant ce tableau — « qu'est-ce qui a débordé ? ».
  const [seulementRetard, setSeulementRetard] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPending, startBulkTransition] = useTransition();

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applyBulkStatus(newStatusId: string) {
    if (!newStatusId || selectedIds.length === 0) return;
    startBulkTransition(async () => {
      await bulkUpdateTasks({ taskIds: selectedIds, statusId: newStatusId });
      setSelectedIds([]);
      router.refresh();
    });
  }

  async function applyBulkAssignee(newAssigneeId: string) {
    if (!newAssigneeId || selectedIds.length === 0) return;

    // Réattribuer à "Non attribué" ne peut jamais surcharger personne — le
    // contrôle ne vaut la peine que pour une vraie personne. Comme le
    // formulaire (task-form-fields.tsx), un avertissement non bloquant,
    // juste confirmé ici plutôt qu'affiché en direct : pas de champ dates à
    // observer, l'action est immédiate au choix dans le menu.
    if (newAssigneeId !== "__none") {
      const selectedTasks = tasks.filter((t) => selectedIds.includes(t.id));
      const warning = await checkBulkReassignCapacity({
        personId: newAssigneeId,
        tasks: selectedTasks.map((t) => ({
          taskId: t.id,
          startDate: toIsoDate(t.startDate),
          endDate: toIsoDate(t.endDate),
          estimatedHalfDays: t.estimatedHalfDays,
        })),
      });
      if (warning) {
        const ok = await ask({
          title: "Cette attribution met la personne en surcharge",
          body: `${warning.personName} sera chargé·e à ${warning.ratioPercent}% la semaine du ${formatShortFr(warning.weekStart)} avec ces tâches incluses.`,
          confirmLabel: "Attribuer quand même",
        });
        if (!ok) return;
      }
    }

    startBulkTransition(async () => {
      const count = selectedIds.length;
      await bulkUpdateTasks({ taskIds: selectedIds, assigneeId: newAssigneeId === "__none" ? null : newAssigneeId });
      toast(`${count} tâche${count > 1 ? "s" : ""} réattribuée${count > 1 ? "s" : ""}.`);
      setSelectedIds([]);
      router.refresh();
    });
  }


  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = tasks;
    if (q) {
      filtered = filtered.filter((t) =>
        [t.title, t.project?.name, t.project?.client.name, ...t.studios.map((s) => s.studio.name), t.assignee?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (studioFilter.length > 0) filtered = filtered.filter((t) => t.studios.some((s) => studioFilter.includes(s.studioId)));
    if (personFilter.length > 0) filtered = filtered.filter((t) => t.assigneeId != null && personFilter.includes(t.assigneeId));
    if (statusFilter.length > 0) filtered = filtered.filter((t) => statusFilter.includes(t.statusId));
    if (projectFilter.length > 0) filtered = filtered.filter((t) => t.projectId != null && projectFilter.includes(t.projectId));
    if (seulementRetard) filtered = filtered.filter(estEnRetard);

    // Ordre par défaut : par date de début. Le tri par colonne appartient
    // désormais au tableau commun (DataTable), qui prend le relais dès qu'on
    // clique un en-tête.
    return [...filtered].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [tasks, search, studioFilter, personFilter, statusFilter, projectFilter, seulementRetard]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        {/* Même ordre que les colonnes du tableau ci-dessous : Projet (donc
            Client), puis Studio, Personne, Statut — du plus général au plus
            précis, cohérent avec la nomenclature Client — Projet partout
            ailleurs dans l'appli. Recherche en dernier : les filtres à choix
            (qui bornent la liste à un ensemble connu) avant le champ libre. */}
        {/* En tête des filtres : c'est la question la plus fréquente devant ce
            tableau, et elle ne se pose pas comme les autres — un état, pas une
            valeur à cocher dans une liste. */}
        <button
          type="button"
          onClick={() => setSeulementRetard((v) => !v)}
          aria-pressed={seulementRetard}
          title="N’afficher que les tâches dont l’échéance est dépassée"
          className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-sm font-semibold transition-colors duration-100"
          style={
            seulementRetard
              ? { background: "var(--color-alert)", borderColor: "var(--color-alert)", color: "#FFFFFF" }
              : { borderColor: "var(--color-alert)", color: "var(--color-alert)" }
          }
        >
          <AlertTriangle size={14} aria-hidden="true" />
          En retard
          <span className="tabular-nums">{tasks.filter(estEnRetard).length}</span>
        </button>

        <MultiSelectField
          label="Tous les projets"
          selected={projectFilter}
          onChange={setProjectFilter}
          options={projects.map((p) => ({ id: p.id, label: `${p.client.name} — ${p.name}` }))}
          className="max-w-[220px]"
        />
        <MultiSelectField
          label="Tous les studios"
          selected={studioFilter}
          onChange={setStudioFilter}
          options={studios.map((s) => ({ id: s.id, label: s.name }))}
          className="max-w-[180px]"
        />
        {!hidePersonFilter && (
          <MultiSelectField
            label="Toutes les personnes"
            selected={personFilter}
            onChange={setPersonFilter}
            options={people.map((p) => ({ id: p.id, label: p.name }))}
            className="max-w-[200px]"
          />
        )}
        <MultiSelectField
          label="Tous les statuts"
          selected={statusFilter}
          onChange={setStatusFilter}
          options={statuses.map((s) => ({ id: s.id, label: s.name }))}
          className="max-w-[180px]"
        />
        <span className="flex-1" />
        <SearchField value={search} onChange={setSearch} className="max-w-md" />
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-heading bg-wash px-3 py-2">
          <span className="text-sm font-semibold text-heading">
            {selectedIds.length} tâche{selectedIds.length > 1 ? "s" : ""} sélectionnée{selectedIds.length > 1 ? "s" : ""}
          </span>
          <select
            defaultValue=""
            disabled={bulkPending}
            onChange={(e) => applyBulkStatus(e.target.value)}
            aria-label="Changer le statut des tâches sélectionnées"
            className="h-10 rounded-md border-[1.5px] border-heading px-2.5 text-sm text-ink disabled:opacity-60"
          >
            <option value="" disabled>
              Changer le statut…
            </option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            disabled={bulkPending}
            onChange={(e) => applyBulkAssignee(e.target.value)}
            aria-label="Changer la personne des tâches sélectionnées"
            className="h-10 rounded-md border-[1.5px] border-heading px-2.5 text-sm text-ink disabled:opacity-60"
          >
            <option value="" disabled>
              Changer la personne…
            </option>
            <option value="__none">Non attribué</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className={`flex items-center gap-1 text-sm font-semibold text-ink-muted ${textButtonClass}`}
          >
            <X size={14} /> Désélectionner
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Aucune tâche ne correspond" description="Essayez une autre recherche." />
      ) : (
        <>
          {/* Sous sm : cartes empilées plutôt qu'un tableau qui déborde —
              7 colonnes ne tiennent pas sur un écran de téléphone, et le
              texte qui s'enroule dans des cellules trop étroites est
              illisible. Le tableau réapparaît dès qu'il y a la place. */}
          <div className="flex flex-col gap-2 sm:hidden">
            {rows.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => router.push(`/taches/${t.id}`)}
                className="rounded-lg border border-line p-3 text-left transition-colors duration-100 hover:border-heading active:bg-wash"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-heading">{t.title}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mb-2 text-xs text-ink-muted">
                  {t.project ? (
                    <>
                      <strong className="font-bold text-ink">{t.project.client.name}</strong> — {t.project.name}
                    </>
                  ) : (
                    "Sans projet"
                  )}
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {t.studios.map(({ studio }) => (
                    <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
                  ))}
                  {t.project && <ClientTypeBadge type={t.project.client.type} />}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                  {!hidePersonColumn && <PersonLabel name={t.assignee?.name ?? null} />}
                  <span className="flex flex-shrink-0 items-center gap-2">
                    <span
                      className="flex items-center gap-1 tabular-nums"
                      style={isTaskLate(t) ? { color: "var(--color-alert)", fontWeight: 600 } : undefined}
                    >
                      {isTaskLate(t) && <AlertTriangle size={11} className="flex-shrink-0" />}
                      {formatRange(t.startDate, t.endDate)}
                    </span>
                    <ActivityBadges comments={t._count.comments} attachments={t._count.attachments} />
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden sm:block">
            <DataTable
              rows={rows}
              getRowId={(t) => t.id}
              onRowClick={(t) => router.push(`/taches/${t.id}`)}
              storageKey={`planning-studios:colonnes:taches${hidePersonColumn ? ":mes" : ""}`}
              leadingHead={
                <input
                  type="checkbox"
                  aria-label="Sélectionner toutes les tâches affichées"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={(e) => setSelectedIds(e.target.checked ? rows.map((t) => t.id) : [])}
                  className="h-4 w-4 accent-heading"
                />
              }
              leadingCell={(t) => (
                <input
                  type="checkbox"
                  aria-label={`Sélectionner « ${t.title} »`}
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggleSelected(t.id)}
                  className="h-4 w-4 accent-heading"
                />
              )}
              columns={[
                {
                  key: "client",
                  label: "Client",
                  sortValue: (t) => t.project?.client.name ?? "",
                  render: (t) =>
                    t.project ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-heading">{t.project.client.name}</span>
                        <ClientTypeBadge type={t.project.client.type} className="flex-shrink-0" />
                      </div>
                    ) : (
                      "—"
                    ),
                },
                { key: "project", label: "Projet", sortValue: (t) => t.project?.name ?? "", render: (t) => t.project?.name ?? "—" },
                {
                  key: "title",
                  label: "Tâche",
                  required: true,
                  sortValue: (t) => t.title,
                  cellClassName: "font-semibold text-heading",
                  render: (t) => (
                    <span className="flex items-center gap-2">
                      {t.title}
                      <ActivityBadges comments={t._count.comments} attachments={t._count.attachments} />
                    </span>
                  ),
                },
                {
                  key: "studio",
                  label: "Studio",
                  sortValue: (t) => t.studios.map((s) => s.studio.name).sort().join(", "),
                  render: (t) => (
                    <div className="flex flex-wrap items-center gap-1">
                      {t.studios.map(({ studio }) => (
                        <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
                      ))}
                    </div>
                  ),
                },
                ...(hidePersonColumn
                  ? []
                  : [
                      {
                        key: "person",
                        label: "Personne",
                        sortValue: (t: TaskListItem) => t.assignee?.name ?? "",
                        render: (t: TaskListItem) => <PersonLabel name={t.assignee?.name ?? null} />,
                      },
                    ]),
                {
                  key: "dates",
                  label: "Début → Échéance",
                  sortValue: (t) => toIsoDate(t.startDate),
                  cellClassName: "tabular-nums",
                  render: (t) => (
                    <span
                      className="flex items-center gap-1"
                      style={isTaskLate(t) ? { color: "var(--color-alert)", fontWeight: 600 } : undefined}
                    >
                      {isTaskLate(t) && <AlertTriangle size={12} className="flex-shrink-0" />}
                      {formatRange(t.startDate, t.endDate)}
                    </span>
                  ),
                },
                { key: "status", label: "Statut", sortValue: (t) => t.status.name, render: (t) => <StatusBadge status={t.status} /> },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
