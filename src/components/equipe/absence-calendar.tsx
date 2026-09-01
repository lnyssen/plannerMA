"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { textButtonClass } from "@/components/ui/buttons";
import { addDays, fromIsoDate, mondayOf, toIsoDate, today } from "@/lib/planning/dates";

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const JOURS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
// 6 rangées fixes : toujours assez pour couvrir un mois (le pire cas, un mois
// de 31 jours commençant un dimanche, en occupe 6) — une hauteur de grille
// stable plutôt qu'une grille qui saute de 5 à 6 rangées selon le mois.
const WEEKS = 6;

export interface AbsenceCalendarEntry {
  id: string;
  personId: string;
  personName: string;
  startDate: Date;
  endDate: Date;
  /** null pour une absence qui n'est pas la sienne sur un compte non-admin — voir la redaction côté serveur dans equipe/page.tsx. */
  reason: string | null;
}

/**
 * Calendrier mensuel des absences de l'équipe — vue de coordination : qui
 * est absent quand, visible par tout le monde (contrairement à la gestion
 * des absences elle-même, réservée à soi-même ou à un administrateur — voir
 * canManageAbsenceFor). Le motif (`reason`) n'est affiché que si le serveur
 * l'a transmis (soi-même ou administrateur).
 */
export function AbsenceCalendar({ absences }: { absences: AbsenceCalendarEntry[] }) {
  const [monthStart, setMonthStart] = useState(() => {
    const t = fromIsoDate(today());
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  });

  const gridStart = useMemo(() => mondayOf(monthStart), [monthStart]);
  const days = useMemo(() => Array.from({ length: WEEKS * 7 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const todayIso = today();

  const absencesByDay = useMemo(() => {
    const map = new Map<string, AbsenceCalendarEntry[]>();
    for (const day of days) {
      const iso = toIsoDate(day);
      const hits = absences.filter((a) => toIsoDate(a.startDate) <= iso && iso <= toIsoDate(a.endDate));
      if (hits.length > 0) map.set(iso, hits);
    }
    return map;
  }, [days, absences]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-heading">
          {MOIS[monthStart.getUTCMonth()]} {monthStart.getUTCFullYear()}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setMonthStart((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)))}
          className={`p-1 text-heading ${textButtonClass}`}
          aria-label="Mois précédent"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            const t = fromIsoDate(today());
            setMonthStart(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)));
          }}
          className={`text-sm font-semibold text-heading underline-offset-2 hover:underline ${textButtonClass}`}
        >
          Aujourd’hui
        </button>
        <button
          type="button"
          onClick={() => setMonthStart((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)))}
          className={`p-1 text-heading ${textButtonClass}`}
          aria-label="Mois suivant"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-line">
        {JOURS.map((j) => (
          <div key={j} className="border-r border-b border-line bg-wash px-2 py-1.5 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
            {j}
          </div>
        ))}
        {days.map((day) => {
          const iso = toIsoDate(day);
          const inMonth = day.getUTCMonth() === monthStart.getUTCMonth();
          const isToday = iso === todayIso;
          const hits = absencesByDay.get(iso) ?? [];
          return (
            <div
              key={iso}
              className="flex min-h-[92px] flex-col gap-1 border-r border-b border-line p-1.5"
              style={{ background: inMonth ? "transparent" : "var(--color-wash)" }}
            >
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: isToday ? "var(--color-heading)" : inMonth ? "var(--color-ink)" : "var(--color-ink-muted)" }}
              >
                {day.getUTCDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {hits.map((a) => (
                  <span
                    key={a.id}
                    title={a.reason ?? a.personName}
                    className="truncate rounded px-1 py-0.5 text-2xs font-semibold text-heading"
                    // color-mix vers transparent (pas un aplat --color-tint) : le fond
                    // se compose sur le paper de la page, donc reste lisible avec le
                    // texte heading dans les deux thèmes — un aplat --color-tint fixe
                    // tombait sous 4.5:1 de contraste en mode sombre (texte lavande sur
                    // fond tint moyen), corrigé après une passe de vérification.
                    style={{ background: "color-mix(in srgb, var(--color-heading) 16%, transparent)" }}
                  >
                    {a.personName}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
