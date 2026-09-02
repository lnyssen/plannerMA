import type { MonthlyHoursByStudio } from "@/lib/data/time-entries";
import { formatDurationFr } from "@/lib/planning/time";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return { short: MOIS[Number(month) - 1], year: year.slice(2) };
}

/**
 * Heures enregistrées par mois, empilées par studio.
 *
 * Barres verticales plutôt qu'une courbe : ce qu'on lit ici, c'est « combien
 * ce mois-là » et « quelle part pour quel studio », pas une trajectoire
 * continue. Les couleurs sont celles des studios (déjà utilisées partout
 * ailleurs), donc aucune légende arbitraire à retenir.
 *
 * Hauteur en pourcentage du mois le plus chargé : les valeurs absolues sont
 * portées par l'infobulle et par le total sous chaque barre, l'échelle sert
 * seulement à comparer les mois entre eux.
 */
export function MonthlyHoursChart({ data }: { data: MonthlyHoursByStudio }) {
  const peak = Math.max(...data.map((m) => m.total), 1);
  const grandTotal = data.reduce((sum, m) => sum + m.total, 0);

  if (grandTotal === 0) {
    return (
      <p className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink-muted">
        Aucune heure enregistrée sur les douze derniers mois.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-line p-4">
      {/* Les libellés de mois sont sortis de la piste des barres : tant qu'ils
          partageaient la même colonne flex, celle-ci n'avait pas de hauteur
          définie et la hauteur en pourcentage des barres se résolvait contre
          une hauteur de contenu quasi nulle — toutes les barres tombaient à
          une dizaine de pixels quelle que soit leur valeur. */}
      <div className="flex h-44 items-end gap-1.5">
        {data.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              title={
                m.total === 0
                  ? `${monthLabel(m.month).short} — aucune heure`
                  : `${monthLabel(m.month).short} — ${formatDurationFr(m.total)}\n` +
                    m.studios.map((s) => `${s.studio.name} : ${formatDurationFr(s.minutes)}`).join("\n")
              }
              style={{ height: `${(m.total / peak) * 100}%` }}
              className="flex w-full flex-col justify-end overflow-hidden rounded-t"
            >
              {m.studios.map((s) => (
                <div
                  key={s.studio.id}
                  style={{
                    height: `${(s.minutes / m.total) * 100}%`,
                    background: s.studio.fillHex,
                    borderTop: `2px solid ${s.studio.colorHex}`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* L'année n'apparaît qu'au changement d'année : répétée sur douze
          colonnes étroites, elle ne servait qu'à faire tronquer le mois. */}
      <div className="mt-1 flex gap-1.5">
        {data.map((m, i) => {
          const { short, year } = monthLabel(m.month);
          const nouvelleAnnee = i === 0 || monthLabel(data[i - 1].month).year !== year;
          return (
            <span key={m.month} className="min-w-0 flex-1 truncate text-center text-2xs text-ink-muted">
              {nouvelleAnnee ? `${short} ${year}` : short}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
        {[...new Map(data.flatMap((m) => m.studios).map((s) => [s.studio.id, s.studio])).values()].map((studio) => (
          <span key={studio.id} className="flex items-center gap-1.5 text-2xs text-ink-muted">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
              style={{ background: studio.fillHex, borderTop: `2px solid ${studio.colorHex}` }}
            />
            {studio.name}
          </span>
        ))}
      </div>
    </div>
  );
}
