"use client";

import { AlertTriangle, CalendarDays, List, Play, Plus, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addManualEntry, deleteTimeEntry, startTimer, stopTimer, type RunningTimer } from "@/lib/actions/time-entries";
import type { TimeEntryWithPerson, TimeEntryWithTask } from "@/lib/data/time-entries";
import type { TaskOption } from "@/lib/data/tasks";
import { formatLongFr, quandFr, toIsoDate, today } from "@/lib/planning/dates";
import { entryDurationMinutes, formatDurationFr, sumDurationMinutes } from "@/lib/planning/time";
import { fieldInputClass, FieldLabel } from "@/components/modals/modal-shell";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { TimeCalendar } from "./time-calendar";

interface ProjectBudget {
  id: string;
  name: string;
  budgetHours: number | null;
  tasks: { timeEntries: { startedAt: Date; endedAt: Date | null }[] }[];
}

export function TempsView({
  myEntries,
  runningTimer,
  tasks,
  allEntries,
  projectsWithBudget,
  isAdmin,
  hasPerson,
}: {
  myEntries: TimeEntryWithTask[];
  runningTimer: RunningTimer;
  tasks: TaskOption[];
  allEntries: TimeEntryWithPerson[];
  projectsWithBudget: ProjectBudget[];
  isAdmin: boolean;
  hasPerson: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [mineView, setMineView] = useState<"list" | "calendar">("list");
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(today());
  const [manualHours, setManualHours] = useState("0");
  const [manualMinutes, setManualMinutes] = useState("30");
  const [manualNote, setManualNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Fait avancer l'affichage du minuteur en cours sans re-solliciter le
  // serveur — juste une horloge locale, la vraie donnée (startedAt) reste
  // côté serveur.
  useEffect(() => {
    if (!runningTimer) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [runningTimer]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` n'est pas lu ici, juste utilisé pour invalider le memo toutes les 30s
  const referenceNow = useMemo(() => new Date(), [tick]);

  function handleStart() {
    if (!taskId) return;
    setError(null);
    startTransition(async () => {
      const result = await startTimer(taskId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleStop(entryId: string) {
    startTransition(async () => {
      await stopTimer(entryId);
      router.refresh();
    });
  }

  function handleManualSubmit() {
    if (!taskId) return;
    setError(null);
    startTransition(async () => {
      const result = await addManualEntry({
        taskId,
        date: manualDate,
        hours: Number(manualHours) || 0,
        minutes: Number(manualMinutes) || 0,
        note: manualNote.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setManualNote("");
      setShowManual(false);
      router.refresh();
    });
  }

  function handleDelete(entryId: string) {
    startTransition(async () => {
      await deleteTimeEntry(entryId);
      router.refresh();
    });
  }

  const groupedMine = useMemo(() => {
    const groups = new Map<string, TimeEntryWithTask[]>();
    for (const e of myEntries) {
      const day = toIsoDate(e.startedAt);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(e);
    }
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [myEntries]);

  const overBudget = useMemo(
    () =>
      projectsWithBudget
        .map((p) => ({
          id: p.id,
          name: p.name,
          totalMinutes: sumDurationMinutes(p.tasks.flatMap((t) => t.timeEntries), referenceNow),
          budgetMinutes: (p.budgetHours ?? 0) * 60,
        }))
        .filter((p) => p.totalMinutes > p.budgetMinutes),
    [projectsWithBudget, referenceNow],
  );

  if (!hasPerson) {
    return (
      <div className="px-8 py-8">
        <h1 className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Temps
        </h1>
        <p className="text-sm text-ink-muted">
          Votre compte n’est relié à aucune fiche personne — vous ne pouvez pas enregistrer de temps.
        </p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Temps
        </h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("mine")}
              className={`px-3 py-1.5 text-sm font-semibold ${tab === "mine" ? primaryButtonClass : secondaryButtonClass}`}
            >
              Mon temps
            </button>
            <button
              type="button"
              onClick={() => setTab("team")}
              className={`px-3 py-1.5 text-sm font-semibold ${tab === "team" ? primaryButtonClass : secondaryButtonClass}`}
            >
              Équipe
            </button>
          </div>
        )}
      </div>

      {tab === "mine" && (
        <div className="max-w-3xl">
          {runningTimer ? (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-heading bg-wash px-4 py-3">
              <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-alert" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rail">{runningTimer.task.title}</p>
                {runningTimer.task.project && <p className="text-xs text-ink-muted">{runningTimer.task.project.name}</p>}
              </div>
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-heading tabular-nums">
                {formatDurationFr(entryDurationMinutes(runningTimer, referenceNow))}
              </span>
              <button
                type="button"
                onClick={() => handleStop(runningTimer.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${dangerButtonClass}`}
              >
                <Square size={14} /> Arrêter
              </button>
            </div>
          ) : (
            <div className="mb-6 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <FieldLabel htmlFor="timer-task">Tâche</FieldLabel>
                <select
                  id="timer-task"
                  className={fieldInputClass}
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                      {t.project ? ` — ${t.project.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!taskId}
                onClick={handleStart}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
              >
                <Play size={14} /> Démarrer
              </button>
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                <Plus size={14} /> Saisie manuelle
              </button>
            </div>
          )}

          {showManual && (
            <div className="mb-6 flex flex-wrap items-end gap-2 border border-line rounded-lg p-3">
              <div>
                <FieldLabel htmlFor="manual-date">Date</FieldLabel>
                <input
                  id="manual-date"
                  type="date"
                  className={fieldInputClass}
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <div className="w-20">
                <FieldLabel htmlFor="manual-hours">Heures</FieldLabel>
                <input
                  id="manual-hours"
                  type="number"
                  min={0}
                  max={24}
                  className={fieldInputClass}
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                />
              </div>
              <div className="w-20">
                <FieldLabel htmlFor="manual-minutes">Minutes</FieldLabel>
                <input
                  id="manual-minutes"
                  type="number"
                  min={0}
                  max={59}
                  className={fieldInputClass}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <FieldLabel htmlFor="manual-note">Note (facultatif)</FieldLabel>
                <input
                  id="manual-note"
                  className={fieldInputClass}
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={handleManualSubmit}
                className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
              >
                Ajouter
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mb-4 text-xs font-semibold text-alert">
              {error}
            </p>
          )}

          <div className="mb-4 flex overflow-hidden rounded-lg border-[1.5px] border-heading" style={{ width: "fit-content" }}>
            <button
              type="button"
              onClick={() => setMineView("list")}
              aria-pressed={mineView === "list"}
              className="flex items-center gap-1.5 border-r-[1.5px] border-heading px-2.5 py-1 text-xs font-semibold"
              style={{
                background: mineView === "list" ? "var(--color-heading)" : "transparent",
                color: mineView === "list" ? "var(--color-paper)" : "var(--color-ink-muted)",
              }}
            >
              <List size={13} /> Liste
            </button>
            <button
              type="button"
              onClick={() => setMineView("calendar")}
              aria-pressed={mineView === "calendar"}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
              style={{
                background: mineView === "calendar" ? "var(--color-heading)" : "transparent",
                color: mineView === "calendar" ? "var(--color-paper)" : "var(--color-ink-muted)",
              }}
            >
              <CalendarDays size={13} /> Calendrier
            </button>
          </div>

          {mineView === "calendar" ? (
            <TimeCalendar entries={myEntries} />
          ) : groupedMine.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune écriture pour l’instant.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {groupedMine.map(([day, entries]) => (
                <div key={day}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{formatLongFr(day)}</p>
                    <p className="text-xs font-semibold text-ink-muted tabular-nums">
                      {formatDurationFr(sumDurationMinutes(entries, referenceNow))}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {entries.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <div className="flex-1">
                          <span className="text-ink">{e.task.title}</span>
                          {e.task.project && <span className="text-ink-muted"> — {e.task.project.name}</span>}
                          {e.note && <p className="text-xs text-ink-muted">{e.note}</p>}
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold text-ink tabular-nums">
                          {formatDurationFr(entryDurationMinutes(e, referenceNow))}
                          {!e.endedAt && " (en cours)"}
                        </span>
                        {e.endedAt && (
                          <button
                            type="button"
                            onClick={() => handleDelete(e.id)}
                            aria-label={`Retirer l’écriture sur ${e.task.title}`}
                            className={`flex-shrink-0 p-0.5 text-ink-muted hover:text-alert ${textButtonClass}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "team" && isAdmin && (
        <div className="max-w-4xl">
          {overBudget.length > 0 && (
            <div className="mb-6 flex flex-col gap-2">
              {overBudget.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-alert bg-alert-wash px-3 py-2 text-sm"
                >
                  <AlertTriangle size={14} className="flex-shrink-0" style={{ color: "var(--color-alert)" }} />
                  <span className="flex-1 text-ink">
                    <strong>{p.name}</strong> dépasse son budget : {formatDurationFr(p.totalMinutes)} enregistrées
                    pour {formatDurationFr(p.budgetMinutes)} prévues.
                  </span>
                </div>
              ))}
            </div>
          )}

          {allEntries.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune écriture pour l’instant.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {allEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="w-32 flex-shrink-0 truncate font-semibold text-rail">{e.person.name}</span>
                  <div className="flex-1">
                    <span className="text-ink">{e.task.title}</span>
                    {e.task.project && <span className="text-ink-muted"> — {e.task.project.name}</span>}
                  </div>
                  <span className="flex-shrink-0 text-xs text-ink-muted tabular-nums">{quandFr(e.startedAt)}</span>
                  <span className="flex-shrink-0 text-xs font-semibold text-ink tabular-nums">
                    {formatDurationFr(entryDurationMinutes(e, referenceNow))}
                    {!e.endedAt && " (en cours)"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
