"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { weeklyLoad, type LoadAbsence, type LoadTask } from "@/lib/planning/availability";
import { addDays, belgianHolidaysRange, fromIsoDate, mondayOf, toIsoDate, type IsoDate } from "@/lib/planning/dates";

// Même seuil que la vue Charge (src/app/(app)/charge/charge-view.tsx) — on
// réutilise volontairement la même notion de "surcharge" plutôt que d'en
// inventer une seconde.
const OVERLOAD_THRESHOLD = 0.9;

export interface CapacityWarning {
  personName: string;
  weekStart: IsoDate;
  ratioPercent: number;
}

/**
 * Charge projetée d'une personne sur la plage d'une tâche en cours de
 * saisie, cette tâche incluse — avertissement non bloquant affiché dans le
 * formulaire (voir TaskFormFields), avant l'enregistrement plutôt qu'après
 * coup comme les alertes de budget. Réutilise weeklyLoad (déjà utilisée par
 * la vue Charge) semaine par semaine sur la plage couverte, en ajoutant la
 * tâche candidate à l'existant.
 */
export async function checkTaskCapacity(input: {
  personId: string;
  startDate: string;
  endDate: string;
  estimatedHalfDays: number | null;
  /** Tâche en cours d'édition, à exclure de "l'existant" pour ne pas la compter deux fois. */
  excludeTaskId?: string;
}): Promise<CapacityWarning | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (!input.personId || !input.startDate || !input.endDate || input.endDate < input.startDate) return null;

  const person = await db.person.findUnique({ where: { id: input.personId }, select: { name: true } });
  if (!person) return null;

  const firstWeekStart = mondayOf(fromIsoDate(input.startDate));
  const lastWeekStart = mondayOf(fromIsoDate(input.endDate));
  const rangeStartIso = toIsoDate(firstWeekStart);
  const rangeEndIso = toIsoDate(addDays(lastWeekStart, 6));

  const [existingTasks, absences] = await Promise.all([
    db.task.findMany({
      where: {
        assigneeId: input.personId,
        trashedAt: null,
        ...(input.excludeTaskId ? { id: { not: input.excludeTaskId } } : {}),
        startDate: { lte: fromIsoDate(rangeEndIso) },
        endDate: { gte: fromIsoDate(rangeStartIso) },
        OR: [{ projectId: null }, { project: { archived: false } }],
      },
      select: { startDate: true, endDate: true, estimatedHalfDays: true, status: { select: { isDone: true } } },
    }),
    db.absence.findMany({
      where: {
        personId: input.personId,
        startDate: { lte: fromIsoDate(rangeEndIso) },
        endDate: { gte: fromIsoDate(rangeStartIso) },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const loadTasks: LoadTask[] = [
    ...existingTasks.map((t) => ({
      personId: input.personId,
      isDone: t.status.isDone,
      startDate: toIsoDate(t.startDate),
      endDate: toIsoDate(t.endDate),
      estimatedHalfDays: t.estimatedHalfDays,
    })),
    {
      personId: input.personId,
      isDone: false,
      startDate: input.startDate,
      endDate: input.endDate,
      estimatedHalfDays: input.estimatedHalfDays,
    },
  ];
  const loadAbsences: LoadAbsence[] = absences.map((a) => ({
    personId: input.personId,
    startDate: toIsoDate(a.startDate),
    endDate: toIsoDate(a.endDate),
  }));

  const holidays = belgianHolidaysRange(firstWeekStart.getUTCFullYear(), lastWeekStart.getUTCFullYear() + 1);

  let worst: { weekStart: IsoDate; ratio: number } | null = null;
  for (let w = firstWeekStart; w <= lastWeekStart; w = addDays(w, 7)) {
    const load = weeklyLoad(input.personId, w, loadTasks, loadAbsences, holidays);
    if (load.available === 0) continue;
    if (!worst || load.ratio > worst.ratio) worst = { weekStart: toIsoDate(w), ratio: load.ratio };
  }

  if (!worst || worst.ratio < OVERLOAD_THRESHOLD) return null;
  return { personName: person.name, weekStart: worst.weekStart, ratioPercent: Math.round(worst.ratio * 100) };
}
