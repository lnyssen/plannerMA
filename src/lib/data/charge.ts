import { db } from "@/lib/db";

/** Personnes et leurs tâches/absences actives — matière première de la vue Charge (admin). */
export function loadChargeData() {
  return Promise.all([
    db.person.findMany({ orderBy: { name: "asc" }, include: { studios: { include: { studio: true } } } }),
    db.task.findMany({
      // Un projet archivé sort ses tâches du calcul de charge (voir src/lib/data/tasks.ts).
      where: { trashedAt: null, assigneeId: { not: null }, OR: [{ projectId: null }, { project: { archived: false } }] },
      select: {
        assigneeId: true,
        startDate: true,
        endDate: true,
        estimatedHalfDays: true,
        status: { select: { isDone: true } },
      },
    }),
    db.absence.findMany({ select: { personId: true, startDate: true, endDate: true } }),
  ]);
}
