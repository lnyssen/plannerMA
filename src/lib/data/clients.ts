import { db } from "@/lib/db";

export function listClients() {
  return db.client.findMany({ orderBy: { name: "asc" } });
}

export type ClientSummary = Awaited<ReturnType<typeof listClients>>[number];

export function listClientsWithCounts() {
  return db.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true } },
      // Temps agrégé tous projets confondus ("portefeuille client") — mêmes
      // deux sources qu'ailleurs dans l'appli (écriture directe sur le
      // projet, ou via une tâche du projet), voir projectHours dans
      // projects-view.tsx pour l'équivalent à l'échelle d'un seul projet.
      projects: {
        select: {
          archived: true,
          timeEntries: { select: { startedAt: true, endedAt: true } },
          tasks: { where: { trashedAt: null }, select: { timeEntries: { select: { startedAt: true, endedAt: true } } } },
        },
      },
    },
  });
}

export type ClientWithCounts = Awaited<ReturnType<typeof listClientsWithCounts>>[number];
