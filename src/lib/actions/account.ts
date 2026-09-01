"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runDailyDigest } from "@/lib/mail/notify";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit compter au moins 8 caractères."),
});

/** Change son propre mot de passe — notamment après une invitation par mot de passe généré automatiquement (voir invitePerson dans people.ts). */
export async function changePassword(input: z.infer<typeof passwordSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!user?.passwordHash) return { error: "Ce compte n’a pas de mot de passe (connexion par un autre moyen)." };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "Mot de passe actuel incorrect." };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.user.update({ where: { id: session.user.id }, data: { passwordHash } });
  return {};
}

const prefsSchema = z.object({
  notifyOnAssignment: z.boolean(),
  notifyDailyDigest: z.boolean(),
  notifyOnMention: z.boolean(),
  notifyOnRequest: z.boolean(),
  notifyOnComment: z.boolean(),
});

export async function updateNotificationPrefs(input: z.infer<typeof prefsSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const { notifyOnAssignment, notifyDailyDigest, notifyOnMention, notifyOnRequest, notifyOnComment } = prefsSchema.parse(input);
  await db.user.update({
    where: { id: session.user.id },
    data: { notifyOnAssignment, notifyDailyDigest, notifyOnMention, notifyOnRequest, notifyOnComment },
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
