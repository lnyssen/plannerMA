"use client";

import { ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { TimeEntryWithPerson } from "@/lib/data/time-entries";
import { addDays, formatShortFr, mondayOf, toIsoDate } from "@/lib/planning/dates";
import { entryDurationMinutes, formatDurationFr } from "@/lib/planning/time";
import { secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Clock } from "lucide-react";

type Grain = "semaine" | "mois" | "annee";
type Axe = "personne" | "projet" | "tache" | "jour";

const GRAINS: SegmentedOption<Grain>[] = [
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Année" },
];

// Trois axes, pas six. L'axe secondaire est imposé par le principal : c'est
// la question qu'on se pose naturellement ensuite. Studio, Type de tâche et
// Tâche ont été retirés — ils encombraient la barre pour des lectures rares,
// et le dépliement les donne déjà : ouvrir un projet montre ses tâches,
// ouvrir un jour montre qui a travaillé.
const AXES: (SegmentedOption<Axe> & { sous: Axe; sousLabel: string })[] = [
  { id: "personne", label: "Personne", sous: "projet", sousLabel: "par projet" },
  { id: "projet", label: "Projet", sous: "tache", sousLabel: "par tâche" },
  { id: "jour", label: "Jour", sous: "personne", sousLabel: "par personne" },
];

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Clé et libellé d'une écriture sur un axe donné. */
function clef(entry: TimeEntryWithPerson, axe: Axe): { id: string; label: string; couleur?: string } {
  switch (axe) {
    case "personne":
      return { id: entry.person.id, label: entry.person.name };
    case "projet":
      return entry.project
        ? { id: entry.project.id, label: `${entry.project.client.name} — ${entry.project.name}` }
        : { id: "__agence", label: "AGENCE (hors projet)" };
    case "tache":
      return entry.task ? { id: entry.task.id, label: entry.task.title } : { id: "__sans", label: "Sans tâche planifiée" };
    case "jour": {
      const iso = toIsoDate(entry.startedAt);
      return { id: iso, label: formatShortFr(iso) };
    }
  }
}

/** Bornes de la période affichée, et son intitulé. */
function periode(grain: Grain, decalage: number) {
  const now = new Date();
  if (grain === "semaine") {
    const lundi = addDays(mondayOf(now), decalage * 7);
    const fin = addDays(lundi, 7);
    return { debut: lundi, fin, label: `Semaine du ${formatShortFr(toIsoDate(lundi))}` };
  }
  if (grain === "mois") {
    const debut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + decalage, 1));
    const fin = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1));
    return { debut, fin, label: `${MOIS[debut.getUTCMonth()]} ${debut.getUTCFullYear()}` };
  }
  const debut = new Date(Date.UTC(now.getUTCFullYear() + decalage, 0, 1));
  const fin = new Date(Date.UTC(debut.getUTCFullYear() + 1, 0, 1));
  return { debut, fin, label: String(debut.getUTCFullYear()) };
}

/**
 * Analyse du temps de l'équipe.
 *
 * L'écran affichait une liste plate de toutes les écritures, sans période ni
 * regroupement : lisible sur quelques dizaines de lignes, inexploitable dès
 * qu'une année de pointage s'accumule — et c'est précisément à ce
 * moment-là qu'on en a besoin, pour un rapport ou un justificatif.
 *
 * On choisit donc une période, puis l'axe de lecture. Chaque ligne se déplie
 * sur un second axe imposé par le premier, qui est la question qu'on se pose
 * naturellement ensuite.
 *
 * Il n'y a pas d'axe « sous-tâche » : une écriture se rattache à une tâche,
 * jamais à une sous-tâche (voir TimeEntry dans le schéma). Les sous-tâches
 * servent à cocher l'avancement, pas à ventiler des heures. « Type de tâche »
 * est l'axe le plus fin disponible, et c'est celui de votre nomenclature de
 * suivi.
 */
export function TeamTimeView({ entries, referenceNow }: { entries: TimeEntryWithPerson[]; referenceNow: Date }) {
  const [grain, setGrain] = useState<Grain>("mois");
  const [decalage, setDecalage] = useState(0);
  const [axe, setAxe] = useState<Axe>("personne");
  const [ouverts, setOuverts] = useState<string[]>([]);

  const { debut, fin, label } = useMemo(() => periode(grain, decalage), [grain, decalage]);
  const sousAxe = AXES.find((a) => a.id === axe)!;

  const dansPeriode = useMemo(
    () => entries.filter((e) => e.startedAt >= debut && e.startedAt < fin),
    [entries, debut, fin],
  );

  const groupes = useMemo(() => {
    const parClef = new Map<string, { label: string; couleur?: string; minutes: number; nb: number; sous: Map<string, { label: string; minutes: number; nb: number }> }>();
    for (const e of dansPeriode) {
      const k = clef(e, axe);
      const minutes = entryDurationMinutes(e, referenceNow);
      let g = parClef.get(k.id);
      if (!g) {
        g = { label: k.label, couleur: k.couleur, minutes: 0, nb: 0, sous: new Map() };
        parClef.set(k.id, g);
      }
      g.minutes += minutes;
      g.nb++;
      const s = clef(e, sousAxe.sous);
      const sg = g.sous.get(s.id);
      if (sg) {
        sg.minutes += minutes;
        sg.nb++;
      } else {
        g.sous.set(s.id, { label: s.label, minutes, nb: 1 });
      }
    }
    return [...parClef.entries()]
      .map(([id, g]) => ({ id, ...g, sous: [...g.sous.values()].sort((a, b) => b.minutes - a.minutes) }))
      // Par jour, l'ordre chronologique prime sur le volume : on lit une
      // semaine dans l'ordre où elle s'est déroulée.
      .sort((a, b) => (axe === "jour" ? a.id.localeCompare(b.id) : b.minutes - a.minutes));
  }, [dansPeriode, axe, sousAxe.sous, referenceNow]);

  const total = groupes.reduce((s, g) => s + g.minutes, 0);
  const pic = Math.max(...groupes.map((g) => g.minutes), 1);
  const personnes = new Set(dansPeriode.map((e) => e.person.id)).size;

  function bascule(id: string) {
    setOuverts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl ariaLabel="Granularité" size="sm" value={grain} onChange={(g) => { setGrain(g); setDecalage(0); }} options={GRAINS} />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setDecalage((d) => d - 1)} aria-label="Période précédente" className={`px-1.5 text-heading ${textButtonClass}`}>‹</button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-heading">{label}</span>
          <button type="button" onClick={() => setDecalage((d) => d + 1)} aria-label="Période suivante" className={`px-1.5 text-heading ${textButtonClass}`}>›</button>
          {decalage !== 0 && (
            <button type="button" onClick={() => setDecalage(0)} className={`ml-1 text-xs font-semibold text-heading underline-offset-2 hover:underline ${textButtonClass}`}>
              Aujourd’hui
            </button>
          )}
        </div>
        <span className="flex-1" />
        <a href="/api/export/time-entries" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}>
          <Download size={14} /> Exporter en CSV
        </a>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line p-3">
          <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Total</p>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-heading tabular-nums">{formatDurationFr(total)}</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Écritures</p>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-heading tabular-nums">{dansPeriode.length}</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Personnes</p>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-heading tabular-nums">{personnes}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Regrouper par</span>
        <SegmentedControl ariaLabel="Axe d’analyse" size="sm" value={axe} onChange={setAxe} options={AXES} />
      </div>

      {groupes.length === 0 ? (
        <EmptyState icon={Clock} title="Aucune écriture sur cette période" description="Changez de période ou de granularité." />
      ) : (
        <div className="flex flex-col gap-1">
          {groupes.map((g) => {
            const ouvert = ouverts.includes(g.id);
            return (
              <div key={g.id} className="rounded-lg border border-line">
                <button
                  type="button"
                  onClick={() => bascule(g.id)}
                  aria-expanded={ouvert}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <ChevronRight size={14} aria-hidden="true" className={`flex-shrink-0 text-ink-muted transition-transform duration-150 ${ouvert ? "rotate-90" : ""}`} />
                  <span className="w-56 flex-shrink-0 truncate text-sm font-semibold text-heading">{g.label}</span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-wash">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(g.minutes / pic) * 100}%`, background: g.couleur ?? "var(--color-heading)" }}
                    />
                  </span>
                  <span className="w-14 flex-shrink-0 text-right text-2xs text-ink-muted tabular-nums">{g.nb} écr.</span>
                  <span className="w-20 flex-shrink-0 text-right text-sm font-semibold text-ink tabular-nums">{formatDurationFr(g.minutes)}</span>
                  <span className="w-12 flex-shrink-0 text-right text-2xs text-ink-muted tabular-nums">
                    {total > 0 ? Math.round((g.minutes / total) * 100) : 0}%
                  </span>
                </button>

                {ouvert && (
                  <div className="border-t border-line px-3 py-2">
                    <p className="mb-1.5 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                      Détail {sousAxe.sousLabel}
                    </p>
                    <div className="flex flex-col gap-1">
                      {g.sous.map((s) => (
                        <div key={s.label} className="flex items-center gap-3 pl-6 text-sm">
                          <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
                          <span className="w-14 flex-shrink-0 text-right text-2xs text-ink-muted tabular-nums">{s.nb} écr.</span>
                          <span className="w-20 flex-shrink-0 text-right font-semibold text-ink tabular-nums">{formatDurationFr(s.minutes)}</span>
                          <span className="w-12 flex-shrink-0 text-right text-2xs text-ink-muted tabular-nums">
                            {Math.round((s.minutes / g.minutes) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-2xs text-ink-muted">
        Une écriture se rattache à une tâche, jamais à une sous-tâche : les sous-tâches servent à cocher l’avancement,
        pas à ventiler des heures. « Type de tâche » est l’axe le plus fin disponible — c’est celui de votre
        nomenclature de suivi, réglable dans Réglages → Catégories.
      </p>
    </div>
  );
}
