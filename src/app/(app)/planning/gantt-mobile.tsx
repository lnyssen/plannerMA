"use client";

import { AlertTriangle, CornerDownRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { GanttTask } from "@/lib/data/gantt";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { StudioBadge } from "@/components/ui/studio-badge";
import { formatShortFr, mondayOf, toIsoDate, today } from "@/lib/planning/dates";

/**
 * La frise, refaite pour le téléphone.
 *
 * Un diagramme de Gantt suppose de la largeur : on y lit des durées et des
 * décalages en comparant des barres côte à côte. Rétréci à 375 px, il ne
 * montrait plus que quelques jours et perdait précisément ce qui en fait
 * l'intérêt.
 *
 * Cette vue garde ce que la frise apprend — l'ordre des choses, ce qui
 * chevauche, ce qui attend quoi — et l'exprime dans la forme qui convient à
 * un écran étroit : une liste chronologique, groupée par semaine. Les dates
 * sont écrites plutôt que dessinées, la dépendance est nommée plutôt que
 * reliée par un trait, et le chevauchement est dit plutôt que suggéré par un
 * contour.
 */
export function GanttMobile({
  tasks,
  overlappingTaskIds,
  titreParId,
}: {
  tasks: GanttTask[];
  overlappingTaskIds: Set<string>;
  /** Titres indexés par identifiant, pour nommer la tâche dont on dépend. */
  titreParId: Map<string, string>;
}) {
  const router = useRouter();
  const auj = today();

  // Groupées par semaine de démarrage : c'est l'unité dans laquelle une
  // petite équipe raisonne, et elle suffit à rendre l'ordre lisible.
  const semaines = new Map<string, GanttTask[]>();
  for (const t of [...tasks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())) {
    const cle = toIsoDate(mondayOf(t.startDate));
    if (!semaines.has(cle)) semaines.set(cle, []);
    semaines.get(cle)!.push(t);
  }

  if (semaines.size === 0) {
    return <p className="rounded-lg border border-line px-3 py-4 text-sm text-ink-muted">Aucune tâche sur cette période.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {[...semaines.entries()].map(([lundi, sesTaches]) => (
        <div key={lundi}>
          <p className="mb-1.5 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
            Semaine du {formatShortFr(lundi)}
          </p>
          <div className="flex flex-col gap-1.5">
            {sesTaches.map((t) => {
              const enRetard = toIsoDate(t.endDate) < auj;
              const chevauche = overlappingTaskIds.has(t.id);
              const dependDe = t.dependsOnId ? titreParId.get(t.dependsOnId) : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/taches/${t.id}`)}
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-left transition-colors duration-100 active:bg-wash"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 text-sm font-bold text-heading">{t.title}</span>
                    <span
                      className="flex-shrink-0 text-2xs font-semibold tabular-nums"
                      style={{ color: enRetard ? "var(--color-alert)" : "var(--color-ink-muted)" }}
                    >
                      {formatShortFr(toIsoDate(t.startDate))} → {formatShortFr(toIsoDate(t.endDate))}
                    </span>
                  </div>

                  {t.project && (
                    <p className="mb-1.5 truncate text-2xs text-ink-muted">
                      <strong className="font-bold text-ink">{t.project.client.name}</strong> — {t.project.name}
                    </p>
                  )}

                  <div className="mb-1.5 flex flex-wrap items-center gap-1">
                    {t.studios.map(({ studio }) => (
                      <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <PersonAvatar name={t.assignee?.name ?? null} size="sm" />
                      {t.assignee?.name ?? "Non attribué"}
                    </span>
                    {enRetard && (
                      <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-alert)" }}>
                        <AlertTriangle size={11} /> échéance dépassée
                      </span>
                    )}
                    {chevauche && (
                      <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-alert)" }}>
                        <AlertTriangle size={11} /> chevauche une autre tâche
                      </span>
                    )}
                  </div>

                  {dependDe && (
                    <p className="mt-1.5 flex items-center gap-1 text-2xs text-ink-muted">
                      <CornerDownRight size={11} className="flex-shrink-0" aria-hidden="true" />
                      après « {dependDe} »
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
