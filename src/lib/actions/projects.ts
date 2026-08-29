"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Le nom du projet est requis."),
  client: z.string().trim().min(1, "Le client est requis."),
  type: z.enum(["INTERNAL", "EXTERNAL"]),
  studioIds: z.array(z.string()).min(1, "Choisissez au moins un studio."),
});

export type CreateProjectInput = z.input<typeof createProjectSchema>;

export async function createProject(input: CreateProjectInput): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, client, type, studioIds } = parsed.data;

  const project = await db.project.create({
    data: {
      name,
      client,
      type,
      studios: { create: studioIds.map((studioId) => ({ studioId })) },
    },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Projet « ${name} » créé`,
    },
  });

  revalidatePath("/projets");
  return { id: project.id };
}

const toggleArchiveSchema = z.object({ projectId: z.string(), archived: z.boolean() });

export async function setProjectArchived(input: z.infer<typeof toggleArchiveSchema>) {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const { projectId, archived } = toggleArchiveSchema.parse(input);

  const project = await db.project.update({ where: { id: projectId }, data: { archived } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Projet « ${project.name} » ${archived ? "archivé" : "réactivé"}`,
    },
  });

  revalidatePath("/projets");
  return { ok: true };
}
