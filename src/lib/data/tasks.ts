import { db } from "@/lib/db";

export function listActiveTasksForListing() {
  return db.task.findMany({
    where: { trashedAt: null },
    include: { project: { include: { client: true } }, studio: true, assignee: true, status: true },
    orderBy: { startDate: "asc" },
  });
}

export type TaskListItem = Awaited<ReturnType<typeof listActiveTasksForListing>>[number];

/** Candidates pour le champ "Dépend de" et le suivi de temps — nom, studio et projet, pas les détails complets d'une tâche. */
export function listActiveTasksForForms() {
  return db.task.findMany({
    where: { trashedAt: null },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      studioId: true,
      project: { select: { name: true, client: { select: { name: true } } } },
    },
  });
}

export type TaskOption = Awaited<ReturnType<typeof listActiveTasksForForms>>[number];
