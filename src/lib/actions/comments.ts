"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifyComment, notifyMention } from "@/lib/mail/notify";
import { currentActorName } from "./actor";
import { createNotification } from "./notifications";

const addCommentSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1, "Le commentaire est vide.").max(2000),
});

/**
 * Une mention est écrite "@Nom Complet" dans le texte — on compare contre la
 * liste des personnes existantes plutôt que d'imposer un identifiant caché :
 * plus simple à saisir, et suffisant pour une équipe d'une quinzaine de
 * personnes aux noms distincts. Les correspondances les plus longues sont
 * testées en premier pour qu'"@Amélie Verstraeten" ne s'arrête pas à
 * "@Amélie" si les deux existaient.
 */
function findMentionedPersonIds(body: string, people: { id: string; name: string }[]): string[] {
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length);
  const found = new Set<string>();
  let remaining = body;
  for (const person of sorted) {
    const needle = `@${person.name}`;
    if (remaining.includes(needle)) {
      found.add(person.id);
      remaining = remaining.split(needle).join(" ".repeat(needle.length));
    }
  }
  return [...found];
}

export async function addComment(input: z.infer<typeof addCommentSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { taskId, body } = parsed.data;

  const task = await db.task.findUnique({ where: { id: taskId }, select: { title: true, assigneeId: true } });
  if (!task) return { error: "Cette tâche n’existe plus." };

  const people = await db.person.findMany({ select: { id: true, name: true } });
  const mentionedIds = findMentionedPersonIds(body, people).filter((id) => id !== session.user.personId);
  const authorName = await currentActorName(session);

  const comment = await db.comment.create({
    data: {
      taskId,
      authorId: session.user.personId,
      authorName,
      body,
      mentions: { create: mentionedIds.map((personId) => ({ personId })) },
    },
  });

  for (const personId of mentionedIds) {
    void notifyMention(personId, { taskId, taskTitle: task.title, authorName, commentBody: body });
    await createNotification({
      recipientId: personId,
      type: "MENTION",
      message: `${authorName} vous a mentionné·e dans un commentaire sur « ${task.title} »`,
      link: `/taches/${taskId}`,
    });
  }

  // Attributaire prévenu de tout nouveau commentaire, même sans mention
  // explicite — sauf s'il est l'auteur ou déjà notifié ci-dessus par mention
  // (pas de double alerte pour la même écriture).
  if (task.assigneeId && task.assigneeId !== session.user.personId && !mentionedIds.includes(task.assigneeId)) {
    void notifyComment(task.assigneeId, { taskId, taskTitle: task.title, authorName, commentBody: body });
    await createNotification({
      recipientId: task.assigneeId,
      type: "COMMENT",
      message: `${authorName} a commenté « ${task.title} »`,
      link: `/taches/${taskId}`,
    });
  }

  revalidatePath("/taches");
  revalidatePath("/planning");
  return { error: comment ? undefined : "Échec de l’enregistrement." };
}
