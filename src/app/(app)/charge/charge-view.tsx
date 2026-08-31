"use client";

import { useMemo, useState } from "react";
import { addDays, belgianHolidaysRange, fromIsoDate, mondayOf, today } from "@/lib/planning/dates";
import { weeklyLoad, type LoadAbsence, type LoadTask } from "@/lib/planning/availability";
import { ScrollFade } from "@/components/ui/scroll-fade";

interface ChargePerson {
  id: string;
  name: string;
  studios: string[];
}

const WEEK_OPTIONS = [4, 8, 12];

/**
 * Vue Charge (admin) — occupation par personne et par semaine, dérivée de
 * `weeklyLoad` (src/lib/planning/availability.ts), déjà utilisée ailleurs
 * dans le projet. Volontairement une carte de densité plutôt qu'un
 * graphique en bibliothèque tierce : cohérent avec le registre plat du reste
 * de l'application (pas d'ombre/dégradé), et un simple color-mix() suffit.
 *
 * Le chevauchement (une personne à deux tâches en même temps un même jour)
 * n'apparaît pas dans le taux d'occupation (plafonné à 100 % par jour
 * ouvrable) : une puce d'alerte séparée le signale par personne — le détail
 * exact des tâches en cause reste visible dans le Gantt.
 */
export function ChargeView({
  people,
  tasks,
  absences,
}: {
  people: ChargePerson[];
  tasks: LoadTask[];
  absences: LoadAbsence[];
}) {
  const [weeks, setWeeks] = useState(8);
  const weekStart0 = useMemo(() => mondayOf(fromIsoDate(today())), []);

  const weekStarts = useMemo(
    () => Array.from({ length: weeks }, (_, i) => addDays(weekStart0, i * 7)),
    [weeks, weekStart0],
  );

  const holidays = useMemo(() => {
    const years = weekStarts.map((d) => d.getUTCFullYear());
    return belgianHolidaysRange(Math.min(...years), Math.max(...years) + 1);
  }, [weekStarts]);

  const overlapping = useMemo(() => {
    const flagged = new Set<string>();
    const active = tasks.filter((t) => !t.isDone);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (a.personId !== b.personId) continue;
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) flagged.add(a.personId);
      }
    }
    return flagged;
  }, [tasks]);

  const grid = useMemo(
    () =>
      people.map((p) => {
        const weeksLoad = weekStarts.map((w) => weeklyLoad(p.id, w, tasks, absences, holidays));
        const withData = weeksLoad.filter((w) => w.available > 0);
        const average = withData.length === 0 ? 0 : withData.reduce((s, w) => s + w.ratio, 0) / withData.length;
        return { person: p, weeks: weeksLoad, average };
      }),
    [people, weekStarts, tasks, absences, holidays],
  );

  // Statistiques d'ensemble — surtout utiles pour repérer d'un coup d'œil qui
  // est en surcharge et quel studio est le plus sollicité sur la période
  // affichée, sans avoir à lire toute la grille ligne par ligne.
  const OVERLOAD_THRESHOLD = 0.9;
  const teamAverage = useMemo(() => {
    const withData = grid.filter((g) => g.weeks.some((w) => w.available > 0));
    if (withData.length === 0) return 0;
    return withData.reduce((s, g) => s + g.average, 0) / withData.length;
  }, [grid]);
  const overloadedCount = useMemo(() => grid.filter((g) => g.average >= OVERLOAD_THRESHOLD).length, [grid]);

  const studioAverages = useMemo(() => {
    const byStudio = new Map<string, number[]>();
    for (const g of grid) {
      for (const studio of g.person.studios) {
        if (!byStudio.has(studio)) byStudio.set(studio, []);
        byStudio.get(studio)!.push(g.average);
      }
    }
    return [...byStudio.entries()]
      .map(([studio, values]) => ({ studio, average: values.reduce((s, v) => s + v, 0) / values.length }))
      .sort((a, b) => b.average - a.average);
  }, [grid]);

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Charge
        </h1>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="ml-2 rounded-md border-[1.5px] border-heading px-2 py-1 text-sm text-ink"
        >
          {WEEK_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} semaines
            </option>
          ))}
        </select>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucune personne dans l’équipe.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-xl">
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Charge moyenne équipe</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-heading">
                {Math.round(teamAverage * 100)}%
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                En surcharge (≥ {Math.round(OVERLOAD_THRESHOLD * 100)}%)
              </p>
              <p
                className="font-[family-name:var(--font-display)] text-2xl font-semibold"
                style={{ color: overloadedCount > 0 ? "var(--color-alert)" : "var(--color-heading)" }}
              >
                {overloadedCount}
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Chevauchements</p>
              <p
                className="font-[family-name:var(--font-display)] text-2xl font-semibold"
                style={{ color: overlapping.size > 0 ? "var(--color-alert)" : "var(--color-heading)" }}
              >
                {overlapping.size}
              </p>
            </div>
          </div>

          {studioAverages.length > 0 && (
            <div className="mb-6 max-w-md">
              <p className="mb-2 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                Charge moyenne par studio
              </p>
              <div className="flex flex-col gap-1.5">
                {studioAverages.map(({ studio, average }) => (
                  <div key={studio} className="flex items-center gap-2">
                    <span className="w-24 flex-shrink-0 truncate text-xs text-ink">{studio}</span>
                    <div className="h-2 flex-1 bg-line">
                      <div className="h-full bg-heading" style={{ width: `${Math.round(average * 100)}%` }} />
                    </div>
                    <span className="w-9 flex-shrink-0 text-right text-2xs tabular-nums text-ink-muted">
                      {Math.round(average * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ScrollFade>
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-paper px-3 py-2 text-left text-xs font-semibold text-ink-muted uppercase">
                  Personne
                </th>
                {weekStarts.map((w, i) => (
                  <th key={i} className="min-w-[64px] px-1 py-2 text-center text-2xs font-semibold text-ink-muted tabular-nums">
                    {w.getUTCDate()}/{w.getUTCMonth() + 1}
                  </th>
                ))}
                <th className="min-w-[64px] border-l border-line px-1 py-2 text-center text-2xs font-semibold text-ink-muted uppercase">
                  Moyenne
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.map(({ person, weeks: cells, average }) => (
                <tr key={person.id}>
                  <td className="sticky left-0 z-10 flex items-center gap-1.5 whitespace-nowrap bg-paper px-3 py-2 text-sm text-rail">
                    {person.name}
                    {overlapping.has(person.id) && (
                      <span
                        title="Deux tâches actives se chevauchent pour cette personne — voir le Gantt."
                        aria-label="Chevauchement"
                        className="inline-block h-2 w-2 flex-shrink-0 bg-alert"
                      />
                    )}
                  </td>
                  {cells.map((c, i) => (
                    <td key={i} className="border border-line p-0 text-center">
                      <div
                        style={{ background: `color-mix(in srgb, var(--color-heading) ${Math.round(c.ratio * 100)}%, var(--color-paper))` }}
                        className="flex h-9 w-full items-center justify-center"
                      >
                        <span
                          className="text-2xs font-bold tabular-nums"
                          style={{ color: c.ratio > 0.55 ? "var(--color-paper)" : "var(--color-ink)" }}
                        >
                          {c.available === 0 ? "—" : `${Math.round(c.ratio * 100)}%`}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="border-l border-line px-1 py-2 text-center text-sm font-semibold text-rail tabular-nums">
                    {Math.round(average * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollFade>
        </>
      )}

      <p className="mt-4 max-w-2xl text-xs text-ink-muted">
        Part des jours ouvrables occupés par des tâches non terminées (jours fériés, week-ends et absences déduits).
        Une tâche avec une estimation (demi-journées, fiche de tâche) répartit son effort sur sa plage de dates ;
        sans estimation, tout jour couvert compte comme entièrement occupé. Puce rose : chevauchement de deux tâches
        actives pour cette personne.
      </p>
    </div>
  );
}
