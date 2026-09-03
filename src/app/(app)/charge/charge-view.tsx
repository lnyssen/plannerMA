"use client";

import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, belgianHolidaysRange, fromIsoDate, mondayOf, today } from "@/lib/planning/dates";
import { weeklyLoad, type LoadAbsence, type LoadTask } from "@/lib/planning/availability";
import { entryDurationMinutes, formatDurationFr } from "@/lib/planning/time";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoHint } from "@/components/ui/info-hint";

interface ChargePerson {
  id: string;
  name: string;
  studios: string[];
  external: boolean;
}

interface ChargeTimeEntry {
  personId: string;
  startedAt: Date;
  endedAt: Date | null;
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
  timeEntries,
}: {
  people: ChargePerson[];
  tasks: LoadTask[];
  absences: LoadAbsence[];
  timeEntries: ChargeTimeEntry[];
}) {
  const [weeks, setWeeks] = useState(8);
  const weekStart0 = useMemo(() => mondayOf(fromIsoDate(today())), []);

  const weekStarts = useMemo(
    () => Array.from({ length: weeks }, (_, i) => addDays(weekStart0, i * 7)),
    [weeks, weekStart0],
  );

  // Total réellement enregistré (Temps) sur la même période affichée, par
  // personne — comparé à la charge prévue (%) sans convertir l'un dans
  // l'unité de l'autre : la charge n'a pas de notion d'heures par jour à
  // temps plein définie dans l'appli, une conversion serait une fausse
  // précision. Les deux chiffres côte à côte suffisent à repérer un écart.
  const rangeEnd = useMemo(() => addDays(weekStarts[weekStarts.length - 1] ?? weekStart0, 7), [weekStarts, weekStart0]);
  const actualMinutesByPerson = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of timeEntries) {
      if (e.startedAt < weekStart0 || e.startedAt >= rangeEnd) continue;
      map.set(e.personId, (map.get(e.personId) ?? 0) + entryDurationMinutes(e));
    }
    return map;
  }, [timeEntries, weekStart0, rangeEnd]);

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
        <div className="flex items-center gap-2">
          <SegmentedControl
            ariaLabel="Nombre de semaines affichées"
            size="sm"
            value={String(weeks)}
            onChange={(v) => setWeeks(Number(v))}
            options={WEEK_OPTIONS.map((n) => ({ id: String(n), label: String(n), title: `${n} semaines` }))}
          />
          <span className="text-sm text-ink-muted">semaines</span>
        </div>
        <InfoHint label="Comment cette charge est calculée">
          Part des jours ouvrables occupés par des tâches non terminées (jours fériés, week-ends et absences
          déduits). Une tâche avec une estimation (demi-journées, fiche de tâche) répartit son effort sur sa plage
          de dates ; sans estimation, tout jour couvert compte comme entièrement occupé. Puce rose : chevauchement
          de deux tâches actives pour cette personne. « Temps réel » (depuis Temps) : total effectivement enregistré
          sur la même période — à lire à côté de la charge prévue, pas convertie dans la même unité (l’appli ne
          définit pas d’heures par jour à temps plein).
        </InfoHint>
      </div>

      {people.length === 0 ? (
        <EmptyState icon={Users} title="Aucune personne dans l’équipe" description="Ajoutez des personnes dans Équipe pour voir leur charge ici." />
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
              <SectionHeading>Charge moyenne par studio</SectionHeading>
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
                <th className="sticky left-0 z-10 border-b-2 border-heading font-[family-name:var(--font-display)] font-medium tracking-[-0.1px] text-heading bg-paper px-3 py-2.5 text-left text-sm">
                  Personne
                </th>
                {weekStarts.map((w, i) => (
                  <th key={i} className="min-w-[64px] border-b-2 border-heading font-[family-name:var(--font-display)] font-medium tracking-[-0.1px] text-heading px-1 py-2.5 text-center text-2xs tabular-nums">
                    {w.getUTCDate()}/{w.getUTCMonth() + 1}
                  </th>
                ))}
                <th className="min-w-[64px] border-b-2 border-heading font-[family-name:var(--font-display)] font-medium tracking-[-0.1px] text-heading px-1 py-2.5 text-center text-2xs">
                  Moyenne
                </th>
                <th className="min-w-[72px] border-b-2 border-heading font-[family-name:var(--font-display)] font-medium tracking-[-0.1px] text-heading px-1 py-2.5 text-center text-2xs">
                  Temps réel
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.map(({ person, weeks: cells, average }) => (
                <tr key={person.id}>
                  <td className="sticky left-0 z-10 flex items-center gap-1.5 whitespace-nowrap bg-paper px-3 py-2 text-sm text-heading">
                    {person.name}
                    {person.external && (
                      <span className="text-2xs font-bold text-alert" title="Personne extérieure — capacité non garantie comme le personnel salarié.">
                        Invité
                      </span>
                    )}
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
                      {/* La teinte disait seulement « beaucoup » ou « peu » :
                          70 % et 110 % se ressemblaient, alors que l'un est sain
                          et l'autre est le problème qu'on vient chercher ici.
                          Au-delà du seuil de surcharge, l'aplat passe à
                          l'alerte. */}
                      <div
                        style={{
                          background: `color-mix(in srgb, var(--color-${c.ratio >= OVERLOAD_THRESHOLD ? "alert" : "heading"}) ${Math.min(100, Math.round(c.ratio * 100))}%, var(--color-paper))`,
                        }}
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
                  <td className="border-l border-line px-1 py-2 text-center text-sm font-semibold text-heading tabular-nums">
                    {Math.round(average * 100)}%
                  </td>
                  <td className="px-1 py-2 text-center text-xs text-ink-muted tabular-nums">
                    {formatDurationFr(actualMinutesByPerson.get(person.id) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollFade>
        </>
      )}

    </div>
  );
}
