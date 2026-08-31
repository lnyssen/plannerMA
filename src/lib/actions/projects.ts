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

/** Sélection des écritures avec qui les a passées — voir le filtrage anti-fuite plus bas dans getProjectDetail. */
const PROJECT_TIME_ENTRY_SELECT = {
  startedAt: true,
  endedAt: true,
  personId: true,
  person: { select: { name: true } },
} as const;

export async function getProjectDetail(projectId: string) {
  const session = await auth();
  if (!session?.user) return null;
  const isAdmin = session.user.role === "ADMIN";

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      studios: { include: { studio: true } },
      milestones: { orderBy: { dueDate: "asc" } },
      // Écritures rattachées directement au projet ("AGENCE"/hors-tâche
      // n'existe pas ici puisque c'est justement un vrai projet) — voir
      // src/lib/data/time-entries.ts pour la même logique côté budget global.
      timeEntries: { select: PROJECT_TIME_ENTRY_SELECT },
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
          timeEntries: { select: PROJECT_TIME_ENTRY_SELECT },
        },
      },
      _count: { select: { tasks: { where: { trashedAt: null } } } },
    },
  });
  if (!project) return null;

  // Qui a passé combien de temps est réservé aux administrateurs — même
  // règle que Temps → Équipe. Un collaborateur voit le total du projet
  // (déjà utilisé pour l'avertissement de budget) mais pas la répartition
  // par personne : personId/person sont mis à nul avant que la réponse ne
  // quitte le serveur, pas seulement cachés côté UI. Les deux branches
  // gardent la même forme (person nul plutôt qu'absent) pour rester un
  // type simple à discriminer côté client (voir edit-project-modal.tsx).
  if (!isAdmin) {
    const redactPerson = (e: { startedAt: Date; endedAt: Date | null }) => ({
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      personId: null as string | null,
      person: null as { name: string } | null,
    });
    return {
      ...project,
      timeEntries: project.timeEntries.map(redactPerson),
      tasks: project.tasks.map((t) => ({ ...t, timeEntries: t.timeEntries.map(redactPerson) })),
    };
  }
  return project;
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
