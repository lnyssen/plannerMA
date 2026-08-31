// Calculs purs sur les écritures de temps (feuilles de temps) — même esprit
// que src/lib/planning/tasks.ts : logique testable, indépendante de Prisma.

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
