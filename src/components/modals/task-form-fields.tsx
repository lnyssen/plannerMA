"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { checkTaskCapacity, type CapacityWarning } from "@/lib/actions/capacity";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskOption } from "@/lib/data/tasks";
import { formatShortFr } from "@/lib/planning/dates";
import { sortByTaskContext, taskContextLabel } from "@/lib/planning/labels";
import { FieldLabel, fieldInputClass } from "./modal-shell";

export interface TaskFormValues {
  title: string;
  description: string;
  studioId: string;
  projectId: string;
  assigneeId: string;
  startDate: string;
  endDate: string;
  maxDurationDays: string; // chaîne vide = pas de borne, sinon un entier positif
  statusId: string;
  dependsOnId: string; // chaîne vide = aucune dépendance
  estimatedHalfDays: string; // chaîne vide = pas d'estimation (calcul de charge en tout-ou-rien, voir availability.ts)
  recurrenceFrequency: string; // "" | "WEEKLY" | "MONTHLY"
  recurrenceInterval: string; // "tous les N" semaines/mois — ignoré si recurrenceFrequency est vide
  recurrenceUntil: string; // chaîne vide = pas de fin
}

export function TaskFormFields({
  values,
  onChange,
  studios,
  projects,
  people,
  statuses = [],
  tasks = [],
  showStatus,
  excludeTaskId,
}: {
  values: TaskFormValues;
  onChange: (patch: Partial<TaskFormValues>) => void;
  studios: StudioSummary[];
  projects: ProjectOption[];
  people: PersonSummary[];
  statuses?: TaskStatusSummary[];
  /** Candidates pour "Dépend de" — la tâche elle-même déjà exclue par l'appelant en édition. */
  tasks?: TaskOption[];
  showStatus?: boolean;
  /** La tâche en cours d'édition — exclue du calcul de charge pour ne pas se compter elle-même. */
  excludeTaskId?: string;
}) {
  const currentStatus = statuses.find((s) => s.id === values.statusId);

  // Avertissement de surcharge — recalculé après une pause de saisie plutôt
  // qu'à chaque frappe, et seulement quand la personne + les deux dates sont
  // renseignées (sinon la plage n'a pas de sens à vérifier).
  const [capacityWarning, setCapacityWarning] = useState<CapacityWarning | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (!values.assigneeId || !values.startDate || !values.endDate) {
        setCapacityWarning(null);
        return;
      }
      checkTaskCapacity({
        personId: values.assigneeId,
        startDate: values.startDate,
        endDate: values.endDate,
        estimatedHalfDays: values.estimatedHalfDays ? Number(values.estimatedHalfDays) : null,
        excludeTaskId,
      }).then((warning) => {
        if (!cancelled) setCapacityWarning(warning);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [values.assigneeId, values.startDate, values.endDate, values.estimatedHalfDays, excludeTaskId]);

  return (
    <div className="mb-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FieldLabel htmlFor="task-title">Intitulé</FieldLabel>
        <input
          id="task-title"
          className={fieldInputClass}
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="ASF — relecture BAT 1"
          autoFocus
        />
      </div>

      <div className="sm:col-span-2">
        <FieldLabel htmlFor="task-description">Description</FieldLabel>
        <textarea
          id="task-description"
          rows={3}
          className={`${fieldInputClass} h-auto! resize-y`}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Précisions, contexte, consignes…"
        />
      </div>

      <div>
        <FieldLabel htmlFor="task-studio">Studio</FieldLabel>
        <select
          id="task-studio"
          className={fieldInputClass}
          value={values.studioId}
          onChange={(e) => onChange({ studioId: e.target.value })}
        >
          {studios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {showStatus && (
        <div>
          <FieldLabel htmlFor="task-status">État</FieldLabel>
          <select
            id="task-status"
            className={fieldInputClass}
            value={values.statusId}
            onChange={(e) => onChange({ statusId: e.target.value })}
            style={currentStatus ? { background: currentStatus.fillHex, color: currentStatus.colorHex } : undefined}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <FieldLabel htmlFor="task-project">Projet</FieldLabel>
        <select
          id="task-project"
          className={fieldInputClass}
          value={values.projectId}
          onChange={(e) => onChange({ projectId: e.target.value })}
        >
          <option value="">Sans projet</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.client.name} — {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel htmlFor="task-person">Attribuée à</FieldLabel>
        <select
          id="task-person"
          className={fieldInputClass}
          value={values.assigneeId}
          onChange={(e) => onChange({ assigneeId: e.target.value })}
        >
          <option value="">Non attribué</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.team ? ` — ${p.team}` : ""}
            </option>
          ))}
        </select>
      </div>

      {tasks.length > 0 && (
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="task-depends-on">Dépend de</FieldLabel>
          <select
            id="task-depends-on"
            className={fieldInputClass}
            value={values.dependsOnId}
            onChange={(e) => onChange({ dependsOnId: e.target.value })}
          >
            <option value="">Aucune dépendance</option>
            {sortByTaskContext(tasks).map((t) => (
              <option key={t.id} value={t.id}>
                {taskContextLabel(t)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
        <div>
          <FieldLabel htmlFor="task-start">Du</FieldLabel>
          <input
            id="task-start"
            type="date"
            className={fieldInputClass}
            value={values.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel htmlFor="task-end">Au</FieldLabel>
          <input
            id="task-end"
            type="date"
            className={fieldInputClass}
            value={values.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel htmlFor="task-max-duration">Max. (j)</FieldLabel>
          <input
            id="task-max-duration"
            type="number"
            min={1}
            step={1}
            className={fieldInputClass}
            value={values.maxDurationDays}
            onChange={(e) => onChange({ maxDurationDays: e.target.value })}
            placeholder="—"
          />
        </div>
        <div>
          <FieldLabel htmlFor="task-effort">Estim. (demi-j)</FieldLabel>
          <input
            id="task-effort"
            type="number"
            min={0}
            step={1}
            className={fieldInputClass}
            value={values.estimatedHalfDays}
            onChange={(e) => onChange({ estimatedHalfDays: e.target.value })}
            placeholder="—"
            title="Effort réel estimé, distinct de la plage de dates — utilisé pour la vue Charge."
          />
        </div>
      </div>

      {capacityWarning && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold sm:col-span-2"
          style={{ background: "var(--color-alert-wash)", color: "var(--color-alert)" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0" />
          {capacityWarning.personName} est déjà chargé·e à {capacityWarning.ratioPercent}% la semaine du{" "}
          {formatShortFr(capacityWarning.weekStart)} avec cette tâche incluse.
        </div>
      )}

      <div className="sm:col-span-2">
        <FieldLabel htmlFor="task-recurrence">Récurrence</FieldLabel>
        <div className="flex flex-wrap items-center gap-3">
          <select
            id="task-recurrence"
            className={`${fieldInputClass} max-w-[180px]`}
            value={values.recurrenceFrequency}
            onChange={(e) => onChange({ recurrenceFrequency: e.target.value })}
          >
            <option value="">Aucune</option>
            <option value="WEEKLY">Chaque semaine</option>
            <option value="MONTHLY">Chaque mois</option>
          </select>
          {values.recurrenceFrequency && (
            <>
              <label className="flex items-center gap-1.5 text-sm text-ink" htmlFor="task-recurrence-interval">
                Tous les
                <input
                  id="task-recurrence-interval"
                  type="number"
                  min={1}
                  step={1}
                  className={`${fieldInputClass} w-16`}
                  value={values.recurrenceInterval}
                  onChange={(e) => onChange({ recurrenceInterval: e.target.value })}
                />
                {values.recurrenceFrequency === "WEEKLY" ? "semaine(s)" : "mois"}
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink" htmlFor="task-recurrence-until">
                Jusqu’au
                <input
                  id="task-recurrence-until"
                  type="date"
                  className={fieldInputClass}
                  value={values.recurrenceUntil}
                  onChange={(e) => onChange({ recurrenceUntil: e.target.value })}
                />
              </label>
            </>
          )}
        </div>
        {values.recurrenceFrequency && (
          <p className="mt-1.5 text-2xs text-ink-muted">
            L’occurrence suivante est créée automatiquement quand cette tâche passe à un statut « Terminé ».
          </p>
        )}
      </div>
    </div>
  );
}

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: "",
  description: "",
  studioId: "",
  projectId: "",
  assigneeId: "",
  startDate: "",
  endDate: "",
  maxDurationDays: "",
  statusId: "",
  dependsOnId: "",
  estimatedHalfDays: "",
  recurrenceFrequency: "",
  recurrenceInterval: "1",
  recurrenceUntil: "",
};
