"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runDailyDigest } from "@/lib/mail/notify";

const prefsSchema = z.object({
  notifyOnAssignment: z.boolean(),
  notifyDailyDigest: z.boolean(),
});

export async function updateNotificationPrefs(input: z.infer<typeof prefsSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const { notifyOnAssignment, notifyDailyDigest } = prefsSchema.parse(input);
  await db.user.update({
    where: { id: session.user.id },
    data: { notifyOnAssignment, notifyDailyDigest },
  });
  revalidatePath("/", "layout");
  return {};
}

/** Test manuel du récap quotidien depuis Réglages — réservé aux administrateurs. */
export async function sendDailyDigestNow(): Promise<{ error?: string; sent?: number; skipped?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." };

  const result = await runDailyDigest();
  return result;
}
