"use server";

// Réinitialisation de mot de passe en libre-service (écran de connexion,
// "Mot de passe oublié") — distinct de resetPassword (people.ts), réservé
// aux administrateurs et qui génère/affiche directement un mot de passe
// sans jeton ni courriel. Ici, la personne prouve qu'elle possède l'adresse
// en cliquant le lien reçu, puis choisit elle-même son nouveau mot de passe.

import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail/transport";
import { passwordResetRequestEmail, APP_URL } from "@/lib/mail/templates";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const requestSchema = z.string().trim().email();

/**
 * Toujours le même message de succès, que le compte existe ou non (et que
 * l'envoi du courriel réussisse ou non) — ne jamais révéler si une adresse
 * a un compte (énumération de comptes), ni exposer un échec SMTP à
 * quiconque tape une adresse au hasard sur cet écran public.
 */
export async function requestPasswordReset(rawEmail: string): Promise<{ error?: string }> {
  const parsed = requestSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: "Adresse courriel invalide." };
  const email = parsed.data.toLowerCase();

  const user = await db.user.findUnique({ where: { email }, include: { person: true } });
  if (user?.person) {
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });

    const resetUrl = `${APP_URL}/connexion/reinitialiser?token=${token}`;
    const { subject, text, html } = passwordResetRequestEmail(user.person.name, resetUrl);
    try {
      await sendMail({ to: user.email, subject, text, html });
    } catch (err) {
      // Ne remonte jamais à l'appelant : voir le commentaire de fonction —
      // un échec d'envoi (SMTP non configuré, notamment) ne doit ni bloquer
      // ni se distinguer du cas "compte inexistant" pour qui utilise cet écran.
      console.error("[mail] échec de la demande de réinitialisation :", err);
    }
  }

  return {};
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<{ error?: string }> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Requête invalide." };

  const tokenHash = hashToken(parsed.data.token);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Ce lien n’est plus valide — demandez-en un nouveau." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  const user = await db.user.findUnique({ where: { id: record.userId }, include: { person: true } });
  if (user) {
    await db.journalEntry.create({
      data: {
        actorId: user.personId,
        actorName: user.person?.name ?? user.email,
        action: "Mot de passe réinitialisé (lien reçu par courriel)",
      },
    });
  }

  return {};
}
