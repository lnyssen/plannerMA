"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Flag, LayoutDashboard } from "lucide-react";
import { secondaryButtonClass } from "@/components/ui/buttons";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthlyHoursChart } from "@/components/ui/monthly-hours-chart";
import { SectionHeading } from "@/components/ui/section-heading";
import type { MonthlyHoursByStudio } from "@/lib/data/time-entries";
import { formatShortFr, today } from "@/lib/planning/dates";
import type { ProgressStatus } from "@/lib/planning/tasks";
import { computeDashboardRows, formatDurationFr, type BudgetPace, type DashboardProjectInput } from "@/lib/planning/time";

interface UpcomingMilestone {
  id: string;
  title: string;
  dueDate: string;
  projectName: string;
  clientName: string;
}

const PACE_LABEL: Record<BudgetPace, string> = {
  ahead: "En avance",
  onTrack: "Dans les temps",
  behind: "En retard",
};

const PACE_COLOR: Record<BudgetPace, string> = {
  ahead: "var(--color-heading)",
  onTrack: "var(--color-ink-muted)",
  behind: "var(--color-alert)",
};

function PacePill({ pace }: { pace: BudgetPace }) {
  return (
    <span
      className="flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold whitespace-nowrap"
      style={{ color: PACE_COLOR[pace], backgroundColor: pace === "onTrack" ? "var(--color-wash)" : `color-mix(in srgb, ${PACE_COLOR[pace]} 14%, transparent)` }}
    >
      {PACE_LABEL[pace]}
    </span>
  );
}


/** Chiffre d'en-tête ; la teinte d'alerte ne s'allume que si le chiffre désigne un problème. */
function StatTile({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: alert ? "var(--color-alert)" : "var(--color-line)",
        background: alert ? "var(--color-alert-wash)" : "transparent",
      }}
    >
      <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <p
        className="font-[family-name:var(--font-display)] text-lg font-semibold tabular-nums"
        style={{ color: alert ? "var(--color-alert)" : "var(--color-heading)" }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Vue d'ensemble budget de temps (admin) — équivalent "Budget vs. Actual"
 * pour des heures plutôt que de l'argent : total budgété/consommé/restant,
 * et par projet le taux de consommation comparé à l'avancement réel des
 * tâches (voir projectBudgetPace) pour repérer un dérapage avant qu'il ne
 * devienne un dépassement franc. Charge (occupation par personne) reste une
 * page séparée — celle-ci est le pendant "argent du temps", vue globale.
 */
export interface DashboardActivity {
  activeProjects: number;
  activeTasks: number;
  lateTasks: number;
  unassignedTasks: number;
}

export function DashboardView({
  activity,
  monthlyHours,
  projects,
  allStatuses,
  milestones,
}: {
  activity: DashboardActivity;
  monthlyHours: MonthlyHoursByStudio;
  projects: DashboardProjectInput[];
  allStatuses: ProgressStatus[];
  milestones: UpcomingMilestone[];
}) {
  const router = useRouter();
  const rows = computeDashboardRows(projects, allStatuses);
  const todayIso = today();

  const totalBudgetMinutes = rows.reduce((sum, p) => sum + p.budgetMinutes, 0);
  const totalActualMinutes = rows.reduce((sum, p) => sum + p.actualMinutes, 0);
  const remainingMinutes = totalBudgetMinutes - totalActualMinutes;
  const globalVariance = totalBudgetMinutes > 0 ? (totalActualMinutes - totalBudgetMinutes) / totalBudgetMinutes : 0;
  const behindCount = rows.filter((p) => p.pace === "behind").length;

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Tableau de bord
        </h1>
        {rows.length > 0 && (
          <a
            href="/api/export/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
          >
            <Download size={14} /> Exporter en CSV
          </a>
        )}
      </div>

      {/* Repères d'activité : le tableau de bord ne couvrait que les projets
          dotés d'un budget de temps, si bien qu'il pouvait n'afficher
          strictement rien — le pire état possible pour la page censée donner
          la vue d'ensemble. Ces quatre chiffres tiennent quoi qu'il arrive. */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Projets en cours" value={activity.activeProjects} />
        <StatTile label="Tâches en cours" value={activity.activeTasks} />
        <StatTile label="Tâches en retard" value={activity.lateTasks} alert={activity.lateTasks > 0} />
        <StatTile label="Tâches non attribuées" value={activity.unassignedTasks} alert={activity.unassignedTasks > 0} />
      </div>

      <div className="mb-8">
        <SectionHeading>Heures enregistrées par mois</SectionHeading>
        <MonthlyHoursChart data={monthlyHours} />
      </div>

      <div className="mb-8">
        <SectionHeading count={milestones.length}>Prochaines échéances (30 jours)</SectionHeading>
        {milestones.length === 0 ? (
          <p className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink-muted">
            Aucune date clé dépassée ni à venir sous 30 jours.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {milestones.map((m) => {
              const late = m.dueDate < todayIso;
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: late ? "var(--color-alert)" : "var(--color-line)" }}
                >
                  <Flag size={14} className="flex-shrink-0" style={{ color: late ? "var(--color-alert)" : "var(--color-heading)" }} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-heading">{m.title}</span>
                    <span className="text-ink-muted"> — {m.clientName} — {m.projectName}</span>
                  </span>
                  <span
                    className="flex flex-shrink-0 items-center gap-1 text-2xs font-semibold tabular-nums"
                    style={{ color: late ? "var(--color-alert)" : "var(--color-ink-muted)" }}
                  >
                    {late && <AlertTriangle size={11} />}
                    {formatShortFr(m.dueDate)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Aucun projet avec budget de temps"
          description="Renseignez un budget d’heures sur un projet (fiche projet) pour le voir apparaître ici."
        />
      ) : (
        <>
          <p className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">Budget de temps</p>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-4">
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Budget total</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-heading">
                {formatDurationFr(totalBudgetMinutes)}
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Réalisé</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-heading">
                {formatDurationFr(totalActualMinutes)}
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Restant</p>
              <p
                className="font-[family-name:var(--font-display)] text-2xl font-semibold"
                style={{ color: remainingMinutes < 0 ? "var(--color-alert)" : "var(--color-heading)" }}
              >
                {formatDurationFr(Math.abs(remainingMinutes))}
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Écart</p>
              <p
                className="font-[family-name:var(--font-display)] text-2xl font-semibold"
                style={{ color: globalVariance > 0 ? "var(--color-alert)" : "var(--color-heading)" }}
              >
                {globalVariance > 0 ? "+" : ""}
                {Math.round(globalVariance * 100)}%
              </p>
            </div>
          </div>

          {behindCount > 0 && (
            <p className="mb-4 text-sm text-alert">
              {behindCount} projet{behindCount === 1 ? "" : "s"} consomme{behindCount === 1 ? "" : "nt"} son budget plus vite qu’il
              {behindCount === 1 ? "" : "s"} n’avance{behindCount === 1 ? "" : "nt"}.
            </p>
          )}

          <DataTable
            rows={rows}
            getRowId={(p) => p.id}
            onRowClick={(p) => router.push(`/projets/${p.id}`)}
            storageKey="planning-studios:colonnes:tableau-de-bord"
            columns={[
              {
                key: "projet",
                label: "Projet",
                required: true,
                sortValue: (p) => p.name,
                render: (p) => (
                  <>
                    <p className="font-semibold text-heading">{p.name}</p>
                    <p className="text-2xs text-ink-muted">{p.clientName}</p>
                  </>
                ),
              },
              {
                key: "budget",
                label: "Budget",
                sortValue: (p) => p.budgetMinutes,
                cellClassName: "whitespace-nowrap text-ink-muted tabular-nums",
                render: (p) => formatDurationFr(p.budgetMinutes),
              },
              {
                key: "consomme",
                label: "Consommé",
                sortValue: (p) => p.consumedRatio,
                render: (p) => (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 flex-shrink-0 rounded-full bg-line">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round(p.consumedRatio * 100))}%`,
                          background: p.consumedRatio > 1 ? "var(--color-alert)" : "var(--color-heading)",
                        }}
                      />
                    </div>
                    <span
                      className="flex-shrink-0 text-2xs tabular-nums"
                      style={{ color: p.consumedRatio > 1 ? "var(--color-alert)" : "var(--color-ink-muted)" }}
                    >
                      {Math.round(p.consumedRatio * 100)}%
                    </span>
                  </div>
                ),
              },
              {
                key: "avancement",
                label: "Avancement",
                sortValue: (p) => p.progress,
                render: (p) => (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 flex-shrink-0 rounded-full bg-line">
                      <div className="h-full rounded-full bg-heading" style={{ width: `${Math.round(p.progress * 100)}%` }} />
                    </div>
                    <span className="flex-shrink-0 text-2xs tabular-nums text-ink-muted">{Math.round(p.progress * 100)}%</span>
                  </div>
                ),
              },
              { key: "rythme", label: "Rythme", sortValue: (p) => p.pace, render: (p) => <PacePill pace={p.pace} /> },
            ]}
          />
        </>
      )}
    </div>
  );
}
