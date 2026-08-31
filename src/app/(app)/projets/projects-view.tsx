"use client";

import { AlertTriangle, Archive, Flag, LayoutGrid, Table2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EditProjectModal } from "@/components/modals/edit-project-modal";
import { secondaryButtonClass } from "@/components/ui/buttons";
import { CreateButton } from "@/components/shell/create-button";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { ClientSummary } from "@/lib/data/clients";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption, ProjectWithCounts } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import { formatShortFr, toIsoDate, today } from "@/lib/planning/dates";
import { taskProgress } from "@/lib/planning/tasks";
import { sumDurationMinutes } from "@/lib/planning/time";

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
 * Dépassement de budget de temps — même règle que checkAndNotifyBudget
 * (src/lib/actions/time-entries.ts) : total des écritures liées directement
 * au projet + celles de ses tâches, comparé au budget en heures. `null` si
 * aucun budget n'est défini (rien à comparer).
 */
function projectOverBudget(project: ProjectWithCounts): boolean {
  if (project.budgetHours == null) return false;
  const loggedMinutes = sumDurationMinutes([...project.timeEntries, ...project.tasks.flatMap((t) => t.timeEntries)]);
  return loggedMinutes > project.budgetHours * 60;
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
  const overBudget = projectOverBudget(project);

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
          <span className="rounded-md px-1.5 py-0.5 text-2xs font-semibold text-ink-muted uppercase" style={{ background: "var(--color-wash)" }}>
            {project.type === "INTERNAL" ? "Interne" : "Externe"}
          </span>
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
        <span className="text-2xs tabular-nums text-ink-muted">{Math.round(progress * 100)}%</span>
      </div>
      <div className="text-sm font-semibold text-ink">
        {count} tâche{count === 1 ? "" : "s"}
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
  clients,
  statuses,
  people,
  activeProjects,
  showArchived,
  isAdmin,
  initialOpenProjectId = null,
}: {
  projects: ProjectWithCounts[];
  studios: StudioSummary[];
  clients: ClientSummary[];
  statuses: TaskStatusSummary[];
  people: PersonSummary[];
  activeProjects: ProjectOption[];
  showArchived: boolean;
  isAdmin: boolean;
  initialOpenProjectId?: string | null;
}) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(initialOpenProjectId);
  const [search, setSearch] = useState("");
  const [studioFilter, setStudioFilter] = useState<string | null>(null);
  // "Cartes" par défaut au premier rendu (identique serveur/client, évite un
  // hydration mismatch) ; le dernier choix de l'utilisateur est relu depuis
  // localStorage juste après le montage — préférence par appareil, pas une
  // donnée à synchroniser entre utilisateurs.
  const [view, setView] = useState<"cards" | "table">("cards");
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
      // localStorage indisponible (navigation privée, etc.) — reste sur "cards".
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
        <div className="flex overflow-hidden rounded-lg border-[1.5px] border-heading" role="group" aria-label="Présentation">
          <button
            type="button"
            onClick={() => changeView("cards")}
            aria-pressed={view === "cards"}
            className="flex items-center gap-1.5 border-r-[1.5px] border-heading px-2.5 py-1 text-xs font-semibold"
            style={{
              background: view === "cards" ? "var(--color-heading)" : "transparent",
              color: view === "cards" ? "var(--color-paper)" : "var(--color-ink-muted)",
            }}
          >
            <LayoutGrid size={13} /> Cartes
          </button>
          <button
            type="button"
            onClick={() => changeView("table")}
            aria-pressed={view === "table"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
            style={{
              background: view === "table" ? "var(--color-heading)" : "transparent",
              color: view === "table" ? "var(--color-paper)" : "var(--color-ink-muted)",
            }}
          >
            <Table2 size={13} /> Tableau
          </button>
        </div>
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
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-md border-[1.5px] border-heading px-3 py-2.5 text-sm text-ink outline-none"
        />
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
          <ProjectGroup title="Clients internes" projects={internal} statuses={statuses} onOpen={setOpenProjectId} />
          <ProjectGroup title="Clients externes" projects={external} statuses={statuses} onOpen={setOpenProjectId} />
        </>
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
                <th className="min-w-[90px] px-3 py-2 text-center text-xs font-semibold text-ink-muted uppercase">
                  Budget
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, progress, next, overdueCount, overBudget }) => (
                <tr key={project.id} className="border-t border-line">
                  <td className="sticky left-0 z-10 bg-paper px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenProjectId(project.id)}
                      className="text-left text-sm font-bold text-heading underline-offset-2 hover:underline"
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
                  <td className="px-3 py-2.5 text-center">
                    {overBudget ? (
                      <span
                        className="inline-flex items-center gap-1 text-sm font-semibold"
                        style={{ color: "var(--color-alert)" }}
                        title="Temps dépassé"
                      >
                        <AlertTriangle size={13} />
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
          people={people}
          activeProjects={activeProjects}
          isAdmin={isAdmin}
          onClose={() => setOpenProjectId(null)}
        />
      )}
    </div>
  );
}
