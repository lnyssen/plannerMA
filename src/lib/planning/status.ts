import type { TaskStatus } from "@prisma/client";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  VALIDATION: "Validation",
  DELIVERED: "Livré",
};

export const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "VALIDATION", "DELIVERED"];
