import { db } from "@/lib/db";

export function listClients() {
  return db.client.findMany({ orderBy: { name: "asc" } });
}

export type ClientSummary = Awaited<ReturnType<typeof listClients>>[number];

export function listClientsWithCounts() {
  return db.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });
}

export type ClientWithCounts = Awaited<ReturnType<typeof listClientsWithCounts>>[number];
