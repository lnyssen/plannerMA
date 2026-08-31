import { db } from "@/lib/db";

// Pas de fenêtre de dates pour l'instant (petite équipe, volume faible) —
// à revoir si la table grossit significativement.

export function listTimeEntriesForPerson(personId: string) {
  return db.timeEntry.findMany({
    where: { personId },
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: { id: true, title: true, project: { select: { name: true, client: { select: { name: true } } } } } },
    },
  });
}

export type TimeEntryWithTask = Awaited<ReturnType<typeof listTimeEntriesForPerson>>[number];

/** Réservé aux administrateurs — toutes les écritures, toutes personnes confondues. */
export function listAllTimeEntries() {
  return db.timeEntry.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: { id: true, title: true, project: { select: { name: true, client: { select: { name: true } } } } } },
      person: { select: { id: true, name: true } },
    },
  });
}

export type TimeEntryWithPerson = Awaited<ReturnType<typeof listAllTimeEntries>>[number];

/** Projets actifs avec un budget d'heures défini — pour le calcul de dépassement, réservé aux administrateurs. */
export function listProjectsWithBudget() {
  return db.project.findMany({
    where: { archived: false, budgetHours: { not: null } },
    select: {
      id: true,
      name: true,
      budgetHours: true,
      tasks: { select: { timeEntries: { select: { startedAt: true, endedAt: true } } } },
    },
  });
}
