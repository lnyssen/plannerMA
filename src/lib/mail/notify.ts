// Point d'entrée unique pour les deux notifications par courriel prévues :
// alerte d'attribution (déclenchée par les actions serveur de tasks.ts) et
// récap quotidien (déclenché par la route /api/cron/daily-digest). Les deux
// respectent les préférences par compte (User.notifyOnAssignment /
// notifyDailyDigest, réglables depuis « Mes notifications »).

import { db } from "@/lib/db";
import { addDaysIso, today } from "@/lib/planning/dates";
import { assignmentEmail, dailyDigestEmail, type AssignmentTaskInfo } from "./templates";
import { sendMail } from "./transport";

/** Alerte d'attribution — appelée après la création/modification d'une tâche si l'attributaire a changé. */
export async function notifyAssignment(personId: string, task: AssignmentTaskInfo): Promise<void> {
  const user = await db.user.findUnique({ where: { personId }, include: { person: true } });
  if (!user || !user.notifyOnAssignment || !user.person) return;

  const { subject, text, html } = assignmentEmail(user.person.name, task);
  try {
    await sendMail({ to: user.email, subject, text, html });
  } catch (err) {
    // Une notification en échec ne doit jamais faire échouer l'action métier
    // (création/modification de la tâche) qui l'a déclenchée.
    console.error("[mail] échec de l'alerte d'attribution :", err);
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
