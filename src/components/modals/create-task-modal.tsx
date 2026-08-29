"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectWithCounts } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import { today } from "@/lib/planning/dates";
import { FieldLabel, ModalShell, fieldInputClass } from "./modal-shell";

export function CreateTaskModal({
  studios,
  projects,
  people,
  onClose,
  onCreated,
}: {
  studios: StudioSummary[];
  projects: Pick<ProjectWithCounts, "id" | "name" | "client">[];
  people: PersonSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const auj = today();
  const [title, setTitle] = useState("");
  const [studioId, setStudioId] = useState(studios[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState(auj);
  const [endDate, setEndDate] = useState(auj);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTask({
        title,
        studioId,
        projectId: projectId || null,
        assigneeId: assigneeId || null,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated();
    });
  }

  return (
    <ModalShell title="Nouvelle tâche" onClose={onClose}>
      <FieldLabel htmlFor="task-title">Intitulé</FieldLabel>
      <input
        id="task-title"
        className={`${fieldInputClass} mb-3`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ASF — relecture BAT 1"
        autoFocus
      />

      <FieldLabel htmlFor="task-studio">Studio</FieldLabel>
      <select
        id="task-studio"
        className={`${fieldInputClass} mb-3`}
        value={studioId}
        onChange={(e) => setStudioId(e.target.value)}
      >
        {studios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <FieldLabel htmlFor="task-project">Projet</FieldLabel>
      <select
        id="task-project"
        className={`${fieldInputClass} mb-3`}
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
      >
        <option value="">Sans projet</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.client}
          </option>
        ))}
      </select>

      <div className="mb-3">
        <FieldLabel htmlFor="task-person">Attribuée à</FieldLabel>
        <select
          id="task-person"
          className={fieldInputClass}
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
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
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <FieldLabel htmlFor="task-end">Au</FieldLabel>
          <input
            id="task-end"
            type="date"
            className={fieldInputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-xs font-semibold text-alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="border-[1.5px] border-heading px-4 py-2 text-sm font-semibold text-heading"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="bg-heading px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer"}
        </button>
      </div>
    </ModalShell>
  );
}
