"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
