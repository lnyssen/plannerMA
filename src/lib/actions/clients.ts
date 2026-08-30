"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const nameSchema = z.string().trim().min(1, "Le nom du client est requis.");

export async function createClient(name: string): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  const existing = await db.client.findUnique({ where: { name: parsed.data } });
  if (existing) return { id: existing.id };

  const client = await db.client.create({ data: { name: parsed.data } });
  revalidatePath("/projets");
  revalidatePath("/reglages");
  return { id: client.id };
}

export async function renameClient(clientId: string, name: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  await db.client.update({ where: { id: clientId }, data: { name: parsed.data } });
  revalidatePath("/projets");
  revalidatePath("/reglages");
  return {};
}

export async function deleteClient(clientId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const projectCount = await db.project.count({ where: { clientId } });
  if (projectCount > 0) {
    return { error: `Ce client est utilisé par ${projectCount} projet${projectCount > 1 ? "s" : ""} : impossible de le retirer.` };
  }

  await db.client.delete({ where: { id: clientId } });
  revalidatePath("/reglages");
  return {};
}
