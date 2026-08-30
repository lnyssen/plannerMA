"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { deleteUploadedFile, MAX_UPLOAD_BYTES, saveUploadedFile } from "@/lib/storage/local";

function revalidateTaskViews() {
  revalidatePath("/taches");
  revalidatePath("/projets");
  revalidatePath("/planning");
}

const linkSchema = z.object({
  taskId: z.string(),
  name: z.string().trim().min(1, "Le nom est requis."),
  url: z.string().trim().url("Adresse invalide."),
});

export async function addLinkAttachment(input: z.infer<typeof linkSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  await db.attachment.create({
    data: {
      taskId: parsed.data.taskId,
      name: parsed.data.name,
      kind: "LINK",
      url: parsed.data.url,
      uploadedById: session.user.personId,
    },
  });

  revalidateTaskViews();
  return {};
}

export async function uploadFileAttachment(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const taskId = String(formData.get("taskId") ?? "");
  const file = formData.get("file");
  if (!taskId || !(file instanceof File) || file.size === 0) {
    return { error: "Choisissez un fichier." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} Mo).` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = await saveUploadedFile(bytes);

  await db.attachment.create({
    data: {
      taskId,
      name: file.name,
      kind: "FILE",
      storageKey,
      mimeType: file.type || null,
      sizeBytes: file.size,
      uploadedById: session.user.personId,
    },
  });

  revalidateTaskViews();
  return {};
}

export async function deleteAttachment(attachmentId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const attachment = await db.attachment.delete({ where: { id: attachmentId } });
  if (attachment.kind === "FILE" && attachment.storageKey) {
    await deleteUploadedFile(attachment.storageKey);
  }

  revalidateTaskViews();
  return {};
}
