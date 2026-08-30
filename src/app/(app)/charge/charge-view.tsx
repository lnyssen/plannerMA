"use client";

import { useMemo, useState } from "react";
import { addDays, belgianHolidaysRange, fromIsoDate, mondayOf, today } from "@/lib/planning/dates";
import { weeklyLoad, type LoadAbsence, type LoadTask } from "@/lib/planning/availability";

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
    const active = tasks.filter((t) => t.status !== "DELIVERED");
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
      people.map((p) => ({
        person: p,
        weeks: weekStarts.map((w) => weeklyLoad(p.id, w, tasks, absences, holidays)),
      })),
    [people, weekStarts, tasks, absences, holidays],
  );

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Charge
        </h1>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="ml-2 border-[1.5px] border-heading px-2 py-1 text-sm text-ink"
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
        <div className="overflow-x-auto">
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
              </tr>
            </thead>
            <tbody>
              {grid.map(({ person, weeks: cells }) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-2xl text-xs text-ink-muted">
        Part des jours ouvrables couverts par au moins une tâche non livrée (jours fériés, week-ends et absences
        déduits) — voir docs/plan-architecture.md pour la limite assumée (comptage binaire par jour, pas encore une
        estimation en demi-journées). Puce rose : chevauchement de deux tâches actives pour cette personne.
      </p>
    </div>
  );
}
