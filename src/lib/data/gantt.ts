import { db } from "@/lib/db";

export function listTasksForGantt() {
  return db.task.findMany({
    where: { trashedAt: null },
    include: { project: true, studio: true, assignee: true },
    orderBy: { startDate: "asc" },
  });
}

export type GanttTask = Awaited<ReturnType<typeof listTasksForGantt>>[number];
