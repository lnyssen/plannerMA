import { db } from "@/lib/db";

export function listStudios() {
  return db.studio.findMany({ orderBy: { position: "asc" } });
}

export type StudioSummary = Awaited<ReturnType<typeof listStudios>>[number];
