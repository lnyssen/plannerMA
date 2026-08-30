"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

const absenceSchema = z
  .object({
    personId: z.string().min(1, "La personne est requise."),
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().trim(),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "La fin ne peut pas précéder le début.", path: ["endDate"] });

export type AbsenceInput = z.input<typeof absenceSchema>;

function revalidateAbsenceViews() {
  revalidatePath("/equipe");
  revalidatePath("/semaine");
  revalidatePath("/gantt");
}

export async function createAbsence(input: AbsenceInput): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { personId, startDate, endDate, reason } = parsed.data;

  await db.absence.create({
    data: { personId, startDate: new Date(startDate), endDate: new Date(endDate), reason: reason || null },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: "Absence enregistrée",
    },
  });

  revalidateAbsenceViews();
  return {};
}

export async function deleteAbsence(absenceId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  await db.absence.delete({ where: { id: absenceId } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: "Absence retirée",
    },
  });

  revalidateAbsenceViews();
  return {};
}
