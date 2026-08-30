"use server";

import type { NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Créé depuis les autres actions serveur (attribution, mention, demande) —
 * pas de vérification de session ici, l'appelant est déjà dans un contexte
 * authentifié et a choisi le bon destinataire.
 */
export async function createNotification(input: {
  recipientId: string;
  type: NotificationType;
  message: string;
  link?: string | null;
}): Promise<void> {
  await db.notification.create({
    data: {
      recipientId: input.recipientId,
      type: input.type,
      message: input.message,
      link: input.link ?? null,
    },
  });
}

async function currentPersonId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.personId ?? null;
}

export async function listNotifications() {
  const personId = await currentPersonId();
  if (!personId) return [];
  return db.notification.findMany({
    where: { recipientId: personId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function unreadNotificationCount(): Promise<number> {
  const personId = await currentPersonId();
  if (!personId) return 0;
  return db.notification.count({ where: { recipientId: personId, read: false } });
}

export async function markNotificationRead(id: string): Promise<void> {
  const personId = await currentPersonId();
  if (!personId) return;
  await db.notification.updateMany({ where: { id, recipientId: personId }, data: { read: true } });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const personId = await currentPersonId();
  if (!personId) return;
  await db.notification.updateMany({ where: { recipientId: personId, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}
