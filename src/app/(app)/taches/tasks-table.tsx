"use client";

import { AlertTriangle, MessageSquare, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MultiSelectField } from "@/components/ui/multi-select-field";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SearchField } from "@/components/ui/search-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskListItem } from "@/lib/data/tasks";
import { toIsoDate, today } from "@/lib/planning/dates";
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

type SortKey = "title" | "project" | "client" | "studio" | "person" | "dates" | "status";

// Ordre des colonnes : nomenclature Client — Projet — Tâche partout dans
// l'appli, du plus général au plus précis.
const ALL_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "client", label: "Client" },
  { key: "project", label: "Projet" },
  { key: "title", label: "Tâche" },
  { key: "studio", label: "Studio" },
  { key: "person", label: "Personne" },
  { key: "dates", label: "Dates" },
  { key: "status", label: "Statut" },
];

function formatRange(start: Date, end: Date) {
  const a = toIsoDate(start);
  const b = toIsoDate(end);
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  return a === b ? fmt(a) : `${fmt(a)} → ${fmt(b)}`;
}

export function TasksTable({
  tasks,
  studios,
  people,
  projects,
  statuses,
  hidePersonFilter = false,
  hidePersonColumn = false,
}: {
  tasks: TaskListItem[];
  studios: StudioSummary[];
  people: PersonSummary[];
  projects: ProjectOption[];
  statuses: TaskStatusSummary[];
  /** Vue "Mes tâches" : filtrer/afficher par personne n'a pas de sens quand tout appartient déjà à la même personne. */
  hidePersonFilter?: boolean;
  hidePersonColumn?: boolean;
}) {
  const router = useRouter();
  const columns = hidePersonColumn ? ALL_COLUMNS.filter((c) => c.key !== "person") : ALL_COLUMNS;
  const [search, setSearch] = useState("");
  const [studioFilter, setStudioFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("dates");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = tasks;
    if (q) {
      filtered = filtered.filter((t) =>
        [t.title, t.project?.name, t.project?.client.name, t.studio.name, t.assignee?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (studioFilter.length > 0) filtered = filtered.filter((t) => studioFilter.includes(t.studioId));
    if (personFilter.length > 0) filtered = filtered.filter((t) => t.assigneeId != null && personFilter.includes(t.assigneeId));
    if (statusFilter.length > 0) filtered = filtered.filter((t) => statusFilter.includes(t.statusId));
    if (projectFilter.length > 0) filtered = filtered.filter((t) => t.projectId != null && projectFilter.includes(t.projectId));

    const value = (t: TaskListItem): string | number => {
      switch (sortKey) {
        case "project":
          return t.project?.name ?? "";
        case "client":
          return t.project?.client.name ?? "";
        case "studio":
          return t.studio.name;
        case "person":
          return t.assignee?.name ?? "";
        case "dates":
          return t.startDate.getTime();
        case "status":
          return t.status.name;
        default:
          return t.title;
      }
    };

    const sorted = [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tasks, search, studioFilter, personFilter, statusFilter, projectFilter, sortKey, sortDir]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <SearchField value={search} onChange={setSearch} className="max-w-md" />
        {/* Même ordre que les colonnes du tableau ci-dessous : Projet (donc
            Client), puis Studio, Personne, Statut — du plus général au plus
            précis, cohérent avec la nomenclature Client — Projet partout
            ailleurs dans l'appli. */}
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
      </div>

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
                  <StudioBadge name={t.studio.name} fillHex={t.studio.fillHex} colorHex={t.studio.colorHex} />
                  {t.project && (
                    <span className="rounded-md px-1.5 py-0.5 text-2xs font-semibold text-ink-muted uppercase" style={{ background: "var(--color-wash)" }}>
                      {t.project.type === "INTERNAL" ? "Interne" : "Externe"}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                  {!hidePersonColumn && <span className="truncate">{t.assignee?.name ?? "Non attribué"}</span>}
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

          <ScrollFade className="hidden sm:block">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="cursor-pointer border-b-2 border-heading px-3 py-2.5 text-left font-[family-name:var(--font-display)] text-sm font-medium tracking-[-0.1px] whitespace-nowrap text-heading transition-colors duration-100 hover:bg-wash active:bg-tint"
                  >
                    {col.label} {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/taches/${t.id}`)}
                  className="cursor-pointer transition-colors duration-100 hover:bg-wash active:bg-tint"
                  title="Ouvrir la fiche"
                >
                  <td className="border-b border-line px-3 py-2.5 text-sm text-ink">
                    {t.project ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-heading">{t.project.client.name}</span>
                        <span className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-semibold text-ink-muted uppercase" style={{ background: "var(--color-wash)" }}>
                          {t.project.type === "INTERNAL" ? "Interne" : "Externe"}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-2.5 text-sm text-ink">{t.project?.name ?? "—"}</td>
                  <td className="border-b border-line px-3 py-2.5 text-sm font-semibold text-heading">
                    <span className="flex items-center gap-2">
                      {t.title}
                      <ActivityBadges comments={t._count.comments} attachments={t._count.attachments} />
                    </span>
                  </td>
                  <td className="border-b border-line px-3 py-2.5">
                    <StudioBadge name={t.studio.name} fillHex={t.studio.fillHex} colorHex={t.studio.colorHex} />
                  </td>
                  {!hidePersonColumn && (
                    <td className="border-b border-line px-3 py-2.5 text-sm text-ink">
                      {t.assignee?.name ?? "Non attribué"}
                    </td>
                  )}
                  <td
                    className="border-b border-line px-3 py-2.5 text-sm tabular-nums"
                    style={isTaskLate(t) ? { color: "var(--color-alert)", fontWeight: 600 } : { color: "var(--color-ink)" }}
                  >
                    <span className="flex items-center gap-1">
                      {isTaskLate(t) && <AlertTriangle size={12} className="flex-shrink-0" />}
                      {formatRange(t.startDate, t.endDate)}
                    </span>
                  </td>
                  <td className="border-b border-line px-3 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollFade>
        </>
      )}
    </div>
  );
}
