import { db } from "@/lib/db";

/** Personnes actives seulement — les sélecteurs d'assignation/filtre ne doivent pas proposer quelqu'un d'offboardé (voir equipe/page.tsx pour la liste complète, active ou non). */
export function listPeople() {
  return db.person.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { studios: true } });
}

export type PersonSummary = Awaited<ReturnType<typeof listPeople>>[number];
