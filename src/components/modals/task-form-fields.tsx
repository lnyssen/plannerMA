"use client";

import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import { STATUS_COLORS, STATUS_LABEL, STATUS_ORDER } from "@/lib/planning/status";
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
  status: TaskStatusValue;
}

type TaskStatusValue = (typeof STATUS_ORDER)[number];

export function TaskFormFields({
  values,
  onChange,
  studios,
  projects,
  people,
  showStatus,
}: {
  values: TaskFormValues;
  onChange: (patch: Partial<TaskFormValues>) => void;
  studios: StudioSummary[];
  projects: ProjectOption[];
  people: PersonSummary[];
  showStatus?: boolean;
}) {
  return (
    <>
      <FieldLabel htmlFor="task-title">Intitulé</FieldLabel>
      <input
        id="task-title"
        className={`${fieldInputClass} mb-3`}
        value={values.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="ASF — relecture BAT 1"
        autoFocus
      />

      <FieldLabel htmlFor="task-description">Description</FieldLabel>
      <textarea
        id="task-description"
        rows={3}
        className={`${fieldInputClass} mb-3 resize-y`}
        value={values.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Précisions, contexte, consignes…"
      />

      <div className="mb-3 flex gap-3">
        <div className="flex-1">
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
          <div className="flex-1">
            <FieldLabel htmlFor="task-status">État</FieldLabel>
            <select
              id="task-status"
              className={fieldInputClass}
              value={values.status}
              onChange={(e) => onChange({ status: e.target.value as TaskStatusValue })}
              style={{ background: STATUS_COLORS[values.status].fill, color: STATUS_COLORS[values.status].text }}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <FieldLabel htmlFor="task-project">Projet</FieldLabel>
      <select
        id="task-project"
        className={`${fieldInputClass} mb-3`}
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

      <div className="mb-3">
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

      <div className="mb-4 flex gap-3">
        <div className="flex-1">
          <FieldLabel htmlFor="task-start">Du</FieldLabel>
          <input
            id="task-start"
            type="date"
            className={fieldInputClass}
            value={values.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>
        <div className="flex-1">
          <FieldLabel htmlFor="task-end">Au</FieldLabel>
          <input
            id="task-end"
            type="date"
            className={fieldInputClass}
            value={values.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </div>
        <div className="w-28">
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
    </>
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
  status: "TODO",
};
