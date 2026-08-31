"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTimeEntryAt, updateTimeEntryTimes } from "@/lib/actions/time-entries";
import type { TimeEntryWithTask } from "@/lib/data/time-entries";
import type { TaskOption } from "@/lib/data/tasks";
import { addDays, fromIsoDate, mondayOf, today } from "@/lib/planning/dates";
import { formatDurationFr } from "@/lib/planning/time";
import { fieldInputClass } from "@/components/modals/modal-shell";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";

const HOUR_HEIGHT = 48; // px par heure
const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;
const SNAP_MINUTES = 15;
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// UTC de bout en bout, comme le reste de src/lib/planning — voir dates.ts.
// Les méthodes locales (getHours, getDate...) dépendraient du fuseau du
// navigateur et décaleraient le jour/l'heure affichés d'un cran selon le
// fuseau, alors que startedAt/endedAt sont écrits en UTC (voir
// addManualEntry, createTimeEntryAt).
function minutesSinceMidnight(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

interface DragState {
  entryId: string;
  mode: "move" | "resize";
  startClientY: number;
  startedAtMin: number; // minutes depuis minuit, valeur de départ du geste
  endedAtMin: number;
  dayStart: Date; // minuit du jour de l'écriture — sert de base pour reconstruire les horodatages
}

interface QuickAdd {
  dayStart: Date;
  startMinutes: number; // minutes depuis minuit, calé sur SNAP_MINUTES
  taskId: string;
  durationMinutes: number;
  // Coordonnées viewport du double-clic — le popover est positionné en
  // `fixed` à partir d'elles plutôt que niché dans la colonne du jour
  // (~110px de large, bien trop étroite pour un select + deux boutons ;
  // ça débordait hors de la grille, voir capture jointe par l'utilisateur).
  clientX: number;
  clientY: number;
}

const QUICK_ADD_WIDTH = 240;

/**
 * Vue calendrier de "Mon temps" — semaine en cours, une colonne par jour,
 * les écritures en blocs positionnés par leur heure. Glisser un bloc change
 * son heure de début (même durée) ; glisser son bord bas change sa durée.
 * Un minuteur en cours n'apparaît pas ici (pas d'heure de fin à positionner)
 * — voir le bandeau au-dessus de la liste.
 */
export function TimeCalendar({ entries, tasks }: { entries: TimeEntryWithTask[]; tasks: TaskOption[] }) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => mondayOf(fromIsoDate(today())));
  const [localEntries, setLocalEntries] = useState(entries);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAdd | null>(null);

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
    dayStart.setUTCHours(0, 0, 0, 0);
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

  function openQuickAdd(day: Date, ev: React.MouseEvent<HTMLDivElement>) {
    if (tasks.length === 0) return;
    const gridTop = ev.currentTarget.getBoundingClientRect().top;
    const offsetY = ev.clientY - gridTop;
    const rawMinutes = (offsetY / HOUR_HEIGHT) * 60 + GRID_START_HOUR * 60;
    const snapped = Math.max(
      GRID_START_HOUR * 60,
      Math.min(GRID_END_HOUR * 60 - SNAP_MINUTES, Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES),
    );
    const dayStart = new Date(day);
    dayStart.setUTCHours(0, 0, 0, 0);
    setQuickAdd({
      dayStart,
      startMinutes: snapped,
      taskId: tasks[0].id,
      durationMinutes: 30,
      clientX: ev.clientX,
      clientY: ev.clientY,
    });
  }

  function confirmQuickAdd() {
    if (!quickAdd) return;
    const startedAt = new Date(quickAdd.dayStart.getTime() + quickAdd.startMinutes * 60_000);
    const endedAt = new Date(startedAt.getTime() + quickAdd.durationMinutes * 60_000);
    const taskId = quickAdd.taskId;
    setQuickAdd(null);
    void createTimeEntryAt({ taskId, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() }).then(() =>
      router.refresh(),
    );
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
          onClick={() => setWeekStart(mondayOf(fromIsoDate(today())))}
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
                <span className="text-2xs text-ink-muted tabular-nums">{day.getUTCDate()}</span>
              </div>
              <div
                className="relative cursor-cell"
                style={{ height: GRID_HEIGHT }}
                onDoubleClick={(ev) => openQuickAdd(day, ev)}
              >
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
                      onDoubleClick={(ev) => ev.stopPropagation()}
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
        Double-cliquer une case pour ajouter une écriture ; glisser un bloc pour changer son heure ; glisser son bord
        bas pour changer sa durée (pas de 15 min).
      </p>

      {quickAdd && (
        <>
          {/* Voile invisible pour fermer le popover au clic extérieur, sans intercepter le reste de la page. */}
          <div className="fixed inset-0 z-40" onClick={() => setQuickAdd(null)} />
          <div
            className="fixed z-50 flex flex-col gap-2 rounded-lg border border-heading bg-paper p-2 shadow-none"
            style={{
              top: Math.min(quickAdd.clientY, window.innerHeight - 140),
              left: Math.min(quickAdd.clientX, window.innerWidth - QUICK_ADD_WIDTH - 8),
              width: QUICK_ADD_WIDTH,
            }}
          >
            <select
              value={quickAdd.taskId}
              onChange={(ev) => setQuickAdd((q) => (q ? { ...q, taskId: ev.target.value } : q))}
              className={`${fieldInputClass} text-xs`}
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.project ? ` — ${t.project.name}` : ""}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={SNAP_MINUTES}
                step={SNAP_MINUTES}
                value={quickAdd.durationMinutes}
                onChange={(ev) =>
                  setQuickAdd((q) => (q ? { ...q, durationMinutes: Number(ev.target.value) || SNAP_MINUTES } : q))
                }
                className={`${fieldInputClass} w-16 text-xs`}
              />
              <span className="text-xs text-ink-muted">min</span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setQuickAdd(null)}
                className={`px-2 py-1 text-xs font-semibold ${secondaryButtonClass}`}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmQuickAdd}
                className={`px-2 py-1 text-xs font-semibold ${primaryButtonClass}`}
              >
                Ajouter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
