import { db } from "@/lib/db";

// Une tâche sans projet ("Sans projet") reste active par définition ; une
// tâche dont le projet est archivé ne doit plus apparaître dans les vues de
// travail actif ni les sélecteurs — sinon archiver un projet ne change rien
// à ses tâches, qui continuent d'accumuler du suivi de temps indéfiniment.
const ACTIVE_PROJECT_FILTER = { OR: [{ projectId: null }, { project: { archived: false } }] };

export function listActiveTasksForListing() {
  return db.task.findMany({
    where: { trashedAt: null, ...ACTIVE_PROJECT_FILTER },
    include: {
      project: { include: { client: true } },
      studios: { include: { studio: true } },
      assignee: true,
      status: true,
      _count: { select: { comments: true, attachments: true } },
    },
    orderBy: { startDate: "asc" },
  });
}

export type TaskListItem = Awaited<ReturnType<typeof listActiveTasksForListing>>[number];

/** Candidates pour le champ "Dépend de" et le suivi de temps — nom, studios et projet, pas les détails complets d'une tâche. */
export function listActiveTasksForForms() {
  return db.task.findMany({
    where: { trashedAt: null, ...ACTIVE_PROJECT_FILTER },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      studios: { select: { studioId: true } },
      project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
    },
  });
}

export type TaskOption = Awaited<ReturnType<typeof listActiveTasksForForms>>[number];
