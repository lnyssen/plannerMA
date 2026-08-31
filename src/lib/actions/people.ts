"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { inviteEmail, passwordResetEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/transport";

const personSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  team: z.string().trim(),
  email: z.string().trim().email("Courriel invalide.").or(z.literal("")),
  external: z.boolean(),
  studioIds: z.array(z.string()),
});

export type PersonInput = z.input<typeof personSchema>;

function revalidatePeopleViews() {
  revalidatePath("/equipe");
  revalidatePath("/planning");
  revalidatePath("/taches");
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." } as const;
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." } as const;
  return { session } as const;
}

export async function createPerson(input: PersonInput): Promise<{ error?: string; id?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const { session } = auth_;
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, team, email, external, studioIds } = parsed.data;

  if (email) {
    const existing = await db.person.findFirst({ where: { email } });
    if (existing) return { error: "Cette adresse courriel est déjà utilisée par une autre personne." };
  }

  const person = await db.person.create({
    data: {
      name,
      team: team || null,
      email: email || null,
      external,
      studios: { create: studioIds.map((studioId) => ({ studioId })) },
    },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `${name} ajouté${external ? "e" : ""} à l’équipe`,
    },
  });

  revalidatePeopleViews();
  return { id: person.id };
}

export async function updatePerson(personId: string, input: PersonInput): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const { session } = auth_;
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, team, email, external, studioIds } = parsed.data;

  if (email) {
    const existing = await db.person.findFirst({ where: { email, id: { not: personId } } });
    if (existing) return { error: "Cette adresse courriel est déjà utilisée par une autre personne." };
  }

  await db.$transaction([
    db.personStudio.deleteMany({ where: { personId } }),
    db.person.update({
      where: { id: personId },
      data: {
        name,
        team: team || null,
        email: email || null,
        external,
        studios: { create: studioIds.map((studioId) => ({ studioId })) },
      },
    }),
  ]);

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `${name} modifié·e`,
    },
  });

  revalidatePeopleViews();
  return {};
}

export async function getPersonDetail(personId: string) {
  const session = await auth();
  if (!session?.user) return null;
  return db.person.findUnique({
    where: { id: personId },
    include: { studios: true, user: { select: { id: true, email: true, role: true } } },
  });
}

/**
 * Offboarding sans perte d'historique : sort la personne des sélecteurs
 * (voir listPeople) sans toucher à ses tâches/écritures passées, qu'aucune
 * suppression n'existe pour dans ce modèle de données.
 */
export async function setPersonActive(personId: string, active: boolean): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const { session } = auth_;

  const person = await db.person.update({ where: { id: personId }, data: { active } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `${person.name} ${active ? "réactivé·e" : "désactivé·e"}`,
    },
  });

  revalidatePeopleViews();
  return {};
}

/** Retire le compte de connexion sans toucher à la fiche personne (historique, tâches, écritures intacts) — pas de suppression de compte possible autrement aujourd'hui (voir audit). */
export async function removeUserAccess(personId: string): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const { session } = auth_;

  const user = await db.user.findUnique({ where: { personId } });
  if (!user) return { error: "Cette personne n’a pas de compte de connexion." };

  if (user.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { error: "Impossible : ce serait le dernier compte administrateur." };
  }

  await db.user.delete({ where: { id: user.id } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Accès retiré pour ${user.email}`,
    },
  });

  revalidatePeopleViews();
  return {};
}

function generateTemporaryPassword(): string {
  // Lisible/copiable à la main si besoin (l'invitation par courriel reste
  // le chemin normal) — alphabet sans caractères ambigus (0/O, 1/l/I).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const inviteSchema = z.object({
  email: z.string().trim().email("Courriel invalide."),
  role: z.enum(["ADMIN", "STUDIO_LEAD", "COLLABORATOR"]),
});

/**
 * Crée un compte de connexion pour une personne déjà dans l'équipe, avec un
 * mot de passe généré automatiquement envoyé par courriel — répond à la
 * question ouverte de l'audit ("aucun moyen d'inviter"), symétrique de
 * removeUserAccess.
 */
export async function invitePerson(
  personId: string,
  input: z.infer<typeof inviteSchema>,
): Promise<{ error?: string; temporaryPassword?: string; emailSent?: boolean }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const { session } = auth_;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { email, role } = parsed.data;

  const person = await db.person.findUnique({ where: { id: personId }, include: { user: true } });
  if (!person) return { error: "Cette personne n’existe plus." };
  if (person.user) return { error: "Cette personne a déjà un compte de connexion." };

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) return { error: "Cette adresse courriel est déjà utilisée par un autre compte." };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await db.$transaction([
    db.user.create({ data: { email, passwordHash, role: role as Role, personId } }),
    ...(person.email !== email ? [db.person.update({ where: { id: personId }, data: { email } })] : []),
  ]);

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Accès de connexion créé pour ${person.name} (${email})`,
    },
  });

  try {
    const { subject, text, html } = inviteEmail(person.name, email, temporaryPassword);
    await sendMail({ to: email, subject, text, html });
  } catch (err) {
    // Le compte est créé même si le courriel échoue (SMTP_HOST absent ou
    // mal configuré, notamment en production) — le mot de passe généré est
    // donc toujours renvoyé pour que l'admin puisse le communiquer lui-même,
    // sinon il serait perdu (jamais stocké en clair, jamais réaffiché).
    console.error("[mail] échec de l'envoi de l'invitation :", err);
    revalidatePeopleViews();
    return {
      error: "Compte créé, mais l'envoi du courriel a échoué — communiquez le mot de passe ci-dessous vous-même.",
      temporaryPassword,
      emailSent: false,
    };
  }

  revalidatePeopleViews();
  return { temporaryPassword, emailSent: true };
}

/**
 * Génère un nouveau mot de passe pour un compte existant — répond au cas où
 * le mot de passe généré par invitePerson a été perdu (courriel jamais
 * envoyé faute de SMTP configuré, ou simplement oublié) sans autre moyen de
 * le récupérer, puisqu'il n'est jamais stocké en clair. Même mécanique que
 * invitePerson (mot de passe généré, courriel best-effort, renvoyé si
 * l'envoi échoue) mais sur un compte déjà lié plutôt qu'à la création.
 */
export async function resetPassword(personId: string): Promise<{ error?: string; temporaryPassword?: string; emailSent?: boolean }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const { session } = auth_;

  const person = await db.person.findUnique({ where: { id: personId }, include: { user: true } });
  if (!person) return { error: "Cette personne n’existe plus." };
  if (!person.user) return { error: "Cette personne n’a pas de compte de connexion." };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await db.user.update({ where: { id: person.user.id }, data: { passwordHash } });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Mot de passe réinitialisé pour ${person.name}`,
    },
  });

  try {
    const { subject, text, html } = passwordResetEmail(person.name, person.user.email, temporaryPassword);
    await sendMail({ to: person.user.email, subject, text, html });
  } catch (err) {
    console.error("[mail] échec de l'envoi de la réinitialisation :", err);
    revalidatePeopleViews();
    return {
      error: "Mot de passe réinitialisé, mais l'envoi du courriel a échoué — communiquez le mot de passe ci-dessous vous-même.",
      temporaryPassword,
      emailSent: false,
    };
  }

  revalidatePeopleViews();
  return { temporaryPassword, emailSent: true };
}

/**
 * Suppression réelle — réservée aux personnes sans historique qui serait
 * perdu (le temps enregistré et les absences sont liés en cascade). Avec un
 * historique existant, orienter vers setPersonActive (désactivation) plutôt
 * que perdre des données de suivi de temps utilisées pour le reporting.
 */
export async function deletePerson(personId: string): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const { session } = auth_;

  const person = await db.person.findUnique({ where: { id: personId }, include: { user: true } });
  if (!person) return {};

  const [timeEntryCount, absenceCount] = await Promise.all([
    db.timeEntry.count({ where: { personId } }),
    db.absence.count({ where: { personId } }),
  ]);
  if (timeEntryCount > 0 || absenceCount > 0) {
    return {
      error: `Impossible : ${timeEntryCount} écriture${timeEntryCount === 1 ? "" : "s"} de temps et ${absenceCount} absence${absenceCount === 1 ? "" : "s"} seraient perdues. Désactivez plutôt cette personne (conserve l’historique).`,
    };
  }

  if (person.user?.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { error: "Impossible : ce serait le dernier compte administrateur." };
  }

  await db.$transaction([
    ...(person.user ? [db.user.delete({ where: { id: person.user.id } })] : []),
    db.person.delete({ where: { id: personId } }),
  ]);

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `${person.name} supprimé·e de l’équipe`,
    },
  });

  revalidatePeopleViews();
  return {};
}
