"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, "L’intitulé est requis."),
    studioId: z.string().min(1, "Le studio est requis."),
    projectId: z.string().nullable(),
    assigneeId: z.string().nullable(),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((v) => v.endDate >= v.startDate, { message: "La fin ne peut pas précéder le début.", path: ["endDate"] });

export type CreateTaskInput = z.input<typeof createTaskSchema>;

export async function createTask(input: CreateTaskInput): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { title, studioId, projectId, assigneeId, startDate, endDate } = parsed.data;

  const task = await db.task.create({
    data: {
      title,
      studioId,
      projectId: projectId || null,
      assigneeId: assigneeId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Tâche « ${title} » créée`,
    },
  });

  revalidatePath("/taches");
  revalidatePath("/projets");
  revalidatePath("/semaine");
  revalidatePath("/gantt");
  return { id: task.id };
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

  revalidatePath("/gantt");
  revalidatePath("/semaine");
  revalidatePath("/taches");
  return { version: task.version };
}
