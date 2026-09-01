import { db } from "@/lib/db";

export function listActiveProjectsForForms() {
  return db.project.findMany({
    where: { archived: false },
    // Client puis Projet — même ordre que la nomenclature Client — Projet
    // affichée (voir src/lib/planning/labels.ts).
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, code: true, projectType: true, client: { select: { name: true } } },
  });
}

export type ProjectOption = Awaited<ReturnType<typeof listActiveProjectsForForms>>[number];

export function listProjectsWithCounts(archived = false) {
  return db.project.findMany({
    where: { archived },
    orderBy: { name: "asc" },
    include: {
      client: true,
      studios: { include: { studio: true } },
      // Statuts seuls (pas les sous-tâches) : suffisant pour la jauge
      // d'avancement moyenne de la vue Projets, qui reste au niveau tâche —
      // voir taskProgress dans src/lib/planning/tasks.ts.
      tasks: {
        where: { trashedAt: null },
        select: {
          status: { select: { position: true, isDone: true } },
          timeEntries: { select: { startedAt: true, endedAt: true } },
          _count: { select: { comments: true, attachments: true } },
        },
      },
      milestones: { orderBy: { dueDate: "asc" } },
      timeEntries: { select: { startedAt: true, endedAt: true } },
      _count: { select: { tasks: { where: { trashedAt: null } } } },
    },
  });
}

export type ProjectWithCounts = Awaited<ReturnType<typeof listProjectsWithCounts>>[number];
