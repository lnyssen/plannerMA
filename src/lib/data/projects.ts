import { db } from "@/lib/db";

export function listActiveProjectsForForms() {
  return db.project.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, client: true },
  });
}

export function listProjectsWithCounts() {
  return db.project.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    include: {
      studios: { include: { studio: true } },
      _count: { select: { tasks: { where: { trashedAt: null } } } },
    },
  });
}

export type ProjectWithCounts = Awaited<ReturnType<typeof listProjectsWithCounts>>[number];
