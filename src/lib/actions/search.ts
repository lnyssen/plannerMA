"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

const RESULT_LIMIT = 5;

export interface SearchResults {
  tasks: { id: string; title: string; projectName: string | null }[];
  projects: { id: string; name: string; code: string | null; clientName: string; archived: boolean }[];
  clients: { id: string; name: string }[];
  comments: { id: string; taskId: string; taskTitle: string; snippet: string }[];
}

const EMPTY: SearchResults = { tasks: [], projects: [], clients: [], comments: [] };

interface TaskFullTextRow {
  id: string;
  title: string;
  projectName: string | null;
}

interface CommentFullTextRow {
  id: string;
  taskId: string;
  taskTitle: string;
  snippet: string;
}

/**
 * Recherche globale — tâches (titre + description), commentaires, projets,
 * clients. Tâches et commentaires passent par un vrai index plein texte
 * PostgreSQL (`to_tsvector`/`ts_rank`, configuration "french", voir la
 * migration add_fulltext_search_indexes) : Prisma n'a pas de support
 * natif du full-text Postgres, d'où le SQL brut, paramétré via le tagged
 * template (pas de concaténation de chaîne, pas d'injection possible).
 * Projets/clients restent en `contains` — ce sont des noms propres courts,
 * une sous-chaîne partielle ("oxf" → "Oxfam") y est plus utile qu'un
 * découpage en lexèmes qui l'exigerait en début de mot.
 */
export async function globalSearch(query: string): Promise<SearchResults> {
  const session = await auth();
  if (!session?.user) return EMPTY;

  const q = query.trim();
  if (q.length < 2) return EMPTY;

  const [tasks, comments, projects, clients] = await Promise.all([
    db.$queryRaw<TaskFullTextRow[]>`
      SELECT t.id, t.title, p.name AS "projectName"
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.trashed_at IS NULL
        AND to_tsvector('french', coalesce(t.title, '') || ' ' || coalesce(t.description, ''))
            @@ plainto_tsquery('french', ${q})
      ORDER BY ts_rank(
        to_tsvector('french', coalesce(t.title, '') || ' ' || coalesce(t.description, '')),
        plainto_tsquery('french', ${q})
      ) DESC
      LIMIT ${RESULT_LIMIT}
    `,
    db.$queryRaw<CommentFullTextRow[]>`
      SELECT c.id, c.task_id AS "taskId", t.title AS "taskTitle",
        left(c.body, 140) AS snippet
      FROM comments c
      JOIN tasks t ON t.id = c.task_id
      WHERE t.trashed_at IS NULL
        AND to_tsvector('french', c.body) @@ plainto_tsquery('french', ${q})
      ORDER BY ts_rank(to_tsvector('french', c.body), plainto_tsquery('french', ${q})) DESC
      LIMIT ${RESULT_LIMIT}
    `,
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
    tasks,
    comments: comments.map((c) => ({ ...c, snippet: c.snippet.length === 140 ? `${c.snippet}…` : c.snippet })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, code: p.code, archived: p.archived, clientName: p.client.name })),
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}
