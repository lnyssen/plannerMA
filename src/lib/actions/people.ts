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

export async function createPerson(input: PersonInput): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, team, email, external, studioIds } = parsed.data;

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
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, team, email, external, studioIds } = parsed.data;

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
  return db.person.findUnique({ where: { id: personId }, include: { studios: true } });
}
