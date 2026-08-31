"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

const RESULT_LIMIT = 5;

export interface SearchResults {
  tasks: { id: string; title: string; projectName: string | null }[];
  projects: { id: string; name: string; code: string | null; clientName: string; archived: boolean }[];
  clients: { id: string; name: string }[];
}

const EMPTY: SearchResults = { tasks: [], projects: [], clients: [] };

/** Recherche globale — tâches, projets, clients ; casse ignorée, sous-chaîne. */
export async function globalSearch(query: string): Promise<SearchResults> {
  const session = await auth();
  if (!session?.user) return EMPTY;

  const q = query.trim();
  if (q.length < 2) return EMPTY;

  const [tasks, projects, clients] = await Promise.all([
    db.task.findMany({
      where: { trashedAt: null, title: { contains: q, mode: "insensitive" } },
      take: RESULT_LIMIT,
      orderBy: { startDate: "asc" },
      select: { id: true, title: true, project: { select: { name: true } } },
    }),
    db.project.findMany({
      // Le nom ET le code (ex. "BETTER-3", la clé de recherche mise en avant
      // pour le reporting — voir README) ; les projets archivés restent
      // trouvables, juste signalés (voir global-search.tsx), sinon un
      // projet clos redevient introuvable même par son nom exact.
      where: {
        OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
      },
      take: RESULT_LIMIT,
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, archived: true, client: { select: { name: true } } },
    }),
    db.client.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: RESULT_LIMIT,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, projectName: t.project?.name ?? null })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, code: p.code, archived: p.archived, clientName: p.client.name })),
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}
