import type { TaskStatus } from "@prisma/client";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  VALIDATION: "Validation",
  DELIVERED: "Livré",
};

export const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "VALIDATION", "DELIVERED"];

export const STATUS_COLORS: Record<TaskStatus, { fill: string; text: string }> = {
  TODO: { fill: "var(--status-todo-fill)", text: "var(--status-todo-text)" },
  IN_PROGRESS: { fill: "var(--status-in-progress-fill)", text: "var(--status-in-progress-text)" },
  VALIDATION: { fill: "var(--status-validation-fill)", text: "var(--status-validation-text)" },
  DELIVERED: { fill: "var(--status-delivered-fill)", text: "var(--status-delivered-text)" },
};
