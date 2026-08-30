import { db } from "@/lib/db";

export function listTaskStatuses() {
  return db.taskStatus.findMany({ orderBy: { position: "asc" } });
}

export type TaskStatusSummary = Awaited<ReturnType<typeof listTaskStatuses>>[number];
