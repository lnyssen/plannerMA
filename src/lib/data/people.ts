import { db } from "@/lib/db";

export function listPeople() {
  return db.person.findMany({ orderBy: { name: "asc" }, include: { studios: true } });
}

export type PersonSummary = Awaited<ReturnType<typeof listPeople>>[number];
