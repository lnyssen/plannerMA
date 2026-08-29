"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GanttTask } from "@/lib/data/gantt";
import { rescheduleTask } from "@/lib/actions/tasks";
import {
  addDays,
  belgianHolidaysRange,
  daysBetween,
  fromIsoDate,
  holidayName,
  isWeekend,
  mondayOf,
  toIsoDate,
  today,
} from "@/lib/planning/dates";
import { hasDependencyConflict } from "@/lib/planning/tasks";

const DAY_WIDTH = 30;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 50;
const LABEL_WIDTH = 230;
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS1 = ["D", "L", "M", "M", "J", "V", "S"];

type DragState = { taskId: string; mode: "move" | "resize"; startClientX: number; deltaDays: number };

interface Row {
  type: "projet" | "tache";
  label: string;
  task?: GanttTask;
}

export function GanttChart({ initialTasks }: { initialTasks: GanttTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  // Resynchronise l'état local sur les données serveur fraîches (après
  // création d'une tâche ailleurs, ou après la revalidation qui suit un
  // glisser) — ajustement pendant le rendu plutôt que dans un effet, cf.
  // https://react.dev/learn/you-might-not-need-an-effect
  const [syncedInitialTasks, setSyncedInitialTasks] = useState(initialTasks);
  if (initialTasks !== syncedInitialTasks) {
    setSyncedInitialTasks(initialTasks);
    setTasks(initialTasks);
  }

  const [weekStart, setWeekStart] = useState(() => mondayOf(addDays(fromIsoDate(today()), -7)));
  const [weeks, setWeeks] = useState(8);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canDrag, setCanDrag] = useState(true);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const [, startTransition] = useTransition();

  const commitReschedule = useCallback(async (task: GanttTask, newStart: Date, newEnd: Date) => {
    const previous = task;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, startDate: newStart, endDate: newEnd } : t)));
    const result = await rescheduleTask({
      taskId: task.id,
      startDate: toIsoDate(newStart),
      endDate: toIsoDate(newEnd),
      expectedVersion: task.version,
    });
    // La revalidation déclenchée par l'action serveur retombe sur le
    // routeur Next ; l'envelopper dans une transition évite l'avertissement
    // React "Cannot update a component while rendering a different
    // component" observé lors des tests de glisser sans elle.
    startTransition(() => {
      if (result.error) {
        setError(result.error);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? previous : t)));
      } else if (result.version != null) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, version: result.version! } : t)));
      }
    });
  }, [startTransition]);

  useEffect(() => {
    const check = () => setCanDrag(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const days = useMemo(() => Array.from({ length: weeks * 7 }, (_, i) => addDays(weekStart, i)), [weekStart, weeks]);
  const startIsoOfView = toIsoDate(weekStart);
  const todayIso = today();

  const holidays = useMemo(() => {
    const years = days.map((d) => d.getUTCFullYear());
    return belgianHolidaysRange(Math.min(...years), Math.max(...years));
  }, [days]);

  const rows: Row[] = useMemo(() => {
    const byProject = new Map<string, GanttTask[]>();
    for (const t of tasks) {
      const key = t.projectId ?? "__none";
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(t);
    }
    const out: Row[] = [];
    for (const list of byProject.values()) {
      out.push({ type: "projet", label: list[0].project?.name ?? "Sans projet" });
      for (const t of [...list].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())) {
        out.push({ type: "tache", label: t.title, task: t });
      }
    }
    return out;
  }, [tasks]);

  const isDragging = drag !== null;

  useEffect(() => {
    if (!isDragging) return;
    // S'abonne une seule fois par glisser (pas à chaque mousemove, cf.
    // `isDragging` plutôt que `drag` en dépendance) : ré-attacher les
    // écouteurs à chaque tick de déplacement a déjà produit un double appel
    // de rescheduleTask en pratique (deux POST identiques dans les logs),
    // qui déclenchait à tort le refus de verrouillage optimiste.
    let committed = false;
    function onMove(e: MouseEvent) {
      setDrag((d) => (d ? { ...d, deltaDays: Math.round((e.clientX - d.startClientX) / DAY_WIDTH) } : d));
    }
    function onUp() {
      setDrag((current) => {
        if (current && current.deltaDays !== 0 && !committed) {
          committed = true;
          const task = tasksRef.current.find((t) => t.id === current.taskId);
          if (task) {
            let newStart = task.startDate;
            let newEnd = task.endDate;
            if (current.mode === "move") {
              newStart = addDays(task.startDate, current.deltaDays);
              newEnd = addDays(task.endDate, current.deltaDays);
            } else {
              const candidate = addDays(task.endDate, current.deltaDays);
              if (candidate >= task.startDate) newEnd = candidate;
            }
            void commitReschedule(task, newStart, newEnd);
          }
        }
        return null;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, commitReschedule]);

  const positionOf = useCallback(
    (task: GanttTask) => {
      const dragging = drag && drag.taskId === task.id ? drag : null;
      const dm = dragging?.mode === "move" ? dragging.deltaDays : 0;
      const dr = dragging?.mode === "resize" ? dragging.deltaDays : 0;
      const x = (daysBetween(startIsoOfView, toIsoDate(task.startDate)) + dm) * DAY_WIDTH;
      const w = Math.max(
        DAY_WIDTH,
        (daysBetween(toIsoDate(task.startDate), toIsoDate(task.endDate)) + 1 + dr) * DAY_WIDTH,
      );
      return { x, w };
    },
    [drag, startIsoOfView],
  );

  const rowIndexByTaskId = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.task) m.set(r.task.id, i);
    });
    return m;
  }, [rows]);

  const links = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; conflict: boolean }[] = [];
    for (const t of tasks) {
      if (!t.dependsOnId) continue;
      const pred = tasks.find((x) => x.id === t.dependsOnId);
      if (!pred) continue;
      const yA = rowIndexByTaskId.get(pred.id);
      const yB = rowIndexByTaskId.get(t.id);
      if (yA == null || yB == null) continue;
      const a = positionOf(pred);
      const b = positionOf(t);
      out.push({
        x1: a.x + a.w,
        y1: yA * ROW_HEIGHT + ROW_HEIGHT / 2,
        x2: b.x,
        y2: yB * ROW_HEIGHT + ROW_HEIGHT / 2,
        conflict: hasDependencyConflict(
          { startDate: toIsoDate(t.startDate), endDate: toIsoDate(t.endDate) },
          { startDate: toIsoDate(pred.startDate), endDate: toIsoDate(pred.endDate) },
        ),
      });
    }
    return out;
  }, [tasks, rowIndexByTaskId, positionOf]);

  const width = days.length * DAY_WIDTH;
  const height = Math.max(rows.length * ROW_HEIGHT, 80);

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Gantt
        </h1>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="ml-2 border-[1.5px] border-heading px-2 py-1 text-sm text-ink"
        >
          {[2, 4, 8, 12, 16].map((n) => (
            <option key={n} value={n}>
              {n} semaines
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <button type="button" onClick={() => setWeekStart((w) => addDays(w, -14))} className="text-heading" aria-label="Reculer">
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(mondayOf(addDays(fromIsoDate(today()), -7)))}
          className="text-sm font-semibold text-heading underline-offset-2 hover:underline"
        >
          Aujourd’hui
        </button>
        <button type="button" onClick={() => setWeekStart((w) => addDays(w, 14))} className="text-heading" aria-label="Avancer">
          <ChevronRight size={18} />
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}

      <div className="flex border border-line">
        <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} className="border-r border-line">
          <div style={{ height: HEADER_HEIGHT }} className="flex items-center border-b border-line bg-wash px-3">
            <span className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Projets · tâches</span>
          </div>
          {rows.length === 0 ? (
            <div style={{ height }} className="flex items-center px-3 text-sm text-ink-muted">
              Aucune tâche.
            </div>
          ) : (
            rows.map((r, i) => (
              <div
                key={i}
                style={{ height: ROW_HEIGHT }}
                className={`flex items-center overflow-hidden border-b border-line px-3 text-sm text-ellipsis whitespace-nowrap ${
                  r.type === "projet" ? "bg-wash font-bold text-rail" : "pl-6 text-ink"
                }`}
              >
                {r.label}
              </div>
            ))
          )}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div style={{ width }}>
            <div style={{ height: HEADER_HEIGHT }} className="relative border-b border-line bg-wash">
              {days.map(
                (d, i) =>
                  i % 7 === 0 && (
                    <div
                      key={i}
                      style={{ position: "absolute", left: i * DAY_WIDTH, top: 0, width: 7 * DAY_WIDTH, height: 22 }}
                      className="overflow-hidden border-l border-line pl-1.5 text-xs font-bold whitespace-nowrap text-ink"
                    >
                      {d.getUTCDate()} {MOIS[d.getUTCMonth()]}
                    </div>
                  ),
              )}
              {days.map((d, i) => {
                const h = holidayName(d, holidays);
                return (
                  <div
                    key={i}
                    title={h ?? ""}
                    style={{
                      position: "absolute",
                      left: i * DAY_WIDTH,
                      top: 22,
                      width: DAY_WIDTH,
                      height: 28,
                      background: h ? "var(--color-alert-wash)" : "transparent",
                      opacity: isWeekend(d) ? 0.5 : 1,
                    }}
                    className="text-center"
                  >
                    <div className="text-[9.5px] font-bold text-ink-muted">{JOURS1[d.getUTCDay()]}</div>
                    <div className="text-[10.5px] tabular-nums text-ink">{d.getUTCDate()}</div>
                  </div>
                );
              })}
            </div>

            <div className="relative" style={{ height }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: i * DAY_WIDTH,
                    top: 0,
                    bottom: 0,
                    width: DAY_WIDTH,
                    borderLeft: "1px solid var(--color-line)",
                    background:
                      toIsoDate(d) === todayIso
                        ? "var(--color-tint)"
                        : holidayName(d, holidays)
                          ? "var(--color-alert-wash)"
                          : isWeekend(d)
                            ? "var(--color-wash)"
                            : "transparent",
                    opacity: toIsoDate(d) === todayIso ? 0.35 : 1,
                  }}
                />
              ))}

              <svg width={width} height={height} className="pointer-events-none absolute inset-0">
                {links.map((l, i) => (
                  <g key={i}>
                    <path
                      d={`M ${l.x1} ${l.y1} H ${l.x1 + 8} V ${l.y2} H ${l.x2}`}
                      fill="none"
                      stroke={l.conflict ? "#ff175e" : "#444444"}
                      strokeWidth={l.conflict ? 2 : 1.5}
                      strokeDasharray={l.conflict ? "4 3" : "0"}
                    />
                    <circle cx={l.x2} cy={l.y2} r={3} fill={l.conflict ? "#ff175e" : "#444444"} />
                  </g>
                ))}
              </svg>

              {rows.map((r, i) => {
                if (r.type !== "tache" || !r.task) return null;
                const t = r.task;
                const { x, w } = positionOf(t);
                return (
                  <div
                    key={t.id}
                    style={{
                      position: "absolute",
                      top: i * ROW_HEIGHT + 5,
                      left: x,
                      width: w,
                      height: ROW_HEIGHT - 10,
                      background: t.studio.fillHex,
                      color: t.studio.colorHex,
                      cursor: canDrag ? (drag ? "grabbing" : "grab") : "default",
                    }}
                    className="flex items-center gap-1.5 overflow-hidden px-2"
                    onMouseDown={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      setDrag({ taskId: t.id, mode: "move", startClientX: e.clientX, deltaDays: 0 });
                    }}
                    title={`${t.title} · ${t.assignee?.name ?? "non attribué"}`}
                  >
                    <span className="truncate text-2xs font-bold whitespace-nowrap">{t.title}</span>
                    {canDrag && (
                      <span
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDrag({ taskId: t.id, mode: "resize", startClientX: e.clientX, deltaDays: 0 });
                        }}
                        style={{ marginLeft: "auto", width: 8, height: "100%", cursor: "ew-resize" }}
                        className="flex-shrink-0 border-r-2"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        {canDrag
          ? "Glissez une barre pour décaler la tâche, sa poignée droite pour la durée. Colonnes teintées : jours fériés. Trait pointillé rouge : chevauchement de dépendance."
          : "Le glisser n’est actif que sur ordinateur."}
      </p>
    </div>
  );
}
