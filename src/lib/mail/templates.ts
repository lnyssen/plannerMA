// Gabarits de courriel — texte brut prioritaire (lu par tous les clients),
// HTML minimal pour ceux qui le rendent. Pas de logo/mise en forme riche :
// ce sont des notifications utilitaires, pas de la communication externe.

import { formatShortFr } from "@/lib/planning/dates";

const APP_URL = process.env.AUTH_URL || "http://localhost:3000";

function wrapHtml(title: string, bodyLines: string[]): string {
  const body = bodyLines.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join("\n");
  return `<div style="font-family:sans-serif;color:#1a1a1a"><h2 style="margin:0 0 12px">${title}</h2>${body}</div>`;
}

export interface AssignmentTaskInfo {
  id: string;
  title: string;
  projectName: string | null;
  startDate: string;
  endDate: string;
}

export function assignmentEmail(personName: string, task: AssignmentTaskInfo) {
  const range =
    task.startDate === task.endDate
      ? formatShortFr(task.startDate)
      : `du ${formatShortFr(task.startDate)} au ${formatShortFr(task.endDate)}`;
  const subject = `Nouvelle tâche attribuée : ${task.title}`;
  const lines = [
    `Bonjour ${personName},`,
    `Vous avez été attribué·e à la tâche « ${task.title} »${task.projectName ? ` (projet ${task.projectName})` : ""}, ${range}.`,
    `Voir la tâche : ${APP_URL}/taches?open=${task.id}`,
    `Vous recevez ce courriel car les alertes d'attribution sont activées pour votre compte (Réglages → Mes notifications).`,
  ];
  return {
    subject,
    text: lines.join("\n\n"),
    html: wrapHtml(subject, lines),
  };
}

export interface DigestTaskInfo {
  title: string;
  projectName: string | null;
  statusName: string;
  startDate: string;
  endDate: string;
}

export function dailyDigestEmail(personName: string, tasks: DigestTaskInfo[]) {
  const subject = `Votre récap du jour — ${tasks.length} tâche${tasks.length === 1 ? "" : "s"} en cours`;
  const items = tasks.map(
    (t) =>
      `• ${t.title}${t.projectName ? ` (${t.projectName})` : ""} — ${t.statusName}, ${
        t.startDate === t.endDate
          ? formatShortFr(t.startDate)
          : `du ${formatShortFr(t.startDate)} au ${formatShortFr(t.endDate)}`
      }`,
  );
  const lines = [
    `Bonjour ${personName},`,
    tasks.length === 0
      ? "Aucune tâche en cours ou à venir cette semaine — profitez-en."
      : `Voici vos tâches en cours ou à venir cette semaine :\n${items.join("\n")}`,
    `Voir votre planning : ${APP_URL}/taches`,
    `Vous recevez ce courriel car le récap quotidien est activé pour votre compte (Réglages → Mes notifications).`,
  ];
  return {
    subject,
    text: lines.join("\n\n"),
    html: wrapHtml(subject, [
      `Bonjour ${personName},`,
      tasks.length === 0
        ? "Aucune tâche en cours ou à venir cette semaine — profitez-en."
        : `Voici vos tâches en cours ou à venir cette semaine :<br>${items.join("<br>")}`,
      `<a href="${APP_URL}/taches">Voir votre planning</a>`,
    ]),
  };
}
