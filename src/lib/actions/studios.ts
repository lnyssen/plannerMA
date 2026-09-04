"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/planning/slug";

// Pas de couleur "de secours" élégante : les cinq couleurs livrées par le
// travail de design (docs/design-system.md) sont vérifiées AA, celle-ci ne
// l'est pas — un placeholder neutre, à corriger avant tout usage réel si un
// sixième studio est vraiment créé.
const PLACEHOLDER_FILL = "#e5e5e5";
const PLACEHOLDER_COLOR = "#2d1592";

function revalidateStudioViews() {
  revalidatePath("/reglages");
  revalidatePath("/projets");
  revalidatePath("/taches");
  revalidatePath("/planning");
  revalidatePath("/equipe");
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Session expirée. Reconnectez-vous." } as const;
  if (session.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." } as const;
  return { session } as const;
}

const nameSchema = z.string().trim().min(1, "Le nom est requis.");

export async function renameStudio(studioId: string, name: string): Promise<{ error?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  await db.studio.update({
    where: { id: studioId },
    data: { name: parsed.data, initial: parsed.data[0]!.toUpperCase() },
  });

  revalidateStudioViews();
  return {};
}

export async function createStudio(name: string): Promise<{ error?: string; id?: string }> {
  const auth_ = await requireAdmin();
  if ("error" in auth_) return auth_;
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  const count = await db.studio.count();
  const studio = await db.studio.create({
    data: {
      slug: slugify(parsed.data),
      name: parsed.data,
      fillHex: PLACEHOLDER_FILL,
      colorHex: PLACEHOLDER_COLOR,
      initial: parsed.data[0]!.toUpperCase(),
      position: count,
    },
  });

  revalidateStudioViews();
  return { id: studio.id };
}
