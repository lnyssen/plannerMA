"use client";

import { AlertTriangle, Flag } from "lucide-react";
import { useMemo, useState } from "react";
import { EditProjectModal } from "@/components/modals/edit-project-modal";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { ClientSummary } from "@/lib/data/clients";
import type { ProjectWithCounts } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import { formatShortFr, toIsoDate, today } from "@/lib/planning/dates";
import { taskProgress } from "@/lib/planning/tasks";

function averageProgress(project: ProjectWithCounts, allStatuses: TaskStatusSummary[]): number {
  if (project.tasks.length === 0) return 0;
  const total = project.tasks.reduce((sum, t) => sum + taskProgress(t.status, allStatuses, []), 0);
  return total / project.tasks.length;
}

/**
 * Santé des jalons d'un projet : le prochain jalon à venir (le plus proche,
 * non atteint) et le nombre de jalons en retard (non atteints, échéance
 * dépassée) — sert à trier le portefeuille par urgence plutôt qu'ordre
 * alphabétique, et à afficher un repère visuel direct sans ouvrir chaque
 * projet.
 */
function milestoneHealth(project: ProjectWithCounts, referenceDate: string) {
  const pending = project.milestones.filter((m) => !m.isDone);
  const overdue = pending.filter((m) => toIsoDate(m.dueDate) < referenceDate);
  const next = pending.find((m) => toIsoDate(m.dueDate) >= referenceDate) ?? null;
  return { overdueCount: overdue.length, next };
}

export function PortfolioView({
  projects,
  studios,
  clients,
  statuses,
}: {
  projects: ProjectWithCounts[];
  studios: StudioSummary[];
  clients: ClientSummary[];
  statuses: TaskStatusSummary[];
}) {
  const [studioFilter, setStudioFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const referenceDate = useMemo(() => today(), []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => !studioFilter || p.studios.some((s) => s.studioId === studioFilter))
      .filter((p) => !q || `${p.name} ${p.client.name}`.toLowerCase().includes(q))
      .map((project) => ({
        project,
        progress: averageProgress(project, statuses),
        ...milestoneHealth(project, referenceDate),
      }))
      // Les projets avec des jalons en retard remontent en premier, puis les
      // moins avancés — le portefeuille sert à repérer ce qui a besoin
      // d'attention, pas à parcourir une liste triée alphabétiquement.
      .sort((a, b) => b.overdueCount - a.overdueCount || a.progress - b.progress);
  }, [projects, studioFilter, search, statuses, referenceDate]);

  const totalOverdue = rows.reduce((sum, r) => sum + r.overdueCount, 0);

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Portefeuille
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
        <div className="border border-line p-3">
          <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Projets actifs</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-heading">{projects.length}</p>
        </div>
        <div className="border border-line p-3">
          <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Jalons en retard</p>
          <p
            className="font-[family-name:var(--font-display)] text-2xl font-semibold"
            style={{ color: totalOverdue > 0 ? "var(--color-alert)" : "var(--color-heading)" }}
          >
            {totalOverdue}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border-[1.5px] border-heading px-3 py-2.5 text-sm text-ink outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStudioFilter(null)}
            className="px-2.5 py-1 text-xs font-semibold"
            style={{
              border: `1.5px solid ${studioFilter === null ? "var(--color-heading)" : "var(--color-line)"}`,
              color: studioFilter === null ? "var(--color-heading)" : "var(--color-ink-muted)",
            }}
          >
            Tous les studios
          </button>
          {studios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStudioFilter(studioFilter === s.id ? null : s.id)}
              className="px-2.5 py-1 text-xs font-semibold"
              style={{
                border: `1.5px solid ${studioFilter === s.id ? s.colorHex : "var(--color-line)"}`,
                color: studioFilter === s.id ? s.colorHex : "var(--color-ink-muted)",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun projet ne correspond.</p>
      ) : (
        <ScrollFade>
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[220px] bg-paper px-3 py-2 text-left text-xs font-semibold text-ink-muted uppercase">
                  Projet
                </th>
                <th className="min-w-[160px] px-3 py-2 text-left text-xs font-semibold text-ink-muted uppercase">
                  Studios
                </th>
                <th className="min-w-[140px] px-3 py-2 text-left text-xs font-semibold text-ink-muted uppercase">
                  Avancement
                </th>
                <th className="min-w-[90px] px-3 py-2 text-center text-xs font-semibold text-ink-muted uppercase">
                  Tâches
                </th>
                <th className="min-w-[200px] px-3 py-2 text-left text-xs font-semibold text-ink-muted uppercase">
                  Prochain jalon
                </th>
                <th className="min-w-[90px] px-3 py-2 text-center text-xs font-semibold text-ink-muted uppercase">
                  En retard
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, progress, next, overdueCount }) => (
                <tr key={project.id} className="border-t border-line">
                  <td className="sticky left-0 z-10 bg-paper px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenProjectId(project.id)}
                      className="text-left text-sm font-bold text-rail underline-offset-2 hover:underline"
                    >
                      {project.name}
                    </button>
                    <div className="text-xs text-ink-muted">{project.client.name}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {project.studios.map(({ studio }) => (
                        <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 flex-shrink-0 bg-line">
                        <div className="h-full bg-heading" style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                      <span className="text-2xs tabular-nums text-ink-muted">{Math.round(progress * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-sm tabular-nums text-ink">{project._count.tasks}</td>
                  <td className="px-3 py-2.5 text-sm text-ink">
                    {next ? (
                      <span className="flex items-center gap-1.5">
                        <Flag size={12} className="flex-shrink-0 text-ink-muted" aria-hidden="true" />
                        {next.title}
                        <span className="text-2xs text-ink-muted tabular-nums">— {formatShortFr(toIsoDate(next.dueDate))}</span>
                      </span>
                    ) : (
                      <span className="text-ink-muted">Aucun jalon à venir</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {overdueCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 text-sm font-semibold"
                        style={{ color: "var(--color-alert)" }}
                        title={`${overdueCount} jalon${overdueCount === 1 ? "" : "s"} en retard`}
                      >
                        <AlertTriangle size={13} /> {overdueCount}
                      </span>
                    ) : (
                      <span className="text-sm text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollFade>
      )}

      {openProjectId && (
        <EditProjectModal
          projectId={openProjectId}
          studios={studios}
          clients={clients}
          onClose={() => setOpenProjectId(null)}
        />
      )}
    </div>
  );
}
