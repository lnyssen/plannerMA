"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

function revalidateMilestoneViews() {
  revalidatePath("/projets");
}

const createMilestoneSchema = z.object({
  projectId: z.string(),
  title: z.string().trim().min(1, "L’intitulé est requis."),
  dueDate: isoDate,
});

export async function createMilestone(
  input: z.infer<typeof createMilestoneSchema>,
): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createMilestoneSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { projectId, title, dueDate } = parsed.data;

  const milestone = await db.milestone.create({
    data: { projectId, title, dueDate: new Date(dueDate) },
  });

  revalidateMilestoneViews();
  return { id: milestone.id };
}

const updateMilestoneSchema = z.object({
  milestoneId: z.string(),
  title: z.string().trim().min(1, "L’intitulé est requis."),
  dueDate: isoDate,
});

export async function updateMilestone(input: z.infer<typeof updateMilestoneSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = updateMilestoneSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { milestoneId, title, dueDate } = parsed.data;

  await db.milestone.update({ where: { id: milestoneId }, data: { title, dueDate: new Date(dueDate) } });

  revalidateMilestoneViews();
  return {};
}

export async function setMilestoneDone(milestoneId: string, isDone: boolean): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  await db.milestone.update({ where: { id: milestoneId }, data: { isDone } });

  revalidateMilestoneViews();
  return {};
}

export async function deleteMilestone(milestoneId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  await db.milestone.delete({ where: { id: milestoneId } });

  revalidateMilestoneViews();
  return {};
}
