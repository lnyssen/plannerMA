import { db } from "@/lib/db";

export function listTasksForGantt() {
  return db.task.findMany({
    // Un projet archivé sort ses tâches du plan de charge actif (voir src/lib/data/tasks.ts).
    where: { trashedAt: null, OR: [{ projectId: null }, { project: { archived: false } }] },
    include: { project: { include: { client: true } }, studio: true, assignee: true },
    orderBy: { startDate: "asc" },
  });
}

export type GanttTask = Awaited<ReturnType<typeof listTasksForGantt>>[number];
