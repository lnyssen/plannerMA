import { db } from "@/lib/db";

export function listActiveTasksForListing() {
  return db.task.findMany({
    where: { trashedAt: null },
    include: { project: true, studio: true, assignee: true, status: true },
    orderBy: { startDate: "asc" },
  });
}

export type TaskListItem = Awaited<ReturnType<typeof listActiveTasksForListing>>[number];
