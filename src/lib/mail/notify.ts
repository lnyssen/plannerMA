// Point d'entrée unique pour les notifications par courriel : alerte
// d'attribution et mention (tasks.ts / comments.ts), alerte de nouvelle
// demande (requests.ts, admins seulement) et récap quotidien (déclenché par
// la route /api/cron/daily-digest). Toutes respectent une préférence par
// compte (User.notifyOn*, réglables depuis « Mes notifications ») — voir le
// garde `if (!user.notifyOnX) return` au début de chaque fonction.

import { createNotification } from "@/lib/actions/notifications";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listProjectsWithBudget } from "@/lib/data/time-entries";
import { db } from "@/lib/db";
import { addDaysIso, today } from "@/lib/planning/dates";
import { computeDashboardRows } from "@/lib/planning/time";
import {
  assignmentEmail,
  dailyDigestEmail,
  mentionEmail,
  requestEmail,
  type AssignmentTaskInfo,
  type MentionInfo,
  type RequestInfo,
} from "./templates";
import { sendMail } from "./transport";

/**
 * Alerte d'attribution — appelée après la création/modification d'une tâche
 * si l'attributaire a changé. Contrairement aux autres alertes ci-dessous,
 * l'attributaire peut être une personne sans compte de connexion (externe,
 * freelance) — on part donc de `Person`, pas de `User`. Avec un compte lié,
 * son courriel et sa préférence prévalent ; sans compte, on retombe sur
 * `Person.email` s'il est renseigné (pas de préférence à vérifier : cette
 * personne n'a aucun moyen de la régler).
 */
export async function notifyAssignment(personId: string, task: AssignmentTaskInfo): Promise<void> {
  const person = await db.person.findUnique({ where: { id: personId }, include: { user: true } });
  if (!person) return;
  if (person.user && !person.user.notifyOnAssignment) return;
  const to = person.user?.email ?? person.email;
  if (!to) return;

  const { subject, text, html } = assignmentEmail(person.name, task, person.user !== null);
  try {
    await sendMail({ to, subject, text, html });
  } catch (err) {
    // Une notification en échec ne doit jamais faire échouer l'action métier
    // (création/modification de la tâche) qui l'a déclenchée.
    console.error("[mail] échec de l'alerte d'attribution :", err);
  }
}

/** Alerte de mention — appelée pour chaque personne taguée ("@Nom") dans un commentaire. */
export async function notifyMention(personId: string, info: MentionInfo): Promise<void> {
  const user = await db.user.findUnique({ where: { personId }, include: { person: true } });
  if (!user || !user.notifyOnMention || !user.person) return;

  const { subject, text, html } = mentionEmail(user.person.name, info);
  try {
    await sendMail({ to: user.email, subject, text, html });
  } catch (err) {
    console.error("[mail] échec de l'alerte de mention :", err);
  }
}

/** Alerte de nouvelle demande — appelée pour chaque administrateur à la création d'une demande. */
export async function notifyRequest(personId: string, info: RequestInfo): Promise<void> {
  const user = await db.user.findUnique({ where: { personId }, include: { person: true } });
  if (!user || !user.notifyOnRequest || !user.person) return;

  const { subject, text, html } = requestEmail(user.person.name, info);
  try {
    await sendMail({ to: user.email, subject, text, html });
  } catch (err) {
    console.error("[mail] échec de l'alerte de demande :", err);
  }
}

/**
 * Récap quotidien : une personne le reçoit si son compte l'a activé et
 * qu'elle a au moins une tâche active chevauchant les sept prochains jours
 * (en cours ou à venir sous peu — pas tout l'historique).
 */
export async function runDailyDigest(): Promise<{ sent: number; skipped: number }> {
  const users = await db.user.findMany({
    where: { notifyDailyDigest: true, personId: { not: null } },
    include: { person: true },
  });

  const from = today();
  const to = addDaysIso(from, 7);
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.person) continue;
    const tasks = await db.task.findMany({
      where: {
        assigneeId: user.person.id,
        trashedAt: null,
        startDate: { lte: new Date(to) },
        endDate: { gte: new Date(from) },
      },
      include: { project: true, status: true },
      orderBy: { startDate: "asc" },
    });

    if (tasks.length === 0) {
      skipped++;
      continue;
    }

    const { subject, text, html } = dailyDigestEmail(
      user.person.name,
      tasks.map((t) => ({
        title: t.title,
        projectName: t.project?.name ?? null,
        statusName: t.status.name,
        startDate: t.startDate.toISOString().slice(0, 10),
        endDate: t.endDate.toISOString().slice(0, 10),
      })),
    );
    try {
      await sendMail({ to: user.email, subject, text, html });
      sent++;
    } catch (err) {
      console.error(`[mail] échec du récap quotidien pour ${user.email} :`, err);
    }
  }

  return { sent, skipped };
}

/**
 * Alerte les administrateurs (cloche, comme les autres notifications) quand
 * un projet consomme son budget de temps plus vite qu'il n'avance (voir
 * computeDashboardRows/projectBudgetPace — le tableau de bord applique le
 * même calcul) — avant le dépassement franc, pas seulement une fois le
 * budget déjà dépassé (voir checkAndNotifyBudget dans time-entries.ts, qui
 * couvre ce cas-là séparément). Appelée par le même cron quotidien que le
 * récap, pas à chaque écriture de temps : le rythme dépend aussi de
 * l'avancement des tâches, qui peut changer sans nouvelle écriture — un
 * contrôle quotidien couvre les deux sans multiplier les points d'appel.
 * Un seul rappel par 24h par projet, même garde que checkAndNotifyBudget.
 */
export async function checkProjectPaceAlerts(): Promise<{ alerted: number }> {
  const [projects, statuses] = await Promise.all([listProjectsWithBudget(), listTaskStatuses()]);
  const allStatuses = statuses.map((s) => ({ position: s.position, isDone: s.isDone }));
  const rows = computeDashboardRows(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.client.name,
      budgetHours: p.budgetHours!,
      timeEntries: [...p.timeEntries, ...p.tasks.flatMap((t) => t.timeEntries)],
      taskStatuses: p.tasks.map((t) => t.status),
    })),
    allStatuses,
  );

  const behind = rows.filter((r) => r.pace === "behind");
  if (behind.length === 0) return { alerted: 0 };

  const admins = await db.user.findMany({ where: { role: "ADMIN", personId: { not: null } }, select: { personId: true } });
  const adminIds = admins.map((a) => a.personId).filter((id): id is string => id !== null);
  if (adminIds.length === 0) return { alerted: 0 };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let alerted = 0;
  for (const project of behind) {
    const link = `/projets/${project.id}`;
    const recent = await db.notification.findFirst({ where: { type: "PROJECT_BEHIND", link, createdAt: { gte: since } } });
    if (recent) continue;

    await Promise.all(
      adminIds.map((recipientId) =>
        createNotification({
          recipientId,
          type: "PROJECT_BEHIND",
          message: `Le projet « ${project.name} » consomme son budget de temps plus vite qu’il n’avance (${Math.round(project.consumedRatio * 100)}% consommé pour ${Math.round(project.progress * 100)}% avancé).`,
          link,
        }),
      ),
    );
    alerted++;
  }

  return { alerted };
}
