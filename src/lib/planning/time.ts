// Calculs purs sur les écritures de temps (feuilles de temps) — même esprit
// que src/lib/planning/tasks.ts : logique testable, indépendante de Prisma.

import type { ProjectPole } from "@prisma/client";
import { taskProgress, type ProgressStatus } from "./tasks";

export interface TimeEntryDuration {
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * Durée d'une écriture en minutes. Un minuteur en cours (`endedAt` nul)
 * compte jusqu'à `referenceDate` (par défaut maintenant) — utilisé pour
 * afficher un total qui avance pendant qu'un minuteur tourne, sans attendre
 * qu'il soit arrêté.
 */
export function entryDurationMinutes(entry: TimeEntryDuration, referenceDate: Date = new Date()): number {
  const end = entry.endedAt ?? referenceDate;
  return Math.max(0, Math.round((end.getTime() - entry.startedAt.getTime()) / 60_000));
}

export function sumDurationMinutes(entries: TimeEntryDuration[], referenceDate: Date = new Date()): number {
  return entries.reduce((sum, e) => sum + entryDurationMinutes(e, referenceDate), 0);
}

/** Formate une durée en minutes à la française, ex. "2 h 15", "45 min", "3 h". */
export function formatDurationFr(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export type BudgetPace = "ahead" | "onTrack" | "behind";

// Écart (en points, 0-1) entre part du budget consommée et avancement des
// tâches à partir duquel on considère le projet en avance ou en retard —
// en dessous, la différence est dans le bruit normal (temps administratif,
// tâches groupées, etc.), pas un vrai signal de rythme.
const PACE_THRESHOLD = 0.15;

/**
 * Rythme budgétaire d'un projet : compare la part du budget de temps déjà
 * consommée à l'avancement réel des tâches (voir taskProgress). Consommer
 * plus vite qu'on n'avance = en retard ; l'inverse = en avance. Sert au
 * tableau de bord pour repérer les projets qui dérivent avant qu'ils ne
 * dépassent franchement leur budget.
 */
export function projectBudgetPace(consumedRatio: number, progress: number): BudgetPace {
  const gap = consumedRatio - progress;
  if (gap > PACE_THRESHOLD) return "behind";
  if (gap < -PACE_THRESHOLD) return "ahead";
  return "onTrack";
}

export interface DashboardProjectInput {
  id: string;
  name: string;
  clientName: string;
  pole: ProjectPole | null;
  budgetHours: number;
  timeEntries: TimeEntryDuration[];
  taskStatuses: ProgressStatus[];
}

export interface DashboardProjectRow extends DashboardProjectInput {
  budgetMinutes: number;
  actualMinutes: number;
  progress: number;
  consumedRatio: number;
  pace: BudgetPace;
}

/**
 * Calcul partagé entre la vue Tableau de bord (dashboard-view.tsx) et son
 * export CSV (api/export/dashboard) — une seule définition de "consommé",
 * "avancement" et "rythme" par projet, triée du plus au moins consommé.
 */
export function computeDashboardRows(projects: DashboardProjectInput[], allStatuses: ProgressStatus[]): DashboardProjectRow[] {
  return projects
    .map((p) => {
      const budgetMinutes = p.budgetHours * 60;
      const actualMinutes = sumDurationMinutes(p.timeEntries);
      const progress =
        p.taskStatuses.length === 0
          ? 0
          : p.taskStatuses.reduce((sum, s) => sum + taskProgress(s, allStatuses, []), 0) / p.taskStatuses.length;
      const consumedRatio = budgetMinutes > 0 ? actualMinutes / budgetMinutes : 0;
      return { ...p, budgetMinutes, actualMinutes, progress, consumedRatio, pace: projectBudgetPace(consumedRatio, progress) };
    })
    .sort((a, b) => b.consumedRatio - a.consumedRatio);
}
