"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function revalidateCategoryViews() {
  revalidatePath("/reglages");
  revalidatePath("/temps");
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." } as const;
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." } as const;
  return { session } as const;
}

const nameSchema = z.string().trim().min(1, "Le nom est requis.");

/** `studioId` nul = catégorie générale (proposée pour tous les studios). */
export async function createTaskCategory(name: string, studioId: string | null): Promise<{ error?: string; id?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  const existing = await db.taskCategory.findFirst({ where: { studioId, name: parsed.data } });
  if (existing) return { error: "Cette catégorie existe déjà pour ce studio." };

  const count = await db.taskCategory.count({ where: { studioId } });
  const category = await db.taskCategory.create({ data: { name: parsed.data, studioId, position: count } });

  revalidateCategoryViews();
  return { id: category.id };
}

export async function renameTaskCategory(categoryId: string, name: string): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  await db.taskCategory.update({ where: { id: categoryId }, data: { name: parsed.data } });
  revalidateCategoryViews();
  return {};
}

/** Pour afficher un avertissement avant suppression — voir deleteTaskCategory, qui ne bloque pas mais ne doit pas surprendre. */
export async function countTaskCategoryUsage(categoryId: string): Promise<number> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return 0;
  return db.timeEntry.count({ where: { categoryId } });
}

/** Sans blocage sur l'usage : une écriture perd simplement sa catégorie (categoryId passe à nul, voir la clé étrangère) — countTaskCategoryUsage permet d'avertir avant coup plutôt que de surprendre. */
export async function deleteTaskCategory(categoryId: string): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;

  await db.taskCategory.delete({ where: { id: categoryId } });
  revalidateCategoryViews();
  return {};
}

/** Échange la position avec la catégorie immédiatement avant/après, dans le même groupe (général, ou même studio). */
export async function moveTaskCategory(categoryId: string, direction: "up" | "down"): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;

  const current = await db.taskCategory.findUnique({ where: { id: categoryId } });
  if (!current) return { error: "Catégorie introuvable." };

  const siblings = await db.taskCategory.findMany({ where: { studioId: current.studioId }, orderBy: { position: "asc" } });
  const index = siblings.findIndex((c) => c.id === categoryId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return {};

  await db.$transaction([
    db.taskCategory.update({ where: { id: siblings[index].id }, data: { position: siblings[swapWith].position } }),
    db.taskCategory.update({ where: { id: siblings[swapWith].id }, data: { position: siblings[index].position } }),
  ]);

  revalidateCategoryViews();
  return {};
}
