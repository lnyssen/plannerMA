"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskOption } from "@/lib/data/tasks";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import { today } from "@/lib/planning/dates";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { SidePanel } from "./side-panel";
import { EMPTY_TASK_FORM, TaskFormFields, type TaskFormValues } from "./task-form-fields";

export function CreateTaskModal({
  studios,
  projects,
  people,
  tasks = [],
  statuses = [],
  initialValues,
  onClose,
  onCreated,
}: {
  studios: StudioSummary[];
  projects: ProjectOption[];
  people: PersonSummary[];
  tasks?: TaskOption[];
  statuses?: TaskStatusSummary[];
  /** Pré-remplissage (ex. conversion d'une demande en tâche) — fusionné sur les valeurs par défaut. */
  initialValues?: Partial<TaskFormValues>;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const auj = today();
  const [values, setValues] = useState<TaskFormValues>({
    ...EMPTY_TASK_FORM,
    studioIds: studios[0] ? [studios[0].id] : [],
    startDate: auj,
    endDate: auj,
    ...initialValues,
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
        studioIds: values.studioIds,
        projectId: values.projectId || null,
        assigneeId: values.assigneeId || null,
        startDate: values.startDate,
        endDate: values.endDate < values.startDate ? values.startDate : values.endDate,
        maxDurationDays: values.maxDurationDays ? Number(values.maxDurationDays) : null,
        dependsOnId: values.dependsOnId || null,
        estimatedHalfDays: values.estimatedHalfDays ? Number(values.estimatedHalfDays) : null,
        recurrenceFrequency: values.recurrenceFrequency ? (values.recurrenceFrequency as "WEEKLY" | "MONTHLY") : null,
        recurrenceInterval: values.recurrenceFrequency ? Number(values.recurrenceInterval) || 1 : null,
        recurrenceUntil: values.recurrenceFrequency && values.recurrenceUntil ? values.recurrenceUntil : null,
        statusId: values.statusId || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onCreated(result.id!);
    });
  }

  return (
    <SidePanel title="Nouvelle tâche" onClose={onClose} size="lg">
      {/* Une tâche démarre normalement dans le premier statut, sans champ
          « État » à la création. On ne l'affiche que si le geste d'ouverture
          en a désigné un — créer depuis une colonne du Kanban, typiquement :
          il faut alors pouvoir voir et corriger où la tâche va atterrir. */}
      <TaskFormFields
        values={values}
        onChange={patch}
        studios={studios}
        projects={projects}
        people={people}
        tasks={tasks}
        statuses={statuses}
        showStatus={!!initialValues?.statusId}
      />

      {error && (
        <p role="alert" className="mb-3 text-xs font-semibold text-alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
        >
          {pending ? "Création…" : "Créer"}
        </button>
      </div>
    </SidePanel>
  );
}
