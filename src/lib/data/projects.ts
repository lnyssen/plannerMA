import { db } from "@/lib/db";

export function listActiveProjectsForForms() {
  return db.project.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
}

export type ProjectOption = Awaited<ReturnType<typeof listActiveProjectsForForms>>[number];

export function listProjectsWithCounts(archived = false) {
  return db.project.findMany({
    where: { archived },
    orderBy: { name: "asc" },
    include: {
      client: true,
      studios: { include: { studio: true } },
      _count: { select: { tasks: { where: { trashedAt: null } } } },
    },
  });
}

export type ProjectWithCounts = Awaited<ReturnType<typeof listProjectsWithCounts>>[number];
