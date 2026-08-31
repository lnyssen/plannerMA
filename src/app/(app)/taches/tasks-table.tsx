"use client";

import { useMemo, useState } from "react";
import { TaskDetailModal } from "@/components/modals/task-detail-modal";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { StatusBadge } from "@/components/ui/status-badge";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskListItem, TaskOption } from "@/lib/data/tasks";
import { toIsoDate } from "@/lib/planning/dates";

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
  dependencyOptions = [],
  hidePersonFilter = false,
  hidePersonColumn = false,
  initialOpenTaskId = null,
}: {
  tasks: TaskListItem[];
  studios: StudioSummary[];
  people: PersonSummary[];
  projects: ProjectOption[];
  statuses: TaskStatusSummary[];
  dependencyOptions?: TaskOption[];
  /** Vue "Mes tâches" : filtrer/afficher par personne n'a pas de sens quand tout appartient déjà à la même personne. */
  hidePersonFilter?: boolean;
  hidePersonColumn?: boolean;
  initialOpenTaskId?: string | null;
}) {
  const columns = hidePersonColumn ? ALL_COLUMNS.filter((c) => c.key !== "person") : ALL_COLUMNS;
  const [search, setSearch] = useState("");
  const [studioFilter, setStudioFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dates");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialOpenTaskId);

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
    if (studioFilter) filtered = filtered.filter((t) => t.studioId === studioFilter);
    if (personFilter) filtered = filtered.filter((t) => t.assigneeId === personFilter);

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
  }, [tasks, search, studioFilter, personFilter, sortKey, sortDir]);

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
        {!hidePersonFilter && (
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
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-line p-16 text-center">
          <p className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-heading">
            Aucune tâche ne correspond
          </p>
          <p className="text-sm text-ink">Essayez une autre recherche.</p>
        </div>
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
                onClick={() => setOpenTaskId(t.id)}
                className="rounded-lg border border-line p-3 text-left transition-colors duration-100 hover:border-heading active:bg-wash"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-heading">{t.title}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mb-2 text-xs text-ink-muted">
                  {t.project ? (
                    <>
                      {t.project.client.name} — {t.project.name}
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
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  {!hidePersonColumn && <span>{t.assignee?.name ?? "Non attribué"}</span>}
                  <span className="tabular-nums">{formatRange(t.startDate, t.endDate)}</span>
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
                  onClick={() => setOpenTaskId(t.id)}
                  className="cursor-pointer transition-colors duration-100 hover:bg-wash active:bg-tint"
                  title="Ouvrir la fiche"
                >
                  <td className="border-b border-line px-3 py-2.5 text-sm text-ink">
                    {t.project ? (
                      <div className="flex items-center gap-1.5">
                        <span>{t.project.client.name}</span>
                        <span className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-semibold text-ink-muted uppercase" style={{ background: "var(--color-wash)" }}>
                          {t.project.type === "INTERNAL" ? "Interne" : "Externe"}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-2.5 text-sm text-ink">{t.project?.name ?? "—"}</td>
                  <td className="border-b border-line px-3 py-2.5 text-sm font-semibold text-heading">{t.title}</td>
                  <td className="border-b border-line px-3 py-2.5">
                    <StudioBadge name={t.studio.name} fillHex={t.studio.fillHex} colorHex={t.studio.colorHex} />
                  </td>
                  {!hidePersonColumn && (
                    <td className="border-b border-line px-3 py-2.5 text-sm text-ink">
                      {t.assignee?.name ?? "Non attribué"}
                    </td>
                  )}
                  <td className="border-b border-line px-3 py-2.5 text-sm text-ink tabular-nums">
                    {formatRange(t.startDate, t.endDate)}
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
