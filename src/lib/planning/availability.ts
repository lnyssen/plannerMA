// Calcul de charge, porté du prototype (`chargeDe`, lignes 1421-1427).
//
// Volontairement binaire pour l'instant : un jour couvert par au moins une
// tâche pas encore terminée (statut sans `isDone`) compte comme occupé,
// qu'il y ait une ou trois tâches ce jour-là. C'est exactement la limite que
// le brief pointe comme fonctionnalité
// n°1 à corriger (estimation en demi-journées) — ne pas anticiper cette
// correction ici, elle a son propre palier de livraison.

import { addDays, fromIsoDate, isBusinessDay, type IsoDate } from "./dates";

export interface LoadTask {
  personId: string;
  isDone: boolean;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface LoadAbsence {
  personId: string;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface WeeklyLoad {
  /** Jours ouvrables réellement disponibles (fériés, week-ends, absences déduits). */
  available: number;
  /** Jours ouvrables couverts par au moins une tâche non livrée. */
  occupied: number;
  /** occupied / available, 0 si personne n'a aucun jour disponible cette semaine-là. */
  ratio: number;
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
  const isCoveredByActiveTask = (d: Date) =>
    tasks.some(
      (t) =>
        t.personId === personId &&
        !t.isDone &&
        d >= fromIsoDate(t.startDate) &&
        d <= fromIsoDate(t.endDate),
    );

  const available = days.filter((d) => !isAbsent(d)).length;
  const occupied = days.filter((d) => isCoveredByActiveTask(d)).length;

  return { available, occupied, ratio: available ? occupied / available : 0 };
}
