"use client";

import { AlertTriangle, Archive, Flag, LayoutGrid, MessageSquare, Paperclip, Table2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { secondaryButtonClass } from "@/components/ui/buttons";
import { CreateButton } from "@/components/shell/create-button";
import { ClientTypeBadge } from "@/components/ui/client-type-badge";
import { DataTable } from "@/components/ui/data-table";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { ProjectWithCounts } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import { formatShortFr, toIsoDate, today } from "@/lib/planning/dates";
import { taskProgress } from "@/lib/planning/tasks";
import { formatDurationFr, sumDurationMinutes } from "@/lib/planning/time";

const PROJECT_VIEWS: SegmentedOption<"cards" | "table">[] = [
  { id: "table", label: "Tableau", icon: Table2 },
  { id: "cards", label: "Cartes", icon: LayoutGrid },
];

const VIEW_STORAGE_KEY = "planning-studios:projets-view";

function averageProgress(project: ProjectWithCounts, allStatuses: TaskStatusSummary[]): number {
  if (project.tasks.length === 0) return 0;
  const total = project.tasks.reduce((sum, t) => sum + taskProgress(t.status, allStatuses, []), 0);
  return total / project.tasks.length;
}

/**
 * Santé des jalons d'un projet : le prochain jalon à venir (le plus proche,
 * non atteint) et le nombre de jalons en retard (non atteints, échéance
 * dépassée) — sert à trier la vue Tableau par urgence plutôt qu'ordre
 * alphabétique, et à afficher un repère visuel direct sans ouvrir chaque
 * projet.
 */
function milestoneHealth(project: ProjectWithCounts, referenceDate: string) {
  const pending = project.milestones.filter((m) => !m.isDone);
  const overdue = pending.filter((m) => toIsoDate(m.dueDate) < referenceDate);
  const next = pending.find((m) => toIsoDate(m.dueDate) >= referenceDate) ?? null;
  return { overdueCount: overdue.length, next };
}

/**
 * Temps enregistré vs. budgété — même règle que checkAndNotifyBudget
 * (src/lib/actions/time-entries.ts) : total des écritures liées directement
 * au projet + celles de ses tâches. `budgetMinutes` reste `null` sans budget
 * défini (rien à comparer).
 */
function projectHours(project: ProjectWithCounts): { loggedMinutes: number; budgetMinutes: number | null } {
  const loggedMinutes = sumDurationMinutes([...project.timeEntries, ...project.tasks.flatMap((t) => t.timeEntries)]);
  return { loggedMinutes, budgetMinutes: project.budgetHours != null ? project.budgetHours * 60 : null };
}

function projectOverBudget(project: ProjectWithCounts): boolean {
  const { loggedMinutes, budgetMinutes } = projectHours(project);
  return budgetMinutes != null && loggedMinutes > budgetMinutes;
}

/** Commentaires/pièces jointes vivent au niveau tâche (voir schema.prisma) — un projet agrège celles de ses tâches actives. */
function projectActivity(project: ProjectWithCounts): { comments: number; attachments: number } {
  return project.tasks.reduce(
    (sum, t) => ({ comments: sum.comments + t._count.comments, attachments: sum.attachments + t._count.attachments }),
    { comments: 0, attachments: 0 },
  );
}

function ProjectCard({
  project,
  statuses,
  onOpen,
}: {
  project: ProjectWithCounts;
  statuses: TaskStatusSummary[];
  onOpen: (id: string) => void;
}) {
  const count = project._count.tasks;
  const progress = averageProgress(project, statuses);
  const { loggedMinutes, budgetMinutes } = projectHours(project);
  const overBudget = budgetMinutes != null && loggedMinutes > budgetMinutes;
  const activity = projectActivity(project);

  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className="rounded-lg border border-line p-4 text-left transition-colors duration-100 hover:border-heading active:bg-wash"
      title="Modifier le projet"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="font-[family-name:var(--font-body)] text-base font-bold text-heading">{project.name}</div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {overBudget && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold uppercase"
              style={{ background: "var(--color-alert-wash)", color: "var(--color-alert)" }}
              title="Temps dépassé"
            >
              <AlertTriangle size={11} /> Budget
            </span>
          )}
          <ClientTypeBadge type={project.type} />
        </div>
      </div>
      <div className="mb-3 text-sm text-ink">{project.client.name}</div>
      {project.studios.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {project.studios.map(({ studio }) => (
            <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
          ))}
        </div>
      )}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-line">
          <div className="h-full bg-heading" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span
          className="flex-shrink-0 text-2xs tabular-nums"
          style={{ color: overBudget ? "var(--color-alert)" : "var(--color-ink-muted)" }}
        >
          {Math.round(progress * 100)}%
          {budgetMinutes != null && ` · ${formatDurationFr(loggedMinutes)} / ${formatDurationFr(budgetMinutes)}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-ink">
          {count} tâche{count === 1 ? "" : "s"}
        </div>
        {(activity.comments > 0 || activity.attachments > 0) && (
          <div className="flex flex-shrink-0 items-center gap-2 text-ink-muted">
            {activity.comments > 0 && (
              <span className="flex items-center gap-0.5 text-2xs tabular-nums" title={`${activity.comments} commentaire${activity.comments === 1 ? "" : "s"}`}>
                <MessageSquare size={11} /> {activity.comments}
              </span>
            )}
            {activity.attachments > 0 && (
              <span className="flex items-center gap-0.5 text-2xs tabular-nums" title={`${activity.attachments} pièce${activity.attachments === 1 ? "" : "s"} jointe${activity.attachments === 1 ? "" : "s"}`}>
                <Paperclip size={11} /> {activity.attachments}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function ProjectGroup({
  title,
  projects,
  statuses,
  onOpen,
}: {
  title: string;
  projects: ProjectWithCounts[];
  statuses: TaskStatusSummary[];
  onOpen: (id: string) => void;
}) {
  if (projects.length === 0) return null;
  return (
    <section className="mb-10">
      <p className="mb-3 font-[family-name:var(--font-display)] text-sm font-medium tracking-[-0.1px] text-heading">
        {title}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} statuses={statuses} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export function ProjectsView({
  projects,
  studios,
  statuses,
  showArchived,
}: {
  projects: ProjectWithCounts[];
  studios: StudioSummary[];
  statuses: TaskStatusSummary[];
  showArchived: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [studioFilter, setStudioFilter] = useState<string | null>(null);
  // "Cartes" par défaut au premier rendu (identique serveur/client, évite un
  // hydration mismatch) ; le dernier choix de l'utilisateur est relu depuis
  // localStorage juste après le montage — préférence par appareil, pas une
  // donnée à synchroniser entre utilisateurs.
  const [view, setView] = useState<"cards" | "table">("table");
  const referenceDate = useMemo(() => today(), []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      // localStorage n'existe pas côté serveur : ce rendu post-montage est le
      // seul moment où le lire est possible, d'où le setState direct ici
      // plutôt qu'un calcul pendant le rendu (qui casserait l'hydratation).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "cards" || stored === "table") setView(stored);
    } catch {
      // localStorage indisponible (navigation privée, etc.) — reste sur "table".
    }
  }, []);

  function changeView(next: "cards" | "table") {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Rien à faire : la préférence ne survivra juste pas à cette session.
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => !q || `${p.name} ${p.client.name}`.toLowerCase().includes(q))
      .filter((p) => view !== "table" || !studioFilter || p.studios.some((s) => s.studioId === studioFilter));
  }, [projects, search, studioFilter, view]);

  const internal = filtered.filter((p) => p.type === "INTERNAL");
  const external = filtered.filter((p) => p.type === "EXTERNAL");

  const rows = useMemo(
    () =>
      filtered
        .map((project) => ({
          project,
          progress: averageProgress(project, statuses),
          overBudget: projectOverBudget(project),
          ...milestoneHealth(project, referenceDate),
        }))
        // Les projets avec des jalons en retard remontent en premier, puis
        // les moins avancés — la vue Tableau sert à repérer ce qui a besoin
        // d'attention, pas à parcourir une liste triée alphabétiquement.
        .sort((a, b) => b.overdueCount - a.overdueCount || a.progress - b.progress),
    [filtered, statuses, referenceDate],
  );
  const totalOverdue = rows.reduce((sum, r) => sum + r.overdueCount, 0);

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Projets
        </h1>
        <SegmentedControl ariaLabel="Présentation" size="sm" value={view} onChange={changeView} options={PROJECT_VIEWS} />
        <span className="flex-1" />
        <Link
          href={showArchived ? "/projets" : "/projets?archives=1"}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
        >
          <Archive size={14} /> {showArchived ? "Projets actifs" : "Archives"}
        </Link>
        <CreateButton kind="project" />
      </div>

      {view === "table" && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
          <div className="rounded-lg border border-line p-3">
            <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Projets affichés</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-heading">{rows.length}</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Jalons en retard</p>
            <p
              className="font-[family-name:var(--font-display)] text-2xl font-semibold"
              style={{ color: totalOverdue > 0 ? "var(--color-alert)" : "var(--color-heading)" }}
            >
              {totalOverdue}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {view === "table" && (
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
        )}
        <span className="flex-1" />
        <SearchField value={search} onChange={setSearch} className="max-w-md" />
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {showArchived
            ? "Aucun projet archivé."
            : "Aucun projet. Utilisez « Nouveau projet » ci-dessus pour commencer."}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-line p-16 text-center">
          <p className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-heading">
            Aucun projet ne correspond
          </p>
          <p className="text-sm text-ink">Essayez une autre recherche.</p>
        </div>
      ) : view === "cards" ? (
        <>
          <ProjectGroup title="Clients internes" projects={internal} statuses={statuses} onOpen={(id) => router.push(`/projets/${id}`)} />
          <ProjectGroup title="Clients externes" projects={external} statuses={statuses} onOpen={(id) => router.push(`/projets/${id}`)} />
        </>
      ) : (
        <DataTable
          rows={rows}
          getRowId={(r) => r.project.id}
          onRowClick={(r) => router.push(`/projets/${r.project.id}`)}
          storageKey="planning-studios:colonnes:projets"
          columns={[
            {
              key: "projet",
              label: "Projet",
              required: true,
              sortValue: (r) => r.project.name,
              render: (r) => (
                <>
                  <span className="font-bold text-heading">{r.project.name}</span>
                  <div className="text-2xs text-ink-muted">{r.project.client.name}</div>
                </>
              ),
            },
            {
              key: "studios",
              label: "Studios",
              render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {r.project.studios.map(({ studio }) => (
                    <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
                  ))}
                </div>
              ),
            },
            {
              key: "avancement",
              label: "Avancement",
              sortValue: (r) => r.progress,
              render: (r) => (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 flex-shrink-0 rounded-full bg-line">
                    <div className="h-full rounded-full bg-heading" style={{ width: `${Math.round(r.progress * 100)}%` }} />
                  </div>
                  <span className="text-2xs tabular-nums text-ink-muted">{Math.round(r.progress * 100)}%</span>
                </div>
              ),
            },
            {
              key: "taches",
              label: "Tâches",
              sortValue: (r) => r.project._count.tasks,
              cellClassName: "text-center tabular-nums",
              headClassName: "text-center",
              render: (r) => r.project._count.tasks,
            },
            {
              key: "jalon",
              label: "Prochain jalon",
              sortValue: (r) => (r.next ? toIsoDate(r.next.dueDate) : "\uffff"),
              render: (r) =>
                r.next ? (
                  <span className="flex items-center gap-1.5">
                    <Flag size={12} className="flex-shrink-0 text-ink-muted" aria-hidden="true" />
                    {r.next.title}
                    <span className="text-2xs text-ink-muted tabular-nums">— {formatShortFr(toIsoDate(r.next.dueDate))}</span>
                  </span>
                ) : (
                  <span className="text-ink-muted">Aucun jalon à venir</span>
                ),
            },
            {
              key: "retard",
              label: "En retard",
              sortValue: (r) => -r.overdueCount,
              cellClassName: "text-center",
              headClassName: "text-center",
              render: (r) =>
                r.overdueCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 font-semibold"
                    style={{ color: "var(--color-alert)" }}
                    title={`${r.overdueCount} jalon${r.overdueCount === 1 ? "" : "s"} en retard`}
                  >
                    <AlertTriangle size={13} /> {r.overdueCount}
                  </span>
                ) : (
                  <span className="text-ink-muted">—</span>
                ),
            },
            {
              key: "budget",
              label: "Budget",
              sortValue: (r) => (r.overBudget ? 0 : 1),
              cellClassName: "text-center",
              headClassName: "text-center",
              render: (r) =>
                r.overBudget ? (
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--color-alert)" }} title="Temps dépassé">
                    <AlertTriangle size={13} />
                  </span>
                ) : (
                  <span className="text-ink-muted">—</span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
