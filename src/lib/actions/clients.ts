"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function revalidateClientViews() {
  revalidatePath("/clients");
  revalidatePath("/projets");
  revalidatePath("/reglages");
}

const nameSchema = z.string().trim().min(1, "Le nom du client est requis.");

/** Création rapide (depuis le sélecteur de client d'un formulaire projet) — nom seul. */
export async function createClient(name: string): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  const existing = await db.client.findUnique({ where: { name: parsed.data } });
  if (existing) return { id: existing.id };

  const client = await db.client.create({ data: { name: parsed.data } });
  revalidateClientViews();
  return { id: client.id };
}

export async function getClientDetail(clientId: string) {
  const session = await auth();
  if (!session?.user) return null;
  return db.client.findUnique({
    where: { id: clientId },
    include: { _count: { select: { projects: true } } },
  });
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClientDetail>>>;

const clientDetailSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom du client est requis."),
    contactName: z.string().trim().nullable(),
    contactEmail: z.string().trim().nullable(),
    contactPhone: z.string().trim().nullable(),
    website: z.string().trim().nullable(),
    notes: z.string().trim().nullable(),
  })
  .refine((v) => !v.contactEmail || z.string().email().safeParse(v.contactEmail).success, {
    message: "Adresse courriel invalide.",
    path: ["contactEmail"],
  });

export type ClientDetailInput = z.input<typeof clientDetailSchema>;

export async function updateClientDetail(
  clientId: string,
  input: ClientDetailInput,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = clientDetailSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { name, contactName, contactEmail, contactPhone, website, notes } = parsed.data;

  await db.client.update({
    where: { id: clientId },
    data: {
      name,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      website: website || null,
      notes: notes || null,
    },
  });

  revalidateClientViews();
  return {};
}

export async function deleteClient(clientId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." };

  const projectCount = await db.project.count({ where: { clientId } });
  if (projectCount > 0) {
    return { error: `Ce client est utilisé par ${projectCount} projet${projectCount > 1 ? "s" : ""} : impossible de le retirer.` };
  }

  await db.client.delete({ where: { id: clientId } });
  revalidateClientViews();
  return {};
}
