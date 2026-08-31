"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updateTimeEntryTimes } from "@/lib/actions/time-entries";
import type { TimeEntryWithTask } from "@/lib/data/time-entries";
import { addDays, mondayOf, today } from "@/lib/planning/dates";
import { formatDurationFr } from "@/lib/planning/time";

const HOUR_HEIGHT = 48; // px par heure
const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;
const SNAP_MINUTES = 15;
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface DragState {
  entryId: string;
  mode: "move" | "resize";
  startClientY: number;
  startedAtMin: number; // minutes depuis minuit, valeur de départ du geste
  endedAtMin: number;
  dayStart: Date; // minuit du jour de l'écriture — sert de base pour reconstruire les horodatages
}

/**
 * Vue calendrier de "Mon temps" — semaine en cours, une colonne par jour,
 * les écritures en blocs positionnés par leur heure. Glisser un bloc change
 * son heure de début (même durée) ; glisser son bord bas change sa durée.
 * Un minuteur en cours n'apparaît pas ici (pas d'heure de fin à positionner)
 * — voir le bandeau au-dessus de la liste.
 */
export function TimeCalendar({ entries }: { entries: TimeEntryWithTask[] }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date(`${today()}T00:00:00`)));
  const [localEntries, setLocalEntries] = useState(entries);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Resynchronise l'état local sur les données serveur fraîches (après un
  // glisser confirmé, ou une écriture ajoutée ailleurs) — ajustement pendant
  // le rendu plutôt que dans un effet, même solution que gantt-view.tsx.
  const [syncedEntries, setSyncedEntries] = useState(entries);
  if (entries !== syncedEntries) {
    setSyncedEntries(entries);
    setLocalEntries(entries);
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const completed = useMemo(() => localEntries.filter((e) => e.endedAt !== null), [localEntries]);

  const commitMove = useCallback(async (entryId: string, startedAt: Date, endedAt: Date) => {
    await updateTimeEntryTimes({
      entryId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    });
  }, []);

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const deltaMin = Math.round(((e.clientY - d.startClientY) / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES;
      setLocalEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== d.entryId || !entry.endedAt) return entry;
          if (d.mode === "move") {
            const duration = d.endedAtMin - d.startedAtMin;
            const newStart = Math.max(0, Math.min(24 * 60 - duration, d.startedAtMin + deltaMin));
            return {
              ...entry,
              startedAt: new Date(d.dayStart.getTime() + newStart * 60_000),
              endedAt: new Date(d.dayStart.getTime() + (newStart + duration) * 60_000),
            };
          }
          const newEnd = Math.max(d.startedAtMin + SNAP_MINUTES, Math.min(24 * 60, d.endedAtMin + deltaMin));
          return { ...entry, endedAt: new Date(d.dayStart.getTime() + newEnd * 60_000) };
        }),
      );
    }
    function onUp() {
      const d = dragRef.current;
      setDrag(null);
      dragRef.current = null;
      if (!d) return;
      // Lit l'état local final (déjà mis à jour par onMove pendant le geste)
      // via la forme fonctionnelle plutôt que la closure `localEntries`, qui
      // peut être en retard d'un rendu à ce point.
      setLocalEntries((prev) => {
        const updated = prev.find((en) => en.id === d.entryId);
        if (updated?.endedAt) void commitMove(d.entryId, updated.startedAt, updated.endedAt);
        return prev;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, commitMove]);

  function startDrag(entry: TimeEntryWithTask, mode: "move" | "resize", clientY: number) {
    if (!entry.endedAt) return;
    const dayStart = new Date(entry.startedAt);
    dayStart.setHours(0, 0, 0, 0);
    const state: DragState = {
      entryId: entry.id,
      mode,
      startClientY: clientY,
      startedAtMin: minutesSinceMidnight(entry.startedAt),
      endedAtMin: minutesSinceMidnight(entry.endedAt),
      dayStart,
    };
    dragRef.current = state;
    setDrag(state);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          aria-label="Semaine précédente"
          className="p-1 text-ink-muted hover:text-ink"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          aria-label="Semaine suivante"
          className="p-1 text-ink-muted hover:text-ink"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(mondayOf(new Date(`${today()}T00:00:00`)))}
          className="text-xs font-semibold text-heading hover:underline"
        >
          Cette semaine
        </button>
      </div>

      <div className="flex overflow-x-auto rounded-lg border border-line">
        <div className="flex-shrink-0" style={{ width: 40 }}>
          <div className="h-8 border-b border-line" />
          {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => (
            <div key={i} style={{ height: HOUR_HEIGHT }} className="border-b border-line pr-1.5 text-right text-2xs text-ink-muted">
              {GRID_START_HOUR + i}h
            </div>
          ))}
        </div>
        {days.map((day, dayIndex) => {
          const dayEntries = completed.filter((e) => dayKey(e.startedAt) === dayKey(day));
          return (
            <div key={dayIndex} className="relative flex-1 border-l border-line" style={{ minWidth: 110 }}>
              <div className="flex h-8 flex-col items-center justify-center border-b border-line">
                <span className="text-2xs font-semibold text-ink-muted uppercase">{JOURS[dayIndex]}</span>
                <span className="text-2xs text-ink-muted tabular-nums">{day.getDate()}</span>
              </div>
              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => (
                  <div key={i} style={{ position: "absolute", top: i * HOUR_HEIGHT, width: "100%", height: HOUR_HEIGHT }} className="border-b border-line" />
                ))}
                {dayEntries.map((e) => {
                  if (!e.endedAt) return null;
                  const startMin = minutesSinceMidnight(e.startedAt) - GRID_START_HOUR * 60;
                  const endMin = minutesSinceMidnight(e.endedAt) - GRID_START_HOUR * 60;
                  const top = (startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(16, ((endMin - startMin) / 60) * HOUR_HEIGHT);
                  return (
                    <div
                      key={e.id}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        startDrag(e, "move", ev.clientY);
                      }}
                      title={`${e.task.title} — ${formatDurationFr(endMin - startMin)}`}
                      className="absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded-md px-1.5 py-1 text-2xs font-semibold text-paper active:cursor-grabbing"
                      style={{ top, height, background: "var(--color-heading)" }}
                    >
                      <span className="block truncate">{e.task.title}</span>
                      <span className="block truncate opacity-80">{formatDurationFr(endMin - startMin)}</span>
                      <div
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          startDrag(e, "resize", ev.clientY);
                        }}
                        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-2xs text-ink-muted">
        Glisser un bloc pour changer son heure ; glisser son bord bas pour changer sa durée (pas de 15 min).
      </p>
    </div>
  );
}
