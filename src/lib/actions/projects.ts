"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Un projet référence soit un client existant (clientId), soit un nom à
 * créer à la volée (newClientName) — la liste des clients se gère aussi
 * depuis Réglages, mais on ne veut pas obliger à y passer avant de pouvoir
 * créer un projet pour un nouveau client.
 */
const clientRefSchema = z
  .object({
    clientId: z.string().nullable(),
    newClientName: z.string().trim().nullable(),
  })
  .refine((v) => v.clientId || v.newClientName, {
    message: "Choisissez un client ou saisissez-en un nouveau.",
    path: ["clientId"],
  });

async function resolveClientId(ref: z.infer<typeof clientRefSchema>): Promise<string> {
  if (ref.clientId) return ref.clientId;
  const name = ref.newClientName!;
  const client = await db.client.upsert({ where: { name }, update: {}, create: { name } });
  return client.id;
}

const projectTypeSchema = z.enum(["EXTERNE", "EQUIPE_EDUCATIVE", "EUROPEEN", "FONCTIONNEMENT"]);

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Le nom du projet est requis."),
  code: z.string().trim().nullable(),
  type: z.enum(["INTERNAL", "EXTERNAL"]),
  projectType: projectTypeSchema,
  studioIds: z.array(z.string()).min(1, "Choisissez au moins un studio."),
}).and(clientRefSchema);

export type CreateProjectInput = z.input<typeof createProjectSchema>;

export async function createProject(input: CreateProjectInput): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, code, type, projectType, studioIds } = parsed.data;
  const clientId = await resolveClientId(parsed.data);

  const project = await db.project.create({
    data: {
      name,
      code: code || null,
      clientId,
      type,
      projectType,
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

export async function getProjectDetail(projectId: string) {
  const session = await auth();
  if (!session?.user) return null;
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      studios: { include: { studio: true } },
      milestones: { orderBy: { dueDate: "asc" } },
      // Écritures rattachées directement au projet ("AGENCE"/hors-tâche
      // n'existe pas ici puisque c'est justement un vrai projet) — voir
      // src/lib/data/time-entries.ts pour la même logique côté budget global.
      timeEntries: { select: { startedAt: true, endedAt: true } },
      tasks: {
        where: { trashedAt: null },
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          status: { select: { name: true, colorHex: true, fillHex: true } },
          assignee: { select: { name: true } },
          timeEntries: { select: { startedAt: true, endedAt: true } },
        },
      },
      _count: { select: { tasks: { where: { trashedAt: null } } } },
    },
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>;

const updateProjectSchema = z.object({
  projectId: z.string(),
  name: z.string().trim().min(1, "Le nom du projet est requis."),
  code: z.string().trim().nullable(),
  type: z.enum(["INTERNAL", "EXTERNAL"]),
  projectType: projectTypeSchema,
  studioIds: z.array(z.string()).min(1, "Choisissez au moins un studio."),
  budgetHours: z.number().int().positive().nullable(),
}).and(clientRefSchema);

export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export async function updateProject(input: UpdateProjectInput): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { projectId, name, code, type, projectType, studioIds, budgetHours } = parsed.data;
  const clientId = await resolveClientId(parsed.data);

  await db.$transaction([
    db.projectStudio.deleteMany({ where: { projectId } }),
    db.project.update({
      where: { id: projectId },
      data: {
        name,
        code: code || null,
        clientId,
        type,
        projectType,
        budgetHours,
        studios: { create: studioIds.map((studioId) => ({ studioId })) },
      },
    }),
  ]);

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: session.user.name ?? session.user.email ?? "Anonyme",
      action: `Projet « ${name} » modifié`,
    },
  });

  revalidatePath("/projets");
  revalidatePath("/taches");
  revalidatePath("/planning");
  return {};
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
