// Calculs liés aux tâches, portés du prototype (`avancement`, `enRetard`,
// et la détection de chevauchement de dépendance du Gantt, ligne 1121).

import { fromIsoDate, type IsoDate } from "./dates";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "VALIDATION" | "DELIVERED";

const STATUS_PROGRESS: Record<TaskStatus, number> = {
  TODO: 0,
  IN_PROGRESS: 0.4,
  VALIDATION: 0.75,
  DELIVERED: 1,
};

export interface ProgressSubtask {
  done: boolean;
}

/**
 * Avancement d'une tâche entre 0 et 1. Sans sous-tâches, dérivé de l'état ;
 * avec sous-tâches, fraction de sous-tâches cochées — l'état seul ne suffit
 * plus à représenter l'avancement dès qu'il y a une décomposition.
 */
export function taskProgress(status: TaskStatus, subtasks: ProgressSubtask[]): number {
  if (subtasks.length === 0) return STATUS_PROGRESS[status];
  return subtasks.filter((s) => s.done).length / subtasks.length;
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
