import { db } from "@/lib/db";

export function listRequests() {
  return db.request.findMany({ orderBy: { createdAt: "desc" }, include: { studio: true } });
}

export type RequestSummary = Awaited<ReturnType<typeof listRequests>>[number];
