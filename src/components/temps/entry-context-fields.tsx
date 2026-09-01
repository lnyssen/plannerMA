"use client";

import { useState } from "react";
import type { ProjectOption } from "@/lib/data/projects";
import type { TaskCategoryOption } from "@/lib/data/task-categories";
import type { TaskOption } from "@/lib/data/tasks";
import type { StudioSummary } from "@/lib/data/studios";
import { FieldLabel, fieldInputClass } from "@/components/modals/modal-shell";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { TaskCascadeFields } from "@/components/ui/task-cascade-fields";

export interface EntryContextValue {
  taskId: string | null;
  studioId: string;
  projectId: string | null;
  categoryId: string | null;
}

/**
 * Bloc commun Studio / Projet ("AGENCE" = hors-projet) / Type de tâche,
 * avec un lien facultatif vers une Task planifiée — partagé par le
 * minuteur, la saisie manuelle et le calendrier (voir temps-view.tsx,
 * time-calendar.tsx). Deux modes : "Tâche planifiée" dérive Studio et
 * Projet de la tâche choisie (source de vérité côté serveur, voir
 * resolveEntryContext dans src/lib/actions/time-entries.ts) ; "Autre
 * activité" les demande directement — c'est le chemin pour le travail sans
 * tâche planifiée (nomenclature "Suivi hebdo du temps de travail" :
 * "Suivi emails", "Aide à un collègue"…).
 */
export function EntryContextFields({
  value,
  onChange,
  studios,
  projects,
  categories,
  tasks,
}: {
  value: EntryContextValue;
  onChange: (patch: Partial<EntryContextValue>) => void;
  studios: StudioSummary[];
  projects: ProjectOption[];
  categories: TaskCategoryOption[];
  tasks: TaskOption[];
}) {
  const [mode, setMode] = useState<"task" | "other">(value.taskId ? "task" : "other");
  const selectedTask = tasks.find((t) => t.id === value.taskId) ?? null;

  function switchMode(next: "task" | "other") {
    setMode(next);
    if (next === "task") {
      const firstTask = tasks[0];
      onChange({ taskId: firstTask?.id ?? null, studioId: firstTask?.studios[0]?.studioId ?? value.studioId, projectId: null });
    } else {
      onChange({ taskId: null, studioId: value.studioId || studios[0]?.id || "", projectId: null });
    }
  }

  const availableCategories = categories.filter((c) => c.studioId === null || c.studioId === value.studioId);
  const generalCategories = availableCategories.filter((c) => c.studioId === null);
  const studioCategories = availableCategories.filter((c) => c.studioId !== null);
  const studioName = studios.find((s) => s.id === value.studioId)?.name ?? "Studio";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchMode("task")}
          aria-pressed={mode === "task"}
          className={`px-2.5 py-1 text-xs font-semibold ${mode === "task" ? primaryButtonClass : secondaryButtonClass}`}
        >
          Tâche planifiée
        </button>
        <button
          type="button"
          onClick={() => switchMode("other")}
          aria-pressed={mode === "other"}
          className={`px-2.5 py-1 text-xs font-semibold ${mode === "other" ? primaryButtonClass : secondaryButtonClass}`}
        >
          Autre activité
        </button>
      </div>

      {mode === "task" ? (
        <>
          <TaskCascadeFields
            tasks={tasks}
            value={value.taskId ?? ""}
            onChange={(taskId) => {
              const task = tasks.find((t) => t.id === taskId);
              onChange({ taskId: taskId || null, studioId: task?.studios[0]?.studioId ?? value.studioId });
            }}
            idPrefix="entry-task"
          />
          {/* Une tâche a en général un seul studio : ce sélecteur
              n'apparaît que si celle-ci en a plusieurs (voir TaskStudio) —
              aucune hiérarchie entre eux, donc rien à présumer côté serveur
              (voir resolveEntryContext dans time-entries.ts). */}
          {selectedTask && selectedTask.studios.length > 1 && (
            <div className="min-w-[160px]">
              <FieldLabel htmlFor="entry-task-studio">Studio (pour cette écriture)</FieldLabel>
              <select
                id="entry-task-studio"
                className={fieldInputClass}
                value={value.studioId}
                onChange={(e) => onChange({ studioId: e.target.value })}
              >
                {selectedTask.studios.map(({ studioId }) => (
                  <option key={studioId} value={studioId}>
                    {studios.find((s) => s.id === studioId)?.name ?? studioId}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <FieldLabel htmlFor="entry-project">Projet</FieldLabel>
            <select
              id="entry-project"
              className={fieldInputClass}
              value={value.projectId ?? ""}
              onChange={(e) => onChange({ projectId: e.target.value || null })}
            >
              <option value="">AGENCE (hors projet)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client.name} — {p.name}
                  {p.code ? ` (${p.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <FieldLabel htmlFor="entry-studio">Studio</FieldLabel>
            <select
              id="entry-studio"
              className={fieldInputClass}
              value={value.studioId}
              onChange={(e) => onChange({ studioId: e.target.value })}
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <FieldLabel htmlFor="entry-category">Type de tâche</FieldLabel>
        <select
          id="entry-category"
          className={fieldInputClass}
          value={value.categoryId ?? ""}
          onChange={(e) => onChange({ categoryId: e.target.value || null })}
        >
          <option value="">Sans catégorie</option>
          {generalCategories.length > 0 && (
            <optgroup label="Général">
              {generalCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          {studioCategories.length > 0 && (
            <optgroup label={studioName}>
              {studioCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  );
}
