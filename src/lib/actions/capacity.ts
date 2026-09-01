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

interface CandidateTask {
  startDate: string;
  endDate: string;
  estimatedHalfDays: number | null;
}

/**
 * Cœur commun aux deux vérifications ci-dessous : charge d'une personne sur
 * la plage couverte par une liste de tâches candidates (une seule tâche du
 * formulaire, ou plusieurs d'une réattribution groupée), ces candidates
 * ajoutées à son existant — hors les tâches elles-mêmes déjà siennes
 * (excludeTaskIds), pour ne pas les compter deux fois.
 */
async function worstWeekLoad(
  personId: string,
  candidates: CandidateTask[],
  excludeTaskIds: string[],
): Promise<{ weekStart: IsoDate; ratio: number } | null> {
  const starts = candidates.map((t) => t.startDate).sort();
  const ends = candidates.map((t) => t.endDate).sort();
  const overallStart = starts[0];
  const overallEnd = ends[ends.length - 1];
  if (!overallStart || !overallEnd || overallEnd < overallStart) return null;

  const firstWeekStart = mondayOf(fromIsoDate(overallStart));
  const lastWeekStart = mondayOf(fromIsoDate(overallEnd));
  const rangeStartIso = toIsoDate(firstWeekStart);
  const rangeEndIso = toIsoDate(addDays(lastWeekStart, 6));

  const [existingTasks, absences] = await Promise.all([
    db.task.findMany({
      where: {
        assigneeId: personId,
        trashedAt: null,
        ...(excludeTaskIds.length > 0 ? { id: { notIn: excludeTaskIds } } : {}),
        startDate: { lte: fromIsoDate(rangeEndIso) },
        endDate: { gte: fromIsoDate(rangeStartIso) },
        OR: [{ projectId: null }, { project: { archived: false } }],
      },
      select: { startDate: true, endDate: true, estimatedHalfDays: true, status: { select: { isDone: true } } },
    }),
    db.absence.findMany({
      where: {
        personId,
        startDate: { lte: fromIsoDate(rangeEndIso) },
        endDate: { gte: fromIsoDate(rangeStartIso) },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const loadTasks: LoadTask[] = [
    ...existingTasks.map((t) => ({
      personId,
      isDone: t.status.isDone,
      startDate: toIsoDate(t.startDate),
      endDate: toIsoDate(t.endDate),
      estimatedHalfDays: t.estimatedHalfDays,
    })),
    ...candidates.map((t) => ({
      personId,
      isDone: false,
      startDate: t.startDate,
      endDate: t.endDate,
      estimatedHalfDays: t.estimatedHalfDays,
    })),
  ];
  const loadAbsences: LoadAbsence[] = absences.map((a) => ({
    personId,
    startDate: toIsoDate(a.startDate),
    endDate: toIsoDate(a.endDate),
  }));

  const holidays = belgianHolidaysRange(firstWeekStart.getUTCFullYear(), lastWeekStart.getUTCFullYear() + 1);

  let worst: { weekStart: IsoDate; ratio: number } | null = null;
  for (let w = firstWeekStart; w <= lastWeekStart; w = addDays(w, 7)) {
    const load = weeklyLoad(personId, w, loadTasks, loadAbsences, holidays);
    if (load.available === 0) continue;
    if (!worst || load.ratio > worst.ratio) worst = { weekStart: toIsoDate(w), ratio: load.ratio };
  }
  return worst;
}

/**
 * Charge projetée d'une personne sur la plage d'une tâche en cours de
 * saisie, cette tâche incluse — avertissement non bloquant affiché dans le
 * formulaire (voir TaskFormFields), avant l'enregistrement plutôt qu'après
 * coup comme les alertes de budget.
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

  const worst = await worstWeekLoad(
    input.personId,
    [{ startDate: input.startDate, endDate: input.endDate, estimatedHalfDays: input.estimatedHalfDays }],
    input.excludeTaskId ? [input.excludeTaskId] : [],
  );
  if (!worst || worst.ratio < OVERLOAD_THRESHOLD) return null;
  return { personName: person.name, weekStart: worst.weekStart, ratioPercent: Math.round(worst.ratio * 100) };
}

/**
 * Même vérification que checkTaskCapacity, mais pour une réattribution
 * groupée (barre d'action en masse de la liste des tâches) : plusieurs
 * tâches à la fois vers la même personne, dont les plages peuvent se
 * chevaucher ou s'étaler sur plusieurs semaines — un cas que la
 * vérification par formulaire (une tâche à la fois) ne couvre pas.
 */
export async function checkBulkReassignCapacity(input: {
  personId: string;
  tasks: { taskId: string; startDate: string; endDate: string; estimatedHalfDays: number | null }[];
}): Promise<CapacityWarning | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (!input.personId || input.tasks.length === 0) return null;

  const person = await db.person.findUnique({ where: { id: input.personId }, select: { name: true } });
  if (!person) return null;

  const worst = await worstWeekLoad(
    input.personId,
    input.tasks.map((t) => ({ startDate: t.startDate, endDate: t.endDate, estimatedHalfDays: t.estimatedHalfDays })),
    input.tasks.map((t) => t.taskId),
  );
  if (!worst || worst.ratio < OVERLOAD_THRESHOLD) return null;
  return { personName: person.name, weekStart: worst.weekStart, ratioPercent: Math.round(worst.ratio * 100) };
}
