import { db } from "@/lib/db";

// Pas de fenêtre de dates pour l'instant (petite équipe, volume faible) —
// à revoir si la table grossit significativement.

const TASK_SELECT = { id: true, title: true, project: { select: { name: true, client: { select: { name: true } } } } } as const;
const PROJECT_SELECT = { id: true, name: true, code: true, client: { select: { name: true } } } as const;
const STUDIO_SELECT = { id: true, name: true, colorHex: true, fillHex: true } as const;
const CATEGORY_SELECT = { id: true, name: true } as const;

export function listTimeEntriesForPerson(personId: string) {
  return db.timeEntry.findMany({
    where: { personId },
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: TASK_SELECT },
      project: { select: PROJECT_SELECT },
      studio: { select: STUDIO_SELECT },
      category: { select: CATEGORY_SELECT },
    },
  });
}

export type TimeEntryWithTask = Awaited<ReturnType<typeof listTimeEntriesForPerson>>[number];

/** Réservé aux administrateurs — toutes les écritures, toutes personnes confondues. */
export function listAllTimeEntries() {
  return db.timeEntry.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: TASK_SELECT },
      project: { select: PROJECT_SELECT },
      studio: { select: STUDIO_SELECT },
      category: { select: CATEGORY_SELECT },
      person: { select: { id: true, name: true } },
    },
  });
}

export type TimeEntryWithPerson = Awaited<ReturnType<typeof listAllTimeEntries>>[number];

/**
 * Projets actifs avec un budget d'heures défini — pour le calcul de
 * dépassement, réservé aux administrateurs. Une écriture peut être liée à
 * ce projet directement (`projectId`) ou via une tâche qui en dépend — les
 * deux comptent, sinon une écriture "AGENCE" sur une tâche du projet mais
 * sans lien direct serait ignorée du calcul.
 */
export function listProjectsWithBudget() {
  return db.project.findMany({
    where: { archived: false, budgetHours: { not: null } },
    select: {
      id: true,
      name: true,
      budgetHours: true,
      timeEntries: { select: { startedAt: true, endedAt: true } },
      tasks: { select: { timeEntries: { select: { startedAt: true, endedAt: true } } } },
    },
  });
}
