"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { textButtonClass } from "@/components/ui/buttons";
import type { GanttTask } from "@/lib/data/gantt";
import { rescheduleTask } from "@/lib/actions/tasks";
import {
  addDays,
  belgianHolidaysRange,
  daysBetween,
  formatRangeFr,
  fromIsoDate,
  holidayName,
  isWeekend,
  mondayOf,
  toIsoDate,
  today,
} from "@/lib/planning/dates";
import { hasDependencyConflict } from "@/lib/planning/tasks";

// Largeur minimale d'une colonne-jour : en dessous, le texte du jour/numéro
// devient illisible, donc la vue défile horizontalement plutôt que de
// continuer à rétrécir (voir `dayWidth`, calculé pour remplir le cadre
// disponible quand moins de semaines sont affichées).
const MIN_DAY_WIDTH = 30;
const ROW_HEIGHT = 44;
// Deux bandes empilées (mois, puis jour+numéro) : le numéro du jour est
// l'élément le plus consulté de l'en-tête, il a besoin de sa propre bande
// avec assez de hauteur pour respirer plutôt que d'être tassé contre le bord
// bas de l'en-tête, comme avant ce correctif.
const MONTH_ROW_HEIGHT = 24;
const DAY_ROW_HEIGHT = 38;
const HEADER_HEIGHT = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT;
const LABEL_WIDTH_DEFAULT = 230;
const LABEL_WIDTH_MIN = 140;
const LABEL_WIDTH_MAX = 480;
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
// Deux lettres plutôt qu'une seule : "M" pour Mardi ET Mercredi ne se
// distinguait pas à l'affichage (voir capture jointe par l'utilisateur).
const JOURS1 = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];

type DragState = { taskId: string; mode: "move" | "resize"; startClientX: number; deltaDays: number };

interface Row {
  type: "projet" | "tache";
  label: string;
  task?: GanttTask;
}

export function GanttView({
  initialTasks,
}: {
  initialTasks: GanttTask[];
}) {
  const router = useRouter();
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
  const [labelWidth, setLabelWidth] = useState(LABEL_WIDTH_DEFAULT);
  const [resizingLabel, setResizingLabel] = useState(false);
  const labelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const [, startTransition] = useTransition();

  // Largeur du cadre défilable, mesurée en direct : moins de semaines
  // choisies ne laisse plus de bande vide à droite, les colonnes s'étirent
  // pour remplir le cadre (jusqu'à MIN_DAY_WIDTH, en dessous duquel la vue
  // défile plutôt que de continuer à rétrécir).
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  useEffect(() => {
    if (!resizingLabel) return;
    function onMove(e: MouseEvent) {
      const start = labelResizeRef.current;
      if (!start) return;
      const next = Math.min(LABEL_WIDTH_MAX, Math.max(LABEL_WIDTH_MIN, start.startWidth + (e.clientX - start.startX)));
      setLabelWidth(next);
    }
    function onUp() {
      setResizingLabel(false);
      labelResizeRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingLabel]);

  const days = useMemo(() => Array.from({ length: weeks * 7 }, (_, i) => addDays(weekStart, i)), [weekStart, weeks]);
  const startIsoOfView = toIsoDate(weekStart);
  const todayIso = today();

  const dayWidth =
    containerWidth > 0 ? Math.max(MIN_DAY_WIDTH, Math.floor(containerWidth / days.length)) : MIN_DAY_WIDTH;
  const dayWidthRef = useRef(dayWidth);
  useEffect(() => {
    dayWidthRef.current = dayWidth;
  }, [dayWidth]);

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
      const project = list[0].project;
      out.push({ type: "projet", label: project ? `${project.client.name} — ${project.name}` : "Sans projet" });
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
      setDrag((d) => (d ? { ...d, deltaDays: Math.round((e.clientX - d.startClientX) / dayWidthRef.current) } : d));
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
      const x = (daysBetween(startIsoOfView, toIsoDate(task.startDate)) + dm) * dayWidth;
      const w = Math.max(
        dayWidth,
        (daysBetween(toIsoDate(task.startDate), toIsoDate(task.endDate)) + 1 + dr) * dayWidth,
      );
      return { x, w };
    },
    [drag, startIsoOfView, dayWidth],
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

  const width = days.length * dayWidth;
  const height = Math.max(rows.length * ROW_HEIGHT, 80);

  // Une personne ne peut pas être à deux endroits en même temps : signale
  // (contour rose, réservé aux rares alertes de surcharge — voir
  // docs/design-system.md) toute paire de tâches d'une même personne dont les
  // plages se chevauchent, distinct des conflits de dépendance déjà affichés
  // (trait pointillé entre tâches liées).
  const overlappingTaskIds = useMemo(() => {
    const flagged = new Set<string>();
    for (let i = 0; i < tasks.length; i++) {
      const a = tasks[i];
      if (!a.assigneeId) continue;
      for (let j = i + 1; j < tasks.length; j++) {
        const b = tasks[j];
        if (b.assigneeId !== a.assigneeId) continue;
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
          flagged.add(a.id);
          flagged.add(b.id);
        }
      }
    }
    return flagged;
  }, [tasks]);

  const viewEndIso = toIsoDate(days[days.length - 1] ?? weekStart);
  const rangeLabel = formatRangeFr(startIsoOfView, viewEndIso);

  // Équivalent clavier du glisser-déposer : Flèches pour décaler d'un jour,
  // Maj+Flèches pour raccourcir/allonger, Entrée/Espace pour ouvrir le
  // détail (équivalent du double-clic). Actif même quand `canDrag` est faux
  // (souris désactivée sous 900 px) — le clavier n'a pas cette limite.
  function onBarKeyDown(e: React.KeyboardEvent, task: GanttTask) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/taches/${task.id}`);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowLeft" ? -1 : 1;
    if (e.shiftKey) {
      const candidate = addDays(task.endDate, delta);
      if (candidate >= task.startDate) void commitReschedule(task, task.startDate, candidate);
    } else {
      void commitReschedule(task, addDays(task.startDate, delta), addDays(task.endDate, delta));
    }
  }

  return (
    <div>
      {/* Le nombre de semaines et la plage qui en résulte vont ensemble, à
          gauche ; la navigation (aller à une date, reculer/aujourd'hui/
          avancer) va ensemble, à droite — plutôt que la plage affichée sur
          sa propre ligne, séparée du réglage qui la détermine. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="rounded-md border-[1.5px] border-heading px-2 py-1 text-sm text-ink"
          >
            {[2, 4, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                {n} semaines
              </option>
            ))}
          </select>
          <span className="text-sm font-semibold text-heading">{rangeLabel}</span>
        </div>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startIsoOfView}
            onChange={(e) => e.target.value && setWeekStart(mondayOf(fromIsoDate(e.target.value)))}
            aria-label="Aller à une date"
            className="rounded-md border-[1.5px] border-heading px-2 py-1 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -14))}
            className={`p-1 text-heading ${textButtonClass}`}
            aria-label="Reculer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(mondayOf(addDays(fromIsoDate(today()), -7)))}
            className={`text-sm font-semibold text-heading underline-offset-2 hover:underline ${textButtonClass}`}
          >
            Aujourd’hui
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 14))}
            className={`p-1 text-heading ${textButtonClass}`}
            aria-label="Avancer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}

      <div className="flex border border-line">
        <div style={{ width: labelWidth, flexShrink: 0 }} className="border-r border-line">
          <div
            style={{ height: HEADER_HEIGHT }}
            className="sticky top-0 z-10 flex items-center border-b border-line bg-wash px-3"
          >
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
                  r.type === "projet" ? "bg-wash font-bold text-heading" : "pl-6 text-ink"
                }`}
              >
                {r.label}
              </div>
            ))
          )}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner la colonne des libellés"
          onMouseDown={(e) => {
            e.preventDefault();
            labelResizeRef.current = { startX: e.clientX, startWidth: labelWidth };
            setResizingLabel(true);
          }}
          className="w-1.5 flex-shrink-0 cursor-col-resize bg-line hover:bg-heading"
        />

        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div style={{ width }}>
            <div style={{ height: HEADER_HEIGHT }} className="sticky top-0 z-10 border-b border-line bg-wash">
              {days.map((d, i) => {
                if (i % 7 !== 0) return null;
                // L'année n'est pas répétée ici : la plage affichée en toutes
                // lettres au-dessus du Gantt (rangeLabel) la porte déjà —
                // l'an prochain aurait sinon accolé "2026" au mois sans
                // espace dès la première colonne.
                return (
                  <div
                    key={i}
                    style={{ position: "absolute", left: i * dayWidth, top: 0, width: 7 * dayWidth, height: MONTH_ROW_HEIGHT }}
                    className="flex items-center overflow-hidden border-l border-line pl-1.5 text-xs font-bold whitespace-nowrap text-ink"
                  >
                    {d.getUTCDate()} {MOIS[d.getUTCMonth()]}
                  </div>
                );
              })}
              {days.map((d, i) => {
                const h = holidayName(d, holidays);
                const isToday = toIsoDate(d) === todayIso;
                return (
                  <div
                    key={i}
                    title={h ?? ""}
                    style={{
                      position: "absolute",
                      left: i * dayWidth,
                      top: MONTH_ROW_HEIGHT,
                      width: dayWidth,
                      height: DAY_ROW_HEIGHT,
                      background: h ? "var(--color-alert-wash)" : "transparent",
                      opacity: isWeekend(d) ? 0.5 : 1,
                    }}
                    className="flex flex-col items-center justify-center gap-0.5"
                  >
                    <span className="text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
                      {JOURS1[d.getUTCDay()]}
                    </span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: isToday ? "var(--color-heading)" : "var(--color-ink)" }}
                    >
                      {d.getUTCDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* overflow-hidden : une tâche hors de la plage affichée ne doit
                pas élargir la zone défilable — sinon changer le nombre de
                semaines ne "rétrécit" jamais vraiment le Gantt tant qu'une
                tâche déborde de la fenêtre visible. */}
            <div className="relative overflow-hidden" style={{ height }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: i * dayWidth,
                    top: 0,
                    bottom: 0,
                    width: dayWidth,
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
                const overlapping = overlappingTaskIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${t.title}, du ${toIsoDate(t.startDate)} au ${toIsoDate(t.endDate)}. Flèches pour décaler, Maj+Flèches pour ajuster la durée, Entrée pour ouvrir.`}
                    style={{
                      position: "absolute",
                      top: i * ROW_HEIGHT + 5,
                      left: x,
                      width: w,
                      height: ROW_HEIGHT - 10,
                      background: t.studio.fillHex,
                      color: t.studio.colorHex,
                      cursor: canDrag ? (drag ? "grabbing" : "grab") : "default",
                      outlineColor: overlapping ? "var(--color-alert)" : undefined,
                    }}
                    className={`flex items-center gap-1.5 overflow-hidden px-2 outline-2 -outline-offset-2 transition-[outline-color] duration-100 hover:outline-current focus-visible:outline-heading ${
                      overlapping ? "" : "outline-transparent"
                    }`}
                    onKeyDown={(e) => onBarKeyDown(e, t)}
                    onMouseDown={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      setDrag({ taskId: t.id, mode: "move", startClientX: e.clientX, deltaDays: 0 });
                    }}
                    onDoubleClick={() => router.push(`/taches/${t.id}`)}
                    title={`${t.title} · ${t.assignee?.name ?? "non attribué"}${
                      overlapping ? " · attention : chevauche une autre tâche de cette personne" : ""
                    } (double-clic pour les détails)`}
                  >
                    {overlapping && <span aria-hidden="true" className="text-2xs font-bold text-alert">⚠</span>}
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
          ? "Glissez une barre pour décaler la tâche, sa poignée droite pour la durée, double-cliquez pour l’ouvrir. Colonnes teintées : jours fériés. Trait pointillé rouge : chevauchement de dépendance. Contour rose ⚠ : une même personne a deux tâches qui se chevauchent."
          : "Le glisser n’est actif que sur ordinateur."}{" "}
        Au clavier : sélectionnez une barre puis Flèches pour la décaler, Maj+Flèches pour ajuster sa durée, Entrée pour l’ouvrir.
      </p>
    </div>
  );
}
