"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { addDays, fromIsoDate, today } from "@/lib/planning/dates";
import { currentActorName } from "./actor";

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

// Le caractère interne/externe appartient au client, pas au projet : il
// n'apparaît plus ici (voir Client.type dans le schéma).
const poleSchema = z.enum(["FONCTIONNEMENT", "EQUIPE_EDUCATIVE", "EDUCATION_PERMANENTE", "EUROPEEN"]).nullable();

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Le nom du projet est requis."),
  code: z.string().trim().nullable(),
  pole: poleSchema,
  studioIds: z.array(z.string()).min(1, "Choisissez au moins un studio."),
}).and(clientRefSchema);

export type CreateProjectInput = z.input<typeof createProjectSchema>;

export async function createProject(input: CreateProjectInput): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, code, pole, studioIds } = parsed.data;
  const clientId = await resolveClientId(parsed.data);

  const project = await db.project.create({
    data: {
      name,
      code: code || null,
      clientId,
      pole,
      studios: { create: studioIds.map((studioId) => ({ studioId })) },
    },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Projet « ${name} » créé`,
      projectId: project.id,
    },
  });

  revalidatePath("/projets");
  return { id: project.id };
}

/**
 * Duplique un projet — nom, client, type, budget, studios, et ses tâches
 * actives (hors corbeille) avec leurs sous-tâches, dépendances (remappées
 * vers les clones) et jalons. Sert de "modèle" léger pour un studio qui
 * refait souvent le même type de projet, sans introduire de notion de
 * modèle distincte en base — dupliquer un projet existant suffit.
 *
 * Statuts remis à zéro (premier statut de la liste) et sous-tâches/jalons
 * remis à "non fait" : un clone démarre un nouveau cycle, pas la suite de
 * l'ancien. Écritures de temps, commentaires, pièces jointes et récurrence
 * ne sont volontairement pas copiés — propres à l'historique de l'original.
 *
 * Dates décalées pour que la tâche la plus tôt démarre aujourd'hui, en
 * conservant l'espacement relatif entre tâches : c'est l'enchaînement qui
 * fait la valeur d'un modèle, pas les dates passées elles-mêmes.
 */
export async function duplicateProject(projectId: string): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const source = await db.project.findUnique({
    where: { id: projectId },
    include: {
      studios: true,
      milestones: true,
      tasks: {
        where: { trashedAt: null },
        include: { subtasks: { orderBy: { position: "asc" } }, studios: { select: { studioId: true } } },
      },
    },
  });
  if (!source) return { error: "Projet introuvable." };

  const firstStatus = await db.taskStatus.findFirst({ orderBy: { position: "asc" } });

  const earliestTaskStart = source.tasks.reduce<Date | null>(
    (min, t) => (min === null || t.startDate < min ? t.startDate : min),
    null,
  );
  const offsetDays = earliestTaskStart
    ? Math.round((fromIsoDate(today()).getTime() - earliestTaskStart.getTime()) / 86_400_000)
    : 0;
  const shift = (d: Date) => addDays(d, offsetDays);

  const newProjectId = await db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: `${source.name} (copie)`,
        code: null,
        clientId: source.clientId,
        pole: source.pole,
        budgetHours: source.budgetHours,
        studios: { create: source.studios.map((s) => ({ studioId: s.studioId })) },
      },
    });

    const taskIdMap = new Map<string, string>();
    for (const t of source.tasks) {
      const clone = await tx.task.create({
        data: {
          title: t.title,
          description: t.description,
          projectId: project.id,
          studios: { create: t.studios.map(({ studioId }) => ({ studioId })) },
          assigneeId: t.assigneeId,
          startDate: shift(t.startDate),
          endDate: shift(t.endDate),
          maxDurationDays: t.maxDurationDays,
          estimatedHalfDays: t.estimatedHalfDays,
          statusId: firstStatus?.id ?? t.statusId,
        },
      });
      taskIdMap.set(t.id, clone.id);
    }

    // Deuxième passe : les dépendances pointent vers les tâches sources, à
    // remapper vers leurs clones une fois que tous existent.
    for (const t of source.tasks) {
      if (!t.dependsOnId) continue;
      const newDependsOnId = taskIdMap.get(t.dependsOnId);
      if (!newDependsOnId) continue;
      await tx.task.update({ where: { id: taskIdMap.get(t.id)! }, data: { dependsOnId: newDependsOnId } });
    }

    for (const t of source.tasks) {
      const newTaskId = taskIdMap.get(t.id)!;
      for (const s of t.subtasks) {
        await tx.subtask.create({
          data: {
            taskId: newTaskId,
            title: s.title,
            dueDate: s.dueDate ? shift(s.dueDate) : null,
            assigneeId: s.assigneeId,
            done: false,
            position: s.position,
          },
        });
      }
    }

    for (const m of source.milestones) {
      await tx.milestone.create({ data: { projectId: project.id, title: m.title, dueDate: shift(m.dueDate), isDone: false } });
    }

    return project.id;
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Projet « ${source.name} » dupliqué`,
      projectId: newProjectId,
    },
  });

  revalidatePath("/projets");
  return { id: newProjectId };
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
      journalEntries: { orderBy: { createdAt: "desc" } },
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
  pole: poleSchema,
  studioIds: z.array(z.string()).min(1, "Choisissez au moins un studio."),
  budgetHours: z.number().int().positive().nullable(),
}).and(clientRefSchema);

export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export async function updateProject(input: UpdateProjectInput): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { projectId, name, code, pole, studioIds, budgetHours } = parsed.data;
  const clientId = await resolveClientId(parsed.data);

  await db.$transaction([
    db.projectStudio.deleteMany({ where: { projectId } }),
    db.project.update({
      where: { id: projectId },
      data: {
        name,
        code: code || null,
        clientId,
        pole,
        budgetHours,
        studios: { create: studioIds.map((studioId) => ({ studioId })) },
      },
    }),
  ]);

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Projet « ${name} » modifié`,
      projectId,
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
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." };
  const { projectId, archived } = toggleArchiveSchema.parse(input);

  const project = await db.project.update({ where: { id: projectId }, data: { archived } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Projet « ${project.name} » ${archived ? "archivé" : "réactivé"}`,
      projectId,
    },
  });

  revalidatePath("/projets");
  return { ok: true };
}
