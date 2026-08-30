// Calculs liés aux tâches, portés du prototype (`avancement`, `enRetard`,
// et la détection de chevauchement de dépendance du Gantt, ligne 1121).

import { fromIsoDate, type IsoDate } from "./dates";

export interface ProgressSubtask {
  done: boolean;
}

export interface ProgressStatus {
  position: number;
  isDone: boolean;
}

/**
 * Avancement d'une tâche entre 0 et 1. Sans sous-tâches, dérivé du rang du
 * statut parmi les statuts "non terminés" (0 pour le premier, en progressant
 * vers 1 sans jamais l'atteindre — seul `isDone` vaut 1) ; avec sous-tâches,
 * fraction de sous-tâches cochées, qui l'emporte sur le statut. Les statuts
 * étant personnalisables (Réglages), il n'y a plus de barème figé par nom.
 */
export function taskProgress(status: ProgressStatus, allStatuses: ProgressStatus[], subtasks: ProgressSubtask[]): number {
  if (subtasks.length > 0) return subtasks.filter((s) => s.done).length / subtasks.length;
  if (status.isDone) return 1;

  const pending = allStatuses.filter((s) => !s.isDone).sort((a, b) => a.position - b.position);
  if (pending.length <= 1) return 0;
  const index = pending.findIndex((s) => s.position === status.position);
  return index <= 0 ? 0 : index / pending.length;
}

export interface OverdueSubtask {
  done: boolean;
  dueDate: IsoDate | null;
}

/** Une sous-tâche est en retard si elle n'est pas faite et que son échéance est dépassée. */
export function isSubtaskOverdue(subtask: OverdueSubtask, referenceDate: IsoDate): boolean {
  if (subtask.done || !subtask.dueDate) return false;
  return fromIsoDate(subtask.dueDate) < fromIsoDate(referenceDate);
}

export interface DependencyDates {
  startDate: IsoDate;
  endDate: IsoDate;
}

/**
 * Une dépendance est en conflit quand la tâche dépendante commence avant (ou
 * le jour même) la fin de sa tâche prédécesseure — reprend exactement la
 * règle du Gantt prototype : `lire(tache.debut) <= lire(pred.fin)`.
 */
export function hasDependencyConflict(task: DependencyDates, predecessor: DependencyDates): boolean {
  return fromIsoDate(task.startDate) <= fromIsoDate(predecessor.endDate);
}
