"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MonthlyRecurrenceMode, RecurrenceFrequency } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifyAssignment } from "@/lib/mail/notify";
import {
  addDays,
  addDaysIso,
  addMonthsIso,
  addMonthsSameWeekdayIso,
  daysBetween,
  fromIsoDate,
  toIsoDate,
  today,
} from "@/lib/planning/dates";
import { currentActorName } from "./actor";
import { createNotification } from "./notifications";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export async function getTaskDetail(taskId: string) {
  const session = await auth();
  if (!session?.user) return null;
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: { include: { client: true } },
      studios: { include: { studio: true } },
      assignee: true,
      attachments: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      comments: { orderBy: { createdAt: "asc" }, include: { mentions: { include: { person: true } } } },
      subtasks: { orderBy: { position: "asc" } },
      status: true,
      // Nom + projet même si la tâche dont on dépend est à la corbeille —
      // sinon le formulaire l'affiche à tort comme "Aucune dépendance"
      // (elle n'apparaît plus dans les options actives, voir
      // listActiveTasksForForms) alors que le lien existe toujours.
      dependsOn: {
        select: {
          id: true,
          title: true,
          studios: { select: { studioId: true } },
          project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
        },
      },
      journalEntries: { orderBy: { createdAt: "desc" } },
      timeEntries: { orderBy: { startedAt: "desc" }, include: { person: { select: { name: true } } } },
    },
  });
  if (!task) return null;

  // Qui a passé combien de temps est réservé aux administrateurs (même
  // règle que Temps → Équipe et la fiche projet, voir getProjectDetail) —
  // sauf ses propres écritures, toujours visibles pour pouvoir les gérer
  // (arrêter un minuteur, retirer une écriture) sans dépendre du nom pour
  // se reconnaître dans la liste.
  if (session.user.role !== "ADMIN") {
    return {
      ...task,
      timeEntries: task.timeEntries.map((e) =>
        e.personId === session.user.personId
          ? e
          : { ...e, personId: null as string | null, person: null as { name: string } | null },
      ),
    };
  }
  return task;
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

interface DurationFields {
  startDate: string;
  endDate: string;
  maxDurationDays: number | null;
  recurrenceFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  recurrenceUntil: string | null;
}

function withDurationChecks<T extends z.ZodType<DurationFields>>(schema: T) {
  return schema.superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", message: "La fin ne peut pas précéder le début.", path: ["endDate"] });
      return;
    }
    if (v.maxDurationDays && daysBetween(v.startDate, v.endDate) + 1 > v.maxDurationDays) {
      ctx.addIssue({
        code: "custom",
        message: `La tâche dépasse la durée maximale fixée (${v.maxDurationDays} jour${v.maxDurationDays === 1 ? "" : "s"}).`,
        path: ["endDate"],
      });
    }
    if (v.recurrenceFrequency && v.recurrenceUntil && v.recurrenceUntil < v.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "La récurrence ne peut pas se terminer avant le début de la tâche.",
        path: ["recurrenceUntil"],
      });
    }
  });
}

const taskFieldsSchema = z.object({
  title: z.string().trim().min(1, "L’intitulé est requis."),
  description: z.string().trim().max(4000).nullable(),
  studioIds: z.array(z.string()).min(1, "Choisissez au moins un studio."),
  projectId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  startDate: isoDate,
  endDate: isoDate,
  maxDurationDays: z.number().int().positive().nullable(),
  dependsOnId: z.string().nullable(),
  estimatedHalfDays: z.number().int().min(0).nullable(),
  recurrenceFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).nullable(),
  /** Ignoré hors récurrence mensuelle — voir MonthlyRecurrenceMode. */
  recurrenceMonthlyMode: z.enum(["BY_DATE", "BY_WEEKDAY"]).nullable(),
  recurrenceInterval: z.number().int().min(1).nullable(),
  recurrenceUntil: isoDate.nullable(),
});

// Le statut n'est demandé qu'en création depuis une colonne du Kanban :
// partout ailleurs il reste absent et la tâche démarre dans le premier
// statut configuré. Optionnel, donc, plutôt qu'un champ de formulaire de
// plus dans le cas courant.
const createTaskSchema = withDurationChecks(taskFieldsSchema.extend({ statusId: z.string().optional() }));

export type CreateTaskInput = z.input<typeof createTaskSchema>;

export async function createTask(input: CreateTaskInput): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const {
    title,
    description,
    studioIds,
    projectId,
    assigneeId,
    startDate,
    endDate,
    maxDurationDays,
    dependsOnId,
    estimatedHalfDays,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceMonthlyMode,
    recurrenceUntil,
    statusId: requestedStatusId,
  } = parsed.data;

  // Sauf statut explicitement demandé (création depuis une colonne du
  // Kanban), une tâche démarre dans le premier statut configuré
  // (Réglages → Statuts, ordre d'affichage). L'identifiant reçu est vérifié
  // en base plutôt que cru sur parole : il vient du client.
  const defaultStatus = await db.taskStatus.findFirst({ orderBy: { position: "asc" } });
  if (!defaultStatus) return { error: "Aucun statut configuré — contactez un administrateur." };
  const requestedStatus = requestedStatusId
    ? await db.taskStatus.findUnique({ where: { id: requestedStatusId }, select: { id: true } })
    : null;
  if (requestedStatusId && !requestedStatus) return { error: "Statut inconnu." };

  const task = await db.task.create({
    data: {
      title,
      description: description || null,
      studios: { create: studioIds.map((studioId) => ({ studioId })) },
      projectId: projectId || null,
      assigneeId: assigneeId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxDurationDays,
      statusId: requestedStatus?.id ?? defaultStatus.id,
      dependsOnId: dependsOnId || null,
      estimatedHalfDays,
      recurrenceFrequency,
      recurrenceInterval: recurrenceFrequency ? recurrenceInterval : null,
      recurrenceMonthlyMode: recurrenceFrequency === "MONTHLY" ? (recurrenceMonthlyMode ?? "BY_DATE") : null,
      recurrenceUntil: recurrenceFrequency && recurrenceUntil ? new Date(recurrenceUntil) : null,
    },
    include: { project: true },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${title} » créée`,
      taskId: task.id,
    },
  });

  if (task.assigneeId) {
    void notifyAssignee(task.assigneeId, {
      id: task.id,
      title: task.title,
      projectName: task.project?.name ?? null,
      startDate: toIsoDate(task.startDate),
      endDate: toIsoDate(task.endDate),
    });
  }

  revalidateTaskViews();
  return { id: task.id };
}

/** Notifie l'attribution d'une tâche à la fois par courriel (si activé) et dans l'application. */
async function notifyAssignee(
  personId: string,
  task: { id: string; title: string; projectName: string | null; startDate: string; endDate: string },
): Promise<void> {
  void notifyAssignment(personId, task);
  await createNotification({
    recipientId: personId,
    type: "ASSIGNMENT",
    message: `Vous avez été attribué·e à la tâche « ${task.title} »`,
    link: `/taches/${task.id}`,
  });
}

/**
 * Remonte la chaîne des prédécesseurs depuis `proposedDependsOnId` : si on
 * retombe sur `taskId`, l'enregistrer créerait un cycle (A dépend de B qui
 * dépend de A). `visited` protège contre une boucle infinie si un cycle
 * existait déjà en base par ailleurs — ne devrait pas arriver puisque ce
 * contrôle est le seul point d'écriture de `dependsOnId`, mais un filet peu
 * coûteux plutôt qu'une boucle infinie en cas de donnée déjà incohérente.
 */
async function wouldCreateDependencyCycle(taskId: string, proposedDependsOnId: string): Promise<boolean> {
  let currentId: string | null = proposedDependsOnId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const row: { dependsOnId: string | null } | null = await db.task.findUnique({
      where: { id: currentId },
      select: { dependsOnId: true },
    });
    currentId = row?.dependsOnId ?? null;
  }
  return false;
}

function shiftRecurrenceDates(
  startDate: string,
  endDate: string,
  frequency: RecurrenceFrequency,
  interval: number,
  monthlyMode: MonthlyRecurrenceMode | null,
): { startDate: string; endDate: string } {
  if (frequency === "DAILY") {
    return { startDate: addDaysIso(startDate, interval), endDate: addDaysIso(endDate, interval) };
  }
  if (frequency === "WEEKLY") {
    return { startDate: addDaysIso(startDate, 7 * interval), endDate: addDaysIso(endDate, 7 * interval) };
  }
  // Mensuel : soit le même quantième, soit le même rang de jour de semaine.
  // La durée de la tâche est reportée telle quelle sur la nouvelle date de
  // début, pour que « premier lundi, sur trois jours » le reste.
  if (monthlyMode === "BY_WEEKDAY") {
    const nextStart = addMonthsSameWeekdayIso(startDate, interval);
    return { startDate: nextStart, endDate: addDaysIso(nextStart, daysBetween(startDate, endDate)) };
  }
  return { startDate: addMonthsIso(startDate, interval), endDate: addMonthsIso(endDate, interval) };
}

interface RecurringTaskSource {
  id: string;
  title: string;
  description: string | null;
  studios: { studioId: string }[];
  projectId: string | null;
  assigneeId: string | null;
  startDate: Date;
  endDate: Date;
  maxDurationDays: number | null;
  estimatedHalfDays: number | null;
  recurrenceFrequency: RecurrenceFrequency | null;
  recurrenceInterval: number | null;
  recurrenceMonthlyMode: MonthlyRecurrenceMode | null;
  recurrenceUntil: Date | null;
  status: { isDone: boolean };
}

/**
 * Génère l'occurrence suivante d'une tâche récurrente quand elle passe à un
 * statut "Terminé". `recurrenceParentId` sert de garde-fou : si une
 * occurrence a déjà été générée à partir de cette tâche (ex. le statut
 * repasse par "Terminé" une seconde fois), on ne la duplique pas. La
 * dépendance (`dependsOnId`) n'est volontairement pas reportée sur la
 * nouvelle occurrence — chaque occurrence redémarre indépendante plutôt que
 * d'hériter d'une chaîne de dépendances qui n'a plus de sens une fois
 * décalée dans le temps.
 */
async function maybeGenerateNextOccurrence(
  task: RecurringTaskSource,
  actor: { personId?: string | null; name?: string | null; email?: string | null },
): Promise<void> {
  if (!task.status.isDone || !task.recurrenceFrequency) return;

  const alreadyGenerated = await db.task.findFirst({
    where: { recurrenceParentId: task.id },
    select: { id: true },
  });
  if (alreadyGenerated) return;

  const interval = task.recurrenceInterval ?? 1;
  const next = shiftRecurrenceDates(
    toIsoDate(task.startDate),
    toIsoDate(task.endDate),
    task.recurrenceFrequency,
    interval,
    task.recurrenceMonthlyMode,
  );
  if (task.recurrenceUntil && next.startDate > toIsoDate(task.recurrenceUntil)) return;

  const defaultStatus = await db.taskStatus.findFirst({ orderBy: { position: "asc" } });
  if (!defaultStatus) return;

  const created = await db.task.create({
    data: {
      title: task.title,
      description: task.description,
      studios: { create: task.studios.map(({ studioId }) => ({ studioId })) },
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      startDate: new Date(next.startDate),
      endDate: new Date(next.endDate),
      maxDurationDays: task.maxDurationDays,
      estimatedHalfDays: task.estimatedHalfDays,
      statusId: defaultStatus.id,
      recurrenceFrequency: task.recurrenceFrequency,
      recurrenceInterval: task.recurrenceInterval,
      recurrenceMonthlyMode: task.recurrenceMonthlyMode,
      recurrenceUntil: task.recurrenceUntil,
      recurrenceParentId: task.id,
    },
    include: { project: true },
  });

  await db.journalEntry.create({
    data: {
      actorId: actor.personId,
      actorName: actor.name ?? actor.email ?? "Anonyme",
      action: `Tâche « ${created.title} » générée automatiquement (récurrence)`,
      taskId: created.id,
    },
  });

  if (created.assigneeId) {
    void notifyAssignee(created.assigneeId, {
      id: created.id,
      title: created.title,
      projectName: created.project?.name ?? null,
      startDate: next.startDate,
      endDate: next.endDate,
    });
  }
}

const updateTaskSchema = withDurationChecks(
  taskFieldsSchema.extend({
    taskId: z.string(),
    statusId: z.string().min(1, "Le statut est requis."),
    expectedVersion: z.number().int(),
  }),
);

export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export async function updateTask(input: UpdateTaskInput): Promise<{ error?: string; version?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const {
    taskId,
    title,
    description,
    studioIds,
    projectId,
    assigneeId,
    startDate,
    endDate,
    maxDurationDays,
    statusId,
    dependsOnId,
    estimatedHalfDays,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceUntil,
    expectedVersion,
  } = parsed.data;

  if (dependsOnId === taskId) {
    return { error: "Une tâche ne peut pas dépendre d’elle-même." };
  }
  if (dependsOnId && (await wouldCreateDependencyCycle(taskId, dependsOnId))) {
    return { error: "Cette dépendance créerait un cycle (les deux tâches finiraient par dépendre l’une de l’autre)." };
  }

  const before = await db.task.findUnique({ where: { id: taskId }, select: { assigneeId: true } });

  const result = await db.task.updateMany({
    where: { id: taskId, version: expectedVersion },
    data: {
      title,
      description: description || null,
      projectId: projectId || null,
      assigneeId: assigneeId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxDurationDays,
      statusId,
      dependsOnId: dependsOnId || null,
      estimatedHalfDays,
      recurrenceFrequency,
      recurrenceInterval: recurrenceFrequency ? recurrenceInterval : null,
      recurrenceUntil: recurrenceFrequency && recurrenceUntil ? new Date(recurrenceUntil) : null,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    return { error: "Cette tâche a été modifiée entre-temps par quelqu’un d’autre. Rechargez la page." };
  }

  // Studios remplacés à part (updateMany ne peut pas écrire une relation) —
  // sûr une fois le verrou optimiste ci-dessus passé : personne d'autre n'a
  // pu écrire cette même version entre-temps.
  await db.$transaction([
    db.taskStudio.deleteMany({ where: { taskId } }),
    db.taskStudio.createMany({ data: studioIds.map((studioId) => ({ taskId, studioId })) }),
  ]);

  const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, include: { project: true, status: true, studios: { select: { studioId: true } } } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${title} » modifiée`,
      taskId: task.id,
    },
  });

  if (task.assigneeId && task.assigneeId !== before?.assigneeId) {
    void notifyAssignee(task.assigneeId, {
      id: task.id,
      title: task.title,
      projectName: task.project?.name ?? null,
      startDate: toIsoDate(task.startDate),
      endDate: toIsoDate(task.endDate),
    });
  }

  await maybeGenerateNextOccurrence(task, session.user);

  revalidateTaskViews();
  return { version: task.version };
}

const updateStatusSchema = z.object({
  taskId: z.string(),
  statusId: z.string().min(1),
  expectedVersion: z.number().int(),
});

/** Déplacement d'une carte entre colonnes depuis le Kanban — même principe que rescheduleTask, sur le statut seul. */
export async function updateTaskStatus(
  input: z.infer<typeof updateStatusSchema>,
): Promise<{ error?: string; version?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const { taskId, statusId, expectedVersion } = updateStatusSchema.parse(input);

  const result = await db.task.updateMany({
    where: { id: taskId, version: expectedVersion },
    data: { statusId, version: { increment: 1 } },
  });

  if (result.count === 0) {
    return { error: "Cette tâche a été modifiée entre-temps par quelqu’un d’autre. Rechargez la page." };
  }

  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { status: true, studios: { select: { studioId: true } } },
  });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${task.title} » déplacée vers « ${task.status.name} »`,
      taskId: task.id,
    },
  });

  await maybeGenerateNextOccurrence(task, session.user);

  revalidateTaskViews();
  return { version: task.version };
}

const bulkUpdateSchema = z
  .object({
    taskIds: z.array(z.string()).min(1),
    statusId: z.string().optional(),
    // Absent = pas touché ; null = retirer l'attribution ; sinon nouvelle personne.
    assigneeId: z.string().nullable().optional(),
  })
  .refine((v) => v.statusId !== undefined || v.assigneeId !== undefined, {
    message: "Rien à modifier.",
  });

/**
 * Modification groupée (statut et/ou personne) depuis la sélection multiple
 * de la liste Tâches. Sans verrouillage optimiste par tâche (à la différence
 * de updateTaskStatus/rescheduleTask) : une action groupée porte sur des
 * lignes qu'on vient de voir à l'écran, le risque de collision est faible et
 * un verrou par ligne rendrait l'opération inutilement fragile (une seule
 * tâche modifiée entre-temps ferait échouer tout le lot).
 */
export async function bulkUpdateTasks(
  input: z.infer<typeof bulkUpdateSchema>,
): Promise<{ error?: string; count?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = bulkUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Requête invalide." };
  const { taskIds, statusId, assigneeId } = parsed.data;

  const data: { statusId?: string; assigneeId?: string | null; version: { increment: number } } = {
    version: { increment: 1 },
  };
  if (statusId !== undefined) data.statusId = statusId;
  if (assigneeId !== undefined) data.assigneeId = assigneeId;

  const result = await db.task.updateMany({ where: { id: { in: taskIds }, trashedAt: null }, data });
  if (result.count === 0) return { error: "Aucune tâche modifiée." };

  const parts = [statusId !== undefined && "statut", assigneeId !== undefined && "personne"].filter(Boolean);
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `${result.count} tâche${result.count > 1 ? "s" : ""} modifiée${result.count > 1 ? "s" : ""} en groupe (${parts.join(", ")})`,
    },
  });

  revalidateTaskViews();
  return { count: result.count };
}

const rescheduleSchema = z.object({
  taskId: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  expectedVersion: z.number().int(),
});

/**
 * Déplacement/redimensionnement depuis le Gantt. Verrouillage optimiste : si
 * la version en base a changé depuis la lecture côté client (quelqu'un
 * d'autre a modifié la tâche entre-temps), on refuse plutôt que d'écraser —
 * voir docs/plan-architecture.md.
 */
export async function rescheduleTask(
  input: z.infer<typeof rescheduleSchema>,
): Promise<{ error?: string; version?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const { taskId, startDate, endDate, expectedVersion } = rescheduleSchema.parse(input);

  const result = await db.task.updateMany({
    where: { id: taskId, version: expectedVersion },
    data: { startDate: new Date(startDate), endDate: new Date(endDate), version: { increment: 1 } },
  });

  if (result.count === 0) {
    return { error: "Cette tâche a été modifiée entre-temps par quelqu’un d’autre. Rechargez la page." };
  }

  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${task.title} » replanifiée`,
      taskId: task.id,
    },
  });

  revalidateTaskViews();
  return { version: task.version };
}

/**
 * Duplique une seule tâche — pendant de duplicateProject (projects.ts) à
 * l'échelle d'une tâche, pour une activité récurrente sans dupliquer tout
 * un projet. Dépendance conservée (le clone dépend du même prédécesseur
 * que l'original) ; sous-tâches copiées et remises à "non fait" ; statut
 * remis au premier de la liste — un clone démarre un nouveau cycle, pas la
 * suite de l'original. Dates décalées pour démarrer aujourd'hui, durée
 * conservée. Écritures de temps, commentaires, pièces jointes et
 * récurrence ne sont pas copiés — propres à l'historique de l'original.
 */
export async function duplicateTask(taskId: string): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const source = await db.task.findUnique({
    where: { id: taskId },
    include: { subtasks: { orderBy: { position: "asc" } }, studios: { select: { studioId: true } } },
  });
  if (!source) return { error: "Cette tâche n’existe plus." };

  const firstStatus = await db.taskStatus.findFirst({ orderBy: { position: "asc" } });
  const offsetDays = Math.round((fromIsoDate(today()).getTime() - source.startDate.getTime()) / 86_400_000);
  const shift = (d: Date) => addDays(d, offsetDays);

  const clone = await db.task.create({
    data: {
      title: `${source.title} (copie)`,
      description: source.description,
      projectId: source.projectId,
      studios: { create: source.studios.map(({ studioId }) => ({ studioId })) },
      assigneeId: source.assigneeId,
      startDate: shift(source.startDate),
      endDate: shift(source.endDate),
      maxDurationDays: source.maxDurationDays,
      estimatedHalfDays: source.estimatedHalfDays,
      statusId: firstStatus?.id ?? source.statusId,
      dependsOnId: source.dependsOnId,
    },
  });

  for (const s of source.subtasks) {
    await db.subtask.create({
      data: {
        taskId: clone.id,
        title: s.title,
        dueDate: s.dueDate ? shift(s.dueDate) : null,
        assigneeId: s.assigneeId,
        done: false,
        position: s.position,
      },
    });
  }

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${source.title} » dupliquée`,
      taskId: clone.id,
    },
  });

  revalidateTaskViews();
  return { id: clone.id };
}

export async function trashTask(taskId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const existing = await db.task.findUnique({ where: { id: taskId }, select: { assigneeId: true } });
  if (!existing) return { error: "Cette tâche n’existe plus." };
  if (session.user.role !== "ADMIN" && existing.assigneeId !== session.user.personId) {
    return { error: "Seul un administrateur ou la personne attribuée peut mettre cette tâche à la corbeille." };
  }

  const task = await db.task.update({ where: { id: taskId }, data: { trashedAt: new Date() } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${task.title} » mise à la corbeille`,
      taskId: task.id,
    },
  });

  revalidateTaskViews();
  return {};
}

export async function restoreTask(taskId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." };

  const task = await db.task.update({ where: { id: taskId }, data: { trashedAt: null } });
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${task.title} » restaurée`,
      taskId: task.id,
    },
  });

  revalidateTaskViews();
  return {};
}

/** Suppression définitive — réservée aux administrateurs, contrairement à trashTask. */
export async function destroyTask(taskId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." };

  const existing = await db.task.findUnique({ where: { id: taskId }, select: { title: true } });
  if (!existing) return { error: "Cette tâche n’existe plus." };

  // L'écriture du journal référence encore la tâche avant sa suppression :
  // la contrainte `onDelete: SetNull` détachera ensuite `taskId` tout en
  // gardant le texte de l'entrée — la trace survit à la tâche elle-même.
  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Tâche « ${existing.title} » supprimée définitivement`,
      taskId,
    },
  });
  await db.task.delete({ where: { id: taskId } });

  revalidateTaskViews();
  revalidatePath("/reglages");
  return {};
}

function revalidateTaskViews() {
  revalidatePath("/taches");
  revalidatePath("/projets");
  revalidatePath("/planning");
  revalidatePath("/reglages");
}
