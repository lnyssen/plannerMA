import { db } from "@/lib/db";
import { sumDurationMinutes } from "@/lib/planning/time";

// Pas de fenêtre de dates pour l'instant (petite équipe, volume faible) —
// à revoir si la table grossit significativement.

const TASK_SELECT = { id: true, title: true, project: { select: { name: true, client: { select: { name: true } } } } } as const;
const PROJECT_SELECT = { id: true, name: true, code: true, client: { select: { name: true } } } as const;
const STUDIO_SELECT = { id: true, name: true, colorHex: true, fillHex: true } as const;
const CATEGORY_SELECT = { id: true, name: true } as const;

export function listTimeEntriesForPerson(personId: string) {
  return db.timeEntry.findMany({
    where: { personId },
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: TASK_SELECT },
      project: { select: PROJECT_SELECT },
      studio: { select: STUDIO_SELECT },
      category: { select: CATEGORY_SELECT },
    },
  });
}

export type TimeEntryWithTask = Awaited<ReturnType<typeof listTimeEntriesForPerson>>[number];

/** Réservé aux administrateurs — toutes les écritures, toutes personnes confondues. */
export function listAllTimeEntries() {
  return db.timeEntry.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: TASK_SELECT },
      project: { select: PROJECT_SELECT },
      studio: { select: STUDIO_SELECT },
      category: { select: CATEGORY_SELECT },
      person: { select: { id: true, name: true } },
    },
  });
}

export type TimeEntryWithPerson = Awaited<ReturnType<typeof listAllTimeEntries>>[number];

/**
 * Projets actifs avec un budget d'heures défini — pour le calcul de
 * dépassement, réservé aux administrateurs. Une écriture peut être liée à
 * ce projet directement (`projectId`) ou via une tâche qui en dépend — les
 * deux comptent, sinon une écriture "AGENCE" sur une tâche du projet mais
 * sans lien direct serait ignorée du calcul.
 *
 * Le statut de chaque tâche est inclus pour permettre de calculer
 * l'avancement (taskProgress) en plus du temps consommé — voir le tableau
 * de bord, qui compare les deux pour juger du rythme d'un projet.
 */
export function listProjectsWithBudget() {
  return db.project.findMany({
    where: { archived: false, budgetHours: { not: null } },
    select: {
      id: true,
      name: true,
      projectType: true,
      budgetHours: true,
      client: { select: { name: true } },
      timeEntries: { select: { startedAt: true, endedAt: true } },
      tasks: {
        where: { trashedAt: null },
        select: {
          status: { select: { position: true, isDone: true } },
          timeEntries: { select: { startedAt: true, endedAt: true } },
        },
      },
    },
  });
}

/**
 * Nombre de projets actifs qui dépassent leur budget d'heures — pour la
 * puce de nav sur "Projets". Ne contient que des totaux (pas de détail par
 * personne), donc contrairement à `listProjectsWithBudget` ci-dessus, pas
 * besoin de réserver ça aux administrateurs — voir la règle de
 * confidentialité dans getProjectDetail (src/lib/actions/projects.ts).
 */
export async function countProjectsOverBudget(): Promise<number> {
  const projects = await listProjectsWithBudget();
  const now = new Date();
  return projects.filter((p) => {
    const totalMinutes = sumDurationMinutes([...p.timeEntries, ...p.tasks.flatMap((t) => t.timeEntries)], now);
    return totalMinutes > (p.budgetHours ?? 0) * 60;
  }).length;
}

/**
 * Heures enregistrées par mois et par studio, sur les `months` derniers mois
 * (mois courant inclus).
 *
 * Le tableau de bord et Charge ne donnaient que des photos de l'instant : les
 * écritures sont pourtant horodatées, et c'est précisément l'historique
 * « heures par studio et par mois » qu'il faut produire pour justifier une
 * subvention. Sans ça, il fallait sortir le CSV et le refaire à la main.
 *
 * L'agrégation se fait en mémoire plutôt qu'en SQL : le volume est celui
 * d'une petite équipe sur douze mois, et rester en Prisma évite une requête
 * brute à maintenir en parallèle du schéma.
 */
export async function listMonthlyHoursByStudio(months = 12) {
  const now = new Date();
  const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const entries = await db.timeEntry.findMany({
    where: { startedAt: { gte: firstMonth } },
    select: {
      startedAt: true,
      endedAt: true,
      studio: { select: { id: true, name: true, fillHex: true, colorHex: true } },
    },
  });

  const keys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const byMonth = new Map<string, Map<string, { studio: (typeof entries)[number]["studio"]; minutes: number }>>();
  for (const key of keys) byMonth.set(key, new Map());

  for (const e of entries) {
    const key = `${e.startedAt.getUTCFullYear()}-${String(e.startedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key);
    if (!bucket) continue; // écriture hors fenêtre (mois entamé avant le premier)
    const minutes = Math.max(0, Math.round(((e.endedAt ?? now).getTime() - e.startedAt.getTime()) / 60_000));
    const current = bucket.get(e.studio.id);
    if (current) current.minutes += minutes;
    else bucket.set(e.studio.id, { studio: e.studio, minutes });
  }

  return keys.map((month) => {
    const rows = [...byMonth.get(month)!.values()].sort((a, b) => b.minutes - a.minutes);
    return { month, studios: rows, total: rows.reduce((sum, r) => sum + r.minutes, 0) };
  });
}

export type MonthlyHoursByStudio = Awaited<ReturnType<typeof listMonthlyHoursByStudio>>;
