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

const navOrderSchema = z.array(z.string()).nullable();

/** Ordre personnalisé du menu de gauche — propre à chaque compte, pas un réglage admin. `null` réinitialise à l'ordre par défaut. */
export async function updateNavOrder(order: string[] | null): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = navOrderSchema.parse(order);
  await db.user.update({
    where: { id: session.user.id },
    data: { navOrder: parsed ? JSON.stringify(parsed) : null },
  });
  revalidatePath("/", "layout");
  return {};
}

const themeSchema = z.enum(["LIGHT", "DARK"]);

/** Thème d'affichage — propre à chaque compte, comme l'ordre du menu. */
export async function updateThemePreference(theme: "LIGHT" | "DARK"): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = themeSchema.parse(theme);
  await db.user.update({ where: { id: session.user.id }, data: { theme: parsed } });
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
