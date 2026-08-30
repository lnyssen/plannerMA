import { db } from "@/lib/db";

/** Journal global (Réglages → Journal) — les 100 dernières écritures, tous types confondus. */
export function listRecentJournalEntries() {
  return db.journalEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { task: { select: { id: true, title: true, trashedAt: true } } },
  });
}

export type JournalEntrySummary = Awaited<ReturnType<typeof listRecentJournalEntries>>[number];
