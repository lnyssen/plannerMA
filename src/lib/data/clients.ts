import { db } from "@/lib/db";

export function listClients() {
  return db.client.findMany({ orderBy: { name: "asc" } });
}

export type ClientSummary = Awaited<ReturnType<typeof listClients>>[number];
