"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createNotification } from "./notifications";
import { timesheetLockFor } from "./timesheets";
import { formatDurationFr, sumDurationMinutes } from "@/lib/planning/time";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

function revalidateTimeViews() {
  revalidatePath("/temps");
  revalidatePath("/taches");
  revalidatePath("/projets");
}

const TIME_ENTRY_INCLUDE = {
  task: { select: { id: true, title: true, project: { select: { name: true, client: { select: { name: true } } } } } },
  project: { select: { id: true, name: true, code: true, client: { select: { name: true } } } },
  studio: { select: { id: true, name: true, colorHex: true, fillHex: true } },
  category: { select: { id: true, name: true } },
} as const;

/**
 * Contexte d'une écriture — Studio, Projet (nul = "AGENCE"/hors-projet) et
 * Catégorie, avec un lien facultatif vers une Task planifiée. Quand `taskId`
 * est fourni, Studio et Projet sont toujours dérivés de la tâche côté
 * serveur (source de vérité unique) plutôt que de faire confiance à ce que
 * le client a pu envoyer — seule la catégorie reste éditable indépendamment
 * dans ce cas.
 */
const entryContextSchema = z.object({
  taskId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  studioId: z.string().min(1, "Le studio est requis."),
  categoryId: z.string().nullable().optional(),
});

async function resolveEntryContext(
  input: z.infer<typeof entryContextSchema>,
): Promise<{ error: string } | { taskId: string | null; projectId: string | null; studioId: string; categoryId: string | null }> {
  if (input.taskId) {
    const task = await db.task.findUnique({
      where: { id: input.taskId },
      select: { studios: { select: { studioId: true } }, projectId: true, project: { select: { archived: true } } },
    });
    if (!task) return { error: "Cette tâche n’existe plus." };
    // Un projet archivé ne doit plus recevoir de nouveau suivi de temps —
    // même via une tâche encore liée (voir src/lib/data/tasks.ts, qui
    // l'exclut déjà des sélecteurs pour les nouvelles écritures).
    if (task.project?.archived) return { error: "Le projet de cette tâche est archivé — impossible d’y ajouter du temps." };
    // Une tâche peut appartenir à plusieurs studios (voir TaskStudio) : on
    // fait confiance au studio envoyé par le client s'il fait bien partie de
    // ceux de la tâche (ex. choisi explicitement quand plusieurs existent),
    // sinon on retombe sur le premier — jamais un studio hors de cette liste.
    const studioIds = task.studios.map((s) => s.studioId);
    const studioId = studioIds.includes(input.studioId) ? input.studioId : studioIds[0];
    if (!studioId) return { error: "Cette tâche n’a aucun studio associé." };
    return { taskId: input.taskId, projectId: task.projectId, studioId, categoryId: input.categoryId ?? null };
  }
  if (input.projectId) {
    const project = await db.project.findUnique({ where: { id: input.projectId }, select: { archived: true } });
    if (!project) return { error: "Ce projet n’existe plus." };
    if (project.archived) return { error: "Ce projet est archivé — impossible d’y ajouter du temps." };
  }
  return { taskId: null, projectId: input.projectId ?? null, studioId: input.studioId, categoryId: input.categoryId ?? null };
}

/**
 * Alerte les administrateurs (cloche, comme les autres notifications) quand
 * le temps enregistré sur un projet dépasse son budget — appelée après
 * chaque écriture qui change le total. Un seul rappel par 24h par projet
 * plutôt qu'à chaque nouvelle écriture une fois le seuil franchi (pas de
 * détection fine du franchissement, un minuteur en cours dérive déjà en
 * continu — un rappel journalier reste un signal utile sans spammer).
 */
async function checkAndNotifyBudget(projectId: string | null): Promise<void> {
  if (!projectId) return;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, budgetHours: true } });
  if (!project?.budgetHours) return;

  const [direct, viaTasks] = await Promise.all([
    db.timeEntry.findMany({ where: { projectId }, select: { startedAt: true, endedAt: true } }),
    db.timeEntry.findMany({ where: { task: { projectId } }, select: { startedAt: true, endedAt: true } }),
  ]);
  const totalMinutes = sumDurationMinutes([...direct, ...viaTasks]);
  const budgetMinutes = project.budgetHours * 60;
  if (totalMinutes <= budgetMinutes) return;

  const link = `/projets/${project.id}`;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.notification.findFirst({ where: { type: "BUDGET_EXCEEDED", link, createdAt: { gte: since } } });
  if (recent) return;

  const admins = await db.user.findMany({ where: { role: "ADMIN", personId: { not: null } }, select: { personId: true } });
  await Promise.all(
    admins
      .filter((a): a is { personId: string } => a.personId !== null)
      .map((a) =>
        createNotification({
          recipientId: a.personId,
          type: "BUDGET_EXCEEDED",
          message: `Le projet « ${project.name} » dépasse son budget de temps (${formatDurationFr(totalMinutes)} sur ${formatDurationFr(budgetMinutes)} prévues).`,
          link,
        }),
      ),
  );
}

/** Le minuteur en cours de l'utilisateur connecté (n'importe quel contexte), ou null. */
export async function getRunningTimer() {
  const session = await auth();
  if (!session?.user?.personId) return null;
  return db.timeEntry.findFirst({
    where: { personId: session.user.personId, endedAt: null },
    include: TIME_ENTRY_INCLUDE,
  });
}

export type RunningTimer = Awaited<ReturnType<typeof getRunningTimer>>;

/**
 * Démarre un minuteur — arrête d'abord celui en cours pour la même personne
 * s'il y en a un (un seul actif à la fois, comme Clockify), plutôt que de
 * refuser et obliger un aller-retour.
 */
export async function startTimer(input: z.infer<typeof entryContextSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (!session.user.personId) return { error: "Votre compte n’est relié à aucune fiche personne." };

  const parsed = entryContextSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const resolved = await resolveEntryContext(parsed.data);
  if ("error" in resolved) return resolved;

  const now = new Date();
  const locked = await timesheetLockFor(session.user.personId, now);
  if (locked) return { error: locked };

  await db.$transaction([
    db.timeEntry.updateMany({ where: { personId: session.user.personId, endedAt: null }, data: { endedAt: now } }),
    db.timeEntry.create({
      data: {
        personId: session.user.personId,
        startedAt: now,
        taskId: resolved.taskId,
        projectId: resolved.projectId,
        studioId: resolved.studioId,
        categoryId: resolved.categoryId,
      },
    }),
  ]);

  revalidateTimeViews();
  return {};
}

export async function stopTimer(entryId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const entry = await db.timeEntry.findUnique({ where: { id: entryId }, select: { personId: true, projectId: true } });
  if (!entry) return { error: "Ce minuteur n’existe plus." };
  if (entry.personId !== session.user.personId && session.user.role !== "ADMIN") {
    return { error: "Vous ne pouvez arrêter que votre propre minuteur." };
  }

  // Volontairement pas de contrôle de verrou ici : un minuteur lancé avant
  // que le mois ne soit remis doit pouvoir être arrêté, sinon il tournerait
  // indéfiniment. Il ne peut de toute façon pas avoir été démarré dans un
  // mois verrouillé (voir startTimer).
  await db.timeEntry.update({ where: { id: entryId }, data: { endedAt: new Date() } });
  await checkAndNotifyBudget(entry.projectId);
  revalidateTimeViews();
  return {};
}

const manualEntrySchema = entryContextSchema
  .extend({
    date: isoDate,
    hours: z.number().int().min(0).max(24),
    minutes: z.number().int().min(0).max(59),
    note: z.string().trim().max(500).nullable(),
  })
  .refine((v) => v.hours > 0 || v.minutes > 0, { message: "La durée doit être supérieure à zéro.", path: ["minutes"] });

/** Écriture manuelle : une durée posée sur une journée (pas d'heure de début/fin précise à saisir). */
export async function addManualEntry(input: z.infer<typeof manualEntrySchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (!session.user.personId) return { error: "Votre compte n’est relié à aucune fiche personne." };

  const parsed = manualEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { date, hours, minutes, note } = parsed.data;
  const resolved = await resolveEntryContext(parsed.data);
  if ("error" in resolved) return resolved;

  const startedAt = new Date(`${date}T09:00:00.000Z`);
  const endedAt = new Date(startedAt.getTime() + (hours * 60 + minutes) * 60_000);

  const locked = await timesheetLockFor(session.user.personId, startedAt);
  if (locked) return { error: locked };

  await db.timeEntry.create({
    data: {
      personId: session.user.personId,
      startedAt,
      endedAt,
      note: note || null,
      taskId: resolved.taskId,
      projectId: resolved.projectId,
      studioId: resolved.studioId,
      categoryId: resolved.categoryId,
    },
  });

  await checkAndNotifyBudget(resolved.projectId);
  revalidateTimeViews();
  return {};
}

const createAtSchema = entryContextSchema
  .extend({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  })
  .refine((v) => v.endedAt > v.startedAt, { message: "La fin doit être après le début.", path: ["endedAt"] });

/** Créée depuis un double-clic sur le calendrier : créneau précis plutôt qu'une date + durée (voir addManualEntry). */
export async function createTimeEntryAt(input: z.infer<typeof createAtSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (!session.user.personId) return { error: "Votre compte n’est relié à aucune fiche personne." };

  const parsed = createAtSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Créneau invalide." };
  const { startedAt, endedAt } = parsed.data;
  const resolved = await resolveEntryContext(parsed.data);
  if ("error" in resolved) return resolved;

  const locked = await timesheetLockFor(session.user.personId, new Date(startedAt));
  if (locked) return { error: locked };

  await db.timeEntry.create({
    data: {
      personId: session.user.personId,
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      taskId: resolved.taskId,
      projectId: resolved.projectId,
      studioId: resolved.studioId,
      categoryId: resolved.categoryId,
    },
  });

  await checkAndNotifyBudget(resolved.projectId);
  revalidateTimeViews();
  return {};
}

const moveEntrySchema = z
  .object({
    entryId: z.string(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    // Contexte facultatif — présent quand l'édition vient du popover
    // "Modifier le créneau" (qui permet aussi de changer studio/projet/
    // catégorie/tâche), absent quand elle vient d'un simple glisser/
    // redimensionner de bloc (seules les heures changent alors).
    taskId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    studioId: z.string().optional(),
    categoryId: z.string().nullable().optional(),
  })
  .refine((v) => v.endedAt > v.startedAt, { message: "La fin doit être après le début.", path: ["endedAt"] });

/** Déplacement/redimensionnement/édition depuis le calendrier — jamais sur un minuteur en cours. */
export async function updateTimeEntryTimes(input: z.infer<typeof moveEntrySchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = moveEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Créneau invalide." };
  const { entryId, startedAt, endedAt, studioId } = parsed.data;

  const entry = await db.timeEntry.findUnique({
    where: { id: entryId },
    select: { personId: true, startedAt: true, endedAt: true, projectId: true },
  });
  if (!entry) return { error: "Cette écriture n’existe plus." };
  if (entry.personId !== session.user.personId && session.user.role !== "ADMIN") {
    return { error: "Vous ne pouvez modifier que vos propres écritures." };
  }
  if (entry.endedAt === null) return { error: "Un minuteur en cours ne se déplace pas — arrêtez-le d’abord." };

  // Les deux mois comptent : sortir une écriture d'un mois verrouillé le
  // modifie autant que d'en poser une dedans.
  for (const when of [entry.startedAt, new Date(startedAt)]) {
    const locked = await timesheetLockFor(entry.personId, when);
    if (locked) return { error: locked };
  }

  let contextData: Partial<{ taskId: string | null; projectId: string | null; studioId: string; categoryId: string | null }> = {};
  if (studioId) {
    const resolved = await resolveEntryContext(parsed.data as z.infer<typeof entryContextSchema>);
    if ("error" in resolved) return resolved;
    contextData = resolved;
  }

  await db.timeEntry.update({
    where: { id: entryId },
    data: { startedAt: new Date(startedAt), endedAt: new Date(endedAt), ...contextData },
  });
  await checkAndNotifyBudget(contextData.projectId !== undefined ? contextData.projectId : entry.projectId);
  revalidateTimeViews();
  return {};
}

export async function deleteTimeEntry(entryId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const entry = await db.timeEntry.findUnique({ where: { id: entryId }, select: { personId: true, startedAt: true } });
  if (!entry) return {};
  if (entry.personId !== session.user.personId && session.user.role !== "ADMIN") {
    return { error: "Vous ne pouvez retirer que vos propres écritures." };
  }
  const locked = await timesheetLockFor(entry.personId, entry.startedAt);
  if (locked) return { error: locked };

  await db.timeEntry.delete({ where: { id: entryId } });
  revalidateTimeViews();
  return {};
}
