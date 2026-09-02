"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCreateModals, type CreateModalPrefill } from "@/components/shell/create-modals-context";
import { textButtonClass } from "@/components/ui/buttons";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  toIsoDate,
  today,
} from "@/lib/planning/dates";
import { studioBarStyle } from "@/lib/planning/labels";
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
  /** "projet" sert aussi de type d'en-tête de groupe pour le regroupement par personne (voir `groupBy`) — nom conservé pour limiter le diff, c'est un style, pas un libellé affiché. */
  type: "projet" | "tache";
  label: string;
  task?: GanttTask;
  /** Ce que la ligne apprend sur une tâche qu'on y créerait au glisser (projet et/ou personne du groupe). */
  prefill?: CreateModalPrefill;
}

/** Plage de dates en cours de tracé sur une zone vide, avant ouverture de la création. */
type CreateDragState = { row: number; a: number; b: number };

const WEEK_CHOICES = [2, 4, 8, 12, 16];

/**
 * Début de fenêtre : aujourd'hui, exactement.
 *
 * La vue s'ouvrait auparavant sur le lundi d'une semaine précédente, pour
 * garder un peu de passé en contexte. Mais on ne vient pas ici relire ce qui
 * est fait : la première colonne doit être le jour même, et toute la largeur
 * disponible sert à l'à-venir. Pas de calage sur le lundi non plus — cela
 * ramenait jusqu'à six jours de passé selon le jour de la semaine.
 */
function anchorOnToday() {
  return fromIsoDate(today());
}

/** Pas des flèches ‹ › : une demi-fenêtre, pour garder du recouvrement d'un écran à l'autre. */
function scrollStepDays(weeks: number) {
  return 7 * Math.max(1, Math.floor(weeks / 2));
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

  const [weeks, setWeeks] = useState(8);
  const [weekStart, setWeekStart] = useState(() => anchorOnToday());
  const [groupBy, setGroupBy] = useState<"project" | "person">("project");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canDrag, setCanDrag] = useState(true);
  const [createDrag, setCreateDrag] = useState<CreateDragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const openCreate = useCreateModals();
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
    const collator = new Intl.Collator("fr", { sensitivity: "base" });
    if (groupBy === "person") {
      const byPerson = new Map<string, GanttTask[]>();
      for (const t of tasks) {
        const key = t.assigneeId ?? "__none";
        if (!byPerson.has(key)) byPerson.set(key, []);
        byPerson.get(key)!.push(t);
      }
      const groups = [...byPerson.values()].sort((a, b) => {
        const an = a[0].assignee?.name ?? null;
        const bn = b[0].assignee?.name ?? null;
        if (!an && !bn) return 0;
        if (!an) return 1;
        if (!bn) return -1;
        return collator.compare(an, bn);
      });
      const out: Row[] = [];
      for (const list of groups) {
        const assigneeId = list[0].assigneeId ?? "";
        out.push({ type: "projet", label: list[0].assignee?.name ?? "Non attribué", prefill: { assigneeId } });
        for (const t of [...list].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())) {
          out.push({ type: "tache", label: t.title, task: t, prefill: { assigneeId, projectId: t.projectId ?? "" } });
        }
      }
      return out;
    }

    const byProject = new Map<string, GanttTask[]>();
    for (const t of tasks) {
      const key = t.projectId ?? "__none";
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(t);
    }
    const out: Row[] = [];
    for (const list of byProject.values()) {
      const project = list[0].project;
      const projectId = list[0].projectId ?? "";
      out.push({
        type: "projet",
        label: project ? `${project.client.name} — ${project.name}` : "Sans projet",
        prefill: { projectId },
      });
      for (const t of [...list].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())) {
        out.push({ type: "tache", label: t.title, task: t, prefill: { projectId, assigneeId: t.assigneeId ?? "" } });
      }
    }
    return out;
  }, [tasks, groupBy]);

  // Tracé d'une plage sur une zone vide : on suit le pointeur au niveau de
  // la fenêtre pour que le geste survive à la sortie du cadre, et on ne
  // change jamais de ligne — une plage s'étale sur des dates, pas sur des
  // projets ni des personnes.
  useEffect(() => {
    const started = createDrag;
    if (!started) return;
    const grid = gridRef.current;
    if (!grid) return;

    function dayAt(clientX: number) {
      const rect = grid!.getBoundingClientRect();
      return Math.max(0, Math.min(days.length - 1, Math.floor((clientX - rect.left) / dayWidth)));
    }
    function onMove(e: PointerEvent) {
      e.preventDefault();
      const day = dayAt(e.clientX);
      setCreateDrag((c) => (c ? { ...c, b: day } : c));
    }
    function onUp() {
      setCreateDrag((c) => {
        if (c) {
          openCreate("task", {
            ...(rows[c.row]?.prefill ?? {}),
            startDate: toIsoDate(days[Math.min(c.a, c.b)]),
            endDate: toIsoDate(days[Math.max(c.a, c.b)]),
          });
        }
        return null;
      });
    }
    function onCancel() {
      setCreateDrag(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [createDrag, days, dayWidth, rows, openCreate]);

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
    // Tactile : mêmes deltas, sur le doigt plutôt que le curseur — `passive:
    // false` sur touchmove est nécessaire pour pouvoir bloquer le défilement
    // de la page pendant un glisser actif (sinon la barre bouge ET la page
    // défile en même temps sous le doigt).
    function onTouchMove(e: TouchEvent) {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      setDrag((d) => (d ? { ...d, deltaDays: Math.round((touch.clientX - d.startClientX) / dayWidthRef.current) } : d));
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
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
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

  /**
   * Changer la largeur de la fenêtre la réancre sur aujourd'hui — sauf si
   * l'utilisateur est parti consulter une autre période, auquel cas on garde
   * son point de départ plutôt que de le ramener de force au présent.
   */
  function changeWeeks(next: number) {
    const todayIso = today();
    const todayInView = startIsoOfView <= todayIso && todayIso <= viewEndIso;
    setWeeks(next);
    if (todayInView) setWeekStart(anchorOnToday());
  }

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
          <div className="flex items-center gap-2">
            <SegmentedControl
              ariaLabel="Nombre de semaines affichées"
              size="sm"
              value={String(weeks)}
              onChange={(v) => changeWeeks(Number(v))}
              options={WEEK_CHOICES.map((n) => ({ id: String(n), label: String(n), title: `${n} semaines` }))}
            />
            <span className="text-sm text-ink-muted">semaines</span>
          </div>
          <SegmentedControl
            ariaLabel="Grouper par"
            size="sm"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { id: "project", label: "Par projet" },
              { id: "person", label: "Par personne" },
            ]}
          />
          <span className="text-sm font-semibold text-heading">{rangeLabel}</span>
        </div>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startIsoOfView}
            onChange={(e) => e.target.value && setWeekStart(fromIsoDate(e.target.value))}
            aria-label="Aller à une date"
            className="h-10 rounded-md border-[1.5px] border-heading px-2.5 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -scrollStepDays(weeks)))}
            className={`p-1 text-heading ${textButtonClass}`}
            aria-label="Reculer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(anchorOnToday())}
            className={`text-sm font-semibold text-heading underline-offset-2 hover:underline ${textButtonClass}`}
          >
            Aujourd’hui
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, scrollStepDays(weeks)))}
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
            <div ref={gridRef} className="relative overflow-hidden" style={{ height }}>
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

              {/* Zone de tracé : placée sous les barres dans l'ordre du DOM,
                  donc un glissement qui démarre sur une barre reste un
                  déplacement de tâche, et seul le vide crée. */}
              <div
                className={`absolute inset-0 ${canDrag ? "cursor-cell touch-none" : ""}`}
                onPointerDown={(e) => {
                  if (!canDrag) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const day = Math.floor((e.clientX - rect.left) / dayWidth);
                  const row = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                  if (day < 0 || day >= days.length || row < 0 || row >= rows.length) return;
                  e.preventDefault();
                  setCreateDrag({ row, a: day, b: day });
                }}
              />

              <svg width={width} height={height} className="pointer-events-none absolute inset-0">
                {links.map((l, i) => (
                  <g key={i}>
                    <path
                      d={`M ${l.x1} ${l.y1} H ${l.x1 + 8} V ${l.y2} H ${l.x2}`}
                      fill="none"
                      stroke={l.conflict ? "var(--color-alert)" : "var(--color-ink)"}
                      strokeWidth={l.conflict ? 2 : 1.5}
                      strokeDasharray={l.conflict ? "4 3" : "0"}
                    />
                    <circle cx={l.x2} cy={l.y2} r={3} fill={l.conflict ? "var(--color-alert)" : "var(--color-ink)"} />
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
                      ...studioBarStyle(t.studios),
                      cursor: canDrag ? (drag ? "grabbing" : "grab") : "default",
                      outlineColor: overlapping ? "var(--color-alert)" : undefined,
                    }}
                    className={`flex items-center gap-1.5 overflow-hidden rounded-md px-2 outline-2 -outline-offset-2 transition-[outline-color,filter] duration-150 hover:brightness-95 hover:outline-current focus-visible:outline-heading ${
                      overlapping ? "" : "outline-transparent"
                    }`}
                    onKeyDown={(e) => onBarKeyDown(e, t)}
                    onMouseDown={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      setDrag({ taskId: t.id, mode: "move", startClientX: e.clientX, deltaDays: 0 });
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      if (!touch) return;
                      setDrag({ taskId: t.id, mode: "move", startClientX: touch.clientX, deltaDays: 0 });
                    }}
                    onDoubleClick={() => router.push(`/taches/${t.id}`)}
                    title={`${t.title} · ${t.assignee?.name ?? "non attribué"}${
                      overlapping ? " · attention : chevauche une autre tâche de cette personne" : ""
                    } (double-clic pour les détails)`}
                  >
                    {overlapping && <span aria-hidden="true" className="text-2xs font-bold text-alert">⚠</span>}
                    <span className="truncate text-2xs font-bold whitespace-nowrap">{t.title}</span>
                    <span
                      onMouseDown={(e) => {
                        if (!canDrag) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDrag({ taskId: t.id, mode: "resize", startClientX: e.clientX, deltaDays: 0 });
                      }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        if (!touch) return;
                        e.stopPropagation();
                        setDrag({ taskId: t.id, mode: "resize", startClientX: touch.clientX, deltaDays: 0 });
                      }}
                      style={{ marginLeft: "auto", width: 12, height: "100%", cursor: "ew-resize" }}
                      className="flex-shrink-0 border-r-2"
                    />
                  </div>
                );
              })}

              {createDrag && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-md border-[1.5px] border-heading"
                  style={{
                    left: Math.min(createDrag.a, createDrag.b) * dayWidth,
                    width: (Math.abs(createDrag.b - createDrag.a) + 1) * dayWidth,
                    top: createDrag.row * ROW_HEIGHT + 5,
                    height: ROW_HEIGHT - 10,
                    background: "color-mix(in srgb, var(--color-tint) 70%, transparent)",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Glissez une barre pour décaler la tâche, sa poignée droite pour la durée (souris ou tactile), double-cliquez
        pour l’ouvrir. Glissez sur une zone vide pour créer une tâche sur ces dates, déjà rattachée au projet (ou à la
        personne) de la ligne. Colonnes teintées : jours fériés. Trait pointillé rouge : chevauchement de dépendance. Contour
        rose ⚠ : une même personne a deux tâches qui se chevauchent.{" "}
        Au clavier : sélectionnez une barre puis Flèches pour la décaler, Maj+Flèches pour ajuster sa durée, Entrée pour l’ouvrir.
      </p>
    </div>
  );
}
