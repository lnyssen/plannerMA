"use client";

import { CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CreateTaskModal } from "@/components/modals/create-task-modal";
import type { TaskFormValues } from "@/components/modals/task-form-fields";
import { dangerOutlineButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { StudioBadge } from "@/components/ui/studio-badge";
import { deleteRequest } from "@/lib/actions/requests";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { RequestSummary } from "@/lib/data/requests";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskOption } from "@/lib/data/tasks";
import { quandFr, today, toIsoDate } from "@/lib/planning/dates";

export function DemandesView({
  requests,
  studios,
  people,
  projects,
  tasks,
}: {
  requests: RequestSummary[];
  studios: StudioSummary[];
  people: PersonSummary[];
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [converting, setConverting] = useState<RequestSummary | null>(null);

  function dismiss(id: string) {
    if (!confirm("Écarter cette demande ? Elle disparaît de la liste, sans créer de tâche.")) return;
    startTransition(async () => {
      await deleteRequest(id);
      router.refresh();
    });
  }

  function afterConvert(requestId: string) {
    startTransition(async () => {
      await deleteRequest(requestId);
      router.refresh();
    });
    setConverting(null);
  }

  const initialValues: Partial<TaskFormValues> | undefined = converting
    ? {
        title: converting.subject,
        studioId: converting.studioId,
        description: converting.detail ?? "",
        startDate: converting.wantedFor ? toIsoDate(converting.wantedFor) : today(),
        endDate: converting.wantedFor ? toIsoDate(converting.wantedFor) : today(),
      }
    : undefined;

  return (
    <div className="px-8 py-8">
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Demandes
      </h1>
      <p className="mb-6 text-sm text-ink-muted">
        Déposées via « + Nouvelle demande » dans la barre latérale — à convertir en tâche ou à écarter.
      </p>

      {requests.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucune demande en attente.</p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-line p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-[family-name:var(--font-body)] text-base font-bold text-rail">{r.subject}</p>
                  <p className="text-xs text-ink-muted">
                    {r.createdBy ?? "Anonyme"} · {quandFr(r.createdAt)}
                    {r.requester ? ` · pour ${r.requester}` : ""}
                  </p>
                </div>
                <StudioBadge name={r.studio.name} fillHex={r.studio.fillHex} colorHex={r.studio.colorHex} />
              </div>
              {r.wantedFor && (
                <p className="mb-1.5 text-sm text-ink">Souhaité pour le {quandFr(r.wantedFor)}.</p>
              )}
              {r.detail && <p className="mb-3 text-sm whitespace-pre-wrap text-ink">{r.detail}</p>}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setConverting(r)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
                >
                  <CheckCircle2 size={14} /> Convertir en tâche
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${dangerOutlineButtonClass}`}
                >
                  <X size={14} /> Écarter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {converting && (
        <CreateTaskModal
          studios={studios}
          projects={projects}
          people={people}
          tasks={tasks}
          initialValues={initialValues}
          onClose={() => setConverting(null)}
          onCreated={() => afterConvert(converting.id)}
        />
      )}
    </div>
  );
}
