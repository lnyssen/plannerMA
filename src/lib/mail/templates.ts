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

/** `hasAccount` distingue le pied de page : quelqu'un sans compte de connexion (voir notify.ts) ne peut pas régler cette préférence dans Réglages. */
export function assignmentEmail(personName: string, task: AssignmentTaskInfo, hasAccount: boolean) {
  const range =
    task.startDate === task.endDate
      ? formatShortFr(task.startDate)
      : `du ${formatShortFr(task.startDate)} au ${formatShortFr(task.endDate)}`;
  const subject = `Nouvelle tâche attribuée : ${task.title}`;
  const lines = [
    `Bonjour ${personName},`,
    `Vous avez été attribué·e à la tâche « ${task.title} »${task.projectName ? ` (projet ${task.projectName})` : ""}, ${range}.`,
    ...(hasAccount ? [`Voir la tâche : ${APP_URL}/taches/${task.id}`] : []),
    hasAccount
      ? `Vous recevez ce courriel car les alertes d'attribution sont activées pour votre compte (Réglages → Mes notifications).`
      : `Vous recevez ce courriel à l'adresse renseignée sur votre fiche équipe.`,
  ];
  return {
    subject,
    text: lines.join("\n\n"),
    html: wrapHtml(subject, lines),
  };
}

export interface MentionInfo {
  taskId: string;
  taskTitle: string;
  authorName: string;
  commentBody: string;
}

/** Tronque un commentaire pour le courriel — le texte complet reste consultable sur la tâche. */
function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function mentionEmail(personName: string, info: MentionInfo) {
  const subject = `${info.authorName} vous a mentionné·e dans « ${info.taskTitle} »`;
  const lines = [
    `Bonjour ${personName},`,
    `${info.authorName} vous a mentionné·e dans un commentaire sur la tâche « ${info.taskTitle} » :`,
    `« ${truncate(info.commentBody, 300)} »`,
    `Voir la tâche : ${APP_URL}/taches/${info.taskId}`,
    `Vous recevez ce courriel car les alertes de mention sont activées pour votre compte (Réglages → Mes notifications).`,
  ];
  return {
    subject,
    text: lines.join("\n\n"),
    html: wrapHtml(subject, lines),
  };
}

export interface RequestInfo {
  subject: string;
  studioName: string;
  requester: string | null;
}

export function requestEmail(personName: string, info: RequestInfo) {
  const subject = `Nouvelle demande (${info.studioName}) : ${info.subject}`;
  const lines = [
    `Bonjour ${personName},`,
    `Une nouvelle demande a été déposée pour le studio ${info.studioName} : « ${info.subject} »${
      info.requester ? ` (demandée par ${info.requester})` : ""
    }.`,
    `Voir les demandes : ${APP_URL}/demandes`,
    `Vous recevez ce courriel car les alertes de nouvelle demande sont activées pour votre compte (Réglages → Mes notifications).`,
  ];
  return {
    subject,
    text: lines.join("\n\n"),
    html: wrapHtml(subject, lines),
  };
}

/** Compte créé pour une personne déjà dans l'équipe (fiche existante) — voir invitePerson dans src/lib/actions/people.ts. */
export function inviteEmail(personName: string, email: string, temporaryPassword: string) {
  const subject = "Votre accès à Studio planner";
  const lines = [
    `Bonjour ${personName},`,
    `Un compte de connexion a été créé pour vous sur Studio planner, l'outil de planification de Média Animation.`,
    `Identifiant : ${email}`,
    `Mot de passe temporaire : ${temporaryPassword}`,
    `Connexion : ${APP_URL}/connexion`,
    `Ce mot de passe est généré automatiquement — changez-le dès votre première connexion (Réglages → Mon compte).`,
  ];
  return {
    subject,
    text: lines.join("\n\n"),
    html: wrapHtml(subject, lines),
  };
}

/** Distinct de inviteEmail : le compte existe déjà, seul le mot de passe change (voir resetPassword dans people.ts). */
export function passwordResetEmail(personName: string, email: string, temporaryPassword: string) {
  const subject = "Votre mot de passe Studio planner a été réinitialisé";
  const lines = [
    `Bonjour ${personName},`,
    `Un administrateur a réinitialisé votre mot de passe sur Studio planner.`,
    `Identifiant : ${email}`,
    `Nouveau mot de passe temporaire : ${temporaryPassword}`,
    `Connexion : ${APP_URL}/connexion`,
    `Ce mot de passe est généré automatiquement — changez-le dès votre prochaine connexion (Réglages → Mon compte).`,
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
