"use client";

import { Download, Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/ui/buttons";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PROJECT_TYPE_LABELS } from "@/lib/planning/labels";
import type { ProgressStatus } from "@/lib/planning/tasks";
import {
  computeDashboardRows,
  formatDurationFr,
  type BudgetPace,
  type DashboardProjectInput,
  type DashboardProjectRow,
} from "@/lib/planning/time";

const GRANT_TYPES = ["EP", "EUROPEEN"] as const;

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

function GrantSection({ label, rows }: { label: string; rows: DashboardProjectRow[] }) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        <p className="text-sm text-ink-muted">Aucun projet {label.toLowerCase()} avec budget de temps renseigné.</p>
      </div>
    );
  }

  const budgetMinutes = rows.reduce((sum, p) => sum + p.budgetMinutes, 0);
  const actualMinutes = rows.reduce((sum, p) => sum + p.actualMinutes, 0);
  const remainingMinutes = budgetMinutes - actualMinutes;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
        <p className="text-2xs text-ink-muted tabular-nums">
          {formatDurationFr(actualMinutes)} / {formatDurationFr(budgetMinutes)}
          {" — "}
          <span style={{ color: remainingMinutes < 0 ? "var(--color-alert)" : "var(--color-ink-muted)" }}>
            {remainingMinutes < 0 ? "dépassement de " : "reste "}
            {formatDurationFr(Math.abs(remainingMinutes))}
          </span>
        </p>
      </div>

      <DataTable
        rows={rows}
        getRowId={(p) => p.id}
        onRowClick={(p) => router.push(`/projets/${p.id}`)}
        storageKey={`planning-studios:colonnes:subventions:${label}`}
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
    </div>
  );
}

/**
 * Portail interne des projets Éducation permanente et Européens — mêmes
 * calculs que Tableau de bord (computeDashboardRows), mais groupés par
 * catégorie de financement plutôt que listés à plat : ce sont deux
 * démarches de justification/reporting distinctes auprès de deux bailleurs
 * différents, pas juste un sous-ensemble d'une même liste. Vue interne
 * (pas d'accès externe) — réservée aux administrateurs comme le reste des
 * données budgétaires.
 */
export function SubventionsView({
  projects,
  allStatuses,
}: {
  projects: DashboardProjectInput[];
  allStatuses: ProgressStatus[];
}) {
  const rows = computeDashboardRows(projects, allStatuses);
  const byType = Object.fromEntries(GRANT_TYPES.map((t) => [t, rows.filter((r) => r.projectType === t)])) as Record<
    (typeof GRANT_TYPES)[number],
    DashboardProjectRow[]
  >;

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Projets EP/Européens
        </h1>
        {rows.length > 0 && (
          <a
            href="/api/export/subventions"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
          >
            <Download size={14} /> Exporter en CSV
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Aucun projet"
          description="Renseignez un budget d’heures sur un projet de type Éducation permanente ou Européen (fiche projet) pour le voir apparaître ici."
        />
      ) : (
        GRANT_TYPES.map((type) => <GrantSection key={type} label={PROJECT_TYPE_LABELS[type]} rows={byType[type]} />)
      )}
    </div>
  );
}
