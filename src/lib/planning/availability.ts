// Calcul de charge, porté du prototype (`chargeDe`, lignes 1421-1427).
//
// Une tâche sans estimation compte tout jour couvert comme entièrement
// occupé (comportement d'origine, conservé pour les tâches non estimées) ;
// une tâche estimée en demi-journées répartit son effort sur les jours
// ouvrables de sa plage plutôt que de compter chaque jour comme complet —
// c'était la limite n°1 pointée par le brief, corrigée ici. La contribution
// d'un jour reste plafonnée à une journée pleine (1.0) : au-delà, c'est un
// chevauchement (voir le repère dédié dans la vue Charge), pas une charge
// "supérieure à 100 %" qui n'aurait pas de sens à additionner ici.

import { addDays, fromIsoDate, isBusinessDay, isWeekend, type IsoDate } from "./dates";

export interface LoadTask {
  personId: string;
  isDone: boolean;
  startDate: IsoDate;
  endDate: IsoDate;
  /** Effort estimé en demi-journées ; absent = ancien comportement (jour couvert = jour plein). */
  estimatedHalfDays?: number | null;
}

export interface LoadAbsence {
  personId: string;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface WeeklyLoad {
  /** Jours ouvrables réellement disponibles (fériés, week-ends, absences déduits). */
  available: number;
  /** Somme de la contribution quotidienne des tâches actives, plafonnée à un jour plein par jour. */
  occupied: number;
  /** occupied / available, 0 si personne n'a aucun jour disponible cette semaine-là. */
  ratio: number;
}

/** Jours ouvrables (hors week-end) dans une plage — approximation volontaire sans la table des fériés, suffisante pour répartir un effort. */
function businessDaySpan(startDate: IsoDate, endDate: IsoDate): number {
  let count = 0;
  let d = fromIsoDate(startDate);
  const end = fromIsoDate(endDate);
  while (d <= end) {
    if (!isWeekend(d)) count++;
    d = addDays(d, 1);
  }
  return Math.max(count, 1);
}

/** Part d'une journée que `task` occupe, un jour donné où elle est active — 1.0 si non estimée. */
function dailyContribution(task: LoadTask): number {
  if (task.estimatedHalfDays == null) return 1;
  const days = task.estimatedHalfDays / 2;
  const span = businessDaySpan(task.startDate, task.endDate);
  return Math.min(1, days / span);
}

export function weeklyLoad(
  personId: string,
  weekStart: Date,
  tasks: LoadTask[],
  absences: LoadAbsence[],
  holidays: Record<IsoDate, string>,
): WeeklyLoad {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) =>
    isBusinessDay(d, holidays),
  );

  const isAbsent = (d: Date) =>
    absences.some(
      (a) =>
        a.personId === personId && d >= fromIsoDate(a.startDate) && d <= fromIsoDate(a.endDate),
    );
  const activeTasksOn = (d: Date) =>
    tasks.filter(
      (t) =>
        t.personId === personId &&
        !t.isDone &&
        d >= fromIsoDate(t.startDate) &&
        d <= fromIsoDate(t.endDate),
    );

  const available = days.filter((d) => !isAbsent(d)).length;
  const occupied = days
    .filter((d) => !isAbsent(d))
    .reduce((sum, d) => sum + Math.min(1, activeTasksOn(d).reduce((s, t) => s + dailyContribution(t), 0)), 0);

  return { available, occupied, ratio: available ? occupied / available : 0 };
}
