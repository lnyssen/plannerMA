"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// Même repli que pour un studio : pas de couleur "de secours" vérifiée AA,
// un placeholder neutre à corriger avant tout usage réel.
const PLACEHOLDER_FILL = "#e5e5e5";
const PLACEHOLDER_COLOR = "#444444";

function revalidateStatusViews() {
  revalidatePath("/reglages");
  revalidatePath("/projets");
  revalidatePath("/taches");
  revalidatePath("/planning");
  revalidatePath("/charge");
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." } as const;
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." } as const;
  return { session } as const;
}

const nameSchema = z.string().trim().min(1, "Le nom est requis.");

export async function renameTaskStatus(statusId: string, name: string): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  await db.taskStatus.update({ where: { id: statusId }, data: { name: parsed.data } });
  revalidateStatusViews();
  return {};
}

export async function createTaskStatus(name: string): Promise<{ error?: string; id?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  const count = await db.taskStatus.count();
  const status = await db.taskStatus.create({
    data: { name: parsed.data, fillHex: PLACEHOLDER_FILL, colorHex: PLACEHOLDER_COLOR, position: count },
  });

  revalidateStatusViews();
  return { id: status.id };
}

export async function setTaskStatusDone(statusId: string, isDone: boolean): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;

  await db.taskStatus.update({ where: { id: statusId }, data: { isDone } });
  revalidateStatusViews();
  return {};
}

/** Échange la position avec le statut immédiatement avant/après dans l'ordre — pas de glisser, juste haut/bas. */
export async function moveTaskStatus(statusId: string, direction: "up" | "down"): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;

  const statuses = await db.taskStatus.findMany({ orderBy: { position: "asc" } });
  const index = statuses.findIndex((s) => s.id === statusId);
  if (index === -1) return { error: "Statut introuvable." };
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= statuses.length) return {};

  await db.$transaction([
    db.taskStatus.update({ where: { id: statuses[index].id }, data: { position: statuses[swapWith].position } }),
    db.taskStatus.update({ where: { id: statuses[swapWith].id }, data: { position: statuses[index].position } }),
  ]);

  revalidateStatusViews();
  return {};
}
