"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifyRequest } from "@/lib/mail/notify";
import { currentActorName } from "./actor";
import { createNotification } from "./notifications";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

const createRequestSchema = z.object({
  subject: z.string().trim().min(1, "L’objet est requis.").max(200),
  studioId: z.string().min(1, "Le studio est requis."),
  requester: z.string().trim().max(200).nullable(),
  wantedFor: isoDate.nullable(),
  detail: z.string().trim().max(2000).nullable(),
});

export type CreateRequestInput = z.input<typeof createRequestSchema>;

/**
 * Demande non planifiée ("ce qu'on vous demande dans un couloir") — reçue
 * puis alerte les administrateurs (Notification de type REQUEST), qui la
 * convertissent en tâche ou l'écartent depuis Réglages → Demandes (voir
 * deleteRequest ci-dessous et src/app/(app)/demandes).
 */
export async function createRequest(input: CreateRequestInput): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { subject, studioId, requester, wantedFor, detail } = parsed.data;

  const studio = await db.studio.findUnique({ where: { id: studioId } });
  if (!studio) return { error: "Studio introuvable." };

  await db.request.create({
    data: {
      subject,
      studioId,
      requester: requester || null,
      wantedFor: wantedFor ? new Date(wantedFor) : null,
      detail: detail || null,
      createdBy: await currentActorName(session),
    },
  });

  const admins = await db.user.findMany({ where: { role: "ADMIN", personId: { not: null } } });
  for (const admin of admins) {
    if (!admin.personId) continue;
    void notifyRequest(admin.personId, { subject, studioName: studio.name, requester });
    await createNotification({
      recipientId: admin.personId,
      type: "REQUEST",
      message: `« ${subject} » — ${studio.name}.`,
    });
  }

  return {};
}

/** Écarte une demande — qu'elle ait été convertie en tâche ou jugée sans suite. Réservé aux administrateurs. */
export async function deleteRequest(requestId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." };

  await db.request.delete({ where: { id: requestId } });
  revalidatePath("/demandes");
  return {};
}
