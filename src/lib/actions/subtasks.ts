"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function revalidateTaskViews() {
  revalidatePath("/taches");
  revalidatePath("/planning");
}

const addSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "Le titre est requis."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").nullable(),
});

export async function addSubtask(input: z.infer<typeof addSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { taskId, title, dueDate } = parsed.data;

  const count = await db.subtask.count({ where: { taskId } });
  await db.subtask.create({
    data: { taskId, title, dueDate: dueDate ? new Date(dueDate) : null, position: count },
  });
  revalidateTaskViews();
  return {};
}

export async function toggleSubtask(id: string, done: boolean): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  await db.subtask.update({ where: { id }, data: { done } });
  revalidateTaskViews();
  return {};
}

export async function deleteSubtask(id: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  await db.subtask.delete({ where: { id } });
  revalidateTaskViews();
  return {};
}
