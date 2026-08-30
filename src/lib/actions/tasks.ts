"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { daysBetween } from "@/lib/planning/dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export async function getTaskDetail(taskId: string) {
  const session = await auth();
  if (!session?.user) return null;
  return db.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      studio: true,
      assignee: true,
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

interface DurationFields {
  startDate: string;
  endDate: string;
  maxDurationDays: number | null;
}

function withDurationChecks<T extends z.ZodType<DurationFields>>(schema: T) {
  return schema.superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", message: "La fin ne peut pas précéder le début.", path: ["endDate"] });
      return;
    }
    if (v.maxDurationDays && daysBetween(v.startDate, v.endDate) + 1 > v.maxDurationDays) {
      ctx.addIssue({
        code: "custom",
        message: `La tâche dépasse la durée maximale fixée (${v.maxDurationDays} jour${v.maxDurationDays === 1 ? "" : "s"}).`,
        path: ["endDate"],
      });
    }
  });
}

const taskFieldsSchema = z.object({
  title: z.string().trim().min(1, "L’intitulé est requis."),
  description: z.string().trim().max(4000).nullable(),
  studioId: z.string().min(1, "Le studio est requis."),
  projectId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  startDate: isoDate,
  endDate: isoDate,
  maxDurationDays: z.number().int().positive().nullable(),
});

const createTaskSchema = withDurationChecks(taskFieldsSchema);

export type CreateTaskInput = z.input<typeof createTaskSchema>;

export async function createTask(input: CreateTaskInput): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { title, description, studioId, projectId, assigneeId, startDate, endDate, maxDurationDays } = parsed.data;

  const task = await db.task.create({
    data: {
      title,
      description: description || null,
      studioId,
      projectId: projectId || null,
      assigneeId: assigneeId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxDurationDays,
    },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Tâche « ${title} » créée`,
    },
  });

  revalidateTaskViews();
  return { id: task.id };
}

const updateTaskSchema = withDurationChecks(
  taskFieldsSchema.extend({
    taskId: z.string(),
    status: z.enum(["TODO", "IN_PROGRESS", "VALIDATION", "DELIVERED"]),
    expectedVersion: z.number().int(),
  }),
);

export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export async function updateTask(input: UpdateTaskInput): Promise<{ error?: string; version?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const {
    taskId,
    title,
    description,
    studioId,
    projectId,
    assigneeId,
    startDate,
    endDate,
    maxDurationDays,
    status,
    expectedVersion,
  } = parsed.data;

  const result = await db.task.updateMany({
    where: { id: taskId, version: expectedVersion },
    data: {
      title,
      description: description || null,
      studioId,
      projectId: projectId || null,
      assigneeId: assigneeId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxDurationDays,
      status,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    return { error: "Cette tâche a été modifiée entre-temps par quelqu’un d’autre. Rechargez la page." };
  }

  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Tâche « ${title} » modifiée`,
    },
  });

  revalidateTaskViews();
  return { version: task.version };
}

const rescheduleSchema = z.object({
  taskId: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  expectedVersion: z.number().int(),
});

/**
 * Déplacement/redimensionnement depuis le Gantt. Verrouillage optimiste : si
 * la version en base a changé depuis la lecture côté client (quelqu'un
 * d'autre a modifié la tâche entre-temps), on refuse plutôt que d'écraser —
 * voir docs/plan-architecture.md.
 */
export async function rescheduleTask(
  input: z.infer<typeof rescheduleSchema>,
): Promise<{ error?: string; version?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const { taskId, startDate, endDate, expectedVersion } = rescheduleSchema.parse(input);

  const result = await db.task.updateMany({
    where: { id: taskId, version: expectedVersion },
    data: { startDate: new Date(startDate), endDate: new Date(endDate), version: { increment: 1 } },
  });

  if (result.count === 0) {
    return { error: "Cette tâche a été modifiée entre-temps par quelqu’un d’autre. Rechargez la page." };
  }

  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Tâche « ${task.title} » replanifiée`,
    },
  });

  revalidateTaskViews();
  return { version: task.version };
}

export async function trashTask(taskId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const task = await db.task.update({ where: { id: taskId }, data: { trashedAt: new Date() } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Tâche « ${task.title} » mise à la corbeille`,
    },
  });

  revalidateTaskViews();
  return {};
}

export async function restoreTask(taskId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const task = await db.task.update({ where: { id: taskId }, data: { trashedAt: null } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Tâche « ${task.title} » restaurée`,
    },
  });

  revalidateTaskViews();
  return {};
}

/** Suppression définitive — réservée aux administrateurs, contrairement à trashTask. */
export async function destroyTask(taskId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." };

  const task = await db.task.delete({ where: { id: taskId } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Tâche « ${task.title} » supprimée définitivement`,
    },
  });

  revalidateTaskViews();
  revalidatePath("/reglages");
  return {};
}

function revalidateTaskViews() {
  revalidatePath("/taches");
  revalidatePath("/projets");
  revalidatePath("/semaine");
  revalidatePath("/gantt");
  revalidatePath("/reglages");
}
