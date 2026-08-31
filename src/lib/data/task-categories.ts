import { db } from "@/lib/db";

/** Catégories générales (studioId nul) puis spécifiques, triées par position — voir prisma/schema.prisma TaskCategory. */
export function listTaskCategories() {
  return db.taskCategory.findMany({
    orderBy: [{ studioId: { sort: "asc", nulls: "first" } }, { position: "asc" }],
    select: { id: true, name: true, studioId: true, position: true },
  });
}

export type TaskCategoryOption = Awaited<ReturnType<typeof listTaskCategories>>[number];
