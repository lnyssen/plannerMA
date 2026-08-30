"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import { today } from "@/lib/planning/dates";
import { ModalShell } from "./modal-shell";
import { EMPTY_TASK_FORM, TaskFormFields, type TaskFormValues } from "./task-form-fields";

export function CreateTaskModal({
  studios,
  projects,
  people,
  onClose,
  onCreated,
}: {
  studios: StudioSummary[];
  projects: ProjectOption[];
  people: PersonSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const auj = today();
  const [values, setValues] = useState<TaskFormValues>({
    ...EMPTY_TASK_FORM,
    studioId: studios[0]?.id ?? "",
    startDate: auj,
    endDate: auj,
  });
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<TaskFormValues>) {
    setValues((v) => ({ ...v, ...p }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTask({
        title: values.title,
        description: values.description || null,
        studioId: values.studioId,
        projectId: values.projectId || null,
        assigneeId: values.assigneeId || null,
        startDate: values.startDate,
        endDate: values.endDate < values.startDate ? values.startDate : values.endDate,
        maxDurationDays: values.maxDurationDays ? Number(values.maxDurationDays) : null,
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
      <TaskFormFields values={values} onChange={patch} studios={studios} projects={projects} people={people} />

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
