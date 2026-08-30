"use client";

import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskOption } from "@/lib/data/tasks";
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
}) {
  const currentStatus = statuses.find((s) => s.id === values.statusId);
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
          className={`${fieldInputClass} resize-y`}
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
              {p.name} — {p.client.name}
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
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.project ? ` — ${t.project.name}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

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
      <div className="grid grid-cols-2 gap-4">
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
};
