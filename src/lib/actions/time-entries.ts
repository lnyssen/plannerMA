"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

function revalidateTimeViews() {
  revalidatePath("/temps");
  revalidatePath("/taches");
  revalidatePath("/projets");
}

/** Le minuteur en cours de l'utilisateur connecté (n'importe quelle tâche), ou null. */
export async function getRunningTimer() {
  const session = await auth();
  if (!session?.user?.personId) return null;
  return db.timeEntry.findFirst({
    where: { personId: session.user.personId, endedAt: null },
    include: { task: { select: { id: true, title: true, project: { select: { name: true } } } } },
  });
}

export type RunningTimer = Awaited<ReturnType<typeof getRunningTimer>>;

/**
 * Démarre un minuteur sur une tâche — arrête d'abord celui en cours pour la
 * même personne s'il y en a un (un seul actif à la fois, comme Clockify),
 * plutôt que de refuser et obliger un aller-retour.
 */
export async function startTimer(taskId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (!session.user.personId) return { error: "Votre compte n’est relié à aucune fiche personne." };

  const now = new Date();
  await db.$transaction([
    db.timeEntry.updateMany({
      where: { personId: session.user.personId, endedAt: null },
      data: { endedAt: now },
    }),
    db.timeEntry.create({
      data: { taskId, personId: session.user.personId, startedAt: now },
    }),
  ]);

  revalidateTimeViews();
  return {};
}

export async function stopTimer(entryId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const entry = await db.timeEntry.findUnique({ where: { id: entryId }, select: { personId: true } });
  if (!entry) return { error: "Ce minuteur n’existe plus." };
  if (entry.personId !== session.user.personId && session.user.role !== "ADMIN") {
    return { error: "Vous ne pouvez arrêter que votre propre minuteur." };
  }

  await db.timeEntry.update({ where: { id: entryId }, data: { endedAt: new Date() } });
  revalidateTimeViews();
  return {};
}

const manualEntrySchema = z
  .object({
    taskId: z.string(),
    date: isoDate,
    hours: z.number().int().min(0).max(24),
    minutes: z.number().int().min(0).max(59),
    note: z.string().trim().max(500).nullable(),
  })
  .refine((v) => v.hours > 0 || v.minutes > 0, { message: "La durée doit être supérieure à zéro.", path: ["minutes"] });

/** Écriture manuelle : une durée posée sur une journée (pas d'heure de début/fin précise à saisir). */
export async function addManualEntry(input: z.infer<typeof manualEntrySchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (!session.user.personId) return { error: "Votre compte n’est relié à aucune fiche personne." };

  const parsed = manualEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { taskId, date, hours, minutes, note } = parsed.data;

  const startedAt = new Date(`${date}T09:00:00.000Z`);
  const endedAt = new Date(startedAt.getTime() + (hours * 60 + minutes) * 60_000);

  await db.timeEntry.create({
    data: { taskId, personId: session.user.personId, startedAt, endedAt, note: note || null },
  });

  revalidateTimeViews();
  return {};
}

const moveEntrySchema = z
  .object({
    entryId: z.string(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  })
  .refine((v) => v.endedAt > v.startedAt, { message: "La fin doit être après le début.", path: ["endedAt"] });

/** Déplacement/redimensionnement depuis le calendrier (glisser une écriture, ou son bord) — jamais sur un minuteur en cours. */
export async function updateTimeEntryTimes(input: z.infer<typeof moveEntrySchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = moveEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Créneau invalide." };
  const { entryId, startedAt, endedAt } = parsed.data;

  const entry = await db.timeEntry.findUnique({ where: { id: entryId }, select: { personId: true, endedAt: true } });
  if (!entry) return { error: "Cette écriture n’existe plus." };
  if (entry.personId !== session.user.personId && session.user.role !== "ADMIN") {
    return { error: "Vous ne pouvez modifier que vos propres écritures." };
  }
  if (entry.endedAt === null) return { error: "Un minuteur en cours ne se déplace pas — arrêtez-le d’abord." };

  await db.timeEntry.update({ where: { id: entryId }, data: { startedAt: new Date(startedAt), endedAt: new Date(endedAt) } });
  revalidateTimeViews();
  return {};
}

export async function deleteTimeEntry(entryId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const entry = await db.timeEntry.findUnique({ where: { id: entryId }, select: { personId: true } });
  if (!entry) return {};
  if (entry.personId !== session.user.personId && session.user.role !== "ADMIN") {
    return { error: "Vous ne pouvez retirer que vos propres écritures." };
  }

  await db.timeEntry.delete({ where: { id: entryId } });
  revalidateTimeViews();
  return {};
}
